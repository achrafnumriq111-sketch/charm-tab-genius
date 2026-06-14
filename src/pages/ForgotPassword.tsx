import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft } from "lucide-react";
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
  background: "rgba(255,255,255,0.5)",
  border: "1px solid rgba(0,0,0,0.06)",
  color: "#2a2a3a",
  boxShadow: "inset 0 1px 2px rgba(0,0,0,0.04)",
};

const btnStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, rgba(172,155,255,0.85), rgba(140,120,220,0.9))",
  color: "#fff",
  boxShadow: "0 4px 20px rgba(172,155,255,0.3), inset 0 1px 1px rgba(255,255,255,0.3)",
};

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: pageBg }}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <button onClick={() => navigate("/login")} className="flex items-center gap-1 text-xs mb-4" style={{ color: "#7c6bc4" }}>
          <ArrowLeft className="w-3.5 h-3.5" /> Terug naar inloggen
        </button>
        <div className="rounded-2xl p-6" style={cardStyle}>
          <h1 className="text-base font-semibold mb-1" style={{ color: "#2a2a3a" }}>Wachtwoord vergeten</h1>
          <p className="text-xs mb-5" style={{ color: "#8b8b9e" }}>
            Voor eigenaren met een e-mailaccount. Medewerkers vragen hun PIN bij de eigenaar.
          </p>
          {sent ? (
            <div className="text-xs px-3 py-3 rounded-xl" style={{ background: "rgba(34,197,94,0.08)", color: "#15803d" }}>
              Check je inbox voor de reset-link.
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "#8b8b9e" }}>E-mail</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl text-sm outline-none"
                  style={inputStyle}
                />
              </div>
              {error && (
                <div className="px-3 py-2.5 rounded-xl text-xs" style={{ background: "rgba(239,68,68,0.08)", color: "#dc2626" }}>{error}</div>
              )}
              <button type="submit" disabled={loading || !email.trim()} className="w-full h-12 rounded-xl text-sm font-semibold disabled:opacity-40" style={btnStyle}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Verstuur reset-link"}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
