import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";

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

interface LocationContextType {
  locations: Location[];
  activeLocation: Location | null;
  setActiveLocationId: (id: string) => void;
  loading: boolean;
  refetch: () => Promise<void>;
  tenantId: string | null;
}

const LocationContext = createContext<LocationContextType | null>(null);

const STORAGE_KEY = "saakouk_active_location_id";

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const { tenant, isPlatformLevel } = useTenant();
  const [locations, setLocations] = useState<Location[]>([]);
  const [activeLocationId, setActiveLocationIdState] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);

  const fetchLocations = useCallback(async () => {
    let query = supabase
      .from("locations")
      .select("*")
      .eq("is_active", true)
      .order("name");

    // If we're on a tenant subdomain, filter by tenant
    if (tenant?.id) {
      query = query.eq("tenant_id", tenant.id);
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
    }
    setLoading(false);
  }, [tenant?.id]);

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
