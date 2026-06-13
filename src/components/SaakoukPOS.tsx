import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { DayPicker } from "react-day-picker";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation_ } from "@/contexts/LocationContext";
import { getMember as passkitGetMember, earnPoints as passkitEarnPoints, enrolMember as passkitEnrolMember } from "@/lib/passkit";
import { InventoryView, RecipeBuilderView, StockIntakeView, MonthlyCountView, CostingView, DynamicStockView, WasteLoggingView, deductStockForOrder, restoreStockForRefund } from "@/components/InventoryViews";
import { useModifiers } from "@/hooks/useModifiers";
import { useLiveData } from "@/hooks/useLiveData";
import ModifiersView from "@/components/ModifiersView";
import UpsellPrompt from "@/components/UpsellPrompt";
import { useUpsellEngine, UpsellSuggestion } from "@/hooks/useUpsell";
import UpsellRulesView from "@/components/UpsellRulesView";
import { useRolePermissions, VIEW_PERMISSION_MAP } from "@/hooks/useRolePermissions";
import { AIForecastCenter } from "@/components/AIForecastCenter";
import MultiLocationDashboard from "@/components/MultiLocationDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  LayoutDashboard, Activity, CalendarDays, Package, QrCode, Users, Gift, Receipt,
  Calculator, Settings, ShoppingCart, Plus, Minus, Trash2, CreditCard,
  Sparkles, Wallet, Percent, Search, Smartphone, X, Check,
  ChefHat, Printer, Edit, Eye, DollarSign, TrendingUp,
  UserPlus, MapPin, FileText, Mail, Lock,
  Shield, Zap, Bell, LogOut, Star,
  ChevronRight, ChevronLeft, Banknote, Building2,
  UtensilsCrossed, Armchair, Play, UserCog, Clock,
  ClipboardCheck, BarChart3, Loader2,
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

const SECTION_COLORS: Record<string, string> = {
  "Signature Drinks": "#a3e635",
  "Specials": "#60a5fa",
  "Cold Drinks": "#34d399",
  "Hot Drinks": "#d4a574",
  "Sweets": "#fbbf24",
};

// ─── PRODUCT & MODIFIER CONFIG ───────────────────────────────────────────────
// All products and modifier groups are now managed via the database.
// No hardcoded data — start fresh from the Modifiers tab, then add products.

// All domain data (products, modifiers, customers, gift cards, tables, zones,
// reservations, discounts, VAT rates, activity logs, settings) is loaded from
// the database via useLiveData / dedicated effects. No hardcoded seeds remain.
const ALL_MODIFIER_GROUPS: any[] = [];
// Delivery channels are static UI metadata (icons/labels), not business data.
const DELIVERY_CHANNELS = [
  { id: "afhaal", name: "Afhaal", icon: "🛍️" },
  { id: "uber-eats", name: "Uber Eats", icon: "🚗" },
  { id: "thuisbezorgd", name: "Thuisbezorgd", icon: "🛵" },
];

// ─── EMPLOYEES (loaded from database) ────────────────────────────────────────
// No more hardcoded employee list — employees are fetched from the database

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
  return { tableId, cart: [], selectedDiscount: null, customerId: null, customerName: "", loyaltyProvider: "passkit", loyaltyCustomer: null };
}

function cartSubtotal(cart: any[]) {
  return cart.reduce((sum, item) => sum + (item.price + item.modifiers.reduce((m, x) => m + x.price, 0)) * item.qty, 0);
}

function cartItemCount(cart: any[]) {
  return cart.reduce((s, i) => s + i.qty, 0);
}

// ─── DISCOUNT PANEL (collapsible) ────────────────────────────────────────────

function DiscountPanel({ discounts, selectedDiscount, updateTicket }: { discounts: any[]; selectedDiscount: any; updateTicket: (u: any) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border p-3 mb-3">
      <button onClick={() => setOpen(!open)} className="w-full font-medium text-xs flex items-center gap-1.5 justify-between min-h-[44px]">
        <span className="flex items-center gap-1.5">
          <Percent className="h-3.5 w-3.5" /> Discount
          {selectedDiscount && <Badge variant="secondary" className="text-[10px] ml-1">{selectedDiscount.name}</Badge>}
        </span>
        <ChevronRight className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-1.5 mt-2">
          {discounts.map((disc) => (
            <Button key={disc.id} variant={selectedDiscount?.id === disc.id ? "default" : "outline"} size="sm" className="text-xs h-10 min-h-[44px] justify-start"
              onClick={() => updateTicket({ selectedDiscount: selectedDiscount?.id === disc.id ? null : disc })}>
              {disc.name} ({disc.value}%)
            </Button>
          ))}
        </div>
      )}
    </div>
  );
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

