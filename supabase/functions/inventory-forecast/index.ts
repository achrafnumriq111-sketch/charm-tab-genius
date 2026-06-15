import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Schedule helpers (per-location aware) ──────────────────────────────────

interface DaySchedule { open: number; close: number; closed?: boolean }
interface ScheduleConfig {
  days: Record<number, DaySchedule>;
  exceptions: Record<string, DaySchedule & { label?: string }>;
}

const DEFAULT_SCHEDULE: ScheduleConfig = {
  days: {
    0: { open: 12, close: 24 },
    1: { open: 10, close: 22 },
    2: { open: 10, close: 22 },
    3: { open: 10, close: 22 },
    4: { open: 10, close: 22 },
    5: { open: 10, close: 24 },
    6: { open: 10, close: 24 },
  },
  exceptions: {},
};

function normalizeSchedule(raw: any): ScheduleConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_SCHEDULE;
  const days: Record<number, DaySchedule> = {};
  const src = raw.days && typeof raw.days === "object" ? raw.days : raw;
  for (let d = 0; d < 7; d++) {
    const e = src?.[d] ?? src?.[String(d)];
    if (e && typeof e === "object") {
      const open = Math.max(0, Math.min(23, Number(e.open) || 0));
      const close = Math.max(0, Math.min(30, Number(e.close) || 0));
      days[d] = { open, close, closed: !!e.closed || close <= open };
    } else {
      days[d] = DEFAULT_SCHEDULE.days[d];
    }
  }
  return { days, exceptions: raw.exceptions || {} };
}

function getOpenHoursForDate(date: Date, sc: ScheduleConfig): number[] {
  const ymd = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const dow = date.getDay();
  const day = sc.exceptions[ymd] ?? sc.days[dow];
  if (!day || day.closed || day.close <= day.open) return [];
  const out: number[] = [];
  for (let h = day.open; h < Math.min(day.close, 24); h++) out.push(h);
  if (day.close > 24) for (let h = 0; h < day.close - 24; h++) out.push(h);
  return out;
}

function isOpenHour(sc: ScheduleConfig, weekday: number, hour: number): boolean {
  const d = sc.days[weekday];
  if (!d || d.closed) return false;
  if (hour >= d.open && hour < Math.min(d.close, 24)) return true;
  if (d.close > 24 && hour < d.close - 24) return true;
  return false;
}

// ─── NL Public holidays (hardcoded, 2026–2028) ──────────────────────────────

const NL_HOLIDAYS: Record<string, string> = {
  "2026-01-01": "Nieuwjaarsdag", "2026-04-03": "Goede Vrijdag", "2026-04-05": "Pasen",
  "2026-04-06": "2e Paasdag", "2026-04-27": "Koningsdag", "2026-05-05": "Bevrijdingsdag",
  "2026-05-14": "Hemelvaart", "2026-05-24": "Pinksteren", "2026-05-25": "2e Pinksterdag",
  "2026-12-25": "1e Kerstdag", "2026-12-26": "2e Kerstdag", "2026-12-31": "Oudejaarsdag",
  "2027-01-01": "Nieuwjaarsdag", "2027-03-26": "Goede Vrijdag", "2027-03-28": "Pasen",
  "2027-03-29": "2e Paasdag", "2027-04-27": "Koningsdag", "2027-05-05": "Bevrijdingsdag",
  "2027-05-06": "Hemelvaart", "2027-05-16": "Pinksteren", "2027-05-17": "2e Pinksterdag",
  "2027-12-25": "1e Kerstdag", "2027-12-26": "2e Kerstdag", "2027-12-31": "Oudejaarsdag",
};

// NL school vacations (Regio Midden — Amsterdam) — approximate
const NL_VACATIONS: Array<{ start: string; end: string; label: string }> = [
  { start: "2026-02-21", end: "2026-03-01", label: "Voorjaarsvakantie" },
  { start: "2026-04-25", end: "2026-05-10", label: "Meivakantie" },
  { start: "2026-07-18", end: "2026-08-30", label: "Zomervakantie" },
  { start: "2026-10-17", end: "2026-10-25", label: "Herfstvakantie" },
  { start: "2026-12-19", end: "2027-01-03", label: "Kerstvakantie" },
];

