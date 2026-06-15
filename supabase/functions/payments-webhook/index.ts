import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient, verifyWebhook } from "../_shared/stripe.ts";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }
  return _supabase;
}

function priceIdFromItem(item: any): string | null {
  return item?.price?.lookup_key
    || item?.price?.metadata?.lovable_external_id
    || item?.price?.id
    || null;
}

function isoFromUnix(s: number | null | undefined): string | null {
  return s ? new Date(s * 1000).toISOString() : null;
}

async function upsertSubscription(sub: any, env: StripeEnv) {
  const meta = sub.metadata || {};
  let tenantId: string | null = meta.tenant_id || null;
  let locationId: string | null = meta.location_id || null;

  // Fallback: read metadata from Customer object if missing on subscription
  if (!tenantId || !locationId) {
    try {
      const stripe = createStripeClient(env);
      const customer: any = await stripe.customers.retrieve(sub.customer);
      tenantId = tenantId || customer?.metadata?.tenant_id || null;
      locationId = locationId || customer?.metadata?.location_id || null;
    } catch (e) {
      console.error("customer lookup failed", e);
    }
  }

  if (!tenantId || !locationId) {
    console.error("No tenant_id/location_id in metadata for sub", sub.id);
    return;
  }

  const item = sub.items?.data?.[0];
  const priceId = priceIdFromItem(item);
  const priceCents = item?.price?.unit_amount ?? 0;
  const currency = (item?.price?.currency || "eur").toLowerCase();
  const periodStart = item?.current_period_start ?? sub.current_period_start;
  const periodEnd = item?.current_period_end ?? sub.current_period_end;
  const trialEnd = sub.trial_end ?? null;

  // Map Stripe status → our subscription_status enum (trialing/active/past_due/suspended/canceled)
  let status = sub.status as string;
  if (status === "unpaid" || status === "incomplete_expired") status = "suspended";
  if (status === "incomplete") status = "past_due";
  if (status === "paused") status = "suspended";

  const row = {
    location_id: locationId,
    tenant_id: tenantId,
    plan_type: "all_in" as const,
    status,
    price_cents: priceCents,
    currency,
    custom_overrides: {},
    stripe_customer_id: sub.customer,
    stripe_subscription_id: sub.id,
    stripe_price_id: priceId,
    trial_ends_at: isoFromUnix(trialEnd),
    current_period_start: isoFromUnix(periodStart),
    current_period_end: isoFromUnix(periodEnd),
    cancel_at_period_end: !!sub.cancel_at_period_end,
    canceled_at: status === "canceled" ? new Date().toISOString() : null,
    environment: env,
    updated_at: new Date().toISOString(),
  };

  const { error } = await getSupabase()
    .from("subscriptions")
    .upsert(row, { onConflict: "stripe_subscription_id" });
  if (error) console.error("upsert subscription failed", error);
}

async function markPastDue(invoice: any, env: StripeEnv) {
  const subId = invoice.subscription;
  if (!subId) return;
  const { error } = await getSupabase()
    .from("subscriptions")
    .update({ status: "past_due", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subId)
    .eq("environment", env);
  if (error) console.error("past_due update failed", error);
}

async function markCanceled(sub: any, env: StripeEnv) {
  const { error } = await getSupabase()
    .from("subscriptions")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", sub.id)
    .eq("environment", env);
  if (error) console.error("cancel update failed", error);
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  console.log("payments-webhook event", event.type, "env", env);

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "subscription.created":
    case "subscription.updated":
      await upsertSubscription(event.data.object, env);
      break;
    case "customer.subscription.deleted":
    case "subscription.canceled":
      await markCanceled(event.data.object, env);
      break;
    case "invoice.payment_failed":
    case "transaction.payment_failed":
      await markPastDue(event.data.object, env);
      break;
    case "invoice.payment_succeeded":
    case "transaction.completed":
      // No-op: subscription.updated will follow with status=active.
      break;
    default:
      console.log("Unhandled event:", event.type);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const rawEnv = new URL(req.url).searchParams.get("env");
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    return new Response(JSON.stringify({ received: true, ignored: "invalid env" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
    await handleWebhook(req, rawEnv);
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});
