import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UpsellRule } from "@/hooks/useUpsell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Trash2, Edit, Save, Sparkles, TrendingUp, Search, X,
} from "lucide-react";

function euro(v: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(v);
}

function RuleForm({
  initial,
  products,
  onSave,
  onCancel,
}: {
  initial?: UpsellRule;
  products: any[];
  onSave: (data: any) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    trigger_product_id: initial?.trigger_product_id || "",
    trigger_category: initial?.trigger_category || "",
    suggested_product_id: initial?.suggested_product_id || "",
    suggestion_type: initial?.suggestion_type || "combo",
    prompt_text_nl: initial?.prompt_text_nl || "",
    priority: initial?.priority ?? 10,
    extra_price_override: initial?.extra_price_override ?? null,
    active_from: initial?.active_from || "",
    active_until: initial?.active_until || "",
    is_active: initial?.is_active ?? true,
  });

  const SECTIONS = ["Signature Drinks", "Specials", "Cold Drinks", "Hot Drinks", "Sweets"];

  return (
    <div className="p-5 space-y-4 bg-card rounded-2xl border">
      <h3 className="font-bold text-sm">{initial ? "Edit Rule" : "New Upsell Rule"}</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Trigger: Product</Label>
          <select
            value={form.trigger_product_id}
            onChange={(e) => setForm({ ...form, trigger_product_id: e.target.value })}
            className="w-full rounded-lg border px-3 py-2 mt-1 bg-card text-sm"
          >
            <option value="">— None (use category) —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Trigger: Category</Label>
          <select
            value={form.trigger_category}
            onChange={(e) => setForm({ ...form, trigger_category: e.target.value })}
            className="w-full rounded-lg border px-3 py-2 mt-1 bg-card text-sm"
          >
            <option value="">— None (use product) —</option>
            {SECTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <Label>Suggested Product *</Label>
          <select
            value={form.suggested_product_id}
            onChange={(e) => setForm({ ...form, suggested_product_id: e.target.value })}
            className="w-full rounded-lg border px-3 py-2 mt-1 bg-card text-sm"
          >
            <option value="">— Select —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({euro(p.price)})</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <Label>Prompt tekst (NL)</Label>
          <Input
            value={form.prompt_text_nl}
            onChange={(e) => setForm({ ...form, prompt_text_nl: e.target.value })}
            placeholder='bijv. "Wil je een croissant erbij voor €2,50?"'
            className="mt-1"
          />
        </div>
        <div>
          <Label>Type</Label>
          <select
            value={form.suggestion_type}
            onChange={(e) => setForm({ ...form, suggestion_type: e.target.value })}
            className="w-full rounded-lg border px-3 py-2 mt-1 bg-card text-sm"
          >
            <option value="combo">Combo</option>
            <option value="upgrade">Upgrade</option>
            <option value="addon">Add-on</option>
          </select>
        </div>
        <div>
          <Label>Priority (lager = hoger)</Label>
          <Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 10 })} className="mt-1" />
        </div>
        <div>
          <Label>Prijs override (€, leeg = productprijs)</Label>
          <Input
            type="number"
            step="0.01"
            value={form.extra_price_override ?? ""}
            onChange={(e) => setForm({ ...form, extra_price_override: e.target.value ? parseFloat(e.target.value) : null })}
            placeholder="Leeg = productprijs"
            className="mt-1"
          />
        </div>
        <div className="flex items-center gap-3 pt-5">
          <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
          <Label>Active</Label>
        </div>
        <div>
          <Label>Actief vanaf (tijd)</Label>
          <Input type="time" value={form.active_from} onChange={(e) => setForm({ ...form, active_from: e.target.value })} className="mt-1" />
        </div>
        <div>
          <Label>Actief tot (tijd)</Label>
          <Input type="time" value={form.active_until} onChange={(e) => setForm({ ...form, active_until: e.target.value })} className="mt-1" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => {
          const data = {
            ...form,
            trigger_product_id: form.trigger_product_id || null,
            trigger_category: form.trigger_category || null,
            active_from: form.active_from || null,
            active_until: form.active_until || null,
          };
          onSave(data);
        }} disabled={!form.suggested_product_id}>
          <Save className="h-4 w-4 mr-1" /> Save
        </Button>
      </div>
    </div>
  );
}

