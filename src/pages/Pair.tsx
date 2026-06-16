import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, ShieldCheck } from "lucide-react";
import { setDevice, getDeviceMeta, clearDevice } from "@/lib/device";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/device-pair-claim`;
const APIKEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default function Pair() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [paired, setPaired] = useState<ReturnType<typeof getDeviceMeta>>(getDeviceMeta());
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(code)) {
      setError("Voer een 6-cijferige code in");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: APIKEY },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Koppeling mislukt");
        setCode("");
        setLoading(false);
        return;
      }
      setDevice(data.device_token, {
        device_id: data.device_id,
        device_name: data.device_name,
        tenant_slug: data.tenant?.slug,
        tenant_name: data.tenant?.name,
        location_id: data.location_id,
      });
      setPaired(getDeviceMeta());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          "radial-gradient(ellipse at 20% 20%, hsl(var(--auros-lilac) / 0.35), transparent 50%), " +
          "radial-gradient(ellipse at 80% 30%, hsl(var(--auros-lilac) / 0.25), transparent 50%), " +
          "linear-gradient(180deg, #f0f2f8 0%, #e8ecf4 100%)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-6">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{
              background: "linear-gradient(135deg, hsl(var(--auros-teal) / 0.3), hsl(var(--auros-lilac) / 0.4))",
              border: "1px solid hsl(var(--card))",
              boxShadow: "0 8px 32px hsl(var(--auros-teal) / 0.2)",
            }}
          >
            <ShieldCheck className="w-6 h-6" style={{ color: "hsl(var(--primary))" }} />
          </div>
          <h1 className="text-lg font-semibold" style={{ color: "hsl(var(--foreground))" }}>
            Apparaat koppelen
          </h1>
          <p className="text-xs mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>
            Vraag de eigenaar om een koppelcode te genereren.
          </p>
        </div>

        {paired ? (
          <div
            className="rounded-2xl p-6 text-center"
            style={{
              background: "linear-gradient(180deg, hsl(var(--card)), hsl(var(--card)))",
              border: "1px solid hsl(var(--card))",
              boxShadow: "0 22px 90px hsl(var(--auros-abyss) / 0.6)",
            }}
          >
            <div className="text-sm font-semibold mb-1" style={{ color: "hsl(var(--foreground))" }}>
              ✓ Gekoppeld
            </div>
            <div className="text-xs mb-4" style={{ color: "hsl(var(--muted-foreground))" }}>
              {paired.device_name} → {paired.tenant_name || paired.tenant_slug}
            </div>
            <button
              onClick={() => navigate("/login", { replace: true })}
              className="w-full h-11 rounded-xl text-sm font-semibold"
              style={{
                background: "linear-gradient(135deg, hsl(var(--auros-teal) / 0.85), hsl(var(--auros-teal) / 0.9))",
                color: "hsl(var(--primary-foreground))",
              }}
            >
              Naar inloggen
            </button>
            <button
              onClick={() => { clearDevice(); setPaired(null); }}
              className="w-full h-9 mt-2 text-xs"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              Ontkoppelen
            </button>
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="rounded-2xl p-6 space-y-5"
            style={{
              background: "linear-gradient(180deg, hsl(var(--card)), hsl(var(--card)))",
              border: "1px solid hsl(var(--card))",
              boxShadow: "0 22px 90px hsl(var(--auros-abyss) / 0.6)",
            }}
          >
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                Koppelcode
              </label>
              <input
                ref={inputRef}
                value={code}
                onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                placeholder="••••••"
                disabled={loading}
                className="w-full h-14 px-4 rounded-xl text-center outline-none"
                style={{
                  background: "hsl(var(--card))",
                  border: "1px solid rgba(0,0,0,0.06)",
                  color: "hsl(var(--foreground))",
                  fontSize: 28,
                  letterSpacing: "0.5em",
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
              disabled={loading || code.length !== 6}
              className="w-full h-12 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{
                background: "linear-gradient(135deg, hsl(var(--auros-teal) / 0.85), hsl(var(--auros-teal) / 0.9))",
                color: "hsl(var(--primary-foreground))",
              }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Koppelen"}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
