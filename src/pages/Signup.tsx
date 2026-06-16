import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Loader2, ArrowRight, ArrowLeft, Check, Store, MapPin, User, Sparkles, Zap } from "lucide-react";

type Step = "account" | "business" | "plan" | "done";
type PlanChoice = "trial" | "pro" | "scale";

const Signup = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("account");
  const [plan, setPlan] = useState<PlanChoice>("trial");
  const [seedDemo, setSeedDemo] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Account fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Business fields
  const [businessName, setBusinessName] = useState("");
  const [slug, setSlug] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  // Result
  const [result, setResult] = useState<any>(null);

  // Auto-generate slug from business name
  useEffect(() => {
    const generated = businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 30);
    setSlug(generated);
    setSlugAvailable(null);
  }, [businessName]);

  // Check slug availability with debounce
  useEffect(() => {
    if (!slug || slug.length < 3) {
      setSlugAvailable(null);
      return;
    }
    const timer = setTimeout(async () => {
      setCheckingSlug(true);
      const { data } = await supabase.rpc("is_slug_available", { _slug: slug });
      setSlugAvailable(data === true);
      setCheckingSlug(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [slug]);

  const handleAccountSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Vul alle velden in");
      return;
    }
    if (password.length < 8) {
      setError("Wachtwoord moet minimaal 8 tekens zijn");
      return;
    }
    if (password !== confirmPassword) {
      setError("Wachtwoorden komen niet overeen");
      return;
    }

    setError("");
    setLoading(true);

    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: window.location.origin },
    });

    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    setStep("business");
  };

  const handleBusinessSubmit = async () => {
    if (!businessName.trim() || !ownerName.trim() || !slug.trim()) {
      setError("Vul bedrijfsnaam, jouw naam en slug in");
      return;
    }
    if (slug.length < 3) {
      setError("Slug moet minimaal 3 tekens zijn");
      return;
    }
    if (slugAvailable === false) {
      setError("Deze slug is al in gebruik");
      return;
    }

    setError("");
    setLoading(true);

    const { data, error: rpcError } = await supabase.rpc("setup_tenant_onboarding", {
      _tenant_name: businessName.trim(),
      _slug: slug.trim(),
      _owner_name: ownerName.trim(),
      _city: city.trim(),
      _address: address.trim(),
      _plan_type: plan,
    });

    if (rpcError) {
      setLoading(false);
      setError(rpcError.message);
      return;
    }

    setResult(data);

    // Optionally seed demo data
    if (seedDemo && (data as any)?.location_id) {
      try {
        await supabase.rpc("seed_demo_data", { _location_id: (data as any).location_id });
      } catch (e) {
        // Non-fatal — continue to done step
        console.warn("Demo seed failed", e);
      }
    }

    setLoading(false);
    setStep("done");
  };

  const glassCard = {
    background:
      "radial-gradient(circle at top left, hsl(var(--auros-lilac) / 0.24), transparent 38%), " +
      "radial-gradient(circle at top right, hsl(var(--auros-lilac) / 0.18), transparent 42%), " +
      "linear-gradient(180deg, hsl(var(--card)), hsl(var(--card)))",
    border: "1px solid hsl(var(--card))",
    boxShadow: "inset 0 1px 1px hsl(var(--card)), 0 22px 90px hsl(var(--auros-abyss) / 0.6)",
    backdropFilter: "blur(14px)",
  };

  const inputStyle = {
    background: "hsl(var(--card))",
    border: "1px solid rgba(0,0,0,0.06)",
    color: "hsl(var(--foreground))",
    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.04)",
  };

  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-3 mb-6">
      {[
        { key: "account", label: "Account", icon: User },
        { key: "business", label: "Bedrijf", icon: Store },
        { key: "plan", label: "Plan", icon: Sparkles },
        { key: "done", label: "Klaar", icon: Check },
      ].map((s, i) => {
        const steps: Step[] = ["account", "business", "plan", "done"];
        const currentIdx = steps.indexOf(step);
        const stepIdx = steps.indexOf(s.key as Step);
        const isActive = stepIdx === currentIdx;
        const isDone = stepIdx < currentIdx;
        return (
          <React.Fragment key={s.key}>
            {i > 0 && (
              <div
                className="w-8 h-0.5 rounded-full"
                style={{ background: isDone ? "hsl(var(--auros-teal) / 0.7)" : "rgba(0,0,0,0.08)" }}
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                style={{
                  background: isActive || isDone
                    ? "linear-gradient(135deg, hsl(var(--auros-teal) / 0.85), hsl(var(--auros-teal) / 0.9))"
                    : "rgba(0,0,0,0.05)",
                  color: isActive || isDone ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
                }}
              >
                {isDone ? <Check className="w-3.5 h-3.5" /> : <s.icon className="w-3.5 h-3.5" />}
              </div>
              <span
                className="text-[9px] font-medium"
                style={{ color: isActive ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))" }}
              >
                {s.label}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          "radial-gradient(ellipse at 20% 20%, hsl(var(--auros-lilac) / 0.35), transparent 50%), " +
          "radial-gradient(ellipse at 80% 30%, hsl(var(--auros-lilac) / 0.25), transparent 50%), " +
          "radial-gradient(ellipse at 50% 80%, rgba(199,230,255,0.2), transparent 50%), " +
          "linear-gradient(180deg, #f0f2f8 0%, #e8ecf4 100%)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        {/* Brand */}
        <div className="text-center mb-6">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
            style={{
              background: "linear-gradient(135deg, hsl(var(--auros-teal) / 0.3), hsl(var(--auros-lilac) / 0.4))",
              border: "1px solid hsl(var(--card))",
              boxShadow: "0 8px 32px hsl(var(--auros-teal) / 0.2), inset 0 1px 1px hsl(var(--auros-ice) / 0.08)",
              backdropFilter: "blur(12px)",
            }}
          >
            <Store className="w-6 h-6" style={{ color: "hsl(var(--foreground))" }} />
          </motion.div>
          <h1 className="text-lg font-semibold tracking-tight" style={{ color: "hsl(var(--foreground))" }}>
            Start jouw POS
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
            Maak een account en configureer je zaak
          </p>
        </div>

        <StepIndicator />

        <div className="rounded-2xl p-6" style={glassCard}>
          {/* STEP: Account */}
          {step === "account" && (
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                  E-mailadres
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  placeholder="jouw@email.nl"
                  className="w-full h-12 px-4 rounded-xl text-sm outline-none"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                  Wachtwoord
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder="Minimaal 8 tekens"
                  className="w-full h-12 px-4 rounded-xl text-sm outline-none"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                  Bevestig wachtwoord
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                  placeholder="Herhaal wachtwoord"
                  className="w-full h-12 px-4 rounded-xl text-sm outline-none"
                  style={inputStyle}
                />
              </div>

              {error && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className="px-3 py-2.5 rounded-xl text-xs"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: "#dc2626" }}>
                  {error}
                </motion.div>
              )}

              <button
                onClick={handleAccountSubmit}
                disabled={loading || !email.trim() || !password.trim()}
                className="w-full h-12 rounded-xl text-sm font-semibold transition-all disabled:opacity-35 flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--auros-teal) / 0.85), hsl(var(--auros-teal) / 0.9))",
                  color: "hsl(var(--primary-foreground))",
                  boxShadow: "0 4px 20px hsl(var(--auros-teal) / 0.3), inset 0 1px 1px rgba(255,255,255,0.3)",
                }}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Volgende <ArrowRight className="w-4 h-4" /></>}
              </button>

              <p className="text-center text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                Al een account?{" "}
                <button onClick={() => navigate("/login")} className="font-medium underline" style={{ color: "hsl(var(--primary))" }}>
                  Inloggen
                </button>
              </p>
            </div>
          )}

          {/* STEP: Business */}
          {step === "business" && (
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                  Bedrijfsnaam
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => { setBusinessName(e.target.value); setError(""); }}
                  placeholder="Bijv. Matcha Lab"
                  maxLength={60}
                  className="w-full h-12 px-4 rounded-xl text-sm outline-none"
                  style={inputStyle}
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                  URL slug (subdomain)
                </label>
                <div className="flex items-center gap-0">
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); setError(""); setSlugAvailable(null); }}
                    placeholder="matcha-lab"
                    maxLength={30}
                    className="flex-1 h-12 px-4 rounded-l-xl text-sm outline-none"
                    style={inputStyle}
                  />
                  <div
                    className="h-12 px-3 flex items-center rounded-r-xl text-[11px] font-medium"
                    style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.06)", borderLeft: "none", color: "hsl(var(--muted-foreground))" }}
                  >
                    .dotts.app
                  </div>
                </div>
                {slug.length >= 3 && (
                  <div className="mt-1 text-[10px] font-medium">
                    {checkingSlug ? (
                      <span style={{ color: "hsl(var(--muted-foreground))" }}>Controleren...</span>
                    ) : slugAvailable === true ? (
                      <span style={{ color: "#16a34a" }}>✓ Beschikbaar</span>
                    ) : slugAvailable === false ? (
                      <span style={{ color: "#dc2626" }}>✗ Al in gebruik</span>
                    ) : null}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                  Jouw naam (eigenaar)
                </label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => { setOwnerName(e.target.value); setError(""); }}
                  placeholder="Voornaam Achternaam"
                  maxLength={60}
                  className="w-full h-12 px-4 rounded-xl text-sm outline-none"
                  style={inputStyle}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                    Stad
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Amsterdam"
                    maxLength={60}
                    className="w-full h-12 px-4 rounded-xl text-sm outline-none"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                    Adres
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Straatnaam 1"
                    maxLength={120}
                    className="w-full h-12 px-4 rounded-xl text-sm outline-none"
                    style={inputStyle}
                  />
                </div>
              </div>

              {error && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className="px-3 py-2.5 rounded-xl text-xs"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: "#dc2626" }}>
                  {error}
                </motion.div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setStep("account"); setError(""); }}
                  className="h-12 px-4 rounded-xl text-sm font-medium flex items-center gap-1.5"
                  style={{ background: "rgba(0,0,0,0.04)", color: "hsl(var(--foreground))" }}
                >
                  <ArrowLeft className="w-4 h-4" /> Terug
                </button>
                <button
                  onClick={() => {
                    if (!businessName.trim() || !ownerName.trim() || !slug.trim()) {
                      setError("Vul bedrijfsnaam, jouw naam en slug in");
                      return;
                    }
                    if (slugAvailable === false) {
                      setError("Deze slug is al in gebruik");
                      return;
                    }
                    setError("");
                    setStep("plan");
                  }}
                  disabled={!businessName.trim() || !ownerName.trim() || !slug.trim() || slugAvailable === false}
                  className="flex-1 h-12 rounded-xl text-sm font-semibold transition-all disabled:opacity-35 flex items-center justify-center gap-2"
                  style={{
                    background: "linear-gradient(135deg, hsl(var(--auros-teal) / 0.85), hsl(var(--auros-teal) / 0.9))",
                    color: "hsl(var(--primary-foreground))",
                    boxShadow: "0 4px 20px hsl(var(--auros-teal) / 0.3), inset 0 1px 1px rgba(255,255,255,0.3)",
                  }}
                >
                  Volgende <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP: Plan */}
          {step === "plan" && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <h2 className="text-sm font-semibold" style={{ color: "hsl(var(--foreground))" }}>Kies je startplan</h2>
                <p className="text-[11px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>14 dagen gratis, geen creditcard nodig</p>
              </div>

              {[
                { id: "trial" as PlanChoice, name: "Gratis proef", price: "€0", desc: "14 dagen alles uitproberen", icon: Sparkles, badge: "Aanbevolen" },
                { id: "pro" as PlanChoice, name: "Pro", price: "€49/mnd", desc: "Volledige POS + multi-locatie", icon: Store, badge: null },
                { id: "scale" as PlanChoice, name: "Scale", price: "€129/mnd", desc: "Inclusief AI BI + integraties", icon: Zap, badge: null },
              ].map((p) => {
                const selected = plan === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlan(p.id)}
                    className="w-full text-left p-3 rounded-xl flex items-center gap-3 transition-all"
                    style={{
                      background: selected ? "hsl(var(--auros-teal) / 0.12)" : "hsl(var(--card))",
                      border: selected ? "1.5px solid hsl(var(--auros-teal) / 0.6)" : "1px solid rgba(0,0,0,0.06)",
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        background: selected
                          ? "linear-gradient(135deg, hsl(var(--auros-teal) / 0.85), hsl(var(--auros-teal) / 0.9))"
                          : "rgba(0,0,0,0.04)",
                        color: selected ? "hsl(var(--primary-foreground))" : "hsl(var(--primary))",
                      }}
                    >
                      <p.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold" style={{ color: "hsl(var(--foreground))" }}>{p.name}</span>
                        {p.badge && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.15)", color: "#16a34a" }}>
                            {p.badge}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>{p.desc}</span>
                    </div>
                    <span className="text-sm font-bold shrink-0" style={{ color: selected ? "hsl(var(--primary))" : "hsl(var(--foreground))" }}>{p.price}</span>
                  </button>
                );
              })}

              <label className="flex items-center gap-2.5 p-3 rounded-xl cursor-pointer" style={{ background: "hsl(var(--card))", border: "1px solid rgba(0,0,0,0.06)" }}>
                <input
                  type="checkbox"
                  checked={seedDemo}
                  onChange={(e) => setSeedDemo(e.target.checked)}
                  className="w-4 h-4 rounded accent-purple-500"
                />
                <div className="flex-1">
                  <div className="text-xs font-semibold" style={{ color: "hsl(var(--foreground))" }}>Demo-data toevoegen</div>
                  <div className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>10 voorbeeldproducten + 6 tafels — verwijderbaar</div>
                </div>
              </label>

              {error && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className="px-3 py-2.5 rounded-xl text-xs"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: "#dc2626" }}>
                  {error}
                </motion.div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setStep("business"); setError(""); }}
                  disabled={loading}
                  className="h-12 px-4 rounded-xl text-sm font-medium flex items-center gap-1.5"
                  style={{ background: "rgba(0,0,0,0.04)", color: "hsl(var(--foreground))" }}
                >
                  <ArrowLeft className="w-4 h-4" /> Terug
                </button>
                <button
                  onClick={handleBusinessSubmit}
                  disabled={loading}
                  className="flex-1 h-12 rounded-xl text-sm font-semibold transition-all disabled:opacity-35 flex items-center justify-center gap-2"
                  style={{
                    background: "linear-gradient(135deg, hsl(var(--auros-teal) / 0.85), hsl(var(--auros-teal) / 0.9))",
                    color: "hsl(var(--primary-foreground))",
                    boxShadow: "0 4px 20px hsl(var(--auros-teal) / 0.3), inset 0 1px 1px rgba(255,255,255,0.3)",
                  }}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Zaak aanmaken <Check className="w-4 h-4" /></>}
                </button>
              </div>
            </div>
          )}

          {/* STEP: Done */}
          {step === "done" && (
            <div className="text-center space-y-5 py-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, rgba(34,197,94,0.2), rgba(16,185,129,0.3))",
                  boxShadow: "0 8px 32px rgba(34,197,94,0.2)",
                }}
              >
                <Check className="w-8 h-8" style={{ color: "#16a34a" }} />
              </motion.div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: "hsl(var(--foreground))" }}>
                  Welkom, {ownerName}!
                </h2>
                <p className="text-sm mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                  <strong>{businessName}</strong> is aangemaakt
                </p>
              </div>

              <p className="text-sm" style={{ color: "hsl(var(--foreground))" }}>
                Je bent direct ingelogd als <strong>eigenaar</strong>. Je medewerkers kunnen later via "Medewerker" inloggen met hun naam en 6-cijferige PIN.
              </p>

              <button
                onClick={() => navigate("/app", { replace: true })}
                className="w-full h-12 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--auros-teal) / 0.85), hsl(var(--auros-teal) / 0.9))",
                  color: "hsl(var(--primary-foreground))",
                  boxShadow: "0 4px 20px hsl(var(--auros-teal) / 0.3), inset 0 1px 1px rgba(255,255,255,0.3)",
                }}
              >
                Naar dashboard <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Signup;
