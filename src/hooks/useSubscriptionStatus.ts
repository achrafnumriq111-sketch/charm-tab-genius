import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SubStatus = "trialing" | "active" | "past_due" | "suspended" | "canceled";

export interface SubscriptionRow {
  id: string;
  location_id: string;
  tenant_id: string | null;
  plan_type: string;
  status: SubStatus;
  price_cents: number;
  currency: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  environment: string;
}

export function useSubscriptionStatus(locationId: string | null | undefined) {
  const [sub, setSub] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!locationId) {
      setSub(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("location_id", locationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setSub((data as unknown as SubscriptionRow) ?? null);
    setLoading(false);
  }, [locationId]);

  useEffect(() => { refetch(); }, [refetch]);

  useEffect(() => {
    if (!locationId) return;
    const ch = supabase
      .channel(`subs-${locationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions", filter: `location_id=eq.${locationId}` }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [locationId, refetch]);

  const now = Date.now();
  const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end).getTime() : null;
  const trialEnd = sub?.trial_ends_at ? new Date(sub.trial_ends_at).getTime() : null;

  const isActive = !!sub && (
    ((sub.status === "active" || sub.status === "trialing") && (!periodEnd || periodEnd > now)) ||
    (sub.status === "past_due" && (!periodEnd || periodEnd > now)) ||
    (sub.status === "canceled" && !!periodEnd && periodEnd > now)
  );
  const isPastDue = sub?.status === "past_due";
  const isSuspended = sub?.status === "suspended" || (sub?.status === "canceled" && (!periodEnd || periodEnd <= now));
  const isTrialing = sub?.status === "trialing";
  const trialDaysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24))) : null;

  return { sub, loading, refetch, isActive, isPastDue, isSuspended, isTrialing, trialDaysLeft };
}
