import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Shield, Store, ToggleLeft, ToggleRight,
  Users, MapPin, LogOut, RefreshCw, ChevronDown, ChevronUp,
  ShoppingCart, Package, Edit2, Save, X, Eye, Trash2,
} from "lucide-react";
import { toast } from "sonner";

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  plan: string;
  created_at: string;
  owner_user_id: string;
}

interface LocationRow {
  id: string;
  name: string;
  city: string;
  address: string;
  is_active: boolean;
  tenant_id: string;
}

interface EmployeeRow {
  id: string;
  full_name: string;
  role: string;
  is_active: boolean;
  location_id: string;
  last_login_at: string | null;
}

interface TenantStats {
  locations: LocationRow[];
  employees: EmployeeRow[];
  orderCount7d: number;
  revenue7d: number;
}

const glassCard = {
  background: "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(247,249,255,0.78))",
  border: "1px solid rgba(255,255,255,0.72)",
  boxShadow: "inset 0 1px 1px rgba(255,255,255,0.85), 0 12px 40px rgba(160,175,219,0.12)",
  backdropFilter: "blur(14px)",
};

function euro(n: number) {
  return `€${n.toFixed(2).replace(".", ",")}`;
}

/* ─── Tenant Detail Panel ─── */
function TenantDetail({ tenant, onRefresh }: { tenant: TenantRow; onRefresh: () => void }) {
  const [stats, setStats] = useState<TenantStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(tenant.name);
  const [editPlan, setEditPlan] = useState(tenant.plan);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

      const [locRes, empRes, txRes] = await Promise.all([
        supabase.from("locations").select("*").eq("tenant_id", tenant.id),
        supabase.from("employees").select("*"),
        supabase.from("pos_transactions").select("id, total, location_id").gte("created_at", weekAgo).eq("status", "completed"),
      ]);

      const locations = (locRes.data || []) as LocationRow[];
      const locationIds = new Set(locations.map((l) => l.id));
      const employees = ((empRes.data || []) as EmployeeRow[]).filter((e) => locationIds.has(e.location_id));
      const txs = ((txRes.data || []) as any[]).filter((t) => locationIds.has(t.location_id));

      setStats({
        locations,
        employees,
        orderCount7d: txs.length,
        revenue7d: txs.reduce((s, t) => s + (t.total || 0), 0),
      });
      setLoading(false);
    };
    fetch();
  }, [tenant.id]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("tenants")
      .update({ name: editName, plan: editPlan })
      .eq("id", tenant.id);
    if (error) {
      toast.error("Opslaan mislukt: " + error.message);
    } else {
      toast.success("Tenant bijgewerkt");
      setEditing(false);
      onRefresh();
    }
    setSaving(false);
  };

  const toggleLocation = async (loc: LocationRow) => {
    await supabase.from("locations").update({ is_active: !loc.is_active }).eq("id", loc.id);
    toast.success(`${loc.name} ${loc.is_active ? "gedeactiveerd" : "geactiveerd"}`);
    // re-fetch stats
    setStats((prev) =>
      prev
        ? {
            ...prev,
            locations: prev.locations.map((l) =>
              l.id === loc.id ? { ...l, is_active: !l.is_active } : l
            ),
          }
        : prev
    );
  };

  const toggleEmployee = async (emp: EmployeeRow) => {
    await supabase.from("employees").update({ is_active: !emp.is_active }).eq("id", emp.id);
    toast.success(`${emp.full_name} ${emp.is_active ? "gedeactiveerd" : "geactiveerd"}`);
    setStats((prev) =>
      prev
        ? {
            ...prev,
            employees: prev.employees.map((e) =>
              e.id === emp.id ? { ...e, is_active: !e.is_active } : e
            ),
          }
        : prev
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#7c6bc4" }} />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="pt-4 space-y-4">
        {/* Edit / Info bar */}
        <div className="rounded-xl p-4" style={{ ...glassCard, background: "rgba(245,247,255,0.7)" }}>
          {editing ? (
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#8b8b9e" }}>Naam</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full mt-1 h-9 px-3 rounded-lg text-sm border"
                    style={{ borderColor: "rgba(0,0,0,0.08)", background: "white" }}
                  />
                </div>
                <div className="w-36">
                  <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#8b8b9e" }}>Plan</label>
                  <select
                    value={editPlan}
                    onChange={(e) => setEditPlan(e.target.value)}
                    className="w-full mt-1 h-9 px-3 rounded-lg text-sm border"
                    style={{ borderColor: "rgba(0,0,0,0.08)", background: "white" }}
                  >
                    <option value="free">Free</option>
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setEditing(false)}
                  className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1"
                  style={{ color: "#8b8b9e" }}
                >
                  <X className="w-3.5 h-3.5" /> Annuleren
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="h-8 px-4 rounded-lg text-xs font-medium flex items-center gap-1 text-white"
                  style={{ background: "linear-gradient(135deg, #7c6bc4, #6366f1)" }}
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Opslaan
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="grid grid-cols-4 gap-6 flex-1">
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#8b8b9e" }}>Slug</div>
                  <div className="text-sm font-mono" style={{ color: "#2a2a3a" }}>{tenant.slug}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#8b8b9e" }}>Omzet 7d</div>
                  <div className="text-sm font-bold" style={{ color: "#16a34a" }}>{euro(stats.revenue7d)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#8b8b9e" }}>Orders 7d</div>
                  <div className="text-sm font-bold" style={{ color: "#2a2a3a" }}>{stats.orderCount7d}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#8b8b9e" }}>Aangemaakt</div>
                  <div className="text-sm" style={{ color: "#2a2a3a" }}>
                    {new Date(tenant.created_at).toLocaleDateString("nl-NL")}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setEditing(true)}
                className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors hover:bg-white/60"
                style={{ color: "#7c6bc4" }}
              >
                <Edit2 className="w-3.5 h-3.5" /> Bewerken
              </button>
            </div>
          )}
        </div>

        {/* Locations */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-3.5 h-3.5" style={{ color: "#7c6bc4" }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#5a5a72" }}>
              Locaties ({stats.locations.length})
            </span>
          </div>
          <div className="space-y-2">
            {stats.locations.length === 0 ? (
              <div className="text-xs py-3 text-center" style={{ color: "#9b9bab" }}>Geen locaties</div>
            ) : (
              stats.locations.map((loc) => (
                <div
                  key={loc.id}
                  className="rounded-lg p-3 flex items-center justify-between"
                  style={{ ...glassCard, opacity: loc.is_active ? 1 : 0.5 }}
                >
                  <div>
                    <span className="text-sm font-semibold" style={{ color: "#2a2a3a" }}>{loc.name}</span>
                    <span className="text-[11px] ml-2" style={{ color: "#8b8b9e" }}>{loc.city} · {loc.address}</span>
                  </div>
                  <button
                    onClick={() => toggleLocation(loc)}
                    className="text-[10px] px-2 py-1 rounded-lg font-medium"
                    style={{
                      background: loc.is_active ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.1)",
                      color: loc.is_active ? "#dc2626" : "#16a34a",
                    }}
                  >
                    {loc.is_active ? "Deactiveer" : "Activeer"}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Employees */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-3.5 h-3.5" style={{ color: "#7c6bc4" }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#5a5a72" }}>
              Medewerkers ({stats.employees.length})
            </span>
          </div>
          <div className="space-y-1">
            {stats.employees.length === 0 ? (
              <div className="text-xs py-3 text-center" style={{ color: "#9b9bab" }}>Geen medewerkers</div>
            ) : (
              stats.employees.map((emp) => (
                <div
                  key={emp.id}
                  className="rounded-lg px-3 py-2 flex items-center justify-between"
                  style={{ ...glassCard, opacity: emp.is_active ? 1 : 0.5 }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium" style={{ color: "#2a2a3a" }}>{emp.full_name}</span>
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded-full font-medium uppercase"
                      style={{ background: "rgba(172,155,255,0.12)", color: "#7c6bc4" }}
                    >
                      {emp.role}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {emp.last_login_at && (
                      <span className="text-[10px]" style={{ color: "#b5b5c3" }}>
                        Laatst: {new Date(emp.last_login_at).toLocaleDateString("nl-NL")}
                      </span>
                    )}
                    <button
                      onClick={() => toggleEmployee(emp)}
                      className="text-[10px] px-2 py-1 rounded-lg font-medium"
                      style={{
                        background: emp.is_active ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.1)",
                        color: emp.is_active ? "#dc2626" : "#16a34a",
                      }}
                    >
                      {emp.is_active ? "Deactiveer" : "Activeer"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Main Page ─── */
const PlatformAdmin = () => {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }
      const { data } = await supabase
        .from("platform_admins")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!data) { navigate("/"); return; }
      setIsAdmin(true);
      setChecking(false);
    };
    check();
  }, [navigate]);

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tenants")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setTenants(data as TenantRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) fetchTenants();
  }, [isAdmin, fetchTenants]);

  const toggleActive = async (e: React.MouseEvent, tenant: TenantRow) => {
    e.stopPropagation();
    setToggling(tenant.id);
    await supabase
      .from("tenants")
      .update({ is_active: !tenant.is_active })
      .eq("id", tenant.id);
    await fetchTenants();
    setToggling(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f0f2f8" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#7c6bc4" }} />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen p-4 md:p-8"
      style={{
        background:
          "radial-gradient(ellipse at 20% 20%, rgba(205,216,255,0.35), transparent 50%), " +
          "radial-gradient(ellipse at 80% 30%, rgba(255,206,236,0.25), transparent 50%), " +
          "linear-gradient(180deg, #f0f2f8 0%, #e8ecf4 100%)",
      }}
    >
      {/* Header */}
      <div className="max-w-5xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, rgba(172,155,255,0.3), rgba(205,216,255,0.4))",
                border: "1px solid rgba(255,255,255,0.6)",
              }}
            >
              <Shield className="w-5 h-5" style={{ color: "#5a5a72" }} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight" style={{ color: "#2a2a3a" }}>
                Platform Admin
              </h1>
              <p className="text-xs" style={{ color: "#9b9bab" }}>
                Beheer alle tenants · klik om details te zien
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchTenants}
              className="h-9 w-9 rounded-xl flex items-center justify-center transition-colors hover:bg-white/50"
              style={{ color: "#8b8b9e" }}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              className="h-9 px-3 rounded-xl flex items-center gap-1.5 text-xs font-medium transition-colors hover:bg-white/50"
              style={{ color: "#8b8b9e" }}
            >
              <LogOut className="w-3.5 h-3.5" /> Uitloggen
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-5xl mx-auto grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Totaal", value: tenants.length, icon: Store },
          { label: "Actief", value: tenants.filter((t) => t.is_active).length, icon: ToggleRight },
          { label: "Inactief", value: tenants.filter((t) => !t.is_active).length, icon: ToggleLeft },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-4" style={glassCard}>
            <div className="flex items-center gap-2 mb-1">
              <s.icon className="w-3.5 h-3.5" style={{ color: "#9b9bab" }} />
              <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "#8b8b9e" }}>
                {s.label}
              </span>
            </div>
            <span className="text-2xl font-bold" style={{ color: "#2a2a3a" }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Tenants list */}
      <div className="max-w-5xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#7c6bc4" }} />
          </div>
        ) : (
          <div className="space-y-3">
            {tenants.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="rounded-xl p-4"
                style={{
                  ...glassCard,
                  opacity: t.is_active ? 1 : 0.6,
                }}
              >
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
                      style={{
                        background: t.is_active
                          ? "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(16,185,129,0.2))"
                          : "rgba(0,0,0,0.04)",
                        color: t.is_active ? "#16a34a" : "#9b9bab",
                      }}
                    >
                      {t.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold" style={{ color: "#2a2a3a" }}>{t.name}</span>
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wider"
                          style={{
                            background: t.is_active ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.08)",
                            color: t.is_active ? "#16a34a" : "#dc2626",
                          }}
                        >
                          {t.is_active ? "Actief" : "Inactief"}
                        </span>
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wider"
                          style={{ background: "rgba(172,155,255,0.1)", color: "#7c6bc4" }}
                        >
                          {t.plan}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[11px] font-mono" style={{ color: "#8b8b9e" }}>
                          {t.slug}.saakouk.app
                        </span>
                        <span className="text-[10px]" style={{ color: "#b5b5c3" }}>
                          {new Date(t.created_at).toLocaleDateString("nl-NL")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => toggleActive(e, t)}
                      disabled={toggling === t.id}
                      className="h-9 px-4 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5"
                      style={{
                        background: t.is_active ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.1)",
                        color: t.is_active ? "#dc2626" : "#16a34a",
                        border: `1px solid ${t.is_active ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.2)"}`,
                      }}
                    >
                      {toggling === t.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : t.is_active ? (
                        <><ToggleLeft className="w-3.5 h-3.5" /> Deactiveren</>
                      ) : (
                        <><ToggleRight className="w-3.5 h-3.5" /> Activeren</>
                      )}
                    </button>
                    {expanded === t.id ? (
                      <ChevronUp className="w-4 h-4" style={{ color: "#8b8b9e" }} />
                    ) : (
                      <ChevronDown className="w-4 h-4" style={{ color: "#8b8b9e" }} />
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {expanded === t.id && (
                    <TenantDetail tenant={t} onRefresh={fetchTenants} />
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlatformAdmin;
