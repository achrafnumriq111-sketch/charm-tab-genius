import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";

export interface Location {
  id: string;
  name: string;
  city: string;
  address: string;
  timezone: string;
  currency: string;
  is_active: boolean;
  tenant_id: string | null;
}

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  plan: string;
}

interface LocationContextType {
  locations: Location[];
  activeLocation: Location | null;
  setActiveLocationId: (id: string) => void;
  loading: boolean;
  refetch: () => Promise<void>;
  tenantId: string | null;
  // Platform admin tenant switching
  isPlatformAdmin: boolean;
  allTenants: TenantInfo[];
  selectedTenantId: string | null;
  selectTenant: (tenantId: string) => void;
  clearTenantSelection: () => void;
  tenantUnlocked: boolean;
  unlockTenant: (pin: string) => Promise<boolean>;
}

const LocationContext = createContext<LocationContextType | null>(null);

const STORAGE_KEY = "saakouk_active_location_id";
const TENANT_KEY = "saakouk_admin_selected_tenant";

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const { tenant, isPlatformLevel } = useTenant();
  const { employee, isAuthenticated } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [activeLocationId, setActiveLocationIdState] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Platform admin state
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [allTenants, setAllTenants] = useState<TenantInfo[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(
    () => sessionStorage.getItem(TENANT_KEY)
  );
  const [tenantUnlocked, setTenantUnlocked] = useState(false);

  // Check platform admin status
  useEffect(() => {
    if (!isAuthenticated || !employee) {
      setIsPlatformAdmin(false);
      setAllTenants([]);
      return;
    }

    const checkAdmin = async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user?.id) return;

      const { data } = await supabase
        .from("platform_admins")
        .select("id")
        .eq("user_id", session.session.user.id)
        .maybeSingle();

      if (data) {
        setIsPlatformAdmin(true);
        // Fetch all tenants
        const { data: tenants } = await supabase
          .from("tenants")
          .select("id, name, slug, is_active, plan")
          .order("name");
        if (tenants) setAllTenants(tenants);
        
        // If we had a stored selection, mark as unlocked (session-only)
        const stored = sessionStorage.getItem(TENANT_KEY);
        if (stored) {
          setTenantUnlocked(true);
        }
      }
    };

    checkAdmin();
  }, [isAuthenticated, employee]);

  const selectTenant = useCallback((tid: string) => {
    setSelectedTenantId(tid);
    sessionStorage.setItem(TENANT_KEY, tid);
    // Reset location selection when switching tenant
    localStorage.removeItem(STORAGE_KEY);
    setActiveLocationIdState(null);
  }, []);

  const clearTenantSelection = useCallback(() => {
    setSelectedTenantId(null);
    setTenantUnlocked(false);
    sessionStorage.removeItem(TENANT_KEY);
    localStorage.removeItem(STORAGE_KEY);
    setActiveLocationIdState(null);
  }, []);

  const unlockTenant = useCallback(async (pin: string): Promise<boolean> => {
    // Platform admin re-verifies their own PIN
    if (!employee) return false;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pos-login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            username: employee.full_name,
            pin,
          }),
        }
      );
      if (res.ok) {
        setTenantUnlocked(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [employee]);

  // Determine which tenant_id to filter by
  const effectiveTenantId = isPlatformAdmin && selectedTenantId
    ? selectedTenantId
    : tenant?.id || null;

  const fetchLocations = useCallback(async () => {
    let query = supabase
      .from("locations")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (effectiveTenantId) {
      query = query.eq("tenant_id", effectiveTenantId);
    }

    const { data } = await query;
    if (data && data.length > 0) {
      setLocations(data as Location[]);
      const firstTenant = (data[0] as any).tenant_id;
      if (firstTenant) setTenantId(firstTenant);
      const currentId = localStorage.getItem(STORAGE_KEY);
      if (!currentId || !data.find((l: any) => l.id === currentId)) {
        const firstId = data[0].id;
        setActiveLocationIdState(firstId);
        localStorage.setItem(STORAGE_KEY, firstId);
      }
    } else {
      setLocations([]);
    }
    setLoading(false);
  }, [effectiveTenantId]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const setActiveLocationId = useCallback((id: string) => {
    setActiveLocationIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const activeLocation = locations.find((l) => l.id === activeLocationId) || locations[0] || null;

  return (
    <LocationContext.Provider
      value={{
        locations,
        activeLocation,
        setActiveLocationId,
        loading,
        refetch: fetchLocations,
        tenantId,
        isPlatformAdmin,
        allTenants,
        selectedTenantId,
        selectTenant,
        clearTenantSelection,
        tenantUnlocked,
        unlockTenant,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation_() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation_ must be used within LocationProvider");
  return ctx;
}
