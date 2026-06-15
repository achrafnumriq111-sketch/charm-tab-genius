const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="w-full bg-red-100 border-b border-red-300 px-4 py-2 text-center text-sm text-red-800">
        Productie-checkout is niet geconfigureerd. Voltooi Stripe go-live om echte betalingen te accepteren.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full bg-amber-100 border-b border-amber-300 px-4 py-2 text-center text-xs text-amber-800">
        Testmodus — alle betalingen zijn fictief. Kaart 4242 4242 4242 4242 werkt voor demo.
      </div>
    );
  }
  return null;
}
