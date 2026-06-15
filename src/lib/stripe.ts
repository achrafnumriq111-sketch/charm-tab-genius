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
  { priceId: "pro_monthly", name: "Pro maandelijks", amount: 4900, interval: "maand" },
  { priceId: "pro_yearly", name: "Pro jaarlijks", amount: 49000, interval: "jaar" },
  { priceId: "scale_monthly", name: "Scale maandelijks", amount: 12900, interval: "maand" },
  { priceId: "scale_yearly", name: "Scale jaarlijks", amount: 129000, interval: "jaar" },
] as const;
