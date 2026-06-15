import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getAdapter, type Provider } from "../_shared/marketplace.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authErr } = await supabase.auth.getClaims(token);
    if (authErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const integration_id = String(body.integration_id ?? "");
    if (!integration_id) {
      return new Response(JSON.stringify({ error: "integration_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load integration (RLS ensures tenant-scoped)
    const { data: integration, error: integErr } = await supabase
      .from("marketplace_integrations")
      .select("*")
      .eq("id", integration_id)
      .maybeSingle();
    if (integErr || !integration) {
      return new Response(JSON.stringify({ error: "Integration not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Mark as syncing
    await supabase.from("marketplace_integrations").update({ status: "syncing" }).eq("id", integration_id);

    // Load active products for this location
    const { data: products } = await supabase
      .from("products")
      .select("id,name,section,price,vat_rate,is_active")
      .eq("location_id", integration.location_id)
      .eq("is_active", true);

    const items = (products ?? []).map((p: any) => ({
      external_id: p.id,
      name: p.name,
      section: p.section ?? "Menu",
      price: Number(p.price ?? 0),
      vat_rate: Number(p.vat_rate ?? 9),
      is_active: !!p.is_active,
    }));

    const adapter = getAdapter(integration.provider as Provider);
    const result = await adapter.pushMenu({
      items,
      credentials: integration.credentials ?? {},
      external_menu_id: integration.external_menu_id,
    });

    const newStatus = result.ok ? "connected" : "error";
    await supabase.from("marketplace_integrations").update({
      status: newStatus,
      external_menu_id: result.external_menu_id ?? integration.external_menu_id,
      last_sync_at: new Date().toISOString(),
      last_sync_status: result.ok ? "ok" : "error",
      last_error: result.ok ? null : (result.message ?? "Unknown error"),
    }).eq("id", integration_id);

    await supabase.from("marketplace_sync_log").insert({
      tenant_id: integration.tenant_id,
      integration_id,
      kind: "menu_push",
      status: result.ok ? "success" : "error",
      message: result.message,
      payload: { item_count: items.length },
    });

    return new Response(JSON.stringify({
      ok: result.ok,
      synced_items: items.length,
      external_menu_id: result.external_menu_id,
      message: result.message,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("menu-sync error", e);
    return new Response(JSON.stringify({ error: String((e as Error).message) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
