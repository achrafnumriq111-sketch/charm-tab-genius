import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { ArrowRight, Cloud, ShieldCheck, Sparkles, Zap } from "lucide-react";

const FEATURES = [
  { icon: Zap, title: "Razendsnelle kassa", desc: "iPad-first interface, gebouwd voor drukke service." },
  { icon: Cloud, title: "Realtime cloud", desc: "Meerdere locaties, één dashboard. Altijd in sync." },
  { icon: ShieldCheck, title: "Veilig per klant", desc: "Row-level security, rollen en audit logs standaard." },
  { icon: Sparkles, title: "AI forecasting", desc: "Weersgedreven omzet- en voorraadvoorspelling." },
];

export default function MarketingHome() {
  return (
    <MarketingLayout>
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border text-xs text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Nieuw — multi-locatie SaaS
          </span>
          <h1 className="mt-6 text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
            De kassa voor moderne <br /> specialty horeca.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            DOTTS combineert een razendsnelle iPad-kassa met realtime voorraad,
            QR-bestellingen, loyaliteit en AI-forecasting. Gebouwd voor café-eigenaren die
            schalen.
          </p>
          <div className="mt-9 flex items-center justify-center gap-3">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Start gratis <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/demo"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors"
            >
              Live demo
            </Link>
          </div>
        </motion.div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 * i }}
              className="p-6 rounded-2xl border border-border bg-card"
            >
              <f.icon className="w-5 h-5 text-foreground" />
              <h3 className="mt-4 font-medium">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="rounded-3xl border border-border bg-card p-10 md:p-14 text-center">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Klaar in 5 minuten.
          </h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            Maak een account, kies een subdomein voor jouw zaak en je kassa staat live.
            Geen installatie. Geen contracten.
          </p>
          <Link
            to="/signup"
            className="mt-7 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Begin nu <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </MarketingLayout>
  );
}
