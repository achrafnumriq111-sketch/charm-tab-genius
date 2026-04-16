import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  plan: string;
}

interface TenantContextType {
  tenant: Tenant | null;
  slug: string | null;
  loading: boolean;
  error: string | null;
  isPlatformLevel: boolean; // true when on main domain (no subdomain)
}

const TenantContext = createContext<TenantContextType | null>(null);

/**
 * Extract tenant slug from hostname.
 * Patterns:
 *   cafe1.saakouk.app → "cafe1"
 *   id-preview--xxx.lovable.app → null (platform level)
 *   localhost → null (platform level, dev)
 */
function extractSlug(): string | null {
  const hostname = window.location.hostname;

  // Dev: check for query param ?tenant=slug
  const params = new URLSearchParams(window.location.search);
  const tenantParam = params.get("tenant");
  if (tenantParam) return tenantParam;

  // Production: x.saakouk.app
  if (hostname.endsWith(".saakouk.app")) {
    const parts = hostname.replace(".saakouk.app", "").split(".");
    const sub = parts[0];
    // Skip www or bare domain
    if (sub && sub !== "www" && sub !== "saakouk") return sub;
  }

  // Lovable preview or localhost → platform level
  return null;
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const slug = extractSlug();
  const isPlatformLevel = !slug;

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }

    const fetchTenant = async () => {
      const { data, error: fetchError } = await supabase
        .from("tenants")
        .select("id, name, slug, is_active, plan")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (fetchError) {
        setError("Kon bedrijf niet laden");
      } else if (!data) {
        setError(`Bedrijf "${slug}" niet gevonden`);
      } else {
        setTenant(data);
      }
      setLoading(false);
    };

    fetchTenant();
  }, [slug]);

  return (
    <TenantContext.Provider value={{ tenant, slug, loading, error, isPlatformLevel }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}
