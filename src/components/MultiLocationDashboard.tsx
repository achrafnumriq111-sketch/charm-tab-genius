import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLocation_ } from "@/contexts/LocationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2, TrendingUp, Users, ShoppingCart,
  AlertTriangle, RefreshCw, Crown, Trophy,
} from "lucide-react";

type Period = "today" | "7d" | "30d";

interface LocationSummary {
  id: string;
  name: string;
  city: string;
  todayRevenue: number;
  todayOrders: number;
  periodRevenue: number;
  periodOrders: number;
  staffCount: number;
  activeStaff: string[];
  lowStockCount: number;
  lowStockItems: { name: string; current: number; minimum: number; unit: string }[];
  topProducts: { name: string; qty: number; revenue: number }[];
}

const PERIOD_LABEL: Record<Period, string> = {
  today: "Vandaag",
  "7d": "Laatste 7 dagen",
  "30d": "Laatste 30 dagen",
};

function euro(n: number) {
  return `€${n.toFixed(2).replace(".", ",")}`;
}

function startOfPeriod(p: Period): Date {
  const d = new Date();
  if (p === "today") {
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (p === "7d") return new Date(Date.now() - 7 * 86400000);
  return new Date(Date.now() - 30 * 86400000);
}

export default function MultiLocationDashboard() {
  const { tenantId } = useLocation_();
  const [summaries, setSummaries] = useState<LocationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [period, setPeriod] = useState<Period>("today");

  const fetchData = useCallback(async () => {
    setLoading(true);

    // Tenant-scoped (defense in depth — RLS also enforces this)
    let locQ = supabase.from("locations").select("*").eq("is_active", true).order("name");
    if (tenantId) locQ = locQ.eq("tenant_id", tenantId);
    const { data: locations } = await locQ;

    if (!locations || locations.length === 0) {
      setSummaries([]);
      setLoading(false);
      return;
    }

    const periodStart = startOfPeriod(period).toISOString();
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const today = todayStart.toISOString().slice(0, 10);

    let txQ = supabase
      .from("pos_transactions")
      .select("id, total, items, location_id, created_at, status")
      .gte("created_at", periodStart)
      .eq("status", "completed");
    if (tenantId) txQ = txQ.eq("tenant_id", tenantId);

    let empQ = supabase
      .from("employees")
      .select("id, full_name, role, location_id, is_active")
      .eq("is_active", true);
    if (tenantId) empQ = empQ.eq("tenant_id", tenantId);

    let invQ = supabase
      .from("inventory_items")
      .select("id, item_name, current_stock, minimum_stock, unit_type, location_id");
    if (tenantId) invQ = invQ.eq("tenant_id", tenantId);

    const [txRes, empRes, invRes] = await Promise.all([txQ, empQ, invQ]);
    const transactions = txRes.data || [];
    const employees = empRes.data || [];
    const inventory = invRes.data || [];

    const results: LocationSummary[] = locations.map((loc: any) => {
      const locTx = transactions.filter((t: any) => t.location_id === loc.id);
      const todayTx = locTx.filter((t: any) => t.created_at?.startsWith(today));
      const locEmp = employees.filter((e: any) => e.location_id === loc.id);
      const locInv = inventory.filter((i: any) => i.location_id === loc.id);
      const lowStock = locInv.filter((i: any) => i.current_stock <= i.minimum_stock);

      const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
      locTx.forEach((tx: any) => {
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
        todayRevenue: todayTx.reduce((s: number, t: any) => s + (t.total || 0), 0),
        todayOrders: todayTx.length,
        periodRevenue: locTx.reduce((s: number, t: any) => s + (t.total || 0), 0),
        periodOrders: locTx.length,
        staffCount: locEmp.length,
        activeStaff: locEmp.map((e: any) => e.full_name),
        lowStockCount: lowStock.length,
        lowStockItems: lowStock.slice(0, 5).map((i: any) => ({
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
  }, [tenantId, period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalRevenue = summaries.reduce((s, l) => s + l.periodRevenue, 0);
  const totalOrders = summaries.reduce((s, l) => s + l.periodOrders, 0);
  const totalStaff = summaries.reduce((s, l) => s + l.staffCount, 0);
  const totalAlerts = summaries.reduce((s, l) => s + l.lowStockCount, 0);

  const ranked = useMemo(() => [...summaries].sort((a, b) => b.periodRevenue - a.periodRevenue), [summaries]);
  const maxRev = ranked[0]?.periodRevenue || 1;
  const topLocId = ranked[0]?.id;

  // Aggregated top products across locations
  const aggregatedTop = useMemo(() => {
    const map: Record<string, { name: string; qty: number; revenue: number }> = {};
    summaries.forEach((loc) => {
      loc.topProducts.forEach((p) => {
        if (!map[p.name]) map[p.name] = { name: p.name, qty: 0, revenue: 0 };
        map[p.name].qty += p.qty;
        map[p.name].revenue += p.revenue;
      });
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [summaries]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Multi-Locatie Overzicht
          </h2>
          <p className="text-xs text-muted-foreground">
            {PERIOD_LABEL[period]} · Laatst bijgewerkt: {lastRefresh.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-white/60 border border-white/70 backdrop-blur-xl p-1">
            {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                  period === p ? "bg-slate-900 text-white shadow" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {PERIOD_LABEL[p]}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Vernieuwen
          </Button>
        </div>
      </div>

      {/* Global KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-white/70 bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgba(162,178,226,0.10)]">
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto mb-1 text-emerald-600" />
            <div className="text-2xl font-black">{euro(totalRevenue)}</div>
            <div className="text-[11px] text-muted-foreground">Omzet · {PERIOD_LABEL[period].toLowerCase()}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-white/70 bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgba(162,178,226,0.10)]">
          <CardContent className="p-4 text-center">
            <ShoppingCart className="h-5 w-5 mx-auto mb-1 text-blue-600" />
            <div className="text-2xl font-black">{totalOrders}</div>
            <div className="text-[11px] text-muted-foreground">Orders</div>
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

      {/* Ranking bar comparison */}
      {ranked.length > 1 && (
        <Card className="rounded-2xl border-white/70 bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgba(162,178,226,0.10)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" /> Ranglijst — omzet per locatie
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ranked.map((loc, idx) => {
              const pct = Math.max(2, Math.round((loc.periodRevenue / maxRev) * 100));
              const isTop = loc.id === topLocId;
              return (
                <div key={loc.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="font-bold text-muted-foreground w-4">{idx + 1}.</span>
                      <span className="font-medium">{loc.name}</span>
                      {isTop && <Crown className="h-3 w-3 text-amber-500" />}
                    </span>
                    <span className="font-semibold tabular-nums">{euro(loc.periodRevenue)} · {loc.periodOrders} orders</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: isTop
                          ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                          : "linear-gradient(90deg, #6366f1, #818cf8)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Aggregated top products */}
      {aggregatedTop.length > 0 && (
        <Card className="rounded-2xl border-white/70 bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgba(162,178,226,0.10)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">Top producten — alle locaties</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
              {aggregatedTop.map((p, idx) => (
                <div key={p.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="font-bold text-muted-foreground w-4">{idx + 1}.</span>
                    <span className="truncate">{p.name}</span>
                  </span>
                  <span className="font-semibold tabular-nums shrink-0">{p.qty}× · {euro(p.revenue)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                    {loc.id === topLocId && ranked.length > 1 && <Crown className="h-4 w-4 text-amber-500" />}
                  </CardTitle>
                  <Badge variant="secondary" className="text-[10px]">{loc.city}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-emerald-50/80 border border-emerald-100/50 p-3">
                    <div className="text-[10px] text-emerald-700 font-medium">Vandaag</div>
                    <div className="text-lg font-black text-emerald-800">{euro(loc.todayRevenue)}</div>
                    <div className="text-[10px] text-emerald-600">{loc.todayOrders} orders</div>
                  </div>
                  <div className="rounded-xl bg-blue-50/80 border border-blue-100/50 p-3">
                    <div className="text-[10px] text-blue-700 font-medium">{PERIOD_LABEL[period]}</div>
                    <div className="text-lg font-black text-blue-800">{euro(loc.periodRevenue)}</div>
                    <div className="text-[10px] text-blue-600">{loc.periodOrders} orders</div>
                  </div>
                </div>

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

                {loc.topProducts.length > 0 && (
                  <div>
                    <div className="text-[10px] text-muted-foreground font-medium mb-1.5">
                      Top producten · {PERIOD_LABEL[period].toLowerCase()}
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
