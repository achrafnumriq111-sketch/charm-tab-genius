import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Business hours for filtering
const SCHEDULE: Record<number, { open: number; close: number }> = {
  0: { open: 12, close: 24 },
  1: { open: 10, close: 22 },
  2: { open: 10, close: 22 },
  3: { open: 10, close: 22 },
  4: { open: 10, close: 22 },
  5: { open: 10, close: 24 },
  6: { open: 10, close: 24 },
};

function isOpenHour(weekday: number, hour: number): boolean {
  const s = SCHEDULE[weekday] ?? SCHEDULE[1];
  return hour >= s.open && hour < s.close;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const { type = "forecast", range = 7 } = body;

    // Fetch all needed data in parallel
    const [
      inventoryRes, movementsRes, intakesRes, countsRes, transactionsRes,
      dailyFactsRes, hourlyFactsRes, weatherDailyRes, correlationsRes, productCostsRes,
    ] = await Promise.all([
      supabase.from("inventory_items").select("*"),
      supabase.from("stock_movements").select("*").order("created_at", { ascending: false }).limit(2000),
      supabase.from("stock_intakes").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("stock_counts").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("pos_transactions").select("created_at, items, total, payment_method, employee_name").order("created_at", { ascending: false }).limit(2000),
      supabase.from("business_daily_facts").select("*").order("date", { ascending: false }).limit(90),
      supabase.from("business_hourly_facts").select("*").order("date", { ascending: false }).limit(2000),
      supabase.from("weather_daily_observations").select("date, avg_temp_c, condition_code, is_rain, precipitation_chance, wind_speed, cloud_cover").order("date", { ascending: false }).limit(90),
      supabase.from("weather_business_correlations").select("*").limit(100),
      supabase.from("product_costs").select("*"),
    ]);

    const inventory = inventoryRes.data || [];
    const movements = movementsRes.data || [];
    const intakes = intakesRes.data || [];
    const counts = countsRes.data || [];
    const transactions = transactionsRes.data || [];
    const dailyFacts = dailyFactsRes.data || [];
    const hourlyFacts = (hourlyFactsRes.data || []).filter(
      (h: any) => isOpenHour(h.weekday, h.local_hour)
    );
    const weatherDaily = weatherDailyRes.data || [];
    const correlations = correlationsRes.data || [];
    const productCosts = productCostsRes.data || [];

    // Extract product sales from transactions
    const productSales: Record<string, { qty: number; revenue: number; dates: Set<string> }> = {};
    transactions.forEach((t: any) => {
      const date = t.created_at?.split("T")[0];
      const items = Array.isArray(t.items) ? t.items : [];
      items.forEach((item: any) => {
        const name = item.name || item.product_name || "Unknown";
        if (!productSales[name]) productSales[name] = { qty: 0, revenue: 0, dates: new Set() };
        productSales[name].qty += (item.quantity || 1);
        productSales[name].revenue += (item.price || 0) * (item.quantity || 1);
        if (date) productSales[name].dates.add(date);
      });
    });

    // Data quality metrics
    const dataQuality = {
      dailyFactDays: dailyFacts.length,
      hourlyFactRecords: hourlyFacts.length,
      transactionCount: transactions.length,
      movementCount: movements.length,
      weatherDays: weatherDaily.length,
      correlationCount: correlations.length,
      productCount: Object.keys(productSales).length,
      hasStaffing: hourlyFacts.some((h: any) => h.staff_count > 0),
    };

    // Compute aggregated data based on type
    let result: any = {};

    if (type === "revenue") {
      // Weekday averages
      const weekdayAgg: Record<number, { omzet: number[]; orders: number[] }> = {};
      dailyFacts.forEach((d: any) => {
        if (!weekdayAgg[d.weekday]) weekdayAgg[d.weekday] = { omzet: [], orders: [] };
        weekdayAgg[d.weekday].omzet.push(d.omzet);
        weekdayAgg[d.weekday].orders.push(d.orders_count);
      });

      const weekdayPatterns = Object.entries(weekdayAgg).map(([wd, data]) => ({
        weekday: Number(wd),
        avgOmzet: data.omzet.reduce((s, v) => s + v, 0) / data.omzet.length,
        avgOrders: data.orders.reduce((s, v) => s + v, 0) / data.orders.length,
        sampleSize: data.omzet.length,
        consistency: data.omzet.length > 1 ? 1 - (stddev(data.omzet) / (avg(data.omzet) || 1)) : 0.5,
      }));

      // Hourly patterns (only open hours)
      const hourlyAgg: Record<number, { omzet: number[]; orders: number[] }> = {};
      hourlyFacts.forEach((h: any) => {
        if (!hourlyAgg[h.local_hour]) hourlyAgg[h.local_hour] = { omzet: [], orders: [] };
        hourlyAgg[h.local_hour].omzet.push(h.omzet);
        hourlyAgg[h.local_hour].orders.push(h.orders_count);
      });

      const hourlyPatterns = Object.entries(hourlyAgg).map(([hr, data]) => ({
        hour: Number(hr),
        avgOmzet: avg(data.omzet),
        avgOrders: avg(data.orders),
        sampleSize: data.omzet.length,
      })).sort((a, b) => a.hour - b.hour);

      // Recent trend
      const sorted = [...dailyFacts].sort((a: any, b: any) => a.date.localeCompare(b.date));
      const last7 = sorted.slice(-7);
      const prior7 = sorted.slice(-14, -7);
      const recentAvg = last7.length > 0 ? avg(last7.map((d: any) => d.omzet)) : 0;
      const priorAvg = prior7.length > 0 ? avg(prior7.map((d: any) => d.omzet)) : recentAvg;
      const trendPct = priorAvg > 0 ? ((recentAvg - priorAvg) / priorAvg) * 100 : 0;

      // Weather-revenue correlation summary
      const weatherCorrelationSummary = correlations
        .filter((c: any) => c.scope === "daily" && c.sample_size >= 3)
        .map((c: any) => ({ key: c.pattern_key, uplift: c.uplift_percent, samples: c.sample_size }));

      result = {
        weekdayPatterns,
        hourlyPatterns,
        trendPct: Math.round(trendPct * 10) / 10,
        recentAvgDaily: Math.round(recentAvg * 100) / 100,
        totalDays: dailyFacts.length,
        weatherCorrelations: weatherCorrelationSummary,
        upcomingWeather: weatherDaily.filter((w: any) => w.date >= new Date().toISOString().slice(0, 10)).slice(0, range),
        dataQuality,
      };

    } else if (type === "product") {
      const totalDays = new Set(transactions.map((t: any) => t.created_at?.split("T")[0])).size || 1;
      const productList = Object.entries(productSales).map(([name, data]) => ({
        name,
        totalQty: data.qty,
        totalRevenue: Math.round(data.revenue * 100) / 100,
        avgDaily: Math.round((data.qty / totalDays) * 10) / 10,
        daysActive: data.dates.size,
      })).sort((a, b) => b.totalQty - a.totalQty);

      result = {
        products: productList,
        totalDays,
        totalProducts: productList.length,
        dataQuality,
      };

    } else if (type === "stock" || type === "forecast") {
      const itemMovements: Record<string, { deductions: number; restocks: number; dates: Set<string> }> = {};
      movements.forEach((m: any) => {
        if (!itemMovements[m.inventory_item_id]) itemMovements[m.inventory_item_id] = { deductions: 0, restocks: 0, dates: new Set() };
        if (m.movement_type === "sale_deduction" || m.movement_type === "waste") {
          itemMovements[m.inventory_item_id].deductions += Math.abs(m.quantity);
        } else if (m.movement_type === "stock_intake") {
          itemMovements[m.inventory_item_id].restocks += m.quantity;
        }
        itemMovements[m.inventory_item_id].dates.add(m.created_at.split("T")[0]);
      });

      const stockItems = inventory.map((item: any) => {
        const mv = itemMovements[item.id] || { deductions: 0, restocks: 0, dates: new Set() };
        const movDays = mv.dates.size || 1;
        const avgDailyUsage = mv.deductions / movDays;
        const daysRemaining = avgDailyUsage > 0 ? item.current_stock / avgDailyUsage : 999;

        return {
          id: item.id,
          name: item.item_name,
          currentStock: item.current_stock,
          unit: item.unit_type,
          minStock: item.minimum_stock,
          avgDailyUsage: Math.round(avgDailyUsage * 100) / 100,
          daysRemaining: Math.round(daysRemaining * 10) / 10,
          demand7d: Math.round(avgDailyUsage * 7 * 10) / 10,
          demand14d: Math.round(avgDailyUsage * 14 * 10) / 10,
          demand30d: Math.round(avgDailyUsage * 30 * 10) / 10,
          movementDays: movDays,
          totalDeducted: Math.round(mv.deductions * 100) / 100,
          totalRestocked: Math.round(mv.restocks * 100) / 100,
          risk: daysRemaining <= 3 ? "high" : daysRemaining <= 7 ? "medium" : "low",
        };
      }).sort((a: any, b: any) => a.daysRemaining - b.daysRemaining);

      result = {
        items: stockItems,
        totalItems: inventory.length,
        highRisk: stockItems.filter((i: any) => i.risk === "high").length,
        mediumRisk: stockItems.filter((i: any) => i.risk === "medium").length,
        dataQuality,
      };

    } else if (type === "staffing") {
      // Hourly staffing data with actual staff counts where available
      const staffHourly: Record<string, { orders: number[]; omzet: number[]; staff: number[] }> = {};
      hourlyFacts.forEach((h: any) => {
        const key = `${h.weekday}-${h.local_hour}`;
        if (!staffHourly[key]) staffHourly[key] = { orders: [], omzet: [], staff: [] };
        staffHourly[key].orders.push(h.orders_count);
        staffHourly[key].omzet.push(h.omzet);
        if (h.staff_count > 0) staffHourly[key].staff.push(h.staff_count);
      });

      const staffingPatterns = Object.entries(staffHourly).map(([key, data]) => {
        const [wd, hr] = key.split("-").map(Number);
        return {
          weekday: wd,
          hour: hr,
          avgOrders: avg(data.orders),
          avgOmzet: avg(data.omzet),
          avgStaff: data.staff.length > 0 ? avg(data.staff) : null,
          sampleSize: data.orders.length,
          hasStaffData: data.staff.length > 0,
        };
      });

      result = {
        patterns: staffingPatterns,
        hasStaffData: staffingPatterns.some(p => p.hasStaffData),
        upcomingWeather: weatherDaily.filter((w: any) => w.date >= new Date().toISOString().slice(0, 10)).slice(0, range),
        dataQuality,
      };

    } else if (type === "pricing") {
      const totalDays = new Set(transactions.map((t: any) => t.created_at?.split("T")[0])).size || 1;
      const productList = Object.entries(productSales).map(([name, data]) => {
        const cost = productCosts.find((c: any) => c.product_name === name);
        const avgPrice = data.qty > 0 ? data.revenue / data.qty : 0;
        const margin = cost ? ((avgPrice - cost.buying_price) / avgPrice) * 100 : null;

        return {
          name,
          totalQty: data.qty,
          totalRevenue: Math.round(data.revenue * 100) / 100,
          avgPrice: Math.round(avgPrice * 100) / 100,
          avgDaily: Math.round((data.qty / totalDays) * 10) / 10,
          buyingPrice: cost?.buying_price || null,
          sellingPrice: cost?.selling_price || null,
          margin: margin ? Math.round(margin * 10) / 10 : null,
          daysActive: data.dates.size,
        };
      }).sort((a, b) => b.totalRevenue - a.totalRevenue);

      result = {
        products: productList,
        totalDays,
        dataQuality,
      };
    }

    return new Response(JSON.stringify({ success: true, data: result, type, range }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("inventory-forecast error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function avg(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}

function stddev(arr: number[]): number {
  const m = avg(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}
