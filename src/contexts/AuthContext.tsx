import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";

interface Employee {
  id: string;
  full_name: string;
  role: string;
  location_id?: string;
}

interface AuthContextType {
  employee: Employee | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, pin: string, rememberMe: boolean) => Promise<{ error?: string }>;
  loginOwner: (email: string, password: string, rememberMe: boolean) => Promise<{ error?: string; mfaRequired?: { factorId: string } }>;
  verifyOwnerMfa: (factorId: string, code: string, rememberMe: boolean) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 min

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout>>();
  const { slug } = useTenant();

  const clearSession = useCallback(() => {
    setEmployee(null);
    // Wipe every saakouk_/pos_ key from both storages so a logout
    // fully resets tenant, location, impersonation and employee state.
    const wipe = (s: Storage) => {
      try {
        const keys: string[] = [];
        for (let i = 0; i < s.length; i++) {
          const k = s.key(i);
          if (k && (k.startsWith("saakouk_") || k.startsWith("pos_"))) keys.push(k);
        }
        keys.forEach((k) => s.removeItem(k));
      } catch { /* ignore */ }
    };
    wipe(sessionStorage);
    wipe(localStorage);
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    clearSession();
  }, [clearSession]);

  // Inactivity auto-logout
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      if (employee) logout();
    }, INACTIVITY_TIMEOUT);
  }, [employee, logout]);

  useEffect(() => {
    if (!employee) return;
    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, resetInactivityTimer, { passive: true }));
    resetInactivityTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetInactivityTimer));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [employee, resetInactivityTimer]);

  // Restore session on mount (including impersonation bypass)
  useEffect(() => {
    const restore = async () => {
      // Check for platform admin impersonation session first
      const impersonation = sessionStorage.getItem("saakouk_impersonation");
      if (impersonation) {
        try {
          const imp = JSON.parse(impersonation);
          if (imp.employee) {
            setEmployee(imp.employee);
            setIsLoading(false);
            return;
          }
        } catch {
          sessionStorage.removeItem("saakouk_impersonation");
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const stored = localStorage.getItem("pos_employee") || sessionStorage.getItem("pos_employee");
        if (stored) {
          try {
            const cached: Employee = JSON.parse(stored);
            // Re-fetch authoritative role from DB — never trust the cached role
            // (a tampered localStorage value would otherwise unlock owner-only UI).
            const { data: fresh } = await supabase
              .from("employees")
              .select("id, full_name, role, location_id")
              .eq("user_id", session.user.id)
              .eq("is_active", true)
              .maybeSingle();
            if (fresh) {
              const merged: Employee = {
                id: fresh.id,
                full_name: fresh.full_name,
                role: fresh.role,
                location_id: fresh.location_id ?? undefined,
              };
              setEmployee(merged);
              const store = localStorage.getItem("pos_employee") ? localStorage : sessionStorage;
              store.setItem("pos_employee", JSON.stringify(merged));
            } else {
              setEmployee(cached);
            }
          } catch {
            clearSession();
          }
        }
      }
      setIsLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        sessionStorage.removeItem("saakouk_impersonation");
        clearSession();
      }
    });

    restore();
    return () => subscription.unsubscribe();
  }, [clearSession]);

  const login = useCallback(async (username: string, pin: string, rememberMe: boolean): Promise<{ error?: string }> => {
    try {
      const { getDeviceToken } = await import("@/lib/device");
      const deviceToken = getDeviceToken();
      const body: Record<string, string> = { username, pin };
      // Trusted device token takes precedence; falls back to URL slug.
      if (deviceToken) body.device_token = deviceToken;
      else if (slug) body.tenant_slug = slug;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pos-login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify(body),
        }
      );

      const data = await res.json();
      if (!res.ok) return { error: data.error || "Ongeldige inloggegevens" };

      // Set Supabase session with returned tokens
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      if (sessionError) return { error: "Sessie kon niet worden ingesteld" };

      const emp: Employee = data.employee;
      setEmployee(emp);

      // Store employee info (not sensitive - just name/role/id)
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem("pos_employee", JSON.stringify(emp));
      if (!rememberMe) localStorage.removeItem("pos_employee");

      return {};
    } catch {
      return { error: "Verbinding mislukt. Probeer het opnieuw." };
    }
  }, [slug]);

  const finalizeOwnerLogin = useCallback(async (userId: string, rememberMe: boolean): Promise<{ error?: string }> => {
    const { data: emp } = await supabase
      .from("employees")
      .select("id, full_name, role, location_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    let employee: Employee;
    if (emp) {
      employee = {
        id: emp.id,
        full_name: emp.full_name,
        role: emp.role,
        location_id: emp.location_id ?? undefined,
      };
    } else {
      // No employee record — allow platform admins (DOTTS staff) to sign in.
      const { data: padmin } = await supabase
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!padmin) {
        await supabase.auth.signOut();
        return { error: "Geen actieve zaak gekoppeld aan dit account" };
      }

      employee = {
        id: userId,
        full_name: "DOTTS Platform Admin",
        role: "owner",
        location_id: undefined,
      };
    }

    setEmployee(employee);

    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem("pos_employee", JSON.stringify(employee));
    if (!rememberMe) localStorage.removeItem("pos_employee");
    return {};
  }, []);


  const loginOwner = useCallback(async (
    email: string,
    password: string,
    rememberMe: boolean,
  ): Promise<{ error?: string; mfaRequired?: { factorId: string } }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error || !data.session) {
        return { error: error?.message || "Ongeldige inloggegevens" };
      }

      // Check if MFA is required (user has verified TOTP factor)
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2") {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totp = factors?.totp?.find((f) => f.status === "verified");
        if (totp) {
          // Do NOT finalize yet — caller must call verifyOwnerMfa
          return { mfaRequired: { factorId: totp.id } };
        }
      }

      return await finalizeOwnerLogin(data.session.user.id, rememberMe);
    } catch (e) {
      return { error: (e as Error).message || "Verbinding mislukt" };
    }
  }, [finalizeOwnerLogin]);

  const verifyOwnerMfa = useCallback(async (
    factorId: string,
    code: string,
    rememberMe: boolean,
  ): Promise<{ error?: string }> => {
    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chErr || !ch) return { error: chErr?.message || "Challenge mislukt" };
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: ch.id,
        code,
      });
      if (vErr) return { error: vErr.message };

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { error: "Sessie verlopen" };
      return await finalizeOwnerLogin(user.id, rememberMe);
    } catch (e) {
      return { error: (e as Error).message || "Verificatie mislukt" };
    }
  }, [finalizeOwnerLogin]);

  return (
    <AuthContext.Provider value={{ employee, isAuthenticated: !!employee, isLoading, login, loginOwner, verifyOwnerMfa, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
