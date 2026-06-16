import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Loader2, ArrowRight, UserCog, Users, ShieldAlert } from "lucide-react";

interface Emp {
  id: string;
  full_name: string;
  role: "owner" | "manager" | "sales";
  location_id: string;
  is_active: boolean;
  tenant_id: string | null;
}
interface Loc { id: string; name: string; city: string; is_active: boolean }

const bg = "linear-gradient(180deg, #f0f2f8 0%, #e8ecf4 100%)";
const card = { background: "hsl(var(--card))", border: "1px solid hsl(var(--card))", backdropFilter: "blur(12px)" } as const;
const input = { background: "hsl(var(--card))", border: "1px solid rgba(0,0,0,0.06)" } as const;

const roleColors: Record<string, { bg: string; fg: string }> = {
  owner: { bg: "hsl(var(--auros-teal) / 0.12)", fg: "hsl(var(--primary))" },
  manager: { bg: "rgba(59,130,246,0.12)", fg: "#2563eb" },
  sales: { bg: "rgba(34,197,94,0.12)", fg: "#16a34a" },
};

const TeamStaff = () => {
  const navigate = useNavigate();
  const { employee } = useAuth();
  const [emps, setEmps] = useState<Emp[]>([]);
  const [locs, setLocs] = useState<Loc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [filterLoc, setFilterLoc] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: e }, { data: l }] = await Promise.all([
      supabase.from("employees").select("id,full_name,role,location_id,is_active,tenant_id").order("is_active", { ascending: false }).order("full_name"),
      supabase.from("locations").select("id,name,city,is_active").order("name"),
    ]);
    setEmps((e as Emp[]) || []);
    setLocs((l as Loc[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (employee?.role !== "owner") { navigate("/"); return; }
    load();
  }, [employee, navigate, load]);

  if (employee?.role !== "owner") return null;

  const activeLocs = useMemo(() => locs.filter(l => l.is_active), [locs]);
  const locName = (id: string) => locs.find(l => l.id === id)?.name || "—";

  const move = async (emp: Emp, newLocId: string) => {
    if (newLocId === emp.location_id) return;
    setError(""); setBusy(emp.id);
    const { error } = await supabase.from("employees")
      .update({ location_id: newLocId })
      .eq("id", emp.id);
    setBusy(null);
    if (error) { setError(error.message); return; }
    await load();
  };

  const changeRole = async (emp: Emp, role: Emp["role"]) => {
    if (role === emp.role) return;
    setError(""); setBusy(emp.id);
    const { error } = await supabase.from("employees").update({ role }).eq("id", emp.id);
    setBusy(null);
    if (error) { setError(error.message); return; }
    await load();
  };

  const toggleActive = async (emp: Emp) => {
    const next = !emp.is_active;
    if (!confirm(next ? "Medewerker activeren?" : "Medewerker deactiveren? Kan niet meer inloggen.")) return;
    setBusy(emp.id);
    const { error } = await supabase.from("employees").update({ is_active: next }).eq("id", emp.id);
    setBusy(null);
    if (error) { setError(error.message); return; }
    await load();
  };

  const filtered = filterLoc === "all" ? emps : emps.filter(e => e.location_id === filterLoc);
  const grouped = activeLocs.map(l => ({ loc: l, members: filtered.filter(e => e.location_id === l.id) }));
  const orphans = filtered.filter(e => !activeLocs.some(l => l.id === e.location_id));

  return (
    <div className="min-h-screen p-6" style={{ background: bg }}>
      <div className="max-w-5xl mx-auto">
        <button onClick={() => navigate("/")} className="flex items-center gap-1 text-xs mb-4" style={{ color: "hsl(var(--primary))" }}>
          <ArrowLeft className="w-3.5 h-3.5" /> Terug
        </button>

        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h1 className="text-xl font-semibold mb-1" style={{ color: "hsl(var(--foreground))" }}>Team & toewijzing</h1>
            <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
              Verplaats medewerkers tussen locaties, wijzig rollen of deactiveer accounts.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/team")} className="h-9 px-3 rounded-lg text-xs"
              style={{ background: "hsl(var(--auros-teal) / 0.1)", color: "hsl(var(--primary))" }}>Uitnodigingen</button>
            <button onClick={() => navigate("/locations")} className="h-9 px-3 rounded-lg text-xs"
              style={{ background: "hsl(var(--auros-teal) / 0.1)", color: "hsl(var(--primary))" }}>Locaties</button>
          </div>
        </div>

        <div className="rounded-2xl p-3 mb-4 flex items-center gap-2 flex-wrap" style={card}>
          <span className="text-[10px] font-semibold uppercase tracking-widest px-2" style={{ color: "hsl(var(--muted-foreground))" }}>Filter</span>
          <button onClick={() => setFilterLoc("all")} className="h-8 px-3 rounded-lg text-xs"
            style={{ background: filterLoc === "all" ? "hsl(var(--auros-teal) / 0.18)" : "transparent", color: "hsl(var(--primary))" }}>Alle</button>
          {activeLocs.map(l => (
            <button key={l.id} onClick={() => setFilterLoc(l.id)} className="h-8 px-3 rounded-lg text-xs"
              style={{ background: filterLoc === l.id ? "hsl(var(--auros-teal) / 0.18)" : "transparent", color: "hsl(var(--primary))" }}>{l.name}</button>
          ))}
        </div>

        {error && <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", color: "#dc2626" }}>{error}</div>}

        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "hsl(var(--primary))" }} />
        ) : (
          <div className="space-y-6">
            {grouped.map(({ loc, members }) => (
              <section key={loc.id}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <Users className="w-3.5 h-3.5" style={{ color: "hsl(var(--primary))" }} />
                  <h2 className="text-sm font-semibold" style={{ color: "hsl(var(--foreground))" }}>{loc.name}</h2>
                  <span className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>{loc.city}</span>
                  <span className="ml-auto text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>{members.length} medewerker(s)</span>
                </div>
                {members.length === 0 ? (
                  <div className="rounded-xl p-4 text-xs text-center" style={{ ...card, color: "hsl(var(--muted-foreground))" }}>Geen medewerkers op deze locatie</div>
                ) : (
                  <div className="space-y-2">
                    {members.map(emp => <EmpRow key={emp.id} emp={emp} locs={activeLocs} locName={locName} busy={busy === emp.id}
                      onMove={(id) => move(emp, id)} onRole={(r) => changeRole(emp, r)} onToggle={() => toggleActive(emp)} />)}
                  </div>
                )}
              </section>
            ))}

            {orphans.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <ShieldAlert className="w-3.5 h-3.5" style={{ color: "#dc2626" }} />
                  <h2 className="text-sm font-semibold" style={{ color: "#dc2626" }}>Op gearchiveerde locatie</h2>
                </div>
                <div className="space-y-2">
                  {orphans.map(emp => <EmpRow key={emp.id} emp={emp} locs={activeLocs} locName={locName} busy={busy === emp.id}
                    onMove={(id) => move(emp, id)} onRole={(r) => changeRole(emp, r)} onToggle={() => toggleActive(emp)} />)}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const EmpRow: React.FC<{
  emp: Emp; locs: Loc[]; locName: (id: string) => string; busy: boolean;
  onMove: (id: string) => void; onRole: (r: Emp["role"]) => void; onToggle: () => void;
}> = ({ emp, locs, busy, onMove, onRole, onToggle }) => {
  const c = roleColors[emp.role];
  return (
    <div className="rounded-xl p-4 flex flex-wrap items-center gap-3" style={card}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold" style={{ background: c.bg, color: c.fg }}>
        {emp.full_name.split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase()}
      </div>
      <div className="flex-1 min-w-[160px]">
        <div className="text-sm font-medium flex items-center gap-2" style={{ color: "hsl(var(--foreground))" }}>
          {emp.full_name}
          {!emp.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(0,0,0,0.06)", color: "hsl(var(--muted-foreground))" }}>Inactief</span>}
        </div>
        <div className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>{emp.role}</div>
      </div>

      <select value={emp.role} disabled={busy} onChange={(e) => onRole(e.target.value as Emp["role"])}
        className="h-9 px-2.5 rounded-lg text-xs outline-none" style={input}>
        <option value="sales">Sales</option><option value="manager">Manager</option><option value="owner">Owner</option>
      </select>

      <div className="flex items-center gap-1.5">
        <ArrowRight className="w-3.5 h-3.5" style={{ color: "hsl(var(--muted-foreground))" }} />
        <select value={emp.location_id} disabled={busy} onChange={(e) => onMove(e.target.value)}
          className="h-9 px-2.5 rounded-lg text-xs outline-none" style={input}>
          {locs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          {!locs.some(l => l.id === emp.location_id) && <option value={emp.location_id}>(gearchiveerd)</option>}
        </select>
      </div>

      <button onClick={onToggle} disabled={busy}
        className="h-9 px-3 rounded-lg text-xs flex items-center gap-1.5"
        style={{ background: emp.is_active ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.12)", color: emp.is_active ? "#dc2626" : "#16a34a" }}>
        <UserCog className="w-3.5 h-3.5" /> {emp.is_active ? "Deactiveren" : "Activeren"}
      </button>

      {busy && <Loader2 className="w-4 h-4 animate-spin" style={{ color: "hsl(var(--primary))" }} />}
    </div>
  );
};

export default TeamStaff;
