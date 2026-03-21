import React, { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  LayoutDashboard, Activity, CalendarDays, Package, QrCode, Users, Gift, Receipt,
  Calculator, Settings, ShoppingCart, Plus, Minus, Trash2, CreditCard,
  Sparkles, Wallet, Percent, Search, Smartphone, X, Check,
  ChefHat, Printer, Edit, Eye, DollarSign, TrendingUp,
  UserPlus, MapPin, FileText,
  Shield, Zap, Bell, LogOut,
  ChevronRight, Banknote,
  UtensilsCrossed, Armchair, Play,
} from "lucide-react";

/**
 * SAAKOUK POS — Full Lovable-ready single-file build (v2 — all flows wired)
 *
 * Key fixes over v1:
 * - Cart state lifted to parent — survives navigation between views
 * - openTickets map: keyed by "walk-in" or table id for multi-ticket support
 * - Table flow fully connected: selecting a table preselects it in POS
 * - Orders linked by customerId, not customerName
 * - Feature toggles drive real behavior (tips, loyalty providers)
 * - Gift card redemption wired into payment flow
 * - Reservations → table status connection
 * - Live products passed to SalesView (not stale initialProducts)
 * - Top bar shows real today-only count
 * - Modal onClose safely guarded
 * - Unused imports removed, unused variables removed
 * - Order status model: pending / completed / refunded
 * - Product editor includes modifiers, color, tags
 * - Table state derived from open tickets (single source of truth)
 */

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const SECTIONS = ["Signature Drinks", "Specials", "Cold Drinks", "Hot Drinks", "Sweets"];

// ─── MOCK DATA ───────────────────────────────────────────────────────────────

const milkGroup = {
  id: "milk", name: "Milk", required: false, multiple: false,
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
  id: "lemonade-flavour", name: "Lemonade Flavours", required: true, multiple: false,
  options: [
    { id: "passion-glow", name: "Passion Glow", price: 0 },
    { id: "cherry-burst", name: "Cherry Burst", price: 0 },
    { id: "sunset-pulse", name: "Sunset Pulse", price: 0 },
    { id: "tiffany-blue", name: "Tiffany Blue", price: 0 },
  ],
};

const sizeGroup = {
  id: "size", name: "Size", required: false, multiple: false,
  options: [
    { id: "regular", name: "Regular", price: 0 },
    { id: "large", name: "Large", price: 1.0 },
  ],
};

const extraGroup = {
  id: "extras", name: "Extras", required: false, multiple: true,
  options: [
    { id: "whipped", name: "Slagroom", price: 0.5 },
    { id: "extra-shot", name: "Extra shot", price: 0.75 },
    { id: "decaf", name: "Decaf", price: 0 },
  ],
};

const ALL_MODIFIER_GROUPS = [milkGroup, syrupGroup, lemonadeFlavorGroup, sizeGroup, extraGroup];

const initialProducts = [
  { id: "sig-1", name: "Tropical Matcha Medium", section: "Signature Drinks", price: 7, tags: ["Drinks", "Signature"], modifierGroups: [milkGroup, syrupGroup, extraGroup], color: "#a3e635" },
  { id: "sig-2", name: "Tropical Matcha Large", section: "Signature Drinks", price: 8, tags: ["Drinks", "Signature"], modifierGroups: [milkGroup, syrupGroup, extraGroup], color: "#a3e635" },
  { id: "sig-3", name: "Berry Matcha Medium", section: "Signature Drinks", price: 7, tags: ["Drinks", "Signature"], modifierGroups: [milkGroup, syrupGroup, extraGroup], color: "#c084fc" },
  { id: "sig-4", name: "Berry Matcha Large", section: "Signature Drinks", price: 8, tags: ["Drinks", "Signature"], modifierGroups: [milkGroup, syrupGroup, extraGroup], color: "#c084fc" },
  { id: "special-1", name: "Papa Smurf", section: "Specials", price: 8.5, tags: ["Special"], modifierGroups: [milkGroup, extraGroup], color: "#60a5fa" },
  { id: "special-2", name: "HOT Crème Brûlée", section: "Specials", price: 6.5, tags: ["Special", "Hot"], modifierGroups: [milkGroup, extraGroup], color: "#fbbf24" },
  { id: "cold-1", name: "Iced Matcha Medium", section: "Cold Drinks", price: 6.5, tags: ["Cold"], modifierGroups: [milkGroup, syrupGroup, extraGroup], color: "#34d399" },
  { id: "cold-2", name: "Iced Matcha Large", section: "Cold Drinks", price: 7.5, tags: ["Cold"], modifierGroups: [milkGroup, syrupGroup, extraGroup], color: "#34d399" },
  { id: "cold-3", name: "Iced Latte Medium", section: "Cold Drinks", price: 4.5, tags: ["Cold", "Coffee"], modifierGroups: [milkGroup, syrupGroup, extraGroup], color: "#a78bfa" },
  { id: "cold-4", name: "Iced Latte Large", section: "Cold Drinks", price: 5.25, tags: ["Cold", "Coffee"], modifierGroups: [milkGroup, syrupGroup, extraGroup], color: "#a78bfa" },
  { id: "cold-5", name: "Matcha Lemonade Medium", section: "Cold Drinks", price: 5.5, tags: ["Cold", "Lemonade"], modifierGroups: [lemonadeFlavorGroup], color: "#fde047" },
  { id: "cold-6", name: "Matcha Lemonade Large", section: "Cold Drinks", price: 6.25, tags: ["Cold", "Lemonade"], modifierGroups: [lemonadeFlavorGroup], color: "#fde047" },
  { id: "cold-7", name: "Lemonade", section: "Cold Drinks", price: 4.75, tags: ["Cold", "Lemonade"], modifierGroups: [lemonadeFlavorGroup], color: "#fde047" },
  { id: "hot-1", name: "Espresso", section: "Hot Drinks", price: 2.8, tags: ["Hot", "Coffee"], modifierGroups: [extraGroup], color: "#92400e" },
  { id: "hot-2", name: "Flat White", section: "Hot Drinks", price: 4.5, tags: ["Hot", "Coffee"], modifierGroups: [milkGroup, extraGroup], color: "#d4a574" },
  { id: "hot-3", name: "Cappuccino Medium", section: "Hot Drinks", price: 4.5, tags: ["Hot", "Coffee"], modifierGroups: [milkGroup, syrupGroup, extraGroup], color: "#d4a574" },
  { id: "hot-4", name: "Cappuccino Large", section: "Hot Drinks", price: 5.2, tags: ["Hot", "Coffee"], modifierGroups: [milkGroup, syrupGroup, extraGroup], color: "#d4a574" },
  { id: "hot-5", name: "Americano Medium", section: "Hot Drinks", price: 3.5, tags: ["Hot", "Coffee"], modifierGroups: [extraGroup], color: "#78350f" },
  { id: "hot-6", name: "Americano Large", section: "Hot Drinks", price: 4.5, tags: ["Hot", "Coffee"], modifierGroups: [extraGroup], color: "#78350f" },
  { id: "hot-7", name: "Tea", section: "Hot Drinks", price: 3.2, tags: ["Hot"], modifierGroups: [], color: "#fbbf24" },
  { id: "sweet-1", name: "Sticky Date Toffee Cake", section: "Sweets", price: 4.5, tags: ["Sweets"], modifierGroups: [], color: "#b45309" },
  { id: "sweet-2", name: "Pistachio Baklava", section: "Sweets", price: 3.5, tags: ["Sweets"], modifierGroups: [], color: "#65a30d" },
  { id: "sweet-3", name: "Cookie", section: "Sweets", price: 2.5, tags: ["Sweets"], modifierGroups: [], color: "#d97706" },
];

const discounts = [
  { id: "disc-1", name: "Verkeerde Drankje", type: "percent", value: 100 },
  { id: "disc-2", name: "Influencer", type: "percent", value: 100 },
  { id: "disc-3", name: "Staff use", type: "percent", value: 40 },
  { id: "disc-4", name: "Familie", type: "percent", value: 30 },
  { id: "disc-5", name: "Gemeente", type: "percent", value: 10 },
  { id: "disc-6", name: "Matcha Zakje", type: "percent", value: 25 },
];

const initialTables = [
  { id: "1", name: "1", seats: "1-2", area: "Buiten" },
  { id: "2", name: "2", seats: "1-2", area: "Buiten" },
  { id: "3", name: "3", seats: "1-2", area: "Buiten" },
  { id: "4", name: "4", seats: "1-2", area: "Other" },
  { id: "5", name: "5", seats: "1-2", area: "Other" },
  { id: "bar", name: "Bar", seats: "1-2", area: "Other" },
  { id: "t1", name: "T1", seats: "1-4", area: "Buiten" },
  { id: "t2", name: "T2", seats: "1-4", area: "Buiten" },
];

const initialCustomers = [
  { id: "c1", name: "Sarah de Vries", email: "sarah@example.com", phone: "+31612345678", loyaltyId: "LYL-001", points: 245, visits: 32, totalSpent: 412.5, lastVisit: "2026-03-17", provider: "passkit" },
  { id: "c2", name: "Mohammed Al-Rashid", email: "mo@example.com", phone: "+31687654321", loyaltyId: "LYL-002", points: 180, visits: 24, totalSpent: 298.0, lastVisit: "2026-03-16", provider: "piggy" },
  { id: "c3", name: "Emma Bakker", email: "emma.b@example.com", phone: "+31698765432", loyaltyId: "LYL-003", points: 520, visits: 56, totalSpent: 687.25, lastVisit: "2026-03-18", provider: "leat" },
  { id: "c4", name: "Lucas Jansen", email: "lucas.j@example.com", phone: "+31654321098", loyaltyId: "", points: 0, visits: 3, totalSpent: 34.5, lastVisit: "2026-03-10", provider: "none" },
];

