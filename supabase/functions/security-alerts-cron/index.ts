// Scans the last hour of security_events, compares to configured thresholds,
// and (a) records an `alert_triggered` event, (b) attempts to enqueue an email
// via the existing `enqueue_email` RPC if a Lovable email queue is configured.
//
// Designed to be invoked by pg_cron every 5-15 minutes.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, key);

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: configs, error: cfgErr } = await admin
    .from("security_alert_config")
    .select("*")
    .eq("is_enabled", true);

  if (cfgErr) {
    return new Response(JSON.stringify({ error: cfgErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: Array<{ config_id: string; triggered: boolean; count: number }> = [];

  for (const cfg of configs ?? []) {
    let query = admin
      .from("security_events")
      .select("id, severity", { count: "exact", head: true })
      .gte("occurred_at", since);

    const minSev = cfg.min_severity as "info" | "warning" | "critical";
    const sevList =
      minSev === "info"
        ? ["info", "warning", "critical"]
        : minSev === "warning"
          ? ["warning", "critical"]
          : ["critical"];
    query = query.in("severity", sevList);

    if (cfg.scope === "tenant" && cfg.tenant_id) {
      query = query.eq("tenant_id", cfg.tenant_id);
    }

    const { count, error: cntErr } = await query;
    if (cntErr) {
      results.push({ config_id: cfg.id, triggered: false, count: -1 });
      continue;
    }

    const total = count ?? 0;
    const triggered = total >= cfg.threshold_per_hour;

    if (triggered) {
      // Cool-down: don't re-alert within the last hour
      const cooldownOk =
        !cfg.last_triggered_at ||
        Date.now() - new Date(cfg.last_triggered_at as string).getTime() > 60 * 60 * 1000;

      if (cooldownOk) {
        await admin.from("security_events").insert({
          event_type: "alert_triggered",
          severity: "critical",
          source: "alert_cron",
          tenant_id: cfg.tenant_id,
          metadata: {
            config_id: cfg.id,
            threshold: cfg.threshold_per_hour,
            count: total,
            window_minutes: 60,
            notify_email: cfg.notify_email,
          },
        });

        // Best-effort email via pgmq; succeeds when transactional email infra is scaffolded.
        try {
          await admin.rpc("enqueue_email" as never, {
            queue_name: "transactional_emails",
            payload: {
              template: "security-alert",
              to: cfg.notify_email,
              subject: `Security alert: ${total} suspicious events in the last hour`,
              data: {
                threshold: cfg.threshold_per_hour,
                count: total,
                tenant_id: cfg.tenant_id,
              },
            },
          } as never);
        } catch {
          // ignored — email infra optional
        }

        await admin
          .from("security_alert_config")
          .update({ last_triggered_at: new Date().toISOString() })
          .eq("id", cfg.id);
      }
    }

    results.push({ config_id: cfg.id, triggered, count: total });
  }

  return new Response(JSON.stringify({ checked_at: new Date().toISOString(), results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
