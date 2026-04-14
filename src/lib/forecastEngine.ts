/**
 * Shared Forecast Engine — single source of truth for all forecast calculations.
 * Works only with live DB data, respects business hours, supports confidence scoring.
 */

import { isOpenHour, getOpenHours, getTotalOpenHours, getSchedule } from "@/lib/businessHours";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DailyFact {
  date: string;
  omzet: number;
  orders_count: number;
  avg_order_value: number;
  weekday: number;
  cash_revenue?: number | null;
  card_revenue?: number | null;
  season?: string;
  is_holiday?: boolean | null;
}

export interface HourlyFact {
  date: string;
  local_hour: number;
  omzet: number;
  orders_count: number;
  avg_order_value: number;
  weekday: number;
  staff_count?: number | null;
}

export interface WeatherDay {
  date: string;
  avg_temp_c: number | null;
  condition_code: string | null;
  is_rain: boolean | null;
  precipitation_chance: number | null;
  wind_speed: number | null;
  cloud_cover: number | null;
}

export interface InventoryItem {
  id: string;
  item_name: string;
  current_stock: number;
  unit_type: string;
  minimum_stock: number;
  cost_per_unit: number;
  avg_monthly_usage: number;
  category: string;
}

export interface StockMovement {
  inventory_item_id: string;
  movement_type: string;
  quantity: number;
  created_at: string;
  product_sold: string | null;
}

export interface ProductSale {
  product_name: string;
  quantity: number;
  date: string;
  weekday: number;
  local_hour: number;
}

export type ConfidenceLevel = "high" | "medium" | "low";

export interface ConfidenceInfo {
  score: number;
  level: ConfidenceLevel;
  reasons: string[];
}

// ─── Confidence Scoring ──────────────────────────────────────────────────────

export function computeConfidence(opts: {
  dataPoints: number;
  minDesired: number;
  rangeDays: number;
  hasWeather?: boolean;
  hasStaffing?: boolean;
  patternConsistency?: number; // 0-1
}): ConfidenceInfo {
  const reasons: string[] = [];
  let score = 80;

  // Data volume
  const ratio = Math.min(1, opts.dataPoints / opts.minDesired);
  score *= (0.4 + ratio * 0.6);
  if (ratio < 0.3) reasons.push("Zeer weinig historische data beschikbaar");
  else if (ratio < 0.6) reasons.push("Beperkte historische data");

  // Range penalty
  if (opts.rangeDays > 21) { score -= 12; reasons.push("Langere horizon verlaagt betrouwbaarheid"); }
  else if (opts.rangeDays > 14) score -= 6;

  // Weather bonus
  if (opts.hasWeather) score += 5;
  else reasons.push("Geen weer-correlatie data");

  // Staffing
  if (opts.hasStaffing === false) reasons.push("Geen personeelsdata beschikbaar");

  // Pattern consistency
  if (opts.patternConsistency !== undefined) {
    score *= (0.6 + opts.patternConsistency * 0.4);
    if (opts.patternConsistency < 0.3) reasons.push("Inconsistente patronen in historische data");
  }

  score = Math.max(10, Math.min(95, Math.round(score)));
  const level: ConfidenceLevel = score >= 70 ? "high" : score >= 45 ? "medium" : "low";

  return { score, level, reasons };
}

// ─── Weekday Aggregation ─────────────────────────────────────────────────────

export interface WeekdayPattern {
  weekday: number;
  label: string;
  avgOmzet: number;
  avgOrders: number;
  avgOrderValue: number;
  count: number;
}

const DAY_LABELS = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];

