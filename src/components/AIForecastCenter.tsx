import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Brain, TrendingUp, TrendingDown, Cloud, Sun, CloudRain,
  Thermometer, Users, Package, DollarSign, BarChart3, Clock, Loader2,
  AlertTriangle, ShieldCheck, Zap, CalendarDays, ArrowUp, ArrowDown,
  RefreshCw, Droplets, Wind, Info, Tag, Minus, ShoppingCart, MapPin,
  Building2, Calendar, CheckCircle2, XCircle, Lightbulb, GitCompareArrows,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart, Line, Legend, Cell, Area, AreaChart,
} from "recharts";
import type {
  NormalizedDailyWeather, NormalizedHourlyWeather, NormalizedCurrentWeather,
} from "@/lib/weather/weatherIntelligence";
import {
  getOpenHoursForDate, getTotalOpenHoursForDate, formatScheduleForDate,
  normalizeScheduleConfig, getDefaultScheduleConfig, type ScheduleConfig,
} from "@/lib/businessHours";
import { useLocation_ } from "@/contexts/LocationContext";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function euro(v: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
}
function euro2(v: number) {
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
function formatAmsterdamTime(d: Date): string {
  return d.toLocaleTimeString("nl-NL", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit" });
}
function fmtShortDate(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${d}/${m}`;
}

const WEATHER_REFRESH_MS = 15 * 60 * 1000;
const DAY_LABELS = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];
const DAY_LABELS_LONG = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];

const SEGMENTS = [
  { key: "revenue", label: "Omzet", icon: TrendingUp },
  { key: "product", label: "Product", icon: Package },
  { key: "stock", label: "Voorraad", icon: BarChart3 },
  { key: "purchasing", label: "Inkoop", icon: ShoppingCart },
  { key: "staffing", label: "Personeel", icon: Users },
  { key: "pricing", label: "Prijsadvies", icon: Tag },
  { key: "actual", label: "vs Werkelijk", icon: GitCompareArrows },
  { key: "multi", label: "Locaties", icon: Building2 },
] as const;

const RANGES = [
  { key: "thisWeek", label: "Deze week", days: 7 },
  { key: "7d", label: "7 dagen", days: 7 },
  { key: "14d", label: "14 dagen", days: 14 },
  { key: "21d", label: "21 dagen", days: 21 },
] as const;

type SegmentKey = typeof SEGMENTS[number]["key"];
type RangeKey = typeof RANGES[number]["key"];

// Dispatch action events that SaakoukPOS (or any listener) can react to
function dispatchForecastAction(action: string, payload: any = {}) {
  window.dispatchEvent(new CustomEvent("forecast:action", { detail: { action, payload } }));
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function AIForecastCenter({ onToast }: { onToast?: (msg: string) => void }) {
  const [segment, setSegment] = useState<SegmentKey>("revenue");
  const [range, setRange] = useState<RangeKey>("7d");

  // Locations
  const { activeLocation, locations } = useLocation_();
  const [locationFilter, setLocationFilter] = useState<string | "all">(activeLocation?.id || "all");
  useEffect(() => { if (activeLocation?.id) setLocationFilter(activeLocation.id); }, [activeLocation?.id]);

  const [schedule, setSchedule] = useState<ScheduleConfig>(() => getDefaultScheduleConfig());
  useEffect(() => {
    const locId = locationFilter !== "all" ? locationFilter : activeLocation?.id;
    if (!locId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("location_settings")
        .select("opening_hours")
        .eq("location_id", locId)
        .maybeSingle();
      if (cancelled) return;
      setSchedule(normalizeScheduleConfig((data as any)?.opening_hours));
    })();
    return () => { cancelled = true; };
  }, [locationFilter, activeLocation?.id]);

  // Weather state
  const [daily, setDaily] = useState<NormalizedDailyWeather[]>([]);
  const [hourly, setHourly] = useState<NormalizedHourlyWeather[]>([]);
  const [currentWeather, setCurrentWeather] = useState<NormalizedCurrentWeather | null>(null);
  const [weatherSource, setWeatherSource] = useState<"live" | "fallback">("fallback");
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [liveTime, setLiveTime] = useState<Date>(new Date());

  // Forecast data
  const [forecastData, setForecastData] = useState<any>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);

  const rangeDays = useMemo(() => RANGES.find(r => r.key === range)?.days || 7, [range]);
  const isThisWeek = range === "thisWeek";

  useEffect(() => {
    const tick = setInterval(() => setLiveTime(new Date()), 30_000);
    return () => clearInterval(tick);
  }, []);

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

  // Fetch forecast — pass location + schedule to backend
  const fetchForecast = useCallback(async () => {
    setForecastLoading(true);
    setForecastError(null);
    try {
      const apiType = segment === "actual" ? "actual_vs_forecast" : segment === "multi" ? "multi_location" : segment;
      const body: any = { type: apiType, range: rangeDays, schedule };
      if (segment !== "multi" && locationFilter !== "all") body.location_id = locationFilter;
      const { data, error } = await supabase.functions.invoke("inventory-forecast", { body });
      if (error) throw new Error("Forecast ophalen mislukt");
      if (data?.error) throw new Error(data.error);
      setForecastData(data?.data || null);
    } catch (e: any) {
      setForecastError(e.message);
      setForecastData(null);
    } finally {
      setForecastLoading(false);
    }
  }, [segment, rangeDays, locationFilter, schedule]);

  useEffect(() => { fetchForecast(); }, [fetchForecast]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" /> AI Forecast & Insights
          </h2>
          <p className="text-sm text-muted-foreground">
            Weer-gestuurd • Open uren • Feestdagen • Per locatie
          </p>
        </div>
        <div className="flex items-center gap-2">
          {locations.length > 1 && (
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="text-xs rounded-lg border border-border bg-background px-3 py-2 min-h-[44px] touch-manipulation"
            >
              <option value="all">Alle locaties</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
          <Button variant="outline" size="sm" onClick={fetchForecast} disabled={forecastLoading} className="min-h-[44px]">
            {forecastLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
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

      {/* Range Tabs (hide for some segments) */}
      {segment !== "stock" && segment !== "pricing" && segment !== "multi" && (
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
      )}

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
          {segment === "revenue" && <RevenueTab data={forecastData} rangeDays={rangeDays} isThisWeek={isThisWeek} />}
          {segment === "product" && <ProductTab data={forecastData} rangeDays={rangeDays} />}
          {segment === "stock" && <StockTab data={forecastData} onAction={dispatchForecastAction} />}
          {segment === "purchasing" && <PurchasingTab data={forecastData} rangeDays={rangeDays} onAction={dispatchForecastAction} />}
          {segment === "staffing" && <StaffingTab data={forecastData} daily={daily} hourly={hourly} schedule={schedule} rangeDays={rangeDays} onAction={dispatchForecastAction} />}
          {segment === "pricing" && <PricingTab data={forecastData} />}
          {segment === "actual" && <ActualVsForecastTab data={forecastData} rangeDays={rangeDays} />}
          {segment === "multi" && <MultiLocationTab data={forecastData} rangeDays={rangeDays} />}
        </>
      )}
    </div>
  );
}

// ─── Weather Strip ───────────────────────────────────────────────────────────

function WeatherStrip({ daily, hourly, currentWeather, weatherSource, weatherLoading, liveTime, lastUpdated, fetchWeather, schedule }: {
  daily: NormalizedDailyWeather[]; hourly: NormalizedHourlyWeather[];
  currentWeather: NormalizedCurrentWeather | null; weatherSource: "live" | "fallback";
  weatherLoading: boolean; liveTime: Date; lastUpdated: Date | null;
  fetchWeather: (silent?: boolean) => Promise<void>;
  schedule: ScheduleConfig;
}) {
  const todayStr = getAmsterdamDateStr();
  const currentHour = getAmsterdamHour();
  const today = getAmsterdamNow();

  const openHoursToday = useMemo(() => new Set(getOpenHoursForDate(today, schedule)), [schedule, todayStr]);
  const todayHourly = useMemo(
    () => hourly.filter(h => h.date === todayStr && h.localHour >= currentHour),
    [hourly, todayStr, currentHour]
  );

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

        {todayHourly.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/50">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-medium text-muted-foreground">Resterende uren ({formatScheduleForDate(today, schedule)})</span>
              <span className="text-[9px] text-muted-foreground/70 flex items-center gap-2">
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-green-500/70" />open</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-muted-foreground/30" />gesloten</span>
              </span>
            </div>
            <div className="flex gap-1 overflow-x-auto pb-1">
              {todayHourly.map((h) => {
                const isCurrent = h.localHour === currentHour;
                const isOpen = openHoursToday.has(h.localHour);
                return (
                  <div key={h.localHour} className={cn(
                    "flex flex-col items-center min-w-[40px] text-center rounded-lg px-1 py-1 transition-all",
                    isCurrent ? "bg-card border border-foreground/20 shadow-sm" : "",
                    !isOpen && "opacity-40 grayscale"
                  )} title={isOpen ? "Open" : "Buiten openingstijden"}>
                    <span className={cn("text-[9px]", isCurrent ? "text-foreground font-semibold" : "text-muted-foreground")}>
                      {isCurrent ? "Nu" : `${h.localHour}:00`}
                    </span>
                    <span className="text-xs">{h.icon}</span>
                    <span className={cn("text-[10px] font-medium")}>{h.temperatureC}°</span>
                    {h.precipitationChance > 30 && <span className="text-[8px] text-blue-500 flex items-center gap-0.5"><Droplets className="h-2 w-2" />{h.precipitationChance}%</span>}
                    {!isOpen && <span className="text-[8px] text-muted-foreground">dicht</span>}
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

// ─── Shared mini components ──────────────────────────────────────────────────

function NoData({ message, details }: { message: string; details?: string }) {
  return (
    <Card className="rounded-2xl"><CardContent className="p-8 text-center">
      <Info className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
      <div className="text-sm font-medium text-muted-foreground">{message}</div>
      {details && <p className="text-xs text-muted-foreground/60 mt-1">{details}</p>}
    </CardContent></Card>
  );
}

function ConfidenceBadge({ confidence }: { confidence?: { score: number; level: string; reasons?: string[] } }) {
  if (!confidence) return null;
  const color = confidence.level === "high" ? "text-green-600 border-green-300" : confidence.level === "medium" ? "text-amber-600 border-amber-300" : "text-red-500 border-red-300";
  return (
    <Badge variant="outline" className={cn("text-[10px] shrink-0", color)}
      title={confidence.reasons?.join(" • ")}>
      <ShieldCheck className="h-3 w-3 mr-1" />Vertrouwen {confidence.score}%
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

function InsightsCard({ insights, title = "AI Insights" }: { insights: string[]; title?: string }) {
  if (!insights?.length) return null;
  return (
    <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-primary" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <ul className="space-y-1.5">
          {insights.map((s, i) => (
            <li key={i} className="text-sm flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span><span>{s}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ─── Revenue Tab ─────────────────────────────────────────────────────────────

function RevenueTab({ data, rangeDays, isThisWeek }: { data: any; rangeDays: number; isThisWeek: boolean }) {
  const forecastDays: any[] = data?.forecastDays || [];
  const previousPeriod: any[] = data?.previousPeriod || [];
  const insights: string[] = data?.insights || [];
  const backtest: any[] = data?.backtest || [];

  if (!forecastDays.length && !data?.weekdayPatterns?.length) {
    return <NoData message="Nog niet genoeg data voor betrouwbare omzetforecast." details="Voer bestellingen in via de POS om hier echte grafieken te zien." />;
  }

  const forecastTotal = data?.forecastTotal ?? 0;
  const prevTotal = data?.prevTotal ?? 0;
  const growthPct = data?.growthPct ?? 0;
  const trend = data?.trendPct ?? 0;

  // Build chart data per day
  const prevByDow: Record<number, number> = {};
  previousPeriod.forEach(p => { prevByDow[p.weekday] = (prevByDow[p.weekday] || 0) + p.actual; });

  const chartData = forecastDays.map((d, i) => ({
    label: fmtShortDate(d.date),
    dag: DAY_LABELS[d.weekday],
    low: Math.round(d.low),
    expected: Math.round(d.expected),
    high: Math.round(d.high),
    band: Math.round(d.high - d.low),
    prev: previousPeriod[i] ? Math.round(previousPeriod[i].actual) : null,
    holiday: d.holiday,
    weatherNote: d.weatherNote,
    weatherIcon: d.weatherIcon,
    openLabel: d.openLabel,
  }));

  if (isThisWeek) {
    // Limit to current week (Mon-Sun)
    const today = getAmsterdamNow();
    const dow = today.getDay() || 7; // Sunday = 7
    const mondayOffset = -(dow - 1);
    const monday = new Date(today); monday.setDate(monday.getDate() + mondayOffset);
    const start = monday.toISOString().slice(0, 10);
    const end = new Date(monday); end.setDate(end.getDate() + 6);
    const endStr = end.toISOString().slice(0, 10);
    const filtered = chartData.filter((_, i) => forecastDays[i].date >= start && forecastDays[i].date <= endStr);
    if (filtered.length > 0) chartData.splice(0, chartData.length, ...filtered);
  }

  const recentMape = data?.mape;

  return (
    <div className="space-y-4">
      <DataQualityNote dq={data.dataQuality} />

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="rounded-2xl"><CardContent className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Forecast totaal</div>
          <div className="text-xl font-bold">{euro(forecastTotal)}</div>
          <span className="text-[10px] text-muted-foreground">{rangeDays} dagen</span>
        </CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Vorige periode</div>
          <div className="text-xl font-bold">{euro(prevTotal)}</div>
          <span className={cn("text-[10px] font-semibold", growthPct >= 0 ? "text-green-600" : "text-red-500")}>
            {growthPct >= 0 ? "+" : ""}{growthPct}% vs voorgaand
          </span>
        </CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Trend (7d)</div>
          <div className="text-xl font-bold flex items-center gap-1">
            {trend > 0 ? <ArrowUp className="h-4 w-4 text-green-600" /> : trend < 0 ? <ArrowDown className="h-4 w-4 text-red-500" /> : <Minus className="h-4 w-4" />}
            {trend > 0 ? "+" : ""}{trend}%
          </div>
          <span className="text-[10px] text-muted-foreground">recent vs eerder</span>
        </CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Nauwkeurigheid</div>
          <div className="text-xl font-bold">{recentMape !== null && recentMape !== undefined ? `${(100 - recentMape).toFixed(0)}%` : "—"}</div>
          <span className="text-[10px] text-muted-foreground">backtest 14d</span>
        </CardContent></Card>
      </div>

      <InsightsCard insights={insights} title="AI Insights" />

      {/* Per-day forecast chart with band */}
      <Card className="rounded-2xl">
        <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <CalendarDays className="h-4 w-4" /> Per-dag forecast (low/expected/high)
          </CardTitle>
          <ConfidenceBadge confidence={data?.confidence} />
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `€${v}`} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", fontSize: 12 }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const d: any = payload[0]?.payload || {};
                    return (
                      <div className="bg-background border rounded-xl p-3 shadow-lg text-xs space-y-1 max-w-[240px]">
                        <div className="font-semibold flex items-center gap-1">{d.weatherIcon} {label} ({d.dag})</div>
                        <div className="text-muted-foreground">{d.openLabel}</div>
                        <div className="flex justify-between gap-3"><span>Low</span><span className="font-medium">€{d.low}</span></div>
                        <div className="flex justify-between gap-3"><span>Expected</span><span className="font-bold text-primary">€{d.expected}</span></div>
                        <div className="flex justify-between gap-3"><span>High</span><span className="font-medium">€{d.high}</span></div>
                        {d.prev !== null && <div className="flex justify-between gap-3 pt-1 border-t"><span>Vorige periode</span><span>€{d.prev}</span></div>}
                        {d.weatherNote && <div className="text-muted-foreground pt-1 border-t">Weer: {d.weatherNote}</div>}
                        {d.holiday && <div className="text-amber-600 font-medium">🎉 {d.holiday}</div>}
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="low" stackId="band" fill="transparent" name="" legendType="none" />
                <Bar dataKey="band" stackId="band" fill="hsl(var(--primary))" fillOpacity={0.2} name="Band low-high" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="expected" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} name="Expected" />
                <Line type="monotone" dataKey="prev" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 2 }} name="Vorige periode" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
            <Info className="h-3 w-3" /> Forecast = historisch weekdag-gemiddelde × weersimpact × feestdag-factor. Band = ± standaardafwijking.
          </div>
        </CardContent>
      </Card>

      {/* Per-day table */}
      <Card className="rounded-2xl">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Dagoverzicht</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border">
                <th className="text-left py-2 font-medium text-muted-foreground">Dag</th>
                <th className="text-left py-2 font-medium text-muted-foreground">Open</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Low</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Expected</th>
                <th className="text-right py-2 font-medium text-muted-foreground">High</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Vorige</th>
                <th className="text-left py-2 font-medium text-muted-foreground">Notities</th>
              </tr></thead>
              <tbody>
                {forecastDays.map((d, i) => (
                  <tr key={i} className={cn("border-b border-border/50", d.holiday && "bg-amber-50/50", !d.open && "opacity-50")}>
                    <td className="py-2 font-medium">{DAY_LABELS[d.weekday]} {fmtShortDate(d.date)} <span className="ml-1">{d.weatherIcon}</span></td>
                    <td className="py-2 text-muted-foreground">{d.openLabel}</td>
                    <td className="text-right py-2">€{Math.round(d.low)}</td>
                    <td className="text-right py-2 font-semibold">€{Math.round(d.expected)}</td>
                    <td className="text-right py-2">€{Math.round(d.high)}</td>
                    <td className="text-right py-2 text-muted-foreground">{previousPeriod[i] ? `€${Math.round(previousPeriod[i].actual)}` : "—"}</td>
                    <td className="py-2 text-[10px] text-muted-foreground">
                      {d.holiday && <span className="text-amber-600 font-semibold">🎉 {d.holiday} </span>}
                      {d.vacation && <span className="text-blue-600">📅 {d.vacation} </span>}
                      {d.weatherNote}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Mini Forecast vs Actual */}
      {backtest.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2">
            <GitCompareArrows className="h-4 w-4" /> Backtest — forecast vs werkelijk (14d)
          </CardTitle></CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={backtest.map(b => ({ ...b, label: fmtShortDate(b.date) }))} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `€${v}`} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 11 }} formatter={(v: number) => euro(v)} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="forecast" fill="hsl(var(--primary))" fillOpacity={0.5} name="Forecast" />
                  <Line type="monotone" dataKey="actual" stroke="hsl(var(--accent-foreground))" strokeWidth={2} name="Werkelijk" dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            {data?.mape !== null && data?.mape !== undefined && (
              <div className="text-[10px] text-muted-foreground mt-2">
                Gemiddelde forecastfout: <span className="font-semibold">{data.mape}%</span> — nauwkeurigheid: <span className="font-semibold text-primary">{(100 - data.mape).toFixed(1)}%</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Card className="rounded-2xl border-primary/20"><CardContent className="p-3 flex flex-wrap gap-2">
        {growthPct < -5 && (
          <Button variant="outline" size="sm" onClick={() => dispatchForecastAction("create_promotion", { reason: "decline" })}>
            <Zap className="h-3.5 w-3.5 mr-1" /> Maak promotie (omzet daalt)
          </Button>
        )}
        {forecastDays.some(d => d.holiday) && (
          <Button variant="outline" size="sm" onClick={() => dispatchForecastAction("plan_holiday", { dates: forecastDays.filter(d => d.holiday).map(d => d.date) })}>
            <CalendarDays className="h-3.5 w-3.5 mr-1" /> Plan feestdagen
          </Button>
        )}
      </CardContent></Card>
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
  const topProducts = products.slice(0, 25);

  const forecastProducts = topProducts.map((p: any) => ({
    ...p,
    forecast: Math.round(p.avgDaily * rangeDays),
  }));

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
                {topProducts[0] && ` ${topProducts[0].name} is het meest verkocht (${topProducts[0].totalQty} stuks).`}
              </p>
            </div>
            <ConfidenceBadge confidence={data?.confidence} />
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
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Productoverzicht (met groei %)</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border">
                <th className="text-left py-2 font-medium text-muted-foreground">Product</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Totaal</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Vorige helft</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Recente helft</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Groei</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Forecast {rangeDays}d</th>
                <th className="text-center py-2 font-medium text-muted-foreground">Vertrouwen</th>
              </tr></thead>
              <tbody>
                {forecastProducts.map((p: any, i: number) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2 font-medium max-w-[150px] truncate">{p.name}</td>
                    <td className="text-right py-2">{p.totalQty}</td>
                    <td className="text-right py-2 text-muted-foreground">{p.prevQty}</td>
                    <td className="text-right py-2">{p.recentQty}</td>
                    <td className={cn("text-right py-2 font-semibold", p.growthPct > 0 ? "text-green-600" : p.growthPct < 0 ? "text-red-500" : "")}>
                      {p.growthPct > 0 ? "+" : ""}{p.growthPct}%
                    </td>
                    <td className="text-right py-2 font-semibold">{p.forecast}</td>
                    <td className="text-center py-2">
                      <Badge variant="outline" className={cn("text-[9px]",
                        p.confidence === "high" ? "text-green-600 border-green-300" :
                          p.confidence === "medium" ? "text-amber-600 border-amber-300" : "text-red-500 border-red-300"
                      )}>{p.confidence === "high" ? "Hoog" : p.confidence === "medium" ? "Med" : "Laag"}</Badge>
                    </td>
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

function StockTab({ data, onAction }: { data: any; onAction: (a: string, p: any) => void }) {
  const items = data?.items || [];
  if (items.length === 0) {
    return <NoData message="Geen voorraaddata beschikbaar." details="Voeg voorraadartikelen toe om stockforecasts te zien." />;
  }
  const critical = data.critical ?? data.highRisk ?? 0;
  const low = data.low ?? data.mediumRisk ?? 0;
  const healthy = data.healthy ?? (items.length - critical - low);

  const statusBadge = (s: string) => {
    if (s === "critical") return <Badge variant="destructive" className="text-[10px]">🔴 Kritiek</Badge>;
    if (s === "low") return <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">🟠 Laag</Badge>;
    return <Badge variant="secondary" className="text-[10px] text-green-700">🟢 Gezond</Badge>;
  };

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
                {items.length} artikelen. {critical > 0 && <span className="text-destructive font-semibold">⚠️ {critical} kritiek. </span>}
                {low > 0 && <span className="text-amber-600">{low} laag.</span>}
                {critical === 0 && low === 0 && " Alle voorraden op niveau."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card className="rounded-2xl"><CardContent className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-green-600 font-medium mb-1">🟢 Gezond</div>
          <div className="text-xl font-bold text-green-700">{healthy}</div>
        </CardContent></Card>
        <Card className="rounded-2xl border-amber-300/50"><CardContent className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-amber-600 font-medium mb-1">🟠 Laag</div>
          <div className="text-xl font-bold text-amber-600">{low}</div>
        </CardContent></Card>
        <Card className="rounded-2xl border-destructive/30"><CardContent className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-destructive font-medium mb-1">🔴 Kritiek</div>
          <div className="text-xl font-bold text-destructive">{critical}</div>
        </CardContent></Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Voorraad per artikel</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border">
                <th className="text-left py-2 font-medium text-muted-foreground">Artikel</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Voorraad</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Min</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Gem/dag</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Dagen over</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Bestel</th>
                <th className="text-center py-2 font-medium text-muted-foreground">Status</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Actie</th>
              </tr></thead>
              <tbody>
                {items.map((item: any, i: number) => (
                  <tr key={i} className={cn("border-b border-border/50", item.status === "critical" && "bg-destructive/5")}>
                    <td className="py-2 font-medium max-w-[140px] truncate">{item.name}</td>
                    <td className="text-right py-2">{item.currentStock} {item.unit}</td>
                    <td className="text-right py-2 text-muted-foreground">{item.minStock}</td>
                    <td className="text-right py-2">{item.avgDailyUsage}</td>
                    <td className="text-right py-2 font-semibold">{item.daysRemaining > 100 ? "100+" : item.daysRemaining}</td>
                    <td className="text-right py-2">{item.reorderQty > 0 ? `${item.reorderQty} ${item.unit}` : "—"}</td>
                    <td className="text-center py-2">{statusBadge(item.status || item.risk)}</td>
                    <td className="text-right py-2">
                      {(item.status === "critical" || item.status === "low") && (
                        <Button size="sm" variant="outline" className="h-7 text-[10px]"
                          onClick={() => onAction("create_po", { item_id: item.id, name: item.name, qty: item.reorderQty, supplier: item.supplier })}>
                          <ShoppingCart className="h-3 w-3 mr-1" /> Bestel
                        </Button>
                      )}
                    </td>
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

// ─── Purchasing Tab ──────────────────────────────────────────────────────────

function PurchasingTab({ data, rangeDays, onAction }: { data: any; rangeDays: number; onAction: (a: string, p: any) => void }) {
  const recs: any[] = data?.recommendations || [];
  const productForecast: any[] = data?.productForecast || [];
  const hasRecipes = data?.hasRecipes;

  if (!hasRecipes) {
    return <NoData
      message="Geen receptdata gevonden."
      details="Koppel ingrediënten aan producten via Product Costs / Recipes om inkoopadvies te zien." />;
  }
  if (recs.length === 0) {
    return <NoData message="Geen tekorten verwacht." details={`Op basis van ${rangeDays} dagen forecast en huidige voorraad.`} />;
  }

  const shortages = recs.filter(r => r.shortage > 0);
  const totalCost = data?.totalEstimatedCost || 0;

  return (
    <div className="space-y-4">
      <DataQualityNote dq={data.dataQuality} />

      <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><ShoppingCart className="h-4 w-4 text-primary" /></div>
            <div className="flex-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">Inkoopadvies — komende {rangeDays} dagen</div>
              <p className="text-sm leading-relaxed">
                {shortages.length} ingrediënten met tekort. Geschatte inkoopwaarde: <span className="font-bold">{euro2(totalCost)}</span>.
                Gebaseerd op {productForecast.length} producten en hun recepten (incl. waste-factor).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Inkooplijst</CardTitle>
          {shortages.length > 0 && (
            <Button size="sm" variant="default" onClick={() => onAction("create_bulk_po", { items: shortages })}>
              <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Maak inkooporder ({shortages.length})
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border">
                <th className="text-left py-2 font-medium text-muted-foreground">Ingrediënt</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Voorraad</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Behoefte</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Tekort</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Bestel (+15%)</th>
                <th className="text-left py-2 font-medium text-muted-foreground">Leverancier</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Kosten</th>
              </tr></thead>
              <tbody>
                {recs.map((r: any, i: number) => (
                  <tr key={i} className={cn("border-b border-border/50", r.shortage > 0 && "bg-amber-50/30")}>
                    <td className="py-2 font-medium max-w-[140px] truncate">{r.name}</td>
                    <td className="text-right py-2">{r.currentStock} {r.unit}</td>
                    <td className="text-right py-2">{r.neededQty} {r.unit}</td>
                    <td className={cn("text-right py-2 font-semibold", r.shortage > 0 && "text-destructive")}>
                      {r.shortage > 0 ? `${r.shortage} ${r.unit}` : "—"}
                    </td>
                    <td className="text-right py-2 font-semibold">{r.orderQty > 0 ? `${r.orderQty} ${r.unit}` : "—"}</td>
                    <td className="py-2 text-muted-foreground max-w-[100px] truncate">{r.supplier || "—"}</td>
                    <td className="text-right py-2">{r.estimatedCost > 0 ? euro2(r.estimatedCost) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {productForecast.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Verwachte productverkoop (bron)</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {productForecast.slice(0, 12).map((p: any, i: number) => (
                <div key={i} className="rounded-lg border border-border/50 px-2 py-1.5 text-xs">
                  <div className="font-medium truncate">{p.name}</div>
                  <div className="text-muted-foreground">~{p.qty} stuks</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Staffing Tab ────────────────────────────────────────────────────────────

function StaffingTab({ data, daily, hourly, schedule, rangeDays, onAction }: {
  data: any; daily: NormalizedDailyWeather[]; hourly: NormalizedHourlyWeather[];
  schedule: ScheduleConfig; rangeDays: number; onAction: (a: string, p: any) => void;
}) {
  const patterns = data?.patterns || [];
  const dayForecasts: any[] = data?.dayForecasts || [];
  const today = getAmsterdamNow();
  const todayDow = today.getDay();
  const openHrs = getOpenHoursForDate(today, schedule);

  // Today's hourly breakdown
  const todayPatterns = patterns
    .filter((p: any) => p.weekday === todayDow)
    .sort((a: any, b: any) => a.hour - b.hour);

  const todayWeather = daily.find(d => d.date === getAmsterdamDateStr());

  const staffHours = openHrs.map(hour => {
    const pattern = todayPatterns.find((p: any) => p.hour === hour);
    const weatherHr = hourly.find(h => h.date === getAmsterdamDateStr() && h.localHour === hour);
    let avgOrders = pattern?.avgOrders ?? 0;
    let weatherNote = "";
    if (weatherHr) {
      if (weatherHr.precipitationChance > 60) { avgOrders *= 0.85; weatherNote = "Regen"; }
      if (weatherHr.temperatureC > 22 && weatherHr.precipitationChance < 30) { avgOrders *= 1.1; weatherNote = "Warm"; }
      if (weatherHr.windSpeed > 30) { avgOrders *= 0.92; weatherNote += (weatherNote ? " + " : "") + "Wind"; }
    }
    if (todayWeather?.sunny && !weatherNote) weatherNote = "Zon";
    const recommended = avgOrders > 0 ? Math.max(1, Math.ceil(avgOrders / 10)) : 1;
    const loadPct = avgOrders > 0 ? Math.min(100, Math.round(avgOrders * 8)) : 0;
    return { hour, avgOrders: Math.round(avgOrders * 10) / 10, recommended, loadPct, weatherNote, hasData: !!pattern, avgStaff: pattern?.avgStaff };
  });

  const peakHour = staffHours.reduce((b, h) => h.loadPct > b.loadPct ? h : b, staffHours[0]) || { hour: 0, loadPct: 0, recommended: 0 };
  const totalStaffHours = staffHours.reduce((s, h) => s + h.recommended, 0);

  return (
    <div className="space-y-4">
      <DataQualityNote dq={data.dataQuality} />

      {/* Multi-day forecast */}
      {dayForecasts.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Personeelsforecast — komende {rangeDays} dagen
            </CardTitle>
            <ConfidenceBadge confidence={data?.confidence} />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-border">
                  <th className="text-left py-2 font-medium text-muted-foreground">Dag</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">Open uren</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">Verwachte orders</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">Aanbev. p-uren</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">Hist. gem. (p-uren)</th>
                  <th className="text-center py-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">Actie</th>
                </tr></thead>
                <tbody>
                  {dayForecasts.map((d, i) => {
                    const statusBadge =
                      d.status === "understaffed" ? <Badge variant="destructive" className="text-[10px]">Onderbezet</Badge> :
                      d.status === "overstaffed" ? <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">Overbezet</Badge> :
                      d.status === "ok" ? <Badge variant="secondary" className="text-[10px] text-green-700">OK</Badge> :
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">Geen historie</Badge>;
                    return (
                      <tr key={i} className={cn("border-b border-border/50", d.holiday && "bg-amber-50/50")}>
                        <td className="py-2 font-medium">{DAY_LABELS[d.weekday]} {fmtShortDate(d.date)} {d.holiday && <span className="text-amber-600">🎉</span>}</td>
                        <td className="text-right py-2 text-muted-foreground">{d.openHours}u</td>
                        <td className="text-right py-2">{d.expectedOrders}</td>
                        <td className="text-right py-2 font-semibold">{d.recommendedStaffHours}u</td>
                        <td className="text-right py-2 text-muted-foreground">{d.scheduledStaffHours ?? "—"}</td>
                        <td className="text-center py-2">{statusBadge}</td>
                        <td className="text-right py-2">
                          {(d.status === "understaffed" || d.status === "overstaffed") && (
                            <Button size="sm" variant="outline" className="h-7 text-[10px]"
                              onClick={() => onAction("create_schedule", { date: d.date, recommendedHours: d.recommendedStaffHours })}>
                              <Users className="h-3 w-3 mr-1" /> Plan
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today hourly */}
      <Card className="rounded-2xl">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2">
          <Users className="h-4 w-4" /> Vandaag — bezettingsadvies per uur ({formatScheduleForDate(today, schedule)})
        </CardTitle></CardHeader>
        <CardContent className="p-4 pt-2">
          {staffHours.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Vandaag gesloten.</p>
          ) : (
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
          )}
          <div className="text-[10px] text-muted-foreground mt-2">
            Piekuur {peakHour?.hour}:00 ({peakHour?.loadPct}%) • Totaal {totalStaffHours} personeelsuren aanbevolen voor vandaag.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Pricing Tab (legacy, kept) ──────────────────────────────────────────────

function PricingTab({ data }: { data: any }) {
  const products = data?.products || [];
  if (products.length === 0) return <NoData message="Nog niet genoeg verkoopdata voor prijsadvies." />;
  const totalDays = data.totalDays || 1;
  const withMargin = products.filter((p: any) => p.margin !== null);
  const avgMargin = withMargin.length > 0 ? withMargin.reduce((s: number, p: any) => s + p.margin, 0) / withMargin.length : null;
  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Tag className="h-4 w-4 text-primary mt-1" />
            <p className="text-sm leading-relaxed">
              {products.length} producten over {totalDays} dagen.{avgMargin !== null && ` Gemiddelde marge: ${avgMargin.toFixed(1)}%.`}
            </p>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b">
                <th className="text-left py-2 font-medium text-muted-foreground">Product</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Verkocht</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Gem. prijs</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Inkoop</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Marge</th>
                <th className="text-center py-2 font-medium text-muted-foreground">Advies</th>
              </tr></thead>
              <tbody>
                {products.slice(0, 30).map((p: any, i: number) => {
                  let advice = "—", color = "text-muted-foreground";
                  if (p.margin !== null) {
                    if (p.margin > 70 && p.avgDaily > 2) { advice = "✅ Prima"; color = "text-green-600"; }
                    else if (p.margin < 40) { advice = "⚠️ Laag"; color = "text-amber-600"; }
                    else if (p.avgDaily < 0.5) { advice = "📉 Slow"; color = "text-red-500"; }
                    else { advice = "✅ OK"; color = "text-green-600"; }
                  }
                  return (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 font-medium max-w-[140px] truncate">{p.name}</td>
                      <td className="text-right py-2">{p.totalQty}</td>
                      <td className="text-right py-2">{euro2(p.avgPrice)}</td>
                      <td className="text-right py-2">{p.buyingPrice ? euro2(p.buyingPrice) : "—"}</td>
                      <td className="text-right py-2 font-semibold">{p.margin !== null ? `${p.margin}%` : "—"}</td>
                      <td className={cn("text-center py-2 text-[10px] font-medium", color)}>{advice}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Actual vs Forecast Tab ──────────────────────────────────────────────────

function ActualVsForecastTab({ data, rangeDays }: { data: any; rangeDays: number }) {
  const backtest: any[] = data?.backtest || [];
  if (backtest.length === 0) return <NoData message="Onvoldoende historische data voor backtest." />;

  const chartData = backtest.map(b => ({ ...b, label: fmtShortDate(b.date) }));
  const accuracy = data?.accuracy ?? 0;
  const totalForecast = data?.totalForecast ?? 0;
  const totalActual = data?.totalActual ?? 0;
  const diffPct = data?.diffPct ?? 0;

  return (
    <div className="space-y-4">
      <DataQualityNote dq={data.dataQuality} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="rounded-2xl"><CardContent className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Werkelijk totaal</div>
          <div className="text-xl font-bold">{euro(totalActual)}</div>
        </CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Forecast totaal</div>
          <div className="text-xl font-bold">{euro(totalForecast)}</div>
        </CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Verschil</div>
          <div className={cn("text-xl font-bold", diffPct >= 0 ? "text-green-600" : "text-red-500")}>
            {diffPct >= 0 ? "+" : ""}{diffPct}%
          </div>
        </CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Nauwkeurigheid</div>
          <div className="text-xl font-bold text-primary">{accuracy}%</div>
          <span className="text-[10px] text-muted-foreground">MAPE {data?.mape}%</span>
        </CardContent></Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2">
          <GitCompareArrows className="h-4 w-4" /> Forecast vs werkelijk — laatste {backtest.length} dagen
        </CardTitle></CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `€${v}`} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 11 }} formatter={(v: number) => euro2(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="forecast" fill="hsl(var(--primary))" fillOpacity={0.4} name="Forecast" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" fill="hsl(var(--primary))" name="Werkelijk" radius={[4, 4, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Per-dag verschil</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b">
                <th className="text-left py-2 font-medium text-muted-foreground">Datum</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Forecast</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Werkelijk</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Verschil</th>
              </tr></thead>
              <tbody>
                {[...backtest].reverse().map((b, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2 font-medium">{DAY_LABELS[b.weekday]} {fmtShortDate(b.date)}</td>
                    <td className="text-right py-2 text-muted-foreground">{euro2(b.forecast)}</td>
                    <td className="text-right py-2 font-semibold">{euro2(b.actual)}</td>
                    <td className={cn("text-right py-2 font-semibold", b.diffPct >= 0 ? "text-green-600" : "text-red-500")}>
                      {b.diffPct >= 0 ? "+" : ""}{b.diffPct}%
                    </td>
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

// ─── Multi-Location Tab ──────────────────────────────────────────────────────

function MultiLocationTab({ data, rangeDays }: { data: any; rangeDays: number }) {
  const locations: any[] = data?.locations || [];
  if (locations.length === 0) return <NoData message="Geen locatiedata beschikbaar." />;
  const grandTotal = data?.grandTotal ?? 0;

  const chartData = locations.map(l => ({ name: l.name, omzet: l.forecastTotal }));

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Building2 className="h-4 w-4 text-primary mt-1" />
            <div className="flex-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">Multi-Location Forecast — {rangeDays} dagen</div>
              <p className="text-sm leading-relaxed">
                Verwachte totale omzet alle locaties: <span className="font-bold text-lg">{euro(grandTotal)}</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `€${v}`} />
                <Tooltip formatter={(v: number) => euro2(v)} contentStyle={{ borderRadius: 12, fontSize: 11 }} />
                <Bar dataKey="omzet" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Per locatie</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b">
                <th className="text-left py-2 font-medium text-muted-foreground">Locatie</th>
                <th className="text-left py-2 font-medium text-muted-foreground">Stad</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Historie</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Forecast {rangeDays}d</th>
                <th className="text-right py-2 font-medium text-muted-foreground">% van totaal</th>
              </tr></thead>
              <tbody>
                {locations.map((l: any, i: number) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2 font-medium">{l.name}</td>
                    <td className="py-2 text-muted-foreground">{l.city || "—"}</td>
                    <td className="text-right py-2 text-muted-foreground">{l.days} dgn</td>
                    <td className="text-right py-2 font-semibold">{euro(l.forecastTotal)}</td>
                    <td className="text-right py-2 text-muted-foreground">{grandTotal > 0 ? `${((l.forecastTotal / grandTotal) * 100).toFixed(1)}%` : "—"}</td>
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
