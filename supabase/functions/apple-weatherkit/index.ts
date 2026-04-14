import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
// @ts-ignore jose import
import * as jose from "https://deno.land/x/jose@v5.2.2/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Constants ───────────────────────────────────────────────────────────────
const AMSTERDAM = { lat: 52.3676, lon: 4.9041, city: "Amsterdam", tz: "Europe/Amsterdam", key: "amsterdam" };
const WEATHERKIT_BASE = "https://weatherkit.apple.com/api/v1";
const JWT_TTL_SECONDS = 3600; // 1 hour

// ─── Condition code → Dutch label mapping ────────────────────────────────────
const CONDITION_LABELS: Record<string, string> = {
  Clear: "Zonnig", MostlyClear: "Overwegend zonnig", PartlyCloudy: "Gedeeltelijk bewolkt",
  MostlyCloudy: "Overwegend bewolkt", Cloudy: "Bewolkt", Haze: "Wazig", Smoky: "Rokerig",
  Foggy: "Mist", Drizzle: "Motregen", Rain: "Regen", HeavyRain: "Hevige regen",
  Flurries: "Sneeuwvlagen", Snow: "Sneeuw", HeavySnow: "Zware sneeuwval",
  Sleet: "IJzel", FreezingDrizzle: "Ijzige motregen", FreezingRain: "IJsregen",
  Thunderstorms: "Onweer", StrongStorms: "Zware onweersbuien", Blizzard: "Sneeuwstorm",
  BlowingSnow: "Stuifsneeuw", Windy: "Winderig", Breezy: "Briesje",
  ScatteredThunderstorms: "Verspreide onweersbuien", IsolatedThunderstorms: "Lokale onweersbuien",
  TropicalStorm: "Tropische storm", Hurricane: "Orkaan", SunShowers: "Zonnige bui",
};

const CONDITION_ICONS: Record<string, string> = {
  Clear: "☀️", MostlyClear: "🌤️", PartlyCloudy: "⛅", MostlyCloudy: "🌥️",
  Cloudy: "☁️", Haze: "🌫️", Foggy: "🌫️", Drizzle: "🌦️", Rain: "🌧️",
  HeavyRain: "🌧️", Snow: "🌨️", HeavySnow: "🌨️", Sleet: "🌨️",
  Thunderstorms: "⛈️", StrongStorms: "⛈️", ScatteredThunderstorms: "⛈️",
  Windy: "💨", Breezy: "🍃", SunShowers: "🌦️",
};

function getLabel(code: string): string {
  return CONDITION_LABELS[code] || code;
}
function getIcon(code: string): string {
  return CONDITION_ICONS[code] || "⛅";
}

function isRainCode(code: string): boolean {
  return ["Drizzle", "Rain", "HeavyRain", "FreezingDrizzle", "FreezingRain", "SunShowers", "Sleet"].includes(code);
}
function isStormCode(code: string): boolean {
  return ["Thunderstorms", "StrongStorms", "ScatteredThunderstorms", "IsolatedThunderstorms", "TropicalStorm", "Hurricane", "Blizzard"].includes(code);
}
function isSunnyCode(code: string): boolean {
  return ["Clear", "MostlyClear"].includes(code);
}

// ─── JWT Generation ──────────────────────────────────────────────────────────
async function generateWeatherKitJWT(): Promise<string> {
  const privateKeyPem = Deno.env.get("APPLE_WEATHERKIT_PRIVATE_KEY");
  const keyId = Deno.env.get("APPLE_WEATHERKIT_KEY_ID");
  const teamId = Deno.env.get("APPLE_WEATHERKIT_TEAM_ID");
  const serviceId = Deno.env.get("APPLE_WEATHERKIT_SERVICE_ID");

  if (!privateKeyPem || !keyId || !teamId || !serviceId) {
    throw new Error("Apple WeatherKit credentials not configured");
  }

  // Reconstruct PEM: secrets may store raw base64 without headers, or flatten newlines
  let pem = privateKeyPem.trim();
  
  // Handle literal backslash-n sequences
  pem = pem.replace(/\\n/g, "\n");
  
  // If there are no PEM headers, the user stored raw base64
  if (!pem.includes("-----BEGIN")) {
    const base64Content = pem.replace(/[\s\r\n-]+/g, "");
    const lines = base64Content.match(/.{1,64}/g) || [];
    pem = `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----`;
  } else if (!pem.includes("\n") || pem.split("\n").length < 3) {
    // Has headers but no proper newlines
    const base64Match = pem.match(/-----BEGIN PRIVATE KEY-----(.*?)-----END PRIVATE KEY-----/s);
    if (base64Match) {
      const base64Content = base64Match[1].replace(/[\s\r\n]+/g, "");
      const lines = base64Content.match(/.{1,64}/g) || [];
      pem = `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----`;
    }
  }

  const privateKey = await jose.importPKCS8(pem, "ES256");

  const now = Math.floor(Date.now() / 1000);
  const jwt = await new jose.SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId, id: `${teamId}.${serviceId}` })
    .setIssuer(teamId)
    .setSubject(serviceId)
    .setIssuedAt(now)
    .setExpirationTime(now + JWT_TTL_SECONDS)
    .sign(privateKey);

  return jwt;
}

