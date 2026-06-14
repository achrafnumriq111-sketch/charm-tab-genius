import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Copy, Trash2, UserPlus, ArrowLeft, Check } from "lucide-react";

interface Invite {
  id: string;
  token: string;
  full_name: string;
  role: string;
  location_id: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-invite`;

const TeamInvites = () => {
  const navigate = useNavigate();
  const { employee } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("sales");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("employee_invites")
      .select("*")
      .order("created_at", { ascending: false });
    setInvites((data as Invite[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (employee?.role !== "owner") {
      navigate("/");
      return;
    }
    load();
  }, [employee, navigate, load]);

  const call = async (body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify(body),
    });
    return { res, data: await res.json() };
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setCreating(true);
    const { res, data } = await call({ action: "create", full_name: name.trim(), role });
    setCreating(false);
    if (!res.ok) return setError(data.error || "Aanmaken mislukt");
    setName(""); setRole("sales");
    await load();
  };

  const revoke = async (id: string) => {
    if (!confirm("Uitnodiging intrekken?")) return;
    await call({ action: "revoke", invite_id: id });
    await load();
  };

  const copyLink = (token: string) => {
    const link = `${window.location.origin}/accept-invite/${token}`;
    navigator.clipboard.writeText(link);
    setCopied(token);
    setTimeout(() => setCopied(null), 1500);
  };

  if (employee?.role !== "owner") return null;

  return (
    <div className="min-h-screen p-6" style={{ background: "linear-gradient(180deg, #f0f2f8 0%, #e8ecf4 100%)" }}>
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate("/")} className="flex items-center gap-1 text-xs mb-4" style={{ color: "#7c6bc4" }}>
          <ArrowLeft className="w-3.5 h-3.5" /> Terug
        </button>

        <h1 className="text-xl font-semibold mb-1" style={{ color: "#2a2a3a" }}>Team-uitnodigingen</h1>
        <p className="text-xs mb-6" style={{ color: "#8b8b9e" }}>
          Genereer een uitnodigingslink en deel die met je medewerker via WhatsApp, e-mail of SMS.
        </p>

        <form onSubmit={create} className="rounded-2xl p-5 mb-6 flex flex-wrap gap-3 items-end"
          style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.7)", backdropFilter: "blur(12px)" }}>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "#8b8b9e" }}>Naam</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full h-10 px-3 rounded-lg text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.06)" }} />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "#8b8b9e" }}>Rol</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}
              className="h-10 px-3 rounded-lg text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.06)" }}>
              <option value="sales">Sales</option>
              <option value="manager">Manager</option>
              <option value="owner">Owner</option>
            </select>
          </div>
          <button type="submit" disabled={creating || name.trim().length < 2}
            className="h-10 px-4 rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, rgba(172,155,255,0.85), rgba(140,120,220,0.9))", color: "#fff" }}>
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Uitnodiging genereren
          </button>
          {error && <div className="w-full text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", color: "#dc2626" }}>{error}</div>}
        </form>

        <div className="space-y-2">
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#7c6bc4" }} />
          ) : invites.length === 0 ? (
            <p className="text-xs" style={{ color: "#8b8b9e" }}>Nog geen uitnodigingen.</p>
          ) : invites.map((inv) => {
            const expired = new Date(inv.expires_at).getTime() < Date.now();
            const link = `${window.location.origin}/accept-invite/${inv.token}`;
            return (
              <div key={inv.id} className="rounded-xl p-4 flex flex-wrap items-center gap-3"
                style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.7)" }}>
                <div className="flex-1 min-w-[180px]">
                  <div className="text-sm font-medium" style={{ color: "#2a2a3a" }}>{inv.full_name}</div>
                  <div className="text-[11px]" style={{ color: "#8b8b9e" }}>
                    {inv.role} ·{" "}
                    {inv.accepted_at ? "Geaccepteerd" : expired ? "Verlopen" : `Verloopt ${new Date(inv.expires_at).toLocaleDateString("nl-NL")}`}
                  </div>
                </div>
                {!inv.accepted_at && !expired && (
                  <button onClick={() => copyLink(inv.token)}
                    className="h-9 px-3 rounded-lg text-xs flex items-center gap-1.5"
                    style={{ background: "rgba(124,107,196,0.1)", color: "#7c6bc4" }}>
                    {copied === inv.token ? <><Check className="w-3.5 h-3.5" /> Gekopieerd</> : <><Copy className="w-3.5 h-3.5" /> Kopieer link</>}
                  </button>
                )}
                <button onClick={() => revoke(inv.id)}
                  className="h-9 w-9 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(239,68,68,0.08)", color: "#dc2626" }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                {!inv.accepted_at && !expired && (
                  <div className="w-full text-[10px] font-mono px-2 py-1.5 rounded" style={{ background: "rgba(0,0,0,0.04)", color: "#5a5a72", wordBreak: "break-all" }}>
                    {link}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TeamInvites;
