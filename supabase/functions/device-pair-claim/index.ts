import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const code = (body.code || "").toString().trim();

    if (!/^\d{6}$/.test(code)) {
      return new Response(JSON.stringify({ error: "Ongeldige code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ua = req.headers.get("user-agent") || "unknown";

    const { data: pair, error } = await admin
      .from("device_pairing_codes")
      .select("*")
      .eq("code", code)
      .is("used_at", null)
      .maybeSingle();

    // Constant-ish delay
    await new Promise((r) => setTimeout(r, 250 + Math.random() * 150));

    if (error || !pair) {
      return new Response(JSON.stringify({ error: "Ongeldige of verlopen code" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(pair.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Code is verlopen" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create trusted device
    const { data: device, error: devErr } = await admin
      .from("trusted_devices")
      .insert({
        tenant_id: pair.tenant_id,
        location_id: pair.location_id,
        device_name: pair.device_name,
        paired_by: pair.created_by,
        last_seen_at: new Date().toISOString(),
        last_ip: ip,
        user_agent: ua,
      })
      .select("id, device_token, device_name, tenant_id, location_id")
      .single();

    if (devErr) {
      return new Response(JSON.stringify({ error: devErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark code as used
    await admin
      .from("device_pairing_codes")
      .update({ used_at: new Date().toISOString(), used_by_device_id: device.id })
      .eq("id", pair.id);

    // Resolve tenant slug for client convenience
    const { data: tenant } = await admin
      .from("tenants")
      .select("slug, name")
      .eq("id", device.tenant_id)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        device_token: device.device_token,
        device_id: device.id,
        device_name: device.device_name,
        tenant: tenant ? { slug: tenant.slug, name: tenant.name } : null,
        location_id: device.location_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
