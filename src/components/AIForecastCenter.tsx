import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Brain, TrendingUp, TrendingDown, Cloud, Sun, CloudRain,
  Thermometer, Users, Package, DollarSign, BarChart3, Clock, Loader2,
  AlertTriangle, ShieldCheck, Zap, CalendarDays, ArrowUp, ArrowDown,
  RefreshCw, Droplets, Wind, Info, Tag, Minus,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart, Line, Legend, Cell,
} from "recharts";
import type {
  NormalizedDailyWeather, NormalizedHourlyWeather, NormalizedCurrentWeather,
  WeatherSummary,
} from "@/lib/weather/weatherIntelligence";
import {
  getSchedule, isOpenHour, getOpenHours, getTotalOpenHours, formatSchedule,
  normalizeSchedule, getDefaultSchedule, type LocationSchedule,
} from "@/lib/businessHours";
import { useLocation_ } from "@/contexts/LocationContext";

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
function getAmsterdamHour(): number { return getAmsterdamNow().getHours(); }
function getAmsterdamDayOfWeek(): number { return getAmsterdamNow().getDay(); }
function formatAmsterdamTime(d: Date): string {
  return d.toLocaleTimeString("nl-NL", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit" });
}

const WEATHER_REFRESH_MS = 15 * 60 * 1000;
const DAY_LABELS = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];

const SEGMENTS = [
  { key: "revenue", label: "Omzet", icon: TrendingUp },
  { key: "product", label: "Product", icon: Package },
  { key: "stock", label: "Voorraad", icon: BarChart3 },
  { key: "staffing", label: "Personeel", icon: Users },
  { key: "pricing", label: "Prijsadvies", icon: Tag },
] as const;

const RANGES = [
  { key: "7d", label: "7 dagen", days: 7 },
  { key: "14d", label: "14 dagen", days: 14 },
  { key: "30d", label: "30 dagen", days: 30 },
] as const;

type SegmentKey = typeof SEGMENTS[number]["key"];
type RangeKey = typeof RANGES[number]["key"];

// ─── Main Component ─────────────────────────────────────────────────────────

