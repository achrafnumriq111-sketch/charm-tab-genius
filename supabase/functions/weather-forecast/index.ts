import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DAY_NAMES = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"] as const;

type DailyForecast = {
  date: string;
  day: string;
  temp: number;
  temp_max: number;
  temp_min: number;
  wind: number;
  humidity: number;
  clouds: number;
  rain: number;
  condition: string;
  label: string;
  icon: string;
  sunny: boolean;
  impact: number;
  weekend: boolean;
};

function parseIsoDateUTC(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
}

function getLocalDateMetaFromUnix(unixSeconds: number, timezoneOffsetSeconds = 0) {
  const localDate = new Date((unixSeconds + timezoneOffsetSeconds) * 1000);
  const year = localDate.getUTCFullYear();
  const month = String(localDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(localDate.getUTCDate()).padStart(2, "0");
  const dayOfWeek = localDate.getUTCDay();

  return {
    date: `${year}-${month}-${day}`,
    dayName: DAY_NAMES[dayOfWeek],
    dayOfWeek,
  };
}

function getConditionMeta(condition: string, cloudCoverage = 0) {
  const isSunny = condition === "Clear" || (condition === "Clouds" && cloudCoverage < 40);
  const isRainy = condition === "Rain" || condition === "Drizzle" || condition === "Thunderstorm";

  let icon = "⛅";
  if (isSunny && cloudCoverage < 20) icon = "☀️";
  else if (isSunny) icon = "🌤️";
  else if (condition === "Thunderstorm") icon = "⛈️";
  else if (isRainy) icon = "🌧️";
  else if (condition === "Snow") icon = "🌨️";

  const labelMap: Record<string, string> = {
    Clear: "Zonnig",
    Clouds: cloudCoverage < 40 ? "Licht bewolkt" : "Bewolkt",
    Rain: "Regen",
    Drizzle: "Motregen",
    Thunderstorm: "Onweer",
    Snow: "Sneeuw",
    Mist: "Mist",
    Fog: "Mist",
    Haze: "Wazig",
  };

  return {
    isSunny,
    isRainy,
    icon,
    label: labelMap[condition] || condition,
  };
}

function calculateBusinessImpact({
  isSunny,
  isRainy,
  avgTemp,
  rain,
  isWeekend,
}: {
  isSunny: boolean;
  isRainy: boolean;
  avgTemp: number;
  rain: number;
  isWeekend: boolean;
}) {
  let impact = 0;

  if (isSunny) {
    impact = Math.round(8 + avgTemp * 0.5);
    if (avgTemp > 22) impact += 5;
  } else if (isRainy) {
    impact = Math.round(-8 - rain * 2);
  } else {
    impact = Math.round(-2 + avgTemp * 0.1);
  }

  if (isWeekend && isSunny) impact += 8;

  return impact;
}

function buildOneCallDailyForecast(dayData: any, timezoneOffset = 0): DailyForecast {
  const { date, dayName, dayOfWeek } = getLocalDateMetaFromUnix(dayData.dt, timezoneOffset);
  const temp = Math.round(dayData.temp?.day ?? ((dayData.temp?.min ?? 0) + (dayData.temp?.max ?? 0)) / 2);
  const tempMax = Math.round(dayData.temp?.max ?? temp);
  const tempMin = Math.round(dayData.temp?.min ?? temp);
  const wind = Math.round((dayData.wind_speed ?? 0) * 10) / 10;
  const humidity = Math.round(dayData.humidity ?? 0);
  const clouds = Math.round(dayData.clouds ?? 0);
  const rain = Math.round(((dayData.rain ?? 0) as number) * 10) / 10;
  const condition = dayData.weather?.[0]?.main ?? "Clouds";
  const weekend = dayOfWeek === 0 || dayOfWeek === 6;
  const { isSunny, isRainy, icon, label } = getConditionMeta(condition, clouds);

  return {
    date,
    day: dayName,
    temp,
    temp_max: tempMax,
    temp_min: tempMin,
    wind,
    humidity,
    clouds,
    rain,
    condition,
    label,
    icon,
    sunny: isSunny,
    impact: calculateBusinessImpact({ isSunny, isRainy, avgTemp: temp, rain, isWeekend: weekend }),
    weekend,
  };
}

function buildDailyForecastFromThreeHour(rawForecast: any): DailyForecast[] {
  const timezoneOffset = rawForecast.city?.timezone ?? 0;
  const dailyMap: Record<string, {
    temps: number[];
    conditions: string[];
    wind: number[];
    humidity: number[];
    rain: number;
    clouds: number[];
  }> = {};

  for (const entry of rawForecast.list ?? []) {
    const { date } = getLocalDateMetaFromUnix(entry.dt, timezoneOffset);

    if (!dailyMap[date]) {
      dailyMap[date] = { temps: [], conditions: [], wind: [], humidity: [], rain: 0, clouds: [] };
    }

    dailyMap[date].temps.push(entry.main?.temp ?? 0);
    dailyMap[date].conditions.push(entry.weather?.[0]?.main ?? "Clouds");
    dailyMap[date].wind.push(entry.wind?.speed ?? 0);
    dailyMap[date].humidity.push(entry.main?.humidity ?? 0);
    dailyMap[date].rain += entry.rain?.["3h"] || 0;
    dailyMap[date].clouds.push(entry.clouds?.all ?? 0);
  }

  return Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 7)
    .map(([date, dayData]) => {
      const parsedDate = parseIsoDateUTC(date);
      const dayOfWeek = parsedDate.getUTCDay();
      const dayName = DAY_NAMES[dayOfWeek];
      const weekend = dayOfWeek === 0 || dayOfWeek === 6;
      const avgTemp = Math.round(dayData.temps.reduce((sum, value) => sum + value, 0) / dayData.temps.length);
      const tempMax = Math.round(Math.max(...dayData.temps));
      const tempMin = Math.round(Math.min(...dayData.temps));
      const wind = Math.round((dayData.wind.reduce((sum, value) => sum + value, 0) / dayData.wind.length) * 10) / 10;
      const humidity = Math.round(dayData.humidity.reduce((sum, value) => sum + value, 0) / dayData.humidity.length);
      const clouds = Math.round(dayData.clouds.reduce((sum, value) => sum + value, 0) / dayData.clouds.length);
      const rain = Math.round(dayData.rain * 10) / 10;

      const conditionCounts = dayData.conditions.reduce((acc: Record<string, number>, condition: string) => {
        acc[condition] = (acc[condition] || 0) + 1;
        return acc;
      }, {});
      const condition = Object.entries(conditionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Clouds";
      const { isSunny, isRainy, icon, label } = getConditionMeta(condition, clouds);

      return {
        date,
        day: dayName,
        temp: avgTemp,
        temp_max: tempMax,
        temp_min: tempMin,
        wind,
        humidity,
        clouds,
        rain,
        condition,
        label,
        icon,
        sunny: isSunny,
        impact: calculateBusinessImpact({ isSunny, isRainy, avgTemp, rain, isWeekend: weekend }),
        weekend,
      };
    });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const API_KEY = Deno.env.get("OPENWEATHERMAP_API_KEY");
    if (!API_KEY) throw new Error("OPENWEATHERMAP_API_KEY not configured");

    const body = await req.json().catch(() => ({}));
    const { lat = 52.3676, lon = 4.9041, city } = body;

    let finalLat = lat;
    let finalLon = lon;

    if (city) {
      const geoRes = await fetch(
        `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${API_KEY}`
      );

      if (geoRes.ok) {
        const geoData = await geoRes.json();
        if (geoData.length > 0) {
          finalLat = geoData[0].lat;
          finalLon = geoData[0].lon;
        }
      }
    }

    let daily: DailyForecast[] = [];

    const oneCallRes = await fetch(
      `https://api.openweathermap.org/data/3.0/onecall?lat=${finalLat}&lon=${finalLon}&exclude=minutely,hourly,alerts&units=metric&lang=nl&appid=${API_KEY}`
    );

    if (oneCallRes.ok) {
      const oneCallData = await oneCallRes.json();
      daily = (oneCallData.daily ?? [])
        .slice(0, 7)
        .map((dayData: any) => buildOneCallDailyForecast(dayData, oneCallData.timezone_offset ?? 0));
    }

    if (!daily.length) {
      const forecastRes = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${finalLat}&lon=${finalLon}&units=metric&lang=nl&appid=${API_KEY}`
      );

      if (!forecastRes.ok) {
        const errText = await forecastRes.text();
        throw new Error(`OpenWeatherMap API error [${forecastRes.status}]: ${errText}`);
      }

      const rawForecast = await forecastRes.json();
      daily = buildDailyForecastFromThreeHour(rawForecast);
    }

    const currentRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${finalLat}&lon=${finalLon}&units=metric&lang=nl&appid=${API_KEY}`
    );
    const currentWeather = currentRes.ok ? await currentRes.json() : null;

    const current = currentWeather ? {
      temp: Math.round(currentWeather.main.temp),
      feels_like: Math.round(currentWeather.main.feels_like),
      condition: currentWeather.weather[0].main,
      description: currentWeather.weather[0].description,
      humidity: currentWeather.main.humidity,
      wind: currentWeather.wind.speed,
      city: currentWeather.name,
    } : null;

    const sunnyDays = daily.filter((day) => day.sunny).length;
    const rainyDays = daily.filter((day) => ["Rain", "Drizzle", "Thunderstorm"].includes(day.condition)).length;
    const avgImpact = daily.length > 0 ? Math.round(daily.reduce((sum, day) => sum + day.impact, 0) / daily.length) : 0;

    return new Response(JSON.stringify({
      success: true,
      current,
      daily,
      summary: {
        sunny_days: sunnyDays,
        rainy_days: rainyDays,
        avg_impact: avgImpact,
        avg_temp: daily.length > 0 ? Math.round(daily.reduce((sum, day) => sum + day.temp, 0) / daily.length) : 0,
        trend: avgImpact > 5 ? "positive" : avgImpact < -3 ? "negative" : "neutral",
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("weather-forecast error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
