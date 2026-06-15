import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { isTrustedDevice } from "@/lib/device";
import { Eye, EyeOff, Loader2, KeyRound } from "lucide-react";
import { motion } from "framer-motion";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);
  const mfaRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { loginOwner, verifyOwnerMfa, isAuthenticated } = useAuth();
  const { tenant, isPlatformLevel } = useTenant();
  const paired = isTrustedDevice();

  useEffect(() => {
    if (isAuthenticated) navigate(isPlatformLevel ? "/app" : "/", { replace: true });
  }, [isAuthenticated, navigate, isPlatformLevel]);

  useEffect(() => {
    if (mfaFactorId) mfaRef.current?.focus();
    else emailRef.current?.focus();
  }, [mfaFactorId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (mfaFactorId) {
      if (!/^\d{6}$/.test(mfaCode)) { setError("Voer 6 cijfers in"); return; }
      setLoading(true);
      const result = await verifyOwnerMfa(mfaFactorId, mfaCode, rememberMe);
      setLoading(false);
      if (result.error) { setError(result.error); setMfaCode(""); return; }
      navigate(isPlatformLevel ? "/app" : "/", { replace: true });
      return;
    }

    if (!email.trim() || !password) { setError("Vul email en wachtwoord in"); return; }
    setLoading(true);
    const result = await loginOwner(email.trim(), password, rememberMe);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      setPassword("");
    } else if (result.mfaRequired) {
      setMfaFactorId(result.mfaRequired.factorId);
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
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{
              background: "linear-gradient(135deg, rgba(172,155,255,0.3), rgba(205,216,255,0.4))",
              border: "1px solid rgba(255,255,255,0.6)",
              boxShadow: "0 8px 32px rgba(172,155,255,0.2), inset 0 1px 1px rgba(255,255,255,0.8)",
              backdropFilter: "blur(12px)",
            }}
          >
            <span className="text-xl font-bold" style={{ color: "#5a5a72" }}>
              {tenant ? tenant.name.charAt(0).toUpperCase() : "·"}
            </span>
          </motion.div>
          <h1 className="text-lg font-semibold tracking-tight" style={{ color: "#2a2a3a" }}>
            {tenant ? tenant.name : "DOTTS"}
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "#9b9bab" }}>
            Eigenaar-login
          </p>
        </div>

        <div
          className="rounded-2xl p-6"
          style={{
            background:
              "radial-gradient(circle at top left, rgba(205,216,255,0.24), transparent 38%), " +
              "radial-gradient(circle at top right, rgba(255,206,236,0.18), transparent 42%), " +
              "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(247,249,255,0.78))",
            border: "1px solid rgba(255,255,255,0.72)",
            boxShadow:
              "inset 0 1px 1px rgba(255,255,255,0.85), 0 22px 90px rgba(160,175,219,0.16)",
            backdropFilter: "blur(14px)",
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            {mfaFactorId ? (
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "#8b8b9e" }}>
                  Tweestapsverificatie (6 cijfers)
                </label>
                <input
                  ref={mfaRef}
                  value={mfaCode}
                  onChange={(e) => { setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="••••••"
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
                <button
                  type="button"
                  onClick={() => { setMfaFactorId(null); setMfaCode(""); setPassword(""); setError(""); }}
                  className="text-[11px] underline mt-2"
                  style={{ color: "#7c6bc4" }}
                >
                  Annuleer
                </button>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "#8b8b9e" }}>
                    E-mailadres
                  </label>
                  <input
                    ref={emailRef}
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    placeholder="jouw@email.nl"
                    autoComplete="email"
                    disabled={loading}
                    className="w-full h-12 px-4 rounded-xl text-sm outline-none transition-all duration-200"
                    style={{
                      background: "rgba(255,255,255,0.5)",
                      border: "1px solid rgba(0,0,0,0.06)",
                      color: "#2a2a3a",
                      boxShadow: "inset 0 1px 2px rgba(0,0,0,0.04)",
                    }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "#8b8b9e" }}>
                    Wachtwoord
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(""); }}
                      placeholder="Minimaal 8 tekens"
                      autoComplete="current-password"
                      disabled={loading}
                      className="w-full h-12 px-4 pr-11 rounded-xl text-sm outline-none transition-all duration-200"
                      style={{
                        background: "rgba(255,255,255,0.5)",
                        border: "1px solid rgba(0,0,0,0.06)",
                        color: "#2a2a3a",
                        boxShadow: "inset 0 1px 2px rgba(0,0,0,0.04)",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-black/5"
                      style={{ color: "#9b9bab" }}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <div
                className="w-4 h-4 rounded flex items-center justify-center transition-all"
                style={{
                  background: rememberMe
                    ? "linear-gradient(135deg, rgba(172,155,255,0.8), rgba(140,120,220,0.9))"
                    : "rgba(255,255,255,0.5)",
                  border: rememberMe ? "none" : "1px solid rgba(0,0,0,0.1)",
                  boxShadow: rememberMe ? "0 2px 8px rgba(172,155,255,0.3)" : "none",
                }}
                onClick={() => setRememberMe(!rememberMe)}
              >
                {rememberMe && (
                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className="text-xs" style={{ color: "#8b8b9e" }} onClick={() => setRememberMe(!rememberMe)}>
                Onthoud mij
              </span>
            </label>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-3 py-2.5 rounded-xl text-xs"
                style={{
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.15)",
                  color: "#dc2626",
                }}
              >
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading || (mfaFactorId ? mfaCode.length !== 6 : !email.trim() || !password)}
              className="w-full h-12 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-35"
              style={{
                background: "linear-gradient(135deg, rgba(172,155,255,0.85), rgba(140,120,220,0.9))",
                color: "#fff",
                boxShadow: "0 4px 20px rgba(172,155,255,0.3), inset 0 1px 1px rgba(255,255,255,0.3)",
              }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : mfaFactorId ? "Verifiëren" : "Inloggen"}
            </button>
          </form>
        </div>

        {/* Staff PIN: only visible on a paired device */}
        {paired && !mfaFactorId && (
          <button
            onClick={() => navigate("/staff-pin")}
            className="w-full mt-4 h-11 rounded-xl text-xs font-medium flex items-center justify-center gap-2"
            style={{
              background: "rgba(255,255,255,0.7)",
              border: "1px solid rgba(0,0,0,0.06)",
              color: "#5a5a72",
              boxShadow: "0 2px 12px rgba(160,175,219,0.12)",
              backdropFilter: "blur(8px)",
            }}
          >
            <KeyRound className="w-3.5 h-3.5" />
            Medewerker-PIN op dit apparaat
          </button>
        )}

        <div className="text-center mt-4 space-y-1.5">
          <p className="text-[11px]" style={{ color: "#9b9bab" }}>
            <button onClick={() => navigate("/forgot-password")} className="font-medium underline" style={{ color: "#7c6bc4" }}>
              Wachtwoord vergeten?
            </button>
          </p>
          <p className="text-[11px]" style={{ color: "#9b9bab" }}>
            Nog geen account?{" "}
            <button onClick={() => navigate("/signup")} className="font-medium underline" style={{ color: "#7c6bc4" }}>
              Zaak aanmaken
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
