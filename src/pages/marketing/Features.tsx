import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import {
  CreditCard, QrCode, Boxes, BarChart3, Gift, ChefHat,
  CalendarClock, Cloud, Lock, Users, Receipt, Sparkles,
} from "lucide-react";

const FEATURES = [
  { icon: CreditCard, title: "POS Kassa", desc: "Tickets, split payments, modifiers, cash drawer via WebUSB." },
  { icon: QrCode, title: "QR Bestellen", desc: "Gasten bestellen via QR, Kanban-board met auto-accept." },
  { icon: Boxes, title: "Inventory", desc: "Master stock, perishables, waste tracking en counts." },
  { icon: BarChart3, title: "Analytics", desc: "Realtime KPIs, heatmaps en boekhoud-exports." },
  { icon: Gift, title: "Loyalty + PassKit", desc: "Apple Wallet kaarten, punten en kortingen." },
  { icon: ChefHat, title: "Prep Station KDS", desc: "Bonkeuken, live timers en routing per station." },
  { icon: CalendarClock, title: "Reserveringen", desc: "Visuele floor plan met realtime tafelstatus." },
  { icon: Cloud, title: "AI Forecasting", desc: "Apple WeatherKit voor omzet- en voorraadprognose." },
  { icon: Lock, title: "Veilig per klant", desc: "RLS, rollen en activity logs op database-niveau — strikte data-isolatie." },
  { icon: Users, title: "Team & rollen", desc: "Owner, manager, sales met permission-matrix." },
  { icon: Receipt, title: "Boekhouding", desc: "9% / 21% BTW splitsing en periodieke exports." },
  { icon: Sparkles, title: "Menu engineering", desc: "Dynamische cost, margin matrix en simulatie." },
];

export default function MarketingFeatures() {
  return (
    <MarketingLayout>
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">Alles in één platform.</h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          Van bestellen tot boekhouding. Geen losse tools, geen integraties.
        </p>
      </section>
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="p-6 rounded-2xl border border-border bg-card">
              <f.icon className="w-5 h-5" />
              <h3 className="mt-4 font-medium">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </MarketingLayout>
  );
}
