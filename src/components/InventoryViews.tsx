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

export function InventoryView({ onToast, addLog, currentRole }: any) {
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
    const { data } = await supabase.from("inventory_items").select("*").order("item_name");
    if (data) setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  const categories = ["all", "ingredient", "packaging", "pastry", "retail", "cleaning", "misc"];
  const filtered = useMemo(() => items.filter(i =>
    (categoryFilter === "all" || i.category === categoryFilter) &&
    i.item_name.toLowerCase().includes(search.toLowerCase())
  ), [items, search, categoryFilter]);

  const lowStockItems = items.filter(i => i.current_stock <= i.minimum_stock && i.minimum_stock > 0);
  const totalValue = items.reduce((s, i) => s + i.current_stock * i.cost_per_unit, 0);

  async function saveItem() {
    const payload = {
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
                {filtered.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Geen items gevonden</td></tr>}
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

export function RecipeBuilderView({ products, onToast, addLog }: any) {
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [addingLine, setAddingLine] = useState(false);
  const [newLine, setNewLine] = useState({ inventory_item_id: "", quantity: "0", unit: "gram", is_optional: false, waste_factor_pct: "0" });

  useEffect(() => {
    async function load() {
      const [invRes, recRes] = await Promise.all([
        supabase.from("inventory_items").select("*").order("item_name"),
        supabase.from("product_recipes").select("*, inventory_items(item_name, unit_type, cost_per_unit)").order("product_name"),
      ]);
      if (invRes.data) setInventoryItems(invRes.data);
      if (recRes.data) setRecipes(recRes.data);
      setLoading(false);
    }
    load();
  }, []);

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
    });
    onToast?.("Recept ingredient toegevoegd");
    addLog?.("recipe_updated", `Ingredient toegevoegd aan ${prod?.name}`);
    setAddingLine(false);
    setNewLine({ inventory_item_id: "", quantity: "0", unit: "gram", is_optional: false, waste_factor_pct: "0" });
    // Reload recipes
    const { data } = await supabase.from("product_recipes").select("*, inventory_items(item_name, unit_type, cost_per_unit)").order("product_name");
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

export function StockIntakeView({ onToast, addLog, employeeName }: any) {
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [intakes, setIntakes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    inventory_item_id: "", supplier: "", quantity: "", unit: "pieces",
    purchase_price: "", invoice_reference: "", location: "main",
  });

  useEffect(() => {
    async function load() {
      const [invRes, intRes] = await Promise.all([
        supabase.from("inventory_items").select("*").order("item_name"),
        supabase.from("stock_intakes").select("*, inventory_items(item_name, unit_type)").order("created_at", { ascending: false }).limit(100),
      ]);
      if (invRes.data) setInventoryItems(invRes.data);
      if (intRes.data) setIntakes(intRes.data);
      setLoading(false);
    }
    load();
  }, []);

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
    });

    onToast?.(`${qty} ${form.unit} ontvangen`);
    addLog?.("stock_intake", `Levering: ${qty} ${form.unit} van ${form.supplier || "onbekend"}`);
    setForm({ inventory_item_id: "", supplier: "", quantity: "", unit: "pieces", purchase_price: "", invoice_reference: "", location: "main" });

    // Reload
    const [invRes, intRes] = await Promise.all([
      supabase.from("inventory_items").select("*").order("item_name"),
      supabase.from("stock_intakes").select("*, inventory_items(item_name, unit_type)").order("created_at", { ascending: false }).limit(100),
    ]);
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

export function MonthlyCountView({ onToast, addLog, employeeName }: any) {
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    async function load() {
      const [invRes, histRes] = await Promise.all([
        supabase.from("inventory_items").select("*").order("category, item_name"),
        supabase.from("stock_counts").select("*").order("created_at", { ascending: false }).limit(200),
      ]);
      if (invRes.data) setInventoryItems(invRes.data);
      if (histRes.data) setHistory(histRes.data);
      setLoading(false);
    }
    load();
  }, []);

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
      });

      if (diff !== 0) {
        movements.push({
          inventory_item_id: item.id,
          movement_type: "count_adjustment" as any,
          quantity: diff,
          source: "monthly_count",
          employee_name: employeeName,
          notes: reasons[item.id] || `Telling verschil: ${diff}`,
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
    const [invRes, histRes] = await Promise.all([
      supabase.from("inventory_items").select("*").order("category, item_name"),
      supabase.from("stock_counts").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
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

export function CostingView({ products, orders, onToast }: any) {
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [marginTargets, setMarginTargets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<string>("margin_desc");
  const [simulating, setSimulating] = useState<string | null>(null);
  const [simPrice, setSimPrice] = useState("");

  useEffect(() => {
    async function load() {
      const [invRes, recRes, mtRes] = await Promise.all([
        supabase.from("inventory_items").select("*"),
        supabase.from("product_recipes").select("*, inventory_items(item_name, unit_type, cost_per_unit)"),
        supabase.from("margin_targets").select("*"),
      ]);
      if (invRes.data) setInventoryItems(invRes.data);
      if (recRes.data) setRecipes(recRes.data);
      if (mtRes.data) setMarginTargets(mtRes.data);
      setLoading(false);
    }
    load();
  }, []);

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
