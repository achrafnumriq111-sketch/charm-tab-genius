import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Brain, Sparkles, TrendingUp, TrendingDown, Cloud, Sun, CloudRain,
  Thermometer, Users, Package, DollarSign, BarChart3, Clock, Loader2,
  AlertTriangle, ShieldCheck, Zap, CalendarDays, ArrowUp, ArrowDown,
  RefreshCw, ChevronRight,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart, Line, Cell, Legend,
} from "recharts";

function euro(v: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(v);
}
function cn(...p: any[]) { return p.filter(Boolean).join(" "); }

const SEGMENTS = [
  { key: "revenue", label: "Omzet forecast", icon: TrendingUp },
  { key: "product", label: "Product forecast", icon: BarChart3 },
  { key: "stock", label: "Voorraad forecast", icon: Package },
  { key: "staffing", label: "Personeel forecast", icon: Users },
  { key: "pricing", label: "Prijsadvies", icon: DollarSign },
] as const;

const RANGES = [
  { key: "7d", label: "Deze week", days: 7 },
  { key: "next7", label: "Volgende 7 dagen", days: 7 },
  { key: "next14", label: "Volgende 14 dagen", days: 14 },
  { key: "next21", label: "Volgende 21 dagen", days: 21 },
  { key: "month", label: "Deze maand", days: 30 },
] as const;

type SegmentKey = typeof SEGMENTS[number]["key"];
type RangeKey = typeof RANGES[number]["key"];

// Fallback weather data in case API call fails
function getFallbackWeather() {
  const days = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];
  const today = new Date().getDay();
  return Array.from({ length: 7 }, (_, i) => {
    const rand = Math.random();
    const temp = Math.round(14 + Math.random() * 12);
    const sunny = rand > 0.4;
    return {
      day: days[(today + i) % 7],
      temp,
      sunny,
      icon: sunny ? "☀️" : rand > 0.2 ? "⛅" : "🌧️",
      impact: sunny ? Math.round(8 + temp * 0.5) : Math.round(-5 - (1 - rand) * 10),
      label: sunny ? "Zonnig" : rand > 0.2 ? "Bewolkt" : "Regen",
      rain: 0,
      wind: 0,
      isReal: false,
    };
  });
}