// ─── Apple WeatherKit fetch ──────────────────────────────────────────────────
async function fetchWeatherKit(lat: number, lon: number, jwt: string, datasets: string[]) {
  const url = `${WEATHERKIT_BASE}/weather/en/${lat}/${lon}?dataSets=${datasets.join(",")}&timezone=Europe/Amsterdam`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${jwt}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`WeatherKit API ${res.status}: ${errText}`);
    }
    return await res.json();
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

// ─── Normalize responses ─────────────────────────────────────────────────────
function normalizeCurrent(raw: any) {
  if (!raw?.currentWeather) return null;
  const c = raw.currentWeather;
  return {
    asOf: c.asOf,
    conditionCode: c.conditionCode,
    conditionLabel: getLabel(c.conditionCode),
    icon: getIcon(c.conditionCode),
    temperatureC: round1(c.temperature),
    feelsLikeC: round1(c.temperatureApparent),
    humidity: round1((c.humidity ?? 0) * 100),
    windSpeed: round1(c.windSpeed),
    uvIndex: c.uvIndex ?? 0,
    visibility: round1(c.visibility ?? 0),
    pressure: round1(c.pressure ?? 0),
    precipitationChance: 0,
    cloudCover: round1((c.cloudCover ?? 0) * 100),
    city: AMSTERDAM.city,
  };
}

function normalizeHourly(raw: any): any[] {
  if (!raw?.forecastHourly?.hours) return [];
  return raw.forecastHourly.hours.map((h: any) => {
    const dt = new Date(h.forecastStart);
    // Convert to Amsterdam local time (CET/CEST)
    const ams = toAmsterdam(dt);
    return {
      datetime: h.forecastStart,
      localHour: ams.hour,
      date: ams.dateStr,
      conditionCode: h.conditionCode,
      conditionLabel: getLabel(h.conditionCode),
      icon: getIcon(h.conditionCode),
      temperatureC: round1(h.temperature),
      feelsLikeC: round1(h.temperatureApparent),
      precipitationChance: round1((h.precipitationChance ?? 0) * 100),
      precipitationIntensity: round1(h.precipitationIntensity ?? 0),
      humidity: round1((h.humidity ?? 0) * 100),
      windSpeed: round1(h.windSpeed),
      cloudCover: round1((h.cloudCover ?? 0) * 100),
      pressure: round1(h.pressure ?? 0),
      visibility: round1(h.visibility ?? 0),
      uvIndex: h.uvIndex ?? 0,
      isDaylight: h.daylight ?? true,
    };
  });
}

function normalizeDaily(raw: any): any[] {
  if (!raw?.forecastDaily?.days) return [];
  const DAY_NAMES = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];

  return raw.forecastDaily.days.map((d: any) => {
    const dt = new Date(d.forecastStart);
    const ams = toAmsterdam(dt);
    const dayOfWeek = ams.dayOfWeek;
    const condCode = d.conditionCode;
    const sunny = isSunnyCode(condCode);
    const isRain = isRainCode(condCode);
    const isStorm = isStormCode(condCode);
    const avgTemp = round1(((d.temperatureMax ?? 0) + (d.temperatureMin ?? 0)) / 2);

    // WeatherKit daily: daytimeForecast has cloudCover, restOfDayForecast etc.
    const dtForecast = d.daytimeForecast || {};
    const cloudCover = round1(((dtForecast.cloudCover ?? d.cloudCover ?? 0)) * 100);
    const humidity = round1(((dtForecast.humidity ?? d.humidity ?? 0)) * 100);

    return {
      date: ams.dateStr,
      dayLabel: DAY_NAMES[dayOfWeek],
      dayOfWeek,
      conditionCode: condCode,
      conditionLabel: getLabel(condCode),
      icon: getIcon(condCode),
      minTempC: round1(d.temperatureMin),
      maxTempC: round1(d.temperatureMax),
      avgTempC: avgTemp,
      precipitationChance: round1((d.precipitationChance ?? 0) * 100),
      humidity,
      windSpeed: round1(d.windSpeedMax ?? d.windSpeedAvg ?? 0),
      cloudCover,
      pressure: round1(dtForecast.pressure ?? d.pressure ?? 0),
      visibility: round1(dtForecast.visibility ?? d.visibility ?? 0),
      uvIndex: d.maxUvIndex ?? d.uvIndex ?? 0,
      sunrise: d.sunrise,
      sunset: d.sunset,
      sunny,
      isRain,
      isStorm,
      isSevere: isStorm && (d.windSpeedMax ?? 0) > 60,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
    };
  });
}

