import React, { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, Plus, Minus, X, Send, Check, Loader2, User, Mail, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";

// ─── Menu data (mirrors POS products) ────────────────────────────────────────

const milkGroup = {
  id: "milk", name: "Melk", required: false, multiple: false,
  options: [
    { id: "whole", name: "Volle Melk", price: 0 },
    { id: "oat", name: "Haver Melk", price: 0.3 },
    { id: "coconut", name: "Kokos Melk", price: 0.4 },
    { id: "almond", name: "Amandel Melk", price: 0.4 },
  ],
};
const syrupGroup = {
  id: "syrup", name: "Siroop", required: false, multiple: true,
  options: [
    { id: "vanille", name: "Vanille", price: 0.75 },
    { id: "mango", name: "Mango", price: 0.75 },
    { id: "passion", name: "Passievrucht", price: 0.75 },
    { id: "blue", name: "Blue Magic", price: 0.75 },
  ],
};
const lemonadeFlavorGroup = {
  id: "lemonade-flavour", name: "Smaak", required: true, multiple: false,
  options: [
    { id: "passion-glow", name: "Passion Glow", price: 0 },
    { id: "cherry-burst", name: "Cherry Burst", price: 0 },
    { id: "sunset-pulse", name: "Sunset Pulse", price: 0 },
    { id: "tiffany-blue", name: "Tiffany Blue", price: 0 },
  ],
};
const sizeGroup = {
  id: "size", name: "Formaat", required: false, multiple: false,
  options: [
    { id: "regular", name: "Regular", price: 0 },
    { id: "large", name: "Large", price: 1.0 },
  ],
};
const extraGroup = {
  id: "extras", name: "Extra", required: false, multiple: true,
  options: [
    { id: "whipped", name: "Slagroom", price: 0.5 },
    { id: "extra-shot", name: "Extra shot", price: 0.75 },
    { id: "decaf", name: "Decaf", price: 0 },
  ],
};

const SECTIONS = ["Signature Drinks", "Specials", "Cold Drinks", "Hot Drinks", "Sweets"];

const menuProducts = [
  { id: "sig-1", name: "Tropical Matcha Medium", section: "Signature Drinks", price: 7, modifierGroups: [milkGroup, syrupGroup, extraGroup], color: "#a3e635" },
  { id: "sig-2", name: "Tropical Matcha Large", section: "Signature Drinks", price: 8, modifierGroups: [milkGroup, syrupGroup, extraGroup], color: "#a3e635" },
  { id: "sig-3", name: "Berry Matcha Medium", section: "Signature Drinks", price: 7, modifierGroups: [milkGroup, syrupGroup, extraGroup], color: "#c084fc" },
  { id: "sig-4", name: "Berry Matcha Large", section: "Signature Drinks", price: 8, modifierGroups: [milkGroup, syrupGroup, extraGroup], color: "#c084fc" },
  { id: "special-1", name: "Papa Smurf", section: "Specials", price: 8.5, modifierGroups: [milkGroup, extraGroup], color: "#60a5fa" },
  { id: "special-2", name: "HOT Crème Brûlée", section: "Specials", price: 6.5, modifierGroups: [milkGroup, extraGroup], color: "#fbbf24" },
  { id: "cold-1", name: "Iced Matcha Medium", section: "Cold Drinks", price: 6.5, modifierGroups: [milkGroup, syrupGroup, extraGroup], color: "#34d399" },
  { id: "cold-2", name: "Iced Matcha Large", section: "Cold Drinks", price: 7.5, modifierGroups: [milkGroup, syrupGroup, extraGroup], color: "#34d399" },
  { id: "cold-3", name: "Iced Latte Medium", section: "Cold Drinks", price: 4.5, modifierGroups: [milkGroup, syrupGroup, extraGroup], color: "#a78bfa" },
  { id: "cold-4", name: "Iced Latte Large", section: "Cold Drinks", price: 5.25, modifierGroups: [milkGroup, syrupGroup, extraGroup], color: "#a78bfa" },
  { id: "cold-5", name: "Matcha Lemonade Medium", section: "Cold Drinks", price: 5.5, modifierGroups: [lemonadeFlavorGroup], color: "#fde047" },
  { id: "cold-6", name: "Matcha Lemonade Large", section: "Cold Drinks", price: 6.25, modifierGroups: [lemonadeFlavorGroup], color: "#fde047" },
  { id: "cold-7", name: "Lemonade", section: "Cold Drinks", price: 4.75, modifierGroups: [lemonadeFlavorGroup], color: "#fde047" },
  { id: "hot-1", name: "Espresso", section: "Hot Drinks", price: 2.8, modifierGroups: [extraGroup], color: "#92400e" },
  { id: "hot-2", name: "Flat White", section: "Hot Drinks", price: 4.5, modifierGroups: [milkGroup, extraGroup], color: "#d4a574" },
  { id: "hot-3", name: "Cappuccino Medium", section: "Hot Drinks", price: 4.5, modifierGroups: [milkGroup, syrupGroup, extraGroup], color: "#d4a574" },
  { id: "hot-4", name: "Cappuccino Large", section: "Hot Drinks", price: 5.2, modifierGroups: [milkGroup, syrupGroup, extraGroup], color: "#d4a574" },
  { id: "hot-5", name: "Americano Medium", section: "Hot Drinks", price: 3.5, modifierGroups: [extraGroup], color: "#78350f" },
  { id: "hot-6", name: "Americano Large", section: "Hot Drinks", price: 4.5, modifierGroups: [extraGroup], color: "#78350f" },
  { id: "hot-7", name: "Tea", section: "Hot Drinks", price: 3.2, modifierGroups: [], color: "#fbbf24" },
  { id: "sweet-1", name: "Sticky Date Toffee Cake", section: "Sweets", price: 4.5, modifierGroups: [], color: "#b45309" },
  { id: "sweet-2", name: "Pistachio Baklava", section: "Sweets", price: 3.5, modifierGroups: [], color: "#65a30d" },
  { id: "sweet-3", name: "Cookie", section: "Sweets", price: 2.5, modifierGroups: [], color: "#d97706" },
];

function euro(value: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(value);
}

type Modifier = { id: string; name: string; price: number };
type CartItem = {
  id: string;
  productId: string;
  name: string;
  price: number;
  qty: number;
  modifiers: Modifier[];
  notes: string;
};

export default function MenuPage() {
  const { tableId } = useParams<{ tableId: string }>();
  const [activeSection, setActiveSection] = useState(SECTIONS[0]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [customizing, setCustomizing] = useState<string | null>(null);
  const [selectedMods, setSelectedMods] = useState<Record<string, string[]>>({});
  const [submitted, setSubmitted] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const sectionProducts = useMemo(
    () => menuProducts.filter((p) => p.section === activeSection),
    [activeSection]
  );

  const cartTotal = cart.reduce(
    (s, i) => s + (i.price + i.modifiers.reduce((a, m) => a + m.price, 0)) * i.qty,
    0
  );
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  function startCustomize(productId: string) {
    const product = menuProducts.find((p) => p.id === productId)!;
    if (product.modifierGroups.length === 0) {
      addToCart(productId, {});
    } else {
      setCustomizing(productId);
      setSelectedMods({});
    }
  }

  function toggleMod(groupId: string, optionId: string, multiple: boolean) {
    setSelectedMods((prev) => {
      const current = prev[groupId] || [];
      if (multiple) {
        return { ...prev, [groupId]: current.includes(optionId) ? current.filter((x) => x !== optionId) : [...current, optionId] };
      }
      return { ...prev, [groupId]: current.includes(optionId) ? [] : [optionId] };
    });
  }

  function addToCart(productId: string, mods: Record<string, string[]>) {
    const product = menuProducts.find((p) => p.id === productId)!;
    const modifiers: Modifier[] = [];
    for (const group of product.modifierGroups) {
      const selected = mods[group.id] || [];
      for (const optId of selected) {
        const opt = group.options.find((o) => o.id === optId);
        if (opt) modifiers.push({ id: opt.id, name: opt.name, price: opt.price });
      }
    }
    const itemId = `${productId}-${Date.now()}`;
    setCart((prev) => [...prev, { id: itemId, productId, name: product.name, price: product.price, qty: 1, modifiers, notes: "" }]);
    setCustomizing(null);
  }

  function updateQty(itemId: string, delta: number) {
    setCart((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, qty: Math.max(0, i.qty + delta) } : i)).filter((i) => i.qty > 0)
    );
  }

  function removeItem(itemId: string) {
    setCart((prev) => prev.filter((i) => i.id !== itemId));
  }

  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (submitting || cart.length === 0) return;
    if (!customerName.trim() || !customerEmail.trim() || !customerPhone.trim()) return;
    setSubmitting(true);
    try {
      const items = cart.map((item) => ({
        productId: item.productId,
        name: item.name,
        price: item.price,
        qty: item.qty,
        modifiers: item.modifiers,
      }));
      await supabase.from("qr_orders").insert({
        table_id: tableId || "unknown",
        items: items as any,
        total: cartTotal,
        status: "pending",
        customer_name: customerName.trim(),
        customer_email: customerEmail.trim(),
        customer_phone: customerPhone.trim(),
      } as any);
      setSubmitted(true);
      setCart([]);
    } catch (err) {
      console.error("Failed to submit order:", err);
    } finally {
      setSubmitting(false);
    }
  }

  const customerValid = customerName.trim().length > 0 && customerEmail.trim().length > 0 && customerPhone.trim().length > 0;

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <Check className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold">Bestelling ontvangen!</h1>
          <p className="text-muted-foreground">
            Je bestelling voor <span className="font-semibold">Tafel {tableId}</span> is verzonden. We komen het zo brengen!
          </p>
          <Button className="mt-4" onClick={() => setSubmitted(false)}>Nog iets bestellen</Button>
        </div>
      </div>
    );
  }

  const customizingProduct = customizing ? menuProducts.find((p) => p.id === customizing) : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col max-w-lg mx-auto relative">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Menu</h1>
            <p className="text-xs text-muted-foreground">Tafel {tableId}</p>
          </div>
          <Button variant="outline" size="sm" className="relative" onClick={() => setShowCart(true)}>
            <ShoppingCart className="h-4 w-4 mr-1" />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-green-600 text-white text-xs flex items-center justify-center">
                {cartCount}
              </span>
            )}
            {euro(cartTotal)}
          </Button>
        </div>

        {/* Section tabs */}
        <ScrollArea className="mt-3 -mx-4 px-4">
          <div className="flex gap-2 pb-1">
            {SECTIONS.map((sec) => (
              <button
                key={sec}
                onClick={() => setActiveSection(sec)}
                className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                  activeSection === sec
                    ? "bg-green-700 text-white shadow-sm"
                    : "bg-secondary text-foreground hover:bg-secondary/80"
                }`}
              >
                {sec}
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Products grid */}
      <div className="flex-1 p-4 pb-24">
        <div className="grid grid-cols-2 gap-3">
          {sectionProducts.map((product) => (
            <button
              key={product.id}
              onClick={() => startCustomize(product.id)}
              className="rounded-2xl border bg-card p-4 text-left hover:shadow-md transition-all active:scale-[0.97]"
            >
              <div
                className="h-3 w-3 rounded-full mb-2"
                style={{ backgroundColor: product.color }}
              />
              <div className="font-medium text-sm leading-snug">{product.name}</div>
              <div className="text-green-700 font-semibold mt-1 text-sm">{euro(product.price)}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Floating cart button */}
      {cartCount > 0 && !showCart && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 z-40">
          <Button
            className="w-full rounded-2xl h-14 text-base font-semibold bg-green-700 hover:bg-green-800 shadow-lg"
            onClick={() => setShowCart(true)}
          >
            <ShoppingCart className="h-5 w-5 mr-2" />
            Bekijk bestelling ({cartCount}) — {euro(cartTotal)}
          </Button>
        </div>
      )}

      {/* Modifier customization overlay */}
      {customizingProduct && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
          <div className="bg-white w-full max-w-lg mx-auto rounded-t-3xl max-h-[80vh] flex flex-col animate-in slide-in-from-bottom">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">{customizingProduct.name}</h3>
                <p className="text-sm text-green-700 font-medium">{euro(customizingProduct.price)}</p>
              </div>
              <button onClick={() => setCustomizing(null)} className="p-2 rounded-full hover:bg-secondary">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-6">
                {customizingProduct.modifierGroups.map((group) => (
                  <div key={group.id}>
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium text-sm">{group.name}</h4>
                      {group.required && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Verplicht</Badge>}
                      {group.multiple && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Meerdere</Badge>}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {group.options.map((opt) => {
                        const isSelected = (selectedMods[group.id] || []).includes(opt.id);
                        return (
                          <button
                            key={opt.id}
                            onClick={() => toggleMod(group.id, opt.id, group.multiple)}
                            className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-all ${
                              isSelected
                                ? "border-green-600 bg-green-50 text-green-800"
                                : "hover:bg-secondary/50"
                            }`}
                          >
                            <div className="font-medium">{opt.name}</div>
                            {opt.price > 0 && (
                              <div className="text-xs text-muted-foreground mt-0.5">+{euro(opt.price)}</div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="p-4 border-t">
              <Button
                className="w-full rounded-xl h-12 bg-green-700 hover:bg-green-800 font-semibold"
                onClick={() => addToCart(customizingProduct.id, selectedMods)}
              >
                <Plus className="h-4 w-4 mr-2" /> Toevoegen
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cart sheet */}
      {showCart && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
          <div className="bg-white w-full max-w-lg mx-auto rounded-t-3xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-lg">Je bestelling</h3>
              <button onClick={() => setShowCart(false)} className="p-2 rounded-full hover:bg-secondary">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ScrollArea className="flex-1 p-4">
              {cart.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Je mandje is leeg</p>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => {
                    const itemTotal = (item.price + item.modifiers.reduce((s, m) => s + m.price, 0)) * item.qty;
                    return (
                      <div key={item.id} className="rounded-xl border p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{item.name}</div>
                            {item.modifiers.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {item.modifiers.map((m) => m.name).join(", ")}
                              </div>
                            )}
                          </div>
                          <div className="text-sm font-semibold text-green-700">{euro(itemTotal)}</div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(item.id, -1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-sm font-medium w-6 text-center">{item.qty}</span>
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(item.id, 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto text-destructive" onClick={() => removeItem(item.id)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
            {cart.length > 0 && (
              <div className="p-4 border-t space-y-3">
                <div className="flex items-center justify-between font-semibold">
                  <span>Totaal</span>
                  <span className="text-green-700 text-lg">{euro(cartTotal)}</span>
                </div>
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground">Jouw gegevens</p>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Naam *" className="pl-9 h-10 rounded-xl text-sm" />
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="E-mail *" className="pl-9 h-10 rounded-xl text-sm" />
                  </div>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Telefoonnummer *" className="pl-9 h-10 rounded-xl text-sm" />
                  </div>
                </div>
                <Button
                  className="w-full rounded-xl h-12 bg-green-700 hover:bg-green-800 font-semibold text-base"
                  onClick={handleSubmit}
                  disabled={submitting || !customerValid}
                >
                  {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verzenden...</> : <><Send className="h-4 w-4 mr-2" /> Bestelling plaatsen</>}
                </Button>
                <p className="text-[11px] text-center text-muted-foreground">Betaling vindt plaats aan tafel</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
