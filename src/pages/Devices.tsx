import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, ShieldCheck, ShieldOff, Plus, Copy, Check } from "lucide-react";

interface Device {
  id: string;
  device_name: string;
  last_seen_at: string | null;
  last_ip: string | null;
  user_agent: string | null;
  revoked_at: string | null;
  created_at: string;
}

export default function Devices() {
  const { employee } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pairCode, setPairCode] = useState<{ code: string; expires_at: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [copied, setCopied] = useState(false);

  const canManage = employee && ["owner", "manager"].includes(employee.role);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("trusted_devices")
      .select("id, device_name, last_seen_at, last_ip, user_agent, revoked_at, created_at")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setDevices(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { if (canManage) load(); else setLoading(false); }, [canManage, load]);

  const generate = async () => {
    if (!deviceName.trim()) { setError("Geef het apparaat een naam"); return; }
    setGenerating(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/device-pair-start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ device_name: deviceName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Mislukt"); return; }
      setPairCode({ code: data.code, expires_at: data.expires_at });
      setDeviceName("");
    } finally {
      setGenerating(false);
    }
  };

  const revoke = async (id: string) => {
    if (!confirm("Apparaat intrekken? Het kan niet meer inloggen via deze koppeling.")) return;
    const { error } = await supabase
      .from("trusted_devices")
      .update({ revoked_at: new Date().toISOString(), revoked_by: employee?.id })
      .eq("id", id);
    if (error) setError(error.message);
    else load();
  };

  const copy = async () => {
    if (!pairCode) return;
    await navigator.clipboard.writeText(pairCode.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!canManage) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-sm text-muted-foreground">Geen rechten om apparaten te beheren.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto">
      <motion.h1
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xl font-semibold mb-1"
        style={{ color: "#2a2a3a" }}
      >
        Vertrouwde apparaten
      </motion.h1>
      <p className="text-xs mb-6" style={{ color: "#8b8b9e" }}>
        Koppel iPads en kassa's aan jouw zaak. Gekoppelde apparaten hoeven alleen nog een PIN in te voeren.
      </p>

      {/* Pair section */}
      <div
        className="rounded-2xl p-5 mb-6"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(247,249,255,0.78))",
          border: "1px solid rgba(255,255,255,0.72)",
          boxShadow: "0 12px 40px rgba(160,175,219,0.12)",
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Plus className="w-4 h-4" style={{ color: "#7c6bc4" }} />
          <span className="text-sm font-semibold" style={{ color: "#2a2a3a" }}>Nieuw apparaat koppelen</span>
        </div>

        {pairCode ? (
          <div className="text-center py-4">
            <div className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "#8b8b9e" }}>
              Koppelcode (geldig 5 min)
            </div>
            <div
              className="text-4xl font-bold mb-3 cursor-pointer inline-flex items-center gap-3"
              style={{ color: "#2a2a3a", letterSpacing: "0.3em", fontVariantNumeric: "tabular-nums" }}
              onClick={copy}
            >
              {pairCode.code}
              {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" style={{ color: "#9b9bab" }} />}
            </div>
            <div className="text-xs mb-4" style={{ color: "#8b8b9e" }}>
              Open <span className="font-mono">/pair</span> op de nieuwe iPad en voer deze code in.
            </div>
            <button
              onClick={() => setPairCode(null)}
              className="text-xs underline"
              style={{ color: "#7c6bc4" }}
            >
              Nieuwe code maken
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="Bijv. Kassa 1, Bar iPad"
              className="flex-1 h-10 px-3 rounded-lg text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.08)" }}
            />
            <button
              onClick={generate}
              disabled={generating || !deviceName.trim()}
              className="h-10 px-4 rounded-lg text-sm font-semibold disabled:opacity-40"
              style={{
                background: "linear-gradient(135deg, rgba(172,155,255,0.85), rgba(140,120,220,0.9))",
                color: "#fff",
              }}
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Genereer code"}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 px-3 py-2.5 rounded-xl text-xs" style={{ background: "rgba(239,68,68,0.08)", color: "#dc2626" }}>
          {error}
        </div>
      )}

      {/* Devices list */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : devices.length === 0 ? (
        <div className="text-center py-10 text-sm" style={{ color: "#9b9bab" }}>
          Nog geen gekoppelde apparaten.
        </div>
      ) : (
        <div className="space-y-2">
          {devices.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{
                background: "rgba(255,255,255,0.6)",
                border: "1px solid rgba(0,0,0,0.05)",
                opacity: d.revoked_at ? 0.55 : 1,
              }}
            >
              {d.revoked_at
                ? <ShieldOff className="w-4 h-4" style={{ color: "#9b9bab" }} />
                : <ShieldCheck className="w-4 h-4" style={{ color: "#22c55e" }} />}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: "#2a2a3a" }}>
                  {d.device_name}
                </div>
                <div className="text-[11px]" style={{ color: "#9b9bab" }}>
                  {d.revoked_at
                    ? `Ingetrokken ${new Date(d.revoked_at).toLocaleString("nl-NL")}`
                    : d.last_seen_at
                      ? `Laatst actief ${new Date(d.last_seen_at).toLocaleString("nl-NL")}`
                      : "Nog niet gebruikt"}
                  {d.last_ip && ` · ${d.last_ip}`}
                </div>
              </div>
              {!d.revoked_at && (
                <button
                  onClick={() => revoke(d.id)}
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: "rgba(239,68,68,0.08)", color: "#dc2626" }}
                >
                  Intrekken
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
