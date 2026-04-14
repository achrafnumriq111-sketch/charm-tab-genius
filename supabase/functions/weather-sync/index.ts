import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * weather-sync: Scheduled job that:
 * 1. Aggregates business_daily_facts and business_hourly_facts from pos_transactions
 * 2. Runs the learning engine to update weather_business_correlations
 * 3. Reconciles forecast_learning_metrics (predicted vs actual)
 *
 * Called via pg_cron nightly + can be invoked manually.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getSeason(month: number): string {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

function getWeekNumber(d: Date): number {
  const oneJan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const { days_back = 90 } = body; // how far back to aggregate

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days_back);
    const cutoffStr = toDateStr(cutoff);

    // ─── 1. Aggregate business_daily_facts from pos_transactions ─────────
    const { data: txns } = await supabase
      .from("pos_transactions")
      .select("created_at, total, discount, payment_method, status")
      .gte("created_at", cutoffStr)
      .order("created_at", { ascending: true })
      .limit(10000);

    const dailyAgg: Record<string, {
      omzet: number; orders: number; discount: number; refund: number;
      cash: number; card: number;
    }> = {};

    const hourlyAgg: Record<string, {
      omzet: number; orders: number;
    }> = {};

    for (const tx of txns || []) {
      const dt = new Date(tx.created_at);
      const dateKey = toDateStr(dt);
      const hour = dt.getHours();
      const hourKey = `${dateKey}_${hour}`;

      if (!dailyAgg[dateKey]) {
        dailyAgg[dateKey] = { omzet: 0, orders: 0, discount: 0, refund: 0, cash: 0, card: 0 };
      }

      if (tx.status === "refunded") {
        dailyAgg[dateKey].refund += Math.abs(tx.total || 0);
      } else {
        dailyAgg[dateKey].omzet += tx.total || 0;
        dailyAgg[dateKey].orders += 1;
        dailyAgg[dateKey].discount += tx.discount || 0;
        if (tx.payment_method === "cash") dailyAgg[dateKey].cash += tx.total || 0;
        else dailyAgg[dateKey].card += tx.total || 0;
      }

      if (tx.status !== "refunded") {
        if (!hourlyAgg[hourKey]) hourlyAgg[hourKey] = { omzet: 0, orders: 0 };
        hourlyAgg[hourKey].omzet += tx.total || 0;
        hourlyAgg[hourKey].orders += 1;
      }
    }

    // Upsert daily facts
    const dailyRows = Object.entries(dailyAgg).map(([dateKey, agg]) => {
      const d = new Date(dateKey + "T12:00:00Z");
      return {
        date: dateKey,
        omzet: Math.round(agg.omzet * 100) / 100,
        orders_count: agg.orders,
        avg_order_value: agg.orders > 0 ? Math.round((agg.omzet / agg.orders) * 100) / 100 : 0,
        discount_total: Math.round(agg.discount * 100) / 100,
        refund_total: Math.round(agg.refund * 100) / 100,
        cash_revenue: Math.round(agg.cash * 100) / 100,
        card_revenue: Math.round(agg.card * 100) / 100,
        weekday: d.getDay(),
        week_number: getWeekNumber(d),
        month: d.getMonth() + 1,
        season: getSeason(d.getMonth() + 1),
        updated_at: new Date().toISOString(),
      };
    });

    if (dailyRows.length > 0) {
      for (let i = 0; i < dailyRows.length; i += 50) {
        await supabase.from("business_daily_facts").upsert(
          dailyRows.slice(i, i + 50),
          { onConflict: "date", ignoreDuplicates: false }
        );
      }
    }

    // Upsert hourly facts
    const hourlyRows = Object.entries(hourlyAgg).map(([key, agg]) => {
      const [dateKey, hourStr] = key.split("_");
      const hour = parseInt(hourStr);
      const d = new Date(dateKey + "T12:00:00Z");
      const weekday = d.getDay();
      const isPeak = agg.orders >= 5; // simple peak heuristic
      return {
        date: dateKey,
        local_hour: hour,
        orders_count: agg.orders,
        omzet: Math.round(agg.omzet * 100) / 100,
        avg_order_value: agg.orders > 0 ? Math.round((agg.omzet / agg.orders) * 100) / 100 : 0,
        is_peak: isPeak,
        weekday,
        is_weekend: weekday === 0 || weekday === 6,
        updated_at: new Date().toISOString(),
      };
    });

    if (hourlyRows.length > 0) {
      for (let i = 0; i < hourlyRows.length; i += 100) {
        await supabase.from("business_hourly_facts").upsert(
          hourlyRows.slice(i, i + 100),
          { onConflict: "date,local_hour", ignoreDuplicates: false }
        );
      }
    }

    // ─── 2. Learning engine: compute weather-business correlations ───────
    const { data: weatherDays } = await supabase
      .from("weather_daily_observations")
      .select("date, condition_code, avg_temp_c, is_rain, is_storm, wind_speed, precipitation_chance, cloud_cover")
      .gte("date", cutoffStr);

    const { data: businessDays } = await supabase
      .from("business_daily_facts")
      .select("date, omzet, orders_count, weekday")
      .gte("date", cutoffStr);

    if (weatherDays?.length && businessDays?.length) {
      // Build lookup
      const bizByDate: Record<string, any> = {};
      for (const b of businessDays) bizByDate[b.date] = b;

      // Compute baseline omzet per weekday
      const weekdayTotals: Record<number, { sum: number; count: number }> = {};
      for (const b of businessDays) {
        if (!weekdayTotals[b.weekday]) weekdayTotals[b.weekday] = { sum: 0, count: 0 };
        weekdayTotals[b.weekday].sum += b.omzet;
        weekdayTotals[b.weekday].count += 1;
      }
      const weekdayBaseline: Record<number, number> = {};
      for (const [wd, t] of Object.entries(weekdayTotals)) {
        weekdayBaseline[parseInt(wd)] = t.count > 0 ? t.sum / t.count : 0;
      }

      // Pattern buckets
      const patterns: Record<string, { uplifts: number[]; omzets: number[]; orders: number[] }> = {};

      for (const w of weatherDays) {
        const biz = bizByDate[w.date];
        if (!biz || biz.omzet === 0) continue;

        const baseline = weekdayBaseline[biz.weekday] || biz.omzet;
        const uplift = baseline > 0 ? ((biz.omzet - baseline) / baseline) * 100 : 0;
        const isWeekend = biz.weekday === 0 || biz.weekday === 6;

        // Generate pattern keys
        const keys: string[] = [];
        if (w.is_rain) keys.push("rain");
        else if (isSunnyCode(w.condition_code)) keys.push("sunny");
        else keys.push("cloudy");

        if (isWeekend) keys.push("weekend");
        else keys.push("weekday");

        // Temperature bands
        const temp = w.avg_temp_c ?? 15;
        if (temp > 22) keys.push("warm");
        else if (temp > 12) keys.push("mild");
        else keys.push("cold");

        // Create composite keys
        const composites = [
          keys.join("_"),
          keys[0], // weather only
          keys[1], // day type only
          `${keys[0]}_${keys[1]}`, // weather + day type
          `${keys[0]}_${keys[2]}`, // weather + temp
        ];

        for (const pk of composites) {
          if (!patterns[pk]) patterns[pk] = { uplifts: [], omzets: [], orders: [] };
          patterns[pk].uplifts.push(uplift);
          patterns[pk].omzets.push(biz.omzet);
          patterns[pk].orders.push(biz.orders_count);
        }
      }

      // Upsert correlations
      const correlationRows = Object.entries(patterns).map(([key, data]) => {
        const n = data.uplifts.length;
        // Robust average (trim top/bottom 10% if enough samples)
        let trimmedUplifts = data.uplifts;
        if (n >= 10) {
          const sorted = [...data.uplifts].sort((a, b) => a - b);
          const trim = Math.floor(n * 0.1);
          trimmedUplifts = sorted.slice(trim, n - trim);
        }
        const avgUplift = trimmedUplifts.reduce((s, v) => s + v, 0) / trimmedUplifts.length;
        const avgOmzet = data.omzets.reduce((s, v) => s + v, 0) / n;
        const avgOrders = data.orders.reduce((s, v) => s + v, 0) / n;

        // Confidence: min 10 for low, 30 for medium, 60 for high
        const confidence = Math.min(95, Math.max(5, n * 3 + (n >= 10 ? 20 : 0)));

        return {
          pattern_key: key,
          scope: "daily",
          category: key.includes("weekend") ? "weekend" : key.includes("weekday") ? "weekday" : "general",
          sample_size: n,
          uplift_percent: Math.round(avgUplift * 10) / 10,
          confidence_score: Math.round(confidence),
          avg_omzet: Math.round(avgOmzet * 100) / 100,
          avg_orders: Math.round(avgOrders * 10) / 10,
          last_updated: new Date().toISOString(),
        };
      });

      if (correlationRows.length > 0) {
        for (let i = 0; i < correlationRows.length; i += 50) {
          await supabase.from("weather_business_correlations").upsert(
            correlationRows.slice(i, i + 50),
            { onConflict: "pattern_key", ignoreDuplicates: false }
          );
        }
      }
    }

    // ─── 3. Reconcile forecast_learning_metrics ──────────────────────────
    const { data: unreconciledForecasts } = await supabase
      .from("forecast_learning_metrics")
      .select("*")
      .is("actual_value", null)
      .lte("forecast_date", toDateStr(new Date()));

    if (unreconciledForecasts?.length) {
      for (const fc of unreconciledForecasts) {
        const biz = dailyAgg[fc.forecast_date];
        if (!biz) continue;

        const actual = fc.forecast_target === "orders" ? biz.orders : biz.omzet;
        const absError = Math.abs(fc.predicted_value - actual);
        const pctError = actual > 0 ? (absError / actual) * 100 : 0;

        await supabase.from("forecast_learning_metrics").update({
          actual_value: actual,
          absolute_error: Math.round(absError * 100) / 100,
          percent_error: Math.round(pctError * 10) / 10,
        }).eq("id", fc.id);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      daily_facts_upserted: dailyRows.length,
      hourly_facts_upserted: hourlyRows.length,
      correlations_updated: Object.keys(dailyAgg).length > 0,
      forecasts_reconciled: unreconciledForecasts?.length ?? 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("weather-sync error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function isSunnyCode(code: string): boolean {
  return ["Clear", "MostlyClear"].includes(code ?? "");
}
