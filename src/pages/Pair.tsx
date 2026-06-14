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
          "radial-gradient(ellipse at 20% 20%, rgba(205,216,255,0.35), transparent 50%), " +
          "radial-gradient(ellipse at 80% 30%, rgba(255,206,236,0.25), transparent 50%), " +
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
              background: "linear-gradient(135deg, rgba(172,155,255,0.3), rgba(205,216,255,0.4))",
              border: "1px solid rgba(255,255,255,0.6)",
              boxShadow: "0 8px 32px rgba(172,155,255,0.2)",
            }}
          >
            <ShieldCheck className="w-6 h-6" style={{ color: "#7c6bc4" }} />
          </div>
          <h1 className="text-lg font-semibold" style={{ color: "#2a2a3a" }}>
            Apparaat koppelen
          </h1>
          <p className="text-xs mt-1" style={{ color: "#9b9bab" }}>
            Vraag de eigenaar om een koppelcode te genereren.
          </p>
        </div>

        {paired ? (
          <div
            className="rounded-2xl p-6 text-center"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(247,249,255,0.78))",
              border: "1px solid rgba(255,255,255,0.72)",
              boxShadow: "0 22px 90px rgba(160,175,219,0.16)",
            }}
          >
            <div className="text-sm font-semibold mb-1" style={{ color: "#2a2a3a" }}>
              ✓ Gekoppeld
            </div>
            <div className="text-xs mb-4" style={{ color: "#8b8b9e" }}>
              {paired.device_name} → {paired.tenant_name || paired.tenant_slug}
            </div>
            <button
              onClick={() => navigate("/login", { replace: true })}
              className="w-full h-11 rounded-xl text-sm font-semibold"
              style={{
                background: "linear-gradient(135deg, rgba(172,155,255,0.85), rgba(140,120,220,0.9))",
                color: "#fff",
              }}
            >
              Naar inloggen
            </button>
            <button
              onClick={() => { clearDevice(); setPaired(null); }}
              className="w-full h-9 mt-2 text-xs"
              style={{ color: "#9b9bab" }}
            >
              Ontkoppelen
            </button>
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="rounded-2xl p-6 space-y-5"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(247,249,255,0.78))",
              border: "1px solid rgba(255,255,255,0.72)",
              boxShadow: "0 22px 90px rgba(160,175,219,0.16)",
            }}
          >
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "#8b8b9e" }}>
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
                  background: "rgba(255,255,255,0.5)",
                  border: "1px solid rgba(0,0,0,0.06)",
                  color: "#2a2a3a",
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
                background: "linear-gradient(135deg, rgba(172,155,255,0.85), rgba(140,120,220,0.9))",
                color: "#fff",
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
