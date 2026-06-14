import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

const pageBg =
  "radial-gradient(ellipse at 20% 20%, rgba(205,216,255,0.35), transparent 50%), " +
  "radial-gradient(ellipse at 80% 30%, rgba(255,206,236,0.25), transparent 50%), " +
  "linear-gradient(180deg, #f0f2f8 0%, #e8ecf4 100%)";
const cardStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(247,249,255,0.78))",
  border: "1px solid rgba(255,255,255,0.72)",
  boxShadow: "inset 0 1px 1px rgba(255,255,255,0.85), 0 22px 90px rgba(160,175,219,0.16)",
  backdropFilter: "blur(14px)",
};
const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.5)", border: "1px solid rgba(0,0,0,0.06)", color: "#2a2a3a",
  boxShadow: "inset 0 1px 2px rgba(0,0,0,0.04)",
};
const btnStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, rgba(172,155,255,0.85), rgba(140,120,220,0.9))",
  color: "#fff", boxShadow: "0 4px 20px rgba(172,155,255,0.3), inset 0 1px 1px rgba(255,255,255,0.3)",
};

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase recovery flow puts the session in URL hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Minimaal 8 tekens");
    if (password !== confirm) return setError("Wachtwoorden komen niet overeen");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) setError(error.message);
    else navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: pageBg }}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="rounded-2xl p-6" style={cardStyle}>
          <h1 className="text-base font-semibold mb-1" style={{ color: "#2a2a3a" }}>Nieuw wachtwoord</h1>
          <p className="text-xs mb-5" style={{ color: "#8b8b9e" }}>Stel een nieuw wachtwoord in voor je account.</p>
          {!ready ? (
            <div className="text-xs px-3 py-3 rounded-xl" style={{ background: "rgba(234,179,8,0.08)", color: "#a16207" }}>
              Wachten op recovery-link… open deze pagina via de e-mail die je hebt ontvangen.
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "#8b8b9e" }}>Nieuw wachtwoord</label>
                <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full h-12 px-4 rounded-xl text-sm outline-none" style={inputStyle} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "#8b8b9e" }}>Bevestig</label>
                <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full h-12 px-4 rounded-xl text-sm outline-none" style={inputStyle} />
              </div>
              {error && <div className="px-3 py-2.5 rounded-xl text-xs" style={{ background: "rgba(239,68,68,0.08)", color: "#dc2626" }}>{error}</div>}
              <button type="submit" disabled={loading} className="w-full h-12 rounded-xl text-sm font-semibold disabled:opacity-40" style={btnStyle}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Wachtwoord opslaan"}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