export function aggregateByWeekday(facts: DailyFact[]): WeekdayPattern[] {
  const agg: Record<number, { omzet: number; orders: number; count: number }> = {};
  facts.forEach(f => {
    if (!agg[f.weekday]) agg[f.weekday] = { omzet: 0, orders: 0, count: 0 };
    agg[f.weekday].omzet += f.omzet;
    agg[f.weekday].orders += f.orders_count;
    agg[f.weekday].count += 1;
  });
  return Object.entries(agg).map(([wd, d]) => ({
    weekday: Number(wd),
    label: DAY_LABELS[Number(wd)],
    avgOmzet: d.count > 0 ? d.omzet / d.count : 0,
    avgOrders: d.count > 0 ? d.orders / d.count : 0,
    avgOrderValue: d.orders > 0 ? d.omzet / d.orders : 0,
    count: d.count,
  })).sort((a, b) => a.weekday - b.weekday);
}

// ─── Hourly Aggregation (open hours only) ────────────────────────────────────

export interface HourlyPattern {
  hour: number;
  label: string;
  avgOmzet: number;
  avgOrders: number;
  count: number;
}

export function aggregateByHour(facts: HourlyFact[]): HourlyPattern[] {
  const agg: Record<number, { omzet: number; orders: number; count: number }> = {};
  facts.filter(h => isOpenHour(h.weekday, h.local_hour)).forEach(h => {
    if (!agg[h.local_hour]) agg[h.local_hour] = { omzet: 0, orders: 0, count: 0 };
    agg[h.local_hour].omzet += h.omzet;
    agg[h.local_hour].orders += h.orders_count;
    agg[h.local_hour].count += 1;
  });
  return Object.entries(agg).map(([hr, d]) => ({
    hour: Number(hr),
    label: `${hr}:00`,
    avgOmzet: d.count > 0 ? d.omzet / d.count : 0,
    avgOrders: d.count > 0 ? d.orders / d.count : 0,
    count: d.count,
  })).sort((a, b) => a.hour - b.hour);
}

// ─── Revenue Forecast ────────────────────────────────────────────────────────

export interface DayForecast {
  date: string;
  dayLabel: string;
  weekday: number;
  forecastOmzet: number;
  forecastOrders: number;
  weatherAdjustment: number; // pct
  weatherNote: string;
  basis: "historical" | "estimate";
}

export function forecastRevenue(
  dailyFacts: DailyFact[],
  weatherDays: WeatherDay[],
  futureDates: { date: string; weekday: number }[],
  weatherCorrelations: Record<string, number>, // pattern_key → uplift_pct
): { forecasts: DayForecast[]; totalForecast: number; confidence: ConfidenceInfo } {
  const weekdayPatterns = aggregateByWeekday(dailyFacts);
  const patternMap = Object.fromEntries(weekdayPatterns.map(p => [p.weekday, p]));

  // Recent trend: last 7 days vs prior 7 days
  const sorted = [...dailyFacts].sort((a, b) => a.date.localeCompare(b.date));
  const last7 = sorted.slice(-7);
  const prior7 = sorted.slice(-14, -7);
  let trendMultiplier = 1;
  if (last7.length >= 3 && prior7.length >= 3) {
    const avgRecent = last7.reduce((s, d) => s + d.omzet, 0) / last7.length;
    const avgPrior = prior7.reduce((s, d) => s + d.omzet, 0) / prior7.length;
    if (avgPrior > 0) trendMultiplier = Math.max(0.7, Math.min(1.3, avgRecent / avgPrior));
  }

  const forecasts: DayForecast[] = futureDates.map(fd => {
    const pattern = patternMap[fd.weekday];
    const weather = weatherDays.find(w => w.date === fd.date);

    let baseOmzet = pattern ? pattern.avgOmzet * trendMultiplier : 0;
    let baseOrders = pattern ? pattern.avgOrders * trendMultiplier : 0;
    let weatherAdj = 0;
    let weatherNote = "";

    if (weather && baseOmzet > 0) {
      // Temperature effect
      const temp = weather.avg_temp_c ?? 15;
      if (temp > 22) { weatherAdj += 8; weatherNote = "Warm weer boost"; }
      else if (temp > 18) { weatherAdj += 4; weatherNote = "Aangenaam weer"; }
      else if (temp < 5) { weatherAdj -= 8; weatherNote = "Koud weer"; }

      // Rain
      if (weather.is_rain || (weather.precipitation_chance ?? 0) > 60) {
        weatherAdj -= 12;
        weatherNote = "Regen drukt omzet";
      }

      // Wind
      if ((weather.wind_speed ?? 0) > 30) { weatherAdj -= 6; weatherNote += " + wind"; }

      // Sun / cloud
      if ((weather.cloud_cover ?? 50) < 30 && !weather.is_rain) {
        weatherAdj += 6;
        if (!weatherNote) weatherNote = "Zonnig weer boost";
      }

      // Apply learned correlations
      const condKey = weather.condition_code?.toLowerCase() || "";
      if (weatherCorrelations[condKey]) {
        weatherAdj += weatherCorrelations[condKey] * 0.5; // dampen
      }

      baseOmzet *= (1 + weatherAdj / 100);
      baseOrders *= (1 + weatherAdj / 100);
    }

    return {
      date: fd.date,
      dayLabel: DAY_LABELS[fd.weekday],
      weekday: fd.weekday,
      forecastOmzet: Math.round(baseOmzet * 100) / 100,
      forecastOrders: Math.round(baseOrders),
      weatherAdjustment: Math.round(weatherAdj),
      weatherNote: weatherNote || "Geen weer-effect",
      basis: pattern && pattern.count >= 2 ? "historical" : "estimate",
    };
  });

  const totalForecast = forecasts.reduce((s, f) => s + f.forecastOmzet, 0);

  const confidence = computeConfidence({
    dataPoints: dailyFacts.length,
    minDesired: 30,
    rangeDays: futureDates.length,
    hasWeather: weatherDays.length > 0,
  });

  return { forecasts, totalForecast, confidence };
}

