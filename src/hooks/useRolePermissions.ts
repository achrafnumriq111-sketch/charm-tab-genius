import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const PERMISSION_KEYS = [
  "pos", "orders", "inventory", "menu", "modifiers", "employees",
  "analytics", "cash_closing", "floor_plan", "qr_orders",
  "forecast", "upsell", "logs", "settings",
] as const;

export type PermissionKey = typeof PERMISSION_KEYS[number];

/** Maps sidebar view-key → required permission. null = always allowed. */
export const VIEW_PERMISSION_MAP: Record<string, PermissionKey | null> = {
  dashboard: "analytics",
  multilocatie: "analytics",
  pos: "pos",
  prepstation: "pos",
  cashclose: "cash_closing",
  cashaudit: "cash_closing",
  reservations: "floor_plan",
  products: "menu",
  modifiers: "modifiers",
  upsell: "upsell",
  inventory: "inventory",
  intake: "inventory",
  waste: "inventory",
  stockcount: "inventory",
  costing: "analytics",
  qr: "qr_orders",
  customers: "orders",
  giftcards: "orders",
  verkoop: "analytics",
  sales: "analytics",
  accounting: "analytics",
  logs: "logs",
  activity: "logs",
  aiforecast: "forecast",
  employees: "employees",
  settings: "settings",
};

const DEFAULT_PERMS: Record<string, Record<PermissionKey, boolean>> = {
  owner: PERMISSION_KEYS.reduce((acc, k) => ({ ...acc, [k]: true }), {} as any),
  manager: PERMISSION_KEYS.reduce((acc, k) => ({ ...acc, [k]: true }), {} as any),
  sales: PERMISSION_KEYS.reduce(
    (acc, k) => ({ ...acc, [k]: (["pos", "orders", "qr_orders"] as string[]).includes(k) }),
    {} as any
  ),
};

export function useRolePermissions(role: string | undefined, locationId: string | undefined | null) {
  const [perms, setPerms] = useState<Record<PermissionKey, boolean>>(
    () => DEFAULT_PERMS[role || "sales"] || DEFAULT_PERMS.sales
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!role) return;
    // Start with defaults for this role
    setPerms(DEFAULT_PERMS[role] || DEFAULT_PERMS.sales);
    if (!locationId || role === "owner") {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("role_permissions")
        .select("permission_key, is_enabled")
        .eq("location_id", locationId)
        .eq("role", role as any);
      if (cancelled) return;
      if (data && data.length) {
        const next = { ...(DEFAULT_PERMS[role] || DEFAULT_PERMS.sales) };
        data.forEach((row: any) => {
          if ((PERMISSION_KEYS as readonly string[]).includes(row.permission_key)) {
            next[row.permission_key as PermissionKey] = !!row.is_enabled;
          }
        });
        setPerms(next);
      }
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [role, locationId]);

  function canAccessView(viewKey: string): boolean {
    const required = VIEW_PERMISSION_MAP[viewKey];
    if (required === undefined) return true; // unmapped view = allowed
    if (required === null) return true;
    if (role === "owner") return true;
    return !!perms[required];
  }

  return { perms, canAccessView, loaded };
}
