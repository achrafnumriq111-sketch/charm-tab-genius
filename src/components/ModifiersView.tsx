import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ModifierGroup, ModifierOption } from "@/hooks/useModifiers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Plus, Trash2, Edit, ChevronDown, ChevronRight, GripVertical,
  Package, X, Check, Search, Save,
} from "lucide-react";

function euro(value: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(value);
}

// ─── GROUP FORM ──────────────────────────────────────────────────────────────

function GroupForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: ModifierGroup;
  onSave: (data: any) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name || "",
    description: initial?.description || "",
    is_required: initial?.is_required ?? false,
    min_select: initial?.min_select ?? 0,
    max_select: initial?.max_select ?? 1,
    display_order: initial?.display_order ?? 0,
    is_active: initial?.is_active ?? true,
  });

  return (
    <div className="p-5 space-y-4 bg-white rounded-2xl border">
      <h3 className="font-bold text-sm">{initial ? "Edit Group" : "New Modifier Group"}</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Group name</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Milk Choice" className="mt-1" />
        </div>
        <div className="col-span-2">
          <Label>Description</Label>
          <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" className="mt-1" />
        </div>
        <div>
          <Label>Min select</Label>
          <Input type="number" min={0} value={form.min_select} onChange={(e) => setForm({ ...form, min_select: parseInt(e.target.value) || 0 })} className="mt-1" />
        </div>
        <div>
          <Label>Max select</Label>
          <Input type="number" min={1} value={form.max_select} onChange={(e) => setForm({ ...form, max_select: parseInt(e.target.value) || 1 })} className="mt-1" />
        </div>
        <div>
          <Label>Display order</Label>
          <Input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })} className="mt-1" />
        </div>
        <div className="flex items-center gap-3 pt-5">
          <Switch checked={form.is_required} onCheckedChange={(v) => setForm({ ...form, is_required: v })} />
          <Label>Required</Label>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
          <Label>Active</Label>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(form)} disabled={!form.name.trim()}>
          <Save className="h-4 w-4 mr-1" /> Save
        </Button>
      </div>
    </div>
  );
}

// ─── MODIFIER FORM ───────────────────────────────────────────────────────────

function ModifierForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: ModifierOption;
  onSave: (data: any) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name || "",
    extra_price: initial?.extra_price ?? 0,
    cost_price: initial?.cost_price ?? 0,
    stock_sensitive: initial?.stock_sensitive ?? false,
    is_default: initial?.is_default ?? false,
    display_order: initial?.display_order ?? 0,
    is_active: initial?.is_active ?? true,
  });

  return (
    <div className="p-4 space-y-3 bg-neutral-50 rounded-xl border">
      <h4 className="font-semibold text-sm">{initial ? "Edit Modifier" : "Add Modifier"}</h4>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-3">
          <Label>Name</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Oat Milk" className="mt-1" />
        </div>
        <div>
          <Label>Extra price (€)</Label>
          <Input type="number" step="0.01" value={form.extra_price} onChange={(e) => setForm({ ...form, extra_price: parseFloat(e.target.value) || 0 })} className="mt-1" />
        </div>
        <div>
          <Label>Cost price (€)</Label>
          <Input type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: parseFloat(e.target.value) || 0 })} className="mt-1" />
        </div>
        <div>
          <Label>Sort order</Label>
          <Input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })} className="mt-1" />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={form.is_default} onCheckedChange={(v) => setForm({ ...form, is_default: v })} />
          <Label className="text-xs">Default</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={form.stock_sensitive} onCheckedChange={(v) => setForm({ ...form, stock_sensitive: v })} />
          <Label className="text-xs">Stock linked</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
          <Label className="text-xs">Active</Label>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={() => onSave(form)} disabled={!form.name.trim()}>Save</Button>
      </div>
    </div>
  );
}

// ─── PRODUCT ASSIGNMENT ──────────────────────────────────────────────────────