// ─── Product Forecast ────────────────────────────────────────────────────────

export interface ProductForecastResult {
  productName: string;
  avgDailySales: number;
  forecast7d: number;
  forecast14d: number;
  forecast30d: number;
  trend: "up" | "down" | "stable";
  trendPct: number;
  weatherSensitive: boolean;
  confidence: ConfidenceLevel;
  daysOfData: number;
}

export function forecastProducts(
  sales: ProductSale[],
  rangeDays: number,
): ProductForecastResult[] {
  const byProduct: Record<string, ProductSale[]> = {};
  sales.forEach(s => {
    if (!byProduct[s.product_name]) byProduct[s.product_name] = [];
    byProduct[s.product_name].push(s);
  });

  const results: ProductForecastResult[] = [];
  const allDates = new Set(sales.map(s => s.date));
  const totalDays = allDates.size || 1;

  for (const [name, productSales] of Object.entries(byProduct)) {
    const totalQty = productSales.reduce((s, p) => s + p.quantity, 0);
    const avgDaily = totalQty / totalDays;

    // Recent vs older trend
    const sorted = [...productSales].sort((a, b) => a.date.localeCompare(b.date));
    const mid = Math.floor(sorted.length / 2);
    const recentHalf = sorted.slice(mid);
    const olderHalf = sorted.slice(0, mid);
    const recentAvg = recentHalf.length > 0 ? recentHalf.reduce((s, p) => s + p.quantity, 0) / Math.max(1, new Set(recentHalf.map(s => s.date)).size) : avgDaily;
    const olderAvg = olderHalf.length > 0 ? olderHalf.reduce((s, p) => s + p.quantity, 0) / Math.max(1, new Set(olderHalf.map(s => s.date)).size) : avgDaily;

    let trendPct = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;
    trendPct = Math.round(trendPct * 10) / 10;
    const trend = trendPct > 5 ? "up" : trendPct < -5 ? "down" : "stable";

    // Weather sensitivity: check if product sells more in warm hours
    const warmSales = productSales.filter(s => s.local_hour >= 12 && s.local_hour <= 17);
    const weatherSensitive = warmSales.length > productSales.length * 0.6;

    const forecastMultiplier = 1 + (trendPct / 100) * 0.5; // dampen trend
    const confidence: ConfidenceLevel = totalDays >= 14 ? "high" : totalDays >= 5 ? "medium" : "low";

    results.push({
      productName: name,
      avgDailySales: Math.round(avgDaily * 10) / 10,
      forecast7d: Math.round(avgDaily * 7 * forecastMultiplier),
      forecast14d: Math.round(avgDaily * 14 * forecastMultiplier),
      forecast30d: Math.round(avgDaily * 30 * forecastMultiplier),
      trend,
      trendPct,
      weatherSensitive,
      confidence,
      daysOfData: totalDays,
    });
  }

  return results.sort((a, b) => b.avgDailySales - a.avgDailySales);
}