function vacationFor(dateStr: string): string | null {
  for (const v of NL_VACATIONS) if (dateStr >= v.start && dateStr <= v.end) return v.label;
  return null;
}

// ─── Stats helpers ──────────────────────────────────────────────────────────

function avg(arr: number[]): number { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0; }
function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = avg(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}
function round(n: number, p = 2): number { const f = Math.pow(10, p); return Math.round(n * f) / f; }

// ─── Weather impact on a daily forecast factor ──────────────────────────────

function weatherFactor(w: any): { factor: number; note: string } {
  if (!w) return { factor: 1, note: "" };
  let f = 1; const notes: string[] = [];
  const t = w.avg_temp_c ?? w.maxTempC ?? 15;
  const rain = w.is_rain || (w.precipitation_chance ?? 0) > 60;
  const wind = (w.wind_speed ?? 0) > 35;
  if (t > 24) { f *= 1.10; notes.push("warm +10%"); }
  else if (t > 20) { f *= 1.04; notes.push("mild +4%"); }
  else if (t < 5) { f *= 0.92; notes.push("koud -8%"); }
  if (rain) { f *= 0.86; notes.push("regen -14%"); }
  if (wind) { f *= 0.95; notes.push("wind -5%"); }
  if ((w.cloud_cover ?? 50) < 25 && !rain) { f *= 1.05; notes.push("zon +5%"); }
  return { factor: f, note: notes.join(", ") };
}

