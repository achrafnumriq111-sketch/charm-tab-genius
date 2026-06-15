import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, CreditCard, ExternalLink, Loader2, Sparkles, Check, LogOut, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation_ } from "@/contexts/LocationContext";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { getStripeEnvironment, paymentsConfigured, PLANS, SCALE_CONTACT_EMAIL } from "@/lib/stripe";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  trialing: { label: "Proefperiode", bg: "rgba(245,158,11,0.14)", color: "#b45309" },
  active: { label: "Actief", bg: "rgba(34,197,94,0.14)", color: "#15803d" },
  past_due: { label: "Betaling mislukt", bg: "rgba(239,68,68,0.14)", color: "#b91c1c" },
  suspended: { label: "Gepauzeerd", bg: "rgba(100,116,139,0.18)", color: "#475569" },
  canceled: { label: "Opgezegd", bg: "rgba(100,116,139,0.18)", color: "#475569" },
};

export default function SettingsBilling() {
  const { employee, logout } = useAuth();
  const { activeLocation } = useLocation_();
  const { sub, loading } = useSubscriptionStatus(activeLocation?.id);
  const [busy, setBusy] = useState<string | null>(null);

  const isOwner = employee?.role === "owner";

  const openCheckout = async (priceId: string) => {
    if (!activeLocation || !employee) return;
    setBusy(priceId);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          priceId,
          environment: getStripeEnvironment(),
          returnUrl: `${window.location.origin}/settings/billing?checkout=success`,
          locationId: activeLocation.id,
          tenantId: (activeLocation as any).tenant_id,
        },
      });
      if (error || !data?.clientSecret) throw new Error(error?.message || "Checkout mislukt");
      // Use Stripe.js to redirect to embedded checkout — simplest: hosted redirect via clientSecret
      // For embedded, we'd mount EmbeddedCheckout. Here we use Stripe-hosted page via session URL fallback isn't possible.
      // Simpler UX: open in new tab via Stripe Checkout retrieval — fall back to redirect to a return URL.
      // For brevity, mount embedded checkout inline:
      const { getStripe } = await import("@/lib/stripe");
      const { loadStripe } = await import("@stripe/stripe-js");
      void loadStripe;
      const stripe = await getStripe();
      if (!stripe) throw new Error("Stripe not loaded");
      // Open Stripe-managed checkout via clientSecret — using Stripe.js redirectToCheckout requires sessionId not clientSecret.
      // We'll instead navigate to an embedded mount page:
      sessionStorage.setItem("pendingCheckoutClientSecret", data.clientSecret);
      window.location.href = `/settings/billing/checkout`;
    } catch (e: any) {
      toast.error(e.message || "Kan checkout niet openen");
    } finally {
      setBusy(null);
    }
  };

  const openPortal = async () => {
    if (!activeLocation) return;
    setBusy("portal");
    try {
      const { data, error } = await supabase.functions.invoke("create-portal-session", {
        body: {
          environment: getStripeEnvironment(),
          locationId: activeLocation.id,
          returnUrl: `${window.location.origin}/settings/billing`,
        },
      });
      if (error || !data?.url) throw new Error(error?.message || "Portal kon niet worden geopend");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  if (!isOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center text-slate-500">Alleen owners kunnen billing beheren.</div>
      </div>
    );
  }

  const meta = sub ? STATUS_META[sub.status] : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50">
      <PaymentTestModeBanner />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/" className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/70 border border-white shadow-sm">
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black text-slate-900">Billing & abonnement</h1>
            <div className="text-xs text-slate-500 truncate">{activeLocation?.name ?? "Geen locatie geselecteerd"}</div>
          </div>
          <button
            onClick={() => logout()}
            className="h-10 px-4 rounded-xl flex items-center gap-2 bg-white/80 border border-white shadow-sm text-sm font-semibold text-slate-700 hover:bg-white"
          >
            <LogOut className="w-4 h-4" /> Uitloggen
          </button>
        </div>

        {/* Current status card */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl p-6 mb-6 bg-white/85 backdrop-blur border border-white shadow-lg"
        >
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : sub ? (
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Huidig abonnement</div>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {sub.stripe_price_id || sub.plan_type}
                </div>
                <div className="mt-2">
                  {meta && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold" style={{ background: meta.bg, color: meta.color }}>
                      {meta.label}
                    </span>
                  )}
                </div>
                <div className="text-sm text-slate-600 mt-3 space-y-1">
                  <div>Prijs: <span className="font-semibold">€{(sub.price_cents / 100).toFixed(2)}</span> / periode</div>
                  {sub.trial_ends_at && sub.status === "trialing" && (
                    <div>Proef tot {new Date(sub.trial_ends_at).toLocaleDateString("nl-NL")}</div>
                  )}
                  {sub.current_period_end && (
                    <div>Huidige periode tot {new Date(sub.current_period_end).toLocaleDateString("nl-NL")}</div>
                  )}
                  {sub.cancel_at_period_end && (
                    <div className="text-amber-700 font-semibold">Wordt opgezegd aan einde periode</div>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-3 justify-end">
                <button
                  onClick={openPortal}
                  disabled={busy === "portal" || !paymentsConfigured()}
                  className="h-11 px-5 rounded-xl font-semibold flex items-center justify-center gap-2 bg-slate-900 text-white disabled:opacity-50"
                >
                  {busy === "portal" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                  Beheer abonnement
                </button>
                <p className="text-[11px] text-slate-500 text-center">
                  Opent het Stripe Customer Portal: betaalmethodes, facturen, opzeggen.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <Sparkles className="w-8 h-8 mx-auto text-amber-500" />
              <div className="font-bold mt-2 text-slate-900">Nog geen abonnement</div>
              <div className="text-sm text-slate-500">Kies hieronder een plan om je 14-daagse proefperiode te starten.</div>
            </div>
          )}
        </motion.div>

        {/* Plans grid */}
        <div className="rounded-3xl p-6 bg-white/85 backdrop-blur border border-white shadow-lg">
          <div className="font-bold text-slate-900 mb-1">Wijzig of kies een plan</div>
          <div className="text-xs text-slate-500 mb-5">Alle plannen starten met 14 dagen gratis. Opzeggen wanneer je wil.</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {PLANS.map((p) => {
              const isCurrent = sub?.stripe_price_id === p.priceId;
              return (
                <div key={p.priceId} className="rounded-2xl p-4 border border-slate-200 bg-white flex flex-col">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{p.name}</div>
                  <div className="text-2xl font-black text-slate-900 mt-1">€{(p.amount / 100).toFixed(0)}</div>
                  <div className="text-xs text-slate-500">per {p.interval}</div>
                  <button
                    onClick={() => openCheckout(p.priceId)}
                    disabled={!!busy || isCurrent || !paymentsConfigured()}
                    className="mt-4 h-9 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 text-white disabled:opacity-50"
                    style={{ background: isCurrent ? "#16a34a" : "linear-gradient(135deg, #f59e0b, #fbbf24)" }}
                  >
                    {busy === p.priceId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isCurrent ? <><Check className="w-3.5 h-3.5" /> Huidig</> : <><CreditCard className="w-3.5 h-3.5" /> Kies</>}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
