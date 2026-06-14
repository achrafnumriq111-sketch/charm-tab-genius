import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CODE_TTL_MIN = 5;

function randomCode(): string {
  // 6 digit, zero-padded
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const deviceName = (body.device_name || "").toString().trim().slice(0, 80);
    if (!deviceName) {
      return new Response(JSON.stringify({ error: "device_name verplicht" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve caller employee → must be owner or manager
    const { data: emp } = await admin
      .from("employees")
      .select("id, role, location_id, locations!inner(tenant_id)")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!emp || !["owner", "manager"].includes(emp.role)) {
      return new Response(JSON.stringify({ error: "Geen rechten" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // deno-lint-ignore no-explicit-any
    const tenantId = (emp as any).locations.tenant_id;
    const locationId = body.location_id || emp.location_id;

    // Generate a unique active code
    let code = "";
    for (let i = 0; i < 5; i++) {
      const candidate = randomCode();
      const { data: existing } = await admin
        .from("device_pairing_codes")
        .select("id")
        .eq("code", candidate)
        .is("used_at", null)
        .maybeSingle();
      if (!existing) {
        code = candidate;
        break;
      }
    }
    if (!code) {
      return new Response(JSON.stringify({ error: "Probeer opnieuw" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const expiresAt = new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString();

    const { data: inserted, error: insErr } = await admin
      .from("device_pairing_codes")
      .insert({
        code,
        tenant_id: tenantId,
        location_id: locationId,
        device_name: deviceName,
        created_by: emp.id,
        expires_at: expiresAt,
      })
      .select("id, code, expires_at")
      .single();

    if (insErr) {
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ code: inserted.code, expires_at: inserted.expires_at }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