// ─── Main handler ───────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const { type = "revenue", range = 7, location_id = null, schedule: scheduleRaw = null } = body as any;
    const schedule = normalizeSchedule(scheduleRaw);

    // Build location-scoped queries
    const lf = (q: any) => (location_id ? q.eq("location_id", location_id) : q);

    const [
      inventoryRes, movementsRes, transactionsRes,
      dailyFactsRes, hourlyFactsRes, weatherDailyRes, correlationsRes, productCostsRes,
      recipesRes, locationsRes,
    ] = await Promise.all([
      lf(supabase.from("inventory_items").select("*")),
      lf(supabase.from("stock_movements").select("*").order("created_at", { ascending: false }).limit(3000)),
      lf(supabase.from("pos_transactions").select("created_at, items, total, payment_method, employee_name, location_id").order("created_at", { ascending: false }).limit(3000)),
      lf(supabase.from("business_daily_facts").select("*").order("date", { ascending: false }).limit(120)),
      lf(supabase.from("business_hourly_facts").select("*").order("date", { ascending: false }).limit(3000)),
      supabase.from("weather_daily_observations").select("date, avg_temp_c, condition_code, is_rain, precipitation_chance, wind_speed, cloud_cover").order("date", { ascending: false }).limit(120),
      lf(supabase.from("weather_business_correlations").select("*").limit(200)),
      lf(supabase.from("product_costs").select("*")),
      lf(supabase.from("product_recipes").select("*")),
      supabase.from("locations").select("id, name, city, tenant_id"),
    ]);

    const inventory = inventoryRes.data || [];
    const movements = movementsRes.data || [];
    const transactions = transactionsRes.data || [];
    const dailyFacts = dailyFactsRes.data || [];
    const hourlyFacts = (hourlyFactsRes.data || []).filter((h: any) => isOpenHour(schedule, h.weekday, h.local_hour));
    const weatherDaily = weatherDailyRes.data || [];
    const correlations = correlationsRes.data || [];
    const productCosts = productCostsRes.data || [];
    const recipes = recipesRes.data || [];
    const locations = locationsRes.data || [];

    // ─ Product sales aggregate ────────────────────────────────────────────
    const productSales: Record<string, { qty: number; revenue: number; dates: Set<string>; byDate: Record<string, number> }> = {};
    transactions.forEach((t: any) => {
      const date = t.created_at?.split("T")[0];
      const items = Array.isArray(t.items) ? t.items : [];
      items.forEach((item: any) => {
        const name = item.name || item.product_name || "Unknown";
        if (!productSales[name]) productSales[name] = { qty: 0, revenue: 0, dates: new Set(), byDate: {} };
        const q = (item.quantity || 1);
        productSales[name].qty += q;
        productSales[name].revenue += (item.price || 0) * q;
        if (date) {
          productSales[name].dates.add(date);
          productSales[name].byDate[date] = (productSales[name].byDate[date] || 0) + q;
        }
      });
    });

    const dataQuality = {
      dailyFactDays: dailyFacts.length,
      hourlyFactRecords: hourlyFacts.length,
      transactionCount: transactions.length,
      movementCount: movements.length,
      weatherDays: weatherDaily.length,
      correlationCount: correlations.length,
      productCount: Object.keys(productSales).length,
      hasStaffing: hourlyFacts.some((h: any) => h.staff_count > 0),
      recipeCount: recipes.length,
      locationCount: locations.length,
      locationScoped: !!location_id,
    };

    // ─ Weekday pattern (open hours only via daily total — daily already aggregates) ──
    const weekdayAgg: Record<number, { omzet: number[]; orders: number[] }> = {};
    dailyFacts.forEach((d: any) => {
      if (!weekdayAgg[d.weekday]) weekdayAgg[d.weekday] = { omzet: [], orders: [] };
      weekdayAgg[d.weekday].omzet.push(Number(d.omzet) || 0);
      weekdayAgg[d.weekday].orders.push(Number(d.orders_count) || 0);
    });
    const weekdayPatterns = Object.entries(weekdayAgg).map(([wd, d]) => ({
      weekday: Number(wd),
      avgOmzet: avg(d.omzet),
      avgOrders: avg(d.orders),
      stdOmzet: stddev(d.omzet),
      sampleSize: d.omzet.length,
      consistency: d.omzet.length > 1 ? 1 - (stddev(d.omzet) / (avg(d.omzet) || 1)) : 0.5,
    }));

    // ─ Hourly pattern (open hours only) ──────────────────────────────────
    const hourlyAgg: Record<string, { omzet: number[]; orders: number[]; staff: number[] }> = {};
    hourlyFacts.forEach((h: any) => {
      const key = `${h.weekday}-${h.local_hour}`;
      if (!hourlyAgg[key]) hourlyAgg[key] = { omzet: [], orders: [], staff: [] };
      hourlyAgg[key].omzet.push(Number(h.omzet) || 0);
      hourlyAgg[key].orders.push(Number(h.orders_count) || 0);
      if (h.staff_count > 0) hourlyAgg[key].staff.push(Number(h.staff_count));
    });
    const hourlyPatterns = Object.entries(hourlyAgg).map(([k, d]) => {
      const [wd, hr] = k.split("-").map(Number);
      return { weekday: wd, hour: hr, avgOmzet: avg(d.omzet), avgOrders: avg(d.orders), avgStaff: d.staff.length ? avg(d.staff) : null, sampleSize: d.omzet.length };
    });

    // Hour-only collapse for legacy UI compat
    const hourOnlyAgg: Record<number, { omzet: number[]; orders: number[] }> = {};
    hourlyFacts.forEach((h: any) => {
      if (!hourOnlyAgg[h.local_hour]) hourOnlyAgg[h.local_hour] = { omzet: [], orders: [] };
      hourOnlyAgg[h.local_hour].omzet.push(Number(h.omzet) || 0);
      hourOnlyAgg[h.local_hour].orders.push(Number(h.orders_count) || 0);
    });
    const hourlyPatternsLegacy = Object.entries(hourOnlyAgg).map(([hr, d]) => ({
      hour: Number(hr), avgOmzet: avg(d.omzet), avgOrders: avg(d.orders), sampleSize: d.omzet.length,
    })).sort((a, b) => a.hour - b.hour);

    // ─ Per-day forward forecast with low/expected/high + weather + holiday ──
    const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Amsterdam" }));
    today.setHours(0, 0, 0, 0);

    const buildForecastDays = (days: number, startOffset = 0) => {
      const out: any[] = [];
      for (let i = 0; i < days; i++) {
        const d = new Date(today); d.setDate(d.getDate() + startOffset + i);
        const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const dow = d.getDay();
        const wp = weekdayPatterns.find(p => p.weekday === dow);
        const w = weatherDaily.find((x: any) => x.date === ymd);
        const wf = weatherFactor(w);
        const holiday = NL_HOLIDAYS[ymd] || null;
        const vacation = vacationFor(ymd);
        const openHrs = getOpenHoursForDate(d, schedule);

        // Holiday lift: most NL restaurant categories see ±10% (Koningsdag/Kerst +20%, others +5%)
        let holidayFactor = 1;
        if (holiday) {
          if (/Koningsdag|Oudejaar|Bevrijdingsdag/.test(holiday)) holidayFactor = 1.20;
          else if (/Kerst/.test(holiday)) holidayFactor = 0.70; // many shops closed/quiet
          else holidayFactor = 1.05;
        }
        if (vacation) holidayFactor *= 1.06;

        const base = wp?.avgOmzet ?? 0;
        const std = wp?.stdOmzet ?? base * 0.2;
        const expected = base * wf.factor * holidayFactor;
        const low = Math.max(0, (base - std) * wf.factor * holidayFactor * 0.92);
        const high = (base + std) * wf.factor * holidayFactor * 1.08;

        out.push({
          date: ymd, weekday: dow,
          open: openHrs.length > 0,
          openHours: openHrs.length,
          openLabel: openHrs.length ? `${openHrs[0]}:00-${(openHrs[openHrs.length - 1] + 1) % 24}:00` : "Gesloten",
          low: round(low), expected: round(expected), high: round(high),
          weatherFactor: round(wf.factor, 3),
          weatherNote: wf.note,
          weatherIcon: w?.is_rain ? "🌧" : (w?.cloud_cover ?? 50) > 70 ? "☁" : "☀",
          holiday, vacation,
          baseAvg: round(base), stddev: round(std),
        });
      }
      return out;
    };

    // ─ Trend ─────────────────────────────────────────────────────────────
    const sortedDF = [...dailyFacts].sort((a: any, b: any) => a.date.localeCompare(b.date));
    const last7 = sortedDF.slice(-7); const prior7 = sortedDF.slice(-14, -7);
    const recentAvg = last7.length ? avg(last7.map((d: any) => Number(d.omzet))) : 0;
    const priorAvg = prior7.length ? avg(prior7.map((d: any) => Number(d.omzet))) : recentAvg;
    const trendPct = priorAvg > 0 ? ((recentAvg - priorAvg) / priorAvg) * 100 : 0;

    // ─ Confidence score ──────────────────────────────────────────────────
    function computeConfidence(periodDays: number) {
      let score = 50;
      const reasons: string[] = [];
      if (dailyFacts.length >= 60) { score += 20; reasons.push("60+ dagen historie"); }
      else if (dailyFacts.length >= 30) { score += 12; reasons.push("30+ dagen historie"); }
      else if (dailyFacts.length >= 14) { score += 6; reasons.push("14+ dagen historie"); }
      else { score -= 10; reasons.push("weinig historie"); }
      const avgConsistency = avg(weekdayPatterns.map(p => Math.max(0, Math.min(1, p.consistency))));
      score += Math.round(avgConsistency * 15);
      if (avgConsistency > 0.7) reasons.push("stabiele patronen");
      else if (avgConsistency < 0.4) reasons.push("schommelend gedrag");
      if (weatherDaily.length >= periodDays) { score += 8; reasons.push("weervoorspelling beschikbaar"); }
      else { score -= 5; reasons.push("beperkte weerdata"); }
      if (periodDays > 14) { score -= 8; reasons.push("lange horizon"); }
      score = Math.max(10, Math.min(95, score));
      return { score, level: score >= 75 ? "high" : score >= 55 ? "medium" : "low", reasons };
    }

    // ─ Build response per type ───────────────────────────────────────────
    let result: any = { dataQuality };

    if (type === "revenue") {
      const forecastDays = buildForecastDays(range);
      // Previous period: same length, ending today (so we can compare)
      const previousPeriod = sortedDF.slice(-range).map((d: any) => ({
        date: d.date, weekday: d.weekday, actual: Number(d.omzet) || 0,
      }));

      // Backtest: re-forecast each of the last N days using only data prior to that day
      const backtest: any[] = [];
      const sortedAsc = sortedDF;
      const backtestN = Math.min(14, sortedAsc.length);
      for (let i = sortedAsc.length - backtestN; i < sortedAsc.length; i++) {
        const d: any = sortedAsc[i]; if (!d) continue;
        const prior = sortedAsc.slice(Math.max(0, i - 60), i);
        const sameDow = prior.filter((p: any) => p.weekday === d.weekday).map((p: any) => Number(p.omzet) || 0);
        const wp = sameDow.length ? avg(sameDow) : 0;
        const w = weatherDaily.find((x: any) => x.date === d.date);
        const wf = weatherFactor(w).factor;
        const forecast = wp * wf;
        const actual = Number(d.omzet) || 0;
        const diff = forecast > 0 ? ((actual - forecast) / forecast) * 100 : 0;
        backtest.push({ date: d.date, forecast: round(forecast), actual: round(actual), diffPct: round(diff, 1) });
      }
      const mape = backtest.length ? avg(backtest.map(b => Math.abs(b.diffPct))) : null;

      const forecastTotal = forecastDays.reduce((s, d) => s + d.expected, 0);
      const prevTotal = previousPeriod.reduce((s, d) => s + d.actual, 0);
      const growthPct = prevTotal > 0 ? ((forecastTotal - prevTotal) / prevTotal) * 100 : 0;

      // AI Insights bullets
      const insights: string[] = [];
      const bestForecast = [...forecastDays].sort((a, b) => b.expected - a.expected)[0];
      const worstForecast = [...forecastDays].sort((a, b) => a.expected - b.expected)[0];
      const dnames = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];
      if (bestForecast) insights.push(`Beste dag verwacht: ${dnames[bestForecast.weekday]} ${bestForecast.date} (€${bestForecast.expected.toFixed(0)})`);
      if (worstForecast && worstForecast.date !== bestForecast?.date) insights.push(`Zwakste dag verwacht: ${dnames[worstForecast.weekday]} ${worstForecast.date} (€${worstForecast.expected.toFixed(0)})`);
      if (trendPct > 5) insights.push(`Sterke groei: omzet +${trendPct.toFixed(1)}% t.o.v. vorige week`);
      else if (trendPct < -5) insights.push(`Dalende trend: ${trendPct.toFixed(1)}% t.o.v. vorige week`);
      const holidayDays = forecastDays.filter(d => d.holiday);
      if (holidayDays.length) insights.push(`${holidayDays.length} feestdag(en) in deze periode: ${holidayDays.map(h => h.holiday).join(", ")}`);
      const rainyDays = forecastDays.filter(d => /regen/.test(d.weatherNote));
      if (rainyDays.length >= 2) insights.push(`${rainyDays.length} regendagen verwacht — omzet mogelijk lager`);
      if (mape !== null) insights.push(`Historische forecastfout: gemiddeld ${mape.toFixed(1)}% (lager = nauwkeuriger)`);

      result = {
        ...result, weekdayPatterns,
        hourlyPatterns: hourlyPatternsLegacy, hourlyPatternsByWeekday: hourlyPatterns,
        trendPct: round(trendPct, 1), recentAvgDaily: round(recentAvg),
        totalDays: dailyFacts.length,
        forecastDays, previousPeriod, backtest, mape: mape !== null ? round(mape, 1) : null,
        forecastTotal: round(forecastTotal), prevTotal: round(prevTotal), growthPct: round(growthPct, 1),
        confidence: computeConfidence(range),
        upcomingWeather: weatherDaily.filter((w: any) => w.date >= today.toISOString().slice(0, 10)).slice(0, range),
        insights,
      };

    } else if (type === "product") {
      const totalDays = new Set(transactions.map((t: any) => t.created_at?.split("T")[0])).size || 1;
      const half = Math.floor(totalDays / 2);
      const cutoffDate = (() => {
        const d = new Date(today); d.setDate(d.getDate() - half); return d.toISOString().slice(0, 10);
      })();
      const productList = Object.entries(productSales).map(([name, data]) => {
        let recentQty = 0, prevQty = 0;
        Object.entries(data.byDate).forEach(([dt, q]) => {
          if (dt >= cutoffDate) recentQty += q; else prevQty += q;
        });
        const avgDaily = data.qty / totalDays;
        const growthPct = prevQty > 0 ? ((recentQty - prevQty) / prevQty) * 100 : (recentQty > 0 ? 100 : 0);
        const daysActive = data.dates.size;
        const productConfidence = daysActive >= 21 ? "high" : daysActive >= 7 ? "medium" : "low";
        return {
          name, totalQty: data.qty, totalRevenue: round(data.revenue),
          avgDaily: round(avgDaily, 1), daysActive,
          recentQty, prevQty, growthPct: round(growthPct, 1),
          confidence: productConfidence,
        };
      }).sort((a, b) => b.totalQty - a.totalQty);
      result = { ...result, products: productList, totalDays, totalProducts: productList.length, confidence: computeConfidence(range) };

    } else if (type === "stock") {
      const itemMovements: Record<string, { deductions: number; restocks: number; dates: Set<string> }> = {};
      movements.forEach((m: any) => {
        if (!itemMovements[m.inventory_item_id]) itemMovements[m.inventory_item_id] = { deductions: 0, restocks: 0, dates: new Set() };
        if (m.movement_type === "sale_deduction" || m.movement_type === "waste") {
          itemMovements[m.inventory_item_id].deductions += Math.abs(Number(m.quantity) || 0);
        } else if (m.movement_type === "stock_intake") {
          itemMovements[m.inventory_item_id].restocks += Number(m.quantity) || 0;
        }
        if (m.created_at) itemMovements[m.inventory_item_id].dates.add(m.created_at.split("T")[0]);
      });
      const stockItems = inventory.map((item: any) => {
        const mv = itemMovements[item.id] || { deductions: 0, restocks: 0, dates: new Set() };
        const movDays = mv.dates.size || 1;
        const avgDailyUsage = mv.deductions / movDays;
        const daysRemaining = avgDailyUsage > 0 ? item.current_stock / avgDailyUsage : 999;
        const minStock = Number(item.minimum_stock) || 0;
        const stockBelowMin = item.current_stock < minStock;
        let status: "healthy" | "low" | "critical" = "healthy";
        if (daysRemaining <= 3 || stockBelowMin) status = "critical";
        else if (daysRemaining <= 7 || (minStock > 0 && item.current_stock < minStock * 1.5)) status = "low";
        const reorderQty = Math.max(0, round(avgDailyUsage * 14 - item.current_stock, 1));
        return {
          id: item.id, name: item.item_name, currentStock: item.current_stock, unit: item.unit_type,
          minStock, avgDailyUsage: round(avgDailyUsage), daysRemaining: round(daysRemaining, 1),
          demand7d: round(avgDailyUsage * 7, 1), demand14d: round(avgDailyUsage * 14, 1), demand30d: round(avgDailyUsage * 30, 1),
          movementDays: movDays, status, stockBelowMin,
          // legacy field for back-compat
          risk: status === "critical" ? "high" : status === "low" ? "medium" : "low",
          reorderQty, supplier: item.supplier || null,
        };
      }).sort((a: any, b: any) => a.daysRemaining - b.daysRemaining);
      result = {
        ...result, items: stockItems, totalItems: inventory.length,
        critical: stockItems.filter((i: any) => i.status === "critical").length,
        low: stockItems.filter((i: any) => i.status === "low").length,
        healthy: stockItems.filter((i: any) => i.status === "healthy").length,
        // legacy
        highRisk: stockItems.filter((i: any) => i.status === "critical").length,
        mediumRisk: stockItems.filter((i: any) => i.status === "low").length,
      };

    } else if (type === "staffing") {
      // Per-day forecast for next `range` days
      const forecastDays = buildForecastDays(range);
      const dayForecasts = forecastDays.map(d => {
        const expectedOrders = (weekdayPatterns.find(p => p.weekday === d.weekday)?.avgOrders ?? 0) * d.weatherFactor;
        const recommendedStaffHours = expectedOrders > 0 ? Math.ceil(expectedOrders / 10) * d.openHours : 0;
        // Historical avg staff for that weekday
        const avgScheduledHrs = hourlyPatterns
          .filter(p => p.weekday === d.weekday && p.avgStaff != null)
          .reduce((s, p) => s + (p.avgStaff || 0), 0);
        const delta = avgScheduledHrs > 0 ? recommendedStaffHours - avgScheduledHrs : null;
        const status: "understaffed" | "overstaffed" | "ok" | "unknown" =
          delta === null ? "unknown" : delta > 2 ? "understaffed" : delta < -2 ? "overstaffed" : "ok";
        return {
          date: d.date, weekday: d.weekday, openHours: d.openHours,
          expectedOrders: round(expectedOrders, 1),
          recommendedStaffHours, scheduledStaffHours: round(avgScheduledHrs, 1) || null,
          delta: delta !== null ? round(delta, 1) : null, status,
          weatherNote: d.weatherNote, holiday: d.holiday,
        };
      });
      result = {
        ...result, patterns: hourlyPatterns, dayForecasts,
        hasStaffData: hourlyPatterns.some(p => p.avgStaff != null),
        upcomingWeather: weatherDaily.filter((w: any) => w.date >= today.toISOString().slice(0, 10)).slice(0, range),
        confidence: computeConfidence(range),
      };

    } else if (type === "purchasing") {
      // Forecast product qty for next `range` days, then explode via recipes
      const totalDays = new Set(transactions.map((t: any) => t.created_at?.split("T")[0])).size || 1;
      const productForecast: Record<string, number> = {};
      Object.entries(productSales).forEach(([name, d]) => {
        productForecast[name] = (d.qty / totalDays) * range;
      });
      // Aggregate ingredient demand
      const ingredientDemand: Record<string, number> = {};
      recipes.forEach((r: any) => {
        const qtyForecast = productForecast[r.product_name] ?? 0;
        if (qtyForecast <= 0) return;
        const need = qtyForecast * Number(r.quantity) * (1 + Number(r.waste_factor_pct) / 100);
        ingredientDemand[r.inventory_item_id] = (ingredientDemand[r.inventory_item_id] || 0) + need;
      });
      const recommendations = inventory.map((item: any) => {
        const needed = ingredientDemand[item.id] || 0;
        const shortage = Math.max(0, needed - item.current_stock);
        return {
          id: item.id, name: item.item_name, unit: item.unit_type,
          currentStock: round(item.current_stock, 2), neededQty: round(needed, 2),
          shortage: round(shortage, 2),
          orderQty: shortage > 0 ? round(shortage * 1.15, 2) : 0, // +15% buffer
          supplier: item.supplier || null,
          costPerUnit: Number(item.cost_per_unit) || 0,
          estimatedCost: round(shortage * (Number(item.cost_per_unit) || 0) * 1.15, 2),
        };
      }).filter((r: any) => r.neededQty > 0 || r.shortage > 0)
        .sort((a: any, b: any) => b.shortage - a.shortage);
      const totalCost = recommendations.reduce((s: number, r: any) => s + r.estimatedCost, 0);
      result = {
        ...result, recommendations, range, totalEstimatedCost: round(totalCost),
        productForecast: Object.entries(productForecast).map(([name, qty]) => ({ name, qty: round(qty, 1) })).sort((a, b) => b.qty - a.qty),
        hasRecipes: recipes.length > 0,
      };

    } else if (type === "pricing") {
      // unchanged legacy
      const totalDays = new Set(transactions.map((t: any) => t.created_at?.split("T")[0])).size || 1;
      const productList = Object.entries(productSales).map(([name, data]) => {
        const cost = productCosts.find((c: any) => c.product_name === name);
        const avgPrice = data.qty > 0 ? data.revenue / data.qty : 0;
        const margin = cost ? ((avgPrice - cost.buying_price) / avgPrice) * 100 : null;
        return {
          name, totalQty: data.qty, totalRevenue: round(data.revenue),
          avgPrice: round(avgPrice), avgDaily: round(data.qty / totalDays, 1),
          buyingPrice: cost?.buying_price || null, sellingPrice: cost?.selling_price || null,
          margin: margin !== null ? round(margin, 1) : null, daysActive: data.dates.size,
        };
      }).sort((a, b) => b.totalRevenue - a.totalRevenue);
      result = { ...result, products: productList, totalDays };

    } else if (type === "actual_vs_forecast") {
      // Backtest the last N days
      const sortedAsc = sortedDF;
      const N = Math.min(range, sortedAsc.length);
      const backtest: any[] = [];
      for (let i = sortedAsc.length - N; i < sortedAsc.length; i++) {
        const d: any = sortedAsc[i]; if (!d) continue;
        const prior = sortedAsc.slice(Math.max(0, i - 60), i);
        const sameDow = prior.filter((p: any) => p.weekday === d.weekday).map((p: any) => Number(p.omzet) || 0);
        const wp = sameDow.length ? avg(sameDow) : 0;
        const w = weatherDaily.find((x: any) => x.date === d.date);
        const wf = weatherFactor(w).factor;
        const forecast = wp * wf;
        const actual = Number(d.omzet) || 0;
        const diff = forecast > 0 ? ((actual - forecast) / forecast) * 100 : 0;
        backtest.push({ date: d.date, weekday: d.weekday, forecast: round(forecast), actual: round(actual), diffPct: round(diff, 1) });
      }
      const totalForecast = backtest.reduce((s, b) => s + b.forecast, 0);
      const totalActual = backtest.reduce((s, b) => s + b.actual, 0);
      const totalDiffPct = totalForecast > 0 ? ((totalActual - totalForecast) / totalForecast) * 100 : 0;
      const mape = backtest.length ? avg(backtest.map(b => Math.abs(b.diffPct))) : 0;
      const accuracy = Math.max(0, 100 - mape);
      result = {
        ...result, backtest,
        totalForecast: round(totalForecast), totalActual: round(totalActual),
        diffPct: round(totalDiffPct, 1), mape: round(mape, 1), accuracy: round(accuracy, 1),
      };

    } else if (type === "multi_location") {
      // Forecast per location for next `range` days
      const perLoc: any[] = [];
      for (const loc of locations) {
        const locFacts = (await supabase.from("business_daily_facts").select("*").eq("location_id", loc.id).order("date", { ascending: false }).limit(60)).data || [];
        const wd: Record<number, number[]> = {};
        locFacts.forEach((d: any) => { (wd[d.weekday] = wd[d.weekday] || []).push(Number(d.omzet) || 0); });
        let total = 0;
        for (let i = 0; i < range; i++) {
          const d = new Date(today); d.setDate(d.getDate() + i);
          const samples = wd[d.getDay()] || [];
          const wmean = samples.length ? avg(samples) : 0;
          const wxh = weatherDaily.find((x: any) => x.date === d.toISOString().slice(0, 10));
          total += wmean * weatherFactor(wxh).factor;
        }
        perLoc.push({
          locationId: loc.id, name: loc.name, city: loc.city,
          forecastTotal: round(total), days: locFacts.length,
        });
      }
      perLoc.sort((a, b) => b.forecastTotal - a.forecastTotal);
      result = { ...result, locations: perLoc, grandTotal: round(perLoc.reduce((s, l) => s + l.forecastTotal, 0)) };
    }

    return new Response(JSON.stringify({ success: true, data: result, type, range, location_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("inventory-forecast error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