const initialGiftCards = [
  { id: "gc-1", code: "SAAK-2026-A1B2", balance: 25.0, initialValue: 25.0, status: "active", issuedAt: "2026-03-01", customerName: "Sarah de Vries" },
  { id: "gc-2", code: "SAAK-2026-C3D4", balance: 10.0, initialValue: 50.0, status: "active", issuedAt: "2026-02-14", customerName: "Gift buyer" },
  { id: "gc-3", code: "SAAK-2026-E5F6", balance: 0, initialValue: 15.0, status: "redeemed", issuedAt: "2026-01-20", customerName: "Emma Bakker" },
];

const initialReservations = [
  { id: "r1", name: "Van Dijk family", date: "2026-03-18", time: "14:00", guests: 4, table: "T1", phone: "+31612345000", notes: "Birthday", status: "confirmed" },
  { id: "r2", name: "Karim", date: "2026-03-18", time: "16:30", guests: 2, table: "3", phone: "+31687650000", notes: "", status: "confirmed" },
  { id: "r3", name: "Office meetup", date: "2026-03-19", time: "10:00", guests: 6, table: "T2", phone: "+31698760000", notes: "Need power outlets", status: "pending" },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function euro(value: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(value);
}

function clsx(...parts: any[]) {
  return parts.filter(Boolean).join(" ");
}

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(date: Date) {
  return date.toLocaleDateString("nl-NL", { year: "numeric", month: "short", day: "numeric" });
}

function isToday(date: Date) {
  return date.toDateString() === new Date().toDateString();
}

function emptyTicket(tableId: string) {
  return { tableId, cart: [], selectedDiscount: null, customerId: null, customerName: "", loyaltyProvider: "none", loyaltyCustomer: null };
}

function cartSubtotal(cart: any[]) {
  return cart.reduce((sum, item) => sum + (item.price + item.modifiers.reduce((m, x) => m + x.price, 0)) * item.qty, 0);
}

function cartItemCount(cart: any[]) {
  return cart.reduce((s, i) => s + i.qty, 0);
}

// ─── MODAL WRAPPER ───────────────────────────────────────────────────────────

function Modal({ open, onClose, children, wide }: { open: boolean; onClose?: () => void; children: React.ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 z-50" onClick={() => onClose?.()}>
      <div className={clsx("bg-white rounded-3xl shadow-2xl max-h-[90vh] overflow-auto", wide ? "w-full max-w-4xl" : "w-full max-w-2xl")} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// ─── TOAST ───────────────────────────────────────────────────────────────────

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  if (!message) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[60] bg-black text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4">
      <Check className="h-5 w-5 text-green-400" />
      <span>{message}</span>
      <button onClick={onClose}><X className="h-4 w-4 text-white/60 hover:text-white" /></button>
    </div>
  );
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────

function Sidebar({ active, setActive }: { active: string; setActive: (k: string) => void }) {
  const sections = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "pos", label: "POS", icon: ShoppingCart },
    { key: "activity", label: "Activity", icon: Activity },
    { key: "reservations", label: "Reservations", icon: CalendarDays },
    { key: "products", label: "Products", icon: Package },
    { key: "qr", label: "QR Ordering", icon: QrCode },
    { key: "customers", label: "Customers", icon: Users },
    { key: "giftcards", label: "Gift cards", icon: Gift },
    { key: "sales", label: "Sales", icon: Receipt },
    { key: "accounting", label: "Accounting", icon: Calculator },
    { key: "settings", label: "Settings", icon: Settings },
  ];
  return (
    <div className="w-[72px] border-r bg-white flex flex-col shrink-0">
      <div className="py-4 px-2 border-b flex flex-col items-center">
        <div className="text-sm font-black tracking-tight leading-none">S</div>
      </div>
      <ScrollArea className="flex-1 py-2 px-1.5">
        <div className="space-y-1 flex flex-col items-center">
          {sections.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.key} onClick={() => setActive(item.key)}
                title={item.label}
                className={clsx("w-12 h-12 flex flex-col items-center justify-center rounded-xl text-[10px] leading-tight transition-all gap-0.5",
                  active === item.key ? "bg-black text-white font-medium" : "hover:bg-neutral-100 text-neutral-600")}>
                <Icon className="h-5 w-5 shrink-0" />
                <span className="truncate w-full text-center">{item.label.length > 6 ? item.label.slice(0, 5) + "." : item.label}</span>
              </button>
            );
          })}
        </div>
      </ScrollArea>
      <div className="p-1.5 border-t flex justify-center">
        <button title="End shift" className="w-12 h-12 flex items-center justify-center rounded-xl text-red-600 hover:bg-red-50 transition">
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

// ─── PRODUCT BUTTON ──────────────────────────────────────────────────────────

function ProductButton({ product, onClick }: { product: any; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="rounded-2xl border bg-white p-3 text-left shadow-sm hover:shadow-md hover:scale-[1.02] transition-all h-full flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="font-semibold text-sm leading-tight">{product.name}</div>
          <Badge variant="secondary" className="shrink-0 text-xs">{euro(product.price)}</Badge>
        </div>
        {product.modifierGroups?.length > 0 && (
          <div className="text-[11px] text-muted-foreground mt-1">{product.modifierGroups.length} modifier group{product.modifierGroups.length > 1 ? "s" : ""}</div>
        )}
      </div>
      {product.color && <div className="w-full h-1 rounded-full mt-2" style={{ backgroundColor: product.color }} />}
    </button>
  );
}

// ─── MODIFIER PICKER ─────────────────────────────────────────────────────────

