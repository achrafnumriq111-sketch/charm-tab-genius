import { loadStripe, Stripe } from "@stripe/stripe-js";

type StripeEnv = "sandbox" | "live";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export function paymentsConfigured(): boolean {
  return !!clientToken && (clientToken.startsWith("pk_test_") || clientToken.startsWith("pk_live_"));
}

export function getStripeEnvironment(): StripeEnv {
  if (clientToken?.startsWith("pk_test_")) return "sandbox";
  if (clientToken?.startsWith("pk_live_")) return "live";
  throw new Error("Stripe payments are not configured for this build.");
}

let stripePromise: Promise<Stripe | null> | null = null;
export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    getStripeEnvironment();
    stripePromise = loadStripe(clientToken as string);
  }
  return stripePromise;
}

export const PLANS = [
  { priceId: "dotts_pro_monthly", name: "Pro maandelijks", amount: 8000, interval: "maand", badge: null },
  { priceId: "dotts_pro_yearly", name: "Pro jaarlijks", amount: 80000, interval: "jaar", badge: "2 maanden gratis" },
] as const;

export const SCALE_CONTACT_EMAIL = "sales@dotts.app";
