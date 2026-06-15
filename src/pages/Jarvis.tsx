import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  Activity, AlertTriangle, ArrowLeft, BugPlay, CheckCircle2, FileText,
  Loader2, Play, RefreshCw, Shield, ShieldAlert, Sparkles, XCircle,
} from "lucide-react";
import { toast } from "sonner";

interface TenantHealth {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  plan: string;
  created_at: string;
  locationCount: number;
  employeeCount: number;
  events24h: number;
  rlsRejects24h: number;
  criticalEvents24h: number;
  lastEventAt: string | null;
}

interface QaResult {
  ok: boolean;
  total: number;
  passed: number;
  failed: number;
  failures: { name: string; passed: boolean; detail?: string }[];
  ranAt: string;
  durationMs: number;
}

interface SecuritySummary {
  total: number;
  critical: number;
  warning: number;
  info: number;
  unique_users: number;
  unique_tenants: number;
  rls_rejects: number;
  cross_tenant: number;
}

const glass: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(247,249,255,0.78))",
  border: "1px solid rgba(255,255,255,0.72)",
  boxShadow: "inset 0 1px 1px rgba(255,255,255,0.85), 0 12px 40px rgba(160,175,219,0.12)",
  backdropFilter: "blur(14px)",
};

function healthScore(t: TenantHealth): { label: string; color: string; bg: string } {
  if (t.criticalEvents24h > 0) return { label: "Kritiek", color: "#dc2626", bg: "rgba(239,68,68,0.12)" };
  if (t.rlsRejects24h > 5) return { label: "Verhoogd", color: "#d97706", bg: "rgba(245,158,11,0.12)" };
  if (!t.is_active) return { label: "Inactief", color: "#6b7280", bg: "rgba(107,114,128,0.12)" };
  return { label: "Gezond", color: "#16a34a", bg: "rgba(34,197,94,0.12)" };
}

