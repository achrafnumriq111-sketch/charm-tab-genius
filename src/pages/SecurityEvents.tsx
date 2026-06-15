import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  Shield, AlertTriangle, ShieldAlert, Activity, RefreshCw,
  ArrowLeft, Filter, Loader2, Bell, Plus, Trash2, Save,
} from "lucide-react";
import { toast } from "sonner";

type Severity = "info" | "warning" | "critical";

interface EventRow {
  id: string;
  occurred_at: string;
  event_type: string;
  severity: Severity;
  source: string;
  user_id: string | null;
  tenant_id: string | null;
  target_table: string | null;
  target_resource: string | null;
  error_code: string | null;
  error_message: string | null;
  request_path: string | null;
  metadata: Record<string, unknown>;
}

interface Summary {
  total: number;
  critical: number;
  warning: number;
  info: number;
  unique_users: number;
  unique_tenants: number;
  rls_rejects: number;
  cross_tenant: number;
}

interface AlertConfig {
  id: string;
  scope: string;
  tenant_id: string | null;
  threshold_per_hour: number;
  min_severity: Severity;
  notify_email: string;
  is_enabled: boolean;
  last_triggered_at: string | null;
}

const WINDOWS = [
  { label: "1h", hours: 1 },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 24 * 7 },
  { label: "30d", hours: 24 * 30 },
];

const SEV_COLOR: Record<Severity, string> = {
  info: "bg-blue-100 text-blue-800 border-blue-200",
  warning: "bg-amber-100 text-amber-800 border-amber-200",
  critical: "bg-red-100 text-red-800 border-red-200",
};

