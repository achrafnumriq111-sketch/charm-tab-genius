import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Brain, Sparkles, TrendingUp, TrendingDown, Cloud, Sun, CloudRain,
  Thermometer, Users, Package, DollarSign, BarChart3, Clock, Loader2,
  AlertTriangle, ShieldCheck, Zap, CalendarDays, ArrowUp, ArrowDown,
  RefreshCw, ChevronRight, Droplets, Wind, Info,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart, Line, Cell, Legend,
} from "recharts";
import type {
  NormalizedDailyWeather, NormalizedHourlyWeather, NormalizedCurrentWeather,
  WeatherSummary, LearnedCorrelation, HourlyStaffingInsight,
} from "@/lib/weather/weatherIntelligence";
import {
  generateExecutiveSummary, generateStaffingInsights, computeConfidence,
  getFallbackDaily,
} from "@/lib/weather/weatherIntelligence";
import { getSchedule, isOpenHour, getOpenHours, getTotalOpenHours, formatSchedule } from "@/lib/businessHours";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function euro(v: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(v);
}
function cn(...p: any[]) { return p.filter(Boolean).join(" "); }

function getAmsterdamNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Amsterdam" }));
}
function getAmsterdamDateStr(): string {
  const d = getAmsterdamNow();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function getAmsterdamHour(): number {
  return getAmsterdamNow().getHours();
}
function getAmsterdamDayOfWeek(): number {
  return getAmsterdamNow().getDay();
}
function formatAmsterdamTime(d: Date): string {
  return d.toLocaleTimeString("nl-NL", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit" });
}

const WEATHER_REFRESH_MS = 15 * 60 * 1000;

const SEGMENTS = [
  { key: "revenue", label: "Omzet", icon: TrendingUp },
  { key: "staffing", label: "Personeel", icon: Users },
] as const;

const RANGES = [
  { key: "7d", label: "7 dagen", days: 7 },
  { key: "14d", label: "14 dagen", days: 14 },
  { key: "30d", label: "30 dagen", days: 30 },
] as const;

type SegmentKey = typeof SEGMENTS[number]["key"];
type RangeKey = typeof RANGES[number]["key"];

// ─── Real data interfaces ────────────────────────────────────────────────────

interface DailyFact {
  date: string;
  omzet: number;
  orders_count: number;
  avg_order_value: number;
  weekday: number;
}

interface HourlyFact {
  date: string;
  local_hour: number;
  omzet: number;
  orders_count: number;
  avg_order_value: number;
  weekday: number;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function AIForecastCenter({ onToast }: { onToast?: (msg: string) => void }) {
  const [segment, setSegment] = useState<SegmentKey>("revenue");
  const [range, setRange] = useState<RangeKey>("7d");
  const [daily, setDaily] = useState<NormalizedDailyWeather[]>([]);
  const [hourly, setHourly] = useState<NormalizedHourlyWeather[]>([]);
  const [currentWeather, setCurrentWeather] = useState<NormalizedCurrentWeather | null>(null);
  const [weatherSource, setWeatherSource] = useState<"live" | "fallback">("fallback");
  const [weatherSummary, setWeatherSummary] = useState<WeatherSummary>({
    sunnyDays: 0, rainyDays: 0, avgImpact: 0, avgTemp: 11, trend: "neutral", totalDays: 0,
  });
  const [correlations, setCorrelations] = useState<LearnedCorrelation[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [liveTime, setLiveTime] = useState<Date>(new Date());
  const [weatherLoading, setWeatherLoading] = useState(false);

  // Real business data
  const [dailyFacts, setDailyFacts] = useState<DailyFact[]>([]);
  const [hourlyFacts, setHourlyFacts] = useState<HourlyFact[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const rangeDays = useMemo(() => RANGES.find(r => r.key === range)?.days || 7, [range]);

  // ─── Live clock ────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = setInterval(() => setLiveTime(new Date()), 30_000);
    return () => clearInterval(tick);
  }, []);

  // ─── Fetch weather ─────────────────────────────────────────────────────
  const fetchWeather = useCallback(async (silent = false) => {
    if (!silent) setWeatherLoading(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("apple-weatherkit", {
        body: { store: true },
      });
      if (fnErr || !data?.success) throw new Error(data?.error || "WeatherKit fetch failed");

      const todayStr = getAmsterdamDateStr();
      if (data.daily?.length) {
        const filtered = data.daily.filter((d: any) => d.date >= todayStr);
        setDaily(filtered.length > 0 ? filtered : data.daily);
        setWeatherSource("live");
      }
      if (data.hourly?.length) setHourly(data.hourly);
      if (data.current) setCurrentWeather(data.current);
      if (data.summary) {
        setWeatherSummary({
          sunnyDays: data.summary.sunny_days, rainyDays: data.summary.rainy_days,
          avgImpact: data.summary.avg_impact, avgTemp: data.summary.avg_temp,
          trend: data.summary.trend, totalDays: data.summary.total_days,
        });
      }
      setLastUpdated(new Date());
    } catch (e) {
      console.warn("WeatherKit fallback:", e);
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(() => fetchWeather(true), WEATHER_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchWeather]);

  // ─── Fetch real business data ──────────────────────────────────────────
  const fetchBusinessData = useCallback(async () => {
    setDataLoading(true);
    try {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - rangeDays);
      const sinceStr = daysAgo.toISOString().slice(0, 10);

      const [dailyRes, hourlyRes, corrRes] = await Promise.all([
        supabase.from("business_daily_facts").select("date, omzet, orders_count, avg_order_value, weekday").gte("date", sinceStr).order("date", { ascending: true }),
        supabase.from("business_hourly_facts").select("date, local_hour, omzet, orders_count, avg_order_value, weekday").gte("date", sinceStr).order("date", { ascending: true }).order("local_hour", { ascending: true }),
        supabase.from("weather_business_correlations").select("*").order("sample_size", { ascending: false }).limit(50),
      ]);

      if (dailyRes.data) setDailyFacts(dailyRes.data as DailyFact[]);
      if (hourlyRes.data) setHourlyFacts(hourlyRes.data as HourlyFact[]);
      if (corrRes.data) {
        setCorrelations(corrRes.data.map((c: any) => ({
          patternKey: c.pattern_key, scope: c.scope, category: c.category,
          sampleSize: c.sample_size, upliftPercent: c.uplift_percent,
          confidenceScore: c.confidence_score, avgOmzet: c.avg_omzet, avgOrders: c.avg_orders,
        })));
      }
    } catch (e) {
      console.warn("Business data fetch error:", e);
    } finally {
      setDataLoading(false);
    }
  }, [rangeDays]);

  useEffect(() => { fetchBusinessData(); }, [fetchBusinessData]);

  // ─── Computed stats (only from open hours) ─────────────────────────────

  // Filter hourly facts to only open hours
  const openHourlyFacts = useMemo(() => {
    return hourlyFacts.filter(h => isOpenHour(h.weekday, h.local_hour));
  }, [hourlyFacts]);

  const totalOmzet = useMemo(() => dailyFacts.reduce((s, d) => s + d.omzet, 0), [dailyFacts]);
  const totalOrders = useMemo(() => dailyFacts.reduce((s, d) => s + d.orders_count, 0), [dailyFacts]);
  const avgDailyOmzet = useMemo(() => dailyFacts.length > 0 ? totalOmzet / dailyFacts.length : 0, [dailyFacts, totalOmzet]);
  const avgOrderValue = useMemo(() => totalOrders > 0 ? totalOmzet / totalOrders : 0, [totalOmzet, totalOrders]);

  const hasData = dailyFacts.length > 0;

  const dataCompleteness = correlations.length > 0 ? Math.min(1, correlations.length / 20) : 0.1;
  const confidenceScore = computeConfidence(rangeDays, correlations, dataCompleteness);

  const executiveSummary = useMemo(() => {
    if (!hasData) return "Nog geen verkoopdata beschikbaar. Voer bestellingen in via de POS om forecasts te activeren.";
    return generateExecutiveSummary(daily, weatherSummary, totalOmzet, 0, confidenceScore, correlations);
  }, [hasData, daily, weatherSummary, totalOmzet, confidenceScore, correlations]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" /> AI Forecast & Insights
          </h2>
          <p className="text-sm text-muted-foreground">
            Weer-gestuurd • Alleen open uren • Realtime data
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchBusinessData} disabled={dataLoading} className="min-h-[44px] min-w-[44px]">
            {dataLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Segment Selector */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl overflow-x-auto">
        {SEGMENTS.map(s => (
          <button
            key={s.key}
            onClick={() => setSegment(s.key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap min-h-[44px] touch-manipulation",
              segment === s.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <s.icon className="h-3.5 w-3.5" />
            {s.label}
          </button>
        ))}
      </div>

      {/* Range Tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {RANGES.map(r => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap border min-h-[44px] touch-manipulation",
              range === r.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-primary/40"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Executive Summary */}
      <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">AI Executive Summary</div>
              <p className="text-sm leading-relaxed">{executiveSummary}</p>
            </div>
            <Badge variant="outline" className="shrink-0 text-[10px]">
              <ShieldCheck className="h-3 w-3 mr-1" /> {confidenceScore}%
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Weather Strip — LIVE */}
      <WeatherStrip
        daily={daily}
        hourly={hourly}
        currentWeather={currentWeather}
        weatherSource={weatherSource}
        weatherLoading={weatherLoading}
        liveTime={liveTime}
        lastUpdated={lastUpdated}
        fetchWeather={fetchWeather}
      />

      {/* Data Views */}
      {dataLoading && (
        <Card className="rounded-2xl">
          <CardContent className="p-12 text-center">
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary mb-4" />
            <div className="text-lg font-semibold">Data laden...</div>
          </CardContent>
        </Card>
      )}

      {!dataLoading && segment === "revenue" && (
        <RevenueView
          dailyFacts={dailyFacts}
          hourlyFacts={openHourlyFacts}
          daily={daily}
          rangeDays={rangeDays}
          totalOmzet={totalOmzet}
          totalOrders={totalOrders}
          avgDailyOmzet={avgDailyOmzet}
          avgOrderValue={avgOrderValue}
          confidenceScore={confidenceScore}
          hasData={hasData}
        />
      )}
      {!dataLoading && segment === "staffing" && (
        <StaffingView daily={daily} hourly={hourly} hourlyFacts={openHourlyFacts} hasData={hasData} />
      )}
    </div>
  );
}

// ─── Weather Strip ───────────────────────────────────────────────────────────

function WeatherStrip({
  daily, hourly, currentWeather, weatherSource, weatherLoading, liveTime, lastUpdated, fetchWeather,
}: {
  daily: NormalizedDailyWeather[];
  hourly: NormalizedHourlyWeather[];
  currentWeather: NormalizedCurrentWeather | null;
  weatherSource: "live" | "fallback";
  weatherLoading: boolean;
  liveTime: Date;
  lastUpdated: Date | null;
  fetchWeather: (silent?: boolean) => Promise<void>;
}) {
  const todayStr = getAmsterdamDateStr();
  const currentHour = getAmsterdamHour();
  const currentDow = getAmsterdamDayOfWeek();

  // Filter hourly to only OPEN hours, from now onwards
  const todayOpenHours = useMemo(() => {
    const schedule = getSchedule(currentDow);
    return hourly.filter(h =>
      h.date === todayStr &&
      h.localHour >= currentHour &&
      h.localHour >= schedule.open &&
      h.localHour < schedule.close
    );
  }, [hourly, todayStr, currentHour, currentDow]);

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Cloud className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Weer & Impact</span>
          <Badge variant={weatherSource === "live" ? "default" : "outline"} className="text-[10px] h-5 gap-1">
            {weatherSource === "live" && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>}
            {weatherSource === "live" ? "Live — WeatherKit" : "⚪ Fallback"}
          </Badge>
          {weatherLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          <div className="ml-auto flex items-center gap-2">
            {currentWeather && (
              <span className="text-xs text-muted-foreground">
                {currentWeather.icon} {currentWeather.temperatureC}° {currentWeather.conditionLabel} — {currentWeather.city}
              </span>
            )}
            <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
              {formatAmsterdamTime(liveTime)}
            </span>
            <Button variant="ghost" size="icon" className="h-6 w-6 touch-manipulation" onClick={() => fetchWeather()} disabled={weatherLoading}>
              <RefreshCw className={cn("h-3 w-3", weatherLoading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Daily strip */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {daily.slice(0, 10).map((w, i) => {
            const isToday = w.date === todayStr;
            return (
              <div key={w.date || i} className={cn(
                "flex flex-col items-center min-w-[60px] rounded-xl px-2 py-2 text-center touch-manipulation transition-all",
                isToday
                  ? "bg-primary/10 border-2 border-primary shadow-md ring-2 ring-primary/20 scale-105"
                  : "border border-border/40 bg-muted/30"
              )}>
                <span className={cn("text-[10px] font-medium", isToday ? "text-primary font-bold" : "text-muted-foreground")}>{isToday ? "Vandaag" : w.dayLabel}</span>
                <span className="text-lg leading-none my-0.5">{w.icon}</span>
                <span className={cn("text-xs font-bold", isToday && "text-primary")}>{isToday && currentWeather ? currentWeather.temperatureC : w.avgTempC}°</span>
                <span className="text-[9px] text-muted-foreground">{w.minTempC}°/{w.maxTempC}°</span>
                <span className={cn("text-[10px] font-semibold mt-0.5",
                  w.impactScore > 0 ? "text-green-600" : w.impactScore < -3 ? "text-red-500" : "text-muted-foreground"
                )}>
                  {w.impactScore > 0 ? "+" : ""}{w.impactScore}%
                </span>
                {w.confidence < 50 && <span className="text-[8px] text-muted-foreground">~</span>}
              </div>
            );
          })}
        </div>

        {/* Hourly strip — only open hours, from now onwards */}
        {todayOpenHours.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/50">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-[10px] font-medium text-muted-foreground">
                Resterende open uren ({formatSchedule(currentDow)})
              </span>
              {lastUpdated && (
                <span className="text-[9px] text-muted-foreground/60 ml-auto">
                  Bijgewerkt {formatAmsterdamTime(lastUpdated)}
                </span>
              )}
            </div>
            <div className="flex gap-1 overflow-x-auto pb-1">
              {todayOpenHours.map((h) => {
                const isCurrent = h.localHour === currentHour;
                return (
                  <div key={h.localHour} className={cn(
                    "flex flex-col items-center min-w-[40px] text-center rounded-lg px-1 py-1 transition-all",
                    isCurrent ? "bg-primary/10 border border-primary/40 ring-1 ring-primary/20" : ""
                  )}>
                    <span className={cn("text-[9px]", isCurrent ? "text-primary font-bold" : "text-muted-foreground")}>
                      {isCurrent ? "Nu" : `${h.localHour}:00`}
                    </span>
                    <span className="text-xs">{h.icon}</span>
                    <span className={cn("text-[10px] font-medium", isCurrent && "text-primary font-bold")}>{h.temperatureC}°</span>
                    {h.precipitationChance > 30 && (
                      <span className="text-[8px] text-blue-500 flex items-center gap-0.5">
                        <Droplets className="h-2 w-2" />{h.precipitationChance}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── No Data Placeholder ─────────────────────────────────────────────────────

function NoDataYet({ message }: { message: string }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-8 text-center">
        <Info className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <div className="text-sm font-medium text-muted-foreground">{message}</div>
        <p className="text-xs text-muted-foreground/60 mt-1">Zodra er verkoopdata binnenkomt, worden hier echte grafieken getoond.</p>
      </CardContent>
    </Card>
  );
}

// ─── Revenue View — REAL DATA ────────────────────────────────────────────────

function RevenueView({
  dailyFacts, hourlyFacts, daily, rangeDays, totalOmzet, totalOrders, avgDailyOmzet, avgOrderValue, confidenceScore, hasData,
}: {
  dailyFacts: DailyFact[];
  hourlyFacts: HourlyFact[];
  daily: NormalizedDailyWeather[];
  rangeDays: number;
  totalOmzet: number;
  totalOrders: number;
  avgDailyOmzet: number;
  avgOrderValue: number;
  confidenceScore: number;
  hasData: boolean;
}) {
  if (!hasData) {
    return <NoDataYet message="Nog geen omzetdata. Maak bestellingen via de POS om hier echte grafieken te zien." />;
  }

  const DAY_NAMES = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];

  // Revenue per day chart data
  const dailyChartData = dailyFacts.map(d => ({
    dag: DAY_NAMES[d.weekday] + " " + d.date.slice(5),
    omzet: Math.round(d.omzet * 100) / 100,
    orders: d.orders_count,
    gemiddeld: Math.round(d.avg_order_value * 100) / 100,
  }));

  // Revenue per hour (aggregate across all days, only open hours)
  const hourlyAgg: Record<number, { omzet: number; orders: number; count: number }> = {};
  hourlyFacts.forEach(h => {
    if (!hourlyAgg[h.local_hour]) hourlyAgg[h.local_hour] = { omzet: 0, orders: 0, count: 0 };
    hourlyAgg[h.local_hour].omzet += h.omzet;
    hourlyAgg[h.local_hour].orders += h.orders_count;
    hourlyAgg[h.local_hour].count += 1;
  });
  const hourlyChartData = Object.entries(hourlyAgg)
    .map(([hour, data]) => ({
      uur: `${hour}:00`,
      hourNum: Number(hour),
      gemOmzet: Math.round((data.omzet / data.count) * 100) / 100,
      gemOrders: Math.round((data.orders / data.count) * 10) / 10,
      totaalOmzet: Math.round(data.omzet * 100) / 100,
      dagen: data.count,
    }))
    .sort((a, b) => a.hourNum - b.hourNum);

  // Peak hour
  const peakHour = hourlyChartData.reduce((best, h) => h.gemOmzet > best.gemOmzet ? h : best, hourlyChartData[0]);
  const bestDay = dailyChartData.reduce((best, d) => d.omzet > best.omzet ? d : best, dailyChartData[0]);

  const kpis = [
    { label: "Totaal omzet", value: euro(totalOmzet), sub: `${dailyFacts.length} dagen`, icon: TrendingUp },
    { label: "Totaal orders", value: String(totalOrders), sub: `gem. ${euro(avgOrderValue)} per order`, icon: BarChart3 },
    { label: "Gem. per dag", value: euro(avgDailyOmzet), sub: `${dailyFacts.length} dagen gemeten`, icon: CalendarDays },
    { label: "Piek uur", value: peakHour?.uur || "—", sub: peakHour ? `gem. ${euro(peakHour.gemOmzet)}` : "", icon: Clock },
  ];

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k, i) => (
          <Card key={i} className="rounded-2xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{k.label}</span>
                <k.icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="text-xl font-bold">{k.value}</div>
              <span className="text-[10px] text-muted-foreground">{k.sub}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue per day */}
      {dailyChartData.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader className="p-4 pb-0">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Omzet per dag (werkelijke data)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="dag" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis yAxisId="omzet" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `€${v}`} />
                  <YAxis yAxisId="orders" orientation="right" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", fontSize: 12 }}
                    formatter={(v: number, name: string) => [name === "Omzet" ? euro(v) : v, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="omzet" dataKey="omzet" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Omzet" barSize={20} />
                  <Line yAxisId="orders" type="monotone" dataKey="orders" stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={{ r: 3 }} name="Orders" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Revenue per hour */}
      {hourlyChartData.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader className="p-4 pb-0">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" /> Gemiddelde omzet per uur (alleen open uren)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="uur" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `€${v}`} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", fontSize: 12 }}
                    formatter={(v: number, name: string) => [name.includes("Omzet") ? euro(v) : v, name]}
                  />
                  <Bar dataKey="gemOmzet" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Gem. omzet/uur" barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              <Info className="h-3 w-3" /> Alleen uren tijdens openingstijden — geen gesloten uren meegerekend
            </div>
          </CardContent>
        </Card>
      )}

      {/* Orders per hour */}
      {hourlyChartData.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader className="p-4 pb-0">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Gemiddelde orders per uur
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="uur" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", fontSize: 12 }}
                  />
                  <Bar dataKey="gemOrders" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="Gem. orders/uur" barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Staffing View — REAL DATA ───────────────────────────────────────────────

function StaffingView({
  daily, hourly, hourlyFacts, hasData,
}: {
  daily: NormalizedDailyWeather[];
  hourly: NormalizedHourlyWeather[];
  hourlyFacts: HourlyFact[];
  hasData: boolean;
}) {
  const todayDow = getAmsterdamDayOfWeek();
  const openHrs = getOpenHours(todayDow);

  // Generate staffing insights based on actual + weather data
  const staffingData = useMemo(() => {
    // Calculate avg orders per hour from real data
    const hourAvg: Record<number, { orders: number; count: number }> = {};
    hourlyFacts.forEach(h => {
      if (!hourAvg[h.local_hour]) hourAvg[h.local_hour] = { orders: 0, count: 0 };
      hourAvg[h.local_hour].orders += h.orders_count;
      hourAvg[h.local_hour].count += 1;
    });

    return openHrs.map(hour => {
      const weatherHour = hourly.find(h => h.date === daily[0]?.date && h.localHour === hour);
      const avgData = hourAvg[hour];
      const avgOrders = avgData ? avgData.orders / avgData.count : 0;

      // Base load from real data or estimate
      let baseLoad = avgOrders > 0 ? Math.min(100, avgOrders * 15) : 40;

      // Weather adjustments
      if (weatherHour) {
        if (weatherHour.precipitationChance > 50) baseLoad -= 12;
        if (weatherHour.temperatureC > 20 && weatherHour.precipitationChance < 30) baseLoad += 10;
        if (weatherHour.windSpeed > 30) baseLoad -= 8;
      }
      const day = daily[0];
      if (day?.sunny) baseLoad += 8;
      if (day?.isWeekend) baseLoad += 12;
      if (day?.isRain && hour >= 12 && hour <= 14) baseLoad -= 10;

      baseLoad = Math.max(10, Math.min(100, baseLoad));
      const staff = baseLoad > 75 ? 3 : baseLoad > 50 ? 2 : 1;
      const risk = baseLoad > 80 ? "high" as const : baseLoad > 60 ? "medium" as const : "low" as const;

      let weatherEffect = "normaal";
      if (weatherHour) {
        if (weatherHour.precipitationChance > 50) weatherEffect = "regen drukt traffic";
        else if (weatherHour.temperatureC > 22) weatherEffect = "warm weer boost";
        else if (weatherHour.windSpeed > 25) weatherEffect = "wind remt loop";
      }

      return {
        hour: `${hour}:00`,
        loadPercent: Math.round(baseLoad),
        recommendedStaff: staff,
        risk,
        weatherEffect,
        avgOrders: avgOrders > 0 ? Math.round(avgOrders * 10) / 10 : null,
        dataSource: avgOrders > 0 ? "werkelijk" : "schatting",
      };
    });
  }, [openHrs, hourlyFacts, hourly, daily]);

  const peakHour = staffingData.reduce((best, h) => h.loadPercent > best.loadPercent ? h : best, staffingData[0]);
  const totalStaffHours = staffingData.reduce((s, h) => s + h.recommendedStaff, 0);

  return (
    <div className="space-y-4">
      {!hasData && (
        <Card className="rounded-2xl border-amber-200 bg-amber-50/50">
          <CardContent className="p-3 text-sm flex items-center gap-2 text-amber-800">
            <AlertTriangle className="h-4 w-4" /> Personeel-inzichten gebaseerd op weerschattingen. Voeg verkoopdata toe voor nauwkeurigere adviezen.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Piekuur</div>
            <div className="text-xl font-bold">{peakHour?.hour}</div>
            <div className="text-xs text-muted-foreground">{peakHour?.loadPercent}% belasting</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Werkuren vandaag</div>
            <div className="text-xl font-bold">{totalStaffHours}u</div>
            <div className="text-xs text-muted-foreground">aanbevolen</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Open uren</div>
            <div className="text-xl font-bold">{formatSchedule(todayDow)}</div>
            <div className="text-xs text-muted-foreground">{getTotalOpenHours(todayDow)} uur</div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl overflow-hidden">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" /> Bezettingsadvies per uur (alleen open uren)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="space-y-1.5">
            {staffingData.map((h, i) => (
              <div key={i} className="flex items-center gap-3 min-h-[36px]">
                <span className="text-xs font-mono w-12 text-muted-foreground">{h.hour}</span>
                <div className="flex-1 h-7 rounded-lg overflow-hidden bg-muted/50 relative">
                  <div
                    className={cn(
                      "h-full rounded-lg transition-all",
                      h.risk === "high" ? "bg-destructive/70" : h.risk === "medium" ? "bg-orange-400/70" : "bg-green-500/50"
                    )}
                    style={{ width: `${h.loadPercent}%` }}
                  />
                  <span className="absolute inset-0 flex items-center px-2 text-[10px] font-medium">
                    {h.loadPercent}% — {h.recommendedStaff} pers.
                    {h.weatherEffect !== "normaal" && <span className="ml-1 text-muted-foreground">({h.weatherEffect})</span>}
                    {h.avgOrders !== null && <span className="ml-1 text-muted-foreground/60">[{h.avgOrders} ord/u]</span>}
                  </span>
                </div>
                <Badge variant="outline" className="text-[8px] shrink-0">
                  {h.dataSource === "werkelijk" ? "📊" : "🔮"}
                </Badge>
                {h.risk === "high" && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
              </div>
            ))}
          </div>
          <div className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
            <Info className="h-3 w-3" /> 📊 = gebaseerd op echte data &nbsp; 🔮 = weer-schatting
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
