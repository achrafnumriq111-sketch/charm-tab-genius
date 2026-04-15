import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";

const Login = () => {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) navigate("/", { replace: true });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !pin.trim()) {
      setError("Vul alle velden in");
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      setError("PIN moet exact 6 cijfers zijn");
      return;
    }

    setError("");
    setLoading(true);

    const result = await login(username.trim(), pin, rememberMe);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      setPin("");
    } else {
      navigate("/", { replace: true });
    }
  };

  const handlePinChange = (val: string) => {
    // Only allow digits, max 6
    const cleaned = val.replace(/\D/g, "").slice(0, 6);
    setPin(cleaned);
    setError("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(145deg, #0c0c0e 0%, #141418 40%, #1a1a20 100%)" }}>
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: "linear-gradient(135deg, #b8860b, #d4a543)" }}>
            <Lock className="w-8 h-8 text-black/80" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#e8e8ec" }}>
            SAAKOUK
          </h1>
          <p className="text-sm mt-1" style={{ color: "#6b6b78" }}>
            Point of Sale
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Username */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2"
              style={{ color: "#6b6b78" }}>
              Gebruikersnaam
            </label>
            <input
              ref={usernameRef}
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(""); }}
              placeholder="Gebruikersnaam"
              autoComplete="username"
              disabled={loading}
              className="w-full h-14 px-4 rounded-xl text-base outline-none transition-all duration-200"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#e8e8ec",
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = "rgba(184,134,11,0.5)"}
              onBlur={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}
            />
          </div>

          {/* PIN */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2"
              style={{ color: "#6b6b78" }}>
              Wachtwoord
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
                className="w-full h-14 px-4 pr-12 rounded-xl text-base outline-none transition-all duration-200"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#e8e8ec",
                  letterSpacing: showPin ? "normal" : "0.3em",
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "rgba(184,134,11,0.5)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1"
                style={{ color: "#6b6b78" }}
                tabIndex={-1}
              >
                {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Remember me */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              className="w-5 h-5 rounded flex items-center justify-center transition-all"
              style={{
                background: rememberMe ? "linear-gradient(135deg, #b8860b, #d4a543)" : "rgba(255,255,255,0.06)",
                border: rememberMe ? "none" : "1px solid rgba(255,255,255,0.12)",
              }}
              onClick={() => setRememberMe(!rememberMe)}
            >
              {rememberMe && (
                <svg className="w-3 h-3 text-black" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <span className="text-sm" style={{ color: "#8b8b98" }}
              onClick={() => setRememberMe(!rememberMe)}>
              Onthoud mij
            </span>
          </label>

          {/* Error */}
          {error && (
            <div className="px-4 py-3 rounded-xl text-sm" style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.2)",
              color: "#f87171",
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !username.trim() || pin.length !== 6}
            className="w-full h-14 rounded-xl text-base font-semibold transition-all duration-200 disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, #b8860b, #c4973a)",
              color: "#1a1a20",
            }}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            ) : (
              "Inloggen"
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
