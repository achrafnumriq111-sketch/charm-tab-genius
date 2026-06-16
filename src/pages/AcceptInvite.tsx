import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

const pageBg =
  "radial-gradient(ellipse at 20% 20%, hsl(var(--auros-lilac) / 0.35), transparent 50%), " +
  "radial-gradient(ellipse at 80% 30%, hsl(var(--auros-lilac) / 0.25), transparent 50%), " +
  "linear-gradient(180deg, #f0f2f8 0%, #e8ecf4 100%)";
const cardStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, hsl(var(--card)), hsl(var(--card)))",
  border: "1px solid hsl(var(--card))",
  boxShadow: "inset 0 1px 1px hsl(var(--card)), 0 22px 90px hsl(var(--auros-abyss) / 0.6)",
  backdropFilter: "blur(14px)",
};
const inputStyle: React.CSSProperties = {
  background: "hsl(var(--card))", border: "1px solid rgba(0,0,0,0.06)", color: "hsl(var(--foreground))",
  boxShadow: "inset 0 1px 2px rgba(0,0,0,0.04)", letterSpacing: "0.25em",
};
const btnStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, hsl(var(--auros-teal) / 0.85), hsl(var(--auros-teal) / 0.9))",
  color: "hsl(var(--primary-foreground))", boxShadow: "0 4px 20px hsl(var(--auros-teal) / 0.3), inset 0 1px 1px rgba(255,255,255,0.3)",
};

interface InviteInfo {
  full_name: string;
  role: string;
  location_name?: string;
  tenant_name?: string;
}

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-accept`;
const HEADERS = {
  "Content-Type": "application/json",
  apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
};

const AcceptInvite = () => {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(ENDPOINT, {
      method: "POST", headers: HEADERS,
      body: JSON.stringify({ action: "info", token }),
    }).then(async (r) => {
      const data = await r.json();
      if (!active) return;
      if (!r.ok) setError(data.error || "Ongeldige uitnodiging");
      else setInfo(data);
      setLoading(false);
    }).catch(() => { if (active) { setError("Verbinding mislukt"); setLoading(false); } });
    return () => { active = false; };
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(pin)) return setError("PIN moet exact 6 cijfers zijn");
    if (pin !== confirm) return setError("PIN's komen niet overeen");
    setError(""); setSubmitting(true);
    const res = await fetch(ENDPOINT, {
      method: "POST", headers: HEADERS,
      body: JSON.stringify({ action: "accept", token, pin }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) return setError(data.error || "Acceptatie mislukt");
    setDone(true);
    setTimeout(() => navigate("/login", { replace: true }), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: pageBg }}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="rounded-2xl p-6" style={cardStyle}>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" style={{ color: "hsl(var(--primary))" }} /></div>
          ) : done ? (
            <div className="text-center py-4">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2" style={{ color: "#16a34a" }} />
              <p className="text-sm font-medium" style={{ color: "hsl(var(--foreground))" }}>Account aangemaakt!</p>
              <p className="text-xs mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>Je wordt doorgestuurd…</p>
            </div>
          ) : info ? (
            <>
              <h1 className="text-base font-semibold mb-1" style={{ color: "hsl(var(--foreground))" }}>Welkom {info.full_name}</h1>
              <p className="text-xs mb-5" style={{ color: "hsl(var(--muted-foreground))" }}>
                Je bent uitgenodigd als <b>{info.role}</b>
                {info.tenant_name ? ` bij ${info.tenant_name}` : ""}. Kies een 6-cijferige PIN om in te loggen.
              </p>
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>Kies PIN</label>
                  <input type="password" inputMode="numeric" maxLength={6} required value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full h-12 px-4 rounded-xl text-sm outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>Bevestig PIN</label>
                  <input type="password" inputMode="numeric" maxLength={6} required value={confirm}
                    onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full h-12 px-4 rounded-xl text-sm outline-none" style={inputStyle} />
                </div>
                {error && <div className="px-3 py-2.5 rounded-xl text-xs" style={{ background: "rgba(239,68,68,0.08)", color: "#dc2626" }}>{error}</div>}
                <button type="submit" disabled={submitting || pin.length !== 6} className="w-full h-12 rounded-xl text-sm font-semibold disabled:opacity-40" style={btnStyle}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Account aanmaken"}
                </button>
              </form>
            </>
          ) : (
            <div className="text-xs px-3 py-3 rounded-xl" style={{ background: "rgba(239,68,68,0.08)", color: "#dc2626" }}>
              {error || "Uitnodiging niet gevonden"}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default AcceptInvite;
