import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all relevant data
    const [inventoryRes, movementsRes, intakesRes, countsRes, transactionsRes] = await Promise.all([
      supabase.from("inventory_items").select("*"),
      supabase.from("stock_movements").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("stock_intakes").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("stock_counts").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("pos_transactions").select("created_at, items, total, payment_method").order("created_at", { ascending: false }).limit(1000),
    ]);

    const inventory = inventoryRes.data || [];
    const movements = movementsRes.data || [];
    const intakes = intakesRes.data || [];
    const counts = countsRes.data || [];
    const transactions = transactionsRes.data || [];

    const { type } = await req.json().catch(() => ({ type: "forecast" }));

    const systemPrompt = `Je bent een AI-assistent voor voorraad- en kostprijsbeheer van een premium matcha café (SAAKOUK).
Je analyseert verkoopdata, voorraaddata, leveringen, tellingen en bewegingen.
Je geeft antwoorden in het Nederlands, kort en zakelijk.
Gebruik euro-notatie (€). Geef concrete acties en cijfers.
Focus op: voorspellingen, besteladvies, verspilling, marges, en seizoenspatronen.`;

    let userPrompt = "";

    if (type === "forecast") {
      userPrompt = `Analyseer de volgende voorraaddata en geef een forecast rapport:

INVENTARIS (${inventory.length} items):
${inventory.map(i => `- ${i.item_name}: ${i.current_stock} ${i.unit_type}, min: ${i.minimum_stock}, kost: €${i.cost_per_unit}/${i.unit_type}, gem. gebruik: ${i.avg_monthly_usage}/${i.unit_type}/maand`).join("\n")}

RECENTE BEWEGINGEN (${movements.length}):
${movements.slice(0, 50).map(m => `- ${m.movement_type}: ${m.quantity} (${m.product_sold || "n/a"}) op ${m.created_at}`).join("\n")}

LEVERINGEN (${intakes.length}):
${intakes.slice(0, 20).map(i => `- ${i.quantity} ${i.unit} @ €${i.purchase_price} van ${i.supplier || "onbekend"} op ${i.delivery_date}`).join("\n")}

TELLINGEN (${counts.length}):
${counts.slice(0, 20).map(c => `- Systeem: ${c.system_stock}, Geteld: ${c.physical_count}, Verschil: ${c.difference} (${c.difference_pct}%)`).join("\n")}

TRANSACTIES (laatste ${transactions.length}):
- Totaal omzet: €${transactions.reduce((s, t) => s + (t.total || 0), 0).toFixed(2)}
- Gem. per dag: €${(transactions.reduce((s, t) => s + (t.total || 0), 0) / Math.max(1, new Set(transactions.map(t => t.created_at?.split("T")[0])).size)).toFixed(2)}

Geef exact dit JSON format terug:
{
  "summary": "korte samenvatting",
  "predictions": [{"item": "naam", "days_left": number, "monthly_forecast": number, "reorder_date": "yyyy-mm-dd", "suggested_quantity": number, "confidence": "high|medium|low"}],
  "alerts": [{"type": "low_stock|waste|price_change|shrinkage", "message": "beschrijving", "severity": "high|medium|low"}],
  "recommendations": ["actie 1", "actie 2"],
  "trends": {"busiest_day": "dag", "avg_daily_sales": number, "growth_pct": number}
}`;
    } else if (type === "pricing") {
      userPrompt = `Analyseer de marges en geef prijsadvies voor het café.

TRANSACTIES: ${transactions.length} bestellingen, totaal €${transactions.reduce((s, t) => s + (t.total || 0), 0).toFixed(2)}

INVENTARIS KOSTEN:
${inventory.map(i => `- ${i.item_name}: €${i.cost_per_unit}/${i.unit_type}`).join("\n")}

Geef JSON terug:
{
  "pricing_recommendations": [{"product": "naam", "current_margin": number, "suggested_price": number, "reason": "uitleg"}],
  "cost_alerts": [{"item": "naam", "message": "uitleg"}],
  "overall_health": "good|warning|critical",
  "avg_margin": number
}`;
    } else if (type === "dynamic_item") {
      const { itemName, movements: itemMovements, intakes: itemIntakes, currentStock, unitType } = await req.json().catch(() => ({}));
      userPrompt = `Analyseer dit dynamic stock item en geef een forecast:

ITEM: ${itemName || "Onbekend"}
HUIDIGE VOORRAAD: ${currentStock} ${unitType}

BEWEGINGEN (laatste ${(itemMovements || []).length}):
${(itemMovements || []).slice(0, 50).map((m: any) => `- ${m.movement_type}: ${m.quantity} ${unitType} (${m.product_sold || "n/a"}) op ${m.created_at}`).join("\n")}

LEVERINGEN (laatste ${(itemIntakes || []).length}):
${(itemIntakes || []).slice(0, 20).map((i: any) => `- +${i.quantity} ${i.unit} op ${i.delivery_date}`).join("\n")}

Geef JSON terug:
{
  "recommendation": "korte aanbeveling",
  "predicted_usage": number,
  "suggested_stock": number,
  "trend": "beschrijving van trend",
  "weekday_pattern": "patroon per weekdag",
  "confidence": "high|medium|low"
}`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit bereikt, probeer later opnieuw." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Credits op, voeg credits toe in Lovable instellingen." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Try to parse JSON from the response
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: content };
    } catch {
      parsed = { raw: content };
    }

    return new Response(JSON.stringify({ success: true, data: parsed, type }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("inventory-forecast error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
