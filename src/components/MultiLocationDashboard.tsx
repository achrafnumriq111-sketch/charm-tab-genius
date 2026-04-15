import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Building2, TrendingUp, Users, Package, ShoppingCart,
  AlertTriangle, ChevronRight, RefreshCw,
} from "lucide-react";

interface LocationSummary {
  id: string;
  name: string;
  city: string;
  todayRevenue: number;
  todayOrders: number;
  weekRevenue: number;
  weekOrders: number;
  staffCount: number;
  activeStaff: string[];
  lowStockCount: number;
  lowStockItems: { name: string; current: number; minimum: number; unit: string }[];
  topProducts: { name: string; qty: number; revenue: number }[];
}

function euro(n: number) {
  return `€${n.toFixed(2).replace(".", ",")}`;
}

export default function MultiLocationDashboard() {
  const [summaries, setSummaries] = useState<LocationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchData = useCallback(async () => {
    setLoading(true);

    // Get all active locations
    const { data: locations } = await supabase
      .from("locations")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (!locations || locations.length === 0) {
      setSummaries([]);
      setLoading(false);
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    // Parallel fetches
    const [txRes, empRes, invRes] = await Promise.all([
      supabase
        .from("pos_transactions")
        .select("id, total, items, location_id, created_at, status")
        .gte("created_at", weekAgo)
        .eq("status", "completed"),
      supabase
        .from("employees")
        .select("id, full_name, role, location_id, is_active")
        .eq("is_active", true),
      supabase
        .from("inventory_items")
        .select("id, item_name, current_stock, minimum_stock, unit_type, location_id"),
    ]);

    const transactions = txRes.data || [];
    const employees = empRes.data || [];
    const inventory = invRes.data || [];

    const results: LocationSummary[] = locations.map((loc) => {
      const locTx = transactions.filter((t) => t.location_id === loc.id);
      const todayTx = locTx.filter((t) => t.created_at?.startsWith(today));
      const locEmp = employees.filter((e) => e.location_id === loc.id);
      const locInv = inventory.filter((i) => i.location_id === loc.id);
      const lowStock = locInv.filter((i) => i.current_stock <= i.minimum_stock);

      // Top products from today's transactions
      const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
      todayTx.forEach((tx) => {
        const items = (tx.items as any[]) || [];
        items.forEach((item) => {
          const key = item.productId || item.name;
          if (!productMap[key]) productMap[key] = { name: item.name, qty: 0, revenue: 0 };
          productMap[key].qty += item.qty || 1;
          productMap[key].revenue += (item.price || 0) * (item.qty || 1);
        });
      });
      const topProducts = Object.values(productMap)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      return {
        id: loc.id,
        name: loc.name,
        city: loc.city,
        todayRevenue: todayTx.reduce((s, t) => s + (t.total || 0), 0),
        todayOrders: todayTx.length,
        weekRevenue: locTx.reduce((s, t) => s + (t.total || 0), 0),
        weekOrders: locTx.length,
        staffCount: locEmp.length,
        activeStaff: locEmp.map((e) => e.full_name),
        lowStockCount: lowStock.length,
        lowStockItems: lowStock.slice(0, 5).map((i) => ({
          name: i.item_name,
          current: i.current_stock,
          minimum: i.minimum_stock,
          unit: i.unit_type,
        })),
        topProducts,
      };
    });

    setSummaries(results);
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalRevenue = summaries.reduce((s, l) => s + l.todayRevenue, 0);
  const totalOrders = summaries.reduce((s, l) => s + l.todayOrders, 0);
  const totalStaff = summaries.reduce((s, l) => s + l.staffCount, 0);
  const totalAlerts = summaries.reduce((s, l) => s + l.lowStockCount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Multi-Locatie Overzicht
          </h2>
          <p className="text-xs text-muted-foreground">
            Laatst bijgewerkt: {lastRefresh.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Vernieuwen
        </Button>
      </div>

      {/* Global KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="rounded-2xl border-white/70 bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgba(162,178,226,0.10)]">
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto mb-1 text-emerald-600" />
            <div className="text-2xl font-black">{euro(totalRevenue)}</div>
            <div className="text-[11px] text-muted-foreground">Omzet vandaag</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-white/70 bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgba(162,178,226,0.10)]">
          <CardContent className="p-4 text-center">
            <ShoppingCart className="h-5 w-5 mx-auto mb-1 text-blue-600" />
            <div className="text-2xl font-black">{totalOrders}</div>
            <div className="text-[11px] text-muted-foreground">Orders vandaag</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-white/70 bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgba(162,178,226,0.10)]">
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 mx-auto mb-1 text-violet-600" />
            <div className="text-2xl font-black">{totalStaff}</div>
            <div className="text-[11px] text-muted-foreground">Medewerkers actief</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-white/70 bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgba(162,178,226,0.10)]">
          <CardContent className="p-4 text-center">
            <AlertTriangle className={`h-5 w-5 mx-auto mb-1 ${totalAlerts > 0 ? "text-red-500" : "text-emerald-500"}`} />
            <div className="text-2xl font-black">{totalAlerts}</div>
            <div className="text-[11px] text-muted-foreground">Voorraad alerts</div>
          </CardContent>
        </Card>
      </div>

      {/* Per-location cards */}
      {loading && summaries.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Laden...</div>
      ) : summaries.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Geen locaties gevonden</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {summaries.map((loc) => (
            <Card key={loc.id} className="rounded-2xl border-white/70 bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgba(162,178,226,0.10)] overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-violet-500" />
                    {loc.name}
                  </CardTitle>
                  <Badge variant="secondary" className="text-[10px]">{loc.city}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Revenue row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-emerald-50/80 border border-emerald-100/50 p-3">
                    <div className="text-[10px] text-emerald-700 font-medium">Vandaag</div>
                    <div className="text-lg font-black text-emerald-800">{euro(loc.todayRevenue)}</div>
                    <div className="text-[10px] text-emerald-600">{loc.todayOrders} orders</div>
                  </div>
                  <div className="rounded-xl bg-blue-50/80 border border-blue-100/50 p-3">
                    <div className="text-[10px] text-blue-700 font-medium">7 dagen</div>
                    <div className="text-lg font-black text-blue-800">{euro(loc.weekRevenue)}</div>
                    <div className="text-[10px] text-blue-600">{loc.weekOrders} orders</div>
                  </div>
                </div>

                {/* Staff */}
                <div className="rounded-xl bg-violet-50/80 border border-violet-100/50 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-violet-700 font-medium">Team ({loc.staffCount})</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {loc.activeStaff.map((name) => (
                      <Badge key={name} variant="secondary" className="text-[10px] bg-violet-100/80 text-violet-800">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Low stock */}
                {loc.lowStockCount > 0 && (
                  <div className="rounded-xl bg-red-50/80 border border-red-100/50 p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <AlertTriangle className="h-3 w-3 text-red-500" />
                      <span className="text-[10px] text-red-700 font-medium">
                        Lage voorraad ({loc.lowStockCount})
                      </span>
                    </div>
                    <div className="space-y-1">
                      {loc.lowStockItems.map((item) => (
                        <div key={item.name} className="flex items-center justify-between text-[11px]">
                          <span className="text-red-800">{item.name}</span>
                          <span className="font-semibold text-red-600">
                            {item.current}/{item.minimum} {item.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top products */}
                {loc.topProducts.length > 0 && (
                  <div>
                    <div className="text-[10px] text-muted-foreground font-medium mb-1.5">
                      Top producten vandaag
                    </div>
                    <div className="space-y-1">
                      {loc.topProducts.map((p, idx) => (
                        <div key={p.name} className="flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1.5">
                            <span className="font-bold text-muted-foreground w-4">{idx + 1}.</span>
                            {p.name}
                          </span>
                          <span className="font-semibold">{p.qty}× · {euro(p.revenue)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