export function AIForecastCenter({ onToast }: { onToast?: (msg: string) => void }) {
  const [segment, setSegment] = useState<SegmentKey>("revenue");
  const [range, setRange] = useState<RangeKey>("7d");

  // Per-location opening hours (drives "open hours only" forecast logic)
  const { activeLocation } = useLocation_();
  const [schedule, setSchedule] = useState<LocationSchedule>(() => getDefaultSchedule());
  useEffect(() => {
    const locId = activeLocation?.id;
    if (!locId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("location_settings")
        .select("opening_hours")
        .eq("location_id", locId)
        .maybeSingle();
      if (cancelled) return;
      setSchedule(normalizeSchedule((data as any)?.opening_hours));
    })();
    return () => { cancelled = true; };
  }, [activeLocation?.id]);

  // Weather state
  const [daily, setDaily] = useState<NormalizedDailyWeather[]>([]);
  const [hourly, setHourly] = useState<NormalizedHourlyWeather[]>([]);
  const [currentWeather, setCurrentWeather] = useState<NormalizedCurrentWeather | null>(null);
  const [weatherSource, setWeatherSource] = useState<"live" | "fallback">("fallback");
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [liveTime, setLiveTime] = useState<Date>(new Date());

  // Forecast data from edge function
  const [forecastData, setForecastData] = useState<any>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);

  const rangeDays = useMemo(() => RANGES.find(r => r.key === range)?.days || 7, [range]);

  // Live clock
  useEffect(() => {
    const tick = setInterval(() => setLiveTime(new Date()), 30_000);
    return () => clearInterval(tick);
  }, []);

  // Fetch weather
  const fetchWeather = useCallback(async (silent = false) => {
    if (!silent) setWeatherLoading(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("apple-weatherkit", { body: { store: true } });
      if (fnErr || !data?.success) throw new Error(data?.error || "WeatherKit fetch failed");
      const todayStr = getAmsterdamDateStr();
      if (data.daily?.length) {
        const filtered = data.daily.filter((d: any) => d.date >= todayStr);
        setDaily(filtered.length > 0 ? filtered : data.daily);
        setWeatherSource("live");
      }
      if (data.hourly?.length) setHourly(data.hourly);
      if (data.current) setCurrentWeather(data.current);
      setLastUpdated(new Date());
    } catch (e) {
      console.warn("WeatherKit:", e);
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(() => fetchWeather(true), WEATHER_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchWeather]);

  // Fetch forecast data from edge function
  const fetchForecast = useCallback(async () => {
    setForecastLoading(true);
    setForecastError(null);
    try {
      const { data, error } = await supabase.functions.invoke("inventory-forecast", {
        body: { type: segment, range: rangeDays },
      });
      if (error) throw new Error("Forecast ophalen mislukt");
      if (data?.error) throw new Error(data.error);
      setForecastData(data?.data || null);
    } catch (e: any) {
      setForecastError(e.message);
      setForecastData(null);
    } finally {
      setForecastLoading(false);
    }
  }, [segment, rangeDays]);

  useEffect(() => { fetchForecast(); }, [fetchForecast]);

  const dataQuality = forecastData?.dataQuality;
  const hasData = dataQuality && (dataQuality.dailyFactDays > 0 || dataQuality.transactionCount > 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" /> AI Forecast & Insights
          </h2>
          <p className="text-sm text-muted-foreground">
            Weer-gestuurd • Alleen open uren • Live data
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchForecast} disabled={forecastLoading} className="min-h-[44px]">
          {forecastLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* Segment Selector */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl overflow-x-auto">
        {SEGMENTS.map(s => (
          <button key={s.key} onClick={() => setSegment(s.key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap min-h-[44px] touch-manipulation",
              segment === s.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}>
            <s.icon className="h-3.5 w-3.5" />{s.label}
          </button>
        ))}
      </div>

      {/* Range Tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {RANGES.map(r => (
          <button key={r.key} onClick={() => setRange(r.key)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap border min-h-[44px] touch-manipulation",
              range === r.key ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary/40"
            )}>
            {r.label}
          </button>
        ))}
      </div>

      {/* Weather Strip */}
      <WeatherStrip daily={daily} hourly={hourly} currentWeather={currentWeather}
        weatherSource={weatherSource} weatherLoading={weatherLoading} liveTime={liveTime}
        lastUpdated={lastUpdated} fetchWeather={fetchWeather} schedule={schedule} />

      {/* Content */}
      {forecastLoading && (
        <Card className="rounded-2xl"><CardContent className="p-12 text-center">
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary mb-4" />
          <div className="text-lg font-semibold">Data laden...</div>
        </CardContent></Card>
      )}

      {forecastError && !forecastLoading && (
        <Card className="rounded-2xl border-destructive/30"><CardContent className="p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-destructive">{forecastError}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={fetchForecast}>Opnieuw proberen</Button>
        </CardContent></Card>
      )}

      {!forecastLoading && !forecastError && forecastData && (
        <>
          {segment === "revenue" && <RevenueTab data={forecastData} rangeDays={rangeDays} daily={daily} />}
          {segment === "product" && <ProductTab data={forecastData} rangeDays={rangeDays} />}
          {segment === "stock" && <StockTab data={forecastData} />}
          {segment === "staffing" && <StaffingTab data={forecastData} daily={daily} hourly={hourly} schedule={schedule} />}
          {segment === "pricing" && <PricingTab data={forecastData} />}
        </>
      )}
    </div>
  );
}

// ─── Weather Strip ───────────────────────────────────────────────────────────

function WeatherStrip({ daily, hourly, currentWeather, weatherSource, weatherLoading, liveTime, lastUpdated, fetchWeather }: {
  daily: NormalizedDailyWeather[]; hourly: NormalizedHourlyWeather[];
  currentWeather: NormalizedCurrentWeather | null; weatherSource: "live" | "fallback";
  weatherLoading: boolean; liveTime: Date; lastUpdated: Date | null;
  fetchWeather: (silent?: boolean) => Promise<void>;
}) {
  const todayStr = getAmsterdamDateStr();
  const currentHour = getAmsterdamHour();
  const currentDow = getAmsterdamDayOfWeek();

  const todayOpenHours = useMemo(() => {
    const schedule = getSchedule(currentDow);
    return hourly.filter(h => h.date === todayStr && h.localHour >= currentHour && h.localHour >= schedule.open && h.localHour < schedule.close);
  }, [hourly, todayStr, currentHour, currentDow]);

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Cloud className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Weer & Impact</span>
          <Badge variant={weatherSource === "live" ? "default" : "outline"} className="text-[10px] h-5 gap-1">
            {weatherSource === "live" && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>}
            {weatherSource === "live" ? "Live — WeatherKit" : "⚪ Laden..."}
          </Badge>
          {weatherLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          <div className="ml-auto flex items-center gap-2">
            {currentWeather && (
              <span className="text-xs text-muted-foreground">
                {currentWeather.icon} {currentWeather.temperatureC}° {currentWeather.conditionLabel}
              </span>
            )}
            <span className="text-[10px] font-mono text-muted-foreground tabular-nums">{formatAmsterdamTime(liveTime)}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6 touch-manipulation" onClick={() => fetchWeather()} disabled={weatherLoading}>
              <RefreshCw className={cn("h-3 w-3", weatherLoading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {daily.length === 0 && weatherLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
            <span className="text-sm text-muted-foreground">Weerdata ophalen...</span>
          </div>
        )}
        {daily.length === 0 && !weatherLoading && (
          <div className="text-center py-3 text-sm text-muted-foreground">Weerdata tijdelijk niet beschikbaar.</div>
        )}
        {daily.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {daily.slice(0, 10).map((w, i) => {
              const isToday = w.date === todayStr;
              return (
                <div key={w.date || i} className={cn(
                  "flex flex-col items-center min-w-[60px] rounded-xl px-2 py-2 text-center transition-all",
                  isToday ? "bg-card border border-foreground/20 shadow-sm" : "border border-border/40 bg-muted/30"
                )}>
                  <span className={cn("text-[10px] font-medium", isToday ? "text-primary font-bold" : "text-muted-foreground")}>{isToday ? "Vandaag" : w.dayLabel}</span>
                  <span className="text-lg leading-none my-0.5">{w.icon}</span>
                  <span className={cn("text-xs font-bold", isToday && "text-primary")}>{isToday && currentWeather ? currentWeather.temperatureC : w.avgTempC}°</span>
                  <span className="text-[9px] text-muted-foreground">{w.minTempC}°/{w.maxTempC}°</span>
                  <span className={cn("text-[10px] font-semibold mt-0.5",
                    w.impactScore > 0 ? "text-green-600" : w.impactScore < -3 ? "text-red-500" : "text-muted-foreground"
                  )}>{w.impactScore > 0 ? "+" : ""}{w.impactScore}%</span>
                </div>
              );
            })}
          </div>
        )}

        {todayOpenHours.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/50">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-[10px] font-medium text-muted-foreground">Resterende open uren ({formatSchedule(currentDow)})</span>
            </div>
            <div className="flex gap-1 overflow-x-auto pb-1">
              {todayOpenHours.map((h) => {
                const isCurrent = h.localHour === currentHour;
                return (
                  <div key={h.localHour} className={cn(
                    "flex flex-col items-center min-w-[40px] text-center rounded-lg px-1 py-1 transition-all",
                    isCurrent ? "bg-card border border-foreground/20 shadow-sm" : ""
                  )}>
                    <span className={cn("text-[9px]", isCurrent ? "text-foreground font-semibold" : "text-muted-foreground")}>{isCurrent ? "Nu" : `${h.localHour}:00`}</span>
                    <span className="text-xs">{h.icon}</span>
                    <span className={cn("text-[10px] font-medium")}>{h.temperatureC}°</span>
                    {h.precipitationChance > 30 && <span className="text-[8px] text-blue-500 flex items-center gap-0.5"><Droplets className="h-2 w-2" />{h.precipitationChance}%</span>}
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

// ─── No Data Component ───────────────────────────────────────────────────────

function NoData({ message, details }: { message: string; details?: string }) {
  return (
    <Card className="rounded-2xl"><CardContent className="p-8 text-center">
      <Info className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
      <div className="text-sm font-medium text-muted-foreground">{message}</div>
      {details && <p className="text-xs text-muted-foreground/60 mt-1">{details}</p>}
    </CardContent></Card>
  );
}

function ConfidenceBadge({ level, score }: { level?: string; score?: number }) {
  const color = level === "high" ? "text-green-600" : level === "medium" ? "text-amber-600" : "text-red-500";
  const label = level === "high" ? "Hoog" : level === "medium" ? "Gemiddeld" : "Laag";
  return (
    <Badge variant="outline" className={cn("text-[10px] shrink-0", color)}>
      <ShieldCheck className="h-3 w-3 mr-1" />{score !== undefined ? `${score}%` : label}
    </Badge>
  );
}

function DataQualityNote({ dq }: { dq: any }) {
  if (!dq) return null;
  const notes: string[] = [];
  if (dq.dailyFactDays < 7) notes.push(`${dq.dailyFactDays} dagen verkoopdata`);
  if (dq.transactionCount === 0) notes.push("Geen transacties");
  if (!dq.hasStaffing) notes.push("Geen personeelsdata");
  if (dq.weatherDays < 3) notes.push("Beperkte weerhistorie");
  if (notes.length === 0) return null;
  return (
    <Card className="rounded-2xl border-amber-200 bg-amber-50/50"><CardContent className="p-3 text-xs flex items-start gap-2 text-amber-800">
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      <div><span className="font-medium">Beperkte data:</span> {notes.join(" • ")}</div>
    </CardContent></Card>
  );
}

// ─── Revenue Tab ─────────────────────────────────────────────────────────────

function RevenueTab({ data, rangeDays, daily }: { data: any; rangeDays: number; daily: NormalizedDailyWeather[] }) {
  if (!data?.weekdayPatterns?.length && !data?.hourlyPatterns?.length) {
    return <NoData message="Nog niet genoeg data voor betrouwbare omzetforecast." details="Voer bestellingen in via de POS om hier echte grafieken te zien." />;
  }

  const weekdayData = (data.weekdayPatterns || []).map((p: any) => ({
    dag: DAY_LABELS[p.weekday],
    gemOmzet: Math.round(p.avgOmzet * 100) / 100,
    gemOrders: Math.round(p.avgOrders * 10) / 10,
    samples: p.sampleSize,
  }));

  const hourlyData = (data.hourlyPatterns || []).map((p: any) => ({
    uur: `${p.hour}:00`,
    gemOmzet: Math.round(p.avgOmzet * 100) / 100,
    gemOrders: Math.round(p.avgOrders * 10) / 10,
    samples: p.sampleSize,
  }));

  const trend = data.trendPct || 0;
  const recentAvg = data.recentAvgDaily || 0;
  const forecastTotal = Math.round(recentAvg * rangeDays * (1 + trend / 200) * 100) / 100;
  const totalDays = data.totalDays || 0;

  // Confidence
  const confidence = totalDays >= 21 ? "high" : totalDays >= 7 ? "medium" : "low";
  const confScore = totalDays >= 21 ? 80 : totalDays >= 14 ? 65 : totalDays >= 7 ? 50 : 30;

  // Weather forecast integration
  const weatherNotes: string[] = [];
  const upcomingWeather = data.upcomingWeather || [];
  const rainyDays = upcomingWeather.filter((w: any) => w.is_rain);
  const warmDays = upcomingWeather.filter((w: any) => (w.avg_temp_c ?? 15) > 20);
  if (rainyDays.length > 0) weatherNotes.push(`${rainyDays.length} regendag${rainyDays.length > 1 ? "en" : ""} verwacht — omzet mogelijk lager`);
  if (warmDays.length > 0) weatherNotes.push(`${warmDays.length} warme dag${warmDays.length > 1 ? "en" : ""} — positief voor verkoop`);

  // Best / worst weekday
  const bestDay = weekdayData.reduce((b: any, d: any) => d.gemOmzet > b.gemOmzet ? d : b, weekdayData[0]);
  const worstDay = weekdayData.reduce((w: any, d: any) => d.gemOmzet < w.gemOmzet ? d : w, weekdayData[0]);

  // Summary
  const summaryParts: string[] = [];
  summaryParts.push(`Verwachte omzet komende ${rangeDays} dagen: ${euro(forecastTotal)} (op basis van ${totalDays} dagen historische data).`);
  if (trend > 3) summaryParts.push(`Stijgende trend van +${trend}%.`);
  else if (trend < -3) summaryParts.push(`Dalende trend van ${trend}%.`);
  if (bestDay) summaryParts.push(`${bestDay.dag} is historisch de sterkste dag (gem. ${euro(bestDay.gemOmzet)}).`);
  weatherNotes.forEach(n => summaryParts.push(n));
  if (confidence === "low") summaryParts.push("Betrouwbaarheid laag — meer data nodig voor nauwkeurigere forecasts.");

  const kpis = [
    { label: "Forecast totaal", value: euro(forecastTotal), sub: `${rangeDays} dagen`, icon: TrendingUp },
    { label: "Gem. per dag", value: euro(recentAvg), sub: `${totalDays} dagen gemeten`, icon: CalendarDays },
    { label: "Trend", value: `${trend > 0 ? "+" : ""}${trend}%`, sub: "recent vs eerder", icon: trend >= 0 ? ArrowUp : ArrowDown },
    { label: "Sterkste dag", value: bestDay?.dag || "—", sub: bestDay ? euro(bestDay.gemOmzet) : "", icon: Zap },
  ];

  return (
    <div className="space-y-4">
      <DataQualityNote dq={data.dataQuality} />

      {/* Executive Summary */}
      <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">Omzet Forecast</div>
              <p className="text-sm leading-relaxed">{summaryParts.join(" ")}</p>
            </div>
            <ConfidenceBadge level={confidence} score={confScore} />
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k, i) => (
          <Card key={i} className="rounded-2xl"><CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{k.label}</span>
              <k.icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="text-xl font-bold">{k.value}</div>
            <span className="text-[10px] text-muted-foreground">{k.sub}</span>
          </CardContent></Card>
        ))}
      </div>

      {/* Weekday chart */}
      {weekdayData.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader className="p-4 pb-0"><CardTitle className="text-sm flex items-center gap-2">
            <CalendarDays className="h-4 w-4" /> Gemiddelde omzet per weekdag
          </CardTitle></CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={weekdayData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="dag" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis yAxisId="omzet" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `€${v}`} />
                  <YAxis yAxisId="orders" orientation="right" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", fontSize: 12 }}
                    formatter={(v: number, name: string) => [name === "Omzet" ? euro(v) : v, name]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="omzet" dataKey="gemOmzet" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Omzet" barSize={24} />
                  <Line yAxisId="orders" type="monotone" dataKey="gemOrders" stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={{ r: 3 }} name="Orders" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              <Info className="h-3 w-3" /> Gemiddelden per weekdag op basis van {totalDays} dagen werkelijke data
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hourly chart */}
      {hourlyData.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader className="p-4 pb-0"><CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" /> Gemiddelde omzet per uur (alleen open uren)
          </CardTitle></CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="uur" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `€${v}`} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", fontSize: 12 }}
                    formatter={(v: number) => [euro(v), "Gem. omzet"]} />
                  <Bar dataKey="gemOmzet" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Product Tab ─────────────────────────────────────────────────────────────

function ProductTab({ data, rangeDays }: { data: any; rangeDays: number }) {
  const products = data?.products || [];
  if (products.length === 0) {
    return <NoData message="Nog niet genoeg productdata voor een betrouwbare forecast." details="Maak bestellingen via de POS om producttrends te zien." />;
  }

  const totalDays = data.totalDays || 1;
  const topProducts = products.slice(0, 15);

  // Compute forecast per product
  const forecastProducts = topProducts.map((p: any) => {
    const forecast = Math.round(p.avgDaily * rangeDays);
    return { ...p, forecast };
  });

  const chartData = forecastProducts.slice(0, 10).map((p: any) => ({
    naam: p.name.length > 16 ? p.name.slice(0, 14) + "…" : p.name,
    verkocht: p.totalQty,
    forecast: p.forecast,
  }));

  return (
    <div className="space-y-4">
      <DataQualityNote dq={data.dataQuality} />

      <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Package className="h-4 w-4 text-primary" /></div>
            <div className="flex-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">Product Forecast</div>
              <p className="text-sm leading-relaxed">
                {products.length} producten geanalyseerd over {totalDays} verkoopdagen.
                {topProducts[0] && ` ${topProducts[0].name} is het meest verkocht (${topProducts[0].totalQty} stuks, gem. ${topProducts[0].avgDaily}/dag).`}
                {totalDays < 7 && " Meer data nodig voor betrouwbare trends."}
              </p>
            </div>
            <ConfidenceBadge level={totalDays >= 14 ? "high" : totalDays >= 5 ? "medium" : "low"} />
          </div>
        </CardContent>
      </Card>

      {chartData.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader className="p-4 pb-0"><CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Top producten — verkocht vs forecast ({rangeDays}d)
          </CardTitle></CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 60, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis type="category" dataKey="naam" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={70} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="verkocht" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Historisch verkocht" barSize={12} />
                  <Bar dataKey="forecast" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} name={`Forecast ${rangeDays}d`} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Product table */}
      <Card className="rounded-2xl">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Productoverzicht</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border">
                <th className="text-left py-2 font-medium text-muted-foreground">Product</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Verkocht</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Gem/dag</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Omzet</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Forecast {rangeDays}d</th>
              </tr></thead>
              <tbody>
                {forecastProducts.map((p: any, i: number) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2 font-medium max-w-[150px] truncate">{p.name}</td>
                    <td className="text-right py-2">{p.totalQty}</td>
                    <td className="text-right py-2">{p.avgDaily}</td>
                    <td className="text-right py-2">{euro(p.totalRevenue)}</td>
                    <td className="text-right py-2 font-semibold">{p.forecast}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Stock Tab ───────────────────────────────────────────────────────────────

function StockTab({ data }: { data: any }) {
  const items = data?.items || [];
  if (items.length === 0) {
    return <NoData message="Geen voorraaddata beschikbaar." details="Voeg voorraadartikelen toe om stockforecasts te zien." />;
  }

  const highRisk = data.highRisk || 0;
  const mediumRisk = data.mediumRisk || 0;

  return (
    <div className="space-y-4">
      <DataQualityNote dq={data.dataQuality} />

      <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Package className="h-4 w-4 text-primary" /></div>
            <div className="flex-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">Voorraad Forecast</div>
              <p className="text-sm leading-relaxed">
                {items.length} artikelen geanalyseerd.
                {highRisk > 0 && ` ⚠️ ${highRisk} artikel${highRisk > 1 ? "en" : ""} met hoog risico op tekort.`}
                {mediumRisk > 0 && ` ${mediumRisk} met gemiddeld risico.`}
                {highRisk === 0 && mediumRisk === 0 && " Alle voorraden op niveau."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="rounded-2xl"><CardContent className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Artikelen</div>
          <div className="text-xl font-bold">{items.length}</div>
        </CardContent></Card>
        <Card className="rounded-2xl border-destructive/30"><CardContent className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-destructive font-medium mb-1">Hoog risico</div>
          <div className="text-xl font-bold text-destructive">{highRisk}</div>
        </CardContent></Card>
        <Card className="rounded-2xl border-amber-300/50"><CardContent className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-amber-600 font-medium mb-1">Gemiddeld risico</div>
          <div className="text-xl font-bold text-amber-600">{mediumRisk}</div>
        </CardContent></Card>
      </div>

      {/* Items table */}
      <Card className="rounded-2xl">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Voorraad per artikel</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border">
                <th className="text-left py-2 font-medium text-muted-foreground">Artikel</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Voorraad</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Gem/dag</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Dagen over</th>
                <th className="text-right py-2 font-medium text-muted-foreground">7d behoefte</th>
                <th className="text-center py-2 font-medium text-muted-foreground">Risico</th>
              </tr></thead>
              <tbody>
                {items.map((item: any, i: number) => (
                  <tr key={i} className={cn("border-b border-border/50", item.risk === "high" && "bg-destructive/5")}>
                    <td className="py-2 font-medium max-w-[140px] truncate">{item.name}</td>
                    <td className="text-right py-2">{item.currentStock} {item.unit}</td>
                    <td className="text-right py-2">{item.avgDailyUsage}</td>
                    <td className="text-right py-2 font-semibold">{item.daysRemaining > 100 ? "100+" : item.daysRemaining}</td>
                    <td className="text-right py-2">{item.demand7d}</td>
                    <td className="text-center py-2">
                      <Badge variant={item.risk === "high" ? "destructive" : item.risk === "medium" ? "outline" : "secondary"} className="text-[10px]">
                        {item.risk === "high" ? "Hoog" : item.risk === "medium" ? "Gemiddeld" : "Laag"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {items.some((i: any) => i.movementDays <= 1) && (
            <div className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
              <Info className="h-3 w-3" /> Sommige artikelen hebben weinig bewegingshistorie — schattingen kunnen onnauwkeurig zijn
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Staffing Tab ────────────────────────────────────────────────────────────

function StaffingTab({ data, daily, hourly }: { data: any; daily: NormalizedDailyWeather[]; hourly: NormalizedHourlyWeather[] }) {
  const patterns = data?.patterns || [];
  const hasStaffData = data?.hasStaffData || false;
  const todayDow = getAmsterdamDayOfWeek();
  const openHrs = getOpenHours(todayDow);

  // Filter patterns for today's weekday
  const todayPatterns = patterns
    .filter((p: any) => p.weekday === todayDow)
    .sort((a: any, b: any) => a.hour - b.hour);

  // Get weather for today
  const todayWeather = daily.find(d => d.date === getAmsterdamDateStr());

  // Build hourly staffing view
  const staffHours = openHrs.map(hour => {
    const pattern = todayPatterns.find((p: any) => p.hour === hour);
    const weatherHr = hourly.find(h => h.date === getAmsterdamDateStr() && h.localHour === hour);

    let avgOrders = pattern?.avgOrders ?? 0;
    let weatherNote = "";

    // Weather adjustments
    if (weatherHr) {
      if (weatherHr.precipitationChance > 60) { avgOrders *= 0.85; weatherNote = "Regen"; }
      if (weatherHr.temperatureC > 22 && weatherHr.precipitationChance < 30) { avgOrders *= 1.1; weatherNote = "Warm"; }
      if (weatherHr.windSpeed > 30) { avgOrders *= 0.92; weatherNote += (weatherNote ? " + " : "") + "Wind"; }
    }
    if (todayWeather?.sunny && !weatherNote) weatherNote = "Zon";

    const recommended = avgOrders > 0 ? Math.max(1, Math.ceil(avgOrders / 10)) : 1;
    const loadPct = avgOrders > 0 ? Math.min(100, Math.round(avgOrders * 8)) : 0;
    const hasData = !!pattern;

    return { hour, avgOrders: Math.round(avgOrders * 10) / 10, recommended, loadPct, weatherNote, hasData, avgStaff: pattern?.avgStaff };
  });

  const peakHour = staffHours.reduce((b, h) => h.loadPct > b.loadPct ? h : b, staffHours[0]);
  const totalStaffHours = staffHours.reduce((s, h) => s + h.recommended, 0);

  return (
    <div className="space-y-4">
      <DataQualityNote dq={data.dataQuality} />

      {!hasStaffData && (
        <Card className="rounded-2xl border-amber-200 bg-amber-50/50"><CardContent className="p-3 text-xs flex items-center gap-2 text-amber-800">
          <AlertTriangle className="h-4 w-4" /> Geen personeelsregistratie gevonden. Aanbevelingen zijn gebaseerd op verkooppatronen.
        </CardContent></Card>
      )}

      <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Users className="h-4 w-4 text-primary" /></div>
            <div className="flex-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">Personeel Forecast — {DAY_LABELS[todayDow]}</div>
              <p className="text-sm leading-relaxed">
                {staffHours.some(h => h.hasData)
                  ? `Piekuur verwacht om ${peakHour?.hour}:00 met ${peakHour?.avgOrders} gem. orders. Totaal ${totalStaffHours} personeelsuren aanbevolen.`
                  : "Onvoldoende historische data voor deze dag. Meer verkoopdata nodig."}
                {todayWeather?.isRain && " Regen kan traffic verlagen."}
                {todayWeather?.sunny && " Zonnig weer kan extra traffic brengen."}
              </p>
            </div>
            <ConfidenceBadge level={staffHours.filter(h => h.hasData).length >= 6 ? "medium" : "low"} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card className="rounded-2xl"><CardContent className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Piekuur</div>
          <div className="text-xl font-bold">{peakHour?.hour}:00</div>
          <div className="text-xs text-muted-foreground">{peakHour?.loadPct}% belasting</div>
        </CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Werkuren</div>
          <div className="text-xl font-bold">{totalStaffHours}u</div>
          <div className="text-xs text-muted-foreground">aanbevolen</div>
        </CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Open uren</div>
          <div className="text-xl font-bold">{formatSchedule(todayDow)}</div>
          <div className="text-xs text-muted-foreground">{getTotalOpenHours(todayDow)} uur</div>
        </CardContent></Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2">
          <Users className="h-4 w-4" /> Bezettingsadvies per uur
        </CardTitle></CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="space-y-1.5">
            {staffHours.map((h, i) => (
              <div key={i} className="flex items-center gap-3 min-h-[36px]">
                <span className="text-xs font-mono w-12 text-muted-foreground">{h.hour}:00</span>
                <div className="flex-1 h-7 rounded-lg overflow-hidden bg-muted/50 relative">
                  <div className={cn("h-full rounded-lg transition-all",
                    h.loadPct > 75 ? "bg-destructive/70" : h.loadPct > 50 ? "bg-orange-400/70" : "bg-green-500/50"
                  )} style={{ width: `${h.loadPct}%` }} />
                  <span className="absolute inset-0 flex items-center px-2 text-[10px] font-medium">
                    {h.loadPct}% — {h.recommended} pers.
                    {h.weatherNote && <span className="ml-1 text-muted-foreground">({h.weatherNote})</span>}
                    {h.avgOrders > 0 && <span className="ml-1 text-muted-foreground/60">[{h.avgOrders} ord/u]</span>}
                  </span>
                </div>
                <Badge variant="outline" className="text-[8px] shrink-0">{h.hasData ? "📊" : "🔮"}</Badge>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
            <Info className="h-3 w-3" /> 📊 = historische data &nbsp; 🔮 = schatting
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Pricing Tab ─────────────────────────────────────────────────────────────

function PricingTab({ data }: { data: any }) {
  const products = data?.products || [];
  if (products.length === 0) {
    return <NoData message="Nog niet genoeg verkoopdata voor prijsadvies." details="Er zijn meer transacties nodig om patronen te herkennen." />;
  }

  const totalDays = data.totalDays || 1;
  const withMargin = products.filter((p: any) => p.margin !== null);
  const avgMargin = withMargin.length > 0 ? withMargin.reduce((s: number, p: any) => s + p.margin, 0) / withMargin.length : null;

  return (
    <div className="space-y-4">
      <DataQualityNote dq={data.dataQuality} />

      <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Tag className="h-4 w-4 text-primary" /></div>
            <div className="flex-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">Prijsadvies</div>
              <p className="text-sm leading-relaxed">
                {products.length} producten geanalyseerd over {totalDays} verkoopdagen.
                {avgMargin !== null && ` Gemiddelde marge: ${avgMargin.toFixed(1)}%.`}
                {avgMargin === null && " Geen inkoopprijzen opgeslagen — vul product costs in voor marge-analyse."}
              </p>
            </div>
            <ConfidenceBadge level={totalDays >= 14 && withMargin.length > 0 ? "medium" : "low"} />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Producten & marge</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border">
                <th className="text-left py-2 font-medium text-muted-foreground">Product</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Verkocht</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Gem/dag</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Gem. prijs</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Inkoop</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Marge</th>
                <th className="text-center py-2 font-medium text-muted-foreground">Advies</th>
              </tr></thead>
              <tbody>
                {products.slice(0, 20).map((p: any, i: number) => {
                  // Simple advice logic
                  let advice = "—";
                  let adviceColor = "text-muted-foreground";
                  if (p.margin !== null) {
                    if (p.margin > 70 && p.avgDaily > 2) { advice = "✅ Prima"; adviceColor = "text-green-600"; }
                    else if (p.margin < 40) { advice = "⚠️ Laag"; adviceColor = "text-amber-600"; }
                    else if (p.avgDaily < 0.5 && p.daysActive >= 7) { advice = "📉 Slow"; adviceColor = "text-red-500"; }
                    else { advice = "✅ OK"; adviceColor = "text-green-600"; }
                  } else if (p.daysActive < 3) {
                    advice = "⏳ Te weinig data";
                    adviceColor = "text-muted-foreground";
                  }

                  return (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 font-medium max-w-[140px] truncate">{p.name}</td>
                      <td className="text-right py-2">{p.totalQty}</td>
                      <td className="text-right py-2">{p.avgDaily}</td>
                      <td className="text-right py-2">{euro(p.avgPrice)}</td>
                      <td className="text-right py-2">{p.buyingPrice ? euro(p.buyingPrice) : "—"}</td>
                      <td className="text-right py-2 font-semibold">{p.margin !== null ? `${p.margin}%` : "—"}</td>
                      <td className={cn("text-center py-2 text-[10px] font-medium", adviceColor)}>{advice}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {withMargin.length === 0 && (
            <div className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
              <Info className="h-3 w-3" /> Vul inkoopprijzen in bij Product Costs voor marge-analyse en beter prijsadvies
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
