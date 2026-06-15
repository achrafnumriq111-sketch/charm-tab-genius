import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { ArrowLeft, Loader2 } from "lucide-react";
import { getStripe } from "@/lib/stripe";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

export default function BillingCheckout() {
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  useEffect(() => {
    const cs = sessionStorage.getItem("pendingCheckoutClientSecret");
    setClientSecret(cs);
  }, []);

  if (!clientSecret) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Checkout sessie niet gevonden. <Link to="/settings/billing" className="underline ml-1">Terug</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-card">
      <PaymentTestModeBanner />
      <div className="max-w-3xl mx-auto px-4 py-6">
        <Link to="/settings/billing" className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Terug naar billing
        </Link>
        <div className="rounded-2xl bg-card shadow-lg overflow-hidden">
          <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret: async () => clientSecret }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      </div>
    </div>
  );
}
