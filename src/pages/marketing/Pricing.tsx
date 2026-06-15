import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";

const PLANS = [
  {
    name: "Pro",
    price: "€80",
    period: "/maand",
    yearly: "of €800 per jaar — 2 maanden gratis",
    desc: "Alles wat je nodig hebt om je zaak te runnen.",
    cta: "Start 14 dagen gratis",
    to: "/signup",
    features: [
      "1 locatie", "POS kassa", "QR bestellen", "Inventory + waste",
      "Loyalty + PassKit", "Prep Station KDS", "Analytics dashboard",
      "AI weather forecasting", "Email & priority support",
    ],
    highlight: true,
  },
  {
    name: "Scale",
    price: "Op maat",
    period: "",
    yearly: "Voor ketens & multi-locatie operators",
    desc: "Custom pricing, SLA en dedicated account manager.",
    cta: "Contact us",
    to: "/contact",
    features: [
      "Onbeperkte locaties", "Multi-locatie dashboard", "AI forecasting",
      "API toegang", "SSO + audit exports", "Dedicated account manager",
      "Custom integraties",
    ],
  },
];

export default function MarketingPricing() {
  return (
    <MarketingLayout>
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">Eerlijke prijzen.</h1>
        <p className="mt-4 text-lg text-muted-foreground">Geen verborgen kosten. Maandelijks opzegbaar.</p>
      </section>
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <div className="grid gap-5 md:grid-cols-2">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`p-7 rounded-2xl border bg-card flex flex-col ${
                p.highlight ? "border-foreground shadow-lg" : "border-border"
              }`}
            >
              <div className="flex items-baseline justify-between">
                <h3 className="text-xl font-semibold">{p.name}</h3>
                {p.highlight && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-foreground text-background">Populair</span>
                )}
              </div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight">{p.price}</span>
                <span className="text-muted-foreground text-sm">{p.period}</span>
              </div>
              {p.yearly && <p className="mt-1 text-xs text-emerald-600 font-medium">{p.yearly}</p>}
              <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
              <ul className="mt-6 space-y-2 text-sm flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                to={p.to}
                className={`mt-7 text-center px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  p.highlight
                    ? "bg-foreground text-background hover:opacity-90"
                    : "border border-border hover:bg-secondary"
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>
    </MarketingLayout>
  );
}