export default function SecurityEvents() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [configs, setConfigs] = useState<AlertConfig[]>([]);
  const [windowHours, setWindowHours] = useState(24);
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [newConfig, setNewConfig] = useState({
    notify_email: "",
    threshold_per_hour: 10,
    min_severity: "warning" as Severity,
  });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }
      const { data: isAdmin } = await supabase.rpc("is_platform_admin", { _user_id: user.id });
      if (!isAdmin) {
        setAuthorized(false);
        return;
      }
      setAuthorized(true);
    })();
  }, [navigate]);

  const since = useMemo(
    () => new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString(),
    [windowHours],
  );

  async function loadData() {
    setLoading(true);
    try {
      let q = supabase
        .from("security_events")
        .select("*")
        .gte("occurred_at", since)
        .order("occurred_at", { ascending: false })
        .limit(500);

      if (severityFilter !== "all") q = q.eq("severity", severityFilter);
      if (typeFilter !== "all") q = q.eq("event_type", typeFilter);

      const [evRes, sumRes, cfgRes] = await Promise.all([
        q,
        supabase.rpc("security_events_summary", { _since: since }),
        supabase.from("security_alert_config").select("*").order("created_at", { ascending: false }),
      ]);

      if (evRes.error) throw evRes.error;
      setEvents((evRes.data ?? []) as EventRow[]);
      setSummary(((sumRes.data as Summary[] | null)?.[0]) ?? null);
      setConfigs((cfgRes.data ?? []) as AlertConfig[]);
    } catch (e) {
      toast.error("Failed to load events", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authorized) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, windowHours, severityFilter, typeFilter]);

  const eventTypes = useMemo(
    () => Array.from(new Set(events.map((e) => e.event_type))).sort(),
    [events],
  );

  async function addConfig() {
    if (!newConfig.notify_email.includes("@")) {
      toast.error("Valid email required");
      return;
    }
    const { error } = await supabase.from("security_alert_config").insert({
      scope: "global",
      notify_email: newConfig.notify_email,
      threshold_per_hour: newConfig.threshold_per_hour,
      min_severity: newConfig.min_severity,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Alert rule added");
    setNewConfig({ notify_email: "", threshold_per_hour: 10, min_severity: "warning" });
    loadData();
  }

  async function deleteConfig(id: string) {
    const { error } = await supabase.from("security_alert_config").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Removed");
    loadData();
  }

  async function toggleConfig(c: AlertConfig) {
    const { error } = await supabase
      .from("security_alert_config")
      .update({ is_enabled: !c.is_enabled })
      .eq("id", c.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    loadData();
  }

  if (authorized === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-card">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-card gap-4">
        <ShieldAlert className="h-16 w-16 text-red-500" />
        <h1 className="text-2xl font-bold">Access denied</h1>
        <p className="text-muted-foreground">Platform admin role required.</p>
        <button onClick={() => navigate("/")} className="text-blue-600 underline">Go home</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-card p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/admin")}
              className="rounded-lg p-2 hover:bg-card"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <Shield className="h-7 w-7 text-red-600" />
            <h1 className="text-2xl font-bold">Security Events</h1>
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-2 rounded-lg bg-card px-3 py-2 shadow-sm hover:bg-card"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Summary */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {summary && [
            { label: "Total", value: summary.total, icon: Activity, color: "text-foreground" },
            { label: "Critical", value: summary.critical, icon: ShieldAlert, color: "text-red-600" },
            { label: "RLS Rejects (42501)", value: summary.rls_rejects, icon: AlertTriangle, color: "text-amber-600" },
            { label: "Cross-tenant", value: summary.cross_tenant, icon: Shield, color: "text-red-600" },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl bg-card p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</span>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <div className={`mt-2 text-2xl font-bold ${s.color}`}>{s.value}</div>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-card p-3 shadow-sm">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <div className="flex gap-1">
            {WINDOWS.map((w) => (
              <button
                key={w.label}
                onClick={() => setWindowHours(w.hours)}
                className={`rounded-md px-3 py-1 text-sm ${
                  windowHours === w.hours ? "bg-slate-900 text-white" : "bg-card hover:bg-card"
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as Severity | "all")}
            className="rounded-md border border-border px-2 py-1 text-sm"
          >
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-md border border-border px-2 py-1 text-sm"
          >
            <option value="all">All event types</option>
            {eventTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <span className="ml-auto text-xs text-muted-foreground">{events.length} events</span>
        </div>

        {/* Events table */}
        <div className="mb-6 overflow-hidden rounded-xl bg-card shadow-sm">
          <div className="max-h-[500px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium text-muted-foreground">Time</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Sev</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Event</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Source</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Table</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Code</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">User</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Customer</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Details</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={9} className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></td></tr>
                )}
                {!loading && events.length === 0 && (
                  <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No events in selected window</td></tr>
                )}
                {events.map((e) => (
                  <tr key={e.id} className="border-t border-border hover:bg-card">
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(e.occurred_at).toLocaleString("nl-NL")}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded border px-2 py-0.5 text-xs ${SEV_COLOR[e.severity]}`}>
                        {e.severity}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{e.event_type}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{e.source}</td>
                    <td className="px-3 py-2 font-mono text-xs">{e.target_table ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{e.error_code ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-[10px]">{e.user_id?.slice(0, 8) ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-[10px]">{e.tenant_id?.slice(0, 8) ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground max-w-xs truncate" title={e.error_message ?? ""}>
                      {e.error_message ?? JSON.stringify(e.metadata)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alert config */}
        <div className="rounded-xl bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-600" />
            <h2 className="text-lg font-semibold">Alert rules</h2>
            <span className="text-xs text-muted-foreground">Triggered hourly by the security-alerts-cron function</span>
          </div>

          <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg bg-card p-3">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-muted-foreground">Notify email</label>
              <input
                type="email"
                value={newConfig.notify_email}
                onChange={(e) => setNewConfig({ ...newConfig, notify_email: e.target.value })}
                className="w-full rounded-md border border-border px-2 py-1.5 text-sm"
                placeholder="owner@example.com"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">Threshold/hr</label>
              <input
                type="number"
                min={1}
                value={newConfig.threshold_per_hour}
                onChange={(e) => setNewConfig({ ...newConfig, threshold_per_hour: Number(e.target.value) })}
                className="w-24 rounded-md border border-border px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">Min severity</label>
              <select
                value={newConfig.min_severity}
                onChange={(e) => setNewConfig({ ...newConfig, min_severity: e.target.value as Severity })}
                className="rounded-md border border-border px-2 py-1.5 text-sm"
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <button
              onClick={addConfig}
              className="flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
            >
              <Plus className="h-4 w-4" /> Add rule
            </button>
          </div>

          {configs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No alert rules configured.</p>
          ) : (
            <div className="space-y-2">
              {configs.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex flex-col">
                    <span className="font-medium">{c.notify_email}</span>
                    <span className="text-xs text-muted-foreground">
                      ≥ {c.threshold_per_hour}/hr · min {c.min_severity} · scope {c.scope}
                      {c.last_triggered_at && ` · last alert ${new Date(c.last_triggered_at).toLocaleString("nl-NL")}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleConfig(c)}
                      className={`rounded-md px-2 py-1 text-xs ${
                        c.is_enabled ? "bg-green-100 text-green-700" : "bg-card text-muted-foreground"
                      }`}
                    >
                      {c.is_enabled ? "Enabled" : "Disabled"}
                    </button>
                    <button
                      onClick={() => deleteConfig(c.id)}
                      className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