function ProductAssignment({
  group,
  products,
  links,
  onToggle,
}: {
  group: ModifierGroup;
  products: any[];
  links: { product_id: string; modifier_group_id: string }[];
  onToggle: (productId: string, groupId: string, linked: boolean) => void;
}) {
  const [search, setSearch] = useState("");
  const assignedIds = links.filter((l) => l.modifier_group_id === group.id).map((l) => l.product_id);
  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 bg-neutral-50 rounded-xl border space-y-3">
      <h4 className="font-semibold text-sm flex items-center gap-2">
        <Package className="h-4 w-4" /> Assign to products
        <Badge variant="secondary" className="text-[10px]">{assignedIds.length} linked</Badge>
      </h4>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="pl-8 h-8 text-sm" />
      </div>
      <div className="max-h-48 overflow-auto space-y-1">
        {filtered.map((product) => {
          const linked = assignedIds.includes(product.id);
          return (
            <button
              key={product.id}
              onClick={() => onToggle(product.id, group.id, linked)}
              className={`w-full text-left px-3 py-1.5 rounded-lg text-sm flex items-center justify-between transition-all ${
                linked ? "bg-black text-white" : "bg-white hover:bg-neutral-100 border"
              }`}
            >
              <span>{product.name}</span>
              {linked && <Check className="h-3.5 w-3.5" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── MAIN VIEW ───────────────────────────────────────────────────────────────

export default function ModifiersView({
  groups,
  links,
  products,
  onRefetch,
  onToast,
  addLog,
  locationId,
}: {
  groups: ModifierGroup[];
  links: any[];
  products: any[];
  onRefetch: () => void;
  onToast: (msg: string) => void;
  addLog?: (action: string, details: string) => void;
  locationId?: string | null;
}) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [addingGroup, setAddingGroup] = useState(false);
  const [addingModifier, setAddingModifier] = useState<string | null>(null);
  const [editingModifier, setEditingModifier] = useState<string | null>(null);
  const [assigningGroup, setAssigningGroup] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = groups.filter((g) => g.name.toLowerCase().includes(search.toLowerCase()));

  async function saveGroup(data: any, existingId?: string) {
    if (existingId) {
      const { error } = await supabase.from("modifier_groups").update(data).eq("id", existingId);
      if (error) { onToast(`Error: ${error.message}`); return; }
      addLog?.("modifier_group_updated", `Modifier groep bijgewerkt: ${data.name}`);
      onToast(`Groep "${data.name}" bijgewerkt`);
    } else {
      // Check duplicate name
      const exists = groups.some((g) => g.name.toLowerCase() === data.name.toLowerCase());
      if (exists) { onToast("Error: groep met deze naam bestaat al"); return; }
      const { error } = await supabase.from("modifier_groups").insert(data);
      if (error) { onToast(`Error: ${error.message}`); return; }
      addLog?.("modifier_group_created", `Modifier groep aangemaakt: ${data.name}`);
      onToast(`Groep "${data.name}" aangemaakt`);
    }
    setEditingGroup(null);
    setAddingGroup(false);
    onRefetch();
  }

  async function deleteGroup(id: string, name: string) {
    if (!confirm(`Modifier groep "${name}" verwijderen? Alle modifiers erin worden ook verwijderd.`)) return;
    const { error } = await supabase.from("modifier_groups").delete().eq("id", id);
    if (error) { onToast(`Error: ${error.message}`); return; }
    addLog?.("modifier_group_deleted", `Modifier groep verwijderd: ${name}`);
    onToast(`Groep "${name}" verwijderd`);
    onRefetch();
  }

  async function saveModifier(groupId: string, data: any, existingId?: string) {
    if (existingId) {
      const { error } = await supabase.from("modifiers").update(data).eq("id", existingId);
      if (error) { onToast(`Error: ${error.message}`); return; }
      addLog?.("modifier_updated", `Modifier bijgewerkt: ${data.name}`);
      onToast(`Modifier "${data.name}" bijgewerkt`);
    } else {
      const group = groups.find((g) => g.id === groupId);
      const exists = group?.modifiers.some((m) => m.name.toLowerCase() === data.name.toLowerCase());
      if (exists) { onToast("Error: modifier met deze naam bestaat al in deze groep"); return; }
      const { error } = await supabase.from("modifiers").insert({ ...data, group_id: groupId });
      if (error) { onToast(`Error: ${error.message}`); return; }
      addLog?.("modifier_created", `Modifier aangemaakt: ${data.name}`);
      onToast(`Modifier "${data.name}" toegevoegd`);
    }
    setAddingModifier(null);
    setEditingModifier(null);
    onRefetch();
  }

  async function deleteModifier(id: string, name: string) {
    if (!confirm(`Modifier "${name}" verwijderen?`)) return;
    const { error } = await supabase.from("modifiers").delete().eq("id", id);
    if (error) { onToast(`Error: ${error.message}`); return; }
    addLog?.("modifier_deleted", `Modifier verwijderd: ${name}`);
    onToast(`Modifier "${name}" verwijderd`);
    onRefetch();
  }

  async function toggleProductLink(productId: string, groupId: string, isLinked: boolean) {
    if (isLinked) {
      await supabase.from("product_modifier_groups").delete().eq("product_id", productId).eq("modifier_group_id", groupId);
    } else {
      await supabase.from("product_modifier_groups").insert({ product_id: productId, modifier_group_id: groupId });
    }
    onRefetch();
  }

  async function toggleModifierActive(mod: ModifierOption) {
    await supabase.from("modifiers").update({ is_active: !mod.is_active }).eq("id", mod.id);
    onRefetch();
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Modifiers & Add-ons</h1>
          <p className="text-sm text-muted-foreground">{groups.length} groepen · {groups.reduce((s, g) => s + (g.modifiers?.length || 0), 0)} opties</p>
        </div>
        <Button onClick={() => setAddingGroup(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Group
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search groups..." className="pl-9" />
      </div>

      {addingGroup && (
        <GroupForm onSave={(data) => saveGroup(data)} onCancel={() => setAddingGroup(false)} />
      )}

      <div className="space-y-3">
        {filtered.sort((a, b) => a.display_order - b.display_order).map((group) => {
          const isExpanded = expandedGroup === group.id;
          const modCount = group.modifiers?.length || 0;
          const activeModCount = group.modifiers?.filter((m) => m.is_active).length || 0;
          const linkedProducts = links.filter((l) => l.modifier_group_id === group.id).length;

          return (
            <Card key={group.id} className="rounded-2xl overflow-hidden">
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-neutral-50 transition"
                onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
              >
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <div>
                    <div className="font-semibold text-sm flex items-center gap-2">
                      {group.name}
                      {!group.is_active && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                      {group.is_required && <Badge variant="destructive" className="text-[10px]">Required</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {activeModCount}/{modCount} opties · {linkedProducts} products · {group.max_select > 1 ? "Multi-select" : "Single"} ({group.min_select}-{group.max_select})
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" onClick={() => setAssigningGroup(assigningGroup === group.id ? null : group.id)}>
                    <Package className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditingGroup(group.id)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-red-500" onClick={() => deleteGroup(group.id, group.name)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {editingGroup === group.id && (
                <div className="px-4 pb-4">
                  <GroupForm initial={group} onSave={(data) => saveGroup(data, group.id)} onCancel={() => setEditingGroup(null)} />
                </div>
              )}

              {assigningGroup === group.id && (
                <div className="px-4 pb-4">
                  <ProductAssignment group={group} products={products} links={links} onToggle={toggleProductLink} />
                </div>
              )}

              {isExpanded && (
                <CardContent className="pt-0 space-y-2">
                  <Separator />
                  {group.modifiers?.sort((a, b) => a.display_order - b.display_order).map((mod) => (
                    editingModifier === mod.id ? (
                      <ModifierForm
                        key={mod.id}
                        initial={mod}
                        onSave={(data) => saveModifier(group.id, data, mod.id)}
                        onCancel={() => setEditingModifier(null)}
                      />
                    ) : (
                      <div key={mod.id} className={`flex items-center justify-between p-3 rounded-xl border transition ${mod.is_active ? "bg-white" : "bg-neutral-100 opacity-60"}`}>
                        <div className="flex items-center gap-3">
                          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30" />
                          <div>
                            <div className="font-medium text-sm flex items-center gap-2">
                              {mod.name}
                              {mod.is_default && <Badge className="text-[9px] h-4">Default</Badge>}
                              {mod.stock_sensitive && <Badge variant="outline" className="text-[9px] h-4">Stock</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {mod.extra_price > 0 ? `+${euro(mod.extra_price)}` : "Included"} · Cost: {euro(mod.cost_price)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Switch checked={mod.is_active} onCheckedChange={() => toggleModifierActive(mod)} />
                          <Button variant="ghost" size="sm" onClick={() => setEditingModifier(mod.id)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => deleteModifier(mod.id, mod.name)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )
                  ))}

                  {addingModifier === group.id ? (
                    <ModifierForm
                      onSave={(data) => saveModifier(group.id, data)}
                      onCancel={() => setAddingModifier(null)}
                    />
                  ) : (
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setAddingModifier(group.id)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Modifier
                    </Button>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && !addingGroup && (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Geen modifier groepen gevonden</p>
          <p className="text-sm">Maak je eerste groep aan om te beginnen.</p>
        </div>
      )}
    </div>
  );
}
