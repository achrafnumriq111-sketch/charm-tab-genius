import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, KeyRound, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { getDeviceMeta, isTrustedDevice } from "@/lib/device";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

/**
 * Device-gated staff PIN login.
 * If the device is not paired we redirect to /login — PIN auth is impossible
 * without a server-trusted device_token.
 */
export default function StaffPin() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const { isPlatformLevel } = useTenant();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const meta = getDeviceMeta();

  useEffect(() => {
    if (!isTrustedDevice()) {
      navigate("/login", { replace: true });
      return;
    }
    if (isAuthenticated) navigate(isPlatformLevel ? "/app" : "/", { replace: true });
  }, [isAuthenticated, navigate, isPlatformLevel]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username.trim()) { setError("Vul je naam in"); return; }
    if (!/^\d{6}$/.test(pin)) { setError("PIN moet 6 cijfers zijn"); return; }
    setLoading(true);
    const res = await login(username.trim(), pin, false);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      setPin("");
    } else {
      navigate(isPlatformLevel ? "/app" : "/", { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative">
      <div className="absolute top-4 right-4 z-10">
        <ThemeSwitcher />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-6">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{
              background: "linear-gradient(135deg, rgba(172,155,255,0.3), rgba(205,216,255,0.4))",
              border: "1px solid rgba(255,255,255,0.6)",
              boxShadow: "0 8px 32px rgba(172,155,255,0.2)",
            }}
          >
            <KeyRound className="w-6 h-6" style={{ color: "#7c6bc4" }} />
          </div>
          <h1 className="text-lg font-semibold" style={{ color: "#2a2a3a" }}>
            Medewerker inloggen
          </h1>
          <p className="text-xs mt-1" style={{ color: "#9b9bab" }}>
            {meta?.tenant_name || meta?.tenant_slug || "Gekoppeld apparaat"}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-6 space-y-5"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(247,249,255,0.78))",
            border: "1px solid rgba(255,255,255,0.72)",
            boxShadow: "0 22px 90px rgba(160,175,219,0.16)",
          }}
        >
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "#8b8b9e" }}>
              Naam
            </label>
            <input
              ref={inputRef}
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(""); }}
              placeholder="Voornaam Achternaam"
              autoComplete="username"
              disabled={loading}
              className="w-full h-12 px-4 rounded-xl text-sm outline-none"
              style={{
                background: "rgba(255,255,255,0.5)",
                border: "1px solid rgba(0,0,0,0.06)",
                color: "#2a2a3a",
              }}
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "#8b8b9e" }}>
              PIN (6 cijfers)
            </label>
            <input
              type="password"
              value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
              placeholder="••••••"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              disabled={loading}
              className="w-full h-14 px-4 rounded-xl text-center outline-none"
              style={{
                background: "rgba(255,255,255,0.5)",
                border: "1px solid rgba(0,0,0,0.06)",
                color: "#2a2a3a",
                fontSize: 26,
                letterSpacing: "0.4em",
                fontVariantNumeric: "tabular-nums",
              }}
            />
          </div>
          {error && (
            <div className="px-3 py-2.5 rounded-xl text-xs" style={{ background: "rgba(239,68,68,0.08)", color: "#dc2626" }}>
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || pin.length !== 6 || !username.trim()}
            className="w-full h-12 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, rgba(172,155,255,0.85), rgba(140,120,220,0.9))",
              color: "#fff",
            }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Inloggen"}
          </button>
        </form>

        <button
          onClick={() => navigate("/login")}
          className="w-full mt-4 h-10 text-xs flex items-center justify-center gap-1.5"
          style={{ color: "#7c6bc4" }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Eigenaar-login
        </button>
      </motion.div>
    </div>
  );
}
