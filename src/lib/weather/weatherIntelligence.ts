/**
 * Weather normalization, impact engine, and forecast intelligence.
 * All weather data flows through these normalized types.
 */

// ─── Normalized types ────────────────────────────────────────────────────────

export interface NormalizedCurrentWeather {
  asOf: string;
  conditionCode: string;
  conditionLabel: string;
  icon: string;
  temperatureC: number;
  feelsLikeC: number;
  humidity: number;
  windSpeed: number;
  uvIndex: number;
  visibility: number;
  pressure: number;
  precipitationChance: number;
  cloudCover: number;
  city: string;
}

export interface NormalizedDailyWeather {
  date: string;
  dayLabel: string;
  dayOfWeek: number;
  conditionCode: string;
  conditionLabel: string;
  icon: string;
  minTempC: number;
  maxTempC: number;
  avgTempC: number;
  precipitationChance: number;
  humidity: number;
  windSpeed: number;
  cloudCover: number;
  pressure: number;
  visibility: number;
  uvIndex: number;
  sunny: boolean;
  isRain: boolean;
  isStorm: boolean;
  isSevere: boolean;
  isWeekend: boolean;
  impactScore: number;
  impactLabel: string;
  confidence: number;
}

export interface NormalizedHourlyWeather {
  datetime: string;
  localHour: number;
  date: string;
  conditionCode: string;
  conditionLabel: string;
  icon: string;
  temperatureC: number;
  feelsLikeC: number;
  precipitationChance: number;
  precipitationIntensity: number;
  humidity: number;
  windSpeed: number;
  cloudCover: number;
  pressure: number;
  visibility: number;
  uvIndex: number;
  isDaylight: boolean;
}

export interface WeatherSummary {
  sunnyDays: number;
  rainyDays: number;
  avgImpact: number;
  avgTemp: number;
  trend: "positive" | "negative" | "neutral";
  totalDays: number;
}

export interface WeatherIntelligenceData {
  source: string;
  current: NormalizedCurrentWeather | null;
  hourly: NormalizedHourlyWeather[];
  daily: NormalizedDailyWeather[];
  summary: WeatherSummary;
  location: { city: string; lat: number; lon: number; timezone: string };
}

// ─── Correlation types ───────────────────────────────────────────────────────

export interface LearnedCorrelation {
  patternKey: string;
  scope: string;
  category: string;
  sampleSize: number;
  upliftPercent: number;
  confidenceScore: number;
  avgOmzet: number;
  avgOrders: number;
}

// ─── Staffing insight types ──────────────────────────────────────────────────

export interface HourlyStaffingInsight {
  hour: string;
  loadPercent: number;
  recommendedStaff: number;
  risk: "high" | "medium" | "low";
  weatherEffect: string;
}

// ─── Impact computation (client-side mirror for quick display) ──────────────

export function computeClientImpact(day: NormalizedDailyWeather): { impactScore: number; impactLabel: string } {
  let impact = 0;
  const temp = day.avgTempC ?? 15;

  if (temp > 22) impact += 8;
  else if (temp > 18) impact += 4;
  else if (temp > 12) impact += 0;
  else if (temp > 5) impact -= 3;
  else impact -= 8;

  if (day.sunny) { impact += 10; if (day.isWeekend) impact += 8; }
  if (day.isRain) { impact -= 10; if (day.precipitationChance > 70) impact -= 5; }
  if (day.isStorm) impact -= 18;
  if (day.windSpeed > 40) impact -= 8;
  else if (day.windSpeed > 25) impact -= 3;
  if (day.cloudCover > 80 && !day.isRain) impact -= 2;

  impact = Math.max(-35, Math.min(35, impact));

  const impactLabel = impact > 10 ? "Sterk positief" : impact > 3 ? "Positief" :
    impact > -3 ? "Neutraal" : impact > -10 ? "Negatief" : "Sterk negatief";

  return { impactScore: impact, impactLabel };
}

// ─── Executive summary generation ───────────────────────────────────────────

