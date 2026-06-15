// Accounting export edge function
// Streams a CSV of POS transactions in Moneybird- or Exact-compatible format.
//
// Usage: GET /accounting-export?location_id=<uuid>&start=<iso>&end=<iso>&format=moneybird|exact|generic&vat_rate=9
//
// verify_jwt = true is the default for Lovable-managed functions; this function
// honors the caller's auth context to enforce RLS via the standard supabase client.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Tx {
  id: string;
  order_id: string;
  created_at: string;
  total: number;
  subtotal: number;
  discount: number;
  tip: number;
  gift_card_deduction: number;
  payment_method: string;
  customer_name: string | null;
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowToMoneybird(tx: Tx, vatRate: number, locationName: string): string[] {
  // Moneybird CSV import: date,description,amount,vat_percentage,contact
  const date = tx.created_at.slice(0, 10);
  const gross = Number(tx.subtotal);
  const description = `POS ${locationName} — order ${tx.order_id}`;
  return [
    date,
    description,
    gross.toFixed(2),
    String(vatRate),
    tx.customer_name || "Kassa",
  ];
}

function rowToExact(tx: Tx, vatRate: number, locationName: string): string[] {
  // Exact Online import: GLAccount, Date, Description, Amount, VATCode, Reference
  const date = tx.created_at.slice(0, 10);
  const gross = Number(tx.subtotal);
  const vatCode = vatRate === 21 ? "1" : "2"; // 1=high, 2=low (simplified)
  return [
    "8000", // Default revenue account
    date,
    `POS ${locationName} order ${tx.order_id}`,
    gross.toFixed(2),
    vatCode,
    tx.order_id,
  ];
}

function rowToGeneric(tx: Tx, vatRate: number): string[] {
  const date = tx.created_at.slice(0, 10);
  const time = tx.created_at.slice(11, 19);
  const gross = Number(tx.subtotal);
  const net = gross / (1 + vatRate / 100);
  const vat = gross - net;
  return [
    date,
    time,
    tx.order_id,
    gross.toFixed(2),
    net.toFixed(2),
    vat.toFixed(2),
    String(vatRate),
    tx.payment_method,
    Number(tx.discount).toFixed(2),
    Number(tx.tip).toFixed(2),
    Number(tx.gift_card_deduction).toFixed(2),
    tx.customer_name || "",
  ];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const locationId = url.searchParams.get("location_id");
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    const format = (url.searchParams.get("format") || "generic").toLowerCase();
    const vatRate = Number(url.searchParams.get("vat_rate") || "9");

    if (!locationId || !start || !end) {
      return new Response(
        JSON.stringify({ error: "location_id, start and end query params are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Fetch location name (RLS enforces tenant)
    const { data: loc, error: locErr } = await supabase
      .from("locations")
      .select("id,name")
      .eq("id", locationId)
      .maybeSingle();

    if (locErr || !loc) {
      return new Response(JSON.stringify({ error: "location not accessible" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: rows, error } = await supabase
      .from("pos_transactions")
      .select("id,order_id,created_at,total,subtotal,discount,tip,gift_card_deduction,payment_method,customer_name")
      .eq("location_id", locationId)
      .eq("status", "completed")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: true });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let header: string[];
    let mapper: (tx: Tx) => string[];
    const locName = loc.name as string;

    if (format === "moneybird") {
      header = ["date", "description", "amount", "vat_percentage", "contact"];
      mapper = (tx) => rowToMoneybird(tx, vatRate, locName);
    } else if (format === "exact") {
      header = ["GLAccount", "Date", "Description", "Amount", "VATCode", "Reference"];
      mapper = (tx) => rowToExact(tx, vatRate, locName);
    } else {
      header = [
        "date", "time", "order_id", "gross_incl_vat", "net_excl_vat",
        "vat_amount", "vat_rate", "payment_method", "discount", "tip",
        "gift_card_used", "customer_name",
      ];
      mapper = (tx) => rowToGeneric(tx, vatRate);
    }

    const lines: string[] = [header.join(",")];
    for (const tx of (rows ?? []) as Tx[]) {
      lines.push(mapper(tx).map(csvEscape).join(","));
    }
    const csv = lines.join("\n") + "\n";

    const filename = `pnl_${format}_${start.slice(0, 10)}_${end.slice(0, 10)}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
