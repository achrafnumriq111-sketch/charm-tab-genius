import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Download, FileText, Loader2, TrendingUp, Receipt, CreditCard, Banknote, Gift, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLocation_ } from "@/contexts/LocationContext";

type Pnl = {
  period_start: string;
  period_end: string;
  vat_rate_assumed: number;
  transactions: number;
  gross_revenue_incl_vat: number;
  vat_collected: number;
  net_revenue_excl_vat: number;
  discounts: number;
  tips: number;
  gift_card_used: number;
  avg_order_value: number;
  cash_revenue: number;
  card_revenue: number;
  other_revenue: number;
  total_collected: number;
};

type Preset = "today" | "yesterday" | "7d" | "30d" | "mtd" | "custom";

function presetRange(p: Preset, customStart?: string, customEnd?: string): { start: Date; end: Date } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  switch (p) {
    case "today": {
      const s = startOfDay(now);
      const e = new Date(s); e.setDate(e.getDate() + 1);
      return { start: s, end: e };
    }
    case "yesterday": {
      const e = startOfDay(now);
      const s = new Date(e); s.setDate(s.getDate() - 1);
      return { start: s, end: e };
    }
    case "7d": {
      const e = startOfDay(now); e.setDate(e.getDate() + 1);
      const s = new Date(e); s.setDate(s.getDate() - 7);
      return { start: s, end: e };
    }
    case "30d": {
      const e = startOfDay(now); e.setDate(e.getDate() + 1);
      const s = new Date(e); s.setDate(s.getDate() - 30);
      return { start: s, end: e };
    }
    case "mtd": {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      const e = startOfDay(now); e.setDate(e.getDate() + 1);
      return { start: s, end: e };
    }
    case "custom": {
      const s = customStart ? new Date(customStart) : startOfDay(now);
      const e = customEnd ? new Date(customEnd) : new Date(s.getTime() + 86400000);
      e.setDate(e.getDate() + 1); // inclusive end day
      return { start: s, end: e };
    }
  }
}

const fmtEUR = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n || 0);