export function AIForecastCenter({ onToast }: { onToast?: (msg: string) => void }) {
  const [segment, setSegment] = useState<SegmentKey>("revenue");
  const [range, setRange] = useState<RangeKey>("next7");
  const [loading, setLoading] = useState(false);
  const [forecast, setForecast] = useState<any>(null);
  const [error, setError] = useState("");
  const [weather, setWeather] = useState(getFallbackWeather);
  const [weatherSource, setWeatherSource] = useState<"live" | "fallback">("fallback");
  const [currentWeather, setCurrentWeather] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const rangeDays = useMemo(() => RANGES.find(r => r.key === range)?.days || 7, [range]);

  // Fetch real weather on mount
  useEffect(() => {
    (async () => {
      try {
        const { data, error: fnErr } = await supabase.functions.invoke("weather-forecast", {
          body: { city: "Amsterdam" },
        });
        if (fnErr || data?.error) throw new Error(data?.error || "Weather fetch failed");
        if (data?.daily?.length) {
          setWeather(data.daily.map((d: any) => ({
            day: d.day,
            temp: d.temp,
            sunny: d.sunny,
            icon: d.icon,
            impact: d.impact,
            label: d.label,
            rain: d.rain || 0,
            wind: d.wind || 0,
            date: d.date,
            temp_max: d.temp_max,
            temp_min: d.temp_min,
            weekend: d.weekend,
            isReal: true,
          })));
          setWeatherSource("live");
          if (data.current) setCurrentWeather(data.current);
        }
      } catch (e) {
        console.warn("Weather API fallback:", e);
      }
    })();
  }, []);

  const runForecast = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const weatherContext = weather.map(w => `${w.day}: ${w.temp}°C ${w.label} impact:${w.impact}%`).join(", ");
      const { data, error: fnError } = await supabase.functions.invoke("inventory-forecast", {
        body: { type: segment, range: rangeDays, weatherContext },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setForecast(data?.data || data);
      setLastUpdated(new Date());
      onToast?.("AI analyse compleet");
    } catch (e: any) {
      setError(e.message || "Fout bij AI analyse");
    } finally {
      setLoading(false);
    }
  }, [segment, rangeDays, onToast, weather]);

  // Auto-run on segment/range change
  useEffect(() => { runForecast(); }, [segment, range]);

  // Generate mock chart data based on forecast
  const chartData = useMemo(() => {
    const days = rangeDays;
    const baseRevenue = 800 + Math.random() * 400;
    return Array.from({ length: days }, (_, i) => {
      const dayOfWeek = (new Date().getDay() + i) % 7;
      const weekendBoost = dayOfWeek === 5 || dayOfWeek === 6 ? 1.35 : 1;
      const weatherImpact = weather[i % 7]?.sunny ? 1.15 : 0.92;
      const noise = 0.85 + Math.random() * 0.3;
      const actual = i < 3 ? Math.round(baseRevenue * weekendBoost * weatherImpact * noise) : null;
      const forecastVal = Math.round(baseRevenue * weekendBoost * weatherImpact * (0.95 + Math.random() * 0.1));
      const prev = Math.round(baseRevenue * weekendBoost * 0.9 * noise);
      return {
        day: `Dag ${i + 1}`,
        actual,
        forecast: forecastVal,
        forecastLow: Math.round(forecastVal * 0.82),
        forecastHigh: Math.round(forecastVal * 1.18),
        previous: prev,
      };
    });
  }, [rangeDays, weather]);

  const totalForecast = chartData.reduce((s, d) => s + d.forecast, 0);
  const totalLow = chartData.reduce((s, d) => s + d.forecastLow, 0);
  const totalHigh = chartData.reduce((s, d) => s + d.forecastHigh, 0);
  const totalPrev = chartData.reduce((s, d) => s + d.previous, 0);
  const trendPct = totalPrev > 0 ? Math.round(((totalForecast - totalPrev) / totalPrev) * 1000) / 10 : 0;

  const peakDay = chartData.reduce((best, d) => d.forecast > best.forecast ? d : best, chartData[0]);
  const avgWeatherImpact = weather.reduce((s, w) => s + w.impact, 0) / weather.length;

  const confidenceScore = range === "7d" || range === "next7" ? 91 : range === "next14" ? 84 : range === "next21" ? 76 : 72;

  // Executive summary
  const executiveSummary = forecast?.summary || `Verwachte omzet komende ${rangeDays} dagen: ${euro(totalForecast)}. ${trendPct > 0 ? `Stijging van +${trendPct}%` : `Daling van ${trendPct}%`} t.o.v. vorige periode. ${avgWeatherImpact > 0 ? `Weer heeft positief effect (+${Math.round(avgWeatherImpact)}% gemiddeld).` : `Weer drukt de omzet licht.`} ${weather[0]?.sunny ? "Morgen zonnig — verwacht hogere traffic." : "Morgen bewolkt/regen — plan conservatief."}`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" /> AI Forecast & Insights
          </h2>
          <p className="text-sm text-muted-foreground">AI analyseert omzet, vraag, weer en operationele trends</p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-[10px] text-muted-foreground">
              Bijgewerkt: {lastUpdated.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={runForecast} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
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
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
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
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap border",
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
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">AI Executive Summary</div>
              <p className="text-sm leading-relaxed">{executiveSummary}</p>
            </div>
            <Badge variant="outline" className="shrink-0 text-[10px]">
              <ShieldCheck className="h-3 w-3 mr-1" /> {confidenceScore}%
            </Badge>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="rounded-2xl border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {error}
          </CardContent>
        </Card>
      )}

      {/* Weather Strip */}
      <Card className="rounded-2xl">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Cloud className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Weer & Impact</span>
            <Badge variant={weatherSource === "live" ? "default" : "outline"} className="text-[10px] h-4">
              {weatherSource === "live" ? "🟢 Live" : "Mock data"}
            </Badge>
            {currentWeather && (
              <span className="text-xs text-muted-foreground ml-auto">
                Nu: {currentWeather.temp}° {currentWeather.description} — {currentWeather.city}
              </span>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {weather.map((w: any, i: number) => (
              <div key={i} className={cn(
                "flex flex-col items-center min-w-[52px] rounded-xl px-2 py-1.5 border text-center",
                w.sunny ? "bg-amber-50/50 border-amber-200/50" : "bg-slate-50/50 border-slate-200/50"
              )}>
                <span className="text-[10px] font-medium text-muted-foreground">{w.day}</span>
                <span className="text-lg">{w.icon}</span>
                <span className="text-xs font-bold">{w.temp}°</span>
                <span className={cn("text-[10px] font-semibold", w.impact > 0 ? "text-green-600" : "text-red-500")}>
                  {w.impact > 0 ? "+" : ""}{w.impact}%
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading && (
        <Card className="rounded-2xl">
          <CardContent className="p-12 text-center">
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary mb-4" />
            <div className="text-lg font-semibold">AI analyseert {SEGMENTS.find(s => s.key === segment)?.label}...</div>
            <p className="text-sm text-muted-foreground">Dit kan 10-20 seconden duren</p>
          </CardContent>
        </Card>
      )}

      {/* ─── REVENUE FORECAST ─── */}
      {segment === "revenue" && !loading && (
        <RevenueView
          chartData={chartData}
          totalForecast={totalForecast}
          totalLow={totalLow}
          totalHigh={totalHigh}
          trendPct={trendPct}
          rangeDays={rangeDays}
          confidenceScore={confidenceScore}
          peakDay={peakDay}
          forecast={forecast}
        />
      )}

      {/* ─── PRODUCT FORECAST ─── */}
      {segment === "product" && !loading && (
        <ProductView forecast={forecast} rangeDays={rangeDays} weather={weather} />
      )}

      {/* ─── STOCK FORECAST ─── */}
      {segment === "stock" && !loading && (
        <StockView forecast={forecast} rangeDays={rangeDays} />
      )}

      {/* ─── STAFFING FORECAST ─── */}
      {segment === "staffing" && !loading && (
        <StaffingView forecast={forecast} rangeDays={rangeDays} weather={weather} />
      )}

      {/* ─── PRICING ─── */}
      {segment === "pricing" && !loading && (
        <PricingView forecast={forecast} />
      )}
    </div>
  );
}

// ─── Revenue Sub-view ────────────────────────────────────────────────────────

function RevenueView({ chartData, totalForecast, totalLow, totalHigh, trendPct, rangeDays, confidenceScore, peakDay, forecast }: any) {
  const kpis = [
    { label: "Forecast omzet", value: euro(totalForecast), sub: `vs vorige ${rangeDays} dagen`, trend: trendPct, icon: TrendingUp },
    { label: "Forecast range", value: `${euro(totalLow)} – ${euro(totalHigh)}`, sub: "laag / median / hoog", icon: BarChart3 },
    { label: "Piekdag", value: peakDay.day, sub: euro(peakDay.forecast), icon: Zap },
    { label: "Confidence", value: `${confidenceScore}%`, sub: `${rangeDays} dagen vooruit`, icon: ShieldCheck },
  ];

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k, i) => (
          <Card key={i} className="rounded-2xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{k.label}</span>
                <k.icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="text-xl font-bold">{k.value}</div>
              <div className="flex items-center gap-1 mt-0.5">
                {k.trend !== undefined && (
                  <Badge variant={k.trend >= 0 ? "default" : "destructive"} className="text-[10px] h-5">
                    {k.trend >= 0 ? <ArrowUp className="h-2.5 w-2.5 mr-0.5" /> : <ArrowDown className="h-2.5 w-2.5 mr-0.5" />}
                    {k.trend >= 0 ? "+" : ""}{k.trend}%
                  </Badge>
                )}
                <span className="text-[10px] text-muted-foreground">{k.sub}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Chart */}
      <Card className="rounded-2xl">
        <CardHeader className="p-4 pb-0">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Omzet Forecast vs Historisch
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `€${v}`} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--background))",
                    fontSize: 12,
                  }}
                  formatter={(v: number, name: string) => [euro(v), name]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {/* Confidence band */}
                <Area
                  type="monotone"
                  dataKey="forecastHigh"
                  stroke="none"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.08}
                  name="Forecast hoog"
                />
                <Area
                  type="monotone"
                  dataKey="forecastLow"
                  stroke="none"
                  fill="hsl(var(--background))"
                  fillOpacity={1}
                  name="Forecast laag"
                />
                {/* Previous period bars */}
                <Bar dataKey="previous" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} name="Vorige periode" barSize={16} />
                {/* Actual bars */}
                <Bar dataKey="actual" radius={[4, 4, 0, 0]} name="Werkelijk" barSize={16}>
                  {chartData.map((_: any, i: number) => (
                    <Cell key={i} fill={chartData[i].actual != null ? "hsl(var(--primary))" : "transparent"} />
                  ))}
                </Bar>
                {/* Forecast line */}
                <Line
                  type="monotone"
                  dataKey="forecast"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={{ r: 3, fill: "hsl(var(--primary))" }}
                  name="Forecast"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* AI Recommendations */}
      {forecast?.recommendations?.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5"><Sparkles className="h-4 w-4" /> AI Aanbevelingen</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            {forecast.recommendations.map((r: string, i: number) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>{r}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Product Forecast Sub-view ───────────────────────────────────────────────

function ProductView({ forecast, rangeDays, weather }: any) {
  // Generate product forecast data
  const products = useMemo(() => {
    if (forecast?.product_forecasts) return forecast.product_forecasts;
    const items = [
      { name: "Matcha Latte", base: 12, weatherSensitive: false },
      { name: "Iced Matcha", base: 9, weatherSensitive: true },
      { name: "Croissant", base: 7, weatherSensitive: false },
      { name: "Iced Latte", base: 8, weatherSensitive: true },
      { name: "Chai Latte", base: 6, weatherSensitive: false },
      { name: "Matcha Cheesecake", base: 4, weatherSensitive: false },
    ];
    return items.map(p => {
      const sunnyDays = weather.filter((w: any) => w.sunny).length;
      const weatherMultiplier = p.weatherSensitive ? 1 + (sunnyDays / 7) * 0.25 : 1;
      const f7 = Math.round(p.base * 7 * weatherMultiplier);
      const f14 = Math.round(p.base * 14 * weatherMultiplier * 0.97);
      const conf = Math.round(85 + Math.random() * 10);
      return { product: p.name, forecast_7d: f7, forecast_14d: f14, confidence: conf, weather_sensitive: p.weatherSensitive };
    });
  }, [forecast, weather]);

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl overflow-hidden">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Product Demand Forecast
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2.5 text-left font-medium">Product</th>
                  <th className="px-4 py-2.5 text-right font-medium">7d forecast</th>
                  <th className="px-4 py-2.5 text-right font-medium">14d forecast</th>
                  <th className="px-4 py-2.5 text-center font-medium">Confidence</th>
                  <th className="px-4 py-2.5 text-center font-medium">Weer</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p: any, i: number) => (
                  <tr key={i} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 font-medium">{p.product}</td>
                    <td className="px-4 py-2.5 text-right font-bold">{p.forecast_7d}</td>
                    <td className="px-4 py-2.5 text-right">{p.forecast_14d}</td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge variant={p.confidence >= 88 ? "default" : "outline"} className="text-[10px]">
                        {p.confidence}%
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {p.weather_sensitive && (
                        <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">
                          <Sun className="h-3 w-3 mr-0.5" /> gevoelig
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {forecast?.recommendations?.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5"><Sparkles className="h-4 w-4" /> Productadvies</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            {forecast.recommendations.map((r: string, i: number) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>{r}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Stock Forecast Sub-view ─────────────────────────────────────────────────

function StockView({ forecast, rangeDays }: any) {
  const stockItems = useMemo(() => {
    if (forecast?.predictions) return forecast.predictions;
    return [
      { item: "Volle melk", predicted_usage: 42, unit: "L", days_left: 4, confidence: "high", suggested_quantity: 50 },
      { item: "Matcha poeder", predicted_usage: 1.8, unit: "kg", days_left: 12, confidence: "high", suggested_quantity: 2 },
      { item: "Croissants", predicted_usage: 110, unit: "stuks", days_left: 2, confidence: "medium", suggested_quantity: 120 },
      { item: "Haver melk", predicted_usage: 18, unit: "L", days_left: 6, confidence: "high", suggested_quantity: 20 },
      { item: "Bekers 350ml", predicted_usage: 280, unit: "stuks", days_left: 14, confidence: "medium", suggested_quantity: 300 },
    ];
  }, [forecast]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stockItems.slice(0, 4).map((item: any, i: number) => (
          <Card key={i} className="rounded-2xl">
            <CardContent className="p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">{item.item}</div>
              <div className="text-xl font-bold">{item.predicted_usage} {item.unit}</div>
              <div className="flex items-center gap-1 mt-0.5">
                <Badge variant={item.days_left < 5 ? "destructive" : item.days_left < 10 ? "outline" : "default"} className="text-[10px] h-5">
                  {item.days_left} dagen over
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl overflow-hidden">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="h-4 w-4" /> Ingredient Forecast ({rangeDays}d)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2.5 text-left font-medium">Ingredient</th>
                  <th className="px-4 py-2.5 text-right font-medium">Verwacht gebruik</th>
                  <th className="px-4 py-2.5 text-right font-medium">Dagen over</th>
                  <th className="px-4 py-2.5 text-right font-medium">Bestel advies</th>
                  <th className="px-4 py-2.5 text-center font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {stockItems.map((item: any, i: number) => (
                  <tr key={i} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 font-medium">{item.item}</td>
                    <td className="px-4 py-2.5 text-right">{item.predicted_usage} {item.unit}</td>
                    <td className={cn("px-4 py-2.5 text-right font-bold",
                      item.days_left < 5 ? "text-destructive" : item.days_left < 10 ? "text-orange-500" : "text-green-600"
                    )}>{item.days_left}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{item.suggested_quantity} {item.unit}</td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge variant={item.confidence === "high" ? "default" : "outline"} className="text-[10px]">
                        {item.confidence}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {forecast?.alerts?.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> Voorraad Alerts</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            {forecast.alerts.map((a: any, i: number) => (
              <div key={i} className={cn("rounded-xl border p-3 text-sm",
                a.severity === "high" ? "bg-destructive/5 border-destructive/20" : "bg-orange-50 border-orange-200")}>
                <div className="font-medium">{a.type?.replace(/_/g, " ")}</div>
                <div className="text-muted-foreground">{a.message}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Staffing Forecast Sub-view ──────────────────────────────────────────────

function StaffingView({ forecast, rangeDays, weather }: any) {
  const staffingData = useMemo(() => {
    const hours = Array.from({ length: 12 }, (_, i) => {
      const hour = 8 + i;
      const isLunch = hour >= 12 && hour <= 14;
      const isMorning = hour >= 9 && hour <= 11;
      const baseLoad = isLunch ? 85 : isMorning ? 60 : 40;
      const weatherBoost = weather[0]?.sunny ? 12 : -5;
      const load = Math.min(100, baseLoad + weatherBoost + Math.round(Math.random() * 10));
      const staff = load > 75 ? 3 : load > 50 ? 2 : 1;
      return {
        hour: `${hour}:00`,
        load,
        recommended_staff: staff,
        risk: load > 80 ? "high" : load > 60 ? "medium" : "low",
      };
    });
    return hours;
  }, [weather]);

  const peakHour = staffingData.reduce((best, h) => h.load > best.load ? h : best, staffingData[0]);
  const totalStaffHours = staffingData.reduce((s, h) => s + h.recommended_staff, 0);

  const insights = forecast?.recommendations || [
    `Piekuur verwacht: ${peakHour.hour} (${peakHour.load}% capaciteit)`,
    peakHour.load > 80 ? "Overweeg extra medewerker tijdens lunch" : "Huidige bezetting lijkt toereikend",
    weather[0]?.sunny ? "Zonnig weer → hogere iced drinks vraag, prep station belasting" : "Bewolkt weer → standaard bezetting volstaat",
    `Totaal aanbevolen: ${totalStaffHours} werkuren morgen`,
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Piekuur</div>
            <div className="text-xl font-bold">{peakHour.hour}</div>
            <div className="text-xs text-muted-foreground">{peakHour.load}% belasting</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Werkuren morgen</div>
            <div className="text-xl font-bold">{totalStaffHours}u</div>
            <div className="text-xs text-muted-foreground">aanbevolen</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Max bezetting</div>
            <div className="text-xl font-bold">{Math.max(...staffingData.map(h => h.recommended_staff))}</div>
            <div className="text-xs text-muted-foreground">medewerkers tegelijk</div>
          </CardContent>
        </Card>
      </div>

      {/* Staffing heatmap */}
      <Card className="rounded-2xl overflow-hidden">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" /> Bezettingsadvies per uur
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="space-y-1.5">
            {staffingData.map((h, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs font-mono w-12 text-muted-foreground">{h.hour}</span>
                <div className="flex-1 h-7 rounded-lg overflow-hidden bg-muted/50 relative">
                  <div
                    className={cn(
                      "h-full rounded-lg transition-all",
                      h.risk === "high" ? "bg-destructive/70" : h.risk === "medium" ? "bg-orange-400/70" : "bg-green-500/50"
                    )}
                    style={{ width: `${h.load}%` }}
                  />
                  <span className="absolute inset-0 flex items-center px-2 text-[10px] font-medium">
                    {h.load}% — {h.recommended_staff} medewerker{h.recommended_staff > 1 ? "s" : ""}
                  </span>
                </div>
                {h.risk === "high" && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Insights */}
      <Card className="rounded-2xl">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5"><Brain className="h-4 w-4" /> Staffing Insights</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-2">
          {insights.map((r: string, i: number) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>{r}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Pricing Sub-view ────────────────────────────────────────────────────────

function PricingView({ forecast }: any) {
  const pricingData = useMemo(() => {
    if (forecast?.pricing_recommendations) return forecast.pricing_recommendations;
    return [
      { product: "Matcha Latte", current_margin: 78, suggested_price: 5.5, reason: "Marge onder target, stijgende inkoopkosten" },
      { product: "Iced Specials", current_margin: 82, suggested_price: null, reason: "Zonnig weekend → +€0.50 opslag mogelijk" },
      { product: "Croissant", current_margin: 65, suggested_price: 3.25, reason: "Lage marge, overweeg bundel-deal" },
    ];
  }, [forecast]);

  const healthStatus = forecast?.overall_health || "good";
  const avgMargin = forecast?.avg_margin || 76;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Gemiddelde marge</div>
            <div className="text-2xl font-bold">{avgMargin}%</div>
            <Badge variant={healthStatus === "good" ? "default" : healthStatus === "warning" ? "outline" : "destructive"} className="text-[10px] mt-1">
              {healthStatus === "good" ? "Gezond" : healthStatus === "warning" ? "Aandacht" : "Kritiek"}
            </Badge>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Prijsadvies</div>
            <div className="text-2xl font-bold">{pricingData.length}</div>
            <span className="text-xs text-muted-foreground">aanbevelingen</span>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl overflow-hidden">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="h-4 w-4" /> Prijsadvies
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2.5 text-left font-medium">Product</th>
                  <th className="px-4 py-2.5 text-right font-medium">Huidige marge</th>
                  <th className="px-4 py-2.5 text-right font-medium">Adviesprijs</th>
                  <th className="px-4 py-2.5 text-left font-medium">Reden</th>
                </tr>
              </thead>
              <tbody>
                {pricingData.map((p: any, i: number) => (
                  <tr key={i} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 font-medium">{p.product}</td>
                    <td className={cn("px-4 py-2.5 text-right font-bold", p.current_margin < 70 ? "text-destructive" : "text-green-600")}>{p.current_margin}%</td>
                    <td className="px-4 py-2.5 text-right font-bold">{p.suggested_price ? euro(p.suggested_price) : "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{p.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {forecast?.cost_alerts?.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> Kosten Alerts</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            {forecast.cost_alerts.map((a: any, i: number) => (
              <div key={i} className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm">
                <div className="font-medium">{a.item}</div>
                <div className="text-muted-foreground">{a.message}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default AIForecastCenter;
