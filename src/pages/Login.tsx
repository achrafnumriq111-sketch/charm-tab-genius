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
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      {/* Auros bioluminescent backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 20% 20%, hsl(var(--auros-teal) / 0.18), transparent 45%)," +
            "radial-gradient(circle at 80% 75%, hsl(var(--auros-lilac) / 0.14), transparent 50%)",
        }}
      />
      <div className="absolute top-4 right-4 z-10">
        <ThemeSwitcher />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm relative z-[1]"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.7, opacity: 0, rotateX: -25 }}
            animate={{ scale: 1, opacity: 1, rotateX: 0 }}
            transition={{ delay: 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ scale: 1.04, rotateX: 6, rotateY: -6 }}
            style={{ transformStyle: "preserve-3d", perspective: 600 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 bg-card border border-border"
          >
            <div
              className="w-full h-full rounded-2xl flex items-center justify-center"
              style={{
                background:
                  "linear-gradient(135deg, hsl(var(--auros-teal) / 0.35), hsl(var(--auros-lilac) / 0.25))",
                boxShadow:
                  "inset 0 1px 0 hsl(var(--auros-ice) / 0.25), inset 0 -10px 20px hsl(var(--auros-abyss) / 0.5), 0 18px 40px -12px hsl(var(--auros-teal) / 0.45), 0 4px 10px hsl(var(--auros-abyss) / 0.6)",
              }}
            >
              <span className="text-2xl font-bold text-foreground drop-shadow">
                {tenant ? tenant.name.charAt(0).toUpperCase() : "·"}
              </span>
            </div>
          </motion.div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            {tenant ? tenant.name : "DOTTS"}
          </h1>
          <p className="text-xs mt-0.5 text-muted-foreground">Eigenaar-login</p>
        </div>

        <motion.div
          whileHover={{ y: -2 }}
          transition={{ type: "spring", stiffness: 200, damping: 22 }}
          className="rounded-2xl p-6 bg-card border border-border backdrop-blur-xl"
          style={{
            boxShadow:
              "inset 0 1px 0 hsl(var(--auros-ice) / 0.06), 0 30px 80px -20px hsl(var(--auros-abyss) / 0.85), 0 8px 24px -8px hsl(var(--auros-teal) / 0.18)",
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            {mfaFactorId ? (
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5 text-muted-foreground">
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
                  className="w-full h-14 px-4 rounded-xl text-center outline-none bg-background border border-border text-foreground focus:border-primary"
                  style={{ fontSize: 26, letterSpacing: "0.4em", fontVariantNumeric: "tabular-nums" }}
                />
                <button
                  type="button"
                  onClick={() => { setMfaFactorId(null); setMfaCode(""); setPassword(""); setError(""); }}
                  className="text-[11px] underline mt-2 text-primary"
                >
                  Annuleer
                </button>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5 text-muted-foreground">
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
                    className="w-full h-12 px-4 rounded-xl text-sm outline-none transition-all duration-200 bg-background border border-border text-foreground placeholder:text-muted-foreground focus:border-primary"
                    style={{ boxShadow: "inset 0 1px 2px hsl(var(--auros-abyss) / 0.5)" }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5 text-muted-foreground">
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
                      className="w-full h-12 px-4 pr-11 rounded-xl text-sm outline-none transition-all duration-200 bg-background border border-border text-foreground placeholder:text-muted-foreground focus:border-primary"
                      style={{ boxShadow: "inset 0 1px 2px hsl(var(--auros-abyss) / 0.5)" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-accent text-muted-foreground"
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
                className="w-4 h-4 rounded flex items-center justify-center transition-all border"
                style={{
                  background: rememberMe
                    ? "linear-gradient(135deg, hsl(var(--auros-teal)), hsl(var(--auros-lilac)))"
                    : "hsl(var(--background))",
                  borderColor: rememberMe ? "transparent" : "hsl(var(--border))",
                  boxShadow: rememberMe ? "0 2px 8px hsl(var(--auros-teal) / 0.4)" : "none",
                }}
                onClick={() => setRememberMe(!rememberMe)}
              >
                {rememberMe && (
                  <svg className="w-2.5 h-2.5 text-primary-foreground" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className="text-xs text-muted-foreground" onClick={() => setRememberMe(!rememberMe)}>
                Onthoud mij
              </span>
            </label>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-3 py-2.5 rounded-xl text-xs bg-destructive/10 border border-destructive/30 text-destructive"
              >
                {error}
              </motion.div>
            )}

            <motion.button
              whileHover={{ scale: 1.01, y: -1 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading || (mfaFactorId ? mfaCode.length !== 6 : !email.trim() || !password)}
              className="w-full h-12 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-40 text-primary-foreground"
              style={{
                background:
                  "linear-gradient(135deg, hsl(var(--auros-teal)), hsl(var(--auros-lilac)))",
                boxShadow:
                  "0 10px 30px -10px hsl(var(--auros-teal) / 0.55), inset 0 1px 0 hsl(var(--auros-ice) / 0.25), inset 0 -2px 6px hsl(var(--auros-abyss) / 0.35)",
              }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : mfaFactorId ? "Verifiëren" : "Inloggen"}
            </motion.button>
          </form>
        </motion.div>

        {paired && !mfaFactorId && (
          <button
            onClick={() => navigate("/staff-pin")}
            className="w-full mt-4 h-11 rounded-xl text-xs font-medium flex items-center justify-center gap-2 bg-card border border-border text-foreground hover:bg-accent transition-colors"
            style={{ boxShadow: "0 6px 18px -8px hsl(var(--auros-abyss) / 0.7)" }}
          >
            <KeyRound className="w-3.5 h-3.5" />
            Medewerker-PIN op dit apparaat
          </button>
        )}

        <div className="text-center mt-4 space-y-1.5">
          <p className="text-[11px] text-muted-foreground">
            <button onClick={() => navigate("/forgot-password")} className="font-medium underline text-primary">
              Wachtwoord vergeten?
            </button>
          </p>
          <p className="text-[11px] text-muted-foreground">
            Nog geen account?{" "}
            <button onClick={() => navigate("/signup")} className="font-medium underline text-primary">
              Zaak aanmaken
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