const Reports: React.FC = () => {
  const navigate = useNavigate();
  const { activeLocation, locations, loading: locLoading } = useLocation_();
  const [preset, setPreset] = useState<Preset>("7d");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");
  const [vatRate, setVatRate] = useState<number>(9);
  const [data, setData] = useState<Pnl | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const range = useMemo(() => presetRange(preset, customStart, customEnd), [preset, customStart, customEnd]);

  useEffect(() => {
    if (!activeLocation) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      const { data: result, error: err } = await supabase.rpc("report_pnl", {
        _location_id: activeLocation.id,
        _start: range.start.toISOString(),
        _end: range.end.toISOString(),
        _vat_rate: vatRate,
      });
      if (cancelled) return;
      if (err) {
        setError(err.message);
        setData(null);
      } else {
        setData(result as unknown as Pnl);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [activeLocation, range.start.getTime(), range.end.getTime(), vatRate]);

  const downloadCsv = async (format: "moneybird" | "exact" | "generic") => {
    if (!activeLocation) return;
    const sess = await supabase.auth.getSession();
    const token = sess.data.session?.access_token;
    if (!token) {
      setError("Niet ingelogd");
      return;
    }
    const params = new URLSearchParams({
      location_id: activeLocation.id,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      format,
      vat_rate: String(vatRate),
    });
    const baseUrl = (import.meta as any).env.VITE_SUPABASE_URL as string;
    const res = await fetch(`${baseUrl}/functions/v1/accounting-export?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const txt = await res.text();
      setError(`Export mislukt: ${txt}`);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pnl_${format}_${range.start.toISOString().slice(0,10)}_${range.end.toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const StatCard = ({ icon: Icon, label, value, sub, accent }: any) => (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-4"
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(247,249,255,0.85))",
        border: "1px solid rgba(255,255,255,0.7)",
        boxShadow: "inset 0 1px 1px rgba(255,255,255,0.85), 0 8px 28px rgba(160,175,219,0.10)",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: accent || "rgba(172,155,255,0.15)", color: "#7c6bc4" }}
        >
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8b8b9e" }}>{label}</span>
      </div>
      <div className="text-xl font-bold" style={{ color: "#2a2a3a" }}>{value}</div>
      {sub && <div className="text-[11px] mt-0.5" style={{ color: "#9b9bab" }}>{sub}</div>}
    </motion.div>
  );

  return (
    <div
      className="min-h-screen p-4 sm:p-6"
      style={{
        background:
          "radial-gradient(ellipse at 20% 20%, rgba(205,216,255,0.35), transparent 50%), " +
          "radial-gradient(ellipse at 80% 30%, rgba(255,206,236,0.25), transparent 50%), " +
          "linear-gradient(180deg, #f0f2f8 0%, #e8ecf4 100%)",
      }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(0,0,0,0.06)" }}
          >
            <ArrowLeft className="w-4 h-4" style={{ color: "#5a5a72" }} />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight" style={{ color: "#2a2a3a" }}>
              Rapportage & Boekhouding
            </h1>
            <p className="text-xs" style={{ color: "#9b9bab" }}>
              {activeLocation?.name || "—"} · winst- & verliesoverzicht en exports
            </p>
          </div>
        </div>

        {/* Filters */}
        <div
          className="rounded-2xl p-4 mb-6 flex flex-wrap items-center gap-3"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(247,249,255,0.85))",
            border: "1px solid rgba(255,255,255,0.7)",
            boxShadow: "inset 0 1px 1px rgba(255,255,255,0.85), 0 8px 28px rgba(160,175,219,0.10)",
          }}
        >
          <div className="flex flex-wrap gap-1.5">
            {([
              ["today", "Vandaag"],
              ["yesterday", "Gisteren"],
              ["7d", "7 dagen"],
              ["30d", "30 dagen"],
              ["mtd", "Deze maand"],
              ["custom", "Periode"],
            ] as [Preset, string][]).map(([key, label]) => {
              const active = preset === key;
              return (
                <button
                  key={key}
                  onClick={() => setPreset(key)}
                  className="px-3 h-9 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: active ? "linear-gradient(135deg, rgba(172,155,255,0.85), rgba(140,120,220,0.9))" : "rgba(0,0,0,0.04)",
                    color: active ? "#fff" : "#5a5a72",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {preset === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-9 px-2 rounded-lg text-xs outline-none"
                style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(0,0,0,0.06)" }}
              />
              <span className="text-xs" style={{ color: "#9b9bab" }}>→</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-9 px-2 rounded-lg text-xs outline-none"
                style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(0,0,0,0.06)" }}
              />
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            <label className="text-[11px] font-medium" style={{ color: "#8b8b9e" }}>BTW%</label>
            <select
              value={vatRate}
              onChange={(e) => setVatRate(Number(e.target.value))}
              className="h-9 px-2 rounded-lg text-xs outline-none"
              style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(0,0,0,0.06)" }}
            >
              <option value={9}>9% (voeding & drank)</option>
              <option value={21}>21% (retail & overig)</option>
              <option value={0}>0% (geen)</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="rounded-xl px-4 py-3 mb-4 text-xs" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)", color: "#dc2626" }}>
            {error}
          </div>
        )}

        {loading || locLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#7c6bc4" }} />
          </div>
        ) : data ? (
          <>
            {/* Headline P&L */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <StatCard icon={TrendingUp} label="Bruto omzet (incl)" value={fmtEUR(data.gross_revenue_incl_vat)} sub={`${data.transactions} transacties`} accent="rgba(34,197,94,0.15)" />
              <StatCard icon={Receipt} label="Netto omzet (excl)" value={fmtEUR(data.net_revenue_excl_vat)} sub={`Bij ${data.vat_rate_assumed}% BTW`} accent="rgba(59,130,246,0.15)" />
              <StatCard icon={FileText} label="BTW geheven" value={fmtEUR(data.vat_collected)} accent="rgba(245,158,11,0.15)" />
              <StatCard icon={TrendingUp} label="Gem. orderwaarde" value={fmtEUR(data.avg_order_value)} accent="rgba(172,155,255,0.18)" />
            </div>

            {/* Payment split */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <StatCard icon={Banknote} label="Contant" value={fmtEUR(data.cash_revenue)} accent="rgba(34,197,94,0.15)" />
              <StatCard icon={CreditCard} label="Kaart / PIN" value={fmtEUR(data.card_revenue)} accent="rgba(59,130,246,0.15)" />
              <StatCard icon={Tag} label="Kortingen" value={fmtEUR(data.discounts)} accent="rgba(239,68,68,0.12)" />
              <StatCard icon={Gift} label="Cadeaubonnen" value={fmtEUR(data.gift_card_used)} accent="rgba(245,158,11,0.15)" />
            </div>

            {/* Export buttons */}
            <div
              className="rounded-2xl p-5"
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(247,249,255,0.85))",
                border: "1px solid rgba(255,255,255,0.7)",
                boxShadow: "inset 0 1px 1px rgba(255,255,255,0.85), 0 8px 28px rgba(160,175,219,0.10)",
              }}
            >
              <h2 className="text-sm font-bold mb-1" style={{ color: "#2a2a3a" }}>Boekhouding-export</h2>
              <p className="text-[11px] mb-4" style={{ color: "#9b9bab" }}>
                Eén regel per transactie, met BTW-splitsing op basis van het gekozen tarief.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: "moneybird" as const, name: "Moneybird CSV", desc: "Direct importeerbaar in Moneybird" },
                  { id: "exact" as const, name: "Exact Online CSV", desc: "GLAccount 8000, BTW-code" },
                  { id: "generic" as const, name: "Generiek CSV", desc: "Alle velden incl. fooi & cadeau" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => downloadCsv(opt.id)}
                    className="text-left p-3 rounded-xl transition-all hover:scale-[1.01]"
                    style={{
                      background: "rgba(172,155,255,0.08)",
                      border: "1px solid rgba(172,155,255,0.2)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold" style={{ color: "#2a2a3a" }}>{opt.name}</span>
                      <Download className="w-4 h-4" style={{ color: "#7c6bc4" }} />
                    </div>
                    <span className="text-[11px]" style={{ color: "#9b9bab" }}>{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Multi-location aggregate hint */}
            {locations.length > 1 && (
              <div className="mt-4 text-[11px] text-center" style={{ color: "#9b9bab" }}>
                Wissel van locatie via de locatie-switcher voor cross-locatie rapportage.
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12 text-sm" style={{ color: "#9b9bab" }}>Geen data voor deze periode.</div>
        )}
      </div>
    </div>
  );
};

export default Reports;