function ModifierPicker({ product, onAdd, onClose }: { product: any; onAdd: (item: any) => void; onClose: () => void }) {
  const [selected, setSelected] = useState({});
  const [notes, setNotes] = useState("");
  const [qty, setQty] = useState(1);
  const modifierGroups = product.modifierGroups ?? [];

  function toggle(group, optionId) {
    setSelected((prev) => {
      const current = prev[group.id] ?? [];
      let next;
      if (group.multiple) {
        next = current.includes(optionId) ? current.filter((x) => x !== optionId) : [...current, optionId];
      } else {
        next = current.includes(optionId) ? [] : [optionId];
      }
      return { ...prev, [group.id]: next };
    });
  }

  const modifierTotal = modifierGroups.reduce((sum, group) => {
    const ids = selected[group.id] ?? [];
    return sum + ids.reduce((s, id) => {
      const opt = group.options.find((o) => o.id === id);
      return s + (opt?.price ?? 0);
    }, 0);
  }, 0);

  const lineTotal = (product.price + modifierTotal) * qty;
  const canAdd = modifierGroups.every((g) => !g.required || (selected[g.id]?.length > 0));

  function addToCart() {
    if (!canAdd) return;
    const chosen = modifierGroups.flatMap((group) => {
      const ids = selected[group.id] ?? [];
      return ids.map((id) => group.options.find((o) => o.id === id)).filter(Boolean)
        .map((option) => ({ groupName: group.name, optionName: option.name, price: option.price }));
    });
    onAdd({
      lineId: `${product.id}-${Date.now()}`,
      productId: product.id,
      name: product.name,
      price: product.price,
      qty,
      notes,
      modifiers: chosen,
    });
    onClose();
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{product.name}</h2>
          <div className="text-sm text-muted-foreground mt-0.5">Base price: {euro(product.price)}</div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full"><X className="h-5 w-5" /></button>
      </div>
      {modifierGroups.length === 0 ? (
        <div className="text-sm text-muted-foreground">No modifiers for this product.</div>
      ) : (
        modifierGroups.map((group) => (
          <div key={group.id} className="space-y-2">
            <div className="font-medium flex items-center gap-2">
              {group.name}
              {group.required && <Badge variant="destructive" className="text-[10px]">Required</Badge>}
              {group.multiple && <Badge variant="secondary" className="text-[10px]">Multiple</Badge>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {group.options.map((option) => {
                const active = (selected[group.id] ?? []).includes(option.id);
                return (
                  <button key={option.id} onClick={() => toggle(group, option.id)}
                    className={clsx("rounded-xl border px-3 py-2 text-left text-sm transition-all",
                      active ? "border-black bg-black text-white" : "bg-white hover:bg-neutral-50")}>
                    <div className="font-medium">{option.name}</div>
                    <div className={clsx("text-xs", active ? "text-white/70" : "text-muted-foreground")}>
                      {option.price > 0 ? `+${euro(option.price)}` : "Included"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}
      <div className="space-y-2">
        <Label>Notes</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="No ice, extra foam, less sweet..." />
      </div>
      <div className="flex items-center gap-3">
        <Label>Qty</Label>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setQty(Math.max(1, qty - 1))}><Minus className="h-3 w-3" /></Button>
          <span className="w-8 text-center font-semibold">{qty}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setQty(qty + 1)}><Plus className="h-3 w-3" /></Button>
        </div>
      </div>
      <Separator />
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground">Line total</div>
          <div className="text-2xl font-bold">{euro(lineTotal)}</div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={addToCart} disabled={!canAdd} className="min-w-[120px]">
            <Plus className="h-4 w-4 mr-1" /> Add to cart
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── PAYMENT MODAL ───────────────────────────────────────────────────────────

function PaymentModal({ open, onClose, total, onComplete, method: initialMethod, features, giftCards, onRedeemGiftCard }: any) {
  const [method, setMethod] = useState(initialMethod || "card");
  const [cashGiven, setCashGiven] = useState("");
  const [step, setStep] = useState("choose");
  const [tipPercent, setTipPercent] = useState(0);
  const [giftCardCode, setGiftCardCode] = useState("");
  const [giftCardApplied, setGiftCardApplied] = useState(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (open) { setStep("choose"); setCashGiven(""); setTipPercent(0); setMethod(initialMethod || "card"); setGiftCardCode(""); setGiftCardApplied(null); setProcessing(false); }
  }, [open, initialMethod]);

  const tipAmount = features?.tips ? total * (tipPercent / 100) : 0;
  const giftCardDeduction = giftCardApplied ? Math.min(giftCardApplied.balance, total + tipAmount) : 0;
  const grandTotal = Math.max(0, total + tipAmount - giftCardDeduction);
  const cashChange = cashGiven ? Math.max(0, parseFloat(cashGiven) - grandTotal) : 0;

  function lookupGiftCard() {
    if (!giftCardCode.trim()) return;
    const found = giftCards?.find((gc) => gc.code.toLowerCase() === giftCardCode.toLowerCase() && gc.status === "active" && gc.balance > 0);
    setGiftCardApplied(found || null);
  }

  function processPayment() {
    if (processing) return;
    setProcessing(true);
    setStep("processing");
    setTimeout(() => {
      setStep("done");
      setProcessing(false);
    }, 1500);
  }

  function finish() {
    if (giftCardApplied && giftCardDeduction > 0) {
      onRedeemGiftCard?.(giftCardApplied.id, giftCardDeduction);
    }
    onComplete({ method: giftCardDeduction >= total + tipAmount ? "giftcard" : method, total: total + tipAmount, tip: tipAmount, giftCardDeduction, giftCardId: giftCardApplied?.id || null });
    onClose();
  }

  if (!open) return null;
  return (
    <Modal open={open} onClose={step === "processing" ? undefined : onClose}>
      <div className="p-6 space-y-5">
        {step === "choose" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Payment</h2>
              <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full"><X className="h-5 w-5" /></button>
            </div>
            <div className="text-center py-4">
              <div className="text-sm text-muted-foreground">Total due</div>
              <div className="text-4xl font-black">{euro(grandTotal)}</div>
              {tipAmount > 0 && <div className="text-sm text-green-600 mt-1">Includes {euro(tipAmount)} tip</div>}
              {giftCardDeduction > 0 && <div className="text-sm text-purple-600 mt-1">Gift card: -{euro(giftCardDeduction)}</div>}
            </div>

            {/* Gift card redemption */}
            <div className="space-y-2">
              <Label>Gift card</Label>
              <div className="flex gap-2">
                <Input value={giftCardCode} onChange={(e) => setGiftCardCode(e.target.value)} placeholder="Enter gift card code" className="text-sm"
                  onKeyDown={(e) => e.key === "Enter" && lookupGiftCard()} />
                <Button variant="outline" size="sm" onClick={lookupGiftCard}><Search className="h-3.5 w-3.5" /></Button>
                {giftCardApplied && <Button variant="ghost" size="sm" onClick={() => setGiftCardApplied(null)}><X className="h-3.5 w-3.5" /></Button>}
              </div>
              {giftCardApplied && (
                <div className="p-2 rounded-lg bg-purple-50 border border-purple-200 text-xs">
                  <div className="font-medium text-purple-800">{giftCardApplied.code}</div>
                  <div className="text-purple-600">Balance: {euro(giftCardApplied.balance)} · Deducting: {euro(giftCardDeduction)}</div>
                </div>
              )}
              {giftCardCode && !giftCardApplied && giftCardCode.length > 3 && (
                <div className="text-xs text-red-500">No active gift card found with this code.</div>
              )}
            </div>

            {grandTotal > 0 && (
              <div className="space-y-3">
                <Label>Payment method</Label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: "card", label: "Card", icon: CreditCard },
                    { key: "cash", label: "Cash", icon: Banknote },
                    { key: "qr", label: "QR / App", icon: Smartphone },
                  ].map((m) => (
                    <button key={m.key} onClick={() => setMethod(m.key)}
                      className={clsx("rounded-xl border p-4 flex flex-col items-center gap-2 transition",
                        method === m.key ? "border-black bg-black text-white" : "hover:bg-neutral-50")}>
                      <m.icon className="h-6 w-6" />
                      <span className="text-sm font-medium">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {features?.tips && (
              <div className="space-y-3">
                <Label>Tip</Label>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 5, 10, 15].map((pct) => (
                    <button key={pct} onClick={() => setTipPercent(pct)}
                      className={clsx("rounded-xl border px-3 py-2 text-sm transition",
                        tipPercent === pct ? "border-black bg-black text-white" : "hover:bg-neutral-50")}>
                      {pct === 0 ? "No tip" : `${pct}%`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {method === "cash" && grandTotal > 0 && (
              <div className="space-y-2">
                <Label>Cash received</Label>
                <Input type="number" value={cashGiven} onChange={(e) => setCashGiven(e.target.value)} placeholder="0.00" className="text-lg" />
                {cashGiven && parseFloat(cashGiven) >= grandTotal && (
                  <div className="text-sm text-green-600 font-medium">Change: {euro(cashChange)}</div>
                )}
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {[5, 10, 20, 50].map((v) => (
                    <Button key={v} variant="outline" size="sm" onClick={() => setCashGiven(String(v))}>{euro(v)}</Button>
                  ))}
                </div>
              </div>
            )}

            <Button className="w-full h-12 text-lg" onClick={processPayment}
              disabled={processing || (grandTotal > 0 && method === "cash" && (!cashGiven || parseFloat(cashGiven) < grandTotal))}>
              {grandTotal === 0 ? "Confirm (fully covered by gift card)" : method === "card" ? "Process card payment" : method === "cash" ? "Confirm cash payment" : "Confirm QR payment"}
            </Button>
          </>
        )}
        {step === "processing" && (
          <div className="py-16 text-center space-y-4">
            <div className="animate-spin mx-auto h-12 w-12 border-4 border-black border-t-transparent rounded-full" />
            <div className="text-lg font-semibold">
              {grandTotal === 0 ? "Processing..." : method === "card" ? "Waiting for terminal..." : method === "qr" ? "Waiting for QR scan..." : "Processing..."}
            </div>
            <div className="text-sm text-muted-foreground">{euro(grandTotal)}</div>
          </div>
        )}
        {step === "done" && (
          <div className="py-12 text-center space-y-4">
            <div className="mx-auto h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <div className="text-xl font-bold">Payment complete</div>
            <div className="text-2xl font-black">{euro(total + tipAmount)}</div>
            <div className="text-sm text-muted-foreground capitalize">{giftCardDeduction > 0 ? `Gift card + ${method}` : method} payment</div>
            {method === "cash" && cashChange > 0 && (
              <div className="text-lg font-semibold text-orange-600">Change due: {euro(cashChange)}</div>
            )}
            <div className="flex gap-3 justify-center pt-4">
              <Button variant="outline" onClick={finish}><Printer className="h-4 w-4 mr-2" />Print receipt</Button>
              <Button onClick={finish}>Done</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── RECEIPT PREVIEW ─────────────────────────────────────────────────────────

function ReceiptPreview({ order, onClose }: { order: any; onClose: () => void }) {
  if (!order) return null;
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Receipt</h2>
        <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full"><X className="h-5 w-5" /></button>
      </div>
      <div className="font-mono text-sm space-y-2 bg-neutral-50 rounded-xl p-4">
        <div className="text-center font-bold text-base">SAAKOUK</div>
        <div className="text-center text-xs text-muted-foreground">Your friendly matcha spot</div>
        <Separator className="my-2" />
        <div className="text-xs text-muted-foreground">Order #{order.id} · {formatDate(order.date)} {formatTime(order.date)}</div>
        {order.customerName && <div className="text-xs">Customer: {order.customerName}</div>}
        <Separator className="my-2" />
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between">
            <div>
              <span>{item.qty}x {item.name}</span>
              {item.modifiers?.map((m, j) => (
                <div key={j} className="text-xs text-muted-foreground ml-3">+ {m.optionName}{m.price > 0 ? ` ${euro(m.price)}` : ""}</div>
              ))}
            </div>
            <span>{euro((item.price + (item.modifiers?.reduce((s, m) => s + m.price, 0) ?? 0)) * item.qty)}</span>
          </div>
        ))}
        <Separator className="my-2" />
        <div className="flex justify-between"><span>Subtotal</span><span>{euro(order.subtotal)}</span></div>
        {order.discount > 0 && <div className="flex justify-between text-red-600"><span>Discount</span><span>-{euro(order.discount)}</span></div>}
        {order.giftCardDeduction > 0 && <div className="flex justify-between text-purple-600"><span>Gift card</span><span>-{euro(order.giftCardDeduction)}</span></div>}
        {order.tip > 0 && <div className="flex justify-between text-green-600"><span>Tip</span><span>{euro(order.tip)}</span></div>}
        <div className="flex justify-between font-bold text-base"><span>TOTAL</span><span>{euro(order.total)}</span></div>
        <Separator className="my-2" />
        <div className="text-xs text-center text-muted-foreground capitalize">Paid by {order.method}</div>
        <div className="text-center text-xs text-muted-foreground mt-2">Thank you, visit again!</div>
      </div>
      <Button variant="outline" className="w-full" onClick={onClose}><Printer className="h-4 w-4 mr-2" />Print</Button>
    </div>
  );
}

// ─── COUNTER POS VIEW ────────────────────────────────────────────────────────
// Cart state is now lifted: ticket comes from parent via props

function CounterView({ products: allProducts, tables, features, customers, giftCards, onRedeemGiftCard, ticket, setTicket, onOrderComplete }: any) {
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("Signature Drinks");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [scanValue, setScanValue] = useState("");

  const cart = ticket.cart;
  const selectedDiscount = ticket.selectedDiscount;
  const customerName = ticket.customerName;
  const tableId = ticket.tableId;
  const loyaltyProvider = ticket.loyaltyProvider;
  const loyaltyCustomer = ticket.loyaltyCustomer;

  const filtered = useMemo(() => {
    return allProducts.filter(
      (p) => p.section === section && p.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, section, allProducts]);

  function updateTicket(updates) {
    setTicket((prev) => ({ ...prev, ...updates }));
  }

  function setCart(updater) {
    setTicket((prev) => ({ ...prev, cart: typeof updater === "function" ? updater(prev.cart) : updater }));
  }

  function addLine(item) {
    setCart((prev) => {
      const existing = prev.find((x) => x.productId === item.productId && JSON.stringify(x.modifiers) === JSON.stringify(item.modifiers) && (x.notes || "") === (item.notes || ""));
      if (!existing) return [...prev, item];
      return prev.map((x) => (x.lineId === existing.lineId ? { ...x, qty: x.qty + item.qty } : x));
    });
  }

  function quickAdd(product) {
    if (product.modifierGroups?.length) {
      setSelectedProduct(product);
      return;
    }
    addLine({ lineId: `${product.id}-${Date.now()}`, productId: product.id, name: product.name, price: product.price, qty: 1, notes: "", modifiers: [] });
  }

  function updateQty(lineId, delta) {
    setCart((prev) => prev.map((item) => (item.lineId === lineId ? { ...item, qty: item.qty + delta } : item)).filter((item) => item.qty > 0));
  }

  function removeLine(lineId) {
    setCart((prev) => prev.filter((x) => x.lineId !== lineId));
  }

  function clearCart() {
    setTicket(emptyTicket(tableId));
    setScanValue("");
  }

  function lookupLoyalty() {
    if (!scanValue.trim()) return;
    const found = customers.find((c) =>
      c.loyaltyId.toLowerCase() === scanValue.toLowerCase() ||
      c.name.toLowerCase().includes(scanValue.toLowerCase()) ||
      (c.email || "").toLowerCase().includes(scanValue.toLowerCase())
    );
    if (found) {
      updateTicket({ loyaltyCustomer: found, customerName: found.name, customerId: found.id });
      if (found.provider !== "none") updateTicket({ loyaltyProvider: found.provider });
    } else {
      updateTicket({ loyaltyCustomer: null });
    }
  }

  const subtotal = cartSubtotal(cart);
  const discountAmount = !selectedDiscount ? 0 : selectedDiscount.type === "percent" ? subtotal * (selectedDiscount.value / 100) : Math.min(selectedDiscount.value, subtotal);
  const total = Math.max(0, subtotal - discountAmount);
  const itemCount = cartItemCount(cart);

  function openPayment(method) {
    if (cart.length === 0) return;
    setPaymentMethod(method);
    setPaymentOpen(true);
  }

  function handlePaymentComplete({ method, total: paidTotal, tip, giftCardDeduction, giftCardId }) {
    const order = {
      id: generateId().toUpperCase(),
      date: new Date(),
      items: [...cart],
      subtotal,
      discount: discountAmount,
      discountName: selectedDiscount?.name || null,
      total: paidTotal,
      tip,
      method,
      customerId: ticket.customerId || null,
      customerName: customerName || null,
      table: tableId === "walk-in" ? null : tableId,
      loyaltyProvider: loyaltyProvider !== "none" ? loyaltyProvider : null,
      loyaltyId: loyaltyCustomer?.loyaltyId || null,
      giftCardDeduction: giftCardDeduction || 0,
      giftCardId: giftCardId || null,
      status: "completed",
    };
    onOrderComplete(order);
    clearCart();
  }

  return (
    <div className="grid grid-cols-12 gap-3 h-[calc(100dvh-120px)]">
      {/* LEFT: Product grid */}
      <div className="col-span-7 flex flex-col gap-3 overflow-hidden">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-9 h-10" />
          </div>
          <div className="flex gap-1">
            {SECTIONS.map((s) => (
              <Button key={s} variant={section === s ? "default" : "outline"} size="sm" className="rounded-full text-[11px] px-2.5 h-8" onClick={() => setSection(s)}>
                {s}
              </Button>
            ))}
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="grid grid-cols-3 gap-2 pb-4">
            {filtered.map((product) => (
              <ProductButton key={product.id} product={product} onClick={() => quickAdd(product)} />
            ))}
            {filtered.length === 0 && (
              <div className="col-span-3 text-center py-12 text-muted-foreground">
                No products found in "{section}"{search ? ` matching "${search}"` : ""}.
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* RIGHT: Cart */}
      <div className="col-span-5 flex flex-col overflow-hidden">
        <Card className="rounded-2xl flex-1 flex flex-col overflow-hidden">
          <CardHeader className="p-4 pb-3 space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                <span className="font-semibold text-sm">Ticket</span>
                {itemCount > 0 && <Badge variant="secondary" className="text-xs">{itemCount}</Badge>}
              </div>
              <Button variant="ghost" size="sm" onClick={clearCart} disabled={cart.length === 0}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />Clear
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Type</Label>
                <select value={tableId} onChange={(e) => updateTicket({ tableId: e.target.value })} className="w-full rounded-lg border px-2 py-1.5 text-sm mt-0.5 bg-white">
                  <option value="walk-in">Walk-in</option>
                  {tables.map((t) => (<option key={t.id} value={t.id}>Table {t.name} · {t.area}</option>))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Customer</Label>
                <Input value={customerName} onChange={(e) => updateTicket({ customerName: e.target.value, customerId: null })} placeholder="Name" className="mt-0.5 h-[34px] text-sm" />
              </div>
            </div>
          </CardHeader>
          <div className="flex-1 overflow-auto px-4">
            {/* Loyalty */}
            {(features.passkit || features.piggy || features.leat) && (
              <div className="rounded-xl border p-3 mb-3 bg-neutral-50">
                <div className="font-medium text-xs flex items-center gap-1.5 mb-2"><Wallet className="h-3.5 w-3.5" /> Loyalty</div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <Button size="sm" variant={loyaltyProvider === "none" ? "default" : "outline"} className="text-xs h-7" onClick={() => updateTicket({ loyaltyProvider: "none" })}>None</Button>
                  {features.passkit && <Button size="sm" variant={loyaltyProvider === "passkit" ? "default" : "outline"} className="text-xs h-7" onClick={() => updateTicket({ loyaltyProvider: "passkit" })}>PassKit</Button>}
                  {features.piggy && <Button size="sm" variant={loyaltyProvider === "piggy" ? "default" : "outline"} className="text-xs h-7" onClick={() => updateTicket({ loyaltyProvider: "piggy" })}>Piggy</Button>}
                  {features.leat && <Button size="sm" variant={loyaltyProvider === "leat" ? "default" : "outline"} className="text-xs h-7" onClick={() => updateTicket({ loyaltyProvider: "leat" })}>Leat</Button>}
                </div>
                <div className="flex gap-1.5">
                  <Input value={scanValue} onChange={(e) => setScanValue(e.target.value)} placeholder="Scan / search loyalty" className="text-xs h-8"
                    onKeyDown={(e) => e.key === "Enter" && lookupLoyalty()} />
                  <Button variant="outline" size="sm" className="h-8 px-2" onClick={lookupLoyalty}><Search className="h-3.5 w-3.5" /></Button>
                </div>
                {loyaltyCustomer && (
                  <div className="mt-2 p-2 rounded-lg bg-green-50 border border-green-200 text-xs">
                    <div className="font-medium text-green-800">{loyaltyCustomer.name}</div>
                    <div className="text-green-600">{loyaltyCustomer.points} pts · {loyaltyCustomer.visits} visits · {loyaltyCustomer.provider}</div>
                  </div>
                )}
              </div>
            )}
            {/* Cart items */}
            <div className="space-y-2 pb-2">
              {cart.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">Tap a product to start.</div>
              ) : (
                cart.map((item) => {
                  const lineTotal = (item.price + item.modifiers.reduce((m, x) => m + x.price, 0)) * item.qty;
                  return (
                    <div key={item.lineId} className="rounded-xl border p-2.5 bg-white">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{item.name}</div>
                          {item.modifiers.length > 0 && (
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {item.modifiers.map((m) => m.optionName).join(", ")}
                            </div>
                          )}
                          {item.notes && <div className="text-[11px] italic text-muted-foreground mt-0.5">{item.notes}</div>}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-semibold text-sm">{euro(lineTotal)}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <button onClick={() => removeLine(item.lineId)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="h-3 w-3" /></button>
                        <div className="flex items-center gap-1.5">
                          <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(item.lineId, -1)}><Minus className="h-2.5 w-2.5" /></Button>
                          <span className="w-5 text-center text-sm font-medium">{item.qty}</span>
                          <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(item.lineId, 1)}><Plus className="h-2.5 w-2.5" /></Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {/* Discounts */}
            {cart.length > 0 && (
              <div className="rounded-xl border p-3 mb-3">
                <div className="font-medium text-xs flex items-center gap-1.5 mb-2"><Percent className="h-3.5 w-3.5" /> Discount</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {discounts.map((disc) => (
                    <Button key={disc.id} variant={selectedDiscount?.id === disc.id ? "default" : "outline"} size="sm" className="text-[11px] h-7 justify-start"
                      onClick={() => updateTicket({ selectedDiscount: selectedDiscount?.id === disc.id ? null : disc })}>
                      {disc.name} ({disc.value}%)
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* Totals + Pay buttons */}
          <div className="shrink-0 p-4 border-t bg-black text-white rounded-b-2xl">
            <div className="flex justify-between text-xs text-white/60"><span>Subtotal</span><span>{euro(subtotal)}</span></div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-xs text-red-400"><span>Discount ({selectedDiscount?.name})</span><span>-{euro(discountAmount)}</span></div>
            )}
            <Separator className="my-2 bg-white/20" />
            <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{euro(total)}</span></div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <Button className="bg-white text-black hover:bg-white/90 text-xs h-9" onClick={() => openPayment("card")} disabled={cart.length === 0}>
                <CreditCard className="h-3.5 w-3.5 mr-1" /> Card
              </Button>
              <Button className="bg-white text-black hover:bg-white/90 text-xs h-9" onClick={() => openPayment("cash")} disabled={cart.length === 0}>
                <Banknote className="h-3.5 w-3.5 mr-1" /> Cash
              </Button>
              <Button className="bg-white text-black hover:bg-white/90 text-xs h-9" onClick={() => openPayment("qr")} disabled={cart.length === 0}>
                <Smartphone className="h-3.5 w-3.5 mr-1" /> QR
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Modifier picker modal */}
      <Modal open={!!selectedProduct} onClose={() => setSelectedProduct(null)}>
        {selectedProduct && <ModifierPicker product={selectedProduct} onAdd={addLine} onClose={() => setSelectedProduct(null)} />}
      </Modal>

      {/* Payment modal */}
      <PaymentModal open={paymentOpen} onClose={() => setPaymentOpen(false)} total={total} onComplete={handlePaymentComplete} method={paymentMethod} features={features} giftCards={giftCards} onRedeemGiftCard={onRedeemGiftCard} />
    </div>
  );
}

// ─── TABLE VIEW ──────────────────────────────────────────────────────────────
// Table status is now derived from openTickets (single source of truth)

function TableView({ tables, openTickets, reservations, onSelectTable, onCloseTable, onSeatReservation }: any) {
  const [areaFilter, setAreaFilter] = useState("all");
  const areas = ["all", ...Array.from(new Set(tables.map((t: any) => String(t.area))))];
  const filtered = areaFilter === "all" ? tables : tables.filter((t) => t.area === areaFilter);

  function getTableStatus(table) {
    const ticket = openTickets[table.id];
    if (ticket && ticket.cart.length > 0) return "occupied";
    if (ticket) return "occupied";
    const hasReservation = reservations.some((r) => r.table === table.name && r.status === "confirmed");
    if (hasReservation) return "reserved";
    return "free";
  }

  const statusColors = { free: "bg-green-50 border-green-200", occupied: "bg-orange-50 border-orange-200", reserved: "bg-blue-50 border-blue-200" };
  const statusBadge: Record<string, "default" | "outline" | "secondary"> = { free: "outline", occupied: "default", reserved: "secondary" };

  const tableCounts = { free: 0, occupied: 0, reserved: 0 };
  tables.forEach((t) => { tableCounts[getTableStatus(t)]++; });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(areas as string[]).map((a: string) => (
            <Button key={a} variant={areaFilter === a ? "default" : "outline"} size="sm" className="rounded-full capitalize" onClick={() => setAreaFilter(a)}>
              {a === "all" ? "All areas" : a}
            </Button>
          ))}
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-full bg-green-500" /> Free ({tableCounts.free})</span>
          <span className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-full bg-orange-500" /> Occupied ({tableCounts.occupied})</span>
          <span className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Reserved ({tableCounts.reserved})</span>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {filtered.map((table) => {
          const status = getTableStatus(table);
          const ticket = openTickets[table.id];
          const ticketTotal = ticket ? cartSubtotal(ticket.cart) : 0;
          const ticketItems = ticket ? cartItemCount(ticket.cart) : 0;
          return (
            <Card key={table.id} className={clsx("rounded-2xl transition-all hover:shadow-md cursor-pointer", statusColors[status])}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-2xl font-bold">{table.name}</div>
                  <Badge variant={statusBadge[status]} className="capitalize">{status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div className="flex items-center gap-1"><Armchair className="h-3 w-3" /> {table.seats} seats</div>
                  <div className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {table.area}</div>
                  {status === "occupied" && ticketItems > 0 && (
                    <div className="font-medium text-orange-700 mt-1">{ticketItems} items · {euro(ticketTotal)}</div>
                  )}
                </div>
                <div className="flex gap-2 mt-3">
                  {status === "free" && (
                    <Button size="sm" className="flex-1 text-xs" onClick={() => onSelectTable(table.id)}>
                      <Plus className="h-3 w-3 mr-1" /> Open order
                    </Button>
                  )}
                  {status === "occupied" && (
                    <>
                      <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => onSelectTable(table.id)}>
                        <Eye className="h-3 w-3 mr-1" /> View
                      </Button>
                      <Button size="sm" className="flex-1 text-xs" onClick={() => onCloseTable(table.id)}>
                        <Check className="h-3 w-3 mr-1" /> Close
                      </Button>
                    </>
                  )}
                  {status === "reserved" && (
                    <Button size="sm" variant="secondary" className="flex-1 text-xs" onClick={() => onSeatReservation(table)}>
                      <Play className="h-3 w-3 mr-1" /> Seat guests
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

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

function DashboardView({ orders, tables, openTickets }: any) {
  const todayOrders = orders.filter((o) => isToday(o.date));
  const revenue = todayOrders.reduce((s, o) => s + o.total, 0);
  const tips = todayOrders.reduce((s, o) => s + (o.tip || 0), 0);
  const avgTicket = todayOrders.length > 0 ? revenue / todayOrders.length : 0;
  const occupiedTables = tables.filter((t) => !!openTickets[t.id]).length;

  const topProducts: Record<string, number> = {};
  todayOrders.forEach((o: any) => o.items.forEach((item: any) => {
    topProducts[item.name] = (topProducts[item.name] || 0) + item.qty;
  }));
  const topList = Object.entries(topProducts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const paymentBreakdown = { card: 0, cash: 0, qr: 0, giftcard: 0 };
  todayOrders.forEach((o) => { paymentBreakdown[o.method] = (paymentBreakdown[o.method] || 0) + o.total; });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Today's Revenue", value: euro(revenue), icon: DollarSign, sub: `${todayOrders.length} orders`, color: "bg-green-50 text-green-700" },
          { label: "Avg Ticket", value: euro(avgTicket), icon: TrendingUp, sub: "per order", color: "bg-blue-50 text-blue-700" },
          { label: "Tips", value: euro(tips), icon: Sparkles, sub: "total tips", color: "bg-purple-50 text-purple-700" },
          { label: "Tables", value: `${occupiedTables}/${tables.length}`, icon: UtensilsCrossed, sub: "occupied", color: "bg-orange-50 text-orange-700" },
        ].map((stat, i) => (
          <Card key={i} className="rounded-2xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className={clsx("p-2 rounded-xl", stat.color)}><stat.icon className="h-5 w-5" /></div>
              </div>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{stat.label} · {stat.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top products today</CardTitle></CardHeader>
          <CardContent>
            {topList.length === 0 ? <div className="text-sm text-muted-foreground py-4">No sales yet today.</div> : (
              <div className="space-y-2">
                {topList.map(([name, qty], i) => (
                  <div key={name} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                      <span className="text-sm">{name}</span>
                    </div>
                    <Badge variant="secondary">{qty} sold</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Payment breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(paymentBreakdown).filter(([, amount]) => (amount as number) > 0).map(([method, amount]: [string, number]) => (
                <div key={method} className="space-y-1">
                  <div className="flex justify-between text-sm"><span className="capitalize">{method === "giftcard" ? "Gift card" : method}</span><span className="font-medium">{euro(amount as number)}</span></div>
                  <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                    <div className="h-full bg-black rounded-full transition-all" style={{ width: revenue > 0 ? `${((amount as number) / revenue) * 100}%` : "0%" }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Recent orders</CardTitle></CardHeader>
        <CardContent>
          {todayOrders.length === 0 ? <div className="text-sm text-muted-foreground py-4">No orders yet.</div> : (
            <div className="space-y-2">
              {todayOrders.slice(-10).reverse().map((order) => (
                <div key={order.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="text-xs font-mono text-muted-foreground">#{order.id}</div>
                    <div className="text-sm">{order.customerName || "Walk-in"}</div>
                    <Badge variant="outline" className="text-[10px] capitalize">{order.method}</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-muted-foreground">{formatTime(order.date)}</div>
                    <div className="font-semibold text-sm">{euro(order.total)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── ACTIVITY / ORDER HISTORY ────────────────────────────────────────────────

function ActivityView({ orders }: any) {
  const [search, setSearch] = useState("");
  const [receiptOrder, setReceiptOrder] = useState(null);

  const filtered = orders.filter((o) =>
    o.id.toLowerCase().includes(search.toLowerCase()) ||
    (o.customerName || "").toLowerCase().includes(search.toLowerCase())
  ).reverse();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search orders..." className="pl-9" />
        </div>
        <Badge variant="secondary">{orders.length} orders</Badge>
      </div>
      <Card className="rounded-2xl">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">No orders found.</div>
          ) : (
            <div className="divide-y">
              {filtered.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-4 hover:bg-neutral-50 transition cursor-pointer" onClick={() => setReceiptOrder(order)}>
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="font-mono text-sm font-medium">#{order.id}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(order.date)} · {formatTime(order.date)}</div>
                    </div>
                    <div>
                      <div className="text-sm">{order.customerName || "Walk-in"}</div>
                      <div className="text-xs text-muted-foreground">{order.items.length} item{order.items.length !== 1 ? "s" : ""}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="capitalize text-xs">{order.method}</Badge>
                    {order.status === "refunded" && <Badge variant="destructive" className="text-xs">Refunded</Badge>}
                    {order.discountName && <Badge variant="secondary" className="text-xs">{order.discountName}</Badge>}
                    <div className="font-semibold">{euro(order.total)}</div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Modal open={!!receiptOrder} onClose={() => setReceiptOrder(null)}>
        {receiptOrder && <ReceiptPreview order={receiptOrder} onClose={() => setReceiptOrder(null)} />}
      </Modal>
    </div>
  );
}

// ─── RESERVATIONS ────────────────────────────────────────────────────────────

function ReservationsView({ reservations, setReservations, tables }: any) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", date: "", time: "", guests: "2", table: "", phone: "", notes: "" });

  function addReservation() {
    if (!form.name || !form.date || !form.time) return;
    setReservations((prev) => [...prev, { ...form, id: generateId(), guests: parseInt(form.guests) || 2, status: "confirmed" }]);
    setShowAdd(false);
    setForm({ name: "", date: "", time: "", guests: "2", table: "", phone: "", notes: "" });
  }

  function updateStatus(id, status) {
    setReservations((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
  }

  function removeReservation(id) {
    setReservations((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Badge variant="secondary">{reservations.length} reservations</Badge>
        <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-2" />New reservation</Button>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {reservations.map((r) => (
          <Card key={r.id} className="rounded-2xl">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-center min-w-[60px]">
                  <div className="text-lg font-bold">{r.time}</div>
                  <div className="text-xs text-muted-foreground">{r.date}</div>
                </div>
                <Separator orientation="vertical" className="h-10" />
                <div>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.guests} guests · Table {r.table} {r.phone && `· ${r.phone}`}
                  </div>
                  {r.notes && <div className="text-xs italic text-muted-foreground mt-0.5">{r.notes}</div>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={r.status === "confirmed" ? "default" : r.status === "pending" ? "secondary" : "outline"} className="capitalize">{r.status}</Badge>
                {r.status === "pending" && <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "confirmed")}>Confirm</Button>}
                {r.status !== "cancelled" && <Button size="sm" variant="ghost" className="text-red-500" onClick={() => updateStatus(r.id, "cancelled")}><X className="h-3 w-3" /></Button>}
                <Button size="sm" variant="ghost" onClick={() => removeReservation(r.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Modal open={showAdd} onClose={() => setShowAdd(false)}>
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-bold">New reservation</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1" /></div>
            <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="mt-1" /></div>
            <div><Label>Time</Label><Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="mt-1" /></div>
            <div><Label>Guests</Label><Input type="number" value={form.guests} onChange={(e) => setForm({ ...form, guests: e.target.value })} className="mt-1" /></div>
            <div>
              <Label>Table</Label>
              <select value={form.table} onChange={(e) => setForm({ ...form, table: e.target.value })} className="w-full rounded-lg border px-3 py-2 mt-1 bg-white text-sm">
                <option value="">Select table...</option>
                {tables.map((t) => <option key={t.id} value={t.name}>{t.name} · {t.area} · {t.seats} seats</option>)}
              </select>
            </div>
          </div>
          <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1" /></div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={addReservation} disabled={!form.name || !form.date || !form.time}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── PRODUCTS MANAGEMENT ─────────────────────────────────────────────────────

function ProductsView({ products: allProducts, setProducts }: any) {
  const [search, setSearch] = useState("");
  const [filterSection, setFilterSection] = useState("all");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", section: "Hot Drinks", price: "", color: "#94a3b8", tags: "", modifierGroupIds: [] });

  const filtered = allProducts.filter((p) =>
    (filterSection === "all" || p.section === filterSection) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  function openEdit(product) {
    if (product) {
      setEditing(product.id);
      setForm({
        name: product.name,
        section: product.section,
        price: String(product.price),
        color: product.color || "#94a3b8",
        tags: (product.tags || []).join(", "),
        modifierGroupIds: (product.modifierGroups || []).map((g) => g.id),
      });
    } else {
      setEditing("new");
      setForm({ name: "", section: "Hot Drinks", price: "", color: "#94a3b8", tags: "", modifierGroupIds: [] });
    }
  }

  function toggleModifierGroup(groupId) {
    setForm((prev) => {
      const ids = prev.modifierGroupIds;
      return { ...prev, modifierGroupIds: ids.includes(groupId) ? ids.filter((x) => x !== groupId) : [...ids, groupId] };
    });
  }

  function saveProduct() {
    if (!form.name || !form.price) return;
    const modifierGroups = ALL_MODIFIER_GROUPS.filter((g) => form.modifierGroupIds.includes(g.id));
    const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
    if (editing === "new") {
      setProducts((prev) => [...prev, { id: generateId(), name: form.name, section: form.section, price: parseFloat(form.price), tags, modifierGroups, color: form.color }]);
    } else {
      setProducts((prev) => prev.map((p) => p.id === editing ? { ...p, name: form.name, section: form.section, price: parseFloat(form.price), tags, modifierGroups, color: form.color } : p));
    }
    setEditing(null);
  }

  function deleteProduct(id) {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="pl-9" />
        </div>
        <select value={filterSection} onChange={(e) => setFilterSection(e.target.value)} className="rounded-lg border px-3 py-2 text-sm bg-white">
          <option value="all">All sections</option>
          {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <Button onClick={() => openEdit(null)}><Plus className="h-4 w-4 mr-2" />Add product</Button>
      </div>
      <Card className="rounded-2xl">
        <CardContent className="p-0">
          <div className="divide-y">
            {filtered.map((product) => (
              <div key={product.id} className="flex items-center justify-between p-3 hover:bg-neutral-50">
                <div className="flex items-center gap-3">
                  {product.color && <div className="h-8 w-1.5 rounded-full" style={{ backgroundColor: product.color }} />}
                  <div>
                    <div className="font-medium text-sm">{product.name}</div>
                    <div className="text-xs text-muted-foreground">{product.section} · {product.modifierGroups?.length || 0} modifiers · {(product.tags || []).join(", ") || "no tags"}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="font-semibold">{euro(product.price)}</div>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(product)}><Edit className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="sm" className="text-red-500" onClick={() => deleteProduct(product.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Modal open={!!editing} onClose={() => setEditing(null)}>
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-bold">{editing === "new" ? "New product" : "Edit product"}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" /></div>
            <div>
              <Label>Section</Label>
              <select value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} className="w-full rounded-lg border px-3 py-2 mt-1 bg-white text-sm">
                {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><Label>Price</Label><Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="mt-1" /></div>
            <div>
              <Label>Color</Label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-9 w-12 rounded border cursor-pointer" />
                <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="flex-1" />
              </div>
            </div>
            <div><Label>Tags (comma-separated)</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Hot, Coffee, Signature" className="mt-1" /></div>
          </div>
          <div>
            <Label>Modifier groups</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {ALL_MODIFIER_GROUPS.map((g) => (
                <button key={g.id} onClick={() => toggleModifierGroup(g.id)}
                  className={clsx("rounded-xl border px-3 py-2 text-left text-sm transition-all",
                    form.modifierGroupIds.includes(g.id) ? "border-black bg-black text-white" : "bg-white hover:bg-neutral-50")}>
                  <div className="font-medium">{g.name}</div>
                  <div className={clsx("text-xs", form.modifierGroupIds.includes(g.id) ? "text-white/70" : "text-muted-foreground")}>{g.options.length} options</div>
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveProduct} disabled={!form.name || !form.price}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── QR ORDERING ─────────────────────────────────────────────────────────────

function QrView({ features }: any) {
  return (
    <div className="space-y-4">
      <Card className="rounded-2xl">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-lg">QR Table Ordering</h3>
              <p className="text-sm text-muted-foreground">Customers scan a QR code on their table to browse your menu and order from their phone.</p>
            </div>
            <Badge variant={features?.qr ? "default" : "secondary"}>{features?.qr ? "Enabled" : "Disabled"}</Badge>
          </div>
          {!features?.qr && (
            <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800 mb-4">
              QR ordering is disabled. Enable it in Settings → Features.
            </div>
          )}
          <Separator className="my-4" />
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border p-4 text-center">
              <QrCode className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <div className="text-sm font-medium">Generate QR codes</div>
              <div className="text-xs text-muted-foreground mt-1">One per table, links to your digital menu.</div>
              <Button variant="outline" size="sm" className="mt-3 w-full" disabled={!features?.qr}>Generate</Button>
            </div>
            <div className="rounded-xl border p-4 text-center">
              <Smartphone className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <div className="text-sm font-medium">Menu customization</div>
              <div className="text-xs text-muted-foreground mt-1">Set which products appear on the QR menu.</div>
              <Button variant="outline" size="sm" className="mt-3 w-full" disabled={!features?.qr}>Configure</Button>
            </div>
            <div className="rounded-xl border p-4 text-center">
              <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <div className="text-sm font-medium">Order notifications</div>
              <div className="text-xs text-muted-foreground mt-1">Get alerted when QR orders come in.</div>
              <Button variant="outline" size="sm" className="mt-3 w-full" disabled={!features?.qr}>Settings</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── CUSTOMERS ───────────────────────────────────────────────────────────────

function CustomersView({ customers, setCustomers }: any) {
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", provider: "none" });
  const [selected, setSelected] = useState(null);

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || "").toLowerCase().includes(search.toLowerCase())
  );

  function addCustomer() {
    if (!form.name) return;
    setCustomers((prev) => [...prev, { ...form, id: generateId(), loyaltyId: form.provider !== "none" ? `LYL-${generateId().toUpperCase().slice(0, 3)}` : "", points: 0, visits: 0, totalSpent: 0, lastVisit: "-" }]);
    setShowAdd(false);
    setForm({ name: "", email: "", phone: "", provider: "none" });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers..." className="pl-9" />
        </div>
        <Badge variant="secondary">{customers.length} customers</Badge>
        <Button onClick={() => setShowAdd(true)}><UserPlus className="h-4 w-4 mr-2" />Add customer</Button>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {filtered.map((c) => (
          <Card key={c.id} className="rounded-2xl cursor-pointer hover:shadow-md transition" onClick={() => setSelected(c)}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-neutral-200 flex items-center justify-center font-bold text-sm">
                  {c.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.email || "No email"} · {c.phone || "No phone"}</div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                {c.loyaltyId && <Badge variant="outline" className="text-xs">{c.provider}</Badge>}
                <div className="text-right">
                  <div className="font-medium">{c.points} pts</div>
                  <div className="text-xs text-muted-foreground">{c.visits} visits · {euro(c.totalSpent)}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Modal open={showAdd} onClose={() => setShowAdd(false)}>
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-bold">New customer</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1" /></div>
            <div>
              <Label>Loyalty provider</Label>
              <select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} className="w-full rounded-lg border px-3 py-2 mt-1 bg-white text-sm">
                <option value="none">None</option>
                <option value="passkit">PassKit</option>
                <option value="piggy">Piggy</option>
                <option value="leat">Leat</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={addCustomer} disabled={!form.name}>Save</Button>
          </div>
        </div>
      </Modal>
      <Modal open={!!selected} onClose={() => setSelected(null)}>
        {selected && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-neutral-200 flex items-center justify-center font-bold">{selected.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</div>
                <div>
                  <h2 className="text-lg font-bold">{selected.name}</h2>
                  <div className="text-sm text-muted-foreground">{selected.email || "No email"}</div>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 hover:bg-neutral-100 rounded-full"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="rounded-xl bg-neutral-50 p-3 text-center"><div className="text-xl font-bold">{selected.points}</div><div className="text-xs text-muted-foreground">Points</div></div>
              <div className="rounded-xl bg-neutral-50 p-3 text-center"><div className="text-xl font-bold">{selected.visits}</div><div className="text-xs text-muted-foreground">Visits</div></div>
              <div className="rounded-xl bg-neutral-50 p-3 text-center"><div className="text-xl font-bold">{euro(selected.totalSpent)}</div><div className="text-xs text-muted-foreground">Spent</div></div>
              <div className="rounded-xl bg-neutral-50 p-3 text-center"><div className="text-xl font-bold">{selected.lastVisit}</div><div className="text-xs text-muted-foreground">Last visit</div></div>
            </div>
            {selected.loyaltyId && (
              <div className="rounded-xl border p-3">
                <div className="text-sm font-medium mb-1">Loyalty</div>
                <div className="text-xs text-muted-foreground">Provider: <span className="capitalize">{selected.provider}</span> · ID: {selected.loyaltyId}</div>
              </div>
            )}
            <div className="text-xs text-muted-foreground">{selected.phone || "No phone"}</div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── GIFT CARDS ──────────────────────────────────────────────────────────────

function GiftCardsView({ giftCards, setGiftCards }: any) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ customerName: "", value: "25" });

  function issueCard() {
    if (!form.customerName || !form.value) return;
    const code = `SAAK-2026-${generateId().toUpperCase().slice(0, 4)}`;
    const value = parseFloat(form.value);
    setGiftCards((prev) => [...prev, { id: generateId(), code, balance: value, initialValue: value, status: "active", issuedAt: new Date().toISOString().slice(0, 10), customerName: form.customerName }]);
    setShowAdd(false);
    setForm({ customerName: "", value: "25" });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="secondary">{giftCards.length} gift cards</Badge>
        <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-2" />Issue card</Button>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {giftCards.map((gc) => (
          <Card key={gc.id} className="rounded-2xl">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Gift className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="font-mono font-medium text-sm">{gc.code}</div>
                  <div className="text-xs text-muted-foreground">{gc.customerName} · Issued {gc.issuedAt}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Badge variant={gc.status === "active" ? "default" : "secondary"} className="capitalize">{gc.status}</Badge>
                <div className="text-right">
                  <div className="font-semibold">{euro(gc.balance)}</div>
                  <div className="text-xs text-muted-foreground">of {euro(gc.initialValue)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Modal open={showAdd} onClose={() => setShowAdd(false)}>
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-bold">Issue gift card</h2>
          <div><Label>Recipient name</Label><Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} className="mt-1" /></div>
          <div>
            <Label>Value</Label>
            <div className="grid grid-cols-4 gap-2 mt-1">
              {["10", "15", "25", "50"].map((v) => (
                <Button key={v} variant={form.value === v ? "default" : "outline"} onClick={() => setForm({ ...form, value: v })}>{euro(parseFloat(v))}</Button>
              ))}
            </div>
            <Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="Custom amount" className="mt-2" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={issueCard} disabled={!form.customerName || !form.value}>Issue card</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── SALES ───────────────────────────────────────────────────────────────────
// Now uses live products prop instead of stale initialProducts

function SalesView({ orders, products }: any) {
  const today = new Date();
  const todayOrders = orders.filter((o) => o.date.toDateString() === today.toDateString());
  const revenue = todayOrders.reduce((s, o) => s + o.total, 0);
  const itemsSold = todayOrders.reduce((s, o) => s + o.items.reduce((a, i) => a + i.qty, 0), 0);
  const avgDiscount = todayOrders.length > 0 ? todayOrders.reduce((s, o) => s + o.discount, 0) / todayOrders.length : 0;

  const bySection: Record<string, number> = {};
  todayOrders.forEach((o: any) => o.items.forEach((item: any) => {
    const product = products.find((p: any) => p.id === item.productId);
    const sec = product?.section || "Other";
    bySection[sec] = (bySection[sec] || 0) + (item.price + item.modifiers.reduce((s: number, m: any) => s + m.price, 0)) * item.qty;
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <Card className="rounded-2xl"><CardContent className="p-4"><div className="text-sm text-muted-foreground">Revenue</div><div className="text-2xl font-bold">{euro(revenue)}</div></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-4"><div className="text-sm text-muted-foreground">Orders</div><div className="text-2xl font-bold">{todayOrders.length}</div></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-4"><div className="text-sm text-muted-foreground">Items sold</div><div className="text-2xl font-bold">{itemsSold}</div></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-4"><div className="text-sm text-muted-foreground">Avg discount</div><div className="text-2xl font-bold">{euro(avgDiscount)}</div></CardContent></Card>
      </div>
      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-sm">Revenue by section</CardTitle></CardHeader>
        <CardContent>
          {Object.keys(bySection).length === 0 ? <div className="text-sm text-muted-foreground py-4">No sales data yet.</div> : (
            <div className="space-y-3">
              {Object.entries(bySection).sort((a, b) => b[1] - a[1]).map(([section, amount]) => (
                <div key={section} className="space-y-1">
                  <div className="flex justify-between text-sm"><span>{section}</span><span className="font-medium">{euro(amount)}</span></div>
                  <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                    <div className="h-full bg-black rounded-full" style={{ width: revenue > 0 ? `${(amount / revenue) * 100}%` : "0%" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── ACCOUNTING ──────────────────────────────────────────────────────────────

function AccountingView({ orders }: any) {
  const today = new Date();
  const todayOrders = orders.filter((o) => o.date.toDateString() === today.toDateString());
  const grossRevenue = todayOrders.reduce((s, o) => s + o.subtotal, 0);
  const totalDiscounts = todayOrders.reduce((s, o) => s + o.discount, 0);
  const totalGiftCard = todayOrders.reduce((s, o) => s + (o.giftCardDeduction || 0), 0);
  const netRevenue = todayOrders.reduce((s, o) => s + o.total, 0);
  const totalTips = todayOrders.reduce((s, o) => s + (o.tip || 0), 0);
  const btw21 = netRevenue * 0.21 / 1.21;

  const byMethod = { card: 0, cash: 0, qr: 0, giftcard: 0 };
  todayOrders.forEach((o) => { byMethod[o.method] = (byMethod[o.method] || 0) + o.total; });

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-sm">Daily summary</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-md">
            {[
              { label: "Gross revenue", value: euro(grossRevenue) },
              { label: "Discounts given", value: `-${euro(totalDiscounts)}`, className: "text-red-600" },
              { label: "Gift card redemptions", value: `-${euro(totalGiftCard)}`, className: "text-purple-600" },
              { label: "Net revenue (incl. BTW)", value: euro(netRevenue), className: "font-bold" },
              { label: "BTW 21% (estimated)", value: euro(btw21) },
              { label: "Tips collected", value: euro(totalTips), className: "text-green-600" },
              { label: "Total cash in", value: euro(netRevenue + totalTips), className: "font-bold text-lg" },
            ].map((row, i) => (
              <div key={i} className={clsx("flex justify-between py-1.5", row.className)}>
                <span className="text-sm">{row.label}</span>
                <span className="text-sm">{row.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-sm">By payment method</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-md">
            {Object.entries(byMethod).filter(([, v]) => (v as number) > 0).map(([method, amount]: [string, number]) => (
              <div key={method} className="flex justify-between py-1.5 text-sm">
                <span className="capitalize">{method === "giftcard" ? "Gift card" : method}</span>
                <span className="font-medium">{euro(amount)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-sm">Export</CardTitle></CardHeader>
        <CardContent className="flex gap-3">
          <Button variant="outline"><FileText className="h-4 w-4 mr-2" />Export CSV</Button>
          <Button variant="outline"><FileText className="h-4 w-4 mr-2" />Export PDF</Button>
          <Button variant="outline"><Zap className="h-4 w-4 mr-2" />Send to bookkeeper</Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── SETTINGS ────────────────────────────────────────────────────────────────

function SettingsView({ features, setFeatures }: any) {
  return (
    <div className="space-y-4 max-w-2xl">
      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-sm">General</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between"><div><Label>Business name</Label><div className="text-xs text-muted-foreground">Shown on receipts</div></div><Input defaultValue="Saakouk" className="max-w-[200px]" /></div>
          <Separator />
          <div className="flex items-center justify-between"><div><Label>Currency</Label><div className="text-xs text-muted-foreground">All prices display in this currency</div></div><Input defaultValue="EUR" className="max-w-[100px]" disabled /></div>
          <Separator />
          <div className="flex items-center justify-between"><div><Label>BTW rate</Label><div className="text-xs text-muted-foreground">Dutch standard VAT</div></div><Input defaultValue="21%" className="max-w-[100px]" disabled /></div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-sm">Features</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: "tips", label: "Terminal tipping", desc: "Ask customers for tip on terminal" },
            { key: "passkit", label: "PassKit loyalty", desc: "Apple/Google Wallet passes" },
            { key: "piggy", label: "Piggy integration", desc: "CRM + loyalty + campaigns" },
            { key: "leat", label: "Leat integration", desc: "Order sync + automations" },
            { key: "qr", label: "QR ordering", desc: "Customers order from their phone" },
            { key: "kitchen", label: "Kitchen display", desc: "Send orders to kitchen screen" },
          ].map((feat) => (
            <div key={feat.key} className="flex items-center justify-between py-1">
              <div>
                <Label>{feat.label}</Label>
                <div className="text-xs text-muted-foreground">{feat.desc}</div>
              </div>
              <Switch checked={features[feat.key] ?? false} onCheckedChange={(v) => setFeatures((prev) => ({ ...prev, [feat.key]: v }))} />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-sm">Roles</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {["Owner", "Manager", "Cashier", "Barista"].map((role) => (
              <div key={role} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-muted-foreground" />{role}</div>
                <Button variant="ghost" size="sm">Configure</Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-sm">Printers &amp; Hardware</CardTitle></CardHeader>
        <CardContent className="flex gap-3">
          <Button variant="outline"><Printer className="h-4 w-4 mr-2" />Receipt printer</Button>
          <Button variant="outline"><ChefHat className="h-4 w-4 mr-2" />Kitchen printer</Button>
          <Button variant="outline"><CreditCard className="h-4 w-4 mr-2" />Payment terminal</Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
// State model:
// - openTickets: { [tableId | "walk-in"]: ticket } — persists across nav
// - activeTicketId: which ticket is currently being edited in POS
// - Table status derived from openTickets (no separate status field)
// - Orders linked by customerId

export default function SaakoukPOS() {
  const [active, setActive] = useState("dashboard");
  const [products, setProducts] = useState(initialProducts);
  const [tables] = useState(initialTables);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState(initialCustomers);
  const [giftCards, setGiftCards] = useState(initialGiftCards);
  const [reservations, setReservations] = useState(initialReservations);
  const [toast, setToast] = useState("");
  const [features, setFeatures] = useState({
    tips: true, passkit: true, piggy: true, leat: true, qr: true, kitchen: false,
  });

  // Lifted cart state: open tickets keyed by table id or "walk-in"
  const [openTickets, setOpenTickets] = useState({});
  const [activeTicketId, setActiveTicketId] = useState("walk-in");

  // Get or create the active ticket
  const activeTicket = openTickets[activeTicketId] || emptyTicket(activeTicketId);

  function setActiveTicket(updaterOrValue) {
    setOpenTickets((prev) => {
      const current = prev[activeTicketId] || emptyTicket(activeTicketId);
      const next = typeof updaterOrValue === "function" ? updaterOrValue(current) : updaterOrValue;
      return { ...prev, [activeTicketId]: next };
    });
  }

  function handleSelectTable(tableId) {
    // Create ticket for table if it doesn't exist
    setOpenTickets((prev) => {
      if (!prev[tableId]) return { ...prev, [tableId]: emptyTicket(tableId) };
      return prev;
    });
    setActiveTicketId(tableId);
    setActive("pos");
  }

  function handleCloseTable(tableId) {
    setOpenTickets((prev) => {
      const next = { ...prev };
      delete next[tableId];
      return next;
    });
    if (activeTicketId === tableId) setActiveTicketId("walk-in");
  }

  function handleSeatReservation(table) {
    // Find matching reservation and mark as seated
    setReservations((prev) => prev.map((r) =>
      r.table === table.name && r.status === "confirmed" ? { ...r, status: "seated" } : r
    ));
    handleSelectTable(table.id);
  }

  function handleRedeemGiftCard(giftCardId, amount) {
    setGiftCards((prev) => prev.map((gc) => {
      if (gc.id !== giftCardId) return gc;
      const newBalance = Math.max(0, gc.balance - amount);
      return { ...gc, balance: newBalance, status: newBalance === 0 ? "redeemed" : "active" };
    }));
  }

  function handleOrderComplete(order) {
    setOrders((prev) => [...prev, order]);

    // Update customer stats by ID
    if (order.customerId) {
      setCustomers((prev) => prev.map((c) =>
        c.id === order.customerId
          ? { ...c, visits: c.visits + 1, totalSpent: c.totalSpent + order.total, lastVisit: formatDate(order.date), points: c.points + Math.floor(order.total) }
          : c
      ));
    }

    // Clean up table ticket
    if (order.table) {
      setOpenTickets((prev) => {
        const next = { ...prev };
        delete next[order.table];
        return next;
      });
    } else {
      // Reset walk-in ticket
      setOpenTickets((prev) => {
        const next = { ...prev };
        delete next["walk-in"];
        return next;
      });
    }

    setToast(`Order #${order.id} completed — ${euro(order.total)}`);
  }

  // Today's orders for top bar
  const todayOrders = orders.filter((o) => isToday(o.date));
  const todayRevenue = todayOrders.reduce((s, o) => s + o.total, 0);

  const titles = {
    dashboard: "Dashboard",
    pos: "Point of Sale",
    activity: "Order History",
    reservations: "Reservations",
    products: "Products",
    qr: "QR Ordering",
    customers: "Customers",
    giftcards: "Gift Cards",
    sales: "Sales Reports",
    accounting: "Accounting",
    settings: "Settings",
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-950 flex">
      <Sidebar active={active} setActive={setActive} />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="shrink-0 border-b bg-white px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">{titles[active] || "Saakouk"}</h1>
            <div className="text-xs text-muted-foreground">{formatDate(new Date())} · {formatTime(new Date())}</div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline">{todayOrders.length} orders today</Badge>
            <Badge variant="secondary">{euro(todayRevenue)} revenue</Badge>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-[1600px] mx-auto">
            {active === "dashboard" && <DashboardView orders={orders} tables={tables} openTickets={openTickets} />}
            {active === "pos" && (
              <Tabs defaultValue="counter" className="space-y-4">
                <TabsList className="rounded-xl">
                  <TabsTrigger value="counter">Counter</TabsTrigger>
                  <TabsTrigger value="table">Tables</TabsTrigger>
                </TabsList>
                <TabsContent value="counter">
                  <CounterView
                    products={products}
                    tables={tables}
                    features={features}
                    customers={customers}
                    giftCards={giftCards}
                    onRedeemGiftCard={handleRedeemGiftCard}
                    ticket={activeTicket}
                    setTicket={setActiveTicket}
                    onOrderComplete={handleOrderComplete}
                  />
                </TabsContent>
                <TabsContent value="table">
                  <TableView
                    tables={tables}
                    openTickets={openTickets}
                    reservations={reservations}
                    onSelectTable={handleSelectTable}
                    onCloseTable={handleCloseTable}
                    onSeatReservation={handleSeatReservation}
                  />
                </TabsContent>
              </Tabs>
            )}
            {active === "activity" && <ActivityView orders={orders} />}
            {active === "reservations" && <ReservationsView reservations={reservations} setReservations={setReservations} tables={tables} />}
            {active === "products" && <ProductsView products={products} setProducts={setProducts} />}
            {active === "qr" && <QrView features={features} />}
            {active === "customers" && <CustomersView customers={customers} setCustomers={setCustomers} />}
            {active === "giftcards" && <GiftCardsView giftCards={giftCards} setGiftCards={setGiftCards} />}
            {active === "sales" && <SalesView orders={orders} products={products} />}
            {active === "accounting" && <AccountingView orders={orders} />}
            {active === "settings" && <SettingsView features={features} setFeatures={setFeatures} />}
          </div>
        </div>
      </main>
      <Toast message={toast} onClose={() => setToast("")} />
    </div>
  );
}
