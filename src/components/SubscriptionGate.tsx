import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useLocation_ } from "@/contexts/LocationContext";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, CreditCard, Sparkles } from "lucide-react";

export function SubscriptionGate({ children }: { children: ReactNode }) {
  const { employee } = useAuth();
  const { activeLocation, isPlatformAdmin } = useLocation_();
  const route = useLocation();
  const { sub, loading, isPastDue, isSuspended, isTrialing, trialDaysLeft } = useSubscriptionStatus(activeLocation?.id);

  const isBillingRoute = route.pathname.startsWith("/settings/billing");
  const isOwner = employee?.role === "owner";

  // DOTTS platform admins bypass tenant billing entirely
  if (isPlatformAdmin) return <>{children}</>;
  if (loading || !activeLocation) return <>{children}</>;
  if (isBillingRoute) return <>{children}</>;


  // No subscription at all → show choose-plan screen for owners; soft-block staff
  if (!sub) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-amber-50">
        <div className="max-w-md text-center rounded-3xl bg-card/80 backdrop-blur p-8 shadow-xl border border-border/60">
          <Sparkles className="w-10 h-10 mx-auto text-amber-500" />
          <h1 className="text-2xl font-black mt-3 text-foreground">Kies een abonnement</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Deze locatie heeft nog geen actief abonnement. {isOwner ? "Start je 14-daagse proefperiode." : "Vraag je owner om een plan te kiezen."}
          </p>
          {isOwner && (
            <Link to="/settings/billing" className="inline-flex items-center gap-2 mt-5 px-5 h-11 rounded-xl text-white font-semibold" style={{ background: "linear-gradient(135deg, #f59e0b, #fbbf24)" }}>
              <CreditCard className="w-4 h-4" /> Naar billing
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (isSuspended) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-red-50 to-slate-50">
        <div className="max-w-md text-center rounded-3xl bg-card/90 p-8 shadow-2xl border border-red-200">
          <AlertTriangle className="w-10 h-10 mx-auto text-red-500" />
          <h1 className="text-2xl font-black mt-3 text-foreground">Abonnement gepauzeerd</h1>
          <p className="text-sm text-muted-foreground mt-2">
            POS is uitgeschakeld voor deze locatie. {isOwner ? "Activeer een plan om verder te gaan." : "Vraag je owner om billing bij te werken."}
          </p>
          {isOwner && (
            <Link to="/settings/billing" className="inline-flex items-center gap-2 mt-5 px-5 h-11 rounded-xl text-white font-semibold bg-red-600">
              <CreditCard className="w-4 h-4" /> Reactiveer abonnement
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (isPastDue) {
    return (
      <div className="relative min-h-screen">
        <div className="sticky top-0 z-50 bg-red-600 text-white px-4 py-3 flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="w-4 h-4" />
            Betaling mislukt — werk je betaalmethode bij om service-onderbreking te voorkomen.
          </div>
          {isOwner && (
            <Link to="/settings/billing" className="bg-card text-red-700 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap">
              Betaalmethode →
            </Link>
          )}
        </div>
        {children}
      </div>
    );
  }

  if (isTrialing && trialDaysLeft !== null) {
    return (
      <div className="relative min-h-screen">
        <div className="sticky top-0 z-50 bg-gradient-to-r from-amber-400 to-amber-500 text-white px-4 py-2 flex items-center justify-between gap-3 shadow">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            Proefperiode — nog {trialDaysLeft} {trialDaysLeft === 1 ? "dag" : "dagen"}
          </div>
          {isOwner && (
            <Link to="/settings/billing" className="bg-card/95 text-amber-700 px-3 py-1 rounded-lg text-[11px] font-bold">
              Upgrade nu
            </Link>
          )}
        </div>
        {children}
      </div>
    );
  }

  return <>{children}</>;
}
