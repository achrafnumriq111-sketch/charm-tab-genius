import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UpsellRule {
  id: string;
  trigger_product_id: string | null;
  trigger_category: string | null;
  suggested_product_id: string;
  suggestion_type: string;
  prompt_text_nl: string;
  priority: number;
  extra_price_override: number | null;
  active_from: string | null;
  active_until: string | null;
  location_id: string | null;
  is_active: boolean;
  conversion_count: number;
  impression_count: number;
}

export interface UpsellSuggestion {
  rule: UpsellRule;
  suggestedProduct: any;
  promptText: string;
  price: number;
}

function isInTimeWindow(from: string | null, until: string | null): boolean {
  if (!from && !until) return true;
  const now = new Date();
  const hh = now.getHours();
  const mm = now.getMinutes();
  const currentMinutes = hh * 60 + mm;

  if (from) {
    const [fh, fm] = from.split(":").map(Number);
    if (currentMinutes < fh * 60 + fm) return false;
  }
  if (until) {
    const [uh, um] = until.split(":").map(Number);
    if (currentMinutes > uh * 60 + um) return false;
  }
  return true;
}

export function useUpsellEngine(products: any[]) {
  const [rules, setRules] = useState<UpsellRule[]>([]);
  const [loading, setLoading] = useState(true);
  const dismissedThisSession = useRef<Set<string>>(new Set());
  const shownThisSession = useRef<Set<string>>(new Set());
  const lastPromptTime = useRef<number>(0);

  const fetchRules = useCallback(async () => {
    const { data } = await supabase
      .from("upsell_rules")
      .select("*")
      .eq("is_active", true)
      .order("priority");
    setRules((data || []) as UpsellRule[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  /** Given a just-added product, find the best upsell suggestion */
  const getSuggestion = useCallback(
    (addedProduct: any, currentCart: any[]): UpsellSuggestion | null => {
      // Rate-limit: no prompt within 5 seconds of the last
      if (Date.now() - lastPromptTime.current < 5000) return null;

      const cartProductIds = new Set(currentCart.map((i) => i.productId));

      for (const rule of rules) {
        // Skip dismissed rules this session
        if (dismissedThisSession.current.has(rule.id)) continue;

        // Skip already-shown rules (don't repeat)
        if (shownThisSession.current.has(rule.id)) continue;

        // Check trigger match
        const matchByProduct = rule.trigger_product_id && rule.trigger_product_id === addedProduct.id;
        const matchByCategory = rule.trigger_category && addedProduct.section === rule.trigger_category;
        if (!matchByProduct && !matchByCategory) continue;

        // Check time window
        if (!isInTimeWindow(rule.active_from, rule.active_until)) continue;

        // Don't suggest something already in cart
        if (cartProductIds.has(rule.suggested_product_id)) continue;

        // Find the suggested product
        const suggestedProduct = products.find((p) => p.id === rule.suggested_product_id);
        if (!suggestedProduct) continue;

        const price = rule.extra_price_override ?? suggestedProduct.price;
        const promptText = rule.prompt_text_nl || `${suggestedProduct.name} erbij voor ${new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(price)}?`;

        lastPromptTime.current = Date.now();

        return { rule, suggestedProduct, promptText, price };
      }

      return null;
    },
    [rules, products]
  );

  /** Track impression (shown to user) */
  const trackImpression = useCallback(async (ruleId: string) => {
    shownThisSession.current.add(ruleId);
    await supabase.rpc("increment_upsell_impression" as any, { rule_id: ruleId }).catch(() => {
      // Fallback: direct update
      supabase.from("upsell_rules").update({
        impression_count: (rules.find((r) => r.id === ruleId)?.impression_count ?? 0) + 1,
      } as any).eq("id", ruleId);
    });
  }, [rules]);

  /** Track conversion (accepted) */
  const trackConversion = useCallback(async (ruleId: string) => {
    await supabase.rpc("increment_upsell_conversion" as any, { rule_id: ruleId }).catch(() => {
      supabase.from("upsell_rules").update({
        conversion_count: (rules.find((r) => r.id === ruleId)?.conversion_count ?? 0) + 1,
      } as any).eq("id", ruleId);
    });
  }, [rules]);

  /** Dismiss rule for this session */
  const dismiss = useCallback((ruleId: string) => {
    dismissedThisSession.current.add(ruleId);
  }, []);

  /** Reset session tracking (e.g. on new ticket) */
  const resetSession = useCallback(() => {
    dismissedThisSession.current.clear();
    shownThisSession.current.clear();
    lastPromptTime.current = 0;
  }, []);

  return {
    rules,
    loading,
    getSuggestion,
    trackImpression,
    trackConversion,
    dismiss,
    resetSession,
    refetch: fetchRules,
  };
}