export default function Jarvis() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<TenantHealth[]>([]);
  const [summary, setSummary] = useState<SecuritySummary | null>(null);
  const [qa, setQa] = useState<QaResult | null>(null);
  const [qaRunning, setQaRunning] = useState(false);

  // Gate: platform admin only
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }
      const { data } = await supabase.rpc("is_platform_admin", { _user_id: user.id });
      if (!data) { setAuthorized(false); return; }
      setAuthorized(true);
    })();
  }, [navigate]);

  const loadHealth = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [tRes, lRes, eRes, evRes, sumRes] = await Promise.all([
      supabase.from("tenants").select("id,name,slug,is_active,plan,created_at").order("name"),
      supabase.from("locations").select("id,tenant_id,is_active"),
      supabase.from("employees").select("id,tenant_id,is_active"),
      supabase.from("security_events")
        .select("tenant_id,severity,error_code,occurred_at")
        .gte("occurred_at", since)
        .limit(5000),
      supabase.rpc("security_events_summary", { _since: since }),
    ]);

    const tenantRows = (tRes.data || []) as any[];
    const locs = (lRes.data || []) as any[];
    const emps = (eRes.data || []) as any[];
    const events = (evRes.data || []) as any[];

    const byTenant: Record<string, TenantHealth> = {};
    tenantRows.forEach((t) => {
      byTenant[t.id] = {
        ...t,
        locationCount: 0,
        employeeCount: 0,
        events24h: 0,
        rlsRejects24h: 0,
        criticalEvents24h: 0,
        lastEventAt: null,
      };
    });
    locs.forEach((l) => { if (l.is_active && byTenant[l.tenant_id]) byTenant[l.tenant_id].locationCount++; });
    emps.forEach((e) => { if (e.is_active && byTenant[e.tenant_id]) byTenant[e.tenant_id].employeeCount++; });
    events.forEach((ev) => {
      const t = ev.tenant_id ? byTenant[ev.tenant_id] : null;
      if (!t) return;
      t.events24h++;
      if (ev.error_code === "42501") t.rlsRejects24h++;
      if (ev.severity === "critical") t.criticalEvents24h++;
      if (!t.lastEventAt || ev.occurred_at > t.lastEventAt) t.lastEventAt = ev.occurred_at;
    });

    setTenants(Object.values(byTenant).sort((a, b) => b.criticalEvents24h - a.criticalEvents24h || b.rlsRejects24h - a.rlsRejects24h));
    setSummary(((sumRes.data as SecuritySummary[] | null)?.[0]) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { if (authorized) loadHealth(); }, [authorized, loadHealth]);

  const runQa = async () => {
    setQaRunning(true);
    setQa(null);
    const started = Date.now();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qa-isolation-tests`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || ""}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      const body = await res.json();
      const result: QaResult = {
        ok: !!body.ok,
        total: body.total ?? 0,
        passed: body.passed ?? 0,
        failed: body.failed ?? 0,
        failures: body.failures ?? [],
        ranAt: new Date().toISOString(),
        durationMs: Date.now() - started,
      };
      setQa(result);
      if (result.ok) toast.success(`QA isolatie: ${result.passed}/${result.total} groen`);
      else toast.error(`QA isolatie: ${result.failed} fouten`);
    } catch (e) {
      toast.error("QA-run mislukt: " + (e as Error).message);
    } finally {
      setQaRunning(false);
    }
  };

  const fleet = useMemo(() => ({
    tenants: tenants.length,
    active: tenants.filter((t) => t.is_active).length,
    critical: tenants.filter((t) => t.criticalEvents24h > 0).length,
    rlsHotspots: tenants.filter((t) => t.rlsRejects24h > 0).length,
  }), [tenants]);

  if (authorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }
  if (!authorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <ShieldAlert className="h-14 w-14 text-red-500" />
        <h1 className="text-xl font-bold">Geen toegang</h1>
        <p className="text-slate-500 text-sm">Platform-admin rechten vereist.</p>
        <button onClick={() => navigate("/")} className="text-blue-600 underline text-sm">Terug</button>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen p-4 md:p-8"
      style={{
        background:
          "radial-gradient(ellipse at 20% 10%, rgba(205,216,255,0.4), transparent 50%), " +
          "radial-gradient(ellipse at 80% 30%, rgba(255,206,236,0.25), transparent 50%), " +
          "linear-gradient(180deg, #f0f2f8 0%, #e8ecf4 100%)",
      }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/admin")} className="rounded-lg p-2 hover:bg-white/50">
              <ArrowLeft className="h-5 w-5 text-slate-600" />
            </button>
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #818cf8, #c084fc)" }}>
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Jarvis</h1>
              <p className="text-xs text-slate-500">Platform observability · isolatie · tenant health</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/admin/security-events")} className="h-9 px-3 rounded-xl text-xs font-medium hover:bg-white/60 flex items-center gap-1.5 text-slate-700">
              <Shield className="w-3.5 h-3.5" /> Security events
            </button>
            <button onClick={() => navigate("/admin/qa-report")} className="h-9 px-3 rounded-xl text-xs font-medium hover:bg-white/60 flex items-center gap-1.5 text-slate-700">
              <FileText className="w-3.5 h-3.5" /> QA-rapport
            </button>
            <button onClick={loadHealth} className="h-9 w-9 rounded-xl flex items-center justify-center hover:bg-white/60 text-slate-600">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Fleet KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Tenants", value: fleet.tenants, icon: Activity, color: "#5a5a72" },
            { label: "Actief", value: fleet.active, icon: CheckCircle2, color: "#16a34a" },
            { label: "Met kritieke events", value: fleet.critical, icon: AlertTriangle, color: fleet.critical > 0 ? "#dc2626" : "#16a34a" },
            { label: "RLS hotspots (24u)", value: fleet.rlsHotspots, icon: ShieldAlert, color: fleet.rlsHotspots > 0 ? "#d97706" : "#16a34a" },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-2xl p-4"
              style={glass}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">{s.label}</span>
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
              <div className="text-2xl font-black mt-1" style={{ color: s.color }}>{s.value}</div>
            </motion.div>
          ))}
        </div>

        {/* Security summary banner */}
        {summary && (
          <div className="rounded-2xl p-4 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4" style={glass}>
            <Stat label="Events 24u" value={summary.total} color="#5a5a72" />
            <Stat label="Critical" value={summary.critical} color={summary.critical > 0 ? "#dc2626" : "#16a34a"} />
            <Stat label="RLS rejects (42501)" value={summary.rls_rejects} color={summary.rls_rejects > 0 ? "#d97706" : "#16a34a"} />
            <Stat label="Cross-tenant" value={summary.cross_tenant} color={summary.cross_tenant > 0 ? "#dc2626" : "#16a34a"} />
          </div>
        )}

        {/* QA Isolation Tests */}
        <div className="rounded-2xl p-5 mb-6" style={glass}>
          <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #fef3c7, #fcd34d)" }}>
                <BugPlay className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <div className="font-bold text-slate-900">Cross-tenant isolatie testsuite</div>
                <div className="text-xs text-slate-500">
                  Maakt ephemeral tenants, bewijst dat SELECT/UPDATE/DELETE tussen tenants 0 rijen raakt, en ruimt zichzelf op.
                </div>
              </div>
            </div>
            <button
              onClick={runQa}
              disabled={qaRunning}
              className="h-10 px-4 rounded-xl text-sm font-semibold flex items-center gap-2 text-white disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #6366f1, #818cf8)" }}
            >
              {qaRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {qaRunning ? "Bezig..." : "Run isolatie-tests"}
            </button>
          </div>

          {qaRunning && (
            <div className="text-xs text-slate-500 italic">
              Setup → seed → assert × {13 * 3}+ → cleanup. Duurt typisch 10–30 seconden.
            </div>
          )}

          {qa && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                  style={{
                    background: qa.ok ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                    color: qa.ok ? "#16a34a" : "#dc2626",
                  }}
                >
                  {qa.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  {qa.passed}/{qa.total} groen
                </span>
                <span className="text-xs text-slate-500">
                  Gedraaid {new Date(qa.ranAt).toLocaleTimeString("nl-NL")} · {(qa.durationMs / 1000).toFixed(1)}s
                </span>
              </div>

              {qa.failures.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50/60 p-3 max-h-64 overflow-auto">
                  <div className="text-xs font-bold text-red-700 mb-2">Falende asserties ({qa.failures.length})</div>
                  <div className="space-y-1">
                    {qa.failures.map((f, i) => (
                      <div key={i} className="text-[11px] font-mono text-red-800">
                        <div className="font-bold">✗ {f.name}</div>
                        {f.detail && <div className="opacity-70 pl-3 break-all">{f.detail}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tenant health table */}
        <div className="rounded-2xl overflow-hidden mb-6" style={glass}>
          <div className="p-4 border-b border-white/50 flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-900">Tenant health (24u)</div>
              <div className="text-xs text-slate-500">Gerangschikt: kritieke events eerst</div>
            </div>
            <span className="text-xs text-slate-500">{tenants.length} tenants</span>
          </div>
          <div className="overflow-auto max-h-[600px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white/80 backdrop-blur-sm">
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Tenant</th>
                  <th className="px-3 py-2 font-semibold text-right">Loc</th>
                  <th className="px-3 py-2 font-semibold text-right">Team</th>
                  <th className="px-3 py-2 font-semibold text-right">Events</th>
                  <th className="px-3 py-2 font-semibold text-right">RLS</th>
                  <th className="px-3 py-2 font-semibold text-right">Critical</th>
                  <th className="px-3 py-2 font-semibold">Laatste event</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={8} className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></td></tr>
                )}
                {!loading && tenants.length === 0 && (
                  <tr><td colSpan={8} className="p-8 text-center text-slate-400">Geen tenants</td></tr>
                )}
                {tenants.map((t) => {
                  const h = healthScore(t);
                  return (
                    <tr key={t.id} className="border-t border-slate-100 hover:bg-white/40">
                      <td className="px-3 py-2">
                        <span
                          className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                          style={{ background: h.bg, color: h.color }}
                        >
                          {h.label}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900">{t.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{t.slug} · {t.plan}</div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{t.locationCount}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{t.employeeCount}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{t.events24h}</td>
                      <td className="px-3 py-2 text-right tabular-nums" style={{ color: t.rlsRejects24h > 0 ? "#d97706" : undefined, fontWeight: t.rlsRejects24h > 0 ? 700 : 400 }}>
                        {t.rlsRejects24h}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums" style={{ color: t.criticalEvents24h > 0 ? "#dc2626" : undefined, fontWeight: t.criticalEvents24h > 0 ? 700 : 400 }}>
                        {t.criticalEvents24h}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {t.lastEventAt ? new Date(t.lastEventAt).toLocaleString("nl-NL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">{label}</div>
      <div className="text-xl font-black mt-0.5" style={{ color }}>{value}</div>
    </div>
  );
}
