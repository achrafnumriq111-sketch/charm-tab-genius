import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type AnyRow = Record<string, any>;

// Default VAT defaults used only when a location has no rows yet.
const VAT_DEFAULTS: Record<string, number> = {
  "Signature Drinks": 9, "Specials": 9, "Cold Drinks": 9, "Hot Drinks": 9, "Sweets": 9, default: 21,
};

// Default discounts seeded into a fresh location (matches former hardcoded list).
const DEFAULT_DISCOUNTS = [
  { name: "Verkeerde Drankje", discount_type: "percent", value: 100 },
  { name: "Influencer", discount_type: "percent", value: 100 },
  { name: "Staff use", discount_type: "percent", value: 40 },
  { name: "Familie", discount_type: "percent", value: 30 },
  { name: "Gemeente", discount_type: "percent", value: 10 },
  { name: "Matcha Zakje", discount_type: "percent", value: 25 },
];

export interface LiveDataApi {
  loaded: boolean;
  products: AnyRow[];
  zones: AnyRow[];
  tables: AnyRow[];
  reservations: AnyRow[];
  discounts: AnyRow[];
  activityLogs: AnyRow[];
  vatRates: Record<string, number>;
  settings: AnyRow | null;
  // CRUD
  createProduct: (p: Partial<AnyRow>) => Promise<AnyRow | null>;
  updateProduct: (id: string, p: Partial<AnyRow>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  setProducts: React.Dispatch<React.SetStateAction<AnyRow[]>>;

  createZone: (name: string) => Promise<AnyRow | null>;
  deleteZone: (id: string) => Promise<void>;

  createTable: (t: Partial<AnyRow>) => Promise<AnyRow | null>;
  updateTable: (id: string, t: Partial<AnyRow>) => Promise<void>;
  deleteTable: (id: string) => Promise<void>;
  setTables: React.Dispatch<React.SetStateAction<AnyRow[]>>;

  createReservation: (r: Partial<AnyRow>) => Promise<AnyRow | null>;
  updateReservation: (id: string, r: Partial<AnyRow>) => Promise<void>;
  deleteReservation: (id: string) => Promise<void>;

  createDiscount: (d: Partial<AnyRow>) => Promise<AnyRow | null>;
  updateDiscount: (id: string, d: Partial<AnyRow>) => Promise<void>;
  deleteDiscount: (id: string) => Promise<void>;

  setVatRate: (category: string, rate: number) => Promise<void>;
  updateSettings: (patch: Partial<AnyRow>) => Promise<void>;

  appendActivityLog: (entry: { employeeId?: string | null; employeeName?: string; employeeRole?: string; action: string; details: string; metadata?: AnyRow }) => Promise<void>;
}

export function useLiveData(locationId: string | null): LiveDataApi {
  const [loaded, setLoaded] = useState(false);
  const [products, setProducts] = useState<AnyRow[]>([]);
  const [zones, setZones] = useState<AnyRow[]>([]);
  const [tables, setTables] = useState<AnyRow[]>([]);
  const [reservations, setReservations] = useState<AnyRow[]>([]);
  const [discounts, setDiscounts] = useState<AnyRow[]>([]);
  const [activityLogs, setActivityLogs] = useState<AnyRow[]>([]);
  const [vatRates, setVatRatesState] = useState<Record<string, number>>(VAT_DEFAULTS);
  const [settings, setSettings] = useState<AnyRow | null>(null);
  const seededRef = useRef<string | null>(null);

  // Fetch + realtime
  useEffect(() => {
    if (!locationId) {
      setLoaded(false);
      setProducts([]); setZones([]); setTables([]); setReservations([]);
      setDiscounts([]); setActivityLogs([]); setSettings(null);
      setVatRatesState(VAT_DEFAULTS);
      return;
    }
    let cancelled = false;

    const load = async () => {
      const [pr, zn, tb, rs, dc, vt, ls, lg] = await Promise.all([
        supabase.from("products").select("*").eq("location_id", locationId).eq("is_active", true).order("section").order("name"),
        supabase.from("floor_zones").select("*").eq("location_id", locationId).eq("is_active", true).order("sort_order").order("name"),
        supabase.from("floor_tables").select("*").eq("location_id", locationId).eq("is_active", true),
        supabase.from("reservations").select("*").eq("location_id", locationId).order("reservation_date", { ascending: false }),
        supabase.from("discounts").select("*").eq("location_id", locationId).eq("is_active", true).order("sort_order").order("name"),
        supabase.from("vat_category_rates").select("*").eq("location_id", locationId),
        supabase.from("location_settings").select("*").eq("location_id", locationId).maybeSingle(),
        supabase.from("activity_logs").select("*").eq("location_id", locationId).order("created_at", { ascending: false }).limit(500),
      ]);
      if (cancelled) return;
      setProducts(pr.data || []);
      setZones(zn.data || []);
      setTables(tb.data || []);
      setReservations(rs.data || []);
      setDiscounts(dc.data || []);
      const vatMap: Record<string, number> = { ...VAT_DEFAULTS };
      (vt.data || []).forEach((r: AnyRow) => { vatMap[r.category] = Number(r.rate); });
      setVatRatesState(vatMap);
      setSettings(ls.data || null);
      setActivityLogs(lg.data || []);
      setLoaded(true);

      // Seed defaults once per location (settings row + discounts) — no demo products/tables.
      if (seededRef.current !== locationId) {
        seededRef.current = locationId;
        if (!ls.data) {
          await supabase.from("location_settings").insert({ location_id: locationId }).then(({ data }) => {
            if (data && data[0]) setSettings(data[0]);
          });
        }
        if ((dc.data || []).length === 0) {
          const rows = DEFAULT_DISCOUNTS.map((d, i) => ({ ...d, location_id: locationId, sort_order: i }));
          const { data } = await supabase.from("discounts").insert(rows as any).select();
          if (data) setDiscounts(data);
        }
        if ((vt.data || []).length === 0) {
          const rows = Object.entries(VAT_DEFAULTS).map(([category, rate]) => ({ location_id: locationId, category, rate }));
          await supabase.from("vat_category_rates").insert(rows as any);
        }
      }
    };
    load();

    const ch = supabase
      .channel(`live-${locationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "products", filter: `location_id=eq.${locationId}` }, (p) => {
        setProducts((prev) => mergeRow(prev, p));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "floor_zones", filter: `location_id=eq.${locationId}` }, (p) => {
        setZones((prev) => mergeRow(prev, p));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "floor_tables", filter: `location_id=eq.${locationId}` }, (p) => {
        setTables((prev) => mergeRow(prev, p));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations", filter: `location_id=eq.${locationId}` }, (p) => {
        setReservations((prev) => mergeRow(prev, p));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "discounts", filter: `location_id=eq.${locationId}` }, (p) => {
        setDiscounts((prev) => mergeRow(prev, p));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_logs", filter: `location_id=eq.${locationId}` }, (p) => {
        setActivityLogs((prev) => [p.new as AnyRow, ...prev].slice(0, 500));
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [locationId]);

  // ----- CRUD helpers -----
  const createProduct = useCallback(async (p: Partial<AnyRow>) => {
    if (!locationId) return null;
    const { data, error } = await supabase.from("products").insert({ ...p, location_id: locationId } as any).select().single();
    if (error) { console.error(error); return null; }
    return data;
  }, [locationId]);

  const updateProduct = useCallback(async (id: string, p: Partial<AnyRow>) => {
    await supabase.from("products").update(p as any).eq("id", id);
  }, []);

  const deleteProduct = useCallback(async (id: string) => {
    await supabase.from("products").update({ is_active: false }).eq("id", id);
    setProducts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const createZone = useCallback(async (name: string) => {
    if (!locationId) return null;
    const { data } = await supabase.from("floor_zones").insert({ location_id: locationId, name }).select().single();
    return data;
  }, [locationId]);

  const deleteZone = useCallback(async (id: string) => {
    await supabase.from("floor_zones").update({ is_active: false }).eq("id", id);
    setZones((prev) => prev.filter((z) => z.id !== id));
  }, []);

  const createTable = useCallback(async (t: Partial<AnyRow>) => {
    if (!locationId) return null;
    const { data } = await supabase.from("floor_tables").insert({ ...t, location_id: locationId } as any).select().single();
    return data;
  }, [locationId]);

  const updateTable = useCallback(async (id: string, t: Partial<AnyRow>) => {
    await supabase.from("floor_tables").update(t as any).eq("id", id);
  }, []);

  const deleteTable = useCallback(async (id: string) => {
    await supabase.from("floor_tables").update({ is_active: false }).eq("id", id);
    setTables((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const createReservation = useCallback(async (r: Partial<AnyRow>) => {
    if (!locationId) return null;
    const { data } = await supabase.from("reservations").insert({ ...r, location_id: locationId } as any).select().single();
    return data;
  }, [locationId]);

  const updateReservation = useCallback(async (id: string, r: Partial<AnyRow>) => {
    await supabase.from("reservations").update(r as any).eq("id", id);
  }, []);

  const deleteReservation = useCallback(async (id: string) => {
    await supabase.from("reservations").delete().eq("id", id);
    setReservations((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const createDiscount = useCallback(async (d: Partial<AnyRow>) => {
    if (!locationId) return null;
    const { data } = await supabase.from("discounts").insert({ ...d, location_id: locationId } as any).select().single();
    return data;
  }, [locationId]);

  const updateDiscount = useCallback(async (id: string, d: Partial<AnyRow>) => {
    await supabase.from("discounts").update(d as any).eq("id", id);
  }, []);

  const deleteDiscount = useCallback(async (id: string) => {
    await supabase.from("discounts").update({ is_active: false }).eq("id", id);
    setDiscounts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const setVatRate = useCallback(async (category: string, rate: number) => {
    if (!locationId) return;
    setVatRatesState((prev) => ({ ...prev, [category]: rate }));
    await supabase.from("vat_category_rates").upsert(
      { location_id: locationId, category, rate },
      { onConflict: "location_id,category" }
    );
  }, [locationId]);

  const updateSettings = useCallback(async (patch: Partial<AnyRow>) => {
    if (!locationId) return;
    setSettings((prev) => ({ ...(prev || { location_id: locationId }), ...patch }));
    await supabase.from("location_settings").upsert({ location_id: locationId, ...patch }, { onConflict: "location_id" });
  }, [locationId]);

  const appendActivityLog = useCallback(async (entry: { employeeId?: string | null; employeeName?: string; employeeRole?: string; action: string; details: string; metadata?: AnyRow }) => {
    if (!locationId) return;
    await supabase.from("activity_logs").insert({
      location_id: locationId,
      employee_id: entry.employeeId || null,
      employee_name: entry.employeeName || null,
      employee_role: entry.employeeRole || null,
      action: entry.action,
      details: entry.details,
      metadata: entry.metadata || {},
    });
  }, [locationId]);

  return {
    loaded, products, zones, tables, reservations, discounts, activityLogs, vatRates, settings,
    createProduct, updateProduct, deleteProduct, setProducts,
    createZone, deleteZone,
    createTable, updateTable, deleteTable, setTables,
    createReservation, updateReservation, deleteReservation,
    createDiscount, updateDiscount, deleteDiscount,
    setVatRate, updateSettings, appendActivityLog,
  };
}

function mergeRow(prev: AnyRow[], payload: any): AnyRow[] {
  const { eventType, new: newRow, old } = payload;
  if (eventType === "DELETE") return prev.filter((r) => r.id !== old?.id);
  if (eventType === "INSERT") {
    if (prev.some((r) => r.id === newRow.id)) return prev;
    return [...prev, newRow];
  }
  if (eventType === "UPDATE") {
    // Hide soft-deleted rows
    if (newRow.is_active === false) return prev.filter((r) => r.id !== newRow.id);
    return prev.map((r) => (r.id === newRow.id ? { ...r, ...newRow } : r));
  }
  return prev;
}
