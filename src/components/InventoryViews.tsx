import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Package, Plus, Minus, Trash2, Search, X, Check,
  TrendingUp, AlertTriangle, Truck, BarChart3, Brain,
  ArrowDown, ArrowUp, RefreshCw, ClipboardCheck, DollarSign,
  Sparkles, Star, Eye, EyeOff, Loader2,
} from "lucide-react";

function euro(value: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(value);
}

function clsx(...parts: any[]) {
  return parts.filter(Boolean).join(" ");
}

// ─── INVENTORY MASTER VIEW ───────────────────────────────────────────────────

export function InventoryView({ onToast, addLog, currentRole, locationId }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({
    item_name: "", sku: "", category: "ingredient", unit_type: "gram",
    current_stock: "0", minimum_stock: "0", reorder_level: "0",
    cost_per_unit: "0", supplier: "", location: "main",
  });

  const loadItems = useCallback(async () => {
    let q = supabase.from("inventory_items").select("*").order("item_name");
    if (locationId) q = q.eq("location_id", locationId);
    const { data } = await q;
    if (data) setItems(data);
    setLoading(false);
  }, [locationId]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const categories = ["all", "ingredient", "packaging", "pastry", "retail", "cleaning", "misc"];
  const filtered = useMemo(() => items.filter(i =>
    (categoryFilter === "all" || i.category === categoryFilter) &&
    i.item_name.toLowerCase().includes(search.toLowerCase())
  ), [items, search, categoryFilter]);

  const lowStockItems = items.filter(i => i.current_stock <= i.minimum_stock && i.minimum_stock > 0);
  const totalValue = items.reduce((s, i) => s + i.current_stock * i.cost_per_unit, 0);

  async function saveItem() {
    const payload: any = {
      item_name: form.item_name,
      sku: form.sku || null,
      category: form.category as any,
      unit_type: form.unit_type,
      current_stock: parseFloat(form.current_stock) || 0,
      minimum_stock: parseFloat(form.minimum_stock) || 0,
      reorder_level: parseFloat(form.reorder_level) || 0,
      cost_per_unit: parseFloat(form.cost_per_unit) || 0,
      supplier: form.supplier || null,
      location: form.location || "main",
    };
    if (!editItem && locationId) payload.location_id = locationId;
    if (editItem) {
      await supabase.from("inventory_items").update(payload).eq("id", editItem.id);
      onToast?.(`${form.item_name} bijgewerkt`);
    } else {
      await supabase.from("inventory_items").insert(payload);
      onToast?.(`${form.item_name} toegevoegd`);
    }
    addLog?.("inventory_updated", `Voorraad item ${editItem ? "bijgewerkt" : "toegevoegd"}: ${form.item_name}`);
    setShowAdd(false); setEditItem(null);
    setForm({ item_name: "", sku: "", category: "ingredient", unit_type: "gram", current_stock: "0", minimum_stock: "0", reorder_level: "0", cost_per_unit: "0", supplier: "", location: "main" });
    loadItems();
  }

  function startEdit(item: any) {
    setForm({
      item_name: item.item_name, sku: item.sku || "", category: item.category,
      unit_type: item.unit_type, current_stock: String(item.current_stock),
      minimum_stock: String(item.minimum_stock), reorder_level: String(item.reorder_level),
      cost_per_unit: String(item.cost_per_unit), supplier: item.supplier || "", location: item.location || "main",
    });
    setEditItem(item);
    setShowAdd(true);
  }

  async function deleteItem(id: string) {
    await supabase.from("inventory_items").delete().eq("id", id);
    onToast?.("Item verwijderd");
    loadItems();
  }

  if (loading) return <div className="py-20 text-center text-muted-foreground">Laden...</div>;

  return (
    <div className="space-y-4">
      {/* KPI widgets */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Totaal items</div>
            <div className="text-2xl font-bold">{items.length}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-red-200">
          <CardContent className="p-4">
            <div className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Lage voorraad</div>
            <div className="text-2xl font-bold text-red-600">{lowStockItems.length}</div>
          </CardContent>
        </Card>
        {currentRole === "owner" && (
          <Card className="rounded-2xl">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Voorraadwaarde</div>
              <div className="text-2xl font-bold">{euro(totalValue)}</div>
            </CardContent>
          </Card>
        )}
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Categorieën</div>
            <div className="text-2xl font-bold">{new Set(items.map(i => i.category)).size}</div>
          </CardContent>
        </Card>
      </div>

      {/* Low stock alerts */}
      {lowStockItems.length > 0 && (
        <Card className="rounded-2xl border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="font-semibold text-red-800 text-sm mb-2 flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> Lage voorraad waarschuwingen</div>
            <div className="flex flex-wrap gap-2">
              {lowStockItems.map(i => (
                <Badge key={i.id} variant="destructive" className="text-xs">
                  {i.item_name}: {i.current_stock} {i.unit_type} (min: {i.minimum_stock})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Zoek item..." className="pl-9" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {categories.map(c => (
            <Button key={c} size="sm" variant={categoryFilter === c ? "default" : "outline"} className="text-xs rounded-full h-8 capitalize"
              onClick={() => setCategoryFilter(c)}>{c === "all" ? "Alle" : c}</Button>
          ))}
        </div>
        <Button onClick={() => { setShowAdd(true); setEditItem(null); setForm({ item_name: "", sku: "", category: "ingredient", unit_type: "gram", current_stock: "0", minimum_stock: "0", reorder_level: "0", cost_per_unit: "0", supplier: "", location: "main" }); }}>
          <Plus className="h-4 w-4 mr-1" /> Item
        </Button>
      </div>

      {/* Add/Edit form */}
      {showAdd && (
        <Card className="rounded-2xl">
          <CardContent className="p-4 space-y-3">
            <div className="font-semibold">{editItem ? "Item bewerken" : "Nieuw item"}</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><Label className="text-xs">Naam *</Label><Input value={form.item_name} onChange={e => setForm(p => ({ ...p, item_name: e.target.value }))} /></div>
              <div><Label className="text-xs">SKU</Label><Input value={form.sku} onChange={e => setForm(p => ({ ...p, sku: e.target.value }))} /></div>
              <div><Label className="text-xs">Categorie</Label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="w-full rounded-md border px-3 py-2 text-sm bg-white">
                  {["ingredient", "packaging", "pastry", "retail", "cleaning", "misc"].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><Label className="text-xs">Eenheid</Label>
                <select value={form.unit_type} onChange={e => setForm(p => ({ ...p, unit_type: e.target.value }))} className="w-full rounded-md border px-3 py-2 text-sm bg-white">
                  {["gram", "ml", "pieces", "kg", "liter", "units"].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div><Label className="text-xs">Huidige voorraad</Label><Input type="number" value={form.current_stock} onChange={e => setForm(p => ({ ...p, current_stock: e.target.value }))} /></div>
              <div><Label className="text-xs">Minimum</Label><Input type="number" value={form.minimum_stock} onChange={e => setForm(p => ({ ...p, minimum_stock: e.target.value }))} /></div>
              <div><Label className="text-xs">Herbestel niveau</Label><Input type="number" value={form.reorder_level} onChange={e => setForm(p => ({ ...p, reorder_level: e.target.value }))} /></div>
              {currentRole === "owner" && <div><Label className="text-xs">Kostprijs / eenheid (€)</Label><Input type="number" step="0.001" value={form.cost_per_unit} onChange={e => setForm(p => ({ ...p, cost_per_unit: e.target.value }))} /></div>}
              <div><Label className="text-xs">Leverancier</Label><Input value={form.supplier} onChange={e => setForm(p => ({ ...p, supplier: e.target.value }))} /></div>
              <div><Label className="text-xs">Locatie</Label><Input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} /></div>
            </div>
            <div className="flex gap-2">
              <Button onClick={saveItem} disabled={!form.item_name.trim()}><Check className="h-4 w-4 mr-1" /> {editItem ? "Bijwerken" : "Toevoegen"}</Button>
              <Button variant="outline" onClick={() => { setShowAdd(false); setEditItem(null); }}>Annuleren</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items table */}
      <Card className="rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[60vh]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 sticky top-0">
                  <th className="px-3 py-2 text-left font-medium">Item</th>
                  <th className="px-3 py-2 text-left font-medium">Categorie</th>
                  <th className="px-3 py-2 text-right font-medium">Voorraad</th>
                  <th className="px-3 py-2 text-right font-medium">Min.</th>
                  {currentRole === "owner" && <th className="px-3 py-2 text-right font-medium">Kostprijs</th>}
                  {currentRole === "owner" && <th className="px-3 py-2 text-right font-medium">Waarde</th>}
                  <th className="px-3 py-2 text-left font-medium">Leverancier</th>
                  <th className="px-3 py-2 text-center font-medium">Acties</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={currentRole === "owner" ? 8 : 6} className="p-8 text-center text-muted-foreground">Geen items gevonden</td></tr>}
                {filtered.map(item => {
                  const isLow = item.current_stock <= item.minimum_stock && item.minimum_stock > 0;
                  return (
                    <tr key={item.id} className={clsx("border-b hover:bg-neutral-50", isLow && "bg-red-50")}>
                      <td className="px-3 py-2">
                        <div className="font-medium">{item.item_name}</div>
                        {item.sku && <div className="text-[10px] text-muted-foreground">{item.sku}</div>}
                      </td>
                      <td className="px-3 py-2"><Badge variant="outline" className="text-[10px] capitalize">{item.category}</Badge></td>
                      <td className={clsx("px-3 py-2 text-right font-medium", isLow && "text-red-600")}>{item.current_stock} {item.unit_type}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{item.minimum_stock}</td>
                      {currentRole === "owner" && <td className="px-3 py-2 text-right">{euro(item.cost_per_unit)}/{item.unit_type}</td>}
                      {currentRole === "owner" && <td className="px-3 py-2 text-right font-medium">{euro(item.current_stock * item.cost_per_unit)}</td>}
                      <td className="px-3 py-2 text-muted-foreground">{item.supplier || "—"}</td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => startEdit(item)}><Search className="h-3 w-3" /></Button>
                          {currentRole === "owner" && <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteItem(item.id)}><Trash2 className="h-3 w-3" /></Button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── RECIPE BUILDER VIEW ─────────────────────────────────────────────────────

export function RecipeBuilderView({ products, onToast, addLog, locationId }: any) {
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [addingLine, setAddingLine] = useState(false);
  const [newLine, setNewLine] = useState({ inventory_item_id: "", quantity: "0", unit: "gram", is_optional: false, waste_factor_pct: "0" });

  useEffect(() => {
    async function load() {
      let invQ = supabase.from("inventory_items").select("*").order("item_name");
      let recQ = supabase.from("product_recipes").select("*, inventory_items(item_name, unit_type, cost_per_unit)").order("product_name");
      if (locationId) { invQ = invQ.eq("location_id", locationId); recQ = recQ.eq("location_id", locationId); }
      const [invRes, recRes] = await Promise.all([invQ, recQ]);
      if (invRes.data) setInventoryItems(invRes.data);
      if (recRes.data) setRecipes(recRes.data);
      setLoading(false);
    }
    load();
  }, [locationId]);

  const productRecipes = useMemo(() => recipes.filter(r => r.product_id === selectedProduct), [recipes, selectedProduct]);

  const recipeCost = useMemo(() => {
    return productRecipes.reduce((sum, r) => {
      const inv = inventoryItems.find(i => i.id === r.inventory_item_id);
      if (!inv) return sum;
      const wasteMult = 1 + (r.waste_factor_pct || 0) / 100;
      return sum + r.quantity * inv.cost_per_unit * wasteMult;
    }, 0);
  }, [productRecipes, inventoryItems]);

  const selProduct = products.find((p: any) => p.id === selectedProduct);

  async function addRecipeLine() {
    if (!selectedProduct || !newLine.inventory_item_id) return;
    const prod = products.find((p: any) => p.id === selectedProduct);
    await supabase.from("product_recipes").insert({
      product_id: selectedProduct,
      product_name: prod?.name || selectedProduct,
      inventory_item_id: newLine.inventory_item_id,
      quantity: parseFloat(newLine.quantity) || 0,
      unit: newLine.unit,
      is_optional: newLine.is_optional,
      waste_factor_pct: parseFloat(newLine.waste_factor_pct) || 0,
      ...(locationId ? { location_id: locationId } : {}),
    });
    onToast?.("Recept ingredient toegevoegd");
    addLog?.("recipe_updated", `Ingredient toegevoegd aan ${prod?.name}`);
    setAddingLine(false);
    setNewLine({ inventory_item_id: "", quantity: "0", unit: "gram", is_optional: false, waste_factor_pct: "0" });
    // Reload recipes
    let recQ = supabase.from("product_recipes").select("*, inventory_items(item_name, unit_type, cost_per_unit)").order("product_name");
    if (locationId) recQ = recQ.eq("location_id", locationId);
    const { data } = await recQ;
    if (data) setRecipes(data);
  }

  async function removeRecipeLine(id: string) {
    await supabase.from("product_recipes").delete().eq("id", id);
    setRecipes(prev => prev.filter(r => r.id !== id));
    onToast?.("Ingredient verwijderd");
  }

  if (loading) return <div className="py-20 text-center text-muted-foreground">Laden...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Recipe Builder</h2>
          <p className="text-sm text-muted-foreground">Koppel producten aan voorraad ingrediënten (BOM)</p>
        </div>
        <Badge variant="outline">{recipes.length} koppelingen</Badge>
      </div>

      {/* Product selector */}
      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <Label className="text-xs">Selecteer product</Label>
          <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm bg-white mt-1">
            <option value="">— Kies een product —</option>
            {products.map((p: any) => {
              const hasRecipe = recipes.some(r => r.product_id === p.id);
              return <option key={p.id} value={p.id}>{p.name} {hasRecipe ? "✓" : ""}</option>;
            })}
          </select>
        </CardContent>
      </Card>

      {/* Recipe details */}
      {selectedProduct && (
        <Card className="rounded-2xl">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{selProduct?.name}</CardTitle>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Verkoopprijs: {euro(selProduct?.price || 0)} · Kostprijs: {euro(recipeCost)} · Marge: {selProduct?.price ? ((1 - recipeCost / selProduct.price) * 100).toFixed(1) : 0}%
                </div>
              </div>
              <Button size="sm" onClick={() => setAddingLine(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Ingredient</Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {productRecipes.length === 0 && !addingLine && (
              <div className="text-sm text-muted-foreground text-center py-6">Geen ingrediënten gekoppeld. Voeg er een toe.</div>
            )}
            <div className="space-y-2">
              {productRecipes.map(r => {
                const inv = inventoryItems.find(i => i.id === r.inventory_item_id);
                const lineCost = inv ? r.quantity * inv.cost_per_unit * (1 + (r.waste_factor_pct || 0) / 100) : 0;
                return (
                  <div key={r.id} className="flex items-center justify-between rounded-xl border p-3 bg-neutral-50">
                    <div>
                      <div className="font-medium text-sm">{inv?.item_name || "Onbekend"}</div>
                      <div className="text-xs text-muted-foreground">{r.quantity} {r.unit} · {euro(lineCost)} {r.is_optional && "· Optioneel"} {r.waste_factor_pct > 0 && `· +${r.waste_factor_pct}% waste`}</div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => removeRecipeLine(r.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                );
              })}
              {addingLine && (
                <div className="rounded-xl border p-3 bg-blue-50 space-y-2">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    <div className="col-span-2">
                      <Label className="text-xs">Ingredient</Label>
                      <select value={newLine.inventory_item_id} onChange={e => {
                        const inv = inventoryItems.find(i => i.id === e.target.value);
                        setNewLine(p => ({ ...p, inventory_item_id: e.target.value, unit: inv?.unit_type || "gram" }));
                      }} className="w-full rounded-md border px-3 py-2 text-sm bg-white">
                        <option value="">— Kies —</option>
                        {inventoryItems.map(i => <option key={i.id} value={i.id}>{i.item_name} ({i.unit_type})</option>)}
                      </select>
                    </div>
                    <div><Label className="text-xs">Hoeveelheid</Label><Input type="number" step="0.1" value={newLine.quantity} onChange={e => setNewLine(p => ({ ...p, quantity: e.target.value }))} /></div>
                    <div><Label className="text-xs">Eenheid</Label><Input value={newLine.unit} onChange={e => setNewLine(p => ({ ...p, unit: e.target.value }))} /></div>
                    <div><Label className="text-xs">Waste %</Label><Input type="number" value={newLine.waste_factor_pct} onChange={e => setNewLine(p => ({ ...p, waste_factor_pct: e.target.value }))} /></div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={addRecipeLine} disabled={!newLine.inventory_item_id}><Check className="h-3.5 w-3.5 mr-1" /> Toevoegen</Button>
                    <Button size="sm" variant="outline" onClick={() => setAddingLine(false)}>Annuleren</Button>
                  </div>
                </div>
              )}
            </div>
            {productRecipes.length > 0 && (
              <div className="mt-3 pt-3 border-t flex justify-between items-center">
                <span className="text-sm font-medium">Totale kostprijs</span>
                <span className="text-lg font-bold">{euro(recipeCost)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Overview: products with/without recipes */}
      <Card className="rounded-2xl">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Recept overzicht</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {products.map((p: any) => {
              const pRecipes = recipes.filter(r => r.product_id === p.id);
              const cost = pRecipes.reduce((s, r) => {
                const inv = inventoryItems.find(i => i.id === r.inventory_item_id);
                return s + (inv ? r.quantity * inv.cost_per_unit * (1 + (r.waste_factor_pct || 0) / 100) : 0);
              }, 0);
              const margin = p.price > 0 ? ((1 - cost / p.price) * 100) : 0;
              return (
                <button key={p.id} onClick={() => setSelectedProduct(p.id)}
                  className={clsx("rounded-xl border p-3 text-left text-xs transition",
                    selectedProduct === p.id ? "border-primary bg-primary/5" : "hover:bg-neutral-50",
                    pRecipes.length === 0 && "border-dashed opacity-60")}>
                  <div className="font-medium truncate">{p.name}</div>
                  {pRecipes.length > 0 ? (
                    <div className="text-muted-foreground mt-0.5">{pRecipes.length} ing. · {euro(cost)} · {margin.toFixed(0)}%</div>
                  ) : (
                    <div className="text-orange-500 mt-0.5">Geen recept</div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── STOCK INTAKE VIEW ───────────────────────────────────────────────────────

export function StockIntakeView({ onToast, addLog, employeeName, locationId }: any) {
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [intakes, setIntakes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    inventory_item_id: "", supplier: "", quantity: "", unit: "pieces",
    purchase_price: "", invoice_reference: "", location: "main",
  });

  useEffect(() => {
    async function load() {
      let invQ = supabase.from("inventory_items").select("*").order("item_name");
      let intQ = supabase.from("stock_intakes").select("*, inventory_items(item_name, unit_type)").order("created_at", { ascending: false }).limit(100);
      if (locationId) { invQ = invQ.eq("location_id", locationId); intQ = intQ.eq("location_id", locationId); }
      const [invRes, intRes] = await Promise.all([invQ, intQ]);
      if (invRes.data) setInventoryItems(invRes.data);
      if (intRes.data) setIntakes(intRes.data);
      setLoading(false);
    }
    load();
  }, [locationId]);

  async function submitIntake() {
    if (!form.inventory_item_id || !form.quantity) return;
    const qty = parseFloat(form.quantity) || 0;
    const price = parseFloat(form.purchase_price) || 0;

    // Insert intake record
    await supabase.from("stock_intakes").insert({
      inventory_item_id: form.inventory_item_id,
      supplier: form.supplier || null,
      quantity: qty,
      unit: form.unit,
      purchase_price: price,
      invoice_reference: form.invoice_reference || null,
      location: form.location,
      employee_name: employeeName || null,
      ...(locationId ? { location_id: locationId } : {}),
    });

    // Update inventory stock + cost
    const item = inventoryItems.find(i => i.id === form.inventory_item_id);
    if (item) {
      const newStock = item.current_stock + qty;
      const updates: any = { current_stock: newStock, last_delivery_date: new Date().toISOString().split("T")[0] };
      // Update cost_per_unit if price provided
      if (price > 0 && qty > 0) updates.cost_per_unit = price / qty;
      await supabase.from("inventory_items").update(updates).eq("id", item.id);
    }

    // Log movement
    await supabase.from("stock_movements").insert({
      inventory_item_id: form.inventory_item_id,
      movement_type: "stock_intake" as any,
      quantity: qty,
      source: "delivery",
      employee_name: employeeName,
      notes: form.invoice_reference ? `Factuur: ${form.invoice_reference}` : null,
      ...(locationId ? { location_id: locationId } : {}),
    });

    onToast?.(`${qty} ${form.unit} ontvangen`);
    addLog?.("stock_intake", `Levering: ${qty} ${form.unit} van ${form.supplier || "onbekend"}`);
    setForm({ inventory_item_id: "", supplier: "", quantity: "", unit: "pieces", purchase_price: "", invoice_reference: "", location: "main" });

    // Reload
    let invQ2 = supabase.from("inventory_items").select("*").order("item_name");
    let intQ2 = supabase.from("stock_intakes").select("*, inventory_items(item_name, unit_type)").order("created_at", { ascending: false }).limit(100);
    if (locationId) { invQ2 = invQ2.eq("location_id", locationId); intQ2 = intQ2.eq("location_id", locationId); }
    const [invRes, intRes] = await Promise.all([invQ2, intQ2]);
    if (invRes.data) setInventoryItems(invRes.data);
    if (intRes.data) setIntakes(intRes.data);
  }

  if (loading) return <div className="py-20 text-center text-muted-foreground">Laden...</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2"><Truck className="h-5 w-5" /> Stock Intake / Leveringen</h2>

      {/* Intake form */}
      <Card className="rounded-2xl">
        <CardContent className="p-4 space-y-3">
          <div className="font-semibold text-sm">Nieuwe levering registreren</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Item *</Label>
              <select value={form.inventory_item_id} onChange={e => {
                const inv = inventoryItems.find(i => i.id === e.target.value);
                setForm(p => ({ ...p, inventory_item_id: e.target.value, unit: inv?.unit_type || "pieces" }));
              }} className="w-full rounded-md border px-3 py-2 text-sm bg-white">
                <option value="">— Kies item —</option>
                {inventoryItems.map(i => <option key={i.id} value={i.id}>{i.item_name} ({i.unit_type})</option>)}
              </select>
            </div>
            <div><Label className="text-xs">Hoeveelheid *</Label><Input type="number" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} /></div>
            <div><Label className="text-xs">Eenheid</Label><Input value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} /></div>
            <div><Label className="text-xs">Leverancier</Label><Input value={form.supplier} onChange={e => setForm(p => ({ ...p, supplier: e.target.value }))} /></div>
            <div><Label className="text-xs">Inkoopprijs (€ totaal)</Label><Input type="number" step="0.01" value={form.purchase_price} onChange={e => setForm(p => ({ ...p, purchase_price: e.target.value }))} /></div>
            <div><Label className="text-xs">Factuurreferentie</Label><Input value={form.invoice_reference} onChange={e => setForm(p => ({ ...p, invoice_reference: e.target.value }))} /></div>
            <div><Label className="text-xs">Locatie</Label><Input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} /></div>
          </div>
          <Button onClick={submitIntake} disabled={!form.inventory_item_id || !form.quantity}>
            <ArrowDown className="h-4 w-4 mr-1" /> Levering registreren
          </Button>
        </CardContent>
      </Card>

      {/* History */}
      <Card className="rounded-2xl overflow-hidden">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Leveringshistorie</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[50vh]">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium">Datum</th>
                <th className="px-3 py-2 text-left font-medium">Item</th>
                <th className="px-3 py-2 text-right font-medium">Hoeveelheid</th>
                <th className="px-3 py-2 text-right font-medium">Prijs</th>
                <th className="px-3 py-2 text-left font-medium">Leverancier</th>
                <th className="px-3 py-2 text-left font-medium">Factuur</th>
                <th className="px-3 py-2 text-left font-medium">Door</th>
              </tr></thead>
              <tbody>
                {intakes.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nog geen leveringen</td></tr>}
                {intakes.map(i => (
                  <tr key={i.id} className="border-b hover:bg-neutral-50">
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(i.created_at).toLocaleDateString("nl-NL")}</td>
                    <td className="px-3 py-2 font-medium">{(i as any).inventory_items?.item_name || "—"}</td>
                    <td className="px-3 py-2 text-right text-green-600 font-medium">+{i.quantity} {i.unit}</td>
                    <td className="px-3 py-2 text-right">{i.purchase_price > 0 ? euro(i.purchase_price) : "—"}</td>
                    <td className="px-3 py-2">{i.supplier || "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{i.invoice_reference || "—"}</td>
                    <td className="px-3 py-2">{i.employee_name || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── MONTHLY COUNT VIEW ──────────────────────────────────────────────────────

export function MonthlyCountView({ onToast, addLog, employeeName, locationId }: any) {
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    async function load() {
      let invQ = supabase.from("inventory_items").select("*").order("category, item_name");
      let histQ = supabase.from("stock_counts").select("*").order("created_at", { ascending: false }).limit(200);
      if (locationId) { invQ = invQ.eq("location_id", locationId); histQ = histQ.eq("location_id", locationId); }
      const [invRes, histRes] = await Promise.all([invQ, histQ]);
      if (invRes.data) setInventoryItems(invRes.data);
      if (histRes.data) setHistory(histRes.data);
      setLoading(false);
    }
    load();
  }, [locationId]);

  async function submitCount() {
    setSaving(true);
    const sessionId = `count-${Date.now()}`;
    const entries: any[] = [];
    const movements: any[] = [];

    for (const item of inventoryItems) {
      const physical = parseFloat(counts[item.id] || "");
      if (isNaN(physical)) continue;
      const diff = physical - item.current_stock;
      const diffPct = item.current_stock > 0 ? (diff / item.current_stock) * 100 : 0;

      entries.push({
        count_session_id: sessionId,
        inventory_item_id: item.id,
        system_stock: item.current_stock,
        physical_count: physical,
        difference: diff,
        difference_pct: Math.round(diffPct * 100) / 100,
        adjustment_reason: reasons[item.id] || null,
        counted_by: employeeName,
        ...(locationId ? { location_id: locationId } : {}),
      });

      if (diff !== 0) {
        movements.push({
          inventory_item_id: item.id,
          movement_type: "count_adjustment" as any,
          quantity: diff,
          source: "monthly_count",
          employee_name: employeeName,
          notes: reasons[item.id] || `Telling verschil: ${diff}`,
          ...(locationId ? { location_id: locationId } : {}),
        });
      }

      // Update inventory
      await supabase.from("inventory_items").update({
        current_stock: physical,
        last_count_date: new Date().toISOString().split("T")[0],
      }).eq("id", item.id);
    }

    if (entries.length > 0) await supabase.from("stock_counts").insert(entries);
    if (movements.length > 0) await supabase.from("stock_movements").insert(movements);

    onToast?.(`Telling opgeslagen: ${entries.length} items geteld`);
    addLog?.("stock_count", `Maandelijkse telling: ${entries.length} items`);
    setCounts({});
    setReasons({});
    setSaving(false);

    // Reload
    let invQ = supabase.from("inventory_items").select("*").order("category, item_name");
    let histQ = supabase.from("stock_counts").select("*").order("created_at", { ascending: false }).limit(200);
    if (locationId) { invQ = invQ.eq("location_id", locationId); histQ = histQ.eq("location_id", locationId); }
    const [invRes, histRes] = await Promise.all([invQ, histQ]);
    if (invRes.data) setInventoryItems(invRes.data);
    if (histRes.data) setHistory(histRes.data);
  }

  if (loading) return <div className="py-20 text-center text-muted-foreground">Laden...</div>;

  const countedCount = Object.keys(counts).filter(k => counts[k] !== "").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><ClipboardCheck className="h-5 w-5" /> Maandelijkse Telling</h2>
          <p className="text-sm text-muted-foreground">Tel alle items fysiek en vergelijk met het systeem</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}>
            {showHistory ? "Telling" : "Historie"}
          </Button>
          {!showHistory && (
            <Button onClick={submitCount} disabled={saving || countedCount === 0}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
              Opslaan ({countedCount})
            </Button>
          )}
        </div>
      </div>

      {showHistory ? (
        <Card className="rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-auto max-h-[70vh]">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium">Datum</th>
                  <th className="px-3 py-2 text-left font-medium">Sessie</th>
                  <th className="px-3 py-2 text-right font-medium">Systeem</th>
                  <th className="px-3 py-2 text-right font-medium">Geteld</th>
                  <th className="px-3 py-2 text-right font-medium">Verschil</th>
                  <th className="px-3 py-2 text-right font-medium">%</th>
                  <th className="px-3 py-2 text-left font-medium">Door</th>
                </tr></thead>
                <tbody>
                  {history.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nog geen tellingen</td></tr>}
                  {history.map(h => (
                    <tr key={h.id} className="border-b hover:bg-neutral-50">
                      <td className="px-3 py-2 whitespace-nowrap">{new Date(h.created_at).toLocaleDateString("nl-NL")}</td>
                      <td className="px-3 py-2 font-mono text-[10px]">{h.count_session_id?.slice(0, 16)}</td>
                      <td className="px-3 py-2 text-right">{h.system_stock}</td>
                      <td className="px-3 py-2 text-right font-medium">{h.physical_count}</td>
                      <td className={clsx("px-3 py-2 text-right font-medium", h.difference < 0 ? "text-red-600" : h.difference > 0 ? "text-green-600" : "")}>{h.difference >= 0 ? "+" : ""}{h.difference}</td>
                      <td className={clsx("px-3 py-2 text-right", Math.abs(h.difference_pct) > 10 ? "text-red-600" : "")}>{h.difference_pct}%</td>
                      <td className="px-3 py-2">{h.counted_by || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-auto max-h-[70vh]">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50 sticky top-0">
                  <th className="px-3 py-2 text-left font-medium">Item</th>
                  <th className="px-3 py-2 text-left font-medium">Cat.</th>
                  <th className="px-3 py-2 text-right font-medium">Systeem</th>
                  <th className="px-3 py-2 text-center font-medium w-28">Fysiek geteld</th>
                  <th className="px-3 py-2 text-right font-medium">Verschil</th>
                  <th className="px-3 py-2 text-left font-medium">Reden</th>
                </tr></thead>
                <tbody>
                  {inventoryItems.map(item => {
                    const physical = parseFloat(counts[item.id] || "");
                    const diff = isNaN(physical) ? null : physical - item.current_stock;
                    return (
                      <tr key={item.id} className={clsx("border-b", diff !== null && diff !== 0 && "bg-amber-50")}>
                        <td className="px-3 py-2 font-medium">{item.item_name}</td>
                        <td className="px-3 py-2"><Badge variant="outline" className="text-[10px] capitalize">{item.category}</Badge></td>
                        <td className="px-3 py-2 text-right">{item.current_stock} {item.unit_type}</td>
                        <td className="px-3 py-2">
                          <Input type="number" className="h-8 text-sm text-center" placeholder="—"
                            value={counts[item.id] || ""}
                            onChange={e => setCounts(p => ({ ...p, [item.id]: e.target.value }))} />
                        </td>
                        <td className={clsx("px-3 py-2 text-right font-medium",
                          diff === null ? "" : diff < 0 ? "text-red-600" : diff > 0 ? "text-green-600" : "text-muted-foreground")}>
                          {diff !== null ? `${diff >= 0 ? "+" : ""}${diff}` : "—"}
                        </td>
                        <td className="px-3 py-2">
                          {diff !== null && diff !== 0 && (
                            <Input className="h-8 text-xs" placeholder="Reden..."
                              value={reasons[item.id] || ""}
                              onChange={e => setReasons(p => ({ ...p, [item.id]: e.target.value }))} />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── COSTING & MARGINS VIEW (Owner only) ─────────────────────────────────────

export function CostingView({ products, orders, onToast, locationId }: any) {
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [marginTargets, setMarginTargets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<string>("margin_desc");
  const [simulating, setSimulating] = useState<string | null>(null);
  const [simPrice, setSimPrice] = useState("");

  useEffect(() => {
    async function load() {
      let invQ = supabase.from("inventory_items").select("*");
      let recQ = supabase.from("product_recipes").select("*, inventory_items(item_name, unit_type, cost_per_unit)");
      let mtQ = supabase.from("margin_targets").select("*");
      if (locationId) { invQ = invQ.eq("location_id", locationId); recQ = recQ.eq("location_id", locationId); mtQ = mtQ.eq("location_id", locationId); }
      const [invRes, recRes, mtRes] = await Promise.all([invQ, recQ, mtQ]);
      if (invRes.data) setInventoryItems(invRes.data);
      if (recRes.data) setRecipes(recRes.data);
      if (mtRes.data) setMarginTargets(mtRes.data);
      setLoading(false);
    }
    load();
  }, [locationId]);

  const productData = useMemo(() => {
    return products.map((p: any) => {
      const pRecipes = recipes.filter(r => r.product_id === p.id);
      const cost = pRecipes.reduce((s, r) => {
        const inv = r.inventory_items || inventoryItems.find(i => i.id === r.inventory_item_id);
        if (!inv) return s;
        return s + r.quantity * (inv.cost_per_unit || 0) * (1 + (r.waste_factor_pct || 0) / 100);
      }, 0);
      const profit = p.price - cost;
      const margin = p.price > 0 ? (profit / p.price) * 100 : 0;
      const salesCount = orders.filter((o: any) => o.items?.some((i: any) => i.productId === p.id)).length;
      const totalRevenue = orders.reduce((s: number, o: any) => {
        const items = o.items?.filter((i: any) => i.productId === p.id) || [];
        return s + items.reduce((is: number, i: any) => is + (i.price || 0) * (i.qty || 1), 0);
      }, 0);

      // Determine category for target
      const cat = p.tags?.[0] || "Drinks";
      const target = marginTargets.find(t => t.category === cat);
      const belowTarget = target ? margin < target.target_margin_pct : false;

      // Menu engineering quadrant
      const avgSales = orders.length > 0 ? salesCount / Math.max(1, new Set(orders.map((o: any) => o.date?.toDateString?.())).size) : 0;
      let quadrant = "review";
      if (avgSales > 1 && margin > 70) quadrant = "star";
      else if (avgSales > 1 && margin <= 70) quadrant = "volume";
      else if (avgSales <= 1 && margin > 70) quadrant = "hidden";

      return { ...p, cost, profit, margin, salesCount, totalRevenue, belowTarget, quadrant, hasRecipe: pRecipes.length > 0 };
    });
  }, [products, recipes, inventoryItems, orders, marginTargets]);

  const sorted = useMemo(() => {
    const d = [...productData];
    switch (sortBy) {
      case "margin_desc": return d.sort((a, b) => b.margin - a.margin);
      case "margin_asc": return d.sort((a, b) => a.margin - b.margin);
      case "profit_desc": return d.sort((a, b) => b.profit - a.profit);
      case "sales_desc": return d.sort((a, b) => b.salesCount - a.salesCount);
      default: return d;
    }
  }, [productData, sortBy]);

  const avgMargin = productData.length > 0 ? productData.reduce((s, p) => s + p.margin, 0) / productData.length : 0;
  const bestMargin = productData.reduce((best, p) => p.margin > (best?.margin || 0) ? p : best, productData[0]);
  const worstMargin = productData.reduce((worst, p) => p.margin < (worst?.margin || 100) ? p : worst, productData[0]);
  const todayProfit = orders.filter((o: any) => o.date && o.date.toDateString() === new Date().toDateString())
    .reduce((s: number, o: any) => {
      return s + (o.items || []).reduce((is: number, item: any) => {
        const pd = productData.find(p => p.id === item.productId);
        return is + (pd ? pd.profit * (item.qty || 1) : 0);
      }, 0);
    }, 0);

  if (loading) return <div className="py-20 text-center text-muted-foreground">Laden...</div>;

  return (
    <div className="space-y-4">
      {/* KPI widgets */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Gem. marge</div>
            <div className="text-2xl font-bold">{avgMargin.toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-green-200">
          <CardContent className="p-4">
            <div className="text-xs text-green-600">Beste marge</div>
            <div className="text-lg font-bold truncate">{bestMargin?.name}</div>
            <div className="text-xs text-green-600">{bestMargin?.margin.toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-red-200">
          <CardContent className="p-4">
            <div className="text-xs text-red-600">Slechtste marge</div>
            <div className="text-lg font-bold truncate">{worstMargin?.name}</div>
            <div className="text-xs text-red-600">{worstMargin?.margin.toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Brutowinst vandaag</div>
            <div className="text-2xl font-bold">{euro(todayProfit)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Menu Engineering Matrix */}
      <Card className="rounded-2xl">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Menu Engineering Matrix</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "star", label: "⭐ Stars", desc: "Hoge verkoop + hoge marge", color: "bg-green-50 border-green-200" },
              { key: "volume", label: "📦 Volume Drivers", desc: "Hoge verkoop + lage marge", color: "bg-blue-50 border-blue-200" },
              { key: "hidden", label: "💎 Hidden Gems", desc: "Lage verkoop + hoge marge", color: "bg-purple-50 border-purple-200" },
              { key: "review", label: "🔍 Review", desc: "Lage verkoop + lage marge", color: "bg-red-50 border-red-200" },
            ].map(q => {
              const items = productData.filter(p => p.quadrant === q.key && p.hasRecipe);
              return (
                <div key={q.key} className={clsx("rounded-xl border p-3", q.color)}>
                  <div className="font-semibold text-sm">{q.label}</div>
                  <div className="text-xs text-muted-foreground mb-2">{q.desc}</div>
                  <div className="space-y-1">
                    {items.length === 0 && <div className="text-xs text-muted-foreground italic">Geen producten</div>}
                    {items.slice(0, 5).map(p => (
                      <div key={p.id} className="text-xs flex justify-between">
                        <span className="truncate">{p.name}</span>
                        <span className="font-medium">{p.margin.toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Profitability table */}
      <Card className="rounded-2xl overflow-hidden">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Product Winstgevendheid</CardTitle>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="rounded-md border px-2 py-1 text-xs bg-white">
              <option value="margin_desc">Hoogste marge</option>
              <option value="margin_asc">Laagste marge</option>
              <option value="profit_desc">Hoogste winst €</option>
              <option value="sales_desc">Best verkocht</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[50vh]">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50 sticky top-0">
                <th className="px-3 py-2 text-left font-medium">Product</th>
                <th className="px-3 py-2 text-right font-medium">Kostprijs</th>
                <th className="px-3 py-2 text-right font-medium">Verkoopprijs</th>
                <th className="px-3 py-2 text-right font-medium">Winst</th>
                <th className="px-3 py-2 text-right font-medium">Marge</th>
                <th className="px-3 py-2 text-right font-medium">Verkocht</th>
                <th className="px-3 py-2 text-center font-medium">Simuleer</th>
              </tr></thead>
              <tbody>
                {sorted.map(p => (
                  <tr key={p.id} className={clsx("border-b hover:bg-neutral-50", p.belowTarget && "bg-red-50")}>
                    <td className="px-3 py-2">
                      <div className="font-medium">{p.name}</div>
                      {!p.hasRecipe && <div className="text-[10px] text-orange-500">Geen recept</div>}
                    </td>
                    <td className="px-3 py-2 text-right">{euro(p.cost)}</td>
                    <td className="px-3 py-2 text-right">{euro(p.price)}</td>
                    <td className="px-3 py-2 text-right font-medium text-green-600">{euro(p.profit)}</td>
                    <td className={clsx("px-3 py-2 text-right font-bold",
                      p.margin >= 80 ? "text-green-600" : p.margin >= 60 ? "text-orange-500" : "text-red-600")}>
                      {p.margin.toFixed(1)}%
                      {p.belowTarget && <AlertTriangle className="inline h-3 w-3 ml-1 text-red-500" />}
                    </td>
                    <td className="px-3 py-2 text-right">{p.salesCount}×</td>
                    <td className="px-3 py-2 text-center">
                      {simulating === p.id ? (
                        <div className="flex items-center gap-1">
                          <Input type="number" className="h-7 w-20 text-xs" value={simPrice}
                            onChange={e => setSimPrice(e.target.value)} placeholder={String(p.price)} />
                          <div className="text-[10px]">
                            {simPrice && parseFloat(simPrice) > 0 ? (
                              <span className={parseFloat(simPrice) > p.price ? "text-green-600" : "text-red-600"}>
                                {(((parseFloat(simPrice) - p.cost) / parseFloat(simPrice)) * 100).toFixed(1)}%
                              </span>
                            ) : "—"}
                          </div>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setSimulating(null); setSimPrice(""); }}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setSimulating(p.id); setSimPrice(String(p.price)); }}>
                          Simuleer
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Margin targets */}
      <Card className="rounded-2xl">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Marge doelen</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-3 gap-3">
            {marginTargets.map(t => (
              <div key={t.id} className="rounded-xl border p-3 text-center">
                <div className="text-xs text-muted-foreground">{t.category}</div>
                <div className="text-2xl font-bold">{t.target_margin_pct}%</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── AI FORECAST VIEW ────────────────────────────────────────────────────────

export function AIForecastView({ onToast }: any) {
  const [forecast, setForecast] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [type, setType] = useState("forecast");

  async function runForecast() {
    setLoading(true);
    setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("inventory-forecast", {
        body: { type },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setForecast(data?.data || data);
      onToast?.("AI analyse compleet");
    } catch (e: any) {
      setError(e.message || "Fout bij AI analyse");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><Brain className="h-5 w-5" /> AI Forecast & Insights</h2>
          <p className="text-sm text-muted-foreground">Gemini AI analyseert je voorraad, verkoop en trends</p>
        </div>
        <div className="flex gap-2">
          <select value={type} onChange={e => setType(e.target.value)} className="rounded-md border px-2 py-1.5 text-sm bg-white">
            <option value="forecast">Voorraad forecast</option>
            <option value="pricing">Prijsadvies</option>
          </select>
          <Button onClick={runForecast} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
            Analyseer
          </Button>
        </div>
      </div>

      {error && (
        <Card className="rounded-2xl border-red-200 bg-red-50">
          <CardContent className="p-4 text-red-800 text-sm">{error}</CardContent>
        </Card>
      )}

      {!forecast && !loading && !error && (
        <Card className="rounded-2xl">
          <CardContent className="p-12 text-center">
            <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <div className="text-lg font-semibold mb-2">AI Voorraad Intelligentie</div>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
              Klik op "Analyseer" om een AI-analyse te starten van je voorraad, verkooppatronen, en aanbevelingen te ontvangen.
            </p>
            <Button onClick={runForecast} disabled={loading}>
              <Sparkles className="h-4 w-4 mr-1" /> Start analyse
            </Button>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card className="rounded-2xl">
          <CardContent className="p-12 text-center">
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary mb-4" />
            <div className="text-lg font-semibold">AI analyseert...</div>
            <p className="text-sm text-muted-foreground">Dit kan 10-20 seconden duren</p>
          </CardContent>
        </Card>
      )}

      {forecast && !loading && (
        <div className="space-y-4">
          {/* Summary */}
          {forecast.summary && (
            <Card className="rounded-2xl bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
              <CardContent className="p-4">
                <div className="font-semibold text-sm mb-1 flex items-center gap-1.5"><Brain className="h-4 w-4" /> Samenvatting</div>
                <p className="text-sm">{forecast.summary}</p>
              </CardContent>
            </Card>
          )}

          {/* Alerts */}
          {forecast.alerts?.length > 0 && (
            <Card className="rounded-2xl">
              <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> Waarschuwingen</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                {forecast.alerts.map((a: any, i: number) => (
                  <div key={i} className={clsx("rounded-xl border p-3 text-sm",
                    a.severity === "high" ? "bg-red-50 border-red-200" : a.severity === "medium" ? "bg-orange-50 border-orange-200" : "bg-blue-50 border-blue-200")}>
                    <div className="font-medium capitalize">{a.type?.replace(/_/g, " ")}</div>
                    <div className="text-muted-foreground">{a.message}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Predictions */}
          {forecast.predictions?.length > 0 && (
            <Card className="rounded-2xl overflow-hidden">
              <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Voorspellingen</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium">Item</th>
                      <th className="px-3 py-2 text-right font-medium">Dagen over</th>
                      <th className="px-3 py-2 text-right font-medium">Maand forecast</th>
                      <th className="px-3 py-2 text-left font-medium">Herbestel datum</th>
                      <th className="px-3 py-2 text-right font-medium">Advies qty</th>
                      <th className="px-3 py-2 text-center font-medium">Vertrouwen</th>
                    </tr></thead>
                    <tbody>
                      {forecast.predictions.map((p: any, i: number) => (
                        <tr key={i} className="border-b hover:bg-neutral-50">
                          <td className="px-3 py-2 font-medium">{p.item}</td>
                          <td className={clsx("px-3 py-2 text-right font-bold", p.days_left < 7 ? "text-red-600" : p.days_left < 14 ? "text-orange-500" : "text-green-600")}>{p.days_left}</td>
                          <td className="px-3 py-2 text-right">{p.monthly_forecast}</td>
                          <td className="px-3 py-2">{p.reorder_date || "—"}</td>
                          <td className="px-3 py-2 text-right font-medium">{p.suggested_quantity}</td>
                          <td className="px-3 py-2 text-center">
                            <Badge variant={p.confidence === "high" ? "default" : "outline"} className="text-[10px]">{p.confidence}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {forecast.recommendations?.length > 0 && (
            <Card className="rounded-2xl">
              <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-1.5"><Sparkles className="h-4 w-4" /> Aanbevelingen</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                {forecast.recommendations.map((r: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                    <span>{r}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Pricing recommendations */}
          {forecast.pricing_recommendations?.length > 0 && (
            <Card className="rounded-2xl overflow-hidden">
              <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Prijsadvies</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium">Product</th>
                      <th className="px-3 py-2 text-right font-medium">Huidige marge</th>
                      <th className="px-3 py-2 text-right font-medium">Adviesprijs</th>
                      <th className="px-3 py-2 text-left font-medium">Reden</th>
                    </tr></thead>
                    <tbody>
                      {forecast.pricing_recommendations.map((p: any, i: number) => (
                        <tr key={i} className="border-b hover:bg-neutral-50">
                          <td className="px-3 py-2 font-medium">{p.product}</td>
                          <td className="px-3 py-2 text-right">{p.current_margin}%</td>
                          <td className="px-3 py-2 text-right font-bold">{euro(p.suggested_price)}</td>
                          <td className="px-3 py-2 text-muted-foreground">{p.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Raw response fallback */}
          {forecast.raw && (
            <Card className="rounded-2xl">
              <CardContent className="p-4">
                <div className="font-semibold text-sm mb-2">AI Antwoord</div>
                <div className="text-sm whitespace-pre-wrap">{forecast.raw}</div>
              </CardContent>
            </Card>
          )}

          {/* Trends */}
          {forecast.trends && (
            <Card className="rounded-2xl">
              <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Trends</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="grid grid-cols-3 gap-3">
                  {forecast.trends.busiest_day && (
                    <div className="rounded-xl border p-3 text-center">
                      <div className="text-xs text-muted-foreground">Drukste dag</div>
                      <div className="text-lg font-bold">{forecast.trends.busiest_day}</div>
                    </div>
                  )}
                  {forecast.trends.avg_daily_sales !== undefined && (
                    <div className="rounded-xl border p-3 text-center">
                      <div className="text-xs text-muted-foreground">Gem. dag omzet</div>
                      <div className="text-lg font-bold">{euro(forecast.trends.avg_daily_sales)}</div>
                    </div>
                  )}
                  {forecast.trends.growth_pct !== undefined && (
                    <div className="rounded-xl border p-3 text-center">
                      <div className="text-xs text-muted-foreground">Groei</div>
                      <div className={clsx("text-lg font-bold", forecast.trends.growth_pct >= 0 ? "text-green-600" : "text-red-600")}>
                        {forecast.trends.growth_pct >= 0 ? "+" : ""}{forecast.trends.growth_pct}%
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ─── STOCK DEDUCTION ENGINE (called on order complete) ───────────────────────

export async function deductStockForOrder(orderItems: any[], employeeName?: string, orderId?: string) {
  try {
    // Fetch recipes for all products in the order
    const productIds = [...new Set(orderItems.map(i => i.productId))];
    const { data: recipes } = await supabase.from("product_recipes").select("*, inventory_items(id, current_stock)").in("product_id", productIds);
    if (!recipes || recipes.length === 0) return;

    for (const orderItem of orderItems) {
      const itemRecipes = recipes.filter(r => r.product_id === orderItem.productId);
      for (const recipe of itemRecipes) {
        const deductQty = recipe.quantity * orderItem.qty * (1 + (recipe.waste_factor_pct || 0) / 100);
        const invItem = recipe.inventory_items;
        if (!invItem) continue;

        // Update stock
        const newStock = Math.max(0, (invItem.current_stock || 0) - deductQty);
        await supabase.from("inventory_items").update({ current_stock: newStock }).eq("id", recipe.inventory_item_id);

        // Log movement
        await supabase.from("stock_movements").insert({
          inventory_item_id: recipe.inventory_item_id,
          movement_type: "sale_deduction" as any,
          quantity: -deductQty,
          product_sold: orderItem.name,
          source: "pos",
          employee_name: employeeName || null,
          order_id: orderId || null,
        });
      }
    }
  } catch (err) {
    console.error("Stock deduction error:", err);
  }
}

// ─── STOCK RESTORE ENGINE (called on refund) ────────────────────────────────

export async function restoreStockForRefund(orderItems: any[], employeeName?: string, orderId?: string) {
  try {
    const productIds = [...new Set(orderItems.map(i => i.productId))];
    const { data: recipes } = await supabase.from("product_recipes").select("*, inventory_items(id, current_stock)").in("product_id", productIds);
    if (!recipes || recipes.length === 0) return;

    for (const orderItem of orderItems) {
      const itemRecipes = recipes.filter(r => r.product_id === orderItem.productId);
      for (const recipe of itemRecipes) {
        const restoreQty = recipe.quantity * orderItem.qty * (1 + (recipe.waste_factor_pct || 0) / 100);
        const invItem = recipe.inventory_items;
        if (!invItem) continue;

        const newStock = (invItem.current_stock || 0) + restoreQty;
        await supabase.from("inventory_items").update({ current_stock: newStock }).eq("id", recipe.inventory_item_id);

        await supabase.from("stock_movements").insert({
          inventory_item_id: recipe.inventory_item_id,
          movement_type: "refund_restore" as any,
          quantity: restoreQty,
          product_sold: orderItem.name,
          source: "refund",
          employee_name: employeeName || null,
          order_id: orderId || null,
        });
      }
    }
  } catch (err) {
    console.error("Stock restore error:", err);
  }
}

// ─── DYNAMIC STOCK VIEW ─────────────────────────────────────────────────────

export function DynamicStockView({ onToast, addLog, currentRole, employeeName }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [allInventory, setAllInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [customRefill, setCustomRefill] = useState<Record<string, string>>({});
  const [showCustom, setShowCustom] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiForecast, setAiForecast] = useState<Record<string, any>>({});
  const [form, setForm] = useState({
    item_name: "", category: "ingredient", unit_type: "liter",
    current_stock: "0", minimum_stock: "0", recommended_threshold: "0",
    cost_per_unit: "0", supplier: "", ai_forecast_enabled: true,
  });

  const isOwner = currentRole === "owner";

  async function loadItems() {
    setLoading(true);
    const [dynRes, allRes] = await Promise.all([
      supabase.from("inventory_items").select("*").eq("is_dynamic", true).order("item_name"),
      supabase.from("inventory_items").select("id, item_name, unit_type").order("item_name"),
    ]);
    setItems(dynRes.data || []);
    setAllInventory(allRes.data || []);
    setLoading(false);
  }

  useEffect(() => { loadItems(); }, []);

  async function createDynamicItem() {
    if (!form.item_name.trim()) return;
    const { error } = await supabase.from("inventory_items").insert({
      item_name: form.item_name,
      category: form.category as any,
      unit_type: form.unit_type,
      current_stock: parseFloat(form.current_stock) || 0,
      minimum_stock: parseFloat(form.minimum_stock) || 0,
      recommended_threshold: parseFloat(form.recommended_threshold) || 0,
      cost_per_unit: parseFloat(form.cost_per_unit) || 0,
      supplier: form.supplier || null,
      ai_forecast_enabled: form.ai_forecast_enabled,
      is_dynamic: true,
    });
    if (error) { onToast?.("Fout bij aanmaken: " + error.message); return; }
    onToast?.(`${form.item_name} aangemaakt als dynamic stock`);
    addLog?.("dynamic_stock_created", `Dynamic stock item aangemaakt: ${form.item_name}`);
    setShowAdd(false);
    setForm({ item_name: "", category: "ingredient", unit_type: "liter", current_stock: "0", minimum_stock: "0", recommended_threshold: "0", cost_per_unit: "0", supplier: "", ai_forecast_enabled: true });
    loadItems();
  }

  async function quickRefill(item: any, amount: number) {
    const newStock = (item.current_stock || 0) + amount;
    await supabase.from("inventory_items").update({ current_stock: newStock }).eq("id", item.id);
    await supabase.from("stock_movements").insert({
      inventory_item_id: item.id,
      movement_type: "stock_intake" as any,
      quantity: amount,
      source: "dynamic_refill",
      employee_name: employeeName || null,
      notes: `Quick refill +${amount} ${item.unit_type}`,
    });
    addLog?.("dynamic_refill", `${item.item_name} bijgevuld: +${amount} ${item.unit_type}`);
    onToast?.(`${item.item_name} +${amount} ${item.unit_type}`);
    loadItems();
  }

  async function fetchAIForecast(item: any) {
    setAiLoading(item.id);
    try {
      const { data: movements } = await supabase
        .from("stock_movements")
        .select("*")
        .eq("inventory_item_id", item.id)
        .order("created_at", { ascending: false })
        .limit(200);

      const { data: intakes } = await supabase
        .from("stock_intakes")
        .select("*")
        .eq("inventory_item_id", item.id)
        .order("created_at", { ascending: false })
        .limit(50);

      const response = await supabase.functions.invoke("inventory-forecast", {
        body: { type: "dynamic_item", itemId: item.id, itemName: item.item_name, movements, intakes, currentStock: item.current_stock, unitType: item.unit_type },
      });

      if (response.data?.data) {
        setAiForecast(prev => ({ ...prev, [item.id]: response.data.data }));
      }
    } catch (e) {
      console.error("AI forecast error:", e);
      onToast?.("AI forecast fout");
    }
    setAiLoading(null);
  }

  async function toggleDynamic(item: any) {
    await supabase.from("inventory_items").update({ is_dynamic: false }).eq("id", item.id);
    addLog?.("dynamic_stock_removed", `${item.item_name} verwijderd als dynamic stock`);
    onToast?.(`${item.item_name} is niet meer dynamic`);
    loadItems();
  }

  // Compute stats
  const criticalItems = items.filter(i => i.current_stock <= i.minimum_stock && i.minimum_stock > 0);
  const lowItems = items.filter(i => i.current_stock > i.minimum_stock && i.current_stock <= i.recommended_threshold && i.recommended_threshold > 0);

  if (loading) return <div className="py-20 text-center text-muted-foreground">Laden...</div>;

  return (
    <div className="space-y-4">
      {/* KPI widgets */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><RefreshCw className="h-3 w-3" /> Actieve items</div>
            <div className="text-2xl font-bold">{items.length}</div>
          </CardContent>
        </Card>
        <Card className={clsx("rounded-2xl", criticalItems.length > 0 && "border-red-300")}>
          <CardContent className="p-4">
            <div className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Kritiek</div>
            <div className="text-2xl font-bold text-red-600">{criticalItems.length}</div>
          </CardContent>
        </Card>
        <Card className={clsx("rounded-2xl", lowItems.length > 0 && "border-amber-300")}>
          <CardContent className="p-4">
            <div className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Lage voorraad</div>
            <div className="text-2xl font-bold text-amber-600">{lowItems.length}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><Brain className="h-3 w-3" /> AI Forecast</div>
            <div className="text-2xl font-bold">{items.filter(i => i.ai_forecast_enabled).length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {criticalItems.length > 0 && (
        <Card className="rounded-2xl border-red-300 bg-red-50">
          <CardContent className="p-4">
            <div className="font-semibold text-red-800 text-sm mb-2 flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> Kritieke voorraad!</div>
            <div className="flex flex-wrap gap-2">
              {criticalItems.map(i => (
                <Badge key={i.id} variant="destructive" className="text-xs">{i.item_name}: {i.current_stock} {i.unit_type}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add button */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{items.length} dynamic stock items</div>
        <Button onClick={() => setShowAdd(true)} className="rounded-xl">
          <Plus className="h-4 w-4 mr-1" /> Dynamic Stock Item
        </Button>
      </div>

      {/* Creation modal */}
      {showAdd && (
        <Card className="rounded-2xl border-2 border-primary/20">
          <CardContent className="p-4 space-y-3">
            <div className="font-semibold text-sm">Nieuw Dynamic Stock Item</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><Label className="text-xs">Naam *</Label><Input value={form.item_name} onChange={e => setForm(p => ({ ...p, item_name: e.target.value }))} placeholder="bijv. Volle Melk" /></div>
              <div><Label className="text-xs">Categorie</Label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="w-full rounded-md border px-3 py-2 text-sm bg-white">
                  {["ingredient", "packaging", "pastry", "retail", "cleaning", "misc"].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><Label className="text-xs">Eenheid</Label>
                <select value={form.unit_type} onChange={e => setForm(p => ({ ...p, unit_type: e.target.value }))} className="w-full rounded-md border px-3 py-2 text-sm bg-white">
                  {["liter", "ml", "pieces", "gram", "kg", "units"].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div><Label className="text-xs">Huidige voorraad</Label><Input type="number" step="0.1" value={form.current_stock} onChange={e => setForm(p => ({ ...p, current_stock: e.target.value }))} /></div>
              <div><Label className="text-xs">Minimum threshold</Label><Input type="number" step="0.1" value={form.minimum_stock} onChange={e => setForm(p => ({ ...p, minimum_stock: e.target.value }))} /></div>
              <div><Label className="text-xs">Aanbevolen threshold</Label><Input type="number" step="0.1" value={form.recommended_threshold} onChange={e => setForm(p => ({ ...p, recommended_threshold: e.target.value }))} /></div>
              {isOwner && <div><Label className="text-xs">Kostprijs / eenheid (€)</Label><Input type="number" step="0.001" value={form.cost_per_unit} onChange={e => setForm(p => ({ ...p, cost_per_unit: e.target.value }))} /></div>}
              <div><Label className="text-xs">Leverancier</Label><Input value={form.supplier} onChange={e => setForm(p => ({ ...p, supplier: e.target.value }))} /></div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.ai_forecast_enabled} onChange={e => setForm(p => ({ ...p, ai_forecast_enabled: e.target.checked }))} className="rounded" />
                <Brain className="h-4 w-4 text-muted-foreground" /> AI Forecast inschakelen
              </label>
            </div>
            <div className="flex gap-2">
              <Button onClick={createDynamicItem} disabled={!form.item_name.trim()}><Check className="h-4 w-4 mr-1" /> Aanmaken</Button>
              <Button variant="outline" onClick={() => setShowAdd(false)}>Annuleren</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dynamic stock cards */}
      {items.length === 0 && !showAdd && (
        <Card className="rounded-2xl">
          <CardContent className="p-12 text-center text-muted-foreground">
            <RefreshCw className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <div className="font-medium mb-1">Geen dynamic stock items</div>
            <div className="text-sm">Voeg rolling perishable items toe zoals melk, croissants, of sappen.</div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map(item => {
          const isCritical = item.current_stock <= item.minimum_stock && item.minimum_stock > 0;
          const isLow = !isCritical && item.current_stock <= item.recommended_threshold && item.recommended_threshold > 0;
          const forecast = aiForecast[item.id];
          const daysLeft = item.avg_monthly_usage > 0 ? Math.round((item.current_stock / (item.avg_monthly_usage / 30)) * 10) / 10 : null;

          return (
            <Card key={item.id} className={clsx(
              "rounded-2xl transition-all",
              isCritical && "border-red-400 bg-red-50/50 shadow-red-100 shadow-lg animate-pulse",
              isLow && "border-amber-300 bg-amber-50/30",
            )}>
              <CardContent className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm flex items-center gap-2">
                      {item.item_name}
                      {isCritical && <Badge variant="destructive" className="text-[10px]">KRITIEK</Badge>}
                      {isLow && <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-300">LAAG</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] capitalize">{item.category}</Badge>
                      {item.supplier && <span>· {item.supplier}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={clsx("text-2xl font-black", isCritical && "text-red-600", isLow && "text-amber-600")}>
                      {item.current_stock}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{item.unit_type}</div>
                  </div>
                </div>

                {/* Stock bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Min: {item.minimum_stock}</span>
                    <span>Aanbevolen: {item.recommended_threshold || "—"}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={clsx("h-full rounded-full transition-all", isCritical ? "bg-red-500" : isLow ? "bg-amber-400" : "bg-green-500")}
                      style={{ width: `${Math.min(100, item.recommended_threshold > 0 ? (item.current_stock / item.recommended_threshold) * 100 : item.minimum_stock > 0 ? (item.current_stock / (item.minimum_stock * 3)) * 100 : 50)}%` }}
                    />
                  </div>
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-muted/50 rounded-lg p-1.5">
                    <div className="text-[10px] text-muted-foreground">Gem. /dag</div>
                    <div className="text-xs font-bold">{item.avg_monthly_usage > 0 ? (item.avg_monthly_usage / 30).toFixed(1) : "—"}</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-1.5">
                    <div className="text-[10px] text-muted-foreground">Dagen over</div>
                    <div className={clsx("text-xs font-bold", daysLeft !== null && daysLeft < 2 && "text-red-600")}>{daysLeft !== null ? daysLeft : "—"}</div>
                  </div>
                  {isOwner && (
                    <div className="bg-muted/50 rounded-lg p-1.5">
                      <div className="text-[10px] text-muted-foreground">Waarde</div>
                      <div className="text-xs font-bold">{euro(item.current_stock * item.cost_per_unit)}</div>
                    </div>
                  )}
                  {!isOwner && (
                    <div className="bg-muted/50 rounded-lg p-1.5">
                      <div className="text-[10px] text-muted-foreground">Verspilling</div>
                      <div className="text-xs font-bold">{item.waste_percentage}%</div>
                    </div>
                  )}
                </div>

                {/* Quick refill buttons */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Quick Refill</div>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 5, 10].map(n => (
                      <Button key={n} variant="outline" size="sm" className="h-8 px-3 text-xs rounded-xl font-bold hover:bg-green-50 hover:border-green-300 hover:text-green-700"
                        onClick={() => quickRefill(item, n)}>
                        +{n}
                      </Button>
                    ))}
                    {showCustom === item.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number" step="0.1" min="0.1"
                          value={customRefill[item.id] || ""}
                          onChange={e => setCustomRefill(p => ({ ...p, [item.id]: e.target.value }))}
                          placeholder="qty"
                          className="h-8 w-20 text-xs"
                          autoFocus
                        />
                        <Button size="sm" className="h-8 px-2 text-xs rounded-xl"
                          onClick={() => {
                            const val = parseFloat(customRefill[item.id] || "0");
                            if (val > 0) quickRefill(item, val);
                            setShowCustom(null);
                            setCustomRefill(p => ({ ...p, [item.id]: "" }));
                          }}>
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setShowCustom(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" className="h-8 px-3 text-xs rounded-xl"
                        onClick={() => setShowCustom(item.id)}>
                        Anders
                      </Button>
                    )}
                  </div>
                </div>

                {/* AI Forecast */}
                {item.ai_forecast_enabled && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Brain className="h-3 w-3" /> AI Forecast
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => fetchAIForecast(item)} disabled={aiLoading === item.id}>
                        {aiLoading === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        {aiLoading === item.id ? " Analyseren..." : " Analyseer"}
                      </Button>
                    </div>
                    {forecast && (
                      <div className="bg-primary/5 rounded-xl p-3 text-xs space-y-1.5 border border-primary/10">
                        {forecast.recommendation && <div className="font-medium text-foreground">{forecast.recommendation}</div>}
                        {forecast.predicted_usage && <div className="text-muted-foreground">Verwacht gebruik morgen: <span className="font-bold text-foreground">{forecast.predicted_usage} {item.unit_type}</span></div>}
                        {forecast.suggested_stock && <div className="text-muted-foreground">Aanbevolen voorraad: <span className="font-bold text-foreground">{forecast.suggested_stock} {item.unit_type}</span></div>}
                        {forecast.trend && <div className="text-muted-foreground">Trend: {forecast.trend}</div>}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-1 pt-1 border-t">
                  {(isOwner || currentRole === "manager") && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => toggleDynamic(item)}>
                      <X className="h-3 w-3 mr-1" /> Verwijder dynamic
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── WASTE & SPOILAGE LOGGING VIEW ──────────────────────────────────────────

const WASTE_REASONS = [
  { value: "expired", label: "Over datum / Expired" },
  { value: "damaged", label: "Beschadigd / Damaged" },
  { value: "spilled", label: "Gemorst / Spilled" },
  { value: "overproduction", label: "Overproductie" },
  { value: "returned", label: "Retour / Returned" },
  { value: "broken", label: "Kapot / Broken" },
  { value: "complaint_remake", label: "Klacht / Remake" },
  { value: "dropped_spilled", label: "Gevallen" },
  { value: "prep_mistake", label: "Bereidingsfout" },
  { value: "end_of_day", label: "Einde dag weggooi" },
  { value: "unknown_shrinkage", label: "Onbekend verlies" },
  { value: "staff_meal", label: "Personeelsmaaltijd" },
  { value: "manual_correction", label: "Handmatige correctie" },
  { value: "other", label: "Anders" },
];

export function WasteLoggingView({ onToast, addLog, currentRole, employeeName }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    inventory_item_id: "", quantity: "", waste_reason: "expired", notes: "",
  });
  const [search, setSearch] = useState("");
  const [periodFilter, setPeriodFilter] = useState<"today" | "week" | "month">("today");
  const isOwner = currentRole === "owner";

  const loadData = useCallback(async () => {
    const [itemsRes, movesRes] = await Promise.all([
      supabase.from("inventory_items").select("*").order("item_name"),
      supabase.from("stock_movements").select("*").eq("movement_type", "waste").order("created_at", { ascending: false }).limit(500),
    ]);
    if (itemsRes.data) setItems(itemsRes.data);
    if (movesRes.data) setMovements(movesRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Period filtering
  const now = new Date();
  const periodStart = useMemo(() => {
    const d = new Date();
    if (periodFilter === "today") { d.setHours(0, 0, 0, 0); }
    else if (periodFilter === "week") { d.setDate(d.getDate() - 7); }
    else { d.setDate(d.getDate() - 30); }
    return d;
  }, [periodFilter]);

  const filteredMovements = useMemo(() =>
    movements.filter(m => new Date(m.created_at) >= periodStart), [movements, periodStart]);

  const todayMovements = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return movements.filter(m => new Date(m.created_at) >= start);
  }, [movements]);

  // Analytics
  const totalWasteQty = filteredMovements.reduce((s, m) => s + Number(m.quantity), 0);
  const wasteByItem = useMemo(() => {
    const map: Record<string, { qty: number; cost: number; name: string }> = {};
    filteredMovements.forEach(m => {
      const item = items.find(i => i.id === m.inventory_item_id);
      const name = item?.item_name || "Onbekend";
      if (!map[m.inventory_item_id]) map[m.inventory_item_id] = { qty: 0, cost: 0, name };
      map[m.inventory_item_id].qty += Number(m.quantity);
      map[m.inventory_item_id].cost += Number(m.quantity) * (item?.cost_per_unit || 0);
    });
    return Object.values(map).sort((a, b) => b.cost - a.cost);
  }, [filteredMovements, items]);

  const totalWasteCost = wasteByItem.reduce((s, w) => s + w.cost, 0);

  const wasteByReason = useMemo(() => {
    const map: Record<string, number> = {};
    filteredMovements.forEach(m => {
      const reason = (m as any).waste_reason || "unknown";
      map[reason] = (map[reason] || 0) + Number(m.quantity);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredMovements]);

  // Smart alerts
  const alerts = useMemo(() => {
    const result: string[] = [];
    const threeDaysAgo = new Date(); threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const recentByItem: Record<string, number> = {};
    movements.filter(m => new Date(m.created_at) >= threeDaysAgo).forEach(m => {
      const dates = new Set<string>();
      movements.filter(m2 => m2.inventory_item_id === m.inventory_item_id && new Date(m2.created_at) >= threeDaysAgo)
        .forEach(m2 => dates.add(new Date(m2.created_at).toDateString()));
      recentByItem[m.inventory_item_id] = dates.size;
    });
    Object.entries(recentByItem).forEach(([id, days]) => {
      if (days >= 3) {
        const item = items.find(i => i.id === id);
        if (item) result.push(`${item.item_name}: ${days} dagen op rij verspilling geregistreerd`);
      }
    });
    return result;
  }, [movements, items]);

  async function submitWaste() {
    if (!form.inventory_item_id || !form.quantity || parseFloat(form.quantity) <= 0) {
      onToast?.("Vul alle velden in"); return;
    }
    const qty = parseFloat(form.quantity);
    const item = items.find(i => i.id === form.inventory_item_id);
    if (!item) return;

    // Insert waste movement
    await supabase.from("stock_movements").insert({
      inventory_item_id: form.inventory_item_id,
      movement_type: "waste" as any,
      quantity: qty,
      waste_reason: form.waste_reason,
      notes: form.notes || null,
      employee_name: employeeName,
      source: "waste_log",
    });

    // Deduct from stock
    await supabase.from("inventory_items").update({
      current_stock: Math.max(0, item.current_stock - qty),
    }).eq("id", item.id);

    addLog?.("waste_logged", `Verspilling: ${qty} ${item.unit_type} ${item.item_name} (${form.waste_reason})`);
    onToast?.(`${qty} ${item.unit_type} ${item.item_name} als verspilling geregistreerd`);
    setForm({ inventory_item_id: "", quantity: "", waste_reason: "expired", notes: "" });
    setShowModal(false);
    loadData();
  }

  const selectedItem = items.find(i => i.id === form.inventory_item_id);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Verspilling vandaag</div>
            <div className="text-2xl font-bold text-destructive">{todayMovements.reduce((s, m) => s + Number(m.quantity), 0)}</div>
            <div className="text-xs text-muted-foreground">items</div>
          </CardContent>
        </Card>
        {isOwner && (
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Kosten ({periodFilter})</div>
              <div className="text-2xl font-bold text-destructive">{euro(totalWasteCost)}</div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Items ({periodFilter})</div>
            <div className="text-2xl font-bold">{totalWasteQty}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Registraties ({periodFilter})</div>
            <div className="text-2xl font-bold">{filteredMovements.length}</div>
          </CardContent>
        </Card>
        {isOwner && (
          <Card className="border-amber-300/30 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Waste %</div>
              <div className="text-2xl font-bold text-amber-600">
                {(() => {
                  const totalStockValue = items.reduce((s, i) => s + i.current_stock * i.cost_per_unit, 0);
                  const pct = totalStockValue > 0 ? ((totalWasteCost / (totalStockValue + totalWasteCost)) * 100) : 0;
                  return `${pct.toFixed(1)}%`;
                })()}
              </div>
              <div className="text-xs text-muted-foreground">van voorraadwaarde</div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Smart Alerts */}
      {alerts.length > 0 && (
        <Card className="border-orange-300 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-orange-700 dark:text-orange-400">
              <AlertTriangle className="h-4 w-4" /> Slimme waarschuwingen
            </div>
            {alerts.map((a, i) => (
              <div key={i} className="text-xs text-orange-600 dark:text-orange-300 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" /> {a}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Action Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {(["today", "week", "month"] as const).map(p => (
            <Button key={p} variant={periodFilter === p ? "default" : "outline"} size="sm" className="rounded-xl text-xs"
              onClick={() => setPeriodFilter(p)}>
              {p === "today" ? "Vandaag" : p === "week" ? "Week" : "Maand"}
            </Button>
          ))}
        </div>
        <Button className="rounded-xl gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground" onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4" /> Waste registreren
        </Button>
      </div>

      {/* Waste Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowModal(false)}>
          <Card className="w-full max-w-md" onClick={e => e.stopPropagation()}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2"><Trash2 className="h-5 w-5 text-destructive" /> Waste registreren</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Item selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Voorraad item *</Label>
                <Input placeholder="Zoek item..." value={search} onChange={e => setSearch(e.target.value)} className="rounded-xl" />
                {search && !form.inventory_item_id && (
                  <ScrollArea className="max-h-40 border rounded-xl">
                    {items.filter(i => i.item_name.toLowerCase().includes(search.toLowerCase())).slice(0, 8).map(i => (
                      <button key={i.id} className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between"
                        onClick={() => { setForm(f => ({ ...f, inventory_item_id: i.id })); setSearch(i.item_name); }}>
                        <span>{i.item_name}</span>
                        <span className="text-xs text-muted-foreground">{i.current_stock} {i.unit_type}</span>
                      </button>
                    ))}
                  </ScrollArea>
                )}
                {selectedItem && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Package className="h-3 w-3" /> Huidige voorraad: {selectedItem.current_stock} {selectedItem.unit_type}
                    <button className="ml-auto text-destructive" onClick={() => { setForm(f => ({ ...f, inventory_item_id: "" })); setSearch(""); }}>
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Quantity */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Hoeveelheid * {selectedItem && `(${selectedItem.unit_type})`}</Label>
                <div className="flex items-center gap-2">
                  {[1, 2, 5, 10].map(n => (
                    <Button key={n} variant="outline" size="sm" className="rounded-xl flex-1 h-10 text-base font-bold"
                      onClick={() => setForm(f => ({ ...f, quantity: String(n) }))}>
                      {n}
                    </Button>
                  ))}
                </div>
                <Input type="number" placeholder="Of voer handmatig in..." value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} className="rounded-xl text-center text-lg font-bold" />
              </div>

              {/* Reason */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Reden *</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {WASTE_REASONS.map(r => (
                    <button key={r.value}
                      className={clsx(
                        "px-3 py-2 rounded-xl text-xs text-left border transition-colors",
                        form.waste_reason === r.value
                          ? "border-destructive bg-destructive/10 text-destructive font-medium"
                          : "border-border hover:bg-muted"
                      )}
                      onClick={() => setForm(f => ({ ...f, waste_reason: r.value }))}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Notitie (optioneel)</Label>
                <Input placeholder="Bijv. gevallen in keuken..." value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="rounded-xl" />
              </div>

              {/* Employee */}
              <div className="text-xs text-muted-foreground">Medewerker: <span className="font-medium text-foreground">{employeeName}</span></div>

              {/* Submit */}
              <Button className="w-full rounded-xl h-12 text-base gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground" onClick={submitWaste}
                disabled={!form.inventory_item_id || !form.quantity}>
                <Trash2 className="h-4 w-4" /> Registreer verspilling
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 7-Day Waste Trend */}
      {isOwner && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Waste trend (7 dagen)</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const days: { label: string; cost: number; qty: number }[] = [];
              for (let i = 6; i >= 0; i--) {
                const d = new Date(); d.setDate(d.getDate() - i);
                const ds = d.toDateString();
                const dayMoves = movements.filter(m => new Date(m.created_at).toDateString() === ds);
                const cost = dayMoves.reduce((s, m) => {
                  const item = items.find(it => it.id === m.inventory_item_id);
                  return s + Number(m.quantity) * (item?.cost_per_unit || 0);
                }, 0);
                days.push({ label: d.toLocaleDateString("nl-NL", { weekday: "short" }), cost, qty: dayMoves.reduce((s, m) => s + Number(m.quantity), 0) });
              }
              const maxCost = Math.max(...days.map(d => d.cost), 1);
              return (
                <div className="flex items-end gap-1 h-32">
                  {days.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="text-[10px] text-muted-foreground font-mono">{euro(d.cost)}</div>
                      <div className="w-full bg-destructive/20 rounded-t-lg relative" style={{ height: `${Math.max((d.cost / maxCost) * 80, 4)}px` }}>
                        <div className="absolute inset-0 bg-destructive/60 rounded-t-lg" />
                      </div>
                      <div className="text-[10px] text-muted-foreground">{d.label}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Wasted Items */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Top verspilde items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {wasteByItem.length === 0 && <div className="text-xs text-muted-foreground py-4 text-center">Nog geen data</div>}
            {wasteByItem.slice(0, 8).map((w, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="truncate">{w.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground text-xs">{w.qty} stuks</span>
                  {isOwner && <span className="font-mono text-destructive font-medium text-xs">{euro(w.cost)}</span>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Waste by Reason */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><ClipboardCheck className="h-4 w-4" /> Verspilling per reden</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {wasteByReason.length === 0 && <div className="text-xs text-muted-foreground py-4 text-center">Nog geen data</div>}
            {wasteByReason.map(([reason, qty], i) => {
              const label = WASTE_REASONS.find(r => r.value === reason)?.label || reason;
              return (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="truncate">{label}</span>
                  <Badge variant="secondary" className="text-xs">{qty}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Recent Waste Log */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Recente registraties</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              {filteredMovements.length === 0 && <div className="text-xs text-muted-foreground py-4 text-center">Geen verspilling geregistreerd in deze periode</div>}
              {filteredMovements.slice(0, 30).map(m => {
                const item = items.find(i => i.id === m.inventory_item_id);
                const reasonLabel = WASTE_REASONS.find(r => r.value === (m as any).waste_reason)?.label || (m as any).waste_reason || "-";
                const time = new Date(m.created_at);
                return (
                  <div key={m.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item?.item_name || "Onbekend"}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>{reasonLabel}</span>
                        {m.notes && <span>• {m.notes}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <div className="text-sm font-bold text-destructive">-{m.quantity} {item?.unit_type || ""}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {time.toLocaleDateString("nl-NL")} {time.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
                        {m.employee_name && ` • ${m.employee_name}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
