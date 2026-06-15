import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation_ } from "@/contexts/LocationContext";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";

interface FlagDef {
  key: string;
  label: string;
  description: string;
  default: boolean;
}

const FEATURES: FlagDef[] = [
  { key: "pos", label: "POS / Kassa", description: "Verkooppunt en bonnen. Vrijwel altijd aan.", default: true },
  { key: "qr_ordering", label: "QR-bestellen", description: "Gasten scannen QR aan tafel en plaatsen orders zelf.", default: true },
  { key: "upsell", label: "Upsell-engine", description: "Automatische suggesties tijdens afrekenen.", default: true },
  { key: "loyalty", label: "Loyalty (PassKit)", description: "Apple Wallet-passen, stempels, spaarprogramma.", default: true },
  { key: "ai_forecast", label: "AI Forecasting", description: "Weersgedreven omzet- en voorraadvoorspellingen.", default: true },
  { key: "inventory", label: "Voorraadbeheer", description: "Master stock, perishables, waste, tellingen.", default: true },
  { key: "prep_station", label: "Prep Station / KDS", description: "Keuken-display met routering en timers.", default: true },
  { key: "reservations", label: "Reserveringen", description: "Tafelreserveringen via app of front-of-house.", default: true },
  { key: "cash_closing", label: "Kasafsluiting", description: "Blind count, 4-eyes verificatie, owner audit.", default: true },
  { key: "analytics", label: "Analytics-dashboard", description: "KPI's, heatmaps, accounting-export.", default: true },
];

const bg = "linear-gradient(180deg, #f0f2f8 0%, #e8ecf4 100%)";
const card = { background: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.7)", backdropFilter: "blur(12px)" } as const;

const SettingsFeatures = () => {
  const navigate = useNavigate();
  const { employee } = useAuth();
  const { tenantId } = useLocation_();
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("tenant_feature_flags")
      .select("feature_key, is_enabled")
      .eq("tenant_id", tenantId);
    if (error) setError(error.message);
    const map: Record<string, boolean> = {};
    FEATURES.forEach((f) => (map[f.key] = f.default));
    (data || []).forEach((r: any) => (map[r.feature_key] = r.is_enabled));
    setFlags(map);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    if (employee?.role !== "owner") {
      navigate("/");
      return;
    }
    load();
  }, [employee, navigate, load]);

  if (employee?.role !== "owner") return null;

  const toggle = async (key: string, next: boolean) => {
    if (!tenantId) return;
    setSavingKey(key);
    setError("");
    // Optimistic
    setFlags((p) => ({ ...p, [key]: next }));
    const { error } = await supabase
      .from("tenant_feature_flags")
      .upsert(
        { tenant_id: tenantId, feature_key: key, is_enabled: next },
        { onConflict: "tenant_id,feature_key" }
      );
    if (error) {
      setError(error.message);
      // Revert
      setFlags((p) => ({ ...p, [key]: !next }));
    }
    setSavingKey(null);
  };

  return (
    <div className="min-h-screen p-6" style={{ background: bg }}>
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Terug
        </button>

        <div className="rounded-3xl p-8 mb-6" style={card}>
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #c7d2fe, #a5b4fc)" }}
            >
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Modules &amp; features</h1>
              <p className="text-sm text-muted-foreground">
                Zet onderdelen aan of uit voor je hele organisatie. Wijzigingen zijn direct actief.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl p-4 mb-4 text-sm" style={{ ...card, color: "#b91c1c" }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {FEATURES.map((f) => {
              const enabled = flags[f.key] ?? f.default;
              const busy = savingKey === f.key;
              return (
                <div key={f.key} className="rounded-2xl p-5 flex items-center justify-between gap-4" style={card}>
                  <div className="min-w-0">
                    <div className="font-medium text-foreground">{f.label}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">{f.description}</div>
                  </div>
                  <button
                    onClick={() => !busy && toggle(f.key, !enabled)}
                    disabled={busy}
                    aria-pressed={enabled}
                    className="relative inline-flex shrink-0 h-7 w-12 items-center rounded-full transition-colors"
                    style={{
                      background: enabled
                        ? "linear-gradient(135deg, #6366f1, #818cf8)"
                        : "rgba(0,0,0,0.12)",
                      opacity: busy ? 0.6 : 1,
                    }}
                  >
                    <span
                      className="inline-block h-5 w-5 transform rounded-full bg-card shadow transition-transform"
                      style={{ transform: enabled ? "translateX(22px)" : "translateX(4px)" }}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsFeatures;
