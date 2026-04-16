import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Loader2, Shield, Store, ToggleLeft, ToggleRight,
  Users, MapPin, LogOut, RefreshCw
} from "lucide-react";

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  plan: string;
  created_at: string;
  owner_user_id: string;
}

const PlatformAdmin = () => {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  // Check platform admin status
  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }
      const { data } = await supabase
        .from("platform_admins")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!data) {
        navigate("/");
        return;
      }
      setIsAdmin(true);
      setChecking(false);
    };
    check();
  }, [navigate]);

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tenants")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setTenants(data as TenantRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) fetchTenants();
  }, [isAdmin, fetchTenants]);

  const toggleActive = async (tenant: TenantRow) => {
    setToggling(tenant.id);
    await supabase
      .from("tenants")
      .update({ is_active: !tenant.is_active })
      .eq("id", tenant.id);
    await fetchTenants();
    setToggling(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f0f2f8" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#7c6bc4" }} />
      </div>
    );
  }

  const glassCard = {
    background: "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(247,249,255,0.78))",
    border: "1px solid rgba(255,255,255,0.72)",
    boxShadow: "inset 0 1px 1px rgba(255,255,255,0.85), 0 12px 40px rgba(160,175,219,0.12)",
    backdropFilter: "blur(14px)",
  };

  return (
    <div
      className="min-h-screen p-4 md:p-8"
      style={{
        background:
          "radial-gradient(ellipse at 20% 20%, rgba(205,216,255,0.35), transparent 50%), " +
          "radial-gradient(ellipse at 80% 30%, rgba(255,206,236,0.25), transparent 50%), " +
          "linear-gradient(180deg, #f0f2f8 0%, #e8ecf4 100%)",
      }}
    >
      {/* Header */}
      <div className="max-w-5xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, rgba(172,155,255,0.3), rgba(205,216,255,0.4))",
                border: "1px solid rgba(255,255,255,0.6)",
              }}
            >
              <Shield className="w-5 h-5" style={{ color: "#5a5a72" }} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight" style={{ color: "#2a2a3a" }}>
                Platform Admin
              </h1>
              <p className="text-xs" style={{ color: "#9b9bab" }}>
                Beheer alle tenants
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchTenants}
              className="h-9 w-9 rounded-xl flex items-center justify-center transition-colors hover:bg-white/50"
              style={{ color: "#8b8b9e" }}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              className="h-9 px-3 rounded-xl flex items-center gap-1.5 text-xs font-medium transition-colors hover:bg-white/50"
              style={{ color: "#8b8b9e" }}
            >
              <LogOut className="w-3.5 h-3.5" /> Uitloggen
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-5xl mx-auto grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Totaal", value: tenants.length, icon: Store },
          { label: "Actief", value: tenants.filter(t => t.is_active).length, icon: ToggleRight },
          { label: "Inactief", value: tenants.filter(t => !t.is_active).length, icon: ToggleLeft },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-4" style={glassCard}>
            <div className="flex items-center gap-2 mb-1">
              <s.icon className="w-3.5 h-3.5" style={{ color: "#9b9bab" }} />
              <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "#8b8b9e" }}>
                {s.label}
              </span>
            </div>
            <span className="text-2xl font-bold" style={{ color: "#2a2a3a" }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Tenants list */}
      <div className="max-w-5xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#7c6bc4" }} />
          </div>
        ) : (
          <div className="space-y-3">
            {tenants.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="rounded-xl p-4 flex items-center justify-between"
                style={{
                  ...glassCard,
                  opacity: t.is_active ? 1 : 0.6,
                }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
                    style={{
                      background: t.is_active
                        ? "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(16,185,129,0.2))"
                        : "rgba(0,0,0,0.04)",
                      color: t.is_active ? "#16a34a" : "#9b9bab",
                    }}
                  >
                    {t.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: "#2a2a3a" }}>{t.name}</span>
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wider"
                        style={{
                          background: t.is_active ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.08)",
                          color: t.is_active ? "#16a34a" : "#dc2626",
                        }}
                      >
                        {t.is_active ? "Actief" : "Inactief"}
                      </span>
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wider"
                        style={{ background: "rgba(172,155,255,0.1)", color: "#7c6bc4" }}
                      >
                        {t.plan}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px] font-mono" style={{ color: "#8b8b9e" }}>
                        {t.slug}.saakouk.app
                      </span>
                      <span className="text-[10px]" style={{ color: "#b5b5c3" }}>
                        {new Date(t.created_at).toLocaleDateString("nl-NL")}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => toggleActive(t)}
                  disabled={toggling === t.id}
                  className="h-9 px-4 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5"
                  style={{
                    background: t.is_active ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.1)",
                    color: t.is_active ? "#dc2626" : "#16a34a",
                    border: `1px solid ${t.is_active ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.2)"}`,
                  }}
                >
                  {toggling === t.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : t.is_active ? (
                    <><ToggleLeft className="w-3.5 h-3.5" /> Deactiveren</>
                  ) : (
                    <><ToggleRight className="w-3.5 h-3.5" /> Activeren</>
                  )}
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlatformAdmin;