// ─── Stock Forecast ──────────────────────────────────────────────────────────

export interface StockForecastResult {
  itemId: string;
  itemName: string;
  currentStock: number;
  unitType: string;
  avgDailyUsage: number;
  avgWeeklyUsage: number;
  recentWeekUsage: number;
  daysRemaining: number;
  demand7d: number;
  demand14d: number;
  demand30d: number;
  risk: "high" | "medium" | "low";
  reorderPriority: number; // 1=urgent
  confidence: ConfidenceLevel;
  movementDays: number;
}

export function forecastStock(
  items: InventoryItem[],
  movements: StockMovement[],
  productForecasts: ProductForecastResult[],
): StockForecastResult[] {
  const results: StockForecastResult[] = [];

  for (const item of items) {
    const itemMovements = movements.filter(m => m.inventory_item_id === item.id);
    const deductions = itemMovements.filter(m => m.movement_type === "sale_deduction" || m.movement_type === "waste");

    // Calculate daily usage from movements
    const movementDates = new Set(deductions.map(m => m.created_at.split("T")[0]));
    const movementDays = movementDates.size;
    const totalDeducted = deductions.reduce((s, m) => s + Math.abs(m.quantity), 0);
    const avgDailyUsage = movementDays > 0 ? totalDeducted / movementDays : item.avg_monthly_usage / 30;

    // Recent 7 day usage
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString();
    const recentDeductions = deductions.filter(m => m.created_at >= weekAgoStr);
    const recentWeekUsage = recentDeductions.reduce((s, m) => s + Math.abs(m.quantity), 0);

    const avgWeeklyUsage = avgDailyUsage * 7;
    const effectiveDaily = recentWeekUsage > 0 ? (recentWeekUsage / 7 * 0.6 + avgDailyUsage * 0.4) : avgDailyUsage;
    const daysRemaining = effectiveDaily > 0 ? item.current_stock / effectiveDaily : 999;

    const demand7d = Math.round(effectiveDaily * 7 * 10) / 10;
    const demand14d = Math.round(effectiveDaily * 14 * 10) / 10;
    const demand30d = Math.round(effectiveDaily * 30 * 10) / 10;

    const risk = daysRemaining <= 3 ? "high" : daysRemaining <= 7 ? "medium" : "low";
    const reorderPriority = daysRemaining <= 2 ? 1 : daysRemaining <= 5 ? 2 : daysRemaining <= 10 ? 3 : 4;
    const confidence: ConfidenceLevel = movementDays >= 14 ? "high" : movementDays >= 5 ? "medium" : "low";

    results.push({
      itemId: item.id,
      itemName: item.item_name,
      currentStock: item.current_stock,
      unitType: item.unit_type,
      avgDailyUsage: Math.round(avgDailyUsage * 100) / 100,
      avgWeeklyUsage: Math.round(avgWeeklyUsage * 100) / 100,
      recentWeekUsage: Math.round(recentWeekUsage * 100) / 100,
      daysRemaining: Math.round(daysRemaining * 10) / 10,
      demand7d,
      demand14d,
      demand30d,
      risk,
      reorderPriority,
      confidence,
      movementDays,
    });
  }

  return results.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

// ─── Staffing Forecast ───────────────────────────────────────────────────────

export interface StaffingHourResult {
  hour: number;
  label: string;
  avgOrders: number;
  avgOmzet: number;
  avgStaff: number | null;
  revenuePerStaff: number | null;
  ordersPerStaff: number | null;
  recommendedStaff: number;
  loadPct: number;
  weatherNote: string;
  dataSource: "actual" | "estimated";
  dayCount: number;
}

export interface StaffingDayResult {
  date: string;
  dayLabel: string;
  weekday: number;
  totalHours: number;
  peakHour: number;
  peakLoad: number;
  weatherNote: string;
  hours: StaffingHourResult[];
}

export function forecastStaffing(
  hourlyFacts: HourlyFact[],
  targetWeekday: number,
  weatherHours: { localHour: number; temperatureC: number; precipitationChance: number; windSpeed: number }[],
): StaffingHourResult[] {
  const openHrs = getOpenHours(targetWeekday);

  // Aggregate historical data for this weekday
  const sameDayFacts = hourlyFacts.filter(h => h.weekday === targetWeekday && isOpenHour(h.weekday, h.local_hour));
  const hourAgg: Record<number, { omzet: number; orders: number; staff: number; staffCount: number; count: number }> = {};
  sameDayFacts.forEach(h => {
    if (!hourAgg[h.local_hour]) hourAgg[h.local_hour] = { omzet: 0, orders: 0, staff: 0, staffCount: 0, count: 0 };
    hourAgg[h.local_hour].omzet += h.omzet;
    hourAgg[h.local_hour].orders += h.orders_count;
    if (h.staff_count && h.staff_count > 0) {
      hourAgg[h.local_hour].staff += h.staff_count;
      hourAgg[h.local_hour].staffCount += 1;
    }
    hourAgg[h.local_hour].count += 1;
  });

  // Global avg for fallback
  const allOpenFacts = hourlyFacts.filter(h => isOpenHour(h.weekday, h.local_hour));
  const globalAvgOrders = allOpenFacts.length > 0
    ? allOpenFacts.reduce((s, h) => s + h.orders_count, 0) / allOpenFacts.length
    : 0;

  return openHrs.map(hour => {
    const agg = hourAgg[hour];
    const weather = weatherHours.find(w => w.localHour === hour);

    let avgOrders = agg ? agg.orders / agg.count : globalAvgOrders;
    let avgOmzet = agg ? agg.omzet / agg.count : 0;
    const avgStaff = agg && agg.staffCount > 0 ? agg.staff / agg.staffCount : null;
    const dayCount = agg?.count || 0;

    // Weather adjustment
    let weatherNote = "";
    if (weather) {
      if (weather.precipitationChance > 60) { avgOrders *= 0.85; weatherNote = "Regen drukt traffic"; }
      if (weather.temperatureC > 22 && weather.precipitationChance < 30) { avgOrders *= 1.1; weatherNote = "Warm weer boost"; }
      if (weather.windSpeed > 30) { avgOrders *= 0.92; weatherNote += (weatherNote ? " + " : "") + "Wind"; }
    }

    const revenuePerStaff = avgStaff ? avgOmzet / avgStaff : null;
    const ordersPerStaff = avgStaff ? avgOrders / avgStaff : null;

    // Recommend staff: ~8-12 orders per person per hour is target
    const recommended = avgOrders > 0 ? Math.max(1, Math.ceil(avgOrders / 10)) : 1;
    const maxLoad = 15; // orders per person capacity
    const loadPct = avgOrders > 0 ? Math.min(100, Math.round((avgOrders / (recommended * maxLoad)) * 100)) : 0;

    return {
      hour,
      label: `${hour}:00`,
      avgOrders: Math.round(avgOrders * 10) / 10,
      avgOmzet: Math.round(avgOmzet * 100) / 100,
      avgStaff,
      revenuePerStaff: revenuePerStaff ? Math.round(revenuePerStaff * 100) / 100 : null,
      ordersPerStaff: ordersPerStaff ? Math.round(ordersPerStaff * 10) / 10 : null,
      recommendedStaff: recommended,
      loadPct,
      weatherNote,
      dataSource: dayCount > 0 ? "actual" as const : "estimated" as const,
      dayCount,
    };
  });
}

// ─── Pricing Analysis ────────────────────────────────────────────────────────

export interface PricingAdvice {
  productName: string;
  totalSold: number;
  totalRevenue: number;
  avgPrice: number;
  demandTrend: "up" | "down" | "stable";
  stockPressure: "high" | "normal" | "low";
  advice: "keep" | "raise" | "lower" | "insufficient";
  reason: string;
  buyingPrice?: number;
  margin?: number;
}

export function analyzePricing(
  productForecasts: ProductForecastResult[],
  productCosts: { product_name: string; buying_price: number; selling_price: number | null }[],
  stockForecasts: StockForecastResult[],
): PricingAdvice[] {
  const costMap = Object.fromEntries(productCosts.map(c => [c.product_name, c]));

  return productForecasts.map(pf => {
    const cost = costMap[pf.productName];
    const stock = stockForecasts.find(s => s.itemName.toLowerCase().includes(pf.productName.toLowerCase().split(" ")[0]));

    const stockPressure: "high" | "normal" | "low" = stock
      ? (stock.risk === "high" ? "high" : stock.risk === "medium" ? "normal" : "low")
      : "normal";

    let advice: "keep" | "raise" | "lower" | "insufficient" = "insufficient";
    let reason = "Onvoldoende data voor betrouwbaar advies.";

    if (pf.daysOfData >= 5) {
      if (pf.trend === "up" && stockPressure !== "high") {
        advice = "raise";
        reason = `Stijgende vraag (+${pf.trendPct}%) en voldoende voorraad. Prijsverhoging kan marge verhogen.`;
      } else if (pf.trend === "down" && pf.avgDailySales < 1) {
        advice = "lower";
        reason = `Dalende vraag (${pf.trendPct}%) en lage verkoopsnelheid. Overweeg promotie.`;
      } else {
        advice = "keep";
        reason = `Stabiele verkoop en geen directe voorraaddruk.`;
      }
    }

    const margin = cost && cost.selling_price ? ((cost.selling_price - cost.buying_price) / cost.selling_price) * 100 : undefined;

    return {
      productName: pf.productName,
      totalSold: pf.forecast7d,
      totalRevenue: 0, // filled from actual data
      avgPrice: cost?.selling_price ?? 0,
      demandTrend: pf.trend,
      stockPressure,
      advice,
      reason,
      buyingPrice: cost?.buying_price,
      margin: margin ? Math.round(margin * 10) / 10 : undefined,
    };
  }).filter(p => p.advice !== "insufficient" || p.avgPrice > 0);
}

// ─── Insufficient Data Check ─────────────────────────────────────────────────

export interface MissingData {
  key: string;
  label: string;
  description: string;
}

export function checkMissingData(opts: {
  dailyFacts: number;
  hourlyFacts: number;
  movements: number;
  staffRecords: number;
  weatherDays: number;
  productSales: number;
}): MissingData[] {
  const missing: MissingData[] = [];
  if (opts.dailyFacts < 3) missing.push({ key: "daily", label: "Verkoopdata", description: "Minder dan 3 dagen verkoophistorie" });
  if (opts.hourlyFacts < 10) missing.push({ key: "hourly", label: "Uurdata", description: "Onvoldoende uurlijkse verkoopdata" });
  if (opts.movements < 5) missing.push({ key: "stock", label: "Voorraaddata", description: "Weinig voorraadbewegingenhistorie" });
  if (opts.staffRecords === 0) missing.push({ key: "staff", label: "Personeelsdata", description: "Geen personeelsregistratie beschikbaar" });
  if (opts.weatherDays < 3) missing.push({ key: "weather", label: "Weerdata", description: "Onvoldoende weer-verkoophistorie" });
  if (opts.productSales < 5) missing.push({ key: "products", label: "Productdata", description: "Te weinig productverkopen voor forecast" });
  return missing;
}
