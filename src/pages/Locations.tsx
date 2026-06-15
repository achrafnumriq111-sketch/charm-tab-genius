import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation_ } from "@/contexts/LocationContext";
import { ArrowLeft, Loader2, Plus, Archive, ArchiveRestore, Pencil, Check, X, MapPin } from "lucide-react";

interface LocRow {
  id: string;
  name: string;
  city: string;
  address: string;
  timezone: string;
  currency: string;
  is_active: boolean;
  tenant_id: string | null;
}

const bg = "linear-gradient(180deg, #f0f2f8 0%, #e8ecf4 100%)";
const card = { background: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.7)", backdropFilter: "blur(12px)" } as const;
const input = { background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.06)" } as const;

const Locations = () => {
  const navigate = useNavigate();
  const { employee } = useAuth();
  const { tenantId, refetch: refetchLocations } = useLocation_();

  const [rows, setRows] = useState<LocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", city: "", address: "", timezone: "Europe/Amsterdam", currency: "EUR" });

  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", city: "", address: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("locations")
      .select("id,name,city,address,timezone,currency,is_active,tenant_id")
      .order("is_active", { ascending: false })
      .order("name");
    if (error) setError(error.message);
    setRows((data as LocRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (employee?.role !== "owner") { navigate("/"); return; }
    load();
  }, [employee, navigate, load]);

  if (employee?.role !== "owner") return null;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.name.trim().length < 2) { setError("Naam te kort"); return; }
    if (!tenantId) { setError("Geen tenant context"); return; }
    setCreating(true);
    const { error } = await supabase.from("locations").insert({
      name: form.name.trim(),
      city: form.city.trim(),
      address: form.address.trim(),
      timezone: form.timezone,
      currency: form.currency,
      tenant_id: tenantId,
      is_active: true,
    });
    setCreating(false);
    if (error) { setError(error.message); return; }
    setForm({ name: "", city: "", address: "", timezone: "Europe/Amsterdam", currency: "EUR" });
    await load();
    await refetchLocations();
  };

  const beginEdit = (r: LocRow) => {
    setEditId(r.id);
    setEditForm({ name: r.name, city: r.city || "", address: r.address || "" });
  };

  const saveEdit = async (id: string) => {
    if (editForm.name.trim().length < 2) { setError("Naam te kort"); return; }
    const { error } = await supabase.from("locations").update({
      name: editForm.name.trim(), city: editForm.city.trim(), address: editForm.address.trim(),
    }).eq("id", id);
    if (error) { setError(error.message); return; }
    setEditId(null);
    await load();
    await refetchLocations();
  };

  const toggleActive = async (r: LocRow) => {
    const next = !r.is_active;
    if (!next && rows.filter(x => x.is_active).length <= 1) {
      setError("Je moet minstens één actieve locatie behouden."); return;
    }
    if (!confirm(next ? "Locatie heractiveren?" : "Locatie archiveren? Medewerkers blijven gekoppeld.")) return;
    const { error } = await supabase.from("locations").update({ is_active: next }).eq("id", r.id);
    if (error) { setError(error.message); return; }
    await load();
    await refetchLocations();
  };

  return (
    <div className="min-h-screen p-6" style={{ background: bg }}>
      <div className="max-w-4xl mx-auto">
        <button onClick={() => navigate("/")} className="flex items-center gap-1 text-xs mb-4" style={{ color: "#7c6bc4" }}>
          <ArrowLeft className="w-3.5 h-3.5" /> Terug
        </button>

        <h1 className="text-xl font-semibold mb-1" style={{ color: "#2a2a3a" }}>Locaties</h1>
        <p className="text-xs mb-6" style={{ color: "#8b8b9e" }}>
          Beheer de fysieke vestigingen binnen je organisatie. Elke locatie heeft eigen menu, voorraad en kassa.
        </p>

        <form onSubmit={create} className="rounded-2xl p-5 mb-6 grid grid-cols-1 sm:grid-cols-4 gap-3" style={card}>
          <div className="sm:col-span-2">
            <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "#8b8b9e" }}>Naam</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
              className="w-full h-10 px-3 rounded-lg text-sm outline-none" style={input} placeholder="bv. Saakouk Centrum" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "#8b8b9e" }}>Stad</label>
            <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="w-full h-10 px-3 rounded-lg text-sm outline-none" style={input} placeholder="Amsterdam" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "#8b8b9e" }}>Valuta</label>
            <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}
              className="w-full h-10 px-3 rounded-lg text-sm outline-none" style={input}>
              <option value="EUR">EUR</option><option value="USD">USD</option><option value="GBP">GBP</option>
            </select>
          </div>
          <div className="sm:col-span-3">
            <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "#8b8b9e" }}>Adres</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full h-10 px-3 rounded-lg text-sm outline-none" style={input} placeholder="Straatnaam 12, 1011 AA" />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={creating || form.name.trim().length < 2}
              className="h-10 w-full px-4 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, rgba(172,155,255,0.85), rgba(140,120,220,0.9))", color: "#fff" }}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Toevoegen
            </button>
          </div>
          {error && (
            <div className="sm:col-span-4 text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", color: "#dc2626" }}>{error}</div>
          )}
        </form>

        <div className="space-y-2">
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#7c6bc4" }} />
          ) : rows.length === 0 ? (
            <p className="text-xs" style={{ color: "#8b8b9e" }}>Nog geen locaties.</p>
          ) : rows.map((r) => (
            <div key={r.id} className="rounded-xl p-4 flex flex-wrap items-center gap-3" style={card}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(124,107,196,0.12)", color: "#7c6bc4" }}>
                <MapPin className="w-4 h-4" />
              </div>
              {editId === r.id ? (
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="h-9 px-2.5 rounded-lg text-sm outline-none" style={input} />
                  <input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    placeholder="Stad" className="h-9 px-2.5 rounded-lg text-sm outline-none" style={input} />
                  <input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    placeholder="Adres" className="h-9 px-2.5 rounded-lg text-sm outline-none" style={input} />
                </div>
              ) : (
                <div className="flex-1 min-w-[180px]">
                  <div className="text-sm font-medium flex items-center gap-2" style={{ color: "#2a2a3a" }}>
                    {r.name}
                    {!r.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(0,0,0,0.06)", color: "#8b8b9e" }}>Gearchiveerd</span>}
                  </div>
                  <div className="text-[11px]" style={{ color: "#8b8b9e" }}>
                    {[r.city, r.address].filter(Boolean).join(" · ") || "Geen adres"} · {r.currency} · {r.timezone}
                  </div>
                </div>
              )}

              {editId === r.id ? (
                <div className="flex gap-1.5">
                  <button onClick={() => saveEdit(r.id)} className="h-9 w-9 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(34,197,94,0.12)", color: "#16a34a" }}><Check className="w-4 h-4" /></button>
                  <button onClick={() => setEditId(null)} className="h-9 w-9 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(0,0,0,0.05)", color: "#5a5a72" }}><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <button onClick={() => beginEdit(r)} className="h-9 px-3 rounded-lg text-xs flex items-center gap-1.5"
                    style={{ background: "rgba(124,107,196,0.1)", color: "#7c6bc4" }}>
                    <Pencil className="w-3.5 h-3.5" /> Bewerken
                  </button>
                  <button onClick={() => toggleActive(r)} className="h-9 px-3 rounded-lg text-xs flex items-center gap-1.5"
                    style={{ background: r.is_active ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.12)", color: r.is_active ? "#dc2626" : "#16a34a" }}>
                    {r.is_active ? <><Archive className="w-3.5 h-3.5" /> Archiveren</> : <><ArchiveRestore className="w-3.5 h-3.5" /> Heractiveren</>}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Locations;
