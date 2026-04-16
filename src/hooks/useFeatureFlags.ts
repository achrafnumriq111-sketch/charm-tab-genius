import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FeatureFlags {
  pos: boolean;
  qr_ordering: boolean;
  upsell: boolean;
  loyalty: boolean;
  ai_forecast: boolean;
  inventory: boolean;
  prep_station: boolean;
  reservations: boolean;
  cash_closing: boolean;
  analytics: boolean;
  [key: string]: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  pos: true,
  qr_ordering: true,
  upsell: true,
  loyalty: true,
  ai_forecast: true,
  inventory: true,
  prep_station: true,
  reservations: true,
  cash_closing: true,
  analytics: true,
};

export function useFeatureFlags(tenantId: string | null): { flags: FeatureFlags; loading: boolean } {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) {
      setFlags(DEFAULT_FLAGS);
      setLoading(false);
      return;
    }

    const fetchFlags = async () => {
      const { data } = await supabase
        .from("tenant_feature_flags")
        .select("feature_key, is_enabled")
        .eq("tenant_id", tenantId);

      if (data && data.length > 0) {
        const merged = { ...DEFAULT_FLAGS };
        data.forEach((f: any) => {
          if (f.feature_key in merged) {
            merged[f.feature_key] = f.is_enabled;
          }
        });
        setFlags(merged);
      }
      setLoading(false);
    };

    fetchFlags();
  }, [tenantId]);

  return { flags, loading };
}