export function generateExecutiveSummary(
  daily: NormalizedDailyWeather[],
  summary: WeatherSummary,
  totalForecastOmzet: number,
  trendPct: number,
  confidenceScore: number,
  correlations: LearnedCorrelation[] = [],
): string {
  const parts: string[] = [];

  // Revenue expectation
  const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
  parts.push(`Verwachte omzet: ${euro.format(totalForecastOmzet)}.`);

  // Trend
  if (trendPct > 2) parts.push(`Stijging van +${trendPct}% t.o.v. vorige periode.`);
  else if (trendPct < -2) parts.push(`Daling van ${trendPct}% t.o.v. vorige periode.`);
  else parts.push(`Stabiel t.o.v. vorige periode.`);

  // Weather impact
  if (summary.avgImpact > 5) {
    parts.push(`Weer heeft positief effect (+${summary.avgImpact}% gemiddeld).`);
  } else if (summary.avgImpact < -3) {
    parts.push(`Weer drukt verwachte omzet (${summary.avgImpact}% gemiddeld).`);
  }

  // Specific day highlights
  const bestDay = daily.reduce((best, d) => d.impactScore > best.impactScore ? d : best, daily[0]);
  const worstDay = daily.reduce((worst, d) => d.impactScore < worst.impactScore ? d : worst, daily[0]);

  if (bestDay && bestDay.impactScore > 5) {
    parts.push(`${bestDay.dayLabel} (${bestDay.conditionLabel}, ${bestDay.avgTempC}°C) verwacht sterkste dag.`);
  }
  if (worstDay && worstDay.impactScore < -5) {
    parts.push(`${worstDay.dayLabel} (${worstDay.conditionLabel}) verwacht zwakker door weer.`);
  }

  // Rain advisory
  if (summary.rainyDays > 0) {
    const rainyLabels = daily.filter(d => d.isRain).map(d => d.dayLabel).join(", ");
    parts.push(`Regen verwacht op ${rainyLabels}.`);
  }

  // Learned patterns
  if (correlations.length > 0) {
    const strongest = correlations.filter(c => c.sampleSize >= 5).sort((a, b) => Math.abs(b.upliftPercent) - Math.abs(a.upliftPercent))[0];
    if (strongest) {
      const dir = strongest.upliftPercent > 0 ? "+" : "";
      parts.push(`Historisch patroon "${strongest.patternKey}": ${dir}${strongest.upliftPercent.toFixed(1)}% (n=${strongest.sampleSize}).`);
    }
  }

  // Confidence
  if (confidenceScore < 60) {
    parts.push(`Betrouwbaarheid lager door beperkte vergelijkbare data.`);
  }

  return parts.join(" ");
}

// ─── Staffing insights ──────────────────────────────────────────────────────

export function generateStaffingInsights(
  daily: NormalizedDailyWeather[],
  hourly: NormalizedHourlyWeather[],
): HourlyStaffingInsight[] {
  // Generate for tomorrow or today
  const targetDate = daily[0]?.date;
  if (!targetDate) return [];

  const dayHours = hourly.filter(h => h.date === targetDate);

  return Array.from({ length: 12 }, (_, i) => {
    const hour = 8 + i;
    const weatherHour = dayHours.find(h => h.localHour === hour);
    const isLunch = hour >= 12 && hour <= 14;
    const isMorning = hour >= 9 && hour <= 11;

    let baseLoad = isLunch ? 80 : isMorning ? 55 : 35;

    // Weather adjustments
    if (weatherHour) {
      if (weatherHour.precipitationChance > 50) baseLoad -= 12;
      if (weatherHour.temperatureC > 20 && weatherHour.precipitationChance < 30) baseLoad += 10;
      if (weatherHour.windSpeed > 30) baseLoad -= 8;
    }

    // Day-level adjustments
    const day = daily[0];
    if (day?.sunny) baseLoad += 8;
    if (day?.isWeekend) baseLoad += 12;
    if (day?.isRain && isLunch) baseLoad -= 10;

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
      loadPercent: baseLoad,
      recommendedStaff: staff,
      risk,
      weatherEffect,
    };
  });
}

// ─── Confidence scoring ─────────────────────────────────────────────────────

export function computeConfidence(
  rangeDays: number,
  correlations: LearnedCorrelation[],
  dataCompleteness: number, // 0-1
): number {
  let base = 90;

  // Longer ranges = less confident
  if (rangeDays > 14) base -= 15;
  else if (rangeDays > 7) base -= 8;

  // More correlations with good sample sizes = more confident
  const strongCorrelations = correlations.filter(c => c.sampleSize >= 10);
  if (strongCorrelations.length > 5) base += 5;
  else if (strongCorrelations.length === 0) base -= 10;

  // Data completeness
  base = Math.round(base * (0.5 + dataCompleteness * 0.5));

  return Math.max(20, Math.min(95, base));
}

// ─── Fallback data ──────────────────────────────────────────────────────────

const DAY_NAMES = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];

export function getFallbackDaily(startDate: Date = new Date()): NormalizedDailyWeather[] {
  return Array.from({ length: 10 }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    return {
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      dayLabel: DAY_NAMES[dayOfWeek],
      dayOfWeek,
      conditionCode: "PartlyCloudy",
      conditionLabel: "Gedeeltelijk bewolkt",
      icon: "⛅",
      minTempC: 8,
      maxTempC: 14,
      avgTempC: 11,
      precipitationChance: 20,
      humidity: 70,
      windSpeed: 15,
      cloudCover: 50,
      pressure: 1013,
      visibility: 10,
      uvIndex: 3,
      sunny: false,
      isRain: false,
      isStorm: false,
      isSevere: false,
      isWeekend,
      impactScore: isWeekend ? 2 : -1,
      impactLabel: "Neutraal",
      confidence: 30,
    };
  });
}
