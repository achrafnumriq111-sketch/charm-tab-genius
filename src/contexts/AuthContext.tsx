import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Employee {
  id: string;
  full_name: string;
  role: string;
}

interface AuthContextType {
  employee: Employee | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, pin: string, rememberMe: boolean) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 min

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout>>();

  const clearSession = useCallback(() => {
    setEmployee(null);
    sessionStorage.removeItem("pos_employee");
    localStorage.removeItem("pos_employee");
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

  // Restore session on mount
  useEffect(() => {
    const restore = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const stored = localStorage.getItem("pos_employee") || sessionStorage.getItem("pos_employee");
        if (stored) {
          try {
            setEmployee(JSON.parse(stored));
          } catch {
            clearSession();
          }
        }
      }
      setIsLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") clearSession();
    });

    restore();
    return () => subscription.unsubscribe();
  }, [clearSession]);

  const login = useCallback(async (username: string, pin: string, rememberMe: boolean): Promise<{ error?: string }> => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pos-login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ username, pin }),
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
  }, []);

  return (
    <AuthContext.Provider value={{ employee, isAuthenticated: !!employee, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