// ─── Weather impact scoring (rule-based, enhanced by learned correlations) ──
function computeDayImpact(day: any, correlations: any[] = []): { impactScore: number; impactLabel: string; confidence: number } {
  let impact = 0;
  const temp = day.avgTempC ?? 15;
  const isWeekend = day.isWeekend;

  // Base temperature effect
  if (temp > 22) impact += 8;
  else if (temp > 18) impact += 4;
  else if (temp > 12) impact += 0;
  else if (temp > 5) impact -= 3;
  else impact -= 8;

  // Sun effect
  if (day.sunny) {
    impact += 10;
    if (isWeekend) impact += 8;
  }

  // Rain effect
  if (day.isRain) {
    impact -= 10;
    if ((day.precipitationChance ?? 0) > 70) impact -= 5;
  }

  // Storm effect
  if (day.isStorm) impact -= 18;
  if (day.isSevere) impact -= 10;

  // Wind effect
  if ((day.windSpeed ?? 0) > 40) impact -= 8;
  else if ((day.windSpeed ?? 0) > 25) impact -= 3;

  // Cloud cover
  if ((day.cloudCover ?? 0) > 80 && !day.isRain) impact -= 2;

  // Apply learned correlations if available
  let confidence = 50;
  const matchingCorrelations = correlations.filter(c => {
    if (day.isRain && c.pattern_key?.includes("rain")) return true;
    if (day.sunny && c.pattern_key?.includes("sunny")) return true;
    if (isWeekend && c.pattern_key?.includes("weekend")) return true;
    return false;
  });

  if (matchingCorrelations.length > 0) {
    const totalSamples = matchingCorrelations.reduce((s, c) => s + (c.sample_size || 0), 0);
    if (totalSamples >= 5) {
      const learnedUplift = matchingCorrelations.reduce((s, c) => s + (c.uplift_percent ?? 0) * (c.sample_size ?? 1), 0) / totalSamples;
      // Blend: 60% rule-based, 40% learned (capped at ±25%)
      const cappedLearned = Math.max(-25, Math.min(25, learnedUplift));
      impact = Math.round(impact * 0.6 + cappedLearned * 0.4);
      confidence = Math.min(95, 50 + totalSamples * 2);
    }
  }

  // Cap extreme values
  impact = Math.max(-35, Math.min(35, impact));

  const impactLabel = impact > 10 ? "Sterk positief" : impact > 3 ? "Positief" :
    impact > -3 ? "Neutraal" : impact > -10 ? "Negatief" : "Sterk negatief";

  return { impactScore: impact, impactLabel, confidence };
}

