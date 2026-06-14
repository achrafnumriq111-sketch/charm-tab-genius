import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

type Mode = "owner" | "employee";

const Login = () => {
  const [mode, setMode] = useState<Mode>("owner");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { login, loginOwner, isAuthenticated } = useAuth();
  const { tenant, isPlatformLevel } = useTenant();

  useEffect(() => {
    if (isAuthenticated) navigate(isPlatformLevel ? "/app" : "/", { replace: true });
  }, [isAuthenticated, navigate, isPlatformLevel]);

  useEffect(() => {
    if (mode === "owner") emailRef.current?.focus();
    else usernameRef.current?.focus();
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (mode === "owner") {
      if (!email.trim() || !password) {
        setError("Vul email en wachtwoord in");
        return;
      }
      setLoading(true);
      const result = await loginOwner(email.trim(), password, rememberMe);
      setLoading(false);
      if (result.error) {
        setError(result.error);
        setPassword("");
      } else {
        navigate(isPlatformLevel ? "/app" : "/", { replace: true });
      }
      return;
    }

    // Employee mode
    if (!username.trim() || !pin.trim()) {
      setError("Vul alle velden in");
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      setError("PIN moet exact 6 cijfers zijn");
      return;
    }
    setLoading(true);
    const result = await login(username.trim(), pin, rememberMe);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      setPin("");
    } else {
      navigate(isPlatformLevel ? "/app" : "/", { replace: true });
    }
  };

  const handlePinChange = (val: string) => {
    const cleaned = val.replace(/\D/g, "").slice(0, 6);
    setPin(cleaned);
    setError("");
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          "radial-gradient(ellipse at 20% 20%, rgba(205,216,255,0.35), transparent 50%), " +
          "radial-gradient(ellipse at 80% 30%, rgba(255,206,236,0.25), transparent 50%), " +
          "radial-gradient(ellipse at 50% 80%, rgba(199,230,255,0.2), transparent 50%), " +
          "linear-gradient(180deg, #f0f2f8 0%, #e8ecf4 100%)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm"
      >
        {/* Brand */}
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
              {tenant ? tenant.name.charAt(0).toUpperCase() : "S"}
            </span>
          </motion.div>
          <h1 className="text-lg font-semibold tracking-tight" style={{ color: "#2a2a3a" }}>
            {tenant ? tenant.name : "SAAKOUK"}
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "#9b9bab" }}>
            Point of Sale
          </p>
        </div>

        {/* Glass Card */}
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
          {/* Mode tabs */}
          <div
            className="flex p-1 rounded-xl mb-5"
            style={{ background: "rgba(0,0,0,0.04)" }}
          >
            {(["owner", "employee"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(""); }}
                className="flex-1 h-9 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: mode === m
                    ? "linear-gradient(135deg, rgba(172,155,255,0.9), rgba(140,120,220,0.95))"
                    : "transparent",
                  color: mode === m ? "#fff" : "#8b8b9e",
                  boxShadow: mode === m ? "0 2px 10px rgba(172,155,255,0.25)" : "none",
                }}
              >
                {m === "owner" ? "Eigenaar" : "Medewerker"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === "owner" ? (
              <>
                {/* Email */}
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

                {/* Password */}
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
            ) : (
              <>
                {/* Username */}
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "#8b8b9e" }}>
                    Gebruikersnaam
                  </label>
                  <input
                    ref={usernameRef}
                    type="text"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setError(""); }}
                    placeholder="Voornaam Achternaam"
                    autoComplete="username"
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

                {/* PIN */}
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "#8b8b9e" }}>
                    PIN (6 cijfers)
                  </label>
                  <div className="relative">
                    <input
                      type={showPin ? "text" : "password"}
                      value={pin}
                      onChange={(e) => handlePinChange(e.target.value)}
                      placeholder="••••••"
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      autoComplete="current-password"
                      disabled={loading}
                      className="w-full h-12 px-4 pr-11 rounded-xl text-sm outline-none transition-all duration-200"
                      style={{
                        background: "rgba(255,255,255,0.5)",
                        border: "1px solid rgba(0,0,0,0.06)",
                        color: "#2a2a3a",
                        boxShadow: "inset 0 1px 2px rgba(0,0,0,0.04)",
                        letterSpacing: showPin ? "normal" : "0.25em",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-black/5"
                      style={{ color: "#9b9bab" }}
                      tabIndex={-1}
                    >
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Remember me */}
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

            {/* Error */}
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

            {/* Submit */}
            <button
              type="submit"
              disabled={
                loading ||
                (mode === "owner"
                  ? !email.trim() || !password
                  : !username.trim() || pin.length !== 6)
              }
              className="w-full h-12 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-35"
              style={{
                background: "linear-gradient(135deg, rgba(172,155,255,0.85), rgba(140,120,220,0.9))",
                color: "#fff",
                boxShadow: "0 4px 20px rgba(172,155,255,0.3), inset 0 1px 1px rgba(255,255,255,0.3)",
              }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Inloggen"}
            </button>
          </form>
        </div>

        {/* Links */}
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