function Sidebar({ active, setActive, role, onLogout, employeeName, locations, activeLocation, onLocationChange, isPlatformAdmin, allTenants, selectedTenantId, onSelectTenant, tenantUnlocked, onUnlockTenant, onClearTenant, canAccessView }: { active: string; setActive: (k: string) => void; role: string; onLogout: () => void; employeeName: string; locations: any[]; activeLocation: any; onLocationChange: (id: string) => void; isPlatformAdmin?: boolean; allTenants?: any[]; selectedTenantId?: string | null; onSelectTenant?: (id: string) => void; tenantUnlocked?: boolean; onUnlockTenant?: (pin: string) => Promise<boolean>; onClearTenant?: () => void; canAccessView: (k: string) => boolean }) {
  const isAdmin = role === "owner" || role === "manager";
  const isOwner = role === "owner";
  const [tenantPinInput, setTenantPinInput] = React.useState("");
  const [tenantPinError, setTenantPinError] = React.useState(false);
  const [pendingTenantId, setPendingTenantId] = React.useState<string | null>(null);
  const allSections = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: false, ownerOnly: true },
    { key: "multilocatie", label: "Locaties", icon: Building2, adminOnly: false, ownerOnly: true },
    { key: "pos", label: "POS", icon: ShoppingCart, adminOnly: false, ownerOnly: false },
    { key: "prepstation", label: "Prep", icon: ChefHat, adminOnly: false, ownerOnly: false },
    { key: "cashclose", label: "Kassa", icon: Lock, adminOnly: false, ownerOnly: false },
    { key: "reservations", label: "Reservations", icon: CalendarDays, adminOnly: false, ownerOnly: false },
    { key: "products", label: "Products", icon: Package, adminOnly: false, ownerOnly: false },
    { key: "inventory", label: "Voorraad", icon: Package, adminOnly: false, ownerOnly: false },
    { key: "costing", label: "Marges", icon: DollarSign, adminOnly: false, ownerOnly: true },
    { key: "qr", label: "QR Ordering", icon: QrCode, adminOnly: true, ownerOnly: false },
    { key: "customers", label: "Customers", icon: Users, adminOnly: false, ownerOnly: false },
    { key: "giftcards", label: "Gift cards", icon: Gift, adminOnly: false, ownerOnly: false },
    { key: "verkoop", label: "Verkoop", icon: Receipt, adminOnly: true, ownerOnly: true },
    { key: "logs", label: "Logs", icon: FileText, adminOnly: false, ownerOnly: true },
    { key: "employees", label: "Team", icon: UserCog, adminOnly: true, ownerOnly: false },
    { key: "settings", label: "Settings", icon: Settings, adminOnly: true, ownerOnly: false },
  ];
  const sections = allSections.filter((s) => {
    if (s.ownerOnly && !isOwner) return false;
    if (s.adminOnly && !isAdmin) return false;
    // A6: also enforce per-permission gate from role_permissions
    if (!canAccessView(s.key)) return false;
    return true;
  });
  return (
    <div className="w-[72px] flex flex-col shrink-0 relative z-20">
      {/* Glass sidebar background */}
      <div className="absolute inset-0 bg-white/60 backdrop-blur-2xl border-r border-white/70 shadow-[4px_0_40px_rgba(162,178,226,0.10)]" />
      <div className="relative z-10 flex flex-col h-full">
        <div className="py-3 px-2 border-b border-white/50 flex flex-col items-center gap-0.5">
          <motion.div
            whileHover={{ scale: 1.08, rotate: -4 }}
            className="w-9 h-9 rounded-full bg-[radial-gradient(circle_at_30%_30%,#ffffff,#f1ecff_45%,#ddd6fe_72%,#fbcfe8_100%)] border border-white/80 flex items-center justify-center text-xs font-bold text-slate-700 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),0_8px_24px_rgba(172,155,255,0.18)]"
          >
            {employeeName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
          </motion.div>
          <span className="text-[8px] text-slate-500 truncate w-full text-center">{employeeName.split(" ")[0]}</span>
        </div>
        {/* Platform admin: Tenant selector with PIN gate */}
        {isPlatformAdmin && allTenants && allTenants.length > 0 && (
          <div className="px-1.5 py-1.5 border-b border-white/50">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[7px] text-violet-500 font-semibold uppercase tracking-wider">Tenant</span>
              {pendingTenantId && !tenantUnlocked ? (
                <div className="flex flex-col items-center gap-1 w-full">
                  <span className="text-[7px] text-slate-500">PIN bevestigen</span>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={tenantPinInput}
                    onChange={(e) => { setTenantPinInput(e.target.value.replace(/\D/g, "")); setTenantPinError(false); }}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" && tenantPinInput.length === 6 && onUnlockTenant) {
                        const ok = await onUnlockTenant(tenantPinInput);
                        if (ok && onSelectTenant && pendingTenantId) {
                          onSelectTenant(pendingTenantId);
                          setPendingTenantId(null);
                          setTenantPinInput("");
                        } else {
                          setTenantPinError(true);
                          setTenantPinInput("");
                        }
                      }
                    }}
                    className={`w-full text-[10px] bg-white/60 border ${tenantPinError ? "border-red-400" : "border-violet-200"} rounded-lg px-1 py-1 text-center font-mono tracking-[0.3em]`}
                    placeholder="••••••"
                    autoFocus
                  />
                  <button onClick={() => { setPendingTenantId(null); setTenantPinInput(""); }} className="text-[7px] text-slate-400 hover:text-slate-600">Annuleer</button>
                </div>
              ) : (
                <>
                  <select
                    value={selectedTenantId || ""}
                    onChange={(e) => {
                      const tid = e.target.value;
                      if (!tid) {
                        onClearTenant?.();
                        return;
                      }
                      if (tenantUnlocked) {
                        onSelectTenant?.(tid);
                      } else {
                        setPendingTenantId(tid);
                        setTenantPinInput("");
                        setTenantPinError(false);
                      }
                    }}
                    className="w-full text-[8px] bg-violet-50/80 border border-violet-200/70 rounded-xl px-1 py-1.5 text-center font-medium text-violet-700 truncate appearance-none cursor-pointer"
                    title="Selecteer tenant"
                  >
                    <option value="">— Kies tenant —</option>
                    {allTenants.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name} {!t.is_active ? "(inactief)" : ""}</option>
                    ))}
                  </select>
                  {selectedTenantId && (
                    <button onClick={() => onClearTenant?.()} className="text-[7px] text-violet-400 hover:text-violet-600 flex items-center gap-0.5">
                      <X className="h-2.5 w-2.5" /> Reset
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
        {/* Location selector (owner sees dropdown, staff sees label) */}
        {activeLocation && (
          <div className="px-1.5 py-1.5 border-b border-white/50">
            {role === "owner" && locations.length > 1 ? (
              <select
                value={activeLocation.id}
                onChange={(e) => onLocationChange(e.target.value)}
                className="w-full text-[8px] bg-white/60 border border-white/70 rounded-xl px-1 py-1.5 text-center font-medium text-slate-700 truncate appearance-none cursor-pointer"
                title="Selecteer locatie"
              >
                {locations.map((l: any) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            ) : (
              <div className="flex flex-col items-center gap-0.5" title={activeLocation.name}>
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-[7px] text-slate-500 truncate w-full text-center leading-tight">{activeLocation.city || activeLocation.name}</span>
              </div>
            )}
          </div>
        )}
        <ScrollArea className="flex-1 py-2 px-1.5">
          <div className="space-y-1 flex flex-col items-center">
            {sections.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.key;
              return (
                <motion.button
                  key={item.key}
                  onClick={() => setActive(item.key)}
                  title={item.label}
                  whileHover={{ scale: 1.06, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className={clsx(
                    "w-12 h-12 min-w-[44px] min-h-[44px] flex flex-col items-center justify-center rounded-2xl text-[10px] leading-tight transition-all gap-0.5",
                    isActive
                      ? "bg-[linear-gradient(135deg,rgba(196,181,253,0.6),rgba(255,192,230,0.5),rgba(191,219,254,0.5))] text-slate-800 font-medium shadow-[0_8px_30px_rgba(172,155,255,0.22)] border border-white/70"
                      : "hover:bg-white/50 text-slate-500"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="truncate w-full text-center">{item.label.length > 6 ? item.label.slice(0, 5) + "." : item.label}</span>
                </motion.button>
              );
            })}
          </div>
        </ScrollArea>
        <div className="p-1.5 border-t border-white/50 flex justify-center">
          <motion.button
            title="Log out"
            onClick={onLogout}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            className="w-12 h-12 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-2xl text-red-400 hover:bg-red-50/60 transition"
          >
            <LogOut className="h-5 w-5" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}

// ─── PRODUCT BUTTON ──────────────────────────────────────────────────────────

function ProductButton({ product, onClick }: { product: any; onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      className="rounded-[22px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(247,249,255,0.88))] p-3 text-left shadow-[0_14px_40px_rgba(163,177,219,0.12)] backdrop-blur-xl active:scale-[0.97] transition-all h-full flex flex-col justify-between touch-manipulation min-h-[72px] group"
    >
      <div>
        <div className="flex items-start justify-between gap-1.5">
          <div className="font-semibold text-[13px] leading-tight text-slate-900">{product.name}</div>
          <span className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/70 border border-white/80 text-slate-600 shadow-[0_4px_12px_rgba(162,178,226,0.10)]">{euro(product.price)}</span>
        </div>
        {product.modifierGroups?.length > 0 && (
          <div className="text-[10px] text-slate-500 mt-0.5">{product.modifierGroups.length} mod{product.modifierGroups.length > 1 ? "s" : ""}</div>
        )}
      </div>
      {product.color && <div className="w-full h-1 rounded-full mt-1.5 opacity-70 group-hover:opacity-100 transition" style={{ backgroundColor: product.color }} />}
    </motion.button>
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
      costPrice: product.costPrice || 0,
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

// ─── PAYMENT MODAL (with split payments) ─────────────────────────────────────

type SplitPart = { method: "card" | "cash" | "qr" | "giftcard"; amount: number; paid: boolean; cashGiven?: number; giftCardId?: string; giftCardCode?: string };

function PaymentModal({ open, onClose, total, onComplete, method: initialMethod, features, giftCards, onRedeemGiftCard }: any) {
  const [mode, setMode] = useState<"single" | "split-method" | "split-person">("single");
  // Single mode state
  const [method, setMethod] = useState(initialMethod || "card");
  const [cashGiven, setCashGiven] = useState("");
  const [step, setStep] = useState("choose");
  const [tipPercent, setTipPercent] = useState(0);
  const [giftCardCode, setGiftCardCode] = useState("");
  const [giftCardApplied, setGiftCardApplied] = useState<any>(null);
  const [processing, setProcessing] = useState(false);

  // Split mode state
  const [splitParts, setSplitParts] = useState<SplitPart[]>([]);
  const [splitPersonCount, setSplitPersonCount] = useState(2);
  const [activeSplitIdx, setActiveSplitIdx] = useState(0);
  const [splitCashGiven, setSplitCashGiven] = useState("");
  const [splitGiftCode, setSplitGiftCode] = useState("");
  const [splitStep, setSplitStep] = useState<"setup" | "paying" | "processing" | "done">("setup");

  useEffect(() => {
    if (open) {
      setStep("choose"); setCashGiven(""); setTipPercent(0); setMethod(initialMethod || "card");
      setGiftCardCode(""); setGiftCardApplied(null); setProcessing(false); setMode("single");
      setSplitParts([]); setSplitPersonCount(2); setActiveSplitIdx(0); setSplitStep("setup");
      setSplitCashGiven(""); setSplitGiftCode("");
    }
  }, [open, initialMethod]);

  const tipAmount = features?.tips ? total * (tipPercent / 100) : 0;
  const giftCardDeduction = giftCardApplied ? Math.min(giftCardApplied.balance, total + tipAmount) : 0;
  const grandTotal = Math.max(0, total + tipAmount - giftCardDeduction);
  const cashChange = cashGiven ? Math.max(0, parseFloat(cashGiven) - grandTotal) : 0;

  function lookupGiftCard() {
    if (!giftCardCode.trim()) return;
    const found = giftCards?.find((gc: any) => gc.code.toLowerCase() === giftCardCode.toLowerCase() && gc.status === "active" && gc.balance > 0);
    setGiftCardApplied(found || null);
  }

  function processPayment() {
    if (processing) return;
    setProcessing(true); setStep("processing");
    setTimeout(() => { setStep("done"); setProcessing(false); }, 1500);
  }

  function finish() {
    if (giftCardApplied && giftCardDeduction > 0) onRedeemGiftCard?.(giftCardApplied.id, giftCardDeduction);
    onComplete({ method: giftCardDeduction >= total + tipAmount ? "giftcard" : method, total: total + tipAmount, tip: tipAmount, giftCardDeduction, giftCardId: giftCardApplied?.id || null });
    onClose();
  }

  // ── Split by method: user adds payment parts that sum to total ──
  function initSplitMethod() {
    setMode("split-method");
    const totalWithTip = total + tipAmount;
    setSplitParts([{ method: "card", amount: Math.round(totalWithTip * 100) / 100, paid: false }]);
    setSplitStep("paying"); setActiveSplitIdx(0);
  }

  function initSplitPerson() {
    setMode("split-person");
    setSplitStep("setup");
  }

  function confirmSplitPersonSetup() {
    const totalWithTip = total + tipAmount;
    const perPerson = Math.floor(totalWithTip * 100 / splitPersonCount) / 100;
    const remainder = Math.round((totalWithTip - perPerson * splitPersonCount) * 100) / 100;
    const parts: SplitPart[] = Array.from({ length: splitPersonCount }, (_, i) => ({
      method: "card" as const, amount: Math.round((perPerson + (i === 0 ? remainder : 0)) * 100) / 100, paid: false,
    }));
    setSplitParts(parts); setSplitStep("paying"); setActiveSplitIdx(0);
  }

  function addSplitPart() {
    const used = splitParts.reduce((s, p) => s + p.amount, 0);
    const remaining = Math.max(0, Math.round((total + tipAmount - used) * 100) / 100);
    setSplitParts((prev) => [...prev, { method: "card", amount: remaining, paid: false }]);
  }

  function updateSplitPart(idx: number, updates: Partial<SplitPart>) {
    setSplitParts((prev) => prev.map((p, i) => i === idx ? { ...p, ...updates } : p));
  }

  function removeSplitPart(idx: number) {
    if (splitParts.length <= 1) return;
    setSplitParts((prev) => prev.filter((_, i) => i !== idx));
  }

  function processSplitPartPayment() {
    setProcessing(true); setSplitStep("processing");
    setTimeout(() => {
      setSplitParts((prev) => prev.map((p, i) => i === activeSplitIdx ? { ...p, paid: true, cashGiven: p.method === "cash" ? parseFloat(splitCashGiven) || 0 : undefined } : p));
      setProcessing(false); setSplitStep("paying"); setSplitCashGiven("");
      // Move to next unpaid
      const nextUnpaid = splitParts.findIndex((p, i) => i > activeSplitIdx && !p.paid);
      if (nextUnpaid >= 0) setActiveSplitIdx(nextUnpaid);
      else {
        const anyUnpaid = splitParts.findIndex((p, i) => i !== activeSplitIdx && !p.paid);
        if (anyUnpaid >= 0) setActiveSplitIdx(anyUnpaid);
      }
    }, 1200);
  }

  function finishSplit() {
    splitParts.forEach((p) => {
      if (p.giftCardId) onRedeemGiftCard?.(p.giftCardId, p.amount);
    });
    const methods = [...new Set(splitParts.map((p) => p.method))].join("+");
    onComplete({ method: `split(${methods})`, total: total + tipAmount, tip: tipAmount, giftCardDeduction: splitParts.filter((p) => p.method === "giftcard").reduce((s, p) => s + p.amount, 0), giftCardId: null, splitParts });
    onClose();
  }

  const splitTotalAssigned = splitParts.reduce((s, p) => s + p.amount, 0);
  const splitAllPaid = splitParts.length > 0 && splitParts.every((p) => p.paid);
  const splitRemaining = Math.max(0, Math.round((total + tipAmount - splitTotalAssigned) * 100) / 100);

  if (!open) return null;

  return (
    <Modal open={open} onClose={step === "processing" || splitStep === "processing" ? undefined : onClose} wide={mode !== "single"}>
      <div className="p-6 space-y-5">

        {/* ── SINGLE PAYMENT MODE ── */}
        {mode === "single" && step === "choose" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Betaling</h2>
              <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full"><X className="h-5 w-5" /></button>
            </div>
            <div className="text-center py-4">
              <div className="text-sm text-muted-foreground">Totaal</div>
              <div className="text-4xl font-black">{euro(grandTotal)}</div>
              {tipAmount > 0 && <div className="text-sm text-green-600 mt-1">Incl. {euro(tipAmount)} fooi</div>}
              {giftCardDeduction > 0 && <div className="text-sm text-purple-600 mt-1">Cadeaukaart: -{euro(giftCardDeduction)}</div>}
            </div>

            {/* Split payment buttons */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 rounded-full" onClick={initSplitMethod}>
                <Wallet className="h-3.5 w-3.5 mr-1" /> Split methode
              </Button>
              <Button variant="outline" size="sm" className="flex-1 rounded-full" onClick={initSplitPerson}>
                <Users className="h-3.5 w-3.5 mr-1" /> Split per persoon
              </Button>
            </div>

            {/* Gift card */}
            <div className="space-y-2">
              <Label>Cadeaukaart</Label>
              <div className="flex gap-2">
                <Input value={giftCardCode} onChange={(e) => setGiftCardCode(e.target.value)} placeholder="Code invoeren" className="text-sm"
                  onKeyDown={(e) => e.key === "Enter" && lookupGiftCard()} />
                <Button variant="outline" size="sm" onClick={lookupGiftCard}><Search className="h-3.5 w-3.5" /></Button>
                {giftCardApplied && <Button variant="ghost" size="sm" onClick={() => setGiftCardApplied(null)}><X className="h-3.5 w-3.5" /></Button>}
              </div>
              {giftCardApplied && (
                <div className="p-2 rounded-lg bg-purple-50 border border-purple-200 text-xs">
                  <div className="font-medium text-purple-800">{giftCardApplied.code}</div>
                  <div className="text-purple-600">Saldo: {euro(giftCardApplied.balance)} · Aftrek: {euro(giftCardDeduction)}</div>
                </div>
              )}
            </div>

            {grandTotal > 0 && (
              <div className="space-y-3">
                <Label>Betaalmethode</Label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: "card", label: "Pin", icon: CreditCard },
                    { key: "cash", label: "Contant", icon: Banknote },
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
                <Label>Fooi</Label>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 5, 10, 15].map((pct) => (
                    <button key={pct} onClick={() => setTipPercent(pct)}
                      className={clsx("rounded-xl border px-3 py-2 text-sm transition",
                        tipPercent === pct ? "border-black bg-black text-white" : "hover:bg-neutral-50")}>
                      {pct === 0 ? "Geen" : `${pct}%`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {method === "cash" && grandTotal > 0 && (
              <div className="space-y-2">
                <Label>Ontvangen bedrag</Label>
                <Input type="number" value={cashGiven} onChange={(e) => setCashGiven(e.target.value)} placeholder="0.00" className="text-lg" />
                {cashGiven && parseFloat(cashGiven) >= grandTotal && (
                  <div className="text-sm text-green-600 font-medium">Wisselgeld: {euro(cashChange)}</div>
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
              {grandTotal === 0 ? "Bevestigen (cadeaukaart)" : method === "card" ? "Pin betaling verwerken" : method === "cash" ? "Contant betaling bevestigen" : "QR betaling bevestigen"}
            </Button>
          </>
        )}

        {mode === "single" && step === "processing" && (
          <div className="py-16 text-center space-y-4">
            <div className="animate-spin mx-auto h-12 w-12 border-4 border-black border-t-transparent rounded-full" />
            <div className="text-lg font-semibold">Verwerken...</div>
            <div className="text-sm text-muted-foreground">{euro(grandTotal)}</div>
          </div>
        )}

        {mode === "single" && step === "done" && (
          <div className="py-12 text-center space-y-4">
            <div className="mx-auto h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <div className="text-xl font-bold">Betaling voltooid</div>
            <div className="text-2xl font-black">{euro(total + tipAmount)}</div>
            <div className="text-sm text-muted-foreground capitalize">{giftCardDeduction > 0 ? `Cadeaukaart + ${method}` : method}</div>
            {method === "cash" && cashChange > 0 && (
              <div className="text-lg font-semibold text-orange-600">Wisselgeld: {euro(cashChange)}</div>
            )}
            <div className="flex gap-3 justify-center pt-4">
              <Button variant="outline" onClick={finish}><Printer className="h-4 w-4 mr-2" />Bon printen</Button>
              <Button onClick={finish}>Klaar</Button>
            </div>
          </div>
        )}

        {/* ── SPLIT PAYMENT: PERSON SETUP ── */}
        {mode === "split-person" && splitStep === "setup" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Split per persoon</h2>
              <button onClick={() => setMode("single")} className="text-xs text-muted-foreground hover:underline">← Terug</button>
            </div>
            <div className="text-center py-4">
              <div className="text-sm text-muted-foreground">Totaal: {euro(total + tipAmount)}</div>
              <div className="text-3xl font-black mt-2">{splitPersonCount} personen</div>
              <div className="text-lg text-muted-foreground">{euro(Math.round((total + tipAmount) / splitPersonCount * 100) / 100)} p.p.</div>
            </div>
            <div className="flex items-center justify-center gap-4">
              <Button variant="outline" size="icon" onClick={() => setSplitPersonCount((p) => Math.max(2, p - 1))}><Minus className="h-4 w-4" /></Button>
              <span className="text-3xl font-bold w-12 text-center">{splitPersonCount}</span>
              <Button variant="outline" size="icon" onClick={() => setSplitPersonCount((p) => Math.min(20, p + 1))}><Plus className="h-4 w-4" /></Button>
            </div>
            <Button className="w-full h-12 text-lg" onClick={confirmSplitPersonSetup}>
              Verdelen over {splitPersonCount} personen
            </Button>
          </>
        )}

        {/* ── SPLIT PAYMENT: PAYING PARTS ── */}
        {(mode === "split-method" || mode === "split-person") && splitStep === "paying" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {mode === "split-method" ? "Split betaling" : `Split ${splitParts.length} personen`}
              </h2>
              <button onClick={() => { setMode("single"); setSplitParts([]); }} className="text-xs text-muted-foreground hover:underline">← Terug</button>
            </div>

            <div className="text-center py-2">
              <div className="text-sm text-muted-foreground">Totaal: {euro(total + tipAmount)}</div>
              {splitRemaining > 0.01 && <div className="text-sm text-orange-600 font-medium">Nog te verdelen: {euro(splitRemaining)}</div>}
            </div>

            {/* Parts list */}
            <div className="space-y-2 max-h-60 overflow-auto">
              {splitParts.map((part, idx) => (
                <div key={idx}
                  onClick={() => !part.paid && setActiveSplitIdx(idx)}
                  className={clsx(
                    "rounded-xl border p-3 transition cursor-pointer",
                    part.paid ? "bg-green-50 border-green-200 opacity-70" : activeSplitIdx === idx ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/40"
                  )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {part.paid ? <Check className="h-4 w-4 text-green-600" /> : <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />}
                      <span className="font-medium text-sm">
                        {mode === "split-person" ? `Persoon ${idx + 1}` : `Deel ${idx + 1}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{euro(part.amount)}</span>
                      {!part.paid && splitParts.length > 1 && (
                        <button onClick={(e) => { e.stopPropagation(); removeSplitPart(idx); }} className="text-destructive hover:bg-destructive/10 rounded p-0.5">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  {part.paid && <div className="text-[10px] text-green-600 mt-1 capitalize">Betaald via {part.method}</div>}
                </div>
              ))}
            </div>

            {mode === "split-method" && (
              <Button variant="outline" size="sm" className="w-full rounded-full" onClick={addSplitPart} disabled={splitRemaining < 0.01}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Deel toevoegen
              </Button>
            )}

            {/* Active part payment */}
            {!splitAllPaid && splitParts[activeSplitIdx] && !splitParts[activeSplitIdx].paid && (
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-bold">{mode === "split-person" ? `Persoon ${activeSplitIdx + 1}` : `Deel ${activeSplitIdx + 1}`} — {euro(splitParts[activeSplitIdx].amount)}</Label>
                </div>

                {mode === "split-method" && (
                  <div>
                    <Label className="text-xs">Bedrag</Label>
                    <Input type="number" min={0} step={0.01} value={splitParts[activeSplitIdx].amount}
                      onChange={(e) => updateSplitPart(activeSplitIdx, { amount: Math.max(0, parseFloat(e.target.value) || 0) })}
                      className="text-sm" />
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: "card", label: "Pin", icon: CreditCard },
                    { key: "cash", label: "Contant", icon: Banknote },
                    { key: "qr", label: "QR", icon: Smartphone },
                  ].map((m) => (
                    <button key={m.key} onClick={() => updateSplitPart(activeSplitIdx, { method: m.key as any })}
                      className={clsx("rounded-xl border p-2.5 flex flex-col items-center gap-1 transition text-xs",
                        splitParts[activeSplitIdx].method === m.key ? "border-black bg-black text-white" : "hover:bg-neutral-50")}>
                      <m.icon className="h-4 w-4" />
                      {m.label}
                    </button>
                  ))}
                </div>

                {splitParts[activeSplitIdx].method === "cash" && (
                  <div className="space-y-1">
                    <Label className="text-xs">Ontvangen</Label>
                    <Input type="number" value={splitCashGiven} onChange={(e) => setSplitCashGiven(e.target.value)} placeholder="0.00" className="text-sm" />
                    {splitCashGiven && parseFloat(splitCashGiven) >= splitParts[activeSplitIdx].amount && (
                      <div className="text-xs text-green-600">Wisselgeld: {euro(parseFloat(splitCashGiven) - splitParts[activeSplitIdx].amount)}</div>
                    )}
                  </div>
                )}

                <Button className="w-full" onClick={processSplitPartPayment}
                  disabled={processing || splitParts[activeSplitIdx].amount <= 0 ||
                    (splitParts[activeSplitIdx].method === "cash" && (!splitCashGiven || parseFloat(splitCashGiven) < splitParts[activeSplitIdx].amount))}>
                  Betaal {euro(splitParts[activeSplitIdx].amount)} ({splitParts[activeSplitIdx].method})
                </Button>
              </div>
            )}

            {splitAllPaid && (
              <div className="text-center space-y-3 pt-2">
                <div className="mx-auto h-14 w-14 bg-green-100 rounded-full flex items-center justify-center">
                  <Check className="h-7 w-7 text-green-600" />
                </div>
                <div className="text-lg font-bold">Alle delen betaald!</div>
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" onClick={finishSplit}><Printer className="h-4 w-4 mr-2" />Bon</Button>
                  <Button onClick={finishSplit}>Klaar</Button>
                </div>
              </div>
            )}
          </>
        )}

        {(mode === "split-method" || mode === "split-person") && splitStep === "processing" && (
          <div className="py-16 text-center space-y-4">
            <div className="animate-spin mx-auto h-12 w-12 border-4 border-black border-t-transparent rounded-full" />
            <div className="text-lg font-semibold">Verwerken deel {activeSplitIdx + 1}...</div>
            <div className="text-sm text-muted-foreground">{euro(splitParts[activeSplitIdx]?.amount || 0)}</div>
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

function CounterView({ products: allProducts, tables, features, customers, giftCards, onRedeemGiftCard, ticket, setTicket, onOrderComplete, passkitConfig, onToast, addLog, discounts = [] }: any) {
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("Signature Drinks");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [scanValue, setScanValue] = useState("");
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);
  const [upsellSuggestion, setUpsellSuggestion] = useState<UpsellSuggestion | null>(null);
  const upsell = useUpsellEngine(allProducts);

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

  function addLine(item, triggerProduct?: any) {
    setCart((prev) => {
      const existing = prev.find((x) => x.productId === item.productId && JSON.stringify(x.modifiers) === JSON.stringify(item.modifiers) && (x.notes || "") === (item.notes || ""));
      if (!existing) return [...prev, item];
      return prev.map((x) => (x.lineId === existing.lineId ? { ...x, qty: x.qty + item.qty } : x));
    });
    // Check for upsell after adding
    if (triggerProduct) {
      const suggestion = upsell.getSuggestion(triggerProduct, [...cart, item]);
      if (suggestion) {
        upsell.trackImpression(suggestion.rule.id);
        setUpsellSuggestion(suggestion);
      }
    }
  }

  function quickAdd(product) {
    if (product.modifierGroups?.length) {
      setSelectedProduct(product);
      addLog?.("product_selected", `Product geselecteerd met modifiers: ${product.name}`);
      return;
    }
    const item = { lineId: `${product.id}-${Date.now()}`, productId: product.id, name: product.name, price: product.price, costPrice: product.costPrice || 0, qty: 1, notes: "", modifiers: [] };
    addLine(item, product);
    addLog?.("item_added_to_cart", `Product toegevoegd aan ticket: ${product.name} (${euro(product.price)})`);
  }

  function handleUpsellAccept() {
    if (!upsellSuggestion) return;
    const sp = upsellSuggestion.suggestedProduct;
    addLine({
      lineId: `${sp.id}-${Date.now()}`,
      productId: sp.id,
      name: sp.name,
      price: upsellSuggestion.price,
      costPrice: sp.costPrice || 0,
      qty: 1,
      notes: "",
      modifiers: [],
    });
    upsell.trackConversion(upsellSuggestion.rule.id);
    addLog?.("upsell_accepted", `Upsell geaccepteerd: ${sp.name}`);
    setUpsellSuggestion(null);
  }

  function handleUpsellDismiss() {
    if (!upsellSuggestion) return;
    upsell.dismiss(upsellSuggestion.rule.id);
    setUpsellSuggestion(null);
  }

  function updateQty(lineId, delta) {
    setCart((prev) => prev.map((item) => (item.lineId === lineId ? { ...item, qty: item.qty + delta } : item)).filter((item) => item.qty > 0));
  }

  function removeLine(lineId) {
    const item = cart.find((x) => x.lineId === lineId);
    addLog?.("item_removed_from_cart", `Product verwijderd uit ticket: ${item?.name || lineId}`);
    setCart((prev) => prev.filter((x) => x.lineId !== lineId));
  }

  function clearCart() {
    addLog?.("cart_cleared", `Ticket leeggemaakt (${cart.length} items)`);
    setTicket(emptyTicket(tableId));
    setScanValue("");
  }

  async function lookupLoyalty() {
    if (!scanValue.trim()) return;
    const query = scanValue.trim();

    // Local customer lookup by name, email, phone, or loyaltyId
    const found = customers.find((c: any) =>
      c.loyaltyId?.toLowerCase() === query.toLowerCase() ||
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      (c.email || "").toLowerCase().includes(query.toLowerCase()) ||
      (c.phone || "").replace(/\s/g, "").includes(query.replace(/\s/g, ""))
    );
    if (found) {
      updateTicket({ loyaltyCustomer: found, customerName: found.name, customerId: found.id, loyaltyProvider: "passkit" });
    }

    // Always check PassKit API when configured
    if (passkitConfig?.programId) {
      setLoyaltyLoading(true);
      try {
        const member = await passkitGetMember(passkitConfig.programId, query);
        if (member.found) {
          const fullName = [member.person?.forename, member.person?.surname].filter(Boolean).join(" ");
          updateTicket({
            loyaltyCustomer: {
              name: fullName || query,
              points: member.points?.currentPoints || 0,
              visits: 0,
              provider: "passkit",
              loyaltyId: member.externalId || query,
              passkitMemberId: member.id,
              email: member.person?.emailAddress || "",
              phone: member.person?.mobileNumber || "",
            },
            customerName: fullName || customerName || query,
            loyaltyProvider: "passkit",
          });
          onToast?.(`Lid gevonden: ${fullName || query} (${member.points?.currentPoints || 0} pts)`);
        } else if (!found) {
          updateTicket({ loyaltyCustomer: null });
          onToast?.("Geen lid gevonden — probeer telefoon, email of scan de pas");
        }
      } catch (err) {
        console.error("PassKit lookup error:", err);
        if (!found) updateTicket({ loyaltyCustomer: null });
      } finally {
        setLoyaltyLoading(false);
      }
    } else if (!found) {
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
    addLog?.("payment_started", `Betaling gestart: ${method} — ${cart.length} items, ${euro(subtotal)}`);
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
    addLog?.("payment_completed", `Betaling afgerond: #${order.id} — ${euro(paidTotal)} via ${method}${tip ? ` + ${euro(tip)} fooi` : ""}`);
    onOrderComplete(order);
    clearCart();
  }

  return (
    <div className="grid grid-cols-12 gap-3 h-[calc(100dvh-120px)] touch-manipulation">
      {/* LEFT: Product grid */}
      <div className="col-span-7 flex flex-col gap-3 overflow-hidden">
        <div className="flex flex-col gap-2">
          <div className="relative min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-9 h-11" />
          </div>
          <div className="flex flex-wrap gap-1">
            {SECTIONS.map((s) => (
              <Button key={s} variant={section === s ? "default" : "outline"} size="sm" className="rounded-full text-xs px-4 h-10 min-w-[44px]" onClick={() => setSection(s)}>
                {s}
              </Button>
            ))}
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 pb-4">
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
            {/* Loyalty — PassKit only */}
            {features.passkit && (
              <div className="rounded-xl border p-3 mb-3 bg-neutral-50">
                <div className="font-medium text-xs flex items-center gap-1.5 mb-2"><Wallet className="h-3.5 w-3.5" /> Loyalty (PassKit)</div>
                <div className="flex gap-1.5">
                  <Input value={scanValue} onChange={(e) => setScanValue(e.target.value)}
                    placeholder="Scan pas / telefoon / email / naam"
                    className="text-xs h-8"
                    onKeyDown={(e) => e.key === "Enter" && lookupLoyalty()} />
                  <Button variant="outline" size="sm" className="h-8 px-2" onClick={lookupLoyalty} disabled={loyaltyLoading}>
                    {loyaltyLoading ? <span className="animate-spin h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full" /> : <Search className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                {loyaltyCustomer && (
                  <div className="mt-2 p-2 rounded-lg bg-green-50 border border-green-200 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-medium text-green-800">{loyaltyCustomer.name}</div>
                      <div className="text-green-600">
                        {loyaltyCustomer.points} punten
                        {loyaltyCustomer.phone && ` · ${loyaltyCustomer.phone}`}
                        {loyaltyCustomer.passkitMemberId && <span className="ml-1">· PassKit ✓</span>}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-green-600 hover:text-red-500"
                      onClick={() => { updateTicket({ loyaltyCustomer: null, loyaltyProvider: "none" }); setScanValue(""); }}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
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
                        <button onClick={() => removeLine(item.lineId)} className="text-red-500 hover:text-red-700 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"><Trash2 className="h-4 w-4" /></button>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="icon" className="h-9 w-9 min-w-[44px] min-h-[44px]" onClick={() => updateQty(item.lineId, -1)}><Minus className="h-3.5 w-3.5" /></Button>
                          <span className="w-6 text-center text-sm font-semibold">{item.qty}</span>
                          <Button variant="outline" size="icon" className="h-9 w-9 min-w-[44px] min-h-[44px]" onClick={() => updateQty(item.lineId, 1)}><Plus className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {/* Discounts — collapsible */}
            {cart.length > 0 && (
              <DiscountPanel discounts={discounts} selectedDiscount={selectedDiscount} updateTicket={updateTicket} />
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
            <div className="grid grid-cols-4 gap-2 mt-3">
              <Button className="bg-white text-black hover:bg-white/90 text-xs h-11 min-h-[44px]" onClick={() => openPayment("card")} disabled={cart.length === 0}>
                <CreditCard className="h-4 w-4 mr-1" /> Card
              </Button>
              <Button className="bg-white text-black hover:bg-white/90 text-xs h-11 min-h-[44px]" onClick={() => openPayment("cash")} disabled={cart.length === 0}>
                <Banknote className="h-4 w-4 mr-1" /> Cash
              </Button>
              <Button className="bg-white text-black hover:bg-white/90 text-xs h-11 min-h-[44px]" onClick={() => openPayment("qr")} disabled={cart.length === 0}>
                <Smartphone className="h-4 w-4 mr-1" /> QR
              </Button>
              <Button className="bg-amber-500 text-white hover:bg-amber-600 text-xs h-11 min-h-[44px]" onClick={() => {
                const escposCmd = new Uint8Array([0x1B, 0x70, 0x00, 0x19, 0xFA]);
                try {
                  const nav = navigator as any;
                  if (nav.usb) {
                    nav.usb.requestDevice({ filters: [{ vendorId: 0x04B8 }] }).then((device: any) => {
                      device.open().then(() => device.selectConfiguration(1)).then(() => device.claimInterface(0)).then(() => {
                        device.transferOut(1, escposCmd).then(() => { device.close(); });
                      });
                    }).catch(() => {});
                  }
                } catch (e) {}
                addLog?.("cash_drawer_opened", "Kassalade geopend via knop");
                onToast?.("Kassalade openen...");
              }}>
                <Lock className="h-4 w-4 mr-1" /> Lade
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Modifier picker modal */}
      <Modal open={!!selectedProduct} onClose={() => setSelectedProduct(null)}>
        {selectedProduct && <ModifierPicker product={selectedProduct} onAdd={(item) => addLine(item, selectedProduct)} onClose={() => setSelectedProduct(null)} />}
      </Modal>

      {/* Upsell prompt */}
      <UpsellPrompt suggestion={upsellSuggestion} onAccept={handleUpsellAccept} onDismiss={handleUpsellDismiss} />

      {/* Payment modal */}
      <PaymentModal open={paymentOpen} onClose={() => setPaymentOpen(false)} total={total} onComplete={handlePaymentComplete} method={paymentMethod} features={features} giftCards={giftCards} onRedeemGiftCard={onRedeemGiftCard} />
    </div>
  );
}

// ─── TABLE VIEW ──────────────────────────────────────────────────────────────
// ─── FLOOR PLAN EDITOR ───────────────────────────────────────────────────────

function FloorPlanEditor({ tables, setTables, openTickets, reservations, onSelectTable, onCloseTable, onSeatReservation, channels, addLog, zones: zonesProp, onCreateZone, onDeleteZone, onCreateTable, onUpdateTable, onDeleteTable }: any) {
  const zones = zonesProp || [];
  const [activeZone, setActiveZone] = useState<string>("");
  useEffect(() => { if (!activeZone && zones[0]) setActiveZone(zones[0].name); }, [zones, activeZone]);
  const [editMode, setEditMode] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showAddTable, setShowAddTable] = useState(false);
  const [showAddZone, setShowAddZone] = useState(false);
  const [newZoneName, setNewZoneName] = useState("");
  const [newTable, setNewTable] = useState({ name: "", seats: 2, shape: "square" as "square" | "circle" | "rect" });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Floor plan zones + tables persisted to DB via onCreate/onUpdate/onDelete props.

  const filtered = tables.filter((t: any) => t.area === activeZone);

  function getTableStatus(table: any) {
    const ticket = openTickets[table.id];
    if (ticket) return "occupied";
    const hasReservation = reservations.some((r: any) => r.table === table.name && r.status === "confirmed");
    if (hasReservation) return "reserved";
    return "free";
  }

  const statusBg: Record<string, string> = { free: "#22c55e", occupied: "#f97316", reserved: "#3b82f6" };

  const tableCounts: Record<string, number> = { free: 0, occupied: 0, reserved: 0 };
  tables.forEach((t: any) => { const s = getTableStatus(t); tableCounts[s] = (tableCounts[s] || 0) + 1; });

  function handleMouseDown(e: React.MouseEvent, tableId: string) {
    if (!editMode) return;
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const table = tables.find((t: any) => t.id === tableId);
    if (!table) return;
    setDragging(tableId);
    setDragOffset({ x: e.clientX - rect.left - table.x, y: e.clientY - rect.top - table.y });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragging || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const newX = Math.max(0, Math.min(rect.width - 60, e.clientX - rect.left - dragOffset.x));
    const newY = Math.max(0, Math.min(rect.height - 60, e.clientY - rect.top - dragOffset.y));
    setTables((prev: any[]) => prev.map((t: any) => t.id === dragging ? { ...t, x: Math.round(newX), y: Math.round(newY) } : t));
  }

  function handleMouseUp() {
    if (dragging) {
      const t = tables.find((tb: any) => tb.id === dragging);
      if (t && onUpdateTable) onUpdateTable(t.id, { x: t.x, y: t.y });
    }
    setDragging(null);
  }

  async function addNewTable() {
    if (!newTable.name.trim() || !onCreateTable) return;
    const zone = zones.find((z: any) => z.name === activeZone);
    await onCreateTable({
      name: newTable.name.trim(), seats: newTable.seats, shape: newTable.shape,
      zone_id: zone?.id || null,
      x: Math.round(60 + Math.random() * 200), y: Math.round(60 + Math.random() * 150),
      w: newTable.shape === "rect" ? 120 : 70, h: 70,
    });
    addLog?.("table_created", `Tafel "${newTable.name.trim()}" aangemaakt in zone ${activeZone}`);
    setNewTable({ name: "", seats: 2, shape: "square" });
    setShowAddTable(false);
  }

  async function removeTable(id: string) {
    const t = tables.find((tb: any) => tb.id === id);
    if (onDeleteTable) await onDeleteTable(id);
    addLog?.("table_deleted", `Tafel "${t?.name}" verwijderd`);
  }

  async function addZone() {
    if (!newZoneName.trim() || !onCreateZone) return;
    const created = await onCreateZone(newZoneName.trim());
    if (created) setActiveZone(created.name);
    setNewZoneName("");
    setShowAddZone(false);
  }

  async function removeZone(zoneId: string) {
    const zone = zones.find((z: any) => z.id === zoneId);
    if (!zone || !onDeleteZone) return;
    // Tables in this zone become unassigned (zone_id null via realtime/cascade).
    await onDeleteZone(zoneId);
    if (activeZone === zone.name) {
      const remaining = zones.filter((z: any) => z.id !== zoneId);
      if (remaining.length > 0) setActiveZone(remaining[0].name);
    }
  }


  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant={editMode ? "default" : "outline"} size="sm" onClick={() => setEditMode(!editMode)} className="rounded-full">
            <Edit className="h-3.5 w-3.5 mr-1" /> {editMode ? "Klaar" : "Bewerken"}
          </Button>
          {editMode && (
            <>
              <Button variant="outline" size="sm" onClick={() => setShowAddTable(true)} className="rounded-full">
                <Plus className="h-3.5 w-3.5 mr-1" /> Tafel
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowAddZone(true)} className="rounded-full">
                <Plus className="h-3.5 w-3.5 mr-1" /> Zone
              </Button>
            </>
          )}
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-full bg-green-500" /> Vrij ({tableCounts.free})</span>
          <span className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-full bg-orange-500" /> Bezet ({tableCounts.occupied})</span>
          <span className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Gereserveerd ({tableCounts.reserved})</span>
        </div>
      </div>

      {/* External channels */}
      <div className="flex gap-2">
        {channels.map((ch: any) => {
          const hasTicket = !!openTickets[ch.id];
          return (
            <Button key={ch.id} variant={hasTicket ? "default" : "outline"} size="sm" className="rounded-full"
              onClick={() => onSelectTable(ch.id)}>
              <span className="mr-1">{ch.icon}</span> {ch.name}
              {hasTicket && <Badge className="ml-1.5 h-5 text-[10px]" variant="secondary">{cartItemCount(openTickets[ch.id]?.cart || [])}</Badge>}
            </Button>
          );
        })}
      </div>

      {/* Zone tabs */}
      <div className="flex items-center gap-1 border-b pb-1">
        {zones.map((z: any) => (
          <div key={z.id} className="flex items-center">
            <button
              onClick={() => setActiveZone(z.name)}
              className={clsx("px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors",
                activeZone === z.name ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}
            >
              {z.name}
            </button>
            {editMode && zones.length > 1 && (
              <button onClick={() => removeZone(z.id)} className="text-destructive hover:bg-destructive/10 rounded p-0.5 ml-0.5">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="relative bg-muted/30 border-2 border-dashed border-border rounded-2xl overflow-hidden"
        style={{ height: 420, minHeight: 320 }}
      >
        {/* Grid pattern */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
          <defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" /></pattern></defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {filtered.map((table: any) => {
          const status = getTableStatus(table);
          const ticket = openTickets[table.id];
          const ticketTotal = ticket ? cartSubtotal(ticket.cart) : 0;
          const ticketItems = ticket ? cartItemCount(ticket.cart) : 0;
          const color = statusBg[status];
          const isCircle = table.shape === "circle";

          return (
            <div
              key={table.id}
              onMouseDown={(e) => handleMouseDown(e, table.id)}
              onClick={() => {
                if (!editMode) {
                  if (status === "reserved") onSeatReservation(table);
                  else onSelectTable(table.id);
                }
              }}
              className={clsx(
                "absolute flex flex-col items-center justify-center text-white font-bold text-sm shadow-lg transition-all select-none",
                isCircle ? "rounded-full" : "rounded-xl",
                editMode ? "cursor-move ring-2 ring-primary/40" : "cursor-pointer hover:scale-105",
                dragging === table.id && "opacity-70 z-50"
              )}
              style={{
                left: table.x, top: table.y, width: table.w, height: table.h,
                backgroundColor: color, minWidth: 50, minHeight: 50,
              }}
            >
              <span className="text-base font-bold drop-shadow">{table.name}</span>
              <span className="text-[9px] opacity-80">{table.seats} st.</span>
              {status === "occupied" && ticketItems > 0 && (
                <span className="text-[9px] font-normal mt-0.5">{euro(ticketTotal)}</span>
              )}
              {editMode && (
                <button onClick={(e) => { e.stopPropagation(); removeTable(table.id); }}
                  className="absolute -top-2 -right-2 bg-destructive text-white rounded-full h-5 w-5 flex items-center justify-center text-[10px] shadow">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
            Geen tafels in deze zone. {editMode ? "Voeg een tafel toe." : "Schakel bewerken in."}
          </div>
        )}
      </div>

      {/* Add Table Modal */}
      <Modal open={showAddTable} onClose={() => setShowAddTable(false)}>
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-bold">Tafel toevoegen</h2>
          <div className="space-y-3">
            <div>
              <Label>Naam</Label>
              <Input value={newTable.name} onChange={(e) => setNewTable((p) => ({ ...p, name: e.target.value }))} placeholder="bv. A1, Bar, Lounge..." />
            </div>
            <div>
              <Label>Stoelen</Label>
              <Input type="number" min={1} max={20} value={newTable.seats} onChange={(e) => setNewTable((p) => ({ ...p, seats: parseInt(e.target.value) || 2 }))} />
            </div>
            <div>
              <Label>Vorm</Label>
              <div className="flex gap-2 mt-1">
                {(["square", "circle", "rect"] as const).map((s) => (
                  <Button key={s} variant={newTable.shape === s ? "default" : "outline"} size="sm" onClick={() => setNewTable((p) => ({ ...p, shape: s }))} className="rounded-full">
                    {s === "square" ? "■ Vierkant" : s === "circle" ? "● Rond" : "▬ Rechthoek"}
                  </Button>
                ))}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">Zone: {activeZone}</div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowAddTable(false)}>Annuleren</Button>
            <Button onClick={addNewTable} disabled={!newTable.name.trim()}>Toevoegen</Button>
          </div>
        </div>
      </Modal>

      {/* Add Zone Modal */}
      <Modal open={showAddZone} onClose={() => setShowAddZone(false)}>
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-bold">Zone toevoegen</h2>
          <div>
            <Label>Zone naam</Label>
            <Input value={newZoneName} onChange={(e) => setNewZoneName(e.target.value)} placeholder="bv. Terras, VIP, Verdieping 2..." />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowAddZone(false)}>Annuleren</Button>
            <Button onClick={addZone} disabled={!newZoneName.trim()}>Toevoegen</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

// KPI card IDs for favoriting
const ALL_INSIGHTS = [
  { id: "revenue", label: "Bruto-omzet", tab: "verkopen", color: "text-blue-600", info: "De totale omzet inclusief fooien en kortingen. Dit is het bruto bedrag dat binnenkwam in de geselecteerde periode." },
  { id: "order_revenue", label: "Omzet van alle bestellingen", tab: "verkopen", color: "text-blue-600", info: "De totale omzet van alle bestellingen, exclusief fooien. Dit laat zien hoeveel er daadwerkelijk aan producten is verkocht." },
  { id: "avg_ticket", label: "Gemiddelde verkoopprijs", tab: "verkopen", color: "text-blue-600", info: "Het gemiddelde bedrag per transactie (totaal ÷ aantal bestellingen). Hoger = klanten bestellen meer per bezoek." },
  { id: "avg_order", label: "Gemiddelde bestelwaarde", tab: "verkopen", color: "text-blue-600", info: "Het gemiddelde bestelbedrag exclusief fooien. Gebruik dit om te zien of upselling effect heeft." },
  { id: "order_count", label: "Verkoop aantallen", tab: "verkopen", color: "text-blue-600", info: "Het totale aantal afgeronde bestellingen in deze periode. Vergelijk met vorige perioden om trends te ontdekken." },
  { id: "avg_table_time", label: "Gemiddelde tafelbezettingstijd", tab: "service", color: "text-purple-600", info: "Hoe lang een tafel gemiddeld bezet is per bestelling. Korter = snellere doorloop, meer gasten per dag." },
  { id: "total_tips", label: "Totale fooien", tab: "service", color: "text-purple-600", info: "Het totale bedrag aan ontvangen fooien. Een goede indicator van klanttevredenheid en servicekwaliteit." },
  { id: "tip_pct", label: "Fooi percentage", tab: "service", color: "text-purple-600", info: "Fooien als percentage van de totale omzet. Gemiddeld in horeca: 5-10%. Hoger wijst op uitstekende service." },
  { id: "avg_table_revenue", label: "Gemiddelde tafelomzet", tab: "service", color: "text-purple-600", info: "De gemiddelde omzet per tafelbestelling. Vergelijk met walk-in bestellingen om te zien waar meer wordt besteed." },
  { id: "total_discounts", label: "Totale kortingen", tab: "service", color: "text-purple-600", info: "Het totale kortingsbedrag dat is weggegeven. Houd dit in de gaten om te zorgen dat kortingen winstgevend blijven." },
  { id: "returning_customers", label: "Terugkerende klanten", tab: "service", color: "text-purple-600", info: "Klanten die meerdere keren hebben besteld in deze periode. Hoge retentie = tevreden klanten en een sterk merk." },
  { id: "prep_count", label: "Totaal aantal verwerkte bonnen", tab: "prepstation", color: "text-amber-700", info: "Het totale aantal individuele items dat is verwerkt door het prepstation. Gebruik dit voor capaciteitsplanning." },
  { id: "prep_avg_time", label: "Gem. bereidingstijd", tab: "prepstation", color: "text-amber-700", info: "De gemiddelde tijd van bestelling tot voltooiing. Lager = snellere service en hogere klanttevredenheid." },
  { id: "prep_waiting", label: "Wachtende tickets", tab: "prepstation", color: "text-amber-700", info: "Aantal tickets die nog wachten op bereiding of in bereiding zijn. Hoog = mogelijke bottleneck." },
  { id: "prep_completed_today", label: "Voltooid vandaag", tab: "prepstation", color: "text-amber-700", info: "Aantal tickets die vandaag zijn voltooid. Vergelijk met het totale aantal bestellingen." },
  { id: "res_count", label: "Aantal reserveringen", tab: "reserveringen", color: "text-cyan-600", info: "Het totale aantal bevestigde reserveringen in deze periode. Vergelijk met walk-ins voor de verhouding." },
  { id: "walk_ins", label: "Walk-ins", tab: "reserveringen", color: "text-cyan-600", info: "Bestellingen zonder reservering. Een hoog aantal walk-ins kan wijzen op een goede locatie of spontaan bezoek." },
  { id: "avg_group_size", label: "Gemiddelde groepsgrootte", tab: "reserveringen", color: "text-cyan-600", info: "Het gemiddelde aantal gasten per reservering. Handig voor het plannen van tafelindeling en personeel." },
  { id: "cancellations", label: "Annuleringen", tab: "reserveringen", color: "text-cyan-600", info: "Het aantal geannuleerde reserveringen. Hoog percentage kan wijzen op problemen met boekingservaring of communicatie." },
  { id: "no_shows", label: "No-shows", tab: "reserveringen", color: "text-cyan-600", info: "Gasten die niet kwamen opdagen zonder te annuleren. Overweeg een no-show beleid als dit hoog is." },
  { id: "waitlist", label: "Aantal op de wachtlijst", tab: "reserveringen", color: "text-cyan-600", info: "Het aantal gasten dat op de wachtlijst staat. Dit wijst op hoge vraag — overweeg uitbreiding of langere openingstijden." },
  { id: "couverts", label: "Aantal couverts", tab: "reserveringen", color: "text-cyan-600", info: "Het totale aantal gasten (couverts) dat is bediend via reserveringen. Belangrijke KPI voor capaciteitsbenutting." },
  { id: "products_sold", label: "Totale producten verkocht", tab: "producten", color: "text-orange-600", info: "Het totale aantal verkochte producten (alle items opgeteld). Vergelijk met vorige perioden voor groeitrends." },
  { id: "avg_products_per_order", label: "Gemiddeld aantal producten per bestelling", tab: "producten", color: "text-orange-600", info: "Hoeveel producten gemiddeld per bestelling worden gekocht. Meer = betere cross-selling en upselling." },
  { id: "cost_pct", label: "Kosten percentage ingrediënt", tab: "producten", color: "text-orange-600", info: "Het percentage van de omzet dat opgaat aan ingrediëntkosten. Ideaal: 25-35%. Hoger = lagere marge." },
  { id: "top_categories", label: "Top productcategorieën", tab: "producten", color: "text-orange-600", info: "Welke productcategorieën het meeste omzet genereren. Gebruik dit voor menu-optimalisatie en inkoop." },
  { id: "top_products", label: "Top producten", tab: "producten", color: "text-orange-600", info: "De best verkopende producten op basis van omzet. Focus marketing en voorraad op deze items." },
] as const;

function DashboardView({ orders, tables, openTickets, qrOrders, onAdvanceOrder, products, reservations, customers }: any) {
  const [dashTab, setDashTab] = useState("favorieten");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [periodMode, setPeriodMode] = useState<"day" | "month" | "quarter">("day");
  const [compareMode, setCompareMode] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("saakouk_fav_insights") || "[]"); } catch { return []; }
  });
  const [showFavPicker, setShowFavPicker] = useState(false);

  useEffect(() => {
    localStorage.setItem("saakouk_fav_insights", JSON.stringify(favorites));
  }, [favorites]);

  function toggleFavorite(id: string) {
    setFavorites((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  // Date helpers
  function navigateDate(dir: number) {
    const d = new Date(selectedDate);
    if (periodMode === "day") d.setDate(d.getDate() + dir);
    else if (periodMode === "month") d.setMonth(d.getMonth() + dir);
    else d.setMonth(d.getMonth() + dir * 3);
    setSelectedDate(d);
  }

  function getDateRange(date: Date): { start: Date; end: Date } {
    if (periodMode === "day") {
      const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
      return { start, end };
    }
    if (periodMode === "month") {
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end };
    }
    // quarter
    const q = Math.floor(date.getMonth() / 3);
    const start = new Date(date.getFullYear(), q * 3, 1);
    const end = new Date(date.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999);
    return { start, end };
  }

  function getCompareRange(date: Date): { start: Date; end: Date } {
    const d = new Date(date);
    if (periodMode === "day") d.setDate(d.getDate() - 1);
    else if (periodMode === "month") d.setMonth(d.getMonth() - 1);
    else d.setMonth(d.getMonth() - 3);
    return getDateRange(d);
  }

  function dateLabel(date: Date): string {
    if (periodMode === "day") return date.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
    if (periodMode === "month") return date.toLocaleDateString("nl-NL", { month: "long", year: "numeric" });
    const q = Math.floor(date.getMonth() / 3) + 1;
    return `Q${q} ${date.getFullYear()}`;
  }

  const range = getDateRange(selectedDate);
  const compareRange = getCompareRange(selectedDate);
  const filtered = orders.filter((o: any) => o.date >= range.start && o.date <= range.end);
  const compareFiltered = compareMode ? orders.filter((o: any) => o.date >= compareRange.start && o.date <= compareRange.end) : [];

  // ─── Calculations ───
  const revenue = filtered.reduce((s: number, o: any) => s + o.total, 0);
  const orderRevenue = filtered.reduce((s: number, o: any) => s + o.subtotal, 0);
  const tips = filtered.reduce((s: number, o: any) => s + (o.tip || 0), 0);
  const avgTicket = filtered.length > 0 ? revenue / filtered.length : 0;
  const avgOrder = filtered.length > 0 ? orderRevenue / filtered.length : 0;
  const totalDiscount = filtered.reduce((s: number, o: any) => s + (o.discount || 0), 0);
  const tipPct = revenue > 0 ? (tips / revenue) * 100 : 0;
  const itemsSold = filtered.reduce((s: number, o: any) => s + o.items.reduce((a: number, i: any) => a + i.qty, 0), 0);
  const avgProductsPerOrder = filtered.length > 0 ? itemsSold / filtered.length : 0;
  const totalCost = filtered.reduce((s: number, o: any) => s + o.items.reduce((a: number, i: any) => a + (i.costPrice || 0) * i.qty, 0), 0);
  const costPct = revenue > 0 ? (totalCost / revenue) * 100 : 0;

  // Compare
  const cRevenue = compareFiltered.reduce((s: number, o: any) => s + o.total, 0);
  const cTips = compareFiltered.reduce((s: number, o: any) => s + (o.tip || 0), 0);
  const cAvgTicket = compareFiltered.length > 0 ? cRevenue / compareFiltered.length : 0;

  // By hour for chart
  const byHour: Record<number, { revenue: number; orders: number }> = {};
  for (let h = 0; h <= 23; h++) byHour[h] = { revenue: 0, orders: 0 };
  filtered.forEach((o: any) => {
    const h = o.date.getHours();
    byHour[h].revenue += o.total;
    byHour[h].orders += 1;
  });
  const peakHour = Math.max(...Object.values(byHour).map(v => v.revenue), 1);

  // Top products and categories
  const topProducts: Record<string, { name: string; qty: number; revenue: number }> = {};
  const bySection: Record<string, number> = {};
  filtered.forEach((o: any) => o.items.forEach((item: any) => {
    if (!topProducts[item.productId]) topProducts[item.productId] = { name: item.name, qty: 0, revenue: 0 };
    topProducts[item.productId].qty += item.qty;
    topProducts[item.productId].revenue += (item.price + (item.modifiers?.reduce((s: number, m: any) => s + m.price, 0) ?? 0)) * item.qty;
    const product = products?.find((p: any) => p.id === item.productId);
    const sec = product?.section || "Other";
    bySection[sec] = (bySection[sec] || 0) + (item.price + (item.modifiers?.reduce((s: number, m: any) => s + m.price, 0) ?? 0)) * item.qty;
  }));
  const topProductList = Object.values(topProducts).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const topCategoryList = Object.entries(bySection).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Reserveringen stats
  const filteredReservations = (reservations || []).filter((r: any) => {
    const rDate = new Date(r.date);
    return rDate >= range.start && rDate <= range.end;
  });
  const confirmedRes = filteredReservations.filter((r: any) => r.status === "confirmed" || r.status === "seated").length;
  const walkIns = filtered.filter((o: any) => !o.table).length;
  const avgGroupSize = filteredReservations.length > 0
    ? filteredReservations.reduce((s: number, r: any) => s + (r.guests || 0), 0) / filteredReservations.length : 0;
  const cancelledRes = filteredReservations.filter((r: any) => r.status === "cancelled").length;
  const noShows = filteredReservations.filter((r: any) => r.status === "no-show").length;
  const totalCouverts = filteredReservations.reduce((s: number, r: any) => s + (r.guests || 0), 0);

  // Returning customers
  const customerCounts: Record<string, number> = {};
  filtered.forEach((o: any) => { if (o.customerId) customerCounts[o.customerId] = (customerCounts[o.customerId] || 0) + 1; });
  const returningCount = Object.values(customerCounts).filter((c) => c > 1).length;

  // Prep count
  const prepCount = filtered.reduce((s: number, o: any) => s + o.items.length, 0);

  // Avg table revenue
  const tableOrders = filtered.filter((o: any) => o.table);
  const avgTableRevenue = tableOrders.length > 0 ? tableOrders.reduce((s: number, o: any) => s + o.total, 0) / tableOrders.length : 0;

  // KPI value resolver
  function getInsightValue(id: string): string {
    switch (id) {
      case "revenue": return euro(revenue);
      case "order_revenue": return euro(orderRevenue);
      case "avg_ticket": return euro(avgTicket);
      case "avg_order": return euro(avgOrder);
      case "order_count": return String(filtered.length);
      case "avg_table_time": return "22 sec";
      case "total_tips": return euro(tips);
      case "tip_pct": return `${tipPct.toFixed(1)}%`;
      case "avg_table_revenue": return `${avgTableRevenue.toFixed(1)}x`;
      case "total_discounts": return euro(totalDiscount);
      case "returning_customers": return String(returningCount);
      case "prep_count": return String(prepCount);
      case "res_count": return String(confirmedRes);
      case "walk_ins": return String(walkIns);
      case "avg_group_size": return String(Math.round(avgGroupSize));
      case "cancellations": return String(cancelledRes);
      case "no_shows": return String(noShows);
      case "waitlist": return "0";
      case "couverts": return String(totalCouverts);
      case "products_sold": return String(itemsSold);
      case "avg_products_per_order": return avgProductsPerOrder.toFixed(1);
      case "cost_pct": return `${costPct.toFixed(0)}%`;
      case "prep_avg_time": return "—";
      case "prep_waiting": return "0";
      case "prep_completed_today": return "0";
      default: return "—";
    }
  }

  function InsightCard({ insight, showFavStar = true }: { insight: typeof ALL_INSIGHTS[number]; showFavStar?: boolean }) {
    const isFav = favorites.includes(insight.id);
    const isChart = insight.id === "top_categories" || insight.id === "top_products" || insight.id === "returning_customers" || insight.id === "total_discounts";
    const [showInfo, setShowInfo] = useState(false);

    return (
      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className={clsx("text-sm font-medium", insight.color)}>{insight.label}</span>
            <div className="flex items-center gap-1">
              <button className="p-1 rounded-full hover:bg-muted relative" onClick={() => setShowInfo(!showInfo)} title="Info">
                <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-foreground text-background text-[10px] font-bold">i</span>
              </button>
              {showFavStar && (
                <button className="p-1 rounded-full hover:bg-muted" onClick={() => toggleFavorite(insight.id)} title={isFav ? "Verwijder uit favorieten" : "Toevoegen aan favorieten"}>
                  <Star className={clsx("h-4 w-4", isFav ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} />
                </button>
              )}
            </div>
          </div>
          {showInfo && (
            <div className="mb-3 p-3 rounded-xl bg-muted/60 border text-xs text-muted-foreground leading-relaxed animate-in fade-in slide-in-from-top-2">
              {insight.info}
            </div>
          )}
          {isChart && insight.id === "top_categories" ? (
            <div className="space-y-1.5 mt-2">
              {topCategoryList.length === 0 ? <div className="text-sm text-muted-foreground">Geen data</div> : topCategoryList.map(([name, rev]) => (
                <div key={name}>
                  <div className="text-xs mb-0.5">{name}</div>
                  <div className="h-4 bg-muted rounded overflow-hidden">
                    <div className="h-full bg-orange-400 rounded" style={{ width: `${(rev / (topCategoryList[0]?.[1] || 1)) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : isChart && insight.id === "top_products" ? (
            <div className="space-y-1.5 mt-2">
              {topProductList.length === 0 ? <div className="text-sm text-muted-foreground">Geen data</div> : topProductList.map((p) => (
                <div key={p.name}>
                  <div className="text-xs mb-0.5">{p.name}</div>
                  <div className="h-4 bg-muted rounded overflow-hidden">
                    <div className="h-full bg-orange-500 rounded" style={{ width: `${(p.revenue / (topProductList[0]?.revenue || 1)) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-3xl font-black mt-1">{getInsightValue(insight.id)}</div>
          )}
          {compareMode && !isChart && (
            <div className="text-xs text-muted-foreground mt-1">Vorige periode: vergelijking actief</div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Hourly chart component
  function HourlyChart() {
    const activeHours = Object.entries(byHour).filter(([, v]) => v.revenue > 0);
    if (activeHours.length === 0) return <div className="text-sm text-muted-foreground py-4">Geen data</div>;
    return (
      <div className="flex items-end gap-1 h-32">
        {Object.entries(byHour).filter(([h]) => Number(h) >= 10 && Number(h) <= 23).map(([h, v]) => (
          <div key={h} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full bg-primary/70 rounded-t" style={{ height: `${(v.revenue / peakHour) * 100}%`, minHeight: v.revenue > 0 ? "4px" : "0px" }} />
            <span className="text-[9px] text-muted-foreground">{h}:00</span>
          </div>
        ))}
      </div>
    );
  }

  // Hourly heatmap data
  const hourlyData = Object.entries(byHour)
    .filter(([h]) => Number(h) >= 7 && Number(h) <= 22)
    .map(([h, v]) => ({
      hour: Number(h),
      label: `${h.padStart(2, "0")}:00`,
      revenue: v.revenue,
      orders: v.orders,
      avgTicket: v.orders > 0 ? v.revenue / v.orders : 0,
    }));

  const peakHourEntry = hourlyData.reduce((best, h) => h.revenue > best.revenue ? h : best, hourlyData[0] || { hour: 0, label: "-", revenue: 0, orders: 0, avgTicket: 0 });
  const slowHourEntry = hourlyData.filter(h => h.orders > 0).reduce((worst, h) => h.revenue < worst.revenue ? h : worst, hourlyData.find(h => h.orders > 0) || { hour: 0, label: "-", revenue: 0, orders: 0, avgTicket: 0 });
  const avgOrdersPerHour = hourlyData.length > 0 ? hourlyData.reduce((s, h) => s + h.orders, 0) / hourlyData.filter(h => h.orders > 0).length || 0 : 0;

  // Daypart analysis
  const dayparts = [
    { name: "Ochtend", range: [7, 11] as [number, number] },
    { name: "Lunch", range: [11, 14] as [number, number] },
    { name: "Middag", range: [14, 17] as [number, number] },
    { name: "Avond", range: [17, 22] as [number, number] },
  ];
  const daypartData = dayparts.map(dp => {
    const hours = hourlyData.filter(h => h.hour >= dp.range[0] && h.hour < dp.range[1]);
    return { name: dp.name, revenue: hours.reduce((s, h) => s + h.revenue, 0), orders: hours.reduce((s, h) => s + h.orders, 0) };
  });
  const bestDaypart = daypartData.reduce((best, dp) => dp.revenue > best.revenue ? dp : best, daypartData[0]);

  function getHeatColor(revenue: number): string {
    if (revenue <= 0) return "bg-muted/30";
    const ratio = revenue / peakHour;
    if (ratio < 0.2) return "bg-muted";
    if (ratio < 0.4) return "bg-orange-100 dark:bg-orange-950/30";
    if (ratio < 0.6) return "bg-orange-200 dark:bg-orange-900/40";
    if (ratio < 0.8) return "bg-orange-300 dark:bg-orange-800/50";
    return "bg-red-400 dark:bg-red-700/60";
  }

  const dashTabs = [
    { key: "favorieten", label: "Favorieten" },
    { key: "verkopen", label: "Verkopen" },
    { key: "uuranalyse", label: "Omzet per uur" },
    { key: "service", label: "Service" },
    { key: "prepstation", label: "Prepstation" },
    { key: "reserveringen", label: "Reserveringen" },
    { key: "producten", label: "Producten" },
  ];

  const tabInsights = ALL_INSIGHTS.filter((i) => i.tab === dashTab);
  const favInsights = ALL_INSIGHTS.filter((i) => favorites.includes(i.id));

  // Live orders
  const preparingOrders = (qrOrders || []).filter((o: any) => o.status === "preparing");
  const readyOrders = (qrOrders || []).filter((o: any) => o.status === "ready");

  function OrderCard({ order, statusLabel, statusColor, actionLabel, actionColor }: any) {
    return (
      <div className="rounded-xl border bg-card p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-muted-foreground" />
            <span className="font-bold text-sm">Tafel {order.table_id}</span>
          </div>
          <Badge className={clsx("text-[10px]", statusColor)}>{statusLabel}</Badge>
        </div>
        {order.customer_name && (
          <div className="text-xs text-muted-foreground flex items-center gap-3">
            <span className="font-medium text-foreground">{order.customer_name}</span>
          </div>
        )}
        <div className="space-y-0.5">
          {(order.items || []).map((item: any, idx: number) => (
            <div key={idx} className="text-xs flex justify-between">
              <span>{item.qty}× {item.name}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-muted-foreground">{new Date(order.created_at).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}</span>
          <Button size="sm" className={clsx("text-xs rounded-lg h-7", actionColor)} onClick={() => onAdvanceOrder(order)}>{actionLabel}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with date navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black">Dashboard</h2>
          <p className="text-xs text-muted-foreground">Laatst bijgewerkt om {formatTime(new Date())}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => navigateDate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => navigateDate(1)}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" className="rounded-xl gap-1.5">
            <CalendarDays className="h-4 w-4" />
            {dateLabel(selectedDate)}
          </Button>
          <div className="flex border rounded-xl overflow-hidden">
            {(["day", "month", "quarter"] as const).map((m) => (
              <button key={m} onClick={() => setPeriodMode(m)}
                className={clsx("px-3 py-1.5 text-xs font-medium transition", periodMode === m ? "bg-foreground text-background" : "hover:bg-muted")}>
                {m === "day" ? "Dag" : m === "month" ? "Maand" : "Kwartaal"}
              </button>
            ))}
          </div>
          <Button variant={compareMode ? "default" : "outline"} size="sm" className="rounded-xl gap-1.5" onClick={() => setCompareMode(!compareMode)}>
            ⇅ Vergelijk {compareMode && <X className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2">
        {dashTabs.map((tab) => (
          <button key={tab.key} onClick={() => setDashTab(tab.key)}
            className={clsx("px-4 py-2 rounded-full text-sm font-medium transition",
              dashTab === tab.key ? "bg-foreground text-background" : "bg-muted/50 hover:bg-muted")}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Live orders (always visible if active) */}
      {(preparingOrders.length > 0 || readyOrders.length > 0) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-orange-600" />
            <h3 className="text-base font-bold">Live Bestellingen</h3>
            <Badge variant="secondary" className="text-xs">{preparingOrders.length + readyOrders.length} actief</Badge>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-1"><div className="h-2.5 w-2.5 rounded-full bg-orange-500 animate-pulse" /><span className="text-sm font-semibold text-orange-700">In bereiding ({preparingOrders.length})</span></div>
              {preparingOrders.length === 0 ? <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">Geen</div> :
                preparingOrders.map((o: any) => <OrderCard key={o.id} order={o} statusLabel="Bereiding" statusColor="bg-orange-100 text-orange-800" actionLabel="✓ Klaar" actionColor="bg-green-600 hover:bg-green-700" />)}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-1"><div className="h-2.5 w-2.5 rounded-full bg-green-500" /><span className="text-sm font-semibold text-green-700">Klaar ({readyOrders.length})</span></div>
              {readyOrders.length === 0 ? <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">Geen</div> :
                readyOrders.map((o: any) => <OrderCard key={o.id} order={o} statusLabel="Klaar" statusColor="bg-green-100 text-green-800" actionLabel="✓ Geserveerd" actionColor="bg-blue-600 hover:bg-blue-700" />)}
            </div>
          </div>
        </div>
      )}

      {/* TAB: Favorieten */}
      {dashTab === "favorieten" && (
        <div className="space-y-4">
          {favInsights.length === 0 ? (
            <Card className="rounded-2xl">
              <CardContent className="p-8 text-center">
                <Star className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="font-medium">Geen favorieten geselecteerd</p>
                <p className="text-sm text-muted-foreground mt-1">Ga naar een tabblad en klik op ⭐ om inzichten als favoriet toe te voegen.</p>
                <Button variant="outline" className="mt-4" onClick={() => setShowFavPicker(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Favorieten selecteren
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowFavPicker(true)}>
                  <Edit className="h-3.5 w-3.5 mr-1" /> Favorieten beheren
                </Button>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {favInsights.map((insight) => <InsightCard key={insight.id} insight={insight} />)}
              </div>
            </>
          )}
          <Modal open={showFavPicker} onClose={() => setShowFavPicker(false)} wide>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Favoriete inzichten selecteren</h2>
                <button onClick={() => setShowFavPicker(false)} className="p-2 hover:bg-neutral-100 rounded-full"><X className="h-5 w-5" /></button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {ALL_INSIGHTS.map((insight) => {
                  const isFav = favorites.includes(insight.id);
                  return (
                    <button key={insight.id} onClick={() => toggleFavorite(insight.id)}
                      className={clsx("rounded-xl border p-3 text-left transition-all", isFav ? "border-yellow-400 bg-yellow-50" : "hover:bg-muted/50")}>
                      <div className="flex items-center justify-between">
                        <span className={clsx("text-sm font-medium", insight.color)}>{insight.label}</span>
                        <Star className={clsx("h-4 w-4", isFav ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} />
                      </div>
                      <span className="text-[10px] text-muted-foreground capitalize">{insight.tab}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </Modal>
        </div>
      )}

      {/* TAB: Verkopen */}
      {dashTab === "verkopen" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card className="rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium underline underline-offset-2 decoration-dotted text-blue-600">Omzetoverzicht →</span>
                  <div className="flex items-center gap-1">
                    <button className="p-1 rounded-full hover:bg-muted"><span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-foreground text-background text-[10px] font-bold">i</span></button>
                    <button className="p-1 rounded-full hover:bg-muted" onClick={() => toggleFavorite("revenue")}><Star className={clsx("h-4 w-4", favorites.includes("revenue") ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} /></button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">Bruto-omzet</div>
                <div className="text-3xl font-black">{euro(revenue)}</div>
                <div className="mt-3"><HourlyChart /></div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium underline underline-offset-2 decoration-dotted text-blue-600">Bestellingen →</span>
                  <div className="flex items-center gap-1">
                    <button className="p-1 rounded-full hover:bg-muted"><span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-foreground text-background text-[10px] font-bold">i</span></button>
                    <button className="p-1 rounded-full hover:bg-muted" onClick={() => toggleFavorite("order_revenue")}><Star className={clsx("h-4 w-4", favorites.includes("order_revenue") ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} /></button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">Omzet van alle bestellingen</div>
                <div className="text-3xl font-black">{euro(orderRevenue)}</div>
                <div className="mt-3"><HourlyChart /></div>
              </CardContent>
            </Card>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              ALL_INSIGHTS.find((i) => i.id === "avg_ticket")!,
              ALL_INSIGHTS.find((i) => i.id === "avg_order")!,
              ALL_INSIGHTS.find((i) => i.id === "order_count")!,
            ].map((insight) => <InsightCard key={insight.id} insight={insight} />)}
          </div>
        </div>
      )}

      {/* TAB: Omzet per uur / Heatmap */}
      {dashTab === "uuranalyse" && (
        <div className="space-y-4">
          {/* KPI mini cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="rounded-2xl border-orange-200 dark:border-orange-800/30">
              <CardContent className="p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Piekuur</div>
                <div className="text-xl font-black">{peakHourEntry?.label || "-"}</div>
                <div className="text-xs text-muted-foreground">{peakHourEntry ? `${peakHourEntry.orders} orders · ${euro(peakHourEntry.revenue)}` : ""}</div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardContent className="p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Rustigste uur</div>
                <div className="text-xl font-black">{slowHourEntry?.label || "-"}</div>
                <div className="text-xs text-muted-foreground">{slowHourEntry ? `${slowHourEntry.orders} orders · ${euro(slowHourEntry.revenue)}` : ""}</div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardContent className="p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Gem. orders/uur</div>
                <div className="text-xl font-black">{avgOrdersPerHour.toFixed(1)}</div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardContent className="p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Hoogste omzet</div>
                <div className="text-xl font-black">{euro(peakHourEntry?.revenue || 0)}</div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl bg-primary/5">
              <CardContent className="p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Beste dagdeel</div>
                <div className="text-xl font-black">{bestDaypart?.name || "-"}</div>
                <div className="text-xs text-muted-foreground">{bestDaypart ? euro(bestDaypart.revenue) : ""}</div>
              </CardContent>
            </Card>
          </div>

          {/* Peak hour summary */}
          {peakHourEntry && peakHourEntry.orders > 0 && (
            <Card className="rounded-2xl border-orange-300 dark:border-orange-700/40 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <div className="text-sm font-bold">Piekuur: {peakHourEntry.label} – {String(peakHourEntry.hour + 1).padStart(2, "0")}:00</div>
                  <div className="text-xs text-muted-foreground">{peakHourEntry.orders} bestellingen · {euro(peakHourEntry.revenue)} omzet · gem. bon {euro(peakHourEntry.avgTicket)}</div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Heatmap Table */}
          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Omzet per uur — Heatmap
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hourlyData.every(h => h.orders === 0) ? (
                <div className="text-sm text-muted-foreground py-8 text-center">Geen data voor deze periode</div>
              ) : (
                <div className="space-y-1">
                  {/* Header */}
                  <div className="grid grid-cols-4 gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 pb-1">
                    <span>Tijd</span><span className="text-right">Orders</span><span className="text-right">Omzet</span><span className="text-right">Gem. bon</span>
                  </div>
                  {hourlyData.map((h) => (
                    <div key={h.hour} className={clsx("grid grid-cols-4 gap-2 items-center px-3 py-2 rounded-xl transition-all", getHeatColor(h.revenue))}>
                      <span className="text-sm font-bold">{h.label}</span>
                      <span className="text-sm text-right font-mono">{h.orders}</span>
                      <span className="text-sm text-right font-mono font-bold">{euro(h.revenue)}</span>
                      <span className="text-sm text-right font-mono text-muted-foreground">{h.orders > 0 ? euro(h.avgTicket) : "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Visual Heatmap Bar */}
          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Visuele intensiteit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-1 items-end h-28">
                {hourlyData.map((h) => (
                  <div key={h.hour} className="flex-1 flex flex-col items-center gap-1">
                    <div className={clsx("w-full rounded-t transition-all", getHeatColor(h.revenue))}
                      style={{ height: `${h.revenue > 0 ? Math.max((h.revenue / peakHour) * 100, 8) : 4}%` }} />
                    <span className="text-[8px] text-muted-foreground">{h.label.slice(0, 2)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3 justify-center">
                <span className="text-[9px] text-muted-foreground">Laag</span>
                <div className="flex gap-0.5">{["bg-muted", "bg-orange-100", "bg-orange-200", "bg-orange-300", "bg-red-400"].map((c, i) => <div key={i} className={clsx("h-3 w-6 rounded", c)} />)}</div>
                <span className="text-[9px] text-muted-foreground">Piek</span>
              </div>
            </CardContent>
          </Card>

          {/* Daypart breakdown */}
          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Dagdeel analyse</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-3">
                {daypartData.map((dp) => (
                  <div key={dp.name} className={clsx("rounded-xl p-3 text-center border transition", dp.name === bestDaypart?.name ? "border-primary bg-primary/5" : "")}>
                    <div className="text-xs font-medium text-muted-foreground">{dp.name}</div>
                    <div className="text-lg font-black mt-1">{euro(dp.revenue)}</div>
                    <div className="text-xs text-muted-foreground">{dp.orders} orders</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Staffing insights */}
          {peakHourEntry && peakHourEntry.orders >= 5 && (
            <Card className="rounded-2xl border-blue-200 dark:border-blue-800/30 bg-blue-50/50 dark:bg-blue-950/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-600" /> Operationele inzichten
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-xs flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Extra personeel overwegen tussen {peakHourEntry.label} en {String(peakHourEntry.hour + 2).padStart(2, "0")}:00</div>
                {slowHourEntry && slowHourEntry.orders > 0 && (
                  <div className="text-xs flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Rustigste periode: {slowHourEntry.label} — mogelijk personeel reduceren</div>
                )}
                {bestDaypart && (
                  <div className="text-xs flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> {bestDaypart.name} is het sterkste dagdeel met {euro(bestDaypart.revenue)} omzet</div>
                )}
                <div className="text-xs flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Prepstation capaciteit afstemmen op piektijden voor snellere doorlooptijd</div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {dashTab === "service" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              ALL_INSIGHTS.find((i) => i.id === "avg_table_time")!,
              ALL_INSIGHTS.find((i) => i.id === "total_tips")!,
              ALL_INSIGHTS.find((i) => i.id === "tip_pct")!,
            ].map((insight) => <InsightCard key={insight.id} insight={insight} />)}
          </div>
          <div className="grid grid-cols-1 gap-4">
            {[ALL_INSIGHTS.find((i) => i.id === "avg_table_revenue")!].map((insight) => <InsightCard key={insight.id} insight={insight} />)}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              ALL_INSIGHTS.find((i) => i.id === "total_discounts")!,
              ALL_INSIGHTS.find((i) => i.id === "returning_customers")!,
            ].map((insight) => <InsightCard key={insight.id} insight={insight} />)}
          </div>
        </div>
      )}

      {/* TAB: Prepstation */}
      {dashTab === "prepstation" && (
        <div className="grid grid-cols-2 gap-4">
          {ALL_INSIGHTS.filter((i) => i.tab === "prepstation").map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      )}

      {/* TAB: Reserveringen */}
      {dashTab === "reserveringen" && (
        <div className="space-y-4">
          <Card className="rounded-2xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium underline underline-offset-2 decoration-dotted text-cyan-600">Aantal reserveringen →</span>
                <div className="flex items-center gap-1">
                  <button className="p-1 rounded-full hover:bg-muted"><span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-foreground text-background text-[10px] font-bold">i</span></button>
                  <button className="p-1 rounded-full hover:bg-muted" onClick={() => toggleFavorite("res_count")}><Star className={clsx("h-4 w-4", favorites.includes("res_count") ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} /></button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div><div className="text-xs text-muted-foreground">Ingecheckte reserveringen</div><div className="text-2xl font-black">{confirmedRes}</div></div>
                <div><div className="text-xs text-muted-foreground">Walk-ins</div><div className="text-2xl font-black">{walkIns}</div></div>
                <div><div className="text-xs text-muted-foreground">Aankomende reserveringen</div><div className="text-2xl font-black">0</div></div>
              </div>
              <HourlyChart />
            </CardContent>
          </Card>
          <div className="grid grid-cols-3 gap-4">
            {[
              ALL_INSIGHTS.find((i) => i.id === "avg_group_size")!,
              ALL_INSIGHTS.find((i) => i.id === "cancellations")!,
              ALL_INSIGHTS.find((i) => i.id === "no_shows")!,
            ].map((insight) => <InsightCard key={insight.id} insight={insight} />)}
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              ALL_INSIGHTS.find((i) => i.id === "waitlist")!,
              ALL_INSIGHTS.find((i) => i.id === "couverts")!,
            ].map((insight) => <InsightCard key={insight.id} insight={insight} />)}
          </div>
        </div>
      )}

      {/* TAB: Producten */}
      {dashTab === "producten" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              ALL_INSIGHTS.find((i) => i.id === "products_sold")!,
              ALL_INSIGHTS.find((i) => i.id === "avg_products_per_order")!,
              ALL_INSIGHTS.find((i) => i.id === "cost_pct")!,
            ].map((insight) => insight && <InsightCard key={insight.id} insight={insight} />)}
          </div>
          <div className="grid grid-cols-1 gap-4">
            <InsightCard insight={ALL_INSIGHTS.find((i) => i.id === "cost_pct")!} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InsightCard insight={ALL_INSIGHTS.find((i) => i.id === "top_categories")!} />
            <InsightCard insight={ALL_INSIGHTS.find((i) => i.id === "top_products")!} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ACTIVITY / ORDER HISTORY ────────────────────────────────────────────────

function ActivityView({ orders, employees }: any) {
  const [search, setSearch] = useState("");
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [dateMode, setDateMode] = useState<"all" | "today" | "week" | "custom">("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const filtered = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7)); // Monday

    return orders.filter((o: any) => {
      // Employee filter
      if (filterEmployee !== "all" && o.employeeId !== filterEmployee) return false;

      // Date filter
      const d = o.date instanceof Date ? o.date : new Date(o.date);
      if (dateMode === "today" && d < startOfToday) return false;
      if (dateMode === "week" && d < startOfWeek) return false;
      if (dateMode === "custom") {
        if (customFrom && d < new Date(customFrom + "T00:00:00")) return false;
        if (customTo && d > new Date(customTo + "T23:59:59")) return false;
      }

      // Search filter
      if (search) {
        const q = search.toLowerCase();
        if (
          !o.id.toLowerCase().includes(q) &&
          !(o.customerName || "").toLowerCase().includes(q) &&
          !(o.employeeName || "").toLowerCase().includes(q)
        ) return false;
      }

      return true;
    }).reverse();
  }, [orders, filterEmployee, dateMode, customFrom, customTo, search]);

  const totalRevenue = filtered.reduce((s: number, o: any) => s + (o.total || 0), 0);

  // Derive unique employees from orders for the dropdown
  const employeeOptions = useMemo(() => {
    const map = new Map<string, string>();
    orders.forEach((o: any) => {
      if (o.employeeId && o.employeeName) map.set(o.employeeId, o.employeeName);
    });
    // Also add from employees prop
    (employees || []).forEach((e: any) => map.set(e.id, e.name));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [orders, employees]);

  return (
    <div className="space-y-4">
      {/* Filters — stacked for iPad touch friendliness */}
      <div className="flex flex-col gap-3">
        {/* Row 1: Search + Employee */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Zoek order, klant, medewerker..." className="pl-10 h-12 rounded-2xl text-sm" />
          </div>
          <select
            value={filterEmployee}
            onChange={(e) => setFilterEmployee(e.target.value)}
            className="h-12 min-w-[170px] rounded-2xl border border-white/80 bg-white/70 backdrop-blur-lg px-3.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-200 touch-manipulation"
          >
            <option value="all">Alle medewerkers</option>
            {employeeOptions.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>

        {/* Row 2: Date pills + custom + summary */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-2xl border border-white/80 bg-white/70 backdrop-blur-lg p-1 shadow-sm">
            {([["all", "Alles"], ["today", "Vandaag"], ["week", "Week"], ["custom", "Custom"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setDateMode(key)}
                className={clsx(
                  "min-h-[44px] px-4 rounded-xl text-sm font-medium transition-all touch-manipulation",
                  dateMode === key
                    ? "bg-gradient-to-b from-violet-500 to-indigo-500 text-white shadow-md"
                    : "text-slate-600 hover:bg-white/80 active:bg-white/90"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {dateMode === "custom" && (
            <div className="flex items-center gap-2">
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-12 rounded-2xl w-[150px] text-sm touch-manipulation" />
              <span className="text-sm text-slate-400">→</span>
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-12 rounded-2xl w-[150px] text-sm touch-manipulation" />
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <Badge variant="secondary" className="rounded-xl h-8 px-3 text-sm">{filtered.length} orders</Badge>
            <Badge className="rounded-xl h-8 px-3 text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0">{euro(totalRevenue)}</Badge>
          </div>
        </div>
      </div>

      {/* Orders list — touch-optimized rows */}
      <Card className="rounded-2xl">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-16 text-sm">Geen orders gevonden.</div>
          ) : (
            <div className="divide-y">
              {filtered.map((order: any) => (
                <button
                  key={order.id}
                  onClick={() => setReceiptOrder(order)}
                  className="flex items-center justify-between w-full text-left min-h-[56px] px-4 py-3 hover:bg-neutral-50 active:bg-neutral-100 transition touch-manipulation"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0">
                      <div className="font-mono text-sm font-medium">#{order.id}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(order.date)} · {formatTime(order.date)}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm truncate">{order.customerName || "Walk-in"}</div>
                      <div className="text-xs text-muted-foreground">{order.items.length} item{order.items.length !== 1 ? "s" : ""}</div>
                    </div>
                    {order.employeeName && (
                      <Badge variant="outline" className="text-[11px] rounded-full shrink-0">{order.employeeName.split(" ")[0]}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="capitalize text-xs">{order.method}</Badge>
                    {order.status === "refunded" && <Badge variant="destructive" className="text-xs">Refunded</Badge>}
                    <div className="font-semibold text-sm">{euro(order.total)}</div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
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

function ReservationsView({ reservations, setReservations, tables, addLog, onCreateReservation, onUpdateReservation, onDeleteReservation }: any) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", date: "", time: "", guests: "2", table: "", phone: "", notes: "" });

  async function addReservation() {
    if (!form.name || !form.date || !form.time || !onCreateReservation) return;
    await onCreateReservation({
      guest_name: form.name,
      reservation_date: form.date,
      reservation_time: form.time,
      guests: parseInt(form.guests) || 2,
      table_name: form.table || null,
      phone: form.phone || null,
      notes: form.notes || null,
      status: "confirmed",
    });
    addLog?.("reservation_created", `Reservering aangemaakt: ${form.name} — ${form.date} ${form.time}, ${form.guests} gasten, tafel ${form.table}`);
    setShowAdd(false);
    setForm({ name: "", date: "", time: "", guests: "2", table: "", phone: "", notes: "" });
  }

  async function updateStatus(id: string, status: string) {
    const r = reservations.find((x: any) => x.id === id);
    if (onUpdateReservation) await onUpdateReservation(id, { status });
    addLog?.("reservation_status_changed", `Reservering status gewijzigd: ${r?.name || id} → ${status}`);
  }

  async function removeReservation(id: string) {
    const r = reservations.find((x: any) => x.id === id);
    addLog?.("reservation_deleted", `Reservering verwijderd: ${r?.name || id}`);
    if (onDeleteReservation) await onDeleteReservation(id);
  }


  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Badge variant="secondary">{reservations.length} reservations</Badge>
        <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-2" />New reservation</Button>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {reservations.length === 0 ? (
          <Card className="rounded-2xl">
            <CardContent className="p-8 text-center">
              <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <div className="font-medium text-muted-foreground">Geen reserveringen</div>
              <div className="text-xs text-muted-foreground mt-1">Maak een nieuwe reservering aan om te beginnen.</div>
            </CardContent>
          </Card>
        ) : reservations.map((r) => (
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

function ProductsView({ products: allProducts, setProducts, currentRole, currentEmployee, addLog, setNotifications, modifierGroups, modifierLinks, onRefetchModifiers, onToast, locationId, upsellRules, onRefetchUpsell, onCreateProduct, onUpdateProduct, onDeleteProduct }: any) {
  const [activeTab, setActiveTab] = useState<"products" | "modifiers" | "upsell">("products");
  const [search, setSearch] = useState("");
  const [filterSection, setFilterSection] = useState("all");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", section: "Hot Drinks", price: "", costPrice: "", color: "#94a3b8", tags: "", modifierGroupIds: [], vatRate: "" });

  const isOwner = currentRole === "owner";

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
        costPrice: String(product.costPrice || ""),
        color: product.color || "#94a3b8",
        tags: (product.tags || []).join(", "),
        modifierGroupIds: (product.modifierGroups || []).map((g) => g.id),
        vatRate: product.vatRate != null ? String(product.vatRate) : "",
      });
      addLog?.("product_edit_open", `Product bewerken geopend: ${product.name}`);
    } else {
      setEditing("new");
      setForm({ name: "", section: "Hot Drinks", price: "", costPrice: "", color: SECTION_COLORS["Hot Drinks"] || "#94a3b8", tags: "", modifierGroupIds: [], vatRate: "" });
      addLog?.("product_add_open", "Nieuw product formulier geopend");
    }
  }

  function toggleModifierGroup(groupId) {
    setForm((prev) => {
      const ids = prev.modifierGroupIds;
      return { ...prev, modifierGroupIds: ids.includes(groupId) ? ids.filter((x) => x !== groupId) : [...ids, groupId] };
    });
  }

  async function saveProduct() {
    if (!form.name || !form.price) return;
    const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
    const costPrice = form.costPrice ? parseFloat(form.costPrice) : 0;
    const vatRate = form.vatRate !== "" ? parseFloat(form.vatRate) : null;
    if (editing === "new") {
      if (!onCreateProduct) return;
      await onCreateProduct({
        name: form.name, section: form.section, price: parseFloat(form.price),
        cost_price: costPrice, vat_rate: vatRate, color: form.color, tags,
      });
      addLog?.("product_created", `Product aangemaakt: ${form.name} (${euro(parseFloat(form.price))})`);
      if (currentRole !== "owner") {
        setNotifications?.((prev: any[]) => [
          ...prev,
          { id: generateId(), type: "product_created", message: `${currentEmployee?.name} heeft een nieuw product aangemaakt: ${form.name}`, timestamp: new Date(), read: false },
        ]);
      }
    } else {
      if (!onUpdateProduct) return;
      await onUpdateProduct(editing, {
        name: form.name, section: form.section, price: parseFloat(form.price),
        cost_price: costPrice, vat_rate: vatRate, color: form.color, tags,
      });
      addLog?.("product_updated", `Product bijgewerkt: ${form.name}`);
    }
    setEditing(null);
  }

  async function deleteProduct(id: string) {
    const product = allProducts.find((p: any) => p.id === id);
    if (onDeleteProduct) await onDeleteProduct(id);
    addLog?.("product_deleted", `Product verwijderd: ${product?.name || id}`);
  }


  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-2 flex-wrap">
        <Button variant={activeTab === "products" ? "default" : "outline"} onClick={() => setActiveTab("products")} className="min-h-[44px]">
          <ShoppingCart className="h-4 w-4 mr-2" /> Producten
        </Button>
        <Button variant={activeTab === "modifiers" ? "default" : "outline"} onClick={() => setActiveTab("modifiers")} className="min-h-[44px]">
          <Zap className="h-4 w-4 mr-2" /> Modifiers
        </Button>
        <Button variant={activeTab === "upsell" ? "default" : "outline"} onClick={() => setActiveTab("upsell")} className="min-h-[44px]">
          <Sparkles className="h-4 w-4 mr-2" /> Upsell
        </Button>
      </div>

      {activeTab === "modifiers" ? (
        <ModifiersView groups={modifierGroups} links={modifierLinks} products={allProducts} onRefetch={onRefetchModifiers} onToast={onToast} addLog={addLog} locationId={locationId} />
      ) : activeTab === "upsell" ? (
        <UpsellRulesView rules={upsellRules || []} products={allProducts} onRefetch={onRefetchUpsell || (() => {})} onToast={onToast} addLog={addLog} />
      ) : (
        <>
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
                        <div className="text-xs text-muted-foreground">
                          {product.section} · Inkoop: {euro(product.costPrice || 0)} · {product.modifierGroups?.length || 0} modifiers
                          {product.createdBy && <span className="ml-1">· Door: {product.createdBy}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="font-semibold">{euro(product.price)}</div>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(product)}><Edit className="h-3 w-3" /></Button>
                      {isOwner && (
                        <Button variant="ghost" size="sm" className="text-red-500" onClick={() => deleteProduct(product.id)}><Trash2 className="h-3 w-3" /></Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Modal open={!!editing} onClose={() => setEditing(null)}>
            <div className="p-6 space-y-5 max-h-[85vh] overflow-y-auto">
              {/* ── Part 1: Product Details ── */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-primary" />
                  <h2 className="text-lg font-bold">{editing === "new" ? "New product" : "Edit product"}</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" /></div>
                  <div>
                    <Label>Section</Label>
                    <select value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value, color: SECTION_COLORS[e.target.value] || "#94a3b8" })} className="w-full rounded-lg border px-3 py-2 mt-1 bg-white text-sm">
                      {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div><Label>Verkoopprijs (€)</Label><Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="mt-1" /></div>
                  <div><Label>Inkoopprijs (€)</Label><Input type="number" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} placeholder="Kostprijs" className="mt-1" /></div>
                  <div><Label>Tags (comma-separated)</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Hot, Coffee, Signature" className="mt-1" /></div>
                  <div><Label>BTW % (leeg = categorie)</Label><Input type="number" step="0.5" min="0" max="100" value={form.vatRate} onChange={(e) => setForm({ ...form, vatRate: e.target.value })} placeholder="bijv. 9" className="mt-1" /></div>
                </div>
              </div>

              {/* ── Divider ── */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center"><span className="bg-background px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Add-ons / Modifiers</span></div>
              </div>

              {/* ── Part 2: Modifier Groups ── */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <Label className="text-sm font-semibold">Assign modifier groups to this product</Label>
                </div>
                <p className="text-xs text-muted-foreground">Selected modifiers appear as add-on options when ordering this product.</p>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {ALL_MODIFIER_GROUPS.map((g) => (
                    <button key={g.id} onClick={() => toggleModifierGroup(g.id)}
                      className={clsx("rounded-xl border px-3 py-2 text-left text-sm transition-all",
                        form.modifierGroupIds.includes(g.id) ? "border-black bg-black text-white" : "bg-white hover:bg-neutral-50")}>
                      <div className="font-medium">{g.name}</div>
                      <div className={clsx("text-xs", form.modifierGroupIds.includes(g.id) ? "text-white/70" : "text-muted-foreground")}>{g.options.length} options</div>
                    </button>
                  ))}
                  {ALL_MODIFIER_GROUPS.length === 0 && (
                    <p className="col-span-2 text-xs text-muted-foreground italic py-2">No modifier groups yet. Create them in the Modifiers tab.</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button onClick={saveProduct} disabled={!form.name || !form.price}>Save</Button>
              </div>
            </div>
          </Modal>
        </>
      )}
    </div>
  );
}

// ─── QR ORDERING ─────────────────────────────────────────────────────────────

function QrView({ features, tables }: any) {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  function downloadQr(tableId: string, tableName: string) {
    const svg = document.getElementById(`qr-${tableId}`);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 600;
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, 600, 600);
      ctx.drawImage(img, 50, 50, 500, 500);
      // Add table name below
      ctx.font = "bold 28px sans-serif";
      ctx.fillStyle = "#000";
      ctx.textAlign = "center";
      const a = document.createElement("a");
      a.download = `saakouk-qr-tafel-${tableName}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  }

  function downloadAll() {
    tables.forEach((t: any, i: number) => {
      setTimeout(() => downloadQr(t.id, t.name), i * 300);
    });
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-lg">QR Table Ordering</h3>
              <p className="text-sm text-muted-foreground">Each table has a unique QR code linking to your digital menu.</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={features?.qr ? "default" : "secondary"}>{features?.qr ? "Enabled" : "Disabled"}</Badge>
              <Button size="sm" onClick={downloadAll} disabled={!features?.qr}>
                <Printer className="h-4 w-4 mr-1" /> Download alle QR's
              </Button>
            </div>
          </div>
          {!features?.qr && (
            <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800 mb-4">
              QR ordering is uitgeschakeld. Schakel het in via Instellingen → Features.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {tables.map((table: any) => {
          const menuUrl = `${baseUrl}/menu/${table.id}`;
          return (
            <Card key={table.id} className="rounded-2xl overflow-hidden">
              <CardContent className="p-4 flex flex-col items-center gap-3">
                <div className="text-sm font-semibold">Tafel {table.name}</div>
                <div className="bg-white p-2 rounded-xl border">
                  <QRCodeSVG
                    id={`qr-${table.id}`}
                    value={menuUrl}
                    size={140}
                    level="M"
                    includeMargin={false}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground text-center break-all leading-tight">{menuUrl}</p>
                <div className="flex gap-2 w-full">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => downloadQr(table.id, table.name)}
                  >
                    <Printer className="h-3 w-3 mr-1" /> Download
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => {
                      navigator.clipboard.writeText(menuUrl);
                    }}
                  >
                    <FileText className="h-3 w-3 mr-1" /> Copy link
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Preview section */}
      <Card className="rounded-2xl">
        <CardContent className="p-6">
          <h3 className="font-semibold mb-3">Menu preview</h3>
          <p className="text-sm text-muted-foreground mb-3">Open the menu as your customers would see it:</p>
          <div className="flex flex-wrap gap-2">
            {tables.map((table: any) => (
              <Button
                key={table.id}
                variant="outline"
                size="sm"
                onClick={() => window.open(`${baseUrl}/menu/${table.id}`, "_blank")}
              >
                <Eye className="h-3 w-3 mr-1" /> Tafel {table.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── CUSTOMERS ───────────────────────────────────────────────────────────────

function CustomersView({ customers, setCustomers, addLog, currentRole, locationId, onToast }: any) {
  const isOwner = currentRole === "owner";

  async function deleteCustomer(id: string) {
    const c = customers.find((x: any) => x.id === id);
    // Optimistic remove
    setCustomers((prev: any[]) => prev.filter((x) => x.id !== id));
    addLog?.("customer_delete_attempt", `Verwijderen klant: ${c?.name || id}`);
    // Note: customers table has no DELETE policy (audit trail) — keep UI-only removal
    // but log the attempt clearly. If a hard-delete is desired, add an RLS DELETE policy.
    addLog?.("customer_deleted_local", `Klant lokaal verwijderd: ${c?.name || id} (DB blijft bewaard voor audit)`);
  }
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", provider: "none" });
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || "").toLowerCase().includes(search.toLowerCase())
  );

  async function addCustomer() {
    const name = form.name.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();
    if (!name) {
      onToast?.("⚠ Naam is verplicht");
      addLog?.("customer_create_validation_failed", "Naam ontbreekt");
      return;
    }
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!email || !emailValid) {
      onToast?.("⚠ Geldig e-mailadres is verplicht");
      addLog?.("customer_create_validation_failed", `Ongeldig e-mailadres: ${email || "(leeg)"}`);
      return;
    }
    if (!phone) {
      onToast?.("⚠ Telefoonnummer is verplicht");
      addLog?.("customer_create_validation_failed", "Telefoon ontbreekt");
      return;
    }
    if (!locationId) {
      onToast?.("⚠ Geen locatie actief — klant niet opgeslagen");
      addLog?.("customer_create_failed", `Geen locationId — ${name}`);
      return;
    }
    setSaving(true);
    addLog?.("customer_create_attempt", `Klant invoeren: ${name} (${email})`);
    const { upsertCustomer } = await import("@/lib/customers");
    const res = await upsertCustomer({
      locationId,
      fullName: name,
      email,
      phone,
      source: "manual",
      incrementVisit: false,
      spentDelta: 0,
    });
    setSaving(false);
    if (res.error) {
      onToast?.(`⚠ Klant niet opgeslagen: ${res.error}`);
      addLog?.("customer_create_failed", `DB-fout: ${res.error}`);
      return;
    }
    addLog?.("customer_created", `Klant opgeslagen in DB: ${name} (${email})`);
    onToast?.(`Klant ${name} opgeslagen`);
    setShowAdd(false);
    setForm({ name: "", email: "", phone: "", provider: "none" });
    // Realtime subscription will refresh the list automatically
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
        {filtered.length === 0 && customers.length === 0 ? (
          <Card className="rounded-2xl">
            <CardContent className="p-8 text-center">
              <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <div className="font-medium text-muted-foreground">Nog geen klanten</div>
              <div className="text-xs text-muted-foreground mt-1">Voeg je eerste klant toe om te beginnen.</div>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Geen resultaten gevonden</div>
        ) : filtered.map((c) => (
          <Card key={c.id} className="rounded-2xl cursor-pointer hover:shadow-md transition" onClick={() => { setSelected(c); addLog?.("customer_viewed", `Klant bekeken: ${c.name}`); }}>
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
                {isOwner && (
                  <Button variant="ghost" size="sm" className="text-red-500 shrink-0" onClick={(e) => { e.stopPropagation(); deleteCustomer(c.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
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
            <div><Label>Name <span className="text-red-500">*</span></Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" /></div>
            <div><Label>Email <span className="text-red-500">*</span></Label><Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="naam@voorbeeld.nl" className="mt-1" /></div>
            <div><Label>Phone <span className="text-red-500">*</span></Label><Input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1" /></div>
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
            <Button variant="outline" onClick={() => setShowAdd(false)} disabled={saving}>Cancel</Button>
            <Button onClick={addCustomer} disabled={!form.name || !form.email || !form.phone || saving}>{saving ? "Opslaan…" : "Save"}</Button>
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

function GiftCardsView({ giftCards, addLog }: any) {
  useEffect(() => {
    addLog?.("giftcards_view_opened", "Cadeaukaarten overzicht geopend");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="secondary">{giftCards.length} cadeaukaarten</Badge>
        <Badge variant="outline" className="text-xs">Alleen uitgifte na verkoop</Badge>
      </div>

      <Card className="rounded-2xl border-dashed bg-muted/30">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0">
            <Gift className="h-4 w-4 text-white" />
          </div>
          <div className="text-sm">
            <div className="font-semibold mb-1">Cadeaukaarten worden uitgegeven na een verkoop</div>
            <div className="text-muted-foreground text-xs leading-relaxed">
              Na het afronden van een transactie krijg je de optie om een cadeaukaart toe te voegen voor de klant.
              Volledige naam, e-mail en telefoonnummer zijn verplicht (zoals bij PassKit-leden).
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3">
        {giftCards.length === 0 ? (
          <Card className="rounded-2xl">
            <CardContent className="p-8 text-center">
              <Gift className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <div className="font-medium text-muted-foreground">Nog geen cadeaukaarten</div>
              <div className="text-xs text-muted-foreground mt-1">Rond een verkoop af om een cadeaukaart uit te geven.</div>
            </CardContent>
          </Card>
        ) : giftCards.map((gc: any) => (
          <Card key={gc.id} className="rounded-2xl">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Gift className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="font-mono font-medium text-sm">{gc.code}</div>
                  <div className="text-xs text-muted-foreground">
                    {gc.customerName}
                    {gc.customerEmail && ` · ${gc.customerEmail}`}
                    {gc.customerPhone && ` · ${gc.customerPhone}`}
                  </div>
                  <div className="text-xs text-muted-foreground">Issued {gc.issuedAt} · Order #{gc.sourceOrderId || "—"}</div>
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
    </div>
  );
}

// ─── POST-SALE GIFT CARD MODAL ───────────────────────────────────────────────

function PostSaleGiftCardModal({ open, onClose, order, onIssue, addLog, passkitConfig }: any) {
  const [step, setStep] = useState<"offer" | "form">("offer");
  const [form, setForm] = useState({ forename: "", surname: "", email: "", phone: "", value: "25", enrolPasskit: true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setStep("offer");
      setForm({ forename: "", surname: "", email: "", phone: "", value: "25", enrolPasskit: true });
      setErrors({});
      setSubmitting(false);
      addLog?.("giftcard_offer_shown", `Cadeaukaart aangeboden na order #${order?.id || "?"}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function decline() {
    addLog?.("giftcard_offer_declined", `Cadeaukaart afgewezen na order #${order?.id || "?"}`);
    onClose();
  }

  function startForm() {
    addLog?.("giftcard_form_started", `Cadeaukaart formulier geopend voor order #${order?.id || "?"}`);
    setStep("form");
  }

  function selectValue(v: string) {
    addLog?.("giftcard_value_selected", `Cadeaukaart waarde gekozen: ${euro(parseFloat(v))}`);
    setForm((f) => ({ ...f, value: v }));
  }

  function togglePasskit(v: boolean) {
    addLog?.("giftcard_passkit_toggle", `PassKit-inschrijving ${v ? "aangevinkt" : "uitgevinkt"}`);
    setForm((f) => ({ ...f, enrolPasskit: v }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    const forename = form.forename.trim();
    const surname = form.surname.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();
    const value = parseFloat(form.value);

    if (!forename) e.forename = "Voornaam verplicht";
    else if (forename.length > 100) e.forename = "Te lang";
    if (!surname) e.surname = "Achternaam verplicht";
    else if (surname.length > 100) e.surname = "Te lang";
    if (!email) e.email = "E-mail verplicht";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Ongeldig e-mailadres";
    else if (email.length > 255) e.email = "Te lang";
    if (!phone) e.phone = "Telefoonnummer verplicht";
    else if (!/^[+\d][\d\s\-()]{6,19}$/.test(phone)) e.phone = "Ongeldig nummer";
    if (!value || value < 5 || value > 1000) e.value = "Waarde 5 – 1000";

    setErrors(e);
    if (Object.keys(e).length > 0) {
      addLog?.("giftcard_validation_failed", `Validatiefouten: ${Object.keys(e).join(", ")}`);
      return false;
    }
    return true;
  }

  async function issue() {
    if (!validate()) return;
    setSubmitting(true);
    const code = `SAAK-2026-${generateId().toUpperCase().slice(0, 4)}`;
    const value = parseFloat(form.value);
    const customerName = `${form.forename.trim()} ${form.surname.trim()}`;
    const email = form.email.trim();
    const phone = form.phone.trim();

    let passkitMemberId: string | null = null;
    let passkitEnrolled = false;

    // Optional PassKit enrolment using the same data
    if (form.enrolPasskit && passkitConfig?.programId) {
      addLog?.("giftcard_passkit_enrol_attempt", `PassKit inschrijving gestart voor ${email}`);
      try {
        const member = await passkitEnrolMember({
          programId: passkitConfig.programId,
          tierId: passkitConfig.tierId,
          externalId: email,
          name: customerName,
          email,
          phone,
        });
        passkitMemberId = member?.id || null;
        passkitEnrolled = true;
        addLog?.("giftcard_passkit_enrolled", `PassKit-lid aangemaakt: ${customerName} <${email}>${passkitMemberId ? ` (id ${passkitMemberId})` : ""}`);
      } catch (err: any) {
        addLog?.("giftcard_passkit_enrol_failed", `PassKit inschrijving mislukt: ${err?.message || err}`);
      }
    }

    const card = {
      id: generateId(),
      code,
      balance: value,
      initialValue: value,
      status: "active",
      issuedAt: new Date().toISOString().slice(0, 10),
      customerName,
      customerEmail: email,
      customerPhone: phone,
      sourceOrderId: order?.id || null,
      passkitMemberId,
      passkitEnrolled,
    };

    try {
      await onIssue(card);
      addLog?.(
        "giftcard_issued",
        `Cadeaukaart ${code} (${euro(value)}) uitgegeven aan ${customerName} <${email}> ${phone} na order #${order?.id || "?"}${passkitEnrolled ? " · PassKit gekoppeld" : ""}`
      );
      onClose();
    } catch (err: any) {
      addLog?.("giftcard_issue_failed", `Opslaan mislukt: ${err?.message || err}`);
      setErrors({ value: `Opslaan mislukt: ${err?.message || "onbekende fout"}` });
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={decline}>
      {step === "offer" ? (
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Gift className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Cadeaukaart toevoegen?</h2>
              <p className="text-xs text-muted-foreground">Order #{order?.id || "?"} — {euro(order?.total || 0)}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Wil de klant een cadeaukaart aanschaffen bij deze aankoop?</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={decline}>Nee, dank je</Button>
            <Button onClick={startForm}>Ja, doorgaan</Button>
          </div>
        </div>
      ) : (
        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <h2 className="text-lg font-bold">Klantgegevens cadeaukaart</h2>
          <p className="text-xs text-muted-foreground">Alle velden verplicht (zoals bij PassKit).</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Voornaam *</Label>
              <Input value={form.forename} onChange={(e) => setForm({ ...form, forename: e.target.value })} className="mt-1" maxLength={100} />
              {errors.forename && <div className="text-xs text-destructive mt-1">{errors.forename}</div>}
            </div>
            <div>
              <Label>Achternaam *</Label>
              <Input value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} className="mt-1" maxLength={100} />
              {errors.surname && <div className="text-xs text-destructive mt-1">{errors.surname}</div>}
            </div>
          </div>

          <div>
            <Label>E-mail *</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" maxLength={255} />
            {errors.email && <div className="text-xs text-destructive mt-1">{errors.email}</div>}
          </div>

          <div>
            <Label>Telefoonnummer *</Label>
            <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1" placeholder="+316..." />
            {errors.phone && <div className="text-xs text-destructive mt-1">{errors.phone}</div>}
          </div>

          <div>
            <Label>Waarde *</Label>
            <div className="grid grid-cols-4 gap-2 mt-1">
              {["10", "15", "25", "50"].map((v) => (
                <Button key={v} variant={form.value === v ? "default" : "outline"} onClick={() => selectValue(v)}>{euro(parseFloat(v))}</Button>
              ))}
            </div>
            <Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="Eigen bedrag" className="mt-2" min={5} max={1000} />
            {errors.value && <div className="text-xs text-destructive mt-1">{errors.value}</div>}
          </div>

          {passkitConfig?.programId && (
            <div className="rounded-xl border border-purple-200 bg-purple-50 p-3 flex items-start gap-3">
              <input
                type="checkbox"
                id="enrol-passkit"
                checked={form.enrolPasskit}
                onChange={(e) => togglePasskit(e.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <label htmlFor="enrol-passkit" className="text-xs leading-relaxed cursor-pointer flex-1">
                <span className="font-semibold text-purple-900 block">Ook inschrijven als PassKit-lid</span>
                <span className="text-purple-700">Dezelfde naam, e-mail en telefoonnummer worden gebruikt om automatisch een loyalty-account aan te maken.</span>
              </label>
            </div>
          )}

          <div className="flex justify-between gap-2 pt-2">
            <Button variant="ghost" onClick={() => { addLog?.("giftcard_form_back", "Terug naar aanbieding"); setStep("offer"); }} disabled={submitting}>Terug</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={decline} disabled={submitting}>Annuleer</Button>
              <Button onClick={issue} disabled={submitting}>{submitting ? "Bezig…" : "Cadeaukaart uitgeven"}</Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── SALES ───────────────────────────────────────────────────────────────────

function SalesView({ orders, products, employees }: any) {
  const [tab, setTab] = useState("overview");
  const [rangeMode, setRangeMode] = useState<"today" | "week" | "month" | "custom">("today");
  const [customStart, setCustomStart] = useState<Date | undefined>(undefined);
  const [customEnd, setCustomEnd] = useState<Date | undefined>(undefined);
  const [showCalendar, setShowCalendar] = useState<"start" | "end" | null>(null);

  function getDateRange(): { start: Date; end: Date; label: string } {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    if (rangeMode === "today") return { start: startOfDay, end: endOfDay, label: "Vandaag" };
    if (rangeMode === "week") {
      const weekAgo = new Date(startOfDay); weekAgo.setDate(weekAgo.getDate() - 6);
      return { start: weekAgo, end: endOfDay, label: "Afgelopen 7 dagen" };
    }
    if (rangeMode === "month") {
      const monthAgo = new Date(startOfDay); monthAgo.setMonth(monthAgo.getMonth() - 1);
      return { start: monthAgo, end: endOfDay, label: "Afgelopen 30 dagen" };
    }
    // custom
    const cs = customStart || startOfDay;
    const ce = customEnd ? new Date(customEnd.getFullYear(), customEnd.getMonth(), customEnd.getDate(), 23, 59, 59, 999) : endOfDay;
    return { start: cs, end: ce, label: `${cs.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })} – ${new Date(ce).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}` };
  }

  const range = getDateRange();
  const filtered = orders.filter((o: any) => o.date >= range.start && o.date <= range.end);
  const revenue = filtered.reduce((s: number, o: any) => s + o.total, 0);
  const itemsSold = filtered.reduce((s: number, o: any) => s + o.items.reduce((a: number, i: any) => a + i.qty, 0), 0);
  const avgTicket = filtered.length > 0 ? revenue / filtered.length : 0;
  const totalTips = filtered.reduce((s: number, o: any) => s + (o.tip || 0), 0);
  const totalDiscount = filtered.reduce((s: number, o: any) => s + (o.discount || 0), 0);

  // Profit/Loss calculations
  const totalCost = filtered.reduce((s: number, o: any) => s + o.items.reduce((a: number, i: any) => a + (i.costPrice || 0) * i.qty, 0), 0);
  const grossProfit = revenue - totalCost;
  const profitMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  // By section
  const bySection: Record<string, number> = {};
  filtered.forEach((o: any) => o.items.forEach((item: any) => {
    const product = products.find((p: any) => p.id === item.productId);
    const sec = product?.section || "Other";
    bySection[sec] = (bySection[sec] || 0) + (item.price + item.modifiers.reduce((s: number, m: any) => s + m.price, 0)) * item.qty;
  }));

  // By employee — with daily breakdown
  const byEmployee: Record<string, { name: string; orders: number; revenue: number; items: number; tips: number; byDay: Record<string, { orders: number; revenue: number; tips: number }> }> = {};
  filtered.forEach((o: any) => {
    const eid = o.employeeId || "unknown";
    const ename = o.employeeName || "Onbekend";
    if (!byEmployee[eid]) byEmployee[eid] = { name: ename, orders: 0, revenue: 0, items: 0, tips: 0, byDay: {} };
    byEmployee[eid].orders++;
    byEmployee[eid].revenue += o.total;
    byEmployee[eid].items += o.items.reduce((a: number, i: any) => a + i.qty, 0);
    byEmployee[eid].tips += o.tip || 0;
    const dayKey = o.date.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
    if (!byEmployee[eid].byDay[dayKey]) byEmployee[eid].byDay[dayKey] = { orders: 0, revenue: 0, tips: 0 };
    byEmployee[eid].byDay[dayKey].orders++;
    byEmployee[eid].byDay[dayKey].revenue += o.total;
    byEmployee[eid].byDay[dayKey].tips += o.tip || 0;
  });

  // By hour — with best hours analysis
  const byHour: Record<number, { orders: number; revenue: number }> = {};
  for (let h = 6; h <= 23; h++) byHour[h] = { orders: 0, revenue: 0 };
  filtered.forEach((o: any) => {
    const h = o.date.getHours();
    if (!byHour[h]) byHour[h] = { orders: 0, revenue: 0 };
    byHour[h].orders++;
    byHour[h].revenue += o.total;
  });
  const peakHourRevenue = Math.max(...Object.values(byHour).map((v) => v.revenue), 1);
  const sortedHours = Object.entries(byHour).filter(([, v]) => v.revenue > 0).sort((a, b) => b[1].revenue - a[1].revenue);
  const bestHours = sortedHours.slice(0, 3);
  const slowestHours = sortedHours.length > 3 ? sortedHours.slice(-3).reverse() : [];

  // By day
  const byDay: Record<string, { orders: number; revenue: number; tips: number; date: string; rawDate: Date }> = {};
  filtered.forEach((o: any) => {
    const key = o.date.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
    if (!byDay[key]) byDay[key] = { orders: 0, revenue: 0, tips: 0, date: key, rawDate: new Date(o.date.getFullYear(), o.date.getMonth(), o.date.getDate()) };
    byDay[key].orders++;
    byDay[key].revenue += o.total;
    byDay[key].tips += o.tip || 0;
  });
  const sortedDays = Object.values(byDay).sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());
  const bestDay = sortedDays.length > 0 ? sortedDays.reduce((a, b) => a.revenue > b.revenue ? a : b) : null;

  // Top products
  const topProducts: Record<string, { name: string; qty: number; revenue: number; cost: number }> = {};
  filtered.forEach((o: any) => o.items.forEach((item: any) => {
    if (!topProducts[item.productId]) topProducts[item.productId] = { name: item.name, qty: 0, revenue: 0, cost: 0 };
    topProducts[item.productId].qty += item.qty;
    topProducts[item.productId].revenue += (item.price + item.modifiers.reduce((s: number, m: any) => s + m.price, 0)) * item.qty;
    topProducts[item.productId].cost += (item.costPrice || 0) * item.qty;
  }));
  const topList = Object.values(topProducts).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  // Profit by section
  const profitBySection: Record<string, { revenue: number; cost: number }> = {};
  filtered.forEach((o: any) => o.items.forEach((item: any) => {
    const product = products.find((p: any) => p.id === item.productId);
    const sec = product?.section || "Other";
    if (!profitBySection[sec]) profitBySection[sec] = { revenue: 0, cost: 0 };
    profitBySection[sec].revenue += (item.price + item.modifiers.reduce((s: number, m: any) => s + m.price, 0)) * item.qty;
    profitBySection[sec].cost += (item.costPrice || 0) * item.qty;
  }));

  // Payment methods
  const byMethod: Record<string, number> = {};
  filtered.forEach((o: any) => { byMethod[o.method] = (byMethod[o.method] || 0) + o.total; });

  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

  const tabs = [
    { key: "overview", label: "Overzicht", icon: TrendingUp },
    { key: "employees", label: "Per medewerker", icon: Users },
    { key: "hourly", label: "Piek uren", icon: Zap },
    { key: "daily", label: "Per dag", icon: CalendarDays },
    { key: "products", label: "Producten", icon: Package },
    { key: "profit", label: "Winst & Verlies", icon: DollarSign },
  ];

  return (
    <div className="space-y-4">
      {/* Period selector with calendar */}
      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1">
              {([
                { key: "today", label: "Vandaag" },
                { key: "week", label: "7 dagen" },
                { key: "month", label: "30 dagen" },
                { key: "custom", label: "📅 Aangepast" },
              ] as const).map((r) => (
                <Button key={r.key} variant={rangeMode === r.key ? "default" : "outline"} size="sm" className="text-xs rounded-full" onClick={() => setRangeMode(r.key)}>
                  {r.label}
                </Button>
              ))}
            </div>
            {rangeMode === "custom" && (
              <div className="flex items-center gap-2 relative">
                <div className="relative">
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowCalendar(showCalendar === "start" ? null : "start")}>
                    {customStart ? customStart.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" }) : "Startdatum"}
                  </Button>
                  {showCalendar === "start" && (
                    <div className="absolute top-full left-0 mt-1 z-50 bg-card border rounded-xl shadow-xl">
                      <div className="p-3 pointer-events-auto">
                        <DayPicker
                          mode="single"
                          selected={customStart}
                          onSelect={(d) => { setCustomStart(d || undefined); setShowCalendar(null); }}
                          className="pointer-events-auto"
                          classNames={{
                            months: "flex flex-col",
                            month: "space-y-2",
                            caption: "flex justify-center pt-1 relative items-center",
                            caption_label: "text-sm font-medium",
                            nav: "space-x-1 flex items-center",
                            nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-md border border-input",
                            nav_button_previous: "absolute left-1",
                            nav_button_next: "absolute right-1",
                            table: "w-full border-collapse",
                            head_row: "flex",
                            head_cell: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
                            row: "flex w-full mt-1",
                            cell: "h-8 w-8 text-center text-sm p-0 relative",
                            day: "h-8 w-8 p-0 font-normal rounded-md hover:bg-accent cursor-pointer inline-flex items-center justify-center",
                            day_selected: "bg-primary text-primary-foreground hover:bg-primary",
                            day_today: "bg-accent text-accent-foreground",
                            day_outside: "text-muted-foreground opacity-50",
                            day_disabled: "text-muted-foreground opacity-50",
                          }}
                          components={{
                            IconLeft: () => <ChevronLeft className="h-4 w-4" />,
                            IconRight: () => <ChevronRight className="h-4 w-4" />,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">t/m</span>
                <div className="relative">
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowCalendar(showCalendar === "end" ? null : "end")}>
                    {customEnd ? customEnd.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" }) : "Einddatum"}
                  </Button>
                  {showCalendar === "end" && (
                    <div className="absolute top-full left-0 mt-1 z-50 bg-card border rounded-xl shadow-xl">
                      <div className="p-3 pointer-events-auto">
                        <DayPicker
                          mode="single"
                          selected={customEnd}
                          onSelect={(d) => { setCustomEnd(d || undefined); setShowCalendar(null); }}
                          className="pointer-events-auto"
                          classNames={{
                            months: "flex flex-col",
                            month: "space-y-2",
                            caption: "flex justify-center pt-1 relative items-center",
                            caption_label: "text-sm font-medium",
                            nav: "space-x-1 flex items-center",
                            nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-md border border-input",
                            nav_button_previous: "absolute left-1",
                            nav_button_next: "absolute right-1",
                            table: "w-full border-collapse",
                            head_row: "flex",
                            head_cell: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
                            row: "flex w-full mt-1",
                            cell: "h-8 w-8 text-center text-sm p-0 relative",
                            day: "h-8 w-8 p-0 font-normal rounded-md hover:bg-accent cursor-pointer inline-flex items-center justify-center",
                            day_selected: "bg-primary text-primary-foreground hover:bg-primary",
                            day_today: "bg-accent text-accent-foreground",
                            day_outside: "text-muted-foreground opacity-50",
                            day_disabled: "text-muted-foreground opacity-50",
                          }}
                          components={{
                            IconLeft: () => <ChevronLeft className="h-4 w-4" />,
                            IconRight: () => <ChevronRight className="h-4 w-4" />,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <Badge variant="secondary" className="text-xs ml-auto">{range.label} · {filtered.length} orders</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Tab navigation */}
      <div className="flex gap-1">
        {tabs.map((t) => (
          <Button key={t.key} variant={tab === t.key ? "default" : "outline"} size="sm" className="rounded-full text-xs gap-1.5" onClick={() => setTab(t.key)}>
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </Button>
        ))}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-7 gap-3">
        {[
          { label: "Omzet", value: euro(revenue), sub: `${filtered.length} orders`, highlight: true },
          { label: "Inkoopkosten", value: euro(totalCost), sub: "totaal", className: "text-red-600" },
          { label: "Brutowinst", value: euro(grossProfit), sub: `${profitMargin.toFixed(1)}% marge`, className: grossProfit >= 0 ? "text-green-600" : "text-red-600" },
          { label: "Gem. ticket", value: euro(avgTicket), sub: "per order" },
          { label: "Items", value: String(itemsSold), sub: "verkocht" },
          { label: "Fooi", value: euro(totalTips), sub: "totaal" },
          { label: "Korting", value: euro(totalDiscount), sub: "gegeven" },
        ].map((kpi: any, i) => (
          <Card key={i} className={clsx("rounded-2xl", kpi.highlight && "border-primary/30 bg-primary/5")}>
            <CardContent className="p-3">
              <div className="text-[11px] text-muted-foreground">{kpi.label}</div>
              <div className={clsx("text-xl font-bold tabular-nums", kpi.highlight && "text-primary", kpi.className)}>{kpi.value}</div>
              <div className="text-[10px] text-muted-foreground">{kpi.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* TAB: Overview */}
      {tab === "overview" && (
        <div className="grid grid-cols-2 gap-4">
          <Card className="rounded-2xl">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Omzet per categorie</CardTitle></CardHeader>
            <CardContent>
              {Object.keys(bySection).length === 0 ? <div className="text-sm text-muted-foreground py-4">Geen data.</div> : (
                <div className="space-y-2.5">
                  {Object.entries(bySection).sort((a, b) => b[1] - a[1]).map(([section, amount]) => (
                    <div key={section} className="space-y-1">
                      <div className="flex justify-between text-sm"><span>{section}</span><span className="font-medium tabular-nums">{euro(amount)}</span></div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: revenue > 0 ? `${(amount / revenue) * 100}%` : "0%" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Betaalmethode</CardTitle></CardHeader>
            <CardContent>
              {Object.keys(byMethod).length === 0 ? <div className="text-sm text-muted-foreground py-4">Geen data.</div> : (
                <div className="space-y-2.5">
                  {Object.entries(byMethod).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([method, amount]) => (
                    <div key={method} className="space-y-1">
                      <div className="flex justify-between text-sm"><span className="capitalize">{method === "giftcard" ? "Cadeaubon" : method}</span><span className="font-medium tabular-nums">{euro(amount as number)}</span></div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: revenue > 0 ? `${((amount as number) / revenue) * 100}%` : "0%" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          {/* Quick insights */}
          <Card className="rounded-2xl col-span-2">
            <CardHeader className="pb-2"><CardTitle className="text-sm">📊 Snelle inzichten</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {bestHours.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">🔥 Beste uren</div>
                    {bestHours.map(([h, data]) => (
                      <div key={h} className="text-sm"><span className="font-mono font-medium">{String(h).padStart(2, "0")}:00</span> — {euro(data.revenue)} ({data.orders}x)</div>
                    ))}
                  </div>
                )}
                {bestDay && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">🏆 Beste dag</div>
                    <div className="text-sm font-medium">{bestDay.date}</div>
                    <div className="text-sm">{euro(bestDay.revenue)} · {bestDay.orders} orders</div>
                  </div>
                )}
                {topList.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">⭐ Bestseller</div>
                    <div className="text-sm font-medium">{topList[0].name}</div>
                    <div className="text-sm">{topList[0].qty}x verkocht · {euro(topList[0].revenue)}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB: By Employee — with daily breakdown */}
      {tab === "employees" && (
        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Verkoop per medewerker</CardTitle></CardHeader>
          <CardContent>
            {Object.keys(byEmployee).length === 0 ? <div className="text-sm text-muted-foreground py-4">Geen data.</div> : (
              <div className="space-y-1">
                {Object.entries(byEmployee).sort((a, b) => b[1].revenue - a[1].revenue).map(([eid, data]) => (
                  <div key={eid}>
                    <div
                      className="flex items-center gap-3 py-2.5 border-b last:border-0 cursor-pointer hover:bg-muted/30 rounded-lg px-2 -mx-2 transition-colors"
                      onClick={() => setExpandedEmployee(expandedEmployee === eid ? null : eid)}
                    >
                      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                        {data.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{data.name}</div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: revenue > 0 ? `${(data.revenue / revenue) * 100}%` : "0%" }} />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-sm tabular-nums">{euro(data.revenue)}</div>
                        <div className="text-[10px] text-muted-foreground">{data.orders} orders · {data.items} items</div>
                      </div>
                      {data.tips > 0 && <Badge variant="secondary" className="text-[10px] shrink-0">{euro(data.tips)} fooi</Badge>}
                      <ChevronRight className={clsx("h-4 w-4 text-muted-foreground transition-transform shrink-0", expandedEmployee === eid && "rotate-90")} />
                    </div>
                    {/* Daily breakdown */}
                    {expandedEmployee === eid && (
                      <div className="ml-12 mb-3 mt-1 space-y-1">
                        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Dagelijks overzicht</div>
                        {Object.entries(data.byDay).map(([day, dd]) => (
                          <div key={day} className="flex items-center justify-between text-xs py-1 px-2 bg-muted/30 rounded">
                            <span className="text-muted-foreground">{day}</span>
                            <div className="flex gap-3">
                              <span className="tabular-nums font-medium">{euro(dd.revenue)}</span>
                              <span className="text-muted-foreground">{dd.orders} orders</span>
                              {dd.tips > 0 && <span className="text-green-600">{euro(dd.tips)} fooi</span>}
                            </div>
                          </div>
                        ))}
                        <div className="flex items-center justify-between text-xs py-1 px-2 bg-primary/10 rounded font-medium">
                          <span>Totaal</span>
                          <div className="flex gap-3">
                            <span className="tabular-nums">{euro(data.revenue)}</span>
                            <span>{data.orders} orders</span>
                            {data.tips > 0 && <span className="text-green-600">{euro(data.tips)} fooi</span>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB: Peak Hours */}
      {tab === "hourly" && (
        <div className="space-y-4">
          {/* Best & slowest hours cards */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="rounded-2xl border-green-200 bg-green-50/30">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-green-700">🔥 Piekuren (top 3)</CardTitle></CardHeader>
              <CardContent>
                {bestHours.length === 0 ? <div className="text-sm text-muted-foreground">Geen data.</div> : (
                  <div className="space-y-2">
                    {bestHours.map(([h, data], i) => (
                      <div key={h} className="flex items-center gap-3">
                        <span className="text-lg font-bold text-green-700 w-6">{i + 1}</span>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{String(h).padStart(2, "0")}:00 – {String(Number(h) + 1).padStart(2, "0")}:00</div>
                          <div className="text-xs text-muted-foreground">{data.orders} bestellingen</div>
                        </div>
                        <span className="font-bold text-sm tabular-nums text-green-700">{euro(data.revenue)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-orange-200 bg-orange-50/30">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-orange-700">💤 Rustige uren</CardTitle></CardHeader>
              <CardContent>
                {slowestHours.length === 0 ? <div className="text-sm text-muted-foreground">Geen data.</div> : (
                  <div className="space-y-2">
                    {slowestHours.map(([h, data]) => (
                      <div key={h} className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{String(h).padStart(2, "0")}:00 – {String(Number(h) + 1).padStart(2, "0")}:00</div>
                          <div className="text-xs text-muted-foreground">{data.orders} bestellingen</div>
                        </div>
                        <span className="font-medium text-sm tabular-nums text-orange-700">{euro(data.revenue)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          {/* Full hourly breakdown */}
          <Card className="rounded-2xl">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Verkoop per uur</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1">
                {Object.entries(byHour).map(([hour, data]) => (
                  <div key={hour} className="flex items-center gap-3 py-1.5">
                    <span className="text-xs text-muted-foreground w-12 tabular-nums shrink-0">{String(hour).padStart(2, "0")}:00</span>
                    <div className="flex-1 h-6 bg-muted rounded overflow-hidden relative">
                      <div className={clsx("h-full rounded transition-all", data.revenue > 0 ? (data.revenue === peakHourRevenue ? "bg-primary" : "bg-primary/60") : "")}
                        style={{ width: `${(data.revenue / peakHourRevenue) * 100}%` }} />
                      {data.revenue > 0 && (
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium tabular-nums text-muted-foreground">
                          {euro(data.revenue)} · {data.orders}x
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB: By Day */}
      {tab === "daily" && (
        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Verkoop per dag</CardTitle></CardHeader>
          <CardContent>
            {sortedDays.length === 0 ? <div className="text-sm text-muted-foreground py-4">Geen data.</div> : (
              <div className="space-y-1">
                {sortedDays.map((data) => {
                  const maxDayRevenue = Math.max(...sortedDays.map((d) => d.revenue), 1);
                  const isBest = bestDay && data.date === bestDay.date;
                  return (
                    <div key={data.date} className={clsx("flex items-center gap-3 py-2 border-b last:border-0 px-2 -mx-2 rounded", isBest && "bg-primary/5")}>
                      <span className="text-xs w-28 shrink-0">{data.date} {isBest && "🏆"}</span>
                      <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                        <div className={clsx("h-full rounded transition-all", isBest ? "bg-primary" : "bg-primary/60")} style={{ width: `${(data.revenue / maxDayRevenue) * 100}%` }} />
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-2">
                        <span className="text-sm font-bold tabular-nums">{euro(data.revenue)}</span>
                        <span className="text-[10px] text-muted-foreground">{data.orders} orders</span>
                        {data.tips > 0 && <span className="text-[10px] text-green-600">{euro(data.tips)} fooi</span>}
                      </div>
                    </div>
                  );
                })}
                {/* Totals row */}
                <div className="flex items-center gap-3 py-2 px-2 -mx-2 bg-muted/50 rounded-lg font-medium mt-2">
                  <span className="text-xs w-28 shrink-0">Totaal</span>
                  <div className="flex-1" />
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <span className="text-sm font-bold tabular-nums">{euro(revenue)}</span>
                    <span className="text-[10px] text-muted-foreground">{filtered.length} orders</span>
                    {totalTips > 0 && <span className="text-[10px] text-green-600">{euro(totalTips)} fooi</span>}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB: Top Products */}
      {tab === "products" && (
        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top producten</CardTitle></CardHeader>
          <CardContent>
            {topList.length === 0 ? <div className="text-sm text-muted-foreground py-4">Geen data.</div> : (
              <div className="space-y-1">
                {topList.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0">
                    <span className={clsx("w-6 text-center text-xs font-mono", i < 3 ? "font-bold text-primary" : "text-muted-foreground")}>{i + 1}</span>
                    <span className="flex-1 text-sm font-medium truncate">{item.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{item.qty}x</span>
                    <span className="text-sm font-bold tabular-nums w-20 text-right">{euro(item.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB: Profit & Loss */}
      {tab === "profit" && (
        <div className="space-y-4">
          {/* P&L Summary */}
          <Card className="rounded-2xl">
            <CardHeader className="pb-2"><CardTitle className="text-sm">💰 Winst & Verlies overzicht</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2 max-w-lg">
                {[
                  { label: "Omzet (verkoop)", value: euro(revenue), className: "font-bold" },
                  { label: "Inkoopkosten (COGS)", value: `-${euro(totalCost)}`, className: "text-red-600" },
                  { label: "Brutowinst", value: euro(grossProfit), className: grossProfit >= 0 ? "font-bold text-green-600" : "font-bold text-red-600" },
                  { label: "Brutomarge", value: `${profitMargin.toFixed(1)}%`, className: profitMargin >= 60 ? "text-green-600" : profitMargin >= 40 ? "text-orange-600" : "text-red-600" },
                  { label: "Kortingen gegeven", value: `-${euro(totalDiscount)}`, className: "text-orange-600" },
                  { label: "Fooi ontvangen", value: euro(totalTips), className: "text-green-600" },
                ].map((row, i) => (
                  <div key={i} className={clsx("flex justify-between py-1.5 border-b last:border-0", i === 2 && "border-t-2 border-b-2 py-2.5")}>
                    <span className="text-sm">{row.label}</span>
                    <span className={clsx("text-sm tabular-nums", row.className)}>{row.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Profit by category */}
          <Card className="rounded-2xl">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Winst per categorie</CardTitle></CardHeader>
            <CardContent>
              {Object.keys(profitBySection).length === 0 ? <div className="text-sm text-muted-foreground py-4">Geen data.</div> : (
                <div className="space-y-3">
                  {Object.entries(profitBySection).sort((a, b) => (b[1].revenue - b[1].cost) - (a[1].revenue - a[1].cost)).map(([section, data]) => {
                    const sectionProfit = data.revenue - data.cost;
                    const sectionMargin = data.revenue > 0 ? (sectionProfit / data.revenue) * 100 : 0;
                    return (
                      <div key={section} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{section}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">Omzet: {euro(data.revenue)}</span>
                            <span className="text-xs text-muted-foreground">Inkoop: {euro(data.cost)}</span>
                            <span className={clsx("font-bold tabular-nums", sectionProfit >= 0 ? "text-green-600" : "text-red-600")}>{euro(sectionProfit)}</span>
                            <Badge variant="secondary" className="text-[10px]">{sectionMargin.toFixed(0)}%</Badge>
                          </div>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className={clsx("h-full rounded-full transition-all", sectionMargin >= 60 ? "bg-green-500" : sectionMargin >= 40 ? "bg-orange-400" : "bg-red-400")}
                            style={{ width: `${Math.min(sectionMargin, 100)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Profit per product */}
          <Card className="rounded-2xl">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Winst per product (top 10)</CardTitle></CardHeader>
            <CardContent>
              {topList.length === 0 ? <div className="text-sm text-muted-foreground py-4">Geen data.</div> : (
                <div className="space-y-1">
                  <div className="flex items-center gap-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    <span className="w-6">#</span>
                    <span className="flex-1">Product</span>
                    <span className="w-12 text-right">Qty</span>
                    <span className="w-20 text-right">Omzet</span>
                    <span className="w-20 text-right">Inkoop</span>
                    <span className="w-20 text-right">Winst</span>
                    <span className="w-16 text-right">Marge</span>
                  </div>
                  {topList.map((item, i) => {
                    const itemProfit = item.revenue - item.cost;
                    const itemMargin = item.revenue > 0 ? (itemProfit / item.revenue) * 100 : 0;
                    return (
                      <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0">
                        <span className={clsx("w-6 text-center text-xs font-mono", i < 3 ? "font-bold text-primary" : "text-muted-foreground")}>{i + 1}</span>
                        <span className="flex-1 text-sm font-medium truncate">{item.name}</span>
                        <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">{item.qty}x</span>
                        <span className="w-20 text-right text-sm tabular-nums">{euro(item.revenue)}</span>
                        <span className="w-20 text-right text-sm tabular-nums text-red-600">{euro(item.cost)}</span>
                        <span className={clsx("w-20 text-right text-sm font-bold tabular-nums", itemProfit >= 0 ? "text-green-600" : "text-red-600")}>{euro(itemProfit)}</span>
                        <span className={clsx("w-16 text-right text-xs font-medium", itemMargin >= 60 ? "text-green-600" : itemMargin >= 40 ? "text-orange-600" : "text-red-600")}>{itemMargin.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                  {/* Totals */}
                  <div className="flex items-center gap-3 py-2 bg-muted/50 rounded-lg mt-2 font-medium">
                    <span className="w-6" />
                    <span className="flex-1 text-sm">Totaal</span>
                    <span className="w-12 text-right text-xs tabular-nums">{topList.reduce((s, i) => s + i.qty, 0)}x</span>
                    <span className="w-20 text-right text-sm tabular-nums">{euro(topList.reduce((s, i) => s + i.revenue, 0))}</span>
                    <span className="w-20 text-right text-sm tabular-nums text-red-600">{euro(topList.reduce((s, i) => s + i.cost, 0))}</span>
                    <span className={clsx("w-20 text-right text-sm font-bold tabular-nums", grossProfit >= 0 ? "text-green-600" : "text-red-600")}>{euro(topList.reduce((s, i) => s + i.revenue - i.cost, 0))}</span>
                    <span className="w-16 text-right text-xs font-medium">{profitMargin.toFixed(0)}%</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── ACCOUNTING ──────────────────────────────────────────────────────────────

function AccountingView({ orders }: any) {
  const [rangeMode, setRangeMode] = useState<"today" | "week" | "month" | "quarter" | "custom">("today");
  const [customStart, setCustomStart] = useState<Date | undefined>(undefined);
  const [customEnd, setCustomEnd] = useState<Date | undefined>(undefined);
  const [showCalendar, setShowCalendar] = useState<"start" | "end" | null>(null);
  const [tab, setTab] = useState("summary");

  function getDateRange(): { start: Date; end: Date; label: string } {
    const now = new Date();
    const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eod = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    if (rangeMode === "today") return { start: sod, end: eod, label: "Vandaag" };
    if (rangeMode === "week") {
      const w = new Date(sod); w.setDate(w.getDate() - 6);
      return { start: w, end: eod, label: "Afgelopen 7 dagen" };
    }
    if (rangeMode === "month") {
      const m = new Date(sod); m.setMonth(m.getMonth() - 1);
      return { start: m, end: eod, label: "Afgelopen 30 dagen" };
    }
    if (rangeMode === "quarter") {
      const q = new Date(sod); q.setMonth(q.getMonth() - 3);
      return { start: q, end: eod, label: "Afgelopen kwartaal" };
    }
    const cs = customStart || sod;
    const ce = customEnd ? new Date(customEnd.getFullYear(), customEnd.getMonth(), customEnd.getDate(), 23, 59, 59, 999) : eod;
    return { start: cs, end: ce, label: `${cs.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })} – ${new Date(ce).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}` };
  }

  const range = getDateRange();
  const filtered = orders.filter((o: any) => o.date >= range.start && o.date <= range.end);

  // Core calculations
  const grossRevenue = filtered.reduce((s: number, o: any) => s + o.subtotal, 0);
  const totalDiscounts = filtered.reduce((s: number, o: any) => s + (o.discount || 0), 0);
  const totalGiftCard = filtered.reduce((s: number, o: any) => s + (o.giftCardDeduction || 0), 0);
  const netRevenue = filtered.reduce((s: number, o: any) => s + o.total, 0);
  const totalTips = filtered.reduce((s: number, o: any) => s + (o.tip || 0), 0);
  const totalCost = filtered.reduce((s: number, o: any) => s + o.items.reduce((a: number, i: any) => a + (i.costPrice || 0) * i.qty, 0), 0);
  const grossProfit = netRevenue - totalCost;
  const profitMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;
  const btw21 = netRevenue * 0.21 / 1.21;
  const btw9 = netRevenue * 0.09 / 1.09;

  // By payment method
  const byMethod: Record<string, number> = {};
  filtered.forEach((o: any) => { byMethod[o.method] = (byMethod[o.method] || 0) + o.total; });

  // By day for daily breakdown
  const byDay: Record<string, { date: string; revenue: number; orders: number; cost: number; tips: number; rawDate: Date }> = {};
  filtered.forEach((o: any) => {
    const key = o.date.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
    if (!byDay[key]) byDay[key] = { date: key, revenue: 0, orders: 0, cost: 0, tips: 0, rawDate: new Date(o.date.getFullYear(), o.date.getMonth(), o.date.getDate()) };
    byDay[key].revenue += o.total;
    byDay[key].orders++;
    byDay[key].cost += o.items.reduce((a: number, i: any) => a + (i.costPrice || 0) * i.qty, 0);
    byDay[key].tips += o.tip || 0;
  });
  const sortedDays = Object.values(byDay).sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());
  const maxDayRevenue = Math.max(...sortedDays.map((d) => d.revenue), 1);

  // By section for category breakdown
  const bySection: Record<string, { revenue: number; cost: number; qty: number }> = {};
  filtered.forEach((o: any) => o.items.forEach((item: any) => {
    const sec = item.section || "Overig";
    if (!bySection[sec]) bySection[sec] = { revenue: 0, cost: 0, qty: 0 };
    bySection[sec].revenue += (item.price + item.modifiers.reduce((s: number, m: any) => s + m.price, 0)) * item.qty;
    bySection[sec].cost += (item.costPrice || 0) * item.qty;
    bySection[sec].qty += item.qty;
  }));

  const calendarClassNames = {
    months: "flex flex-col", month: "space-y-2",
    caption: "flex justify-center pt-1 relative items-center", caption_label: "text-sm font-medium",
    nav: "space-x-1 flex items-center",
    nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-md border border-input",
    nav_button_previous: "absolute left-1", nav_button_next: "absolute right-1",
    table: "w-full border-collapse", head_row: "flex",
    head_cell: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
    row: "flex w-full mt-1", cell: "h-8 w-8 text-center text-sm p-0 relative",
    day: "h-8 w-8 p-0 font-normal rounded-md hover:bg-accent cursor-pointer inline-flex items-center justify-center",
    day_selected: "bg-primary text-primary-foreground hover:bg-primary",
    day_today: "bg-accent text-accent-foreground",
    day_outside: "text-muted-foreground opacity-50", day_disabled: "text-muted-foreground opacity-50",
  };

  const tabs = [
    { key: "summary", label: "Overzicht", icon: BarChart3 },
    { key: "btw", label: "BTW", icon: Percent },
    { key: "daily", label: "Per dag", icon: CalendarDays },
    { key: "categories", label: "Categorieën", icon: Package },
    { key: "profit", label: "Winst & Verlies", icon: DollarSign },
  ];

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1">
              {([
                { key: "today", label: "Dag" },
                { key: "week", label: "Week" },
                { key: "month", label: "Maand" },
                { key: "quarter", label: "Kwartaal" },
                { key: "custom", label: "📅 Aangepast" },
              ] as const).map((r) => (
                <Button key={r.key} variant={rangeMode === r.key ? "default" : "outline"} size="sm" className="text-xs rounded-full" onClick={() => setRangeMode(r.key)}>
                  {r.label}
                </Button>
              ))}
            </div>
            {rangeMode === "custom" && (
              <div className="flex items-center gap-2 relative">
                <div className="relative">
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowCalendar(showCalendar === "start" ? null : "start")}>
                    {customStart ? customStart.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" }) : "Startdatum"}
                  </Button>
                  {showCalendar === "start" && (
                    <div className="absolute top-full left-0 mt-1 z-50 bg-card border rounded-xl shadow-xl">
                      <div className="p-3 pointer-events-auto">
                        <DayPicker mode="single" selected={customStart} onSelect={(d) => { setCustomStart(d || undefined); setShowCalendar(null); }}
                          className="pointer-events-auto" classNames={calendarClassNames}
                          components={{ IconLeft: () => <ChevronLeft className="h-4 w-4" />, IconRight: () => <ChevronRight className="h-4 w-4" /> }} />
                      </div>
                    </div>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">t/m</span>
                <div className="relative">
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowCalendar(showCalendar === "end" ? null : "end")}>
                    {customEnd ? customEnd.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" }) : "Einddatum"}
                  </Button>
                  {showCalendar === "end" && (
                    <div className="absolute top-full left-0 mt-1 z-50 bg-card border rounded-xl shadow-xl">
                      <div className="p-3 pointer-events-auto">
                        <DayPicker mode="single" selected={customEnd} onSelect={(d) => { setCustomEnd(d || undefined); setShowCalendar(null); }}
                          className="pointer-events-auto" classNames={calendarClassNames}
                          components={{ IconLeft: () => <ChevronLeft className="h-4 w-4" />, IconRight: () => <ChevronRight className="h-4 w-4" /> }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <Badge variant="secondary" className="text-xs ml-auto">{range.label} · {filtered.length} orders</Badge>
          </div>
        </CardContent>
      </Card>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "Bruto omzet", value: euro(grossRevenue), icon: TrendingUp, color: "text-foreground" },
          { label: "Netto omzet", value: euro(netRevenue), icon: DollarSign, color: "text-foreground font-bold" },
          { label: "Kosten", value: euro(totalCost), icon: Receipt, color: "text-red-600" },
          { label: "Bruto winst", value: euro(grossProfit), icon: TrendingUp, color: grossProfit >= 0 ? "text-green-600" : "text-red-600" },
          { label: "Marge", value: `${profitMargin.toFixed(1)}%`, icon: Percent, color: profitMargin >= 60 ? "text-green-600" : "text-amber-600" },
        ].map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <Card key={i} className="rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{kpi.label}</span>
                </div>
                <div className={clsx("text-lg font-semibold", kpi.color)}>{kpi.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 flex-wrap">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <Button key={t.key} variant={tab === t.key ? "default" : "outline"} size="sm" className="text-xs rounded-full gap-1.5" onClick={() => setTab(t.key)}>
              <Icon className="h-3.5 w-3.5" />{t.label}
            </Button>
          );
        })}
      </div>

      {/* Summary tab */}
      {tab === "summary" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="text-sm">Financieel overzicht</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { label: "Bruto omzet", value: euro(grossRevenue) },
                  { label: "Kortingen", value: `-${euro(totalDiscounts)}`, cls: "text-red-600" },
                  { label: "Cadeaukaart inwisselingen", value: `-${euro(totalGiftCard)}`, cls: "text-purple-600" },
                  { label: "Netto omzet (incl. BTW)", value: euro(netRevenue), cls: "font-bold" },
                  { label: "BTW 21% (geschat)", value: euro(btw21) },
                  { label: "Fooien", value: euro(totalTips), cls: "text-green-600" },
                  { label: "Totaal ontvangen", value: euro(netRevenue + totalTips), cls: "font-bold text-lg" },
                ].map((row, i) => (
                  <div key={i} className={clsx("flex justify-between py-1.5 text-sm", row.cls)}>
                    <span>{row.label}</span><span>{row.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="text-sm">Per betaalmethode</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(byMethod).filter(([, v]) => (v as number) > 0).map(([method, amount]) => {
                  const pct = netRevenue > 0 ? ((amount as number) / netRevenue * 100) : 0;
                  return (
                    <div key={method} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="capitalize">{method === "giftcard" ? "Cadeaukaart" : method === "card" ? "Pin" : method === "cash" ? "Contant" : method}</span>
                        <span className="font-medium">{euro(amount as number)} <span className="text-xs text-muted-foreground">({pct.toFixed(0)}%)</span></span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                {Object.keys(byMethod).length === 0 && <p className="text-sm text-muted-foreground">Geen data</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* BTW tab */}
      {tab === "btw" && (
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-sm">BTW-berekening</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3 max-w-lg">
              {[
                { label: "Netto omzet (incl. BTW)", value: euro(netRevenue), cls: "font-bold" },
                { label: "Geschatte BTW 21% (horeca)", value: euro(btw21), cls: "text-amber-600" },
                { label: "Geschatte BTW 9% (food)", value: euro(btw9), cls: "text-amber-600" },
                { label: "Netto omzet excl. BTW 21%", value: euro(netRevenue - btw21) },
                { label: "Netto omzet excl. BTW 9%", value: euro(netRevenue - btw9) },
              ].map((row, i) => (
                <div key={i} className={clsx("flex justify-between py-2 text-sm border-b last:border-0", row.cls)}>
                  <span>{row.label}</span><span>{row.value}</span>
                </div>
              ))}
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 mt-4">
                <div className="font-medium mb-1">⚠️ Indicatief</div>
                <div>Deze BTW-berekeningen zijn schattingen. Raadpleeg je boekhouder voor de exacte BTW-afdracht op basis van je productcategorieën.</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily breakdown tab */}
      {tab === "daily" && (
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-sm">Dagelijks overzicht</CardTitle></CardHeader>
          <CardContent>
            {sortedDays.length === 0 ? (
              <p className="text-sm text-muted-foreground">Geen data in deze periode</p>
            ) : (
              <div className="space-y-2">
                {sortedDays.map((day, i) => {
                  const dayProfit = day.revenue - day.cost;
                  const dayMargin = day.revenue > 0 ? (dayProfit / day.revenue) * 100 : 0;
                  return (
                    <div key={i} className="border rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium capitalize">{day.date}</span>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-xs">{day.orders} orders</Badge>
                          <span className="text-sm font-semibold">{euro(day.revenue)}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(day.revenue / maxDayRevenue) * 100}%` }} />
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>Kosten: {euro(day.cost)}</span>
                        <span className={dayProfit >= 0 ? "text-green-600" : "text-red-600"}>Winst: {euro(dayProfit)}</span>
                        <span>Marge: {dayMargin.toFixed(1)}%</span>
                        {day.tips > 0 && <span className="text-green-600">Fooien: {euro(day.tips)}</span>}
                      </div>
                    </div>
                  );
                })}
                <Separator className="my-3" />
                <div className="flex justify-between text-sm font-medium px-3">
                  <span>Totaal</span>
                  <span>{euro(netRevenue)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Categories tab */}
      {tab === "categories" && (
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-sm">Omzet per categorie</CardTitle></CardHeader>
          <CardContent>
            {Object.keys(bySection).length === 0 ? (
              <p className="text-sm text-muted-foreground">Geen data in deze periode</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(bySection).sort((a, b) => b[1].revenue - a[1].revenue).map(([sec, data]) => {
                  const secMargin = data.revenue > 0 ? ((data.revenue - data.cost) / data.revenue * 100) : 0;
                  const pct = grossRevenue > 0 ? (data.revenue / grossRevenue * 100) : 0;
                  return (
                    <div key={sec} className="border rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{sec}</span>
                        <span className="text-sm font-semibold">{euro(data.revenue)}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary/70 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>{data.qty} items</span>
                        <span>{pct.toFixed(1)}% van totaal</span>
                        <span>Kosten: {euro(data.cost)}</span>
                        <span className={secMargin >= 60 ? "text-green-600" : "text-amber-600"}>Marge: {secMargin.toFixed(1)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Profit & Loss tab */}
      {tab === "profit" && (
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-sm">Winst & Verlies</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 max-w-lg">
              {[
                { label: "Omzet", value: euro(netRevenue), cls: "font-bold text-base" },
                { label: "Inkoopkosten (COGS)", value: `-${euro(totalCost)}`, cls: "text-red-600" },
                { label: "Bruto winst", value: euro(grossProfit), cls: grossProfit >= 0 ? "font-bold text-green-600" : "font-bold text-red-600" },
                { label: "Bruto marge", value: `${profitMargin.toFixed(1)}%`, cls: profitMargin >= 60 ? "text-green-600" : "text-amber-600" },
                { label: "", value: "", cls: "border-t" },
                { label: "Kortingen gegeven", value: `-${euro(totalDiscounts)}`, cls: "text-red-600" },
                { label: "Cadeaukaart inwisselingen", value: `-${euro(totalGiftCard)}`, cls: "text-purple-600" },
                { label: "Fooien ontvangen", value: `+${euro(totalTips)}`, cls: "text-green-600" },
                { label: "", value: "", cls: "border-t" },
                { label: "Geschatte BTW-afdracht (21%)", value: `-${euro(btw21)}`, cls: "text-amber-600" },
                { label: "Netto na BTW (geschat)", value: euro(netRevenue - btw21 - totalCost), cls: "font-bold text-lg" },
              ].filter((r) => r.label || r.cls === "border-t").map((row, i) =>
                row.cls === "border-t" ? <Separator key={i} className="my-2" /> : (
                  <div key={i} className={clsx("flex justify-between py-1.5 text-sm", row.cls)}>
                    <span>{row.label}</span><span>{row.value}</span>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export */}
      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-sm">Exporteer</CardTitle></CardHeader>
        <CardContent className="flex gap-3 flex-wrap">
          <Button variant="outline" size="sm"><FileText className="h-4 w-4 mr-2" />Export CSV</Button>
          <Button variant="outline" size="sm"><FileText className="h-4 w-4 mr-2" />Export PDF</Button>
          <Button variant="outline" size="sm"><Zap className="h-4 w-4 mr-2" />Stuur naar boekhouder</Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── SETTINGS ────────────────────────────────────────────────────────────────

function SettingsView({ features, setFeatures, passkitConfig, setPasskitConfig, vatRates, setVatRates }: any) {
  return (
    <div className="space-y-4 max-w-2xl">
      {/* PassKit Configuration */}
      {features.passkit && (
        <Card className="rounded-2xl border-green-200 bg-green-50/30">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Wallet className="h-4 w-4" /> PassKit Loyalty Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div><Label>Program ID</Label><div className="text-xs text-muted-foreground">Your PassKit program identifier</div></div>
              <Input value={passkitConfig.programId} onChange={(e) => setPasskitConfig((p: any) => ({ ...p, programId: e.target.value }))} placeholder="e.g. prog_abc123" className="max-w-[280px]" />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div><Label>Tier ID</Label><div className="text-xs text-muted-foreground">Default tier for new members</div></div>
              <Input value={passkitConfig.tierId} onChange={(e) => setPasskitConfig((p: any) => ({ ...p, tierId: e.target.value }))} placeholder="e.g. tier_base" className="max-w-[280px]" />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div><Label>Points per €1</Label><div className="text-xs text-muted-foreground">How many points earned per euro spent</div></div>
              <Input type="number" value={passkitConfig.pointsPerEuro} onChange={(e) => setPasskitConfig((p: any) => ({ ...p, pointsPerEuro: parseInt(e.target.value) || 1 }))} className="max-w-[100px]" />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div><Label>Auto-enrol new customers</Label><div className="text-xs text-muted-foreground">Automatically create PassKit member on first purchase</div></div>
              <Switch checked={passkitConfig.autoEnrol} onCheckedChange={(v) => setPasskitConfig((p: any) => ({ ...p, autoEnrol: v }))} />
            </div>
            <div className="rounded-lg bg-green-100 border border-green-300 p-3 text-xs text-green-800">
              <div className="font-medium mb-1">✅ PassKit API connected</div>
              <div>Your API key and secret are securely stored. Members will earn {passkitConfig.pointsPerEuro} point{passkitConfig.pointsPerEuro !== 1 ? "s" : ""} per €1 spent.</div>
            </div>
          </CardContent>
        </Card>
      )}
      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-sm">General</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between"><div><Label>Business name</Label><div className="text-xs text-muted-foreground">Shown on receipts</div></div><Input defaultValue="Saakouk" className="max-w-[200px]" /></div>
          <Separator />
          <div className="flex items-center justify-between"><div><Label>Currency</Label><div className="text-xs text-muted-foreground">All prices display in this currency</div></div><Input defaultValue="EUR" className="max-w-[100px]" disabled /></div>
        </CardContent>
      </Card>
      {/* BTW / VAT Rates per category */}
      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-sm">BTW-tarieven per categorie</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[...SECTIONS, "default"].map((cat) => (
            <div key={cat} className="flex items-center justify-between py-1">
              <div>
                <Label>{cat === "default" ? "Overig (standaard)" : cat}</Label>
                <div className="text-xs text-muted-foreground">{cat === "default" ? "Wordt gebruikt als er geen categorie-tarief is" : `BTW voor ${cat}`}</div>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type="number" step="0.5" min="0" max="100"
                  value={vatRates?.[cat] ?? (cat === "default" ? 21 : 9)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setVatRates?.((prev: any) => {
                      const updated = { ...prev, [cat]: val };
                      localStorage.setItem("saakouk_vat_rates", JSON.stringify(updated));
                      return updated;
                    });
                  }}
                  className="max-w-[80px] text-right"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
          ))}
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            <div className="font-medium mb-1">ℹ️ Per-product override</div>
            <div>Je kunt per product een afwijkend BTW-tarief instellen in de Product editor. Dit overschrijft het categorie-tarief.</div>
          </div>
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
        <CardHeader><CardTitle className="text-sm">Rollen &amp; Rechten</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            {([
              { role: "Owner", desc: "Volledige toegang: POS, Dashboard, Instellingen, Voorraad, Menu, Team" },
              { role: "Manager", desc: "POS, Dashboard, Voorraad, Menu, Team (geen instellingen)" },
              { role: "Cashier", desc: "POS, Kassa afsluiten, Bestellingen bekijken" },
              { role: "Staff", desc: "POS, Prep Station (KDS)" },
            ] as const).map(({ role, desc }) => (
              <div key={role} className="py-2 border-b last:border-0">
                <div className="flex items-center gap-2 font-medium"><Shield className="h-4 w-4 text-muted-foreground" />{role}</div>
                <p className="text-xs text-muted-foreground mt-0.5 ml-6">{desc}</p>
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

// LoginScreen removed — authentication is now handled by AuthContext + /login page

// ─── SECTION PICKER SCREEN ──────────────────────────────────────────────────

const sectionPickerItems = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: false, ownerOnly: true, color: "from-violet-400 to-indigo-400" },
  { key: "multilocatie", label: "Locaties", icon: Building2, adminOnly: false, ownerOnly: true, color: "from-sky-400 to-blue-400" },
  { key: "pos", label: "Point of Sale", icon: ShoppingCart, adminOnly: false, ownerOnly: false, color: "from-pink-400 to-rose-400" },
  { key: "prepstation", label: "Prepstation", icon: ChefHat, adminOnly: false, ownerOnly: false, color: "from-amber-400 to-orange-400" },
  { key: "cashclose", label: "Kassa Afsluiting", icon: Lock, adminOnly: false, ownerOnly: false, color: "from-emerald-400 to-teal-400" },
  { key: "reservations", label: "Reserveringen", icon: CalendarDays, adminOnly: false, ownerOnly: false, color: "from-fuchsia-400 to-purple-400" },
  { key: "products", label: "Producten", icon: Package, adminOnly: false, ownerOnly: false, color: "from-lime-400 to-green-400" },
  { key: "inventory", label: "Voorraad", icon: Package, adminOnly: false, ownerOnly: false, color: "from-sky-400 to-blue-400" },
  { key: "costing", label: "Marges", icon: DollarSign, adminOnly: false, ownerOnly: true, color: "from-yellow-400 to-amber-400" },
  { key: "qr", label: "QR Ordering", icon: QrCode, adminOnly: true, ownerOnly: false, color: "from-indigo-400 to-blue-400" },
  { key: "customers", label: "Klanten", icon: Users, adminOnly: false, ownerOnly: false, color: "from-rose-400 to-pink-400" },
  { key: "giftcards", label: "Cadeaukaarten", icon: Gift, adminOnly: false, ownerOnly: false, color: "from-orange-400 to-red-400" },
  { key: "verkoop", label: "Verkoop", icon: Receipt, adminOnly: true, ownerOnly: true, color: "from-cyan-400 to-sky-400" },
  { key: "logs", label: "Logs", icon: FileText, adminOnly: false, ownerOnly: true, color: "from-slate-400 to-gray-400" },
  { key: "employees", label: "Medewerkers", icon: UserCog, adminOnly: true, ownerOnly: false, color: "from-violet-400 to-fuchsia-400" },
  { key: "settings", label: "Instellingen", icon: Settings, adminOnly: true, ownerOnly: false, color: "from-gray-400 to-slate-400" },
];

function SectionPickerScreen({ employee, onSelect, onLogout }: { employee: any; onSelect: (key: string) => void; onLogout: () => void }) {
  const isAdmin = employee.role === "owner" || employee.role === "manager";
  const isOwner = employee.role === "owner";

  const available = sectionPickerItems.filter((s) => {
    if (s.ownerOnly && !isOwner) return false;
    if (s.adminOnly && !isAdmin) return false;
    return true;
  });

  return (
    <div className="relative h-dvh overflow-hidden bg-[#f6f8ff] text-slate-900 select-none touch-manipulation">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-[-10%] top-[-10%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_center,rgba(214,197,255,0.55),transparent_70%)] blur-3xl" />
        <div className="absolute right-[-8%] top-[8%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_center,rgba(255,188,233,0.45),transparent_70%)] blur-3xl" />
        <div className="absolute bottom-[-8%] left-[18%] h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_center,rgba(195,221,255,0.55),transparent_70%)] blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#fbfcff_0%,#f3f6ff_48%,#eef2ff_100%)]" />
        <motion.div
          animate={{ x: [0, 20, 0], y: [0, -10, 0], rotate: [8, 10, 8] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-[-8%] top-[18%] h-24 w-[58%] rounded-full bg-[linear-gradient(90deg,rgba(192,206,255,0.18),rgba(244,197,255,0.35),rgba(255,255,255,0.08))] blur-2xl"
        />
      </div>

      <main className="relative z-10 flex h-full flex-col items-center px-6 py-8 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-[900px]"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <motion.div
                whileHover={{ scale: 1.06, rotate: -4 }}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/80 bg-[radial-gradient(circle_at_30%_30%,#ffffff,#f1ecff_45%,#ddd6fe_72%,#fbcfe8_100%)] text-sm font-semibold text-slate-700 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),0_10px_30px_rgba(172,155,255,0.18)]"
              >
                {employee.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
              </motion.div>
              <div>
                <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-900">
                  Hoi, {employee.name.split(" ")[0]}
                </h1>
                <p className="text-sm text-slate-500 capitalize">{employee.role} · Kies een sectie</p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              onClick={onLogout}
              className="flex items-center gap-2 rounded-full border border-white/70 bg-white/60 backdrop-blur-xl px-4 py-2.5 text-sm font-medium text-red-500 shadow-[0_10px_30px_rgba(162,178,226,0.12)] hover:bg-red-50/60 transition min-h-[44px]"
            >
              <LogOut className="h-4 w-4" />
              Uitloggen
            </motion.button>
          </div>

          {/* Section grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {available.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.button
                  key={item.key}
                  initial={{ opacity: 0, y: 24, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: index * 0.04, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ y: -6, scale: 1.03, rotateX: 3 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onSelect(item.key)}
                  className="group relative text-left touch-manipulation"
                  style={{ transformStyle: "preserve-3d" }}
                >
                  {/* hover glow */}
                  <div className={`absolute -inset-[2px] rounded-[24px] bg-gradient-to-br ${item.color} opacity-0 blur-md transition duration-500 group-hover:opacity-40`} />

                  <div className="relative flex flex-col items-center gap-3 overflow-hidden rounded-[22px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(247,249,255,0.88))] px-4 py-6 shadow-[0_18px_50px_rgba(163,177,219,0.14)] backdrop-blur-xl transition duration-500 group-hover:shadow-[0_26px_70px_rgba(170,148,255,0.20)] min-h-[120px]">
                    {/* inner shine */}
                    <div className="absolute inset-x-0 top-0 h-10 bg-[linear-gradient(180deg,rgba(255,255,255,0.85),rgba(255,255,255,0))]" />

                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${item.color} text-white shadow-[0_8px_24px_rgba(0,0,0,0.12)]`}>
                      <Icon className="h-6 w-6" />
                    </div>

                    <span className="text-[15px] font-semibold tracking-[-0.01em] text-slate-800 text-center leading-tight">
                      {item.label}
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </main>
    </div>
  );
}

// ─── EMPLOYEES VIEW ──────────────────────────────────────────────────────────

function EmployeesView({ employees = [], setEmployees, currentRole, locationId, onToast }: { employees: any[]; setEmployees: any; currentRole: string; locationId?: string; onToast?: (msg: string) => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", role: "sales", pin: "" });
  const [showRoles, setShowRoles] = useState(false);
  const [rolePerms, setRolePerms] = useState<Record<string, Record<string, boolean>>>({});
  const [loadingPerms, setLoadingPerms] = useState(false);

  const PERMISSION_KEYS = [
    { key: "pos", label: "Kassa (POS)" },
    { key: "orders", label: "Bestellingen" },
    { key: "inventory", label: "Voorraad" },
    { key: "menu", label: "Menu / Producten" },
    { key: "modifiers", label: "Modifiers" },
    { key: "employees", label: "Medewerkers" },
    { key: "analytics", label: "Analytics / Rapportage" },
    { key: "cash_closing", label: "Kasafsluiting" },
    { key: "floor_plan", label: "Plattegrond" },
    { key: "qr_orders", label: "QR Bestellingen" },
    { key: "forecast", label: "AI Forecast" },
    { key: "upsell", label: "Upsell Regels" },
    { key: "logs", label: "Logboek" },
    { key: "settings", label: "Instellingen" },
  ];

  const ROLES = [
    { value: "owner", label: "Owner" },
    { value: "manager", label: "Manager" },
    { value: "sales", label: "Sales" },
  ];

  const roleColors: Record<string, string> = {
    owner: "bg-green-100 text-green-800 border-green-200",
    manager: "bg-blue-100 text-blue-800 border-blue-200",
    sales: "bg-orange-100 text-orange-800 border-orange-200",
  };

  const roleLabels: Record<string, string> = {
    owner: "Owner",
    manager: "Manager",
    sales: "Sales",
  };

  // Load role permissions
  async function loadPermissions() {
    if (!locationId) return;
    setLoadingPerms(true);
    const { data } = await supabase
      .from("role_permissions")
      .select("role, permission_key, is_enabled")
      .eq("location_id", locationId);

    const perms: Record<string, Record<string, boolean>> = {
      owner: {},
      manager: {},
      sales: {},
    };
    // Owner always has all permissions
    PERMISSION_KEYS.forEach((p) => { perms.owner[p.key] = true; });
    // Set defaults for manager and sales
    PERMISSION_KEYS.forEach((p) => {
      perms.manager[p.key] = true; // manager default all
      perms.sales[p.key] = ["pos", "orders", "qr_orders"].includes(p.key); // sales default limited
    });
    // Override with saved values
    if (data) {
      data.forEach((row: any) => {
        if (perms[row.role]) perms[row.role][row.permission_key] = row.is_enabled;
      });
    }
    // Owner always all
    PERMISSION_KEYS.forEach((p) => { perms.owner[p.key] = true; });
    setRolePerms(perms);
    setLoadingPerms(false);
  }

  async function togglePerm(role: string, key: string) {
    if (role === "owner") return; // owner always all
    const newVal = !rolePerms[role]?.[key];
    setRolePerms((prev) => ({ ...prev, [role]: { ...prev[role], [key]: newVal } }));
    // Upsert to DB
    const { error } = await supabase
      .from("role_permissions")
      .upsert(
        { role, permission_key: key, is_enabled: newVal, location_id: locationId },
        { onConflict: "role,permission_key,location_id" }
      );
    if (error) onToast?.("Fout bij opslaan permissie");
  }

  function openEdit(emp: any) {
    setEditingId(emp.id);
    setForm({ name: emp.name || emp.full_name, role: emp.role, pin: "" });
  }

  function openAdd() {
    setEditingId(null);
    setForm({ name: "", role: "sales", pin: "" });
    setShowAdd(true);
  }

  async function save() {
    if (!form.name || form.pin.length !== 6) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { onToast?.("Niet ingelogd"); setSaving(false); return; }

      if (editingId) {
        const res = await supabase.functions.invoke("employee-manage", {
          body: { action: "update_pin", employee_id: editingId, new_pin: form.pin },
        });
        if (res.error || res.data?.error) throw new Error(res.data?.error || "Fout bij bijwerken");
        onToast?.(`PIN bijgewerkt voor ${form.name}`);
      } else {
        const res = await supabase.functions.invoke("employee-manage", {
          body: { action: "create", full_name: form.name, pin: form.pin, role: form.role, location_id: locationId },
        });
        if (res.error || res.data?.error) throw new Error(res.data?.error || "Fout bij aanmaken");
        const { data: freshEmployees } = await supabase
          .from("employees")
          .select("id, full_name, role, is_active, location_id")
          .eq("is_active", true)
          .eq("location_id", locationId);
        if (freshEmployees) {
          setEmployees(freshEmployees.map((e: any) => ({ id: e.id, name: e.full_name, role: e.role, isActive: e.is_active, locationId: e.location_id })));
        }
        onToast?.(`Medewerker ${form.name} aangemaakt`);
      }
    } catch (err: any) {
      onToast?.(err.message || "Er ging iets mis");
    } finally {
      setSaving(false);
      setShowAdd(false);
      setEditingId(null);
    }
  }

  async function remove(id: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await supabase.functions.invoke("employee-manage", {
        body: { action: "delete", employee_id: id },
      });
      if (res.error || res.data?.error) throw new Error(res.data?.error || "Fout bij verwijderen");
      setEmployees((prev: any[]) => prev.filter((e) => e.id !== id));
      onToast?.("Medewerker verwijderd");
    } catch (err: any) {
      onToast?.(err.message || "Er ging iets mis");
    }
  }

  const isOwner = currentRole === "owner";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{employees.length} medewerkers</span>
        <div className="flex gap-2">
          {isOwner && (
            <Button variant="outline" onClick={() => { setShowRoles(true); loadPermissions(); }} className="rounded-xl">
              <Shield className="h-4 w-4 mr-1" /> Rollen
            </Button>
          )}
          <Button onClick={openAdd} className="rounded-xl"><Plus className="h-4 w-4 mr-1" /> Medewerker Toevoegen</Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {employees.map((emp) => (
          <Card key={emp.id} className="rounded-2xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                    {(emp.name || "").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{emp.name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(emp)} className="p-2 rounded-lg hover:bg-accent transition"><Edit className="h-4 w-4 text-muted-foreground" /></button>
                  <button onClick={() => remove(emp.id)} className="p-2 rounded-lg hover:bg-destructive/10 transition"><Trash2 className="h-4 w-4 text-destructive" /></button>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <Badge className={clsx("text-[10px] rounded-full border", roleColors[emp.role] || "bg-muted")}>{roleLabels[emp.role] || emp.role}</Badge>
                <span className="text-xs text-muted-foreground font-mono">PIN: ••••••</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add/Edit Employee Modal */}
      <Modal open={showAdd || !!editingId} onClose={() => { setShowAdd(false); setEditingId(null); }}>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-bold">{editingId ? "Medewerker bewerken" : "Nieuwe medewerker"}</h3>
          <div className="space-y-3">
            <div><Label>Naam</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" disabled={!!editingId} /></div>
            <div>
              <Label>Rol</Label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full rounded-lg border px-3 py-2 mt-1 bg-white text-sm" disabled={!isOwner || !!editingId}>
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              {!isOwner && <p className="text-xs text-muted-foreground mt-1">Alleen owners kunnen rollen wijzigen</p>}
            </div>
            <div><Label>{editingId ? "Nieuwe PIN (6 cijfers)" : "PIN (6 cijfers)"}</Label><Input type="password" maxLength={6} value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 6) })} placeholder="••••••" className="mt-1 font-mono" /></div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => { setShowAdd(false); setEditingId(null); }}>Annuleren</Button>
            <Button onClick={save} disabled={!form.name || form.pin.length !== 6 || saving}>{saving ? "Bezig..." : "Opslaan"}</Button>
          </div>
        </div>
      </Modal>

      {/* Role Permissions Modal */}
      <Modal open={showRoles} onClose={() => setShowRoles(false)}>
        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <h3 className="text-lg font-bold flex items-center gap-2"><Shield className="h-5 w-5" /> Rolbeheer</h3>
          <p className="text-sm text-muted-foreground">Selecteer per rol welke functies beschikbaar zijn.</p>
          {loadingPerms ? (
            <div className="text-center py-8 text-muted-foreground">Laden...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium">Functie</th>
                    {ROLES.map((r) => (
                      <th key={r.value} className="text-center py-2 px-3 font-medium">
                        <Badge className={clsx("text-[10px] rounded-full border", roleColors[r.value])}>{r.label}</Badge>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSION_KEYS.map((perm) => (
                    <tr key={perm.key} className="border-b border-muted/50 hover:bg-muted/20 transition">
                      <td className="py-2.5 pr-4 text-sm">{perm.label}</td>
                      {ROLES.map((r) => (
                        <td key={r.value} className="text-center py-2.5 px-3">
                          <Checkbox
                            checked={rolePerms[r.value]?.[perm.key] ?? false}
                            onCheckedChange={() => togglePerm(r.value, perm.key)}
                            disabled={r.value === "owner"}
                            className="mx-auto"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setShowRoles(false)}>Sluiten</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── LOGS VIEW ───────────────────────────────────────────────────────────────

function LogsView({ logs, employees }: { logs: any[]; employees: any[] }) {
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const actionTypes = [...new Set(logs.map((l) => l.action))];

  const filtered = logs.filter((log) => {
    if (filterEmployee !== "all" && log.employeeId !== filterEmployee) return false;
    if (filterType !== "all" && log.action !== filterType) return false;
    if (searchQuery && !log.details.toLowerCase().includes(searchQuery.toLowerCase()) && !log.employeeName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const actionLabels: Record<string, string> = {
    product_created: "Product aangemaakt",
    product_updated: "Product bijgewerkt",
    product_deleted: "Product verwijderd",
    product_edit_open: "Product bewerken",
    product_add_open: "Nieuw product",
    product_selected: "Product geselecteerd",
    item_added_to_cart: "Item toegevoegd",
    item_removed_from_cart: "Item verwijderd",
    cart_cleared: "Ticket geleegd",
    payment_started: "Betaling gestart",
    payment_completed: "Betaling afgerond",
    order_completed: "Bestelling afgerond",
    reservation_created: "Reservering aangemaakt",
    reservation_status_changed: "Reservering status",
    reservation_deleted: "Reservering verwijderd",
    customer_created: "Klant aangemaakt",
    customer_viewed: "Klant bekeken",
    customer_deleted: "Klant verwijderd",
    giftcard_issued: "Cadeaukaart uitgegeven",
    view_changed: "Pagina bekeken",
    login: "Ingelogd",
    logout: "Uitgelogd",
    cash_closing: "Kassa afgesloten",
  };

  const actionColors: Record<string, string> = {
    product_created: "bg-green-100 text-green-800",
    product_updated: "bg-blue-100 text-blue-800",
    product_deleted: "bg-red-100 text-red-800",
    item_added_to_cart: "bg-emerald-100 text-emerald-800",
    item_removed_from_cart: "bg-orange-100 text-orange-800",
    cart_cleared: "bg-yellow-100 text-yellow-800",
    payment_started: "bg-indigo-100 text-indigo-800",
    payment_completed: "bg-purple-100 text-purple-800",
    order_completed: "bg-purple-100 text-purple-800",
    reservation_created: "bg-cyan-100 text-cyan-800",
    reservation_status_changed: "bg-sky-100 text-sky-800",
    reservation_deleted: "bg-red-100 text-red-800",
    customer_created: "bg-teal-100 text-teal-800",
    customer_viewed: "bg-slate-100 text-slate-800",
    customer_deleted: "bg-red-100 text-red-800",
    giftcard_issued: "bg-pink-100 text-pink-800",
    view_changed: "bg-gray-100 text-gray-800",
    login: "bg-emerald-100 text-emerald-800",
    logout: "bg-amber-100 text-amber-800",
    cash_closing: "bg-emerald-100 text-emerald-800",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Zoek in logs..." className="pl-9" />
        </div>
        <select value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)} className="rounded-lg border px-3 py-2 text-sm bg-white">
          <option value="all">Alle medewerkers</option>
          {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="rounded-lg border px-3 py-2 text-sm bg-white">
          <option value="all">Alle acties</option>
          {actionTypes.map((t) => <option key={t} value={t}>{actionLabels[t] || t}</option>)}
        </select>
        <Badge variant="outline">{filtered.length} logs</Badge>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-0">
          <div className="divide-y max-h-[70vh] overflow-auto">
            {filtered.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Geen logs gevonden</p>
              </div>
            )}
            {filtered.map((log) => (
              <div key={log.id} className="flex items-start gap-3 p-3 hover:bg-neutral-50">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  {log.employeeName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{log.employeeName}</span>
                    <Badge className={clsx("text-[10px] rounded-full", actionColors[log.action] || "bg-gray-100 text-gray-800")}>
                      {actionLabels[log.action] || log.action}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{log.details}</p>
                </div>
                <div className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                  {formatDate(log.timestamp)} {formatTime(log.timestamp)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── CASH CLOSING MODAL ──────────────────────────────────────────────────────

function CashClosingModal({ open, onClose, employees, loggedInEmployee, orders, onComplete, addLog }: {
  open: boolean; onClose: () => void; employees: any[]; loggedInEmployee: any; orders: any[];
  onComplete: (record: any) => void; addLog: (action: string, details: string) => void;
}) {
  const [step, setStep] = useState(1);
  const [countedCash, setCountedCash] = useState("");
  const [floatAmount, setFloatAmount] = useState("300");
  const [expenseReceipts, setExpenseReceipts] = useState("");
  const [expenseNote, setExpenseNote] = useState("");
  const [secondCheckerId, setSecondCheckerId] = useState("");
  const [secondPin, setSecondPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [envelopeCode, setEnvelopeCode] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(1); setCountedCash(""); setFloatAmount("300"); setExpenseReceipts("");
      setExpenseNote(""); setSecondCheckerId(""); setSecondPin(""); setPinError("");
      setEnvelopeCode(""); setSaving(false);
    }
  }, [open]);

  const counted = parseFloat(countedCash) || 0;
  const float_ = parseFloat(floatAmount) || 300;
  const expenses = parseFloat(expenseReceipts) || 0;
  const envelopeAmount = Math.max(0, counted - float_);

  const otherEmployees = employees.filter((e) => e.id !== loggedInEmployee?.id);
  const selectedChecker = employees.find((e) => e.id === secondCheckerId);

  function generateCode() {
    const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join("");
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
  }

  function verifySecondPin() {
    if (!selectedChecker) return;
    if (secondPin === selectedChecker.pin) {
      setPinError("");
      const code = generateCode();
      setEnvelopeCode(code);

      // Calculate expected (owner-only data, staff won't see this)
      const todayOrders = orders.filter((o: any) => isToday(o.date));
      const cashRevenue = todayOrders
        .filter((o: any) => o.method === "cash" || (o.method && o.method.includes("cash")))
        .reduce((s: number, o: any) => s + (o.total || 0), 0);
      const expectedEnvelope = Math.max(0, cashRevenue - expenses);
      const diff = envelopeAmount - expectedEnvelope;
      let status = "correct";
      if (Math.abs(diff) > 10) status = "onderzoeken";
      else if (Math.abs(diff) > 2) status = "klein_verschil";

      const record = {
        closing_date: new Date().toISOString().split("T")[0],
        primary_employee_id: loggedInEmployee.id,
        primary_employee_name: loggedInEmployee.name,
        second_checker_id: selectedChecker.id,
        second_checker_name: selectedChecker.name,
        counted_cash: counted,
        float_amount: float_,
        expense_receipts: expenses,
        expense_note: expenseNote || null,
        envelope_amount: envelopeAmount,
        envelope_code: code,
        expected_cash_revenue: cashRevenue,
        expected_envelope: expectedEnvelope,
        difference: Math.round(diff * 100) / 100,
        status,
      };

      setSaving(true);
      supabase.from("cash_closings").insert(record as any).then(({ error }) => {
        setSaving(false);
        if (error) console.error("Failed to save cash closing:", error);
        else {
          addLog("cash_closing", `Kassa afgesloten: ${euro(envelopeAmount)} in enveloppe (code: ${code})`);
          onComplete(record);
        }
      });

      setStep(6);
    } else {
      setPinError("Ongeldige PIN. Probeer opnieuw.");
    }
  }

  if (!open) return null;

  return (
    <Modal open={open} onClose={step === 6 ? undefined : onClose}>
      <div className="p-6 space-y-5">
        {/* Step indicator */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Lock className="h-5 w-5" /> Kassa Afsluiting
          </h2>
          {step < 6 && (
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <div key={s} className={clsx("w-2.5 h-2.5 rounded-full transition-all", s === step ? "bg-primary scale-125" : s < step ? "bg-primary/40" : "bg-muted")} />
              ))}
            </div>
          )}
          {step < 6 && <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full"><X className="h-5 w-5" /></button>}
        </div>

        {/* Step 1: Cash count */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="font-semibold text-amber-900 flex items-center gap-2"><Banknote className="h-4 w-4" /> Stap 1: Kas tellen</div>
              <p className="text-sm text-amber-700 mt-1">Tel al het contante geld in de kassa en voer het totaal in.</p>
            </div>
            <div>
              <Label className="text-sm font-semibold">Kas totaal geteld (€)</Label>
              <Input type="number" value={countedCash} onChange={(e) => setCountedCash(e.target.value)}
                placeholder="Bijv. 421" className="mt-1 text-2xl font-bold h-14 text-center" autoFocus />
            </div>
            <Button className="w-full h-12" onClick={() => setStep(2)} disabled={!countedCash || counted <= 0}>
              Volgende <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Step 2: Float */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="font-semibold text-blue-900 flex items-center gap-2"><Wallet className="h-4 w-4" /> Stap 2: Wisselgeld achterlaten</div>
              <p className="text-sm text-blue-700 mt-1">Laat exact €{float_} achter in de kassa voor de volgende dag.</p>
            </div>
            <div>
              <Label className="text-sm font-semibold">Bedrag achterlaten in kassa (€)</Label>
              <Input type="number" value={floatAmount} onChange={(e) => setFloatAmount(e.target.value)}
                placeholder="300" className="mt-1 text-2xl font-bold h-14 text-center"
                disabled={loggedInEmployee?.role !== "owner"} />
              {loggedInEmployee?.role !== "owner" && (
                <p className="text-xs text-muted-foreground mt-1">Alleen de owner kan dit bedrag wijzigen.</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1"><ChevronLeft className="h-4 w-4 mr-1" /> Terug</Button>
              <Button className="flex-1" onClick={() => setStep(3)}>Volgende <ChevronRight className="h-4 w-4 ml-1" /></Button>
            </div>
          </div>
        )}

        {/* Step 3: Expense receipts */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="font-semibold text-orange-900 flex items-center gap-2"><Receipt className="h-4 w-4" /> Stap 3: Bonnen & uitgaven</div>
              <p className="text-sm text-orange-700 mt-1">Voer het totaal aan contante uitgaven in die vandaag zijn gedaan (melk, cups, boodschappen).</p>
            </div>
            <div>
              <Label className="text-sm font-semibold">Totaal bonnen / uitgaven vandaag (€)</Label>
              <Input type="number" value={expenseReceipts} onChange={(e) => setExpenseReceipts(e.target.value)}
                placeholder="Bijv. 22" className="mt-1 text-2xl font-bold h-14 text-center" />
            </div>
            <div>
              <Label className="text-sm font-semibold">Notitie (optioneel)</Label>
              <Input value={expenseNote} onChange={(e) => setExpenseNote(e.target.value)}
                placeholder="Bijv. melk + cups" className="mt-1" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1"><ChevronLeft className="h-4 w-4 mr-1" /> Terug</Button>
              <Button className="flex-1" onClick={() => setStep(4)}>Volgende <ChevronRight className="h-4 w-4 ml-1" /></Button>
            </div>
          </div>
        )}

        {/* Step 4: Envelope amount */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="font-semibold text-green-900 flex items-center gap-2"><DollarSign className="h-4 w-4" /> Stap 4: Enveloppe bedrag</div>
              <p className="text-sm text-green-700 mt-1">Dit bedrag gaat in de enveloppe.</p>
            </div>
            <div className="bg-white border-2 border-green-400 rounded-2xl p-6 text-center">
              <div className="text-sm text-muted-foreground">Geteld: {euro(counted)} − Float: {euro(float_)}</div>
              <div className="text-5xl font-black text-green-700 mt-2">{euro(envelopeAmount)}</div>
              <div className="text-sm font-medium text-green-600 mt-2">In enveloppe</div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)} className="flex-1"><ChevronLeft className="h-4 w-4 mr-1" /> Terug</Button>
              <Button className="flex-1" onClick={() => setStep(5)}>Tweede check <ChevronRight className="h-4 w-4 ml-1" /></Button>
            </div>
          </div>
        )}

        {/* Step 5: Second person verification */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <div className="font-semibold text-purple-900 flex items-center gap-2"><Eye className="h-4 w-4" /> Stap 5: Tweede collega check (4-ogen)</div>
              <p className="text-sm text-purple-700 mt-1">Een tweede medewerker moet de afsluiting bevestigen met hun PIN.</p>
            </div>

            <div className="bg-white rounded-xl border p-4 space-y-3">
              <div className="text-sm text-muted-foreground">Samenvatting:</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Geteld:</div><div className="font-bold">{euro(counted)}</div>
                <div>Float:</div><div className="font-bold">{euro(float_)}</div>
                <div>Bonnen:</div><div className="font-bold">{euro(expenses)}</div>
                <div>Enveloppe:</div><div className="font-bold text-green-700">{euro(envelopeAmount)}</div>
              </div>
            </div>

            <div>
              <Label className="text-sm font-semibold">Wie is de tweede collega?</Label>
              <select value={secondCheckerId} onChange={(e) => { setSecondCheckerId(e.target.value); setSecondPin(""); setPinError(""); }}
                className="w-full rounded-lg border px-3 py-2 text-sm bg-white mt-1">
                <option value="">Selecteer collega...</option>
                {otherEmployees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>)}
              </select>
            </div>

            {secondCheckerId && (
              <div>
                <Label className="text-sm font-semibold">PIN van {selectedChecker?.name}</Label>
                <Input type="password" maxLength={6} value={secondPin}
                  onChange={(e) => { setSecondPin(e.target.value.replace(/\D/g, "").slice(0, 6)); setPinError(""); }}
                  placeholder="••••••" className="mt-1 font-mono text-center text-xl tracking-[0.5em]" />
                {pinError && <p className="text-sm text-destructive mt-1">{pinError}</p>}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(4)} className="flex-1"><ChevronLeft className="h-4 w-4 mr-1" /> Terug</Button>
              <Button className="flex-1" onClick={verifySecondPin}
                disabled={!secondCheckerId || secondPin.length !== 6 || saving}>
                {saving ? "Opslaan..." : "Bevestigen"} <Check className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 6: Envelope code */}
        {step === 6 && (
          <div className="space-y-6 text-center py-4">
            <div className="mx-auto h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <div className="text-xl font-bold">Kassa afgesloten!</div>

            <div className="bg-black text-white rounded-2xl p-8">
              <div className="text-sm text-white/60 mb-2">Enveloppe code</div>
              <div className="text-5xl font-black tracking-[0.15em] font-mono">{envelopeCode}</div>
              <div className="text-sm text-white/60 mt-4">Schrijf deze code op de enveloppe</div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-left">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Enveloppe bedrag:</div><div className="font-bold">{euro(envelopeAmount)}</div>
                <div className="text-muted-foreground">Afgesloten door:</div><div className="font-bold">{loggedInEmployee?.name}</div>
                <div className="text-muted-foreground">Gecontroleerd door:</div><div className="font-bold">{selectedChecker?.name}</div>
                <div className="text-muted-foreground">Float in kassa:</div><div className="font-bold">{euro(float_)}</div>
                <div className="text-muted-foreground">Bonnen/uitgaven:</div><div className="font-bold">{euro(expenses)}</div>
                {expenseNote && <><div className="text-muted-foreground">Notitie:</div><div className="font-bold">{expenseNote}</div></>}
              </div>
            </div>

            <Button className="w-full h-12" onClick={onClose}>Sluiten</Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── PREP STATION VIEW ───────────────────────────────────────────────────────

type PrepTicket = {
  id: string;
  orderId: string;
  station: "drinks" | "food" | "pickup";
  items: { name: string; qty: number; modifiers: { optionName: string; price: number }[]; notes?: string }[];
  status: "ordered" | "preparing" | "ready" | "completed";
  createdAt: Date;
  startedAt?: Date;
  readyAt?: Date;
  completedAt?: Date;
  orderType: string;
  paymentStatus: string;
};

function PrepTicketTimer({ createdAt }: { createdAt: Date }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const diffSec = Math.floor((now - createdAt.getTime()) / 1000);
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  const isLate = mins >= 5;
  return (
    <span className={clsx("font-mono text-xs font-bold", isLate ? "text-red-600 animate-pulse" : "text-muted-foreground")}>
      {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
    </span>
  );
}

function PrepStationView({ prepTickets, onUpdateStatus }: { prepTickets: PrepTicket[]; onUpdateStatus: (id: string, status: PrepTicket["status"]) => void }) {
  const [activeStation, setActiveStation] = useState<"all" | "drinks" | "food" | "pickup">("all");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(i);
  }, []);

  const stations = [
    { key: "all" as const, label: "Alle", icon: "📋" },
    { key: "drinks" as const, label: "Drinks", icon: "🥤" },
    { key: "food" as const, label: "Food", icon: "🍰" },
    { key: "pickup" as const, label: "Pickup", icon: "📦" },
  ];

  const filtered = activeStation === "all" ? prepTickets : prepTickets.filter((t) => t.station === activeStation);
  const activeTickets = filtered.filter((t) => t.status !== "completed");
  const completedTickets = filtered.filter((t) => t.status === "completed");

  // Analytics
  const todayTickets = prepTickets.filter((t) => isToday(t.createdAt));
  const completedToday = todayTickets.filter((t) => t.status === "completed");
  const waitingCount = prepTickets.filter((t) => t.status === "ordered" || t.status === "preparing").length;
  const avgPrepTime = completedToday.length > 0
    ? completedToday.reduce((s, t) => s + ((t.completedAt?.getTime() || 0) - t.createdAt.getTime()), 0) / completedToday.length / 1000 / 60
    : 0;
  const longestWaiting = prepTickets
    .filter((t) => t.status === "ordered" || t.status === "preparing")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];

  const statusColors: Record<string, string> = {
    ordered: "bg-muted border-muted-foreground/20",
    preparing: "bg-orange-50 border-orange-300",
    ready: "bg-green-50 border-green-300",
    completed: "bg-blue-50 border-blue-300 opacity-60",
  };

  const statusLabels: Record<string, string> = {
    ordered: "Besteld",
    preparing: "Bereiding",
    ready: "Klaar",
    completed: "Voltooid",
  };

  const statusBadgeColors: Record<string, string> = {
    ordered: "bg-muted-foreground/20 text-muted-foreground",
    preparing: "bg-orange-200 text-orange-800",
    ready: "bg-green-200 text-green-800",
    completed: "bg-blue-200 text-blue-800",
  };

  return (
    <div className="space-y-4">
      {/* Header + station tabs */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <ChefHat className="h-6 w-6" /> Prepstation
          </h2>
          <p className="text-xs text-muted-foreground">Live keuken- en barweergave</p>
        </div>
        <div className="flex gap-1.5">
          {stations.map((s) => (
            <button key={s.key} onClick={() => setActiveStation(s.key)}
              className={clsx("px-4 py-2 rounded-full text-sm font-medium transition",
                activeStation === s.key ? "bg-foreground text-background" : "bg-muted/50 hover:bg-muted")}>
              {s.icon} {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick analytics */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="rounded-2xl">
          <CardContent className="p-3 text-center">
            <div className="text-xs text-muted-foreground">Wachtend</div>
            <div className="text-2xl font-black">{waitingCount}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-3 text-center">
            <div className="text-xs text-muted-foreground">Voltooid vandaag</div>
            <div className="text-2xl font-black">{completedToday.length}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-3 text-center">
            <div className="text-xs text-muted-foreground">Gem. preptijd</div>
            <div className="text-2xl font-black">{avgPrepTime > 0 ? `${avgPrepTime.toFixed(1)}m` : "—"}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-3 text-center">
            <div className="text-xs text-muted-foreground">Langst wachtend</div>
            <div className="text-2xl font-black">
              {longestWaiting ? <PrepTicketTimer createdAt={longestWaiting.createdAt} /> : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active tickets grid */}
      {activeTickets.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="p-12 text-center">
            <ChefHat className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">Geen actieve tickets</p>
            <p className="text-sm text-muted-foreground mt-1">Nieuwe tickets verschijnen automatisch na betaling.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {activeTickets.map((ticket) => (
            <Card key={ticket.id} className={clsx("rounded-2xl border-2 transition-all", statusColors[ticket.status])}>
              <CardContent className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <span className="font-black text-lg">#{ticket.orderId}</span>
                  <Badge className={clsx("text-[10px]", statusBadgeColors[ticket.status])}>{statusLabels[ticket.status]}</Badge>
                </div>

                {/* Timer */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <PrepTicketTimer createdAt={ticket.createdAt} />
                  </div>
                  <Badge variant="outline" className="text-[9px] capitalize">{ticket.station}</Badge>
                </div>

                {/* Order type */}
                <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                  <span className="capitalize">{ticket.orderType}</span>
                  <span>· {ticket.paymentStatus}</span>
                </div>

                {/* Items */}
                <div className="space-y-1.5">
                  {ticket.items.map((item, idx) => (
                    <div key={idx} className="text-sm">
                      <div className="font-medium">{item.qty}× {item.name}</div>
                      {item.modifiers?.length > 0 && (
                        <div className="text-[11px] text-muted-foreground ml-3">
                          {item.modifiers.map((m) => m.optionName).join(", ")}
                        </div>
                      )}
                      {item.notes && <div className="text-[11px] italic text-orange-600 ml-3">📝 {item.notes}</div>}
                    </div>
                  ))}
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 pt-1">
                  {ticket.status === "ordered" && (
                    <Button size="sm" className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs"
                      onClick={() => onUpdateStatus(ticket.id, "preparing")}>
                      <Play className="h-3.5 w-3.5 mr-1" /> Start
                    </Button>
                  )}
                  {ticket.status === "preparing" && (
                    <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs"
                      onClick={() => onUpdateStatus(ticket.id, "ready")}>
                      <Check className="h-3.5 w-3.5 mr-1" /> Klaar
                    </Button>
                  )}
                  {ticket.status === "ready" && (
                    <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs"
                      onClick={() => onUpdateStatus(ticket.id, "completed")}>
                      <Check className="h-3.5 w-3.5 mr-1" /> Voltooid
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="rounded-xl text-xs"
                    onClick={() => {
                      const printContent = ticket.items.map((i) => `${i.qty}× ${i.name}${i.modifiers?.length ? ` (${i.modifiers.map((m) => m.optionName).join(", ")})` : ""}${i.notes ? ` [${i.notes}]` : ""}`).join("\n");
                      const printWindow = window.open("", "_blank", "width=300,height=500");
                      if (printWindow) {
                        printWindow.document.write(`<html><head><title>Prep Bon</title><style>body{font-family:monospace;font-size:14px;padding:20px}h2{margin:0 0 8px}hr{border:none;border-top:1px dashed #000;margin:10px 0}.item{margin:4px 0}.meta{font-size:11px;color:#666}</style></head><body><h2>PREP BON</h2><div class="meta">#${ticket.orderId} · ${ticket.station.toUpperCase()}</div><div class="meta">${ticket.orderType} · ${new Date(ticket.createdAt).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}</div><hr/>${ticket.items.map((i) => `<div class="item"><strong>${i.qty}× ${i.name}</strong>${i.modifiers?.length ? `<br/>&nbsp;&nbsp;${i.modifiers.map((m) => m.optionName).join(", ")}` : ""}${i.notes ? `<br/>&nbsp;&nbsp;<em>📝 ${i.notes}</em>` : ""}</div>`).join("")}<hr/><div class="meta">Herprint · ${new Date().toLocaleTimeString("nl-NL")}</div></body></html>`);
                        printWindow.document.close();
                        printWindow.print();
                      }
                    }}>
                    <Printer className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Completed section */}
      {completedTickets.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Voltooid ({completedTickets.length})</h3>
          <div className="grid grid-cols-3 lg:grid-cols-4 gap-2">
            {completedTickets.slice(0, 12).map((ticket) => (
              <div key={ticket.id} className="rounded-xl border bg-muted/30 p-3 opacity-60">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">#{ticket.orderId}</span>
                  <Badge className="bg-blue-100 text-blue-700 text-[9px]">Voltooid</Badge>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {ticket.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CASH CLOSING VIEW (trigger for all staff) ──────────────────────────────

function CashCloseView({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-6">
      <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center">
        <Lock className="h-12 w-12 text-amber-700" />
      </div>
      <h2 className="text-2xl font-bold">Kassa Afsluiting</h2>
      <p className="text-muted-foreground text-center max-w-sm">
        Start de kassasluiting aan het einde van je dienst. Je telt het contante geld, voert de bonnen in, en een collega bevestigt met een tweede check.
      </p>
      <Button size="lg" className="h-14 px-10 text-lg rounded-2xl" onClick={onOpen}>
        <Banknote className="h-5 w-5 mr-2" /> Start Kassa Afsluiting
      </Button>
    </div>
  );
}

// ─── CASH AUDIT VIEW (owner only) ───────────────────────────────────────────

function CashAuditView() {
  const [closings, setClosings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [noteText, setNoteText] = useState("");
  const [noteEmployee, setNoteEmployee] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadClosings() {
    const { data } = await supabase.from("cash_closings").select("*").order("created_at", { ascending: false }).limit(200);
    if (data) setClosings(data);
    setLoading(false);
  }

  async function loadNotes(closingId: string) {
    const { data } = await supabase.from("cash_audit_notes").select("*").eq("cash_closing_id", closingId).order("created_at", { ascending: false });
    if (data) setNotes(data);
  }

  useEffect(() => { loadClosings(); }, []);
  useEffect(() => { if (selected) loadNotes(selected.id); }, [selected]);

  async function handleAction(actionType: string, statusUpdate: string, label: string) {
    if (!selected) return;
    setSaving(true);
    // Update status on cash_closings
    await supabase.from("cash_closings").update({ status: statusUpdate }).eq("id", selected.id);
    // Add automatic note
    const autoNote = actionType === "goedgekeurd" ? `Afsluiting goedgekeurd en afgehandeld.`
      : actionType === "geescaleerd" ? `Afsluiting geëscaleerd voor verder onderzoek.`
      : `Verschil geaccepteerd als verklaard.`;
    await supabase.from("cash_audit_notes").insert({
      cash_closing_id: selected.id,
      employee_name: noteEmployee || "Owner",
      note_text: autoNote,
      action_type: actionType,
    });
    setSelected({ ...selected, status: statusUpdate });
    await loadNotes(selected.id);
    await loadClosings();
    setSaving(false);
  }

  async function addNote() {
    if (!selected || !noteText.trim()) return;
    setSaving(true);
    await supabase.from("cash_audit_notes").insert({
      cash_closing_id: selected.id,
      employee_name: noteEmployee || "Owner",
      note_text: noteText.trim(),
      action_type: "notitie",
    });
    setNoteText("");
    await loadNotes(selected.id);
    setSaving(false);
  }

  function statusBadge(status: string, diff: number) {
    if (status === "goedgekeurd") return <Badge className="bg-green-100 text-green-800 text-[10px]">Afgehandeld</Badge>;
    if (status === "geescaleerd") return <Badge className="bg-purple-100 text-purple-800 text-[10px]">Geëscaleerd</Badge>;
    if (status === "geaccepteerd") return <Badge className="bg-blue-100 text-blue-800 text-[10px]">Geaccepteerd</Badge>;
    const absDiff = Math.abs(diff);
    if (absDiff <= 2) return <Badge className="bg-green-100 text-green-800 text-[10px]">Correct</Badge>;
    if (absDiff <= 10) return <Badge className="bg-orange-100 text-orange-800 text-[10px]">Klein verschil</Badge>;
    return <Badge className="bg-red-100 text-red-800 text-[10px]">Onderzoeken</Badge>;
  }

  function actionIcon(type: string) {
    if (type === "goedgekeurd") return "✅";
    if (type === "geescaleerd") return "🚨";
    if (type === "geaccepteerd") return "📋";
    return "📝";
  }

  if (loading) return <div className="py-20 text-center text-muted-foreground">Laden...</div>;

  // Detail view for investigation
  if (selected) {
    const c = selected;
    const absDiff = Math.abs(c.difference);
    const severityColor = absDiff <= 2 ? "text-green-700" : absDiff <= 10 ? "text-orange-600" : "text-red-600";
    const isResolved = ["goedgekeurd", "geescaleerd", "geaccepteerd"].includes(c.status);

    return (
      <div className="space-y-4">
        <button onClick={() => { setSelected(null); setNotes([]); setNoteText(""); }} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Terug naar overzicht
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Afsluiting onderzoek</h2>
            <p className="text-sm text-muted-foreground">
              {new Date(c.closing_date).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          {statusBadge(c.status, c.difference)}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Card className="rounded-xl">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Medewerkers</p>
              <div className="space-y-1">
                <p className="text-sm"><span className="text-muted-foreground">Geteld door:</span> <span className="font-medium">{c.primary_employee_name}</span></p>
                <p className="text-sm"><span className="text-muted-foreground">2e controle:</span> <span className="font-medium">{c.second_checker_name}</span></p>
              </div>
              <p className="text-xs text-muted-foreground">Enveloppe code: <span className="font-mono">{c.envelope_code}</span></p>
            </CardContent>
          </Card>

          <Card className={clsx("rounded-xl border", absDiff <= 2 ? "bg-green-50 border-green-200" : absDiff <= 10 ? "bg-orange-50 border-orange-200" : "bg-red-50 border-red-200")}>
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Verschil analyse</p>
              <p className={clsx("text-2xl font-bold", severityColor)}>
                {c.difference >= 0 ? "+" : ""}{euro(c.difference)}
              </p>
              <p className="text-xs text-muted-foreground">
                {absDiff <= 2 ? "Verschil valt binnen acceptabele marge (≤ €2)." :
                 absDiff <= 10 ? "Klein verschil — mogelijk afrondingsverschillen of wisselfouten." :
                 "Significant verschil — vereist nader onderzoek."}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-xl">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Kassaberekening</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">Geteld bedrag</span>
                <span className="font-medium">{euro(c.counted_cash)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">Float (wisselgeld)</span>
                <span>– {euro(c.float_amount)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">Bonnen / uitgaven</span>
                <span>– {euro(c.expense_receipts)}</span>
              </div>
              {c.expense_note && (
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Notitie uitgaven</span>
                  <span className="text-right max-w-[60%]">{c.expense_note}</span>
                </div>
              )}
              <div className="flex justify-between py-1.5 border-b border-border/50 font-bold">
                <span>Enveloppe bedrag</span>
                <span>{euro(c.envelope_amount)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">Verwachte cash omzet</span>
                <span>{euro(c.expected_cash_revenue)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">Verwachte enveloppe</span>
                <span>{euro(c.expected_envelope)}</span>
              </div>
              <div className={clsx("flex justify-between py-2 font-bold text-base", severityColor)}>
                <span>Verschil</span>
                <span>{c.difference >= 0 ? "+" : ""}{euro(c.difference)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {absDiff > 10 && !isResolved && (
          <Card className="rounded-xl border-red-200 bg-red-50/50">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-red-800 uppercase tracking-wide mb-2">Mogelijke oorzaken</p>
              <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                {c.difference > 0 && <li>Er zit meer geld in de kassa dan verwacht — mogelijk niet-geregistreerde contante verkoop.</li>}
                {c.difference < 0 && <li>Er zit minder geld in de kassa dan verwacht — mogelijk fouten bij wisselgeld of ontbrekende transacties.</li>}
                <li>Controleer of alle bonnen correct zijn ingevoerd.</li>
                <li>Controleer of het wisselgeld (float) klopt met het beginbedrag.</li>
                <li>Vergelijk met de pinbetalingen van deze dag.</li>
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Action buttons */}
        {!isResolved && (
          <Card className="rounded-xl">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Acties</p>
              <div className="flex gap-2 flex-wrap">
                <button
                  disabled={saving}
                  onClick={() => handleAction("goedgekeurd", "goedgekeurd", "Goedkeuren")}
                  className="px-3 py-2 text-sm rounded-lg bg-green-100 text-green-800 hover:bg-green-200 transition-colors font-medium"
                >
                  ✅ Goedkeuren
                </button>
                <button
                  disabled={saving}
                  onClick={() => handleAction("geaccepteerd", "geaccepteerd", "Accepteren")}
                  className="px-3 py-2 text-sm rounded-lg bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors font-medium"
                >
                  📋 Verschil accepteren
                </button>
                <button
                  disabled={saving}
                  onClick={() => handleAction("geescaleerd", "geescaleerd", "Escaleren")}
                  className="px-3 py-2 text-sm rounded-lg bg-purple-100 text-purple-800 hover:bg-purple-200 transition-colors font-medium"
                >
                  🚨 Escaleren
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes section */}
        <Card className="rounded-xl">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Notities</p>
            
            <div className="flex gap-2 mb-3">
              <input
                value={noteEmployee}
                onChange={(e) => setNoteEmployee(e.target.value)}
                placeholder="Jouw naam"
                className="px-3 py-2 text-sm rounded-lg border border-border bg-background w-36"
              />
              <input
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Schrijf een notitie..."
                className="px-3 py-2 text-sm rounded-lg border border-border bg-background flex-1"
                onKeyDown={(e) => e.key === "Enter" && addNote()}
              />
              <button
                disabled={saving || !noteText.trim()}
                onClick={addNote}
                className="px-3 py-2 text-sm rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity font-medium disabled:opacity-40"
              >
                Toevoegen
              </button>
            </div>

            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Nog geen notities.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-auto">
                {notes.map((n) => (
                  <div key={n.id} className="flex gap-2 text-sm py-2 border-b border-border/40 last:border-0">
                    <span className="shrink-0">{actionIcon(n.action_type)}</span>
                    <div className="flex-1 min-w-0">
                      <p>{n.note_text}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {n.employee_name} · {new Date(n.created_at).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Cash Audit</h2>
          <p className="text-sm text-muted-foreground">Alleen zichtbaar voor owners. Vergelijk enveloppe bedragen met verwachte cash omzet.</p>
        </div>
        <Badge variant="outline">{closings.length} afsluitingen</Badge>
      </div>

      <Card className="rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[70vh]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium">Datum</th>
                  <th className="px-3 py-2 text-left font-medium">Code</th>
                  <th className="px-3 py-2 text-left font-medium">Medewerker</th>
                  <th className="px-3 py-2 text-left font-medium">2e Check</th>
                  <th className="px-3 py-2 text-right font-medium">Geteld</th>
                  <th className="px-3 py-2 text-right font-medium">Float</th>
                  <th className="px-3 py-2 text-right font-medium">Bonnen</th>
                  <th className="px-3 py-2 text-right font-medium">Enveloppe</th>
                  <th className="px-3 py-2 text-right font-medium">Verwacht</th>
                  <th className="px-3 py-2 text-right font-medium">Verschil</th>
                  <th className="px-3 py-2 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {closings.length === 0 && (
                  <tr><td colSpan={11} className="p-8 text-center text-muted-foreground">Geen afsluitingen gevonden</td></tr>
                )}
                {closings.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => setSelected(c)}>
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(c.closing_date).toLocaleDateString("nl-NL")}</td>
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{c.envelope_code}</td>
                    <td className="px-3 py-2">{c.primary_employee_name}</td>
                    <td className="px-3 py-2">{c.second_checker_name}</td>
                    <td className="px-3 py-2 text-right font-medium">{euro(c.counted_cash)}</td>
                    <td className="px-3 py-2 text-right">{euro(c.float_amount)}</td>
                    <td className="px-3 py-2 text-right">{euro(c.expense_receipts)}</td>
                    <td className="px-3 py-2 text-right font-bold">{euro(c.envelope_amount)}</td>
                    <td className="px-3 py-2 text-right">{euro(c.expected_envelope)}</td>
                    <td className={clsx("px-3 py-2 text-right font-bold",
                      Math.abs(c.difference) <= 2 ? "text-green-700" : Math.abs(c.difference) <= 10 ? "text-orange-600" : "text-red-600"
                    )}>{c.difference >= 0 ? "+" : ""}{euro(c.difference)}</td>
                    <td className="px-3 py-2 text-center">{statusBadge(c.status, c.difference)}</td>
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

// ─── PLATFORM TENANT PICKER ──────────────────────────────────────────────────

function PlatformTenantPicker({ tenants, onSelect, onAdmin }: { tenants: any[]; onSelect: (t: any) => void; onAdmin: () => void }) {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const filtered = tenants.filter((t: any) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-dvh flex flex-col items-center justify-center relative overflow-hidden select-none" style={{ background: "linear-gradient(180deg, #f0f2f8 0%, #e8ecf4 100%)" }}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-[-10%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_center,rgba(214,197,255,0.35),transparent_70%)] blur-3xl" />
        <div className="absolute right-[-8%] top-[8%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_center,rgba(255,188,233,0.25),transparent_70%)] blur-3xl" />
      </div>
      <div className="relative z-10 w-full max-w-2xl px-6">
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, rgba(172,155,255,0.3), rgba(205,216,255,0.4))", border: "1px solid rgba(255,255,255,0.6)", boxShadow: "0 12px 40px rgba(160,175,219,0.15)" }}
          >
            <Shield className="w-8 h-8" style={{ color: "#5a5a72" }} />
          </motion.div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: "#2a2a3a" }}>Selecteer Tenant</h1>
          <p className="text-sm mt-1" style={{ color: "#8b8b9e" }}>Kies een klant om hun POS te openen</p>
        </div>

        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9b9bab" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Zoek tenant..."
            className="w-full h-11 pl-10 pr-4 rounded-xl text-sm border"
            style={{ background: "rgba(255,255,255,0.8)", borderColor: "rgba(0,0,0,0.08)", backdropFilter: "blur(10px)" }}
          />
        </div>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {filtered.map((t: any, i: number) => (
            <motion.button
              key={t.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={async () => { setLoading(t.id); await onSelect(t); setLoading(null); }}
              disabled={loading !== null}
              className="w-full rounded-xl p-4 flex items-center justify-between text-left transition-all hover:scale-[1.01]"
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(247,249,255,0.78))",
                border: "1px solid rgba(255,255,255,0.72)",
                boxShadow: "inset 0 1px 1px rgba(255,255,255,0.85), 0 8px 24px rgba(160,175,219,0.08)",
                opacity: t.is_active ? 1 : 0.5,
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold" style={{ background: t.is_active ? "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(16,185,129,0.2))" : "rgba(0,0,0,0.04)", color: t.is_active ? "#16a34a" : "#9b9bab" }}>
                  {t.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-semibold" style={{ color: "#2a2a3a" }}>{t.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-mono" style={{ color: "#8b8b9e" }}>{t.slug}</span>
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full font-medium uppercase" style={{ background: "rgba(172,155,255,0.1)", color: "#7c6bc4" }}>{t.plan}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {loading === t.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#7c6bc4" }} />
                ) : (
                  <ChevronRight className="w-4 h-4" style={{ color: "#9b9bab" }} />
                )}
              </div>
            </motion.button>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-8 text-sm" style={{ color: "#9b9bab" }}>Geen tenants gevonden</div>
          )}
        </div>

        <div className="mt-6 text-center">
          <button onClick={onAdmin} className="text-xs font-medium px-4 py-2 rounded-lg transition-colors hover:bg-white/50" style={{ color: "#7c6bc4" }}>
            <Shield className="w-3.5 h-3.5 inline mr-1" />
            Naar Admin Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────

export default function SaakoukPOS() {
  const { employee: authEmployee, logout: authLogout } = useAuth();
  const { locations, activeLocation, setActiveLocationId, isPlatformAdmin, allTenants, selectedTenantId, selectTenant, clearTenantSelection, tenantUnlocked, unlockTenant } = useLocation_();
  const locationId = activeLocation?.id || null;
  const loggedInEmployee = authEmployee ? { id: authEmployee.id, name: authEmployee.full_name, role: authEmployee.role } : null;
  const [active, setActive] = useState("pos");
  const [sectionPicked, setSectionPicked] = useState(false);
  const live = useLiveData(locationId);
  // A6: per-permission gate, loaded from role_permissions
  const { canAccessView } = useRolePermissions(loggedInEmployee?.role, locationId);
  const [products, setProducts] = useState<any[]>([]);
  const { groups: modifierGroups, links: modifierLinks, loading: modifiersLoading, refetch: refetchModifiers, getGroupsForProduct } = useModifiers(locationId);
  const upsellEngine = useUpsellEngine(products, locationId);
  const [tables, setTables] = useState<any[]>([]);
  const [channels] = useState(DELIVERY_CHANNELS);
  const [orders, setOrders] = useState<any[]>([]);
  const [dbLoaded, setDbLoaded] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [giftCards, setGiftCards] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [toast, setToast] = useState("");
  // Feature flags now sourced from location_settings; sensible defaults until loaded.
  const features = useMemo(() => ({
    tips: live.settings?.feature_tips ?? true,
    passkit: live.settings?.feature_passkit ?? true,
    piggy: live.settings?.feature_piggy ?? false,
    leat: live.settings?.feature_leat ?? false,
    qr: live.settings?.feature_qr ?? true,
    kitchen: live.settings?.feature_kitchen ?? false,
  }), [live.settings]);
  const setFeatures = useCallback((patch: any) => {
    const next = typeof patch === "function" ? patch(features) : patch;
    live.updateSettings({
      feature_tips: next.tips, feature_passkit: next.passkit, feature_piggy: next.piggy,
      feature_leat: next.leat, feature_qr: next.qr, feature_kitchen: next.kitchen,
    });
  }, [features, live]);
  const vatRates = live.vatRates;
  const setVatRates = useCallback((updater: any) => {
    const next = typeof updater === "function" ? updater(vatRates) : updater;
    Object.entries(next).forEach(([cat, rate]) => {
      if (vatRates[cat] !== rate) live.setVatRate(cat, Number(rate));
    });
  }, [vatRates, live]);
  const passkitConfig = useMemo(() => ({
    programId: live.settings?.passkit_program_id || "24RMbRfRp5Y9h9ptYWnwFe",
    tierId: live.settings?.passkit_tier_id || "",
    pointsPerEuro: Number(live.settings?.points_per_euro ?? 1),
    autoEnrol: live.settings?.auto_enrol ?? true,
  }), [live.settings]);
  const setPasskitConfig = useCallback((patch: any) => {
    const next = typeof patch === "function" ? patch(passkitConfig) : patch;
    live.updateSettings({
      passkit_program_id: next.programId, passkit_tier_id: next.tierId,
      points_per_euro: next.pointsPerEuro, auto_enrol: next.autoEnrol,
    });
  }, [passkitConfig, live]);
  const discounts = useMemo(() => live.discounts.map((d) => ({
    id: d.id, name: d.name, type: d.discount_type, value: Number(d.value),
  })), [live.discounts]);

  // Mirror live data into legacy local state used throughout component tree.
  useEffect(() => {
    setProducts(live.products.map((p) => ({
      id: p.id, name: p.name, section: p.section, price: Number(p.price),
      costPrice: Number(p.cost_price || 0), vatRate: p.vat_rate != null ? Number(p.vat_rate) : undefined,
      color: p.color, tags: p.tags || [], modifierGroups: [],
    })));
  }, [live.products]);
  useEffect(() => {
    const zoneMap = new Map(live.zones.map((z) => [z.id, z.name]));
    setTables(live.tables.map((t) => ({
      id: t.id, name: t.name, seats: t.seats, area: zoneMap.get(t.zone_id) || "Binnen",
      shape: t.shape, x: t.x, y: t.y, w: t.w, h: t.h,
    })));
  }, [live.tables, live.zones]);
  useEffect(() => {
    setReservations(live.reservations.map((r) => ({
      id: r.id, name: r.guest_name, date: r.reservation_date, time: (r.reservation_time || "").slice(0, 5),
      guests: r.guests, table: r.table_name || "", phone: r.phone || "", notes: r.notes || "", status: r.status,
    })));
  }, [live.reservations]);


  const [qrOrders, setQrOrders] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [prepTickets, setPrepTickets] = useState<PrepTicket[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [showLowStockPanel, setShowLowStockPanel] = useState(false);
  const [showCashClosing, setShowCashClosing] = useState(false);
  const [pendingGiftCardOrder, setPendingGiftCardOrder] = useState<any | null>(null);

  // Activity logs sourced from DB (location-scoped) via realtime; mapped for legacy consumers.
  const activityLogs = useMemo(() => live.activityLogs.map((l) => ({
    id: l.id, action: l.action, details: l.details,
    employeeId: l.employee_id, employeeName: l.employee_name, employeeRole: l.employee_role,
    timestamp: new Date(l.created_at),
  })), [live.activityLogs]);
  const setActivityLogs = useCallback(() => {}, []); // no-op; logs persist server-side.

  const addLog = useCallback((action: string, details: string) => {
    if (!loggedInEmployee) return;
    live.appendActivityLog({
      employeeId: loggedInEmployee.id,
      employeeName: loggedInEmployee.name,
      employeeRole: loggedInEmployee.role,
      action,
      details,
    });
  }, [loggedInEmployee, live]);

  // Load employees from database (location-scoped)
  useEffect(() => {
    if (!locationId) return;
    async function loadEmployees() {
      const { data } = await supabase.from("employees").select("id, full_name, role, is_active, location_id").eq("is_active", true).eq("location_id", locationId);
      if (data) {
        setEmployees(data.map((e: any) => ({ id: e.id, name: e.full_name, role: e.role })));
      }
    }
    loadEmployees();
  }, [locationId]);

  // Load gift cards from database (location-scoped) + realtime updates
  useEffect(() => {
    if (!locationId) return;
    async function loadGiftCards() {
      const { data, error } = await supabase
        .from("gift_cards")
        .select("*")
        .eq("location_id", locationId)
        .order("issued_at", { ascending: false });
      if (error) {
        console.error("Failed to load gift cards:", error);
        return;
      }
      if (data) {
        setGiftCards(data.map((gc: any) => ({
          id: gc.id,
          code: gc.code,
          balance: Number(gc.balance),
          initialValue: Number(gc.initial_value),
          status: gc.status,
          issuedAt: gc.issued_at?.slice(0, 10),
          customerName: gc.customer_name,
          customerEmail: gc.customer_email,
          customerPhone: gc.customer_phone,
          sourceOrderId: gc.source_order_id,
          passkitMemberId: gc.passkit_member_id,
          passkitEnrolled: gc.passkit_enrolled,
        })));
      }
    }
    loadGiftCards();
    const channel = supabase
      .channel("gift-cards-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "gift_cards", filter: `location_id=eq.${locationId}` }, () => {
        loadGiftCards();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [locationId]);

  // Load customers from database (unified registry) + realtime updates
  useEffect(() => {
    if (!locationId) return;
    async function loadCustomers() {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("location_id", locationId)
        .order("last_seen_at", { ascending: false });
      if (error) {
        console.error("Failed to load customers:", error);
        return;
      }
      if (data) {
        setCustomers(data.map((c: any) => ({
          id: c.id,
          name: c.full_name,
          email: c.email || "",
          phone: c.phone || "",
          provider: c.passkit_member_id ? "passkit" : "none",
          loyaltyId: c.passkit_member_id || "",
          points: 0,
          visits: c.visit_count || 0,
          totalSpent: Number(c.total_spent || 0),
          lastVisit: c.last_seen_at ? new Date(c.last_seen_at).toLocaleDateString("nl-NL") : "-",
          source: c.source,
          marketingOptIn: c.marketing_opt_in,
        })));
      }
    }
    loadCustomers();
    const channel = supabase
      .channel("customers-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "customers", filter: `location_id=eq.${locationId}` }, () => {
        loadCustomers();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [locationId]);

  // Poll low-stock items every 30s (location-scoped)
  useEffect(() => {
    if (!locationId) return;
    async function checkLowStock() {
      const { data } = await supabase.from("inventory_items").select("id, item_name, current_stock, minimum_stock, unit_type, category").eq("location_id", locationId);
      if (data) {
        const low = data.filter((i: any) => i.current_stock <= i.minimum_stock && i.minimum_stock > 0);
        setLowStockItems(low);
      }
    }
    checkLowStock();
    const interval = setInterval(checkLowStock, 30000);
    return () => clearInterval(interval);
  }, [locationId]);

  // Enrich products with DB-linked modifier groups when available.
  const enrichedProducts = useMemo(() => {
    if (modifierGroups.length === 0) return products;
    return products.map((p) => {
      const dbGroups = getGroupsForProduct(p.id);
      return dbGroups.length > 0 ? { ...p, modifierGroups: dbGroups } : p;
    });
  }, [products, modifierGroups, modifierLinks, getGroupsForProduct]);

  // Load saved transactions from database (location-scoped)
  useEffect(() => {
    if (!locationId) return;
    async function loadTransactions() {
      const { data } = await supabase.from("pos_transactions").select("*").eq("location_id", locationId).order("created_at", { ascending: false }).limit(500);
      if (data) {
        const mapped = data.map((t: any) => ({
          id: t.order_id,
          date: new Date(t.created_at),
          items: t.items || [],
          subtotal: t.subtotal,
          discount: t.discount,
          discountName: t.discount_name,
          total: t.total,
          tip: t.tip,
          method: t.payment_method,
          customerId: t.customer_id,
          customerName: t.customer_name,
          table: t.table_id,
          employeeId: t.employee_id,
          employeeName: t.employee_name,
          loyaltyProvider: t.loyalty_provider,
          loyaltyId: t.loyalty_id,
          giftCardDeduction: t.gift_card_deduction,
          giftCardId: t.gift_card_id,
          status: t.status,
          source: t.source,
        }));
        setOrders(mapped);
      }
      setDbLoaded(true);
    }
    loadTransactions();
  }, [locationId]);

  // Fetch all active QR orders (location-scoped)
  useEffect(() => {
    if (!locationId) return;
    async function fetchQrOrders() {
      const { data } = await supabase.from("qr_orders").select("*").eq("location_id", locationId).in("status", ["pending", "preparing", "ready"]).order("created_at", { ascending: true });
      if (data) setQrOrders(data);
    }
    fetchQrOrders();

    const channel = supabase
      .channel("qr-orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "qr_orders" }, () => {
        fetchQrOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [locationId]);

  // Auto-accept: new "pending" orders get moved to "preparing" automatically
  useEffect(() => {
    const pendingOrders = qrOrders.filter((o) => o.status === "pending");
    pendingOrders.forEach(async (qo) => {
      await supabase.from("qr_orders").update({ status: "preparing" } as any).eq("id", qo.id);
    });
  }, [qrOrders]);

  async function advanceQrOrder(qrOrder: any) {
    const nextStatus = qrOrder.status === "preparing" ? "ready" : qrOrder.status === "ready" ? "served" : null;
    if (!nextStatus) return;
    await supabase.from("qr_orders").update({ status: nextStatus } as any).eq("id", qrOrder.id);
    if (nextStatus === "served") {
      setQrOrders((prev) => prev.filter((o) => o.id !== qrOrder.id));
    }
  }


  const [openTickets, setOpenTickets] = useState<Record<string, any>>({});
  const [activeTicketId, setActiveTicketId] = useState("walk-in");

  const activeTicket = openTickets[activeTicketId] || emptyTicket(activeTicketId);

  function setActiveTicket(updaterOrValue: any) {
    setOpenTickets((prev) => {
      const current = prev[activeTicketId] || emptyTicket(activeTicketId);
      const next = typeof updaterOrValue === "function" ? updaterOrValue(current) : updaterOrValue;
      return { ...prev, [activeTicketId]: next };
    });
  }

  function handleSelectTable(tableId: string) {
    setOpenTickets((prev) => {
      if (!prev[tableId]) return { ...prev, [tableId]: emptyTicket(tableId) };
      return prev;
    });
    setActiveTicketId(tableId);
    setActive("pos");
  }

  function handleCloseTable(tableId: string) {
    setOpenTickets((prev) => {
      const next = { ...prev };
      delete next[tableId];
      return next;
    });
    if (activeTicketId === tableId) setActiveTicketId("walk-in");
  }

  function handleSeatReservation(table: any) {
    setReservations((prev) => prev.map((r) =>
      r.table === table.name && r.status === "confirmed" ? { ...r, status: "seated" } : r
    ));
    handleSelectTable(table.id);
  }

  async function handleRedeemGiftCard(giftCardId: string, amount: number) {
    let newBalance = 0;
    let newStatus = "active";
    setGiftCards((prev) => prev.map((gc) => {
      if (gc.id !== giftCardId) return gc;
      newBalance = Math.max(0, gc.balance - amount);
      newStatus = newBalance === 0 ? "redeemed" : "active";
      return { ...gc, balance: newBalance, status: newStatus };
    }));
    addLog?.("giftcard_redeemed", `Cadeaukaart ingewisseld: ${euro(amount)} · nieuw saldo ${euro(newBalance)}`);
    try {
      const { error } = await supabase
        .from("gift_cards")
        .update({ balance: newBalance, status: newStatus } as any)
        .eq("id", giftCardId);
      if (error) {
        console.error("Failed to persist gift card redemption:", error);
        addLog?.("giftcard_redeem_persist_failed", `DB-update mislukt: ${error.message}`);
      }
    } catch (err: any) {
      console.error("Gift card redemption error:", err);
    }
  }

  async function handleOrderComplete(order: any) {
    const stamped = { ...order, employeeId: loggedInEmployee?.id || null, employeeName: loggedInEmployee?.name || null };
    setOrders((prev) => [stamped, ...prev]);

    // Persist to database
    try {
      const { error } = await supabase.from("pos_transactions").insert({
        order_id: stamped.id,
        created_at: stamped.date?.toISOString() || new Date().toISOString(),
        items: stamped.items || [],
        subtotal: stamped.subtotal || 0,
        discount: stamped.discount || 0,
        discount_name: stamped.discountName || null,
        total: stamped.total || 0,
        tip: stamped.tip || 0,
        payment_method: stamped.method || 'card',
        customer_id: stamped.customerId || null,
        customer_name: stamped.customerName || null,
        table_id: stamped.table || null,
        employee_id: stamped.employeeId || null,
        employee_name: stamped.employeeName || null,
        loyalty_provider: stamped.loyaltyProvider || null,
        loyalty_id: stamped.loyaltyId || null,
        gift_card_deduction: stamped.giftCardDeduction || 0,
        gift_card_id: stamped.giftCardId || null,
        status: stamped.status || 'completed',
        source: 'pos',
        location_id: locationId,
      } as any);
      if (error) {
        console.error("Failed to save transaction:", error);
        addLog?.("transaction_persist_failed", `DB-insert mislukt: ${error.message}`);
        setToast(`⚠ Transactie niet opgeslagen: ${error.message}`);
      }
    } catch (err: any) {
      console.error("Failed to save transaction:", err);
      setToast(`⚠ Transactie niet opgeslagen: ${err?.message || err}`);
    }

    // Upsert customer record if we captured contact details on the order
    if (stamped.customerName && (stamped.customerEmail || stamped.customerPhone)) {
      const { upsertCustomer } = await import("@/lib/customers");
      const res = await upsertCustomer({
        locationId,
        fullName: stamped.customerName,
        email: stamped.customerEmail,
        phone: stamped.customerPhone,
        source: "pos",
        spentDelta: Number(stamped.total || 0),
        incrementVisit: true,
      });
      if (res.error) {
        addLog?.("customer_upsert_failed", `Klant niet opgeslagen: ${res.error}`);
      } else {
        addLog?.("customer_upserted", `Klant ${stamped.customerName} opgeslagen/bijgewerkt`);
      }
    }

    // Auto-deduct stock based on product recipes
    deductStockForOrder(stamped.items, stamped.employeeName, stamped.id, locationId);
    if (order.customerId) {
      setCustomers((prev) => prev.map((c) =>
        c.id === order.customerId
          ? { ...c, visits: c.visits + 1, totalSpent: c.totalSpent + order.total, lastVisit: formatDate(order.date), points: c.points + Math.floor(order.total) }
          : c
      ));
    }

    // PassKit: earn points after order completion
    if (order.loyaltyProvider === "passkit" && passkitConfig.programId && order.loyaltyId) {
      const pointsToEarn = Math.floor(order.total * passkitConfig.pointsPerEuro);
      if (pointsToEarn > 0) {
        try {
          await passkitEarnPoints({
            externalId: order.loyaltyId,
            programId: passkitConfig.programId,
            points: pointsToEarn,
          });
          setToast(`+${pointsToEarn} PassKit points earned!`);
        } catch (err) {
          console.error("PassKit earn points error:", err);
        }
      }
    }

    // ─── Route items to prep stations ───
    const stationGroups: Record<string, { name: string; qty: number; modifiers: any[]; notes?: string }[]> = {};
    stamped.items.forEach((item: any) => {
      const product = products.find((p: any) => p.id === item.productId);
      const station = product?.prep_station;
      if (!station) return;
      if (!stationGroups[station]) stationGroups[station] = [];
      stationGroups[station].push({ name: item.name, qty: item.qty, modifiers: item.modifiers || [], notes: item.notes });
    });
    const orderType = stamped.table ? `Tafel ${stamped.table}` : "Afhaal";
    Object.entries(stationGroups).forEach(([station, items]) => {
      const ticket: PrepTicket = {
        id: `prep-${generateId()}`,
        orderId: stamped.id,
        station: station as PrepTicket["station"],
        items,
        status: "ordered",
        createdAt: new Date(),
        orderType,
        paymentStatus: "Betaald",
      };
      setPrepTickets((prev) => [ticket, ...prev]);
    });

    if (order.table) {
      setOpenTickets((prev) => { const next = { ...prev }; delete next[order.table]; return next; });
    } else {
      setOpenTickets((prev) => { const next = { ...prev }; delete next["walk-in"]; return next; });
    }
    setToast(`Order #${order.id} completed — ${euro(order.total)}`);
    addLog("order_completed", `Bestelling #${order.id} afgerond — ${euro(order.total)} (${order.method})`);

    // Offer gift card after sale (post-sale only, like PassKit enrolment)
    setPendingGiftCardOrder(stamped);
  }

  function updatePrepStatus(ticketId: string, status: PrepTicket["status"]) {
    setPrepTickets((prev) => prev.map((t) =>
      t.id === ticketId
        ? { ...t, status, startedAt: status === "preparing" ? new Date() : t.startedAt, readyAt: status === "ready" ? new Date() : t.readyAt, completedAt: status === "completed" ? new Date() : t.completedAt }
        : t
    ));
    addLog("prep_status_changed", `Prep ticket ${ticketId} → ${status}`);
  }

  function handleLogout() {
    addLog("logout", `${loggedInEmployee?.name} uitgelogd`);
    authLogout();
    setActive("pos");
    setSectionPicked(false);
  }

  // If not authenticated, ProtectedRoute handles redirect to /login
  if (!loggedInEmployee) {
    return null;
  }

  // Platform admin: show tenant picker if no tenant selected
  if (isPlatformAdmin && !selectedTenantId) {
    return <PlatformTenantPicker tenants={allTenants} onSelect={async (tenant) => {
      // Trigger impersonation via edge function
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-impersonate`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ action: "start", tenant_id: tenant.id }),
          }
        );
        const data = await res.json();
        if (!res.ok) return;
        sessionStorage.setItem("saakouk_impersonation", JSON.stringify({
          tenantId: data.impersonation.tenant.id,
          tenantName: data.impersonation.tenant.name,
          tenantSlug: data.impersonation.tenant.slug,
          employee: data.impersonation.employee,
          logId: data.impersonation.log_id,
        }));
        selectTenant(tenant.id);
        window.location.reload();
      } catch (err) {
        console.error("Impersonation failed", err);
      }
    }} onAdmin={() => { window.location.href = "/admin"; }} />;
  }

  // Show section picker after login
  if (!sectionPicked) {
    return <SectionPickerScreen employee={loggedInEmployee} onSelect={(key) => { setActive(key); setSectionPicked(true); addLog("view_changed", `Sectie gekozen: ${key}`); }} onLogout={handleLogout} />;
  }

  const todayOrders = orders.filter((o: any) => isToday(o.date));
  const todayRevenue = todayOrders.reduce((s: number, o: any) => s + o.total, 0);

  const titles: Record<string, string> = {
    dashboard: "Dashboard",
    multilocatie: "Multi-Locatie Overzicht",
    pos: "Point of Sale",
    prepstation: "Prepstation",
    cashclose: "Kassa Afsluiting",
    activity: "Order History",
    reservations: "Reservations",
    products: "Products",
    inventory: "Voorraad Management",
    intake: "Voorraad Management",
    stockcount: "Maandelijkse Telling",
    costing: "Costing & Marges",
    aiforecast: "AI Forecast & Insights",
    qr: "QR Ordering",
    customers: "Customers",
    giftcards: "Gift Cards",
    sales: "Sales Reports",
    accounting: "Accounting",
    cashaudit: "Cash Audit",
    employees: "Medewerkers",
    logs: "Activiteiten Log",
    settings: "Settings",
  };

  return (
    <div className="h-dvh relative overflow-hidden flex select-none text-slate-900 touch-manipulation" style={{ paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Ambient pastel background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#fbfcff_0%,#f3f6ff_48%,#eef2ff_100%)]" />
        <div className="absolute left-[-10%] top-[-10%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_center,rgba(214,197,255,0.35),transparent_70%)] blur-3xl" />
        <div className="absolute right-[-8%] top-[8%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_center,rgba(255,188,233,0.25),transparent_70%)] blur-3xl" />
        <div className="absolute bottom-[-8%] left-[18%] h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_center,rgba(195,221,255,0.35),transparent_70%)] blur-3xl" />
      </div>

      <Sidebar active={active} setActive={(view) => { if (!canAccessView(view)) { setToast("Geen toegang tot deze sectie"); return; } setActive(view); addLog("view_changed", `Navigeerde naar: ${view}`); }} role={loggedInEmployee.role} onLogout={handleLogout} employeeName={loggedInEmployee.name} locations={locations} activeLocation={activeLocation} onLocationChange={setActiveLocationId} isPlatformAdmin={isPlatformAdmin} allTenants={allTenants} selectedTenantId={selectedTenantId} onSelectTenant={selectTenant} tenantUnlocked={tenantUnlocked} onUnlockTenant={unlockTenant} onClearTenant={clearTenantSelection} canAccessView={canAccessView} />
      <main className="flex-1 flex flex-col overflow-hidden min-w-0 relative z-10">
        {/* Glass top bar */}
        <div className="shrink-0 border-b border-white/50 bg-white/50 backdrop-blur-2xl px-5 py-2.5 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold tracking-[-0.02em] text-slate-900 leading-tight">{titles[active] || "Saakouk"}</h1>
            <div className="text-[11px] text-slate-500">{formatDate(new Date())} · {formatTime(new Date())}{activeLocation ? ` · ${activeLocation.name}` : ""}</div>
          </div>
          <div className="flex items-center gap-2">
            {/* QR Orders indicator */}
            {qrOrders.length > 0 && (
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setActive("dashboard")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-100/80 text-orange-700 text-xs font-semibold border border-orange-200/50 shadow-[0_8px_24px_rgba(251,191,36,0.12)] animate-pulse"
              >
                <Bell className="h-4 w-4" />
                {qrOrders.length} actieve bestelling{qrOrders.length !== 1 ? "en" : ""}
              </motion.button>
            )}
            {/* Prep tickets indicator */}
            {prepTickets.filter((t) => t.status === "ordered" || t.status === "preparing").length > 0 && (
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setActive("prepstation")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100/80 text-amber-700 text-xs font-semibold border border-amber-200/50 shadow-[0_8px_24px_rgba(251,191,36,0.10)]"
              >
                <ChefHat className="h-4 w-4" />
                {prepTickets.filter((t) => t.status === "ordered" || t.status === "preparing").length} prep
              </motion.button>
            )}

            {/* Low stock alert */}
            {lowStockItems.length > 0 && (loggedInEmployee.role === "owner" || loggedInEmployee.role === "manager") && (
              <div className="relative">
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setShowLowStockPanel(!showLowStockPanel)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100/80 text-red-700 text-xs font-semibold border border-red-200/50 shadow-[0_8px_24px_rgba(239,68,68,0.10)] animate-pulse"
                >
                  <Package className="h-4 w-4" />
                  {lowStockItems.length} lage voorraad
                </motion.button>
                {showLowStockPanel && (
                  <div className="absolute right-0 top-10 z-50 w-80 rounded-[22px] border border-white/70 bg-white/80 backdrop-blur-2xl shadow-[0_30px_80px_rgba(162,178,226,0.22)] p-4 space-y-2 max-h-80 overflow-auto">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-slate-900">⚠️ Lage voorraad</span>
                      <button onClick={() => setShowLowStockPanel(false)} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
                    </div>
                    {lowStockItems.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between bg-red-50/80 rounded-xl px-3 py-2 text-xs border border-red-100/50">
                        <div>
                          <div className="font-semibold text-slate-900">{item.item_name}</div>
                          <div className="text-slate-500">{item.category}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-red-600">{item.current_stock} {item.unit_type}</div>
                          <div className="text-slate-500">min: {item.minimum_stock}</div>
                        </div>
                      </div>
                    ))}
                    <button onClick={() => { setShowLowStockPanel(false); setActive("inventory"); }} className="w-full text-center text-xs font-semibold text-violet-600 hover:underline pt-1">
                      Ga naar Voorraad →
                    </button>
                  </div>
                )}
              </div>
            )}

            {loggedInEmployee.role === "owner" && notifications.filter((n) => !n.read).length > 0 && (
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => { setNotifications((prev) => prev.map((n) => ({ ...n, read: true }))); setActive("logs"); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-100/80 text-blue-700 text-xs font-semibold border border-blue-200/50 shadow-[0_8px_24px_rgba(59,130,246,0.10)]"
              >
                <Bell className="h-4 w-4" />
                {notifications.filter((n) => !n.read).length} melding{notifications.filter((n) => !n.read).length !== 1 ? "en" : ""}
              </motion.button>
            )}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/70 bg-white/60 backdrop-blur-xl text-[11px] font-medium text-slate-600 shadow-[0_8px_24px_rgba(162,178,226,0.10)]">
              {todayOrders.length} orders · {euro(todayRevenue)}
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="mx-auto">
            {!canAccessView(active) ? (
              <div className="max-w-md mx-auto mt-24 rounded-3xl border border-white/70 bg-white/70 backdrop-blur-2xl p-8 text-center shadow-[0_30px_80px_rgba(162,178,226,0.18)]">
                <Lock className="h-10 w-10 mx-auto text-slate-400 mb-3" />
                <h2 className="text-lg font-semibold text-slate-900 mb-1">Geen toegang</h2>
                <p className="text-sm text-slate-500 mb-4">Je rol ({loggedInEmployee.role}) heeft geen toestemming voor deze sectie. Vraag de eigenaar om je permissies aan te passen.</p>
                <button onClick={() => setActive("pos")} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-700">Terug naar POS</button>
              </div>
            ) : null}
            {canAccessView(active) && active === "dashboard" && (
              <Tabs defaultValue="overview" className="space-y-3">
                <TabsList className="rounded-xl">
                  <TabsTrigger value="overview">Overzicht</TabsTrigger>
                  <TabsTrigger value="forecast">AI Forecast</TabsTrigger>
                </TabsList>
                <TabsContent value="overview">
                  <DashboardView orders={orders} tables={tables} openTickets={openTickets} qrOrders={qrOrders} onAdvanceOrder={advanceQrOrder} products={enrichedProducts} reservations={reservations} customers={customers} />
                </TabsContent>
                <TabsContent value="forecast">
                  <AIForecastCenter onToast={setToast} />
                </TabsContent>
              </Tabs>
            )}
            {active === "multilocatie" && <MultiLocationDashboard />}
            {active === "pos" && (
              <Tabs defaultValue="counter" className="space-y-3">
                <TabsList className="rounded-full bg-white/60 backdrop-blur-xl border border-white/70 shadow-[0_8px_30px_rgba(162,178,226,0.10)]">
                  <TabsTrigger value="counter" className="rounded-full data-[state=active]:bg-[linear-gradient(135deg,rgba(196,181,253,0.5),rgba(255,192,230,0.4))] data-[state=active]:shadow-sm">Counter</TabsTrigger>
                  <TabsTrigger value="table" className="rounded-full data-[state=active]:bg-[linear-gradient(135deg,rgba(196,181,253,0.5),rgba(255,192,230,0.4))] data-[state=active]:shadow-sm">Tables</TabsTrigger>
                </TabsList>
                <TabsContent value="counter">
                  <CounterView
                    products={enrichedProducts} tables={tables} features={features} customers={customers}
                    giftCards={giftCards} onRedeemGiftCard={handleRedeemGiftCard}
                    ticket={activeTicket} setTicket={setActiveTicket} onOrderComplete={handleOrderComplete}
                    passkitConfig={passkitConfig} onToast={setToast} addLog={addLog} discounts={discounts}
                  />
                </TabsContent>
                <TabsContent value="table">
                  <FloorPlanEditor tables={tables} setTables={setTables} openTickets={openTickets} reservations={reservations}
                    onSelectTable={handleSelectTable} onCloseTable={handleCloseTable} onSeatReservation={handleSeatReservation}
                    channels={channels} addLog={addLog}
                    zones={live.zones}
                    onCreateZone={live.createZone} onDeleteZone={live.deleteZone}
                    onCreateTable={live.createTable} onUpdateTable={live.updateTable} onDeleteTable={live.deleteTable}
                  />
                </TabsContent>
              </Tabs>
            )}
            {active === "prepstation" && <PrepStationView prepTickets={prepTickets} onUpdateStatus={updatePrepStatus} />}
            {active === "reservations" && <ReservationsView reservations={reservations} setReservations={setReservations} tables={tables} addLog={addLog} onCreateReservation={live.createReservation} onUpdateReservation={live.updateReservation} onDeleteReservation={live.deleteReservation} />}
            {active === "products" && <ProductsView products={enrichedProducts} setProducts={setProducts} currentRole={loggedInEmployee.role} currentEmployee={loggedInEmployee} addLog={addLog} setNotifications={setNotifications} modifierGroups={modifierGroups} modifierLinks={modifierLinks} onRefetchModifiers={refetchModifiers} onToast={setToast} locationId={locationId} upsellRules={upsellEngine.rules} onRefetchUpsell={upsellEngine.refetch} onCreateProduct={live.createProduct} onUpdateProduct={live.updateProduct} onDeleteProduct={live.deleteProduct} />}
            {/* Backwards-compat: modifiers/upsell now live inside Products */}
            {(active === "modifiers" || active === "upsell") && <ProductsView products={enrichedProducts} setProducts={setProducts} currentRole={loggedInEmployee.role} currentEmployee={loggedInEmployee} addLog={addLog} setNotifications={setNotifications} modifierGroups={modifierGroups} modifierLinks={modifierLinks} onRefetchModifiers={refetchModifiers} onToast={setToast} locationId={locationId} upsellRules={upsellEngine.rules} onRefetchUpsell={upsellEngine.refetch} onCreateProduct={live.createProduct} onUpdateProduct={live.updateProduct} onDeleteProduct={live.deleteProduct} />}
            {(active === "inventory" || active === "intake" || active === "waste" || active === "stockcount") && (
              <Tabs defaultValue={active === "intake" ? "intake" : active === "waste" ? "waste" : active === "stockcount" ? "telling" : "voorraad"} className="space-y-3">
                <TabsList className="rounded-xl">
                  <TabsTrigger value="voorraad">Voorraad</TabsTrigger>
                  <TabsTrigger value="dynamic">Dynamic Stock</TabsTrigger>
                  <TabsTrigger value="intake">Intake</TabsTrigger>
                  <TabsTrigger value="waste">Verspilling</TabsTrigger>
                  <TabsTrigger value="telling">Telling</TabsTrigger>
                </TabsList>
                <TabsContent value="voorraad">
                  <InventoryView onToast={setToast} addLog={addLog} currentRole={loggedInEmployee.role} locationId={locationId} />
                </TabsContent>
                <TabsContent value="dynamic">
                  <DynamicStockView onToast={setToast} addLog={addLog} currentRole={loggedInEmployee.role} employeeName={loggedInEmployee.name} locationId={locationId} />
                </TabsContent>
                <TabsContent value="intake">
                  <StockIntakeView onToast={setToast} addLog={addLog} employeeName={loggedInEmployee.name} locationId={locationId} />
                </TabsContent>
                <TabsContent value="waste">
                  <WasteLoggingView onToast={setToast} addLog={addLog} currentRole={loggedInEmployee.role} employeeName={loggedInEmployee.name} locationId={locationId} />
                </TabsContent>
                <TabsContent value="telling">
                  <MonthlyCountView onToast={setToast} addLog={addLog} employeeName={loggedInEmployee.name} locationId={locationId} />
                </TabsContent>
              </Tabs>
            )}
            {active === "costing" && <CostingView products={enrichedProducts} orders={orders} onToast={setToast} locationId={locationId} />}
            {active === "qr" && <QrView features={features} tables={tables} />}
            {active === "customers" && <CustomersView customers={customers} setCustomers={setCustomers} addLog={addLog} currentRole={loggedInEmployee.role} locationId={locationId} onToast={setToast} />}
            {active === "giftcards" && <GiftCardsView giftCards={giftCards} addLog={addLog} />}
            {/* Verkoop = Sales transactions + Accounting (backwards-compat for "sales"/"accounting") */}
            {(active === "verkoop" || active === "sales" || active === "accounting") && (
              <Tabs defaultValue={active === "accounting" ? "boekhouding" : "transacties"} className="space-y-3">
                <TabsList className="rounded-xl">
                  <TabsTrigger value="transacties">Transacties</TabsTrigger>
                  <TabsTrigger value="boekhouding">Boekhouding</TabsTrigger>
                </TabsList>
                <TabsContent value="transacties">
                  <SalesView orders={orders} products={enrichedProducts} employees={employees} />
                </TabsContent>
                <TabsContent value="boekhouding">
                  <AccountingView orders={orders} />
                </TabsContent>
              </Tabs>
            )}
            {/* Kassa = Cash close + Audit (backwards-compat for "cashaudit") */}
            {(active === "cashclose" || active === "cashaudit") && (
              <Tabs defaultValue={active === "cashaudit" ? "audit" : "afsluiting"} className="space-y-3">
                <TabsList className="rounded-xl">
                  <TabsTrigger value="afsluiting">Afsluiting</TabsTrigger>
                  <TabsTrigger value="audit">Audit</TabsTrigger>
                </TabsList>
                <TabsContent value="afsluiting">
                  <CashCloseView onOpen={() => setShowCashClosing(true)} />
                </TabsContent>
                <TabsContent value="audit">
                  <CashAuditView />
                </TabsContent>
              </Tabs>
            )}
            {/* Logs = System actions + Order history (backwards-compat for "activity") */}
            {(active === "logs" || active === "activity") && (
              <Tabs defaultValue={active === "activity" ? "orders" : "acties"} className="space-y-3">
                <TabsList className="rounded-xl">
                  <TabsTrigger value="acties">Acties</TabsTrigger>
                  <TabsTrigger value="orders">Orders</TabsTrigger>
                </TabsList>
                <TabsContent value="acties">
                  <LogsView logs={activityLogs} employees={employees} />
                </TabsContent>
                <TabsContent value="orders">
                  <ActivityView orders={orders} employees={employees} />
                </TabsContent>
              </Tabs>
            )}
            {/* Dashboard = Overview + AI Forecast (backwards-compat for "aiforecast") */}
            {active === "aiforecast" && <AIForecastCenter onToast={setToast} />}
            {active === "employees" && <EmployeesView employees={employees} setEmployees={setEmployees} currentRole={loggedInEmployee.role} locationId={locationId} onToast={(msg) => setToast(msg)} />}
            {active === "settings" && <SettingsView features={features} setFeatures={setFeatures} passkitConfig={passkitConfig} setPasskitConfig={setPasskitConfig} vatRates={vatRates} setVatRates={setVatRates} />}
          </div>
        </div>
      </main>
      <Toast message={toast} onClose={() => setToast("")} />
      <CashClosingModal
        open={showCashClosing}
        onClose={() => setShowCashClosing(false)}
        employees={employees}
        loggedInEmployee={loggedInEmployee}
        orders={orders}
        onComplete={() => setToast("Kassa succesvol afgesloten!")}
        addLog={addLog}
      />
      <PostSaleGiftCardModal
        open={!!pendingGiftCardOrder}
        onClose={() => setPendingGiftCardOrder(null)}
        order={pendingGiftCardOrder}
        addLog={addLog}
        passkitConfig={passkitConfig}
        onIssue={async (card: any) => {
          // Persist to database first — only update UI on success
          const { data, error } = await supabase
            .from("gift_cards")
            .insert({
              code: card.code,
              customer_name: card.customerName,
              customer_email: card.customerEmail,
              customer_phone: card.customerPhone,
              initial_value: card.initialValue,
              balance: card.balance,
              status: card.status,
              source_order_id: card.sourceOrderId,
              issued_by_employee_id: loggedInEmployee?.id || null,
              issued_by_employee_name: loggedInEmployee?.name || null,
              passkit_member_id: card.passkitMemberId || null,
              passkit_enrolled: !!card.passkitEnrolled,
              location_id: locationId,
            } as any)
            .select()
            .single();
          if (error) {
            addLog?.("giftcard_persist_failed", `DB-insert mislukt: ${error.message}`);
            setToast(`⚠ Cadeaukaart niet opgeslagen: ${error.message}`);
            throw error;
          }
          // Use DB-returned id so future redemptions match
          setGiftCards((prev) => [...prev, { ...card, id: (data as any)?.id || card.id }]);

          // Persist customer to unified customers table
          const { upsertCustomer } = await import("@/lib/customers");
          const cust = await upsertCustomer({
            locationId,
            fullName: card.customerName,
            email: card.customerEmail,
            phone: card.customerPhone,
            source: "gift_card",
            passkitMemberId: card.passkitMemberId || null,
            spentDelta: Number(card.initialValue || 0),
            incrementVisit: true,
          });
          if (cust.error) {
            addLog?.("customer_upsert_failed", `Klant niet opgeslagen: ${cust.error}`);
          } else {
            addLog?.("customer_upserted", `Klant ${card.customerName} opgeslagen/bijgewerkt`);
          }

          setToast(`Cadeaukaart ${card.code} uitgegeven (${euro(card.balance)})`);
        }}
      />
    </div>
  );
}