// ─── Store weather data ──────────────────────────────────────────────────────
async function storeWeatherData(supabase: any, daily: any[], hourly: any[], locationKey: string) {
  // Upsert daily
  if (daily.length > 0) {
    const dailyRows = daily.map(d => ({
      location_key: locationKey,
      date: d.date,
      source: "apple-weatherkit",
      condition_code: d.conditionCode,
      condition_label: d.conditionLabel,
      min_temp_c: d.minTempC,
      max_temp_c: d.maxTempC,
      avg_temp_c: d.avgTempC,
      humidity: d.humidity,
      wind_speed: d.windSpeed,
      precipitation_chance: d.precipitationChance,
      cloud_cover: d.cloudCover,
      pressure: d.pressure,
      visibility: d.visibility,
      uv_index: d.uvIndex,
      is_rain: d.isRain,
      is_storm: d.isStorm,
      is_severe: d.isSevere ?? false,
      sunrise_time: d.sunrise,
      sunset_time: d.sunset,
      updated_at: new Date().toISOString(),
    }));

    await supabase.from("weather_daily_observations").upsert(dailyRows, {
      onConflict: "date,location_key",
      ignoreDuplicates: false,
    });
  }

  // Upsert hourly
  if (hourly.length > 0) {
    const hourlyRows = hourly.map(h => ({
      location_key: locationKey,
      datetime_hour: h.datetime,
      date: h.date,
      local_hour: h.localHour,
      condition_code: h.conditionCode,
      condition_label: h.conditionLabel,
      temperature_c: h.temperatureC,
      feels_like_c: h.feelsLikeC,
      humidity: h.humidity,
      wind_speed: h.windSpeed,
      precipitation_chance: h.precipitationChance,
      precipitation_intensity: h.precipitationIntensity ?? 0,
      cloud_cover: h.cloudCover,
      pressure: h.pressure,
      visibility: h.visibility,
      uv_index: h.uvIndex ?? 0,
      is_daylight: h.isDaylight ?? true,
      updated_at: new Date().toISOString(),
    }));

    // Batch in chunks of 100
    for (let i = 0; i < hourlyRows.length; i += 100) {
      await supabase.from("weather_hourly_observations").upsert(
        hourlyRows.slice(i, i + 100),
        { onConflict: "datetime_hour,location_key", ignoreDuplicates: false }
      );
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function round1(n: number): number {
  return Math.round((n ?? 0) * 10) / 10;
}
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Convert a UTC Date to Amsterdam local date/time components */
function toAmsterdam(utcDate: Date): { dateStr: string; hour: number; dayOfWeek: number } {
  // Use Intl to get Amsterdam local time parts
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "numeric", hour12: false, weekday: "short",
  }).formatToParts(utcDate);

  const get = (type: string) => parts.find(p => p.type === type)?.value || "";
  const dateStr = `${get("year")}-${get("month")}-${get("day")}`;
  const hour = parseInt(get("hour")) || 0;
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dayOfWeek = weekdayMap[get("weekday")] ?? utcDate.getDay();

  return { dateStr, hour, dayOfWeek };
}

// ─── Main handler ────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const jwt = await generateWeatherKitJWT();

    const body = await req.json().catch(() => ({}));
    const { store = true } = body;

    const lat = AMSTERDAM.lat;
    const lon = AMSTERDAM.lon;
    const locationKey = AMSTERDAM.key;

    // Fetch all datasets
    const rawData = await fetchWeatherKit(lat, lon, jwt, ["currentWeather", "forecastHourly", "forecastDaily"]);

    const current = normalizeCurrent(rawData);
    const hourly = normalizeHourly(rawData);
    const daily = normalizeDaily(rawData);

    // Fetch learned correlations for impact scoring
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let correlations: any[] = [];
    try {
      const { data } = await supabase.from("weather_business_correlations").select("*");
      correlations = data || [];
    } catch { /* ignore */ }

    // Compute impact for each day
    const dailyWithImpact = daily.map(d => {
      const { impactScore, impactLabel, confidence } = computeDayImpact(d, correlations);
      return { ...d, impactScore, impactLabel, confidence };
    });

    // Store weather data if requested
    if (store) {
      try {
        await storeWeatherData(supabase, dailyWithImpact, hourly, locationKey);
      } catch (e) {
        console.error("Failed to store weather data:", e);
      }
    }

    // Summary stats
    const sunnyDays = dailyWithImpact.filter(d => d.sunny).length;
    const rainyDays = dailyWithImpact.filter(d => d.isRain).length;
    const avgImpact = dailyWithImpact.length > 0
      ? Math.round(dailyWithImpact.reduce((s, d) => s + d.impactScore, 0) / dailyWithImpact.length)
      : 0;
    const avgTemp = dailyWithImpact.length > 0
      ? Math.round(dailyWithImpact.reduce((s, d) => s + d.avgTempC, 0) / dailyWithImpact.length)
      : 0;

    return new Response(JSON.stringify({
      success: true,
      source: "apple-weatherkit",
      location: { city: AMSTERDAM.city, lat, lon, timezone: AMSTERDAM.tz },
      current,
      hourly: hourly.slice(0, 240), // up to 10 days
      daily: dailyWithImpact,
      summary: {
        sunny_days: sunnyDays,
        rainy_days: rainyDays,
        avg_impact: avgImpact,
        avg_temp: avgTemp,
        trend: avgImpact > 5 ? "positive" : avgImpact < -3 ? "negative" : "neutral",
        total_days: dailyWithImpact.length,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("apple-weatherkit error:", e);
    return new Response(JSON.stringify({
      success: false,
      error: e instanceof Error ? e.message : "Unknown error",
      source: "apple-weatherkit",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
