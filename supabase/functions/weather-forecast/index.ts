import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const API_KEY = Deno.env.get("OPENWEATHERMAP_API_KEY");
    if (!API_KEY) throw new Error("OPENWEATHERMAP_API_KEY not configured");

    const body = await req.json().catch(() => ({}));
    const { lat = 52.3676, lon = 4.9041, city } = body; // Default: Amsterdam

    // If city provided, use geocoding first
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

    // Get 7-day forecast from OpenWeatherMap One Call API 3.0
    // Fallback to 2.5 forecast/daily if 3.0 not available
    let weatherData: any = null;

    // Try free 5-day/3-hour forecast API (available on free tier)
    const forecastRes = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${finalLat}&lon=${finalLon}&units=metric&lang=nl&appid=${API_KEY}`
    );

    if (!forecastRes.ok) {
      const errText = await forecastRes.text();
      throw new Error(`OpenWeatherMap API error [${forecastRes.status}]: ${errText}`);
    }

    const rawForecast = await forecastRes.json();

    // Also get current weather
    const currentRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${finalLat}&lon=${finalLon}&units=metric&lang=nl&appid=${API_KEY}`
    );
    const currentWeather = currentRes.ok ? await currentRes.json() : null;

    // Process 3-hour forecast into daily summaries
    const dailyMap: Record<string, {
      temps: number[];
      conditions: string[];
      icons: string[];
      wind: number[];
      humidity: number[];
      rain: number;
      clouds: number[];
    }> = {};

    for (const entry of rawForecast.list) {
      const date = entry.dt_txt.split(" ")[0];
      if (!dailyMap[date]) {
        dailyMap[date] = { temps: [], conditions: [], icons: [], wind: [], humidity: [], rain: 0, clouds: [] };
      }
      dailyMap[date].temps.push(entry.main.temp);
      dailyMap[date].conditions.push(entry.weather[0].main);
      dailyMap[date].icons.push(entry.weather[0].icon);
      dailyMap[date].wind.push(entry.wind.speed);
      dailyMap[date].humidity.push(entry.main.humidity);
      dailyMap[date].rain += entry.rain?.["3h"] || 0;
      dailyMap[date].clouds.push(entry.clouds.all);
    }

    const dayNames = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];

    const daily = Object.entries(dailyMap).slice(0, 7).map(([date, d]) => {
      const dayDate = new Date(date);
      const dayName = dayNames[dayDate.getDay()];
      const avgTemp = Math.round(d.temps.reduce((a, b) => a + b, 0) / d.temps.length);
      const maxTemp = Math.round(Math.max(...d.temps));
      const minTemp = Math.round(Math.min(...d.temps));
      const avgWind = Math.round(d.wind.reduce((a, b) => a + b, 0) / d.wind.length * 10) / 10;
      const avgHumidity = Math.round(d.humidity.reduce((a, b) => a + b, 0) / d.humidity.length);
      const avgClouds = Math.round(d.clouds.reduce((a, b) => a + b, 0) / d.clouds.length);

      // Determine dominant condition
      const conditionCounts: Record<string, number> = {};
      d.conditions.forEach(c => { conditionCounts[c] = (conditionCounts[c] || 0) + 1; });
      const dominant = Object.entries(conditionCounts).sort((a, b) => b[1] - a[1])[0][0];

      const isSunny = dominant === "Clear" || (dominant === "Clouds" && avgClouds < 40);
      const isRainy = dominant === "Rain" || dominant === "Drizzle" || dominant === "Thunderstorm";

      // Calculate business impact
      let impact = 0;
      if (isSunny) {
        impact = Math.round(8 + avgTemp * 0.5); // sunny = positive
        if (avgTemp > 22) impact += 5; // hot = iced drinks boost
      } else if (isRainy) {
        impact = Math.round(-8 - d.rain * 2); // rain = negative
      } else {
        impact = Math.round(-2 + avgTemp * 0.1); // overcast = slight negative
      }

      // Weekend boost
      const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
      if (isWeekend && isSunny) impact += 8;

      // Map to emoji
      let icon = "⛅";
      if (isSunny && avgClouds < 20) icon = "☀️";
      else if (isSunny) icon = "🌤️";
      else if (isRainy) icon = "🌧️";
      else if (dominant === "Snow") icon = "🌨️";
      else if (dominant === "Thunderstorm") icon = "⛈️";

      // Dutch label
      const labelMap: Record<string, string> = {
        Clear: "Zonnig", Clouds: avgClouds < 40 ? "Licht bewolkt" : "Bewolkt",
        Rain: "Regen", Drizzle: "Motregen", Thunderstorm: "Onweer",
        Snow: "Sneeuw", Mist: "Mist", Fog: "Mist", Haze: "Wazig",
      };

      return {
        date,
        day: dayName,
        temp: avgTemp,
        temp_max: maxTemp,
        temp_min: minTemp,
        wind: avgWind,
        humidity: avgHumidity,
        clouds: avgClouds,
        rain: Math.round(d.rain * 10) / 10,
        condition: dominant,
        label: labelMap[dominant] || dominant,
        icon,
        sunny: isSunny,
        impact,
        weekend: isWeekend,
      };
    });

    // Current conditions
    const current = currentWeather ? {
      temp: Math.round(currentWeather.main.temp),
      feels_like: Math.round(currentWeather.main.feels_like),
      condition: currentWeather.weather[0].main,
      description: currentWeather.weather[0].description,
      humidity: currentWeather.main.humidity,
      wind: currentWeather.wind.speed,
      city: currentWeather.name,
    } : null;

    // Summary stats for AI
    const sunnyDays = daily.filter(d => d.sunny).length;
    const rainyDays = daily.filter(d => d.condition === "Rain" || d.condition === "Drizzle").length;
    const avgImpact = daily.length > 0 ? Math.round(daily.reduce((s, d) => s + d.impact, 0) / daily.length) : 0;

    return new Response(JSON.stringify({
      success: true,
      current,
      daily,
      summary: {
        sunny_days: sunnyDays,
        rainy_days: rainyDays,
        avg_impact: avgImpact,
        avg_temp: daily.length > 0 ? Math.round(daily.reduce((s, d) => s + d.temp, 0) / daily.length) : 0,
        trend: avgImpact > 5 ? "positive" : avgImpact < -3 ? "negative" : "neutral",
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("weather-forecast error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
