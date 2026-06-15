import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  opts: { email?: string; userId: string; tenantId: string; locationId: string },
): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(opts.userId)) throw new Error("Invalid userId");
  try {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${opts.userId}'`,
      limit: 1,
    });
    if (found?.data?.length) {
      const c = found.data[0];
      await stripe.customers.update(c.id, {
        metadata: { ...c.metadata, userId: opts.userId, tenant_id: opts.tenantId, location_id: opts.locationId },
      });
      return c.id;
    }
  } catch (e) {
    console.warn("customers.search failed, falling back to email lookup", (e as Error).message);
  }
  if (opts.email) {
    const existing = await stripe.customers.list({ email: opts.email, limit: 1 });
    if (existing.data.length) {
      const c = existing.data[0];
      await stripe.customers.update(c.id, {
        metadata: { ...c.metadata, userId: opts.userId, tenant_id: opts.tenantId, location_id: opts.locationId },
      });
      return c.id;
    }
  }
  const created = await stripe.customers.create({
    ...(opts.email && { email: opts.email }),
    metadata: { userId: opts.userId, tenant_id: opts.tenantId, location_id: opts.locationId },
  });
  return created.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const user = userData.user;

    const body = await req.json();
    const { priceId, environment, returnUrl, locationId, tenantId } = body as {
      priceId: string; environment: StripeEnv; returnUrl: string;
      locationId: string; tenantId: string;
    };
    if (!/^[a-zA-Z0-9_-]+$/.test(priceId)) throw new Error("Invalid priceId");
    if (!locationId || !tenantId) throw new Error("Missing locationId/tenantId");
    if (environment !== "sandbox" && environment !== "live") throw new Error("Invalid environment");

    // Verify user belongs to this tenant
    const { data: emp } = await supabase
      .from("employees")
      .select("role, location_id, locations!inner(tenant_id)")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    const empTenant = (emp as any)?.locations?.tenant_id;
    if (!emp || empTenant !== tenantId || emp.role !== "owner") {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const stripe = createStripeClient(environment);
    const prices = await stripe.prices.list({ lookup_keys: [priceId], limit: 1 });
    if (!prices.data.length) throw new Error("Price not found");
    const stripePrice = prices.data[0];
    const isRecurring = stripePrice.type === "recurring";

    const customerId = await resolveOrCreateCustomer(stripe, {
      email: user.email ?? undefined,
      userId: user.id,
      tenantId,
      locationId,
    });

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: 1 }],
      mode: isRecurring ? "subscription" : "payment",
      ui_mode: "embedded_page",
      return_url: returnUrl,
      customer: customerId,
      metadata: { userId: user.id, tenant_id: tenantId, location_id: locationId },
      ...(isRecurring && {
        subscription_data: {
          metadata: { userId: user.id, tenant_id: tenantId, location_id: locationId },
          trial_period_days: 14,
        },
      }),
    });

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-checkout error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
