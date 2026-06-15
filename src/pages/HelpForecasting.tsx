import { Link } from "react-router-dom";
import { ArrowLeft, TrendingUp, AlertTriangle, Lightbulb, BarChart3, Calendar, Users, Package, ShoppingCart, CloudSun } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function HelpForecasting() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/help">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Helpdesk
            </Button>
          </Link>
          <Badge variant="secondary">Updated today</Badge>
        </div>

        <header className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 rounded-2xl bg-primary/10 text-primary">
              <TrendingUp className="h-7 w-7" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Forecasting</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Forecasting helps you anticipate future revenue, demand, staffing needs, and inventory
            requirements so you can make smarter decisions before problems arise.
          </p>
        </header>

        <Section title="Overview" icon={<Lightbulb className="h-5 w-5" />}>
          <p className="text-muted-foreground mb-3">You can find Forecasting in:</p>
          <Card className="p-4 bg-muted/40">
            <code className="text-sm">Dotts Back Office → Insights → Forecasting</code>
          </Card>
          <p className="mt-4 text-muted-foreground">
            Forecasting uses historical sales data, seasonality, local events, holidays, and weather
            conditions to estimate what's likely to happen in the days and weeks ahead.
          </p>
        </Section>

        <Section title="Revenue Forecast" icon={<BarChart3 className="h-5 w-5" />}>
          <p className="text-muted-foreground mb-3">
            Predicts expected sales for the coming 7, 14, or 21 days with low/expected/high bands and a
            comparison against the previous period.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
            <li>Per-day confidence ranges (Low / Expected / High)</li>
            <li>This Week, 7-day, 14-day and 21-day horizons</li>
            <li>Previous-period overlay to spot trend changes</li>
            <li>Weather and holiday lift automatically applied</li>
          </ul>
        </Section>

        <Section title="Hourly & Staffing Forecast" icon={<Users className="h-5 w-5" />}>
          <p className="text-muted-foreground mb-3">
            Forward hourly projections and multi-day staffing recommendations based on orders-per-hour
            benchmarks compared to your actual rota.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card className="p-4">
              <Badge className="mb-2" variant="destructive">Understaffed</Badge>
              <p className="text-sm text-muted-foreground">Friday evening staffing shortage predicted.</p>
            </Card>
            <Card className="p-4">
              <Badge className="mb-2" variant="secondary">Overstaffed</Badge>
              <p className="text-sm text-muted-foreground">Tuesday afternoon shows excess capacity.</p>
            </Card>
          </div>
        </Section>

        <Section title="Product Forecast" icon={<Package className="h-5 w-5" />}>
          <p className="text-muted-foreground">
            Per-product demand with trend %, growth, previous-period comparison and a confidence score
            derived from data history and consistency.
          </p>
        </Section>

        <Section title="Inventory & Purchasing" icon={<ShoppingCart className="h-5 w-5" />}>
          <p className="text-muted-foreground mb-3">
            Inventory forecast projects when perishables run out. Purchasing uses your product recipes to
            explode demand into ingredient needs.
          </p>
        </Section>

        <Section title="Holidays, Events & Weather" icon={<CloudSun className="h-5 w-5" />}>
          <p className="text-muted-foreground">
            NL public holidays and school vacations are built-in. Apple WeatherKit data lifts or lowers
            the forecast (e.g. +12% on sunny days, −14% on heavy rain).
          </p>
        </Section>

        <Section title="Forecast vs Actual" icon={<Calendar className="h-5 w-5" />}>
          <p className="text-muted-foreground">
            Backtests against historical daily facts and reports <strong>MAPE</strong> (Mean Absolute
            Percentage Error) so you know how reliable each forecast really is.
          </p>
        </Section>

        <Section title="Forecast Actions" icon={<AlertTriangle className="h-5 w-5" />}>
          <p className="text-muted-foreground mb-4">
            Forecasting isn't just about information — it helps you take action. Dotts may suggest:
          </p>
          <div className="space-y-3">
            <ActionRow warning="Matcha inventory expected to run out within 4 days" cta="Create Purchase Order" />
            <ActionRow warning="Friday evening staffing shortage predicted" cta="Create Schedule" />
            <ActionRow warning="Revenue expected to decline next week" cta="Create Promotion" />
          </div>
          <p className="mt-6 text-sm text-muted-foreground italic">
            By connecting forecasts to actions, Dotts helps businesses stay proactive rather than reactive.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-primary">{icon}</span>
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      <div>{children}</div>
    </section>
  );
}

function ActionRow({ warning, cta }: { warning: string; cta: string }) {
  return (
    <Card className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border-l-4 border-l-amber-500">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
        <p className="text-sm">{warning}</p>
      </div>
      <Button size="sm" variant="outline">→ {cta}</Button>
    </Card>
  );
}
