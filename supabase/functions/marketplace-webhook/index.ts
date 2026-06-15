// Public webhook for marketplace providers.
// URL pattern: /marketplace-webhook?integration_id=<uuid>&provider=mock
// Header `x-marketplace-secret` must match integration.webhook_secret (mock skips if not set).

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getAdapter, type Provider } from "../_shared/marketplace.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const url = new URL(req.url);
  const integration_id = url.searchParams.get("integration_id");
  const providerParam = (url.searchParams.get("provider") ?? "mock") as Provider;

  if (!integration_id) {
    return new Response(JSON.stringify({ error: "integration_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: integration, error: integErr } = await supabase
    .from("marketplace_integrations")
    .select("*")
    .eq("id", integration_id)
    .maybeSingle();

  if (integErr || !integration) {
    return new Response(JSON.stringify({ error: "Integration not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Signature/secret verification (skip for mock if no secret set)
  const provided = req.headers.get("x-marketplace-secret");
  if (integration.webhook_secret && integration.webhook_secret !== provided) {
    return new Response(JSON.stringify({ error: "Invalid secret" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let payload: any;
  try { payload = await req.json(); } catch { payload = {}; }

  const adapter = getAdapter((integration.provider as Provider) ?? providerParam);
  const normalized = await adapter.parseWebhook(payload);

  if (!normalized) {
    await supabase.from("marketplace_sync_log").insert({
      tenant_id: integration.tenant_id, integration_id, kind: "webhook_in",
      status: "error", message: "Unparseable payload", payload,
    });
    return new Response(JSON.stringify({ error: "Unparseable payload" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const initialStatus = integration.auto_accept ? "accepted" : "received";
  const acceptedAt = integration.auto_accept ? new Date().toISOString() : null;

  const { data: inserted, error: insErr } = await supabase
    .from("marketplace_orders")
    .upsert({
      tenant_id: integration.tenant_id,
      location_id: integration.location_id,
      integration_id,
      provider: integration.provider,
      external_order_id: normalized.external_order_id,
      external_order_number: normalized.external_order_number,
      status: initialStatus,
      customer_name: normalized.customer_name,
      customer_phone: normalized.customer_phone,
      delivery_type: normalized.delivery_type,
      total: normalized.total,
      currency: normalized.currency,
      items: normalized.items,
      raw_payload: payload,
      accepted_at: acceptedAt,
    }, { onConflict: "provider,external_order_id" })
    .select()
    .single();

  if (insErr) {
    console.error("upsert error", insErr);
    await supabase.from("marketplace_sync_log").insert({
      tenant_id: integration.tenant_id, integration_id, kind: "webhook_in",
      status: "error", message: insErr.message, payload,
    });
    return new Response(JSON.stringify({ error: insErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  await supabase.from("marketplace_sync_log").insert({
    tenant_id: integration.tenant_id, integration_id, kind: "webhook_in",
    status: "success", message: `Order ${normalized.external_order_id} (${initialStatus})`,
    payload: { order_id: inserted.id },
  });

  return new Response(JSON.stringify({ ok: true, order_id: inserted.id, status: initialStatus }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
