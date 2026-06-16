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

const tiltSpring = { type: "spring" as const, stiffness: 200, damping: 18 };

export default function MarketingHome() {
  return (
    <MarketingLayout>
      {/* Auros bioluminescent backdrop */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-0"
        style={{
          background:
            "radial-gradient(circle at 18% 12%, hsl(var(--auros-teal) / 0.18), transparent 45%)," +
            "radial-gradient(circle at 82% 78%, hsl(var(--auros-lilac) / 0.12), transparent 55%)",
        }}
      />

      <section className="relative max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.span
            whileHover={{ y: -2, scale: 1.03 }}
            transition={tiltSpring}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border text-xs text-muted-foreground bg-card/60 backdrop-blur"
            style={{
              boxShadow:
                "inset 0 1px 0 hsl(var(--auros-ice) / 0.08), 0 6px 18px -8px hsl(var(--auros-abyss) / 0.8)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_hsl(var(--auros-cyan)/0.8)]" />
            Nieuw — multi-locatie SaaS
          </motion.span>

          <h1 className="mt-6 text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05] text-foreground">
            De kassa voor moderne <br /> specialty horeca.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            DOTTS combineert een razendsnelle iPad-kassa met realtime voorraad,
            QR-bestellingen, loyaliteit en AI-forecasting. Gebouwd voor café-eigenaren die
            schalen.
          </p>
          <div className="mt-9 flex items-center justify-center gap-3">
            <motion.div
              whileHover={{ y: -2, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={tiltSpring}
              style={{ transformStyle: "preserve-3d", perspective: 600 }}
            >
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--auros-teal)), hsl(var(--auros-lilac)))",
                  boxShadow:
                    "0 12px 30px -10px hsl(var(--auros-teal) / 0.55), inset 0 1px 0 hsl(var(--auros-ice) / 0.25), inset 0 -2px 6px hsl(var(--auros-abyss) / 0.35)",
                }}
              >
                Start gratis <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
            <motion.div
              whileHover={{ y: -2, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={tiltSpring}
            >
              <Link
                to="/demo"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border text-sm font-medium bg-card text-foreground hover:bg-accent/10 transition-colors"
                style={{
                  boxShadow:
                    "inset 0 1px 0 hsl(var(--auros-ice) / 0.06), 0 6px 18px -10px hsl(var(--auros-abyss) / 0.7)",
                }}
              >
                Live demo
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </section>

      <section className="relative max-w-6xl mx-auto px-6 pb-24">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 14, rotateX: -8 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ duration: 0.5, delay: 0.06 * i, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -6, rotateX: 4, rotateY: -4, scale: 1.02 }}
              style={{ transformStyle: "preserve-3d", perspective: 800 }}
              className="p-6 rounded-2xl border border-border bg-card backdrop-blur-xl"
            >
              <div
                className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{
                  boxShadow:
                    "inset 0 1px 0 hsl(var(--auros-ice) / 0.08), 0 20px 50px -20px hsl(var(--auros-abyss) / 0.85), 0 4px 14px -6px hsl(var(--auros-teal) / 0.18)",
                }}
              />
              <div
                className="relative w-9 h-9 rounded-xl grid place-items-center"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--auros-teal) / 0.35), hsl(var(--auros-lilac) / 0.2))",
                  boxShadow:
                    "inset 0 1px 0 hsl(var(--auros-ice) / 0.25), inset 0 -4px 10px hsl(var(--auros-abyss) / 0.55), 0 8px 18px -8px hsl(var(--auros-teal) / 0.4)",
                }}
              >
                <f.icon className="w-4 h-4 text-foreground" />
              </div>
              <h3 className="relative mt-4 font-medium text-foreground">{f.title}</h3>
              <p className="relative mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="relative max-w-6xl mx-auto px-6 pb-24">
        <motion.div
          whileHover={{ y: -3 }}
          transition={tiltSpring}
          className="relative rounded-3xl border border-border bg-card p-10 md:p-14 text-center overflow-hidden"
          style={{
            boxShadow:
              "inset 0 1px 0 hsl(var(--auros-ice) / 0.08), 0 40px 90px -30px hsl(var(--auros-abyss) / 0.9), 0 10px 30px -10px hsl(var(--auros-teal) / 0.22)",
          }}
        >
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at 50% 0%, hsl(var(--auros-teal) / 0.22), transparent 60%)",
            }}
          />
          <h2 className="relative text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
            Klaar in 5 minuten.
          </h2>
          <p className="relative mt-3 text-muted-foreground max-w-xl mx-auto">
            Maak een account, kies een subdomein voor jouw zaak en je kassa staat live.
            Geen installatie. Geen contracten.
          </p>
          <motion.div
            whileHover={{ y: -2, scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            transition={tiltSpring}
            className="relative inline-block mt-7"
          >
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground"
              style={{
                background:
                  "linear-gradient(135deg, hsl(var(--auros-teal)), hsl(var(--auros-lilac)))",
                boxShadow:
                  "0 12px 30px -10px hsl(var(--auros-teal) / 0.55), inset 0 1px 0 hsl(var(--auros-ice) / 0.25), inset 0 -2px 6px hsl(var(--auros-abyss) / 0.35)",
              }}
            >
              Begin nu <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </motion.div>
      </section>
    </MarketingLayout>
  );
}