export default function UpsellRulesView({
  rules,
  products,
  onRefetch,
  onToast,
  addLog,
}: {
  rules: UpsellRule[];
  products: any[];
  onRefetch: () => void;
  onToast: (msg: string) => void;
  addLog?: (action: string, details: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = rules.filter((r) => {
    const product = products.find((p) => p.id === r.suggested_product_id);
    const name = product?.name || r.suggested_product_id;
    return name.toLowerCase().includes(search.toLowerCase()) ||
      (r.prompt_text_nl || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.trigger_category || "").toLowerCase().includes(search.toLowerCase());
  });

  async function saveRule(data: any, existingId?: string) {
    if (existingId) {
      const { error } = await supabase.from("upsell_rules").update(data).eq("id", existingId);
      if (error) { onToast(`Error: ${error.message}`); return; }
      addLog?.("upsell_rule_updated", `Upsell rule bijgewerkt`);
      onToast("Upsell rule bijgewerkt");
    } else {
      const { error } = await supabase.from("upsell_rules").insert(data);
      if (error) { onToast(`Error: ${error.message}`); return; }
      addLog?.("upsell_rule_created", `Upsell rule aangemaakt`);
      onToast("Upsell rule aangemaakt");
    }
    setEditing(null);
    setAdding(false);
    onRefetch();
  }

  async function deleteRule(id: string) {
    if (!confirm("Upsell rule verwijderen?")) return;
    const { error } = await supabase.from("upsell_rules").delete().eq("id", id);
    if (error) { onToast(`Error: ${error.message}`); return; }
    addLog?.("upsell_rule_deleted", "Upsell rule verwijderd");
    onToast("Upsell rule verwijderd");
    onRefetch();
  }

  async function toggleActive(rule: UpsellRule) {
    await supabase.from("upsell_rules").update({ is_active: !rule.is_active } as any).eq("id", rule.id);
    onRefetch();
  }

  const totalImpressions = rules.reduce((s, r) => s + r.impression_count, 0);
  const totalConversions = rules.reduce((s, r) => s + r.conversion_count, 0);
  const conversionRate = totalImpressions > 0 ? ((totalConversions / totalImpressions) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" /> Upsell Engine
          </h1>
          <p className="text-sm text-muted-foreground">{rules.length} regels · {conversionRate}% conversie ({totalConversions}/{totalImpressions})</p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Rule
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="rounded-2xl">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{totalImpressions}</div>
            <div className="text-xs text-muted-foreground">Impressions</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{totalConversions}</div>
            <div className="text-xs text-muted-foreground">Accepted</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{conversionRate}%</div>
            <div className="text-xs text-muted-foreground">Conversion</div>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search rules..." className="pl-9" />
      </div>

      {adding && (
        <RuleForm products={products} onSave={(data) => saveRule(data)} onCancel={() => setAdding(false)} />
      )}

      <div className="space-y-2">
        {filtered.map((rule) => {
          const triggerProduct = products.find((p) => p.id === rule.trigger_product_id);
          const suggestedProduct = products.find((p) => p.id === rule.suggested_product_id);
          const ruleConvRate = rule.impression_count > 0 ? ((rule.conversion_count / rule.impression_count) * 100).toFixed(0) : "—";

          if (editing === rule.id) {
            return <RuleForm key={rule.id} initial={rule} products={products} onSave={(data) => saveRule(data, rule.id)} onCancel={() => setEditing(null)} />;
          }

          return (
            <Card key={rule.id} className={`rounded-2xl ${!rule.is_active ? "opacity-60" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={rule.suggestion_type === "upgrade" ? "default" : rule.suggestion_type === "addon" ? "secondary" : "outline"} className="text-[10px]">
                        {rule.suggestion_type}
                      </Badge>
                      {!rule.is_active && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                      <span className="text-xs text-muted-foreground">Priority: {rule.priority}</span>
                      {rule.active_from && <span className="text-xs text-muted-foreground">{rule.active_from}–{rule.active_until}</span>}
                    </div>
                    <div className="text-sm font-medium mt-1">
                      {triggerProduct?.name || rule.trigger_category || "Any"} → {suggestedProduct?.name || rule.suggested_product_id}
                      {rule.extra_price_override != null && <span className="text-muted-foreground ml-1">({euro(rule.extra_price_override)})</span>}
                    </div>
                    {rule.prompt_text_nl && (
                      <div className="text-xs text-muted-foreground mt-0.5 italic">"{rule.prompt_text_nl}"</div>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span>{rule.impression_count} views</span>
                      <span>{rule.conversion_count} accepts</span>
                      <span className="font-medium text-amber-600">{ruleConvRate}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch checked={rule.is_active} onCheckedChange={() => toggleActive(rule)} />
                    <Button variant="ghost" size="sm" onClick={() => setEditing(rule.id)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-500" onClick={() => deleteRule(rule.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && !adding && (
        <div className="text-center py-12 text-muted-foreground">
          <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Geen upsell rules gevonden</p>
          <p className="text-sm">Maak je eerste regel aan — bijv. coffee → pastry.</p>
        </div>
      )}
    </div>
  );
}
