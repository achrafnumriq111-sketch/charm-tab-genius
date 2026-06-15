import { Link } from "react-router-dom";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { PlayCircle } from "lucide-react";

export default function MarketingDemo() {
  return (
    <MarketingLayout>
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-24 text-center">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">Bekijk DOTTS in actie.</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Plan een persoonlijke demo of probeer het zelf in een gratis account.
        </p>

        <div className="mt-10 aspect-video rounded-3xl border border-border bg-card flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <PlayCircle className="w-14 h-14" />
            <span className="text-sm">Demovideo binnenkort beschikbaar</span>
          </div>
        </div>

        <div className="mt-10 flex items-center justify-center gap-3">
          <Link
            to="/signup"
            className="px-5 py-2.5 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Start gratis account
          </Link>
          <Link
            to="/contact"
            className="px-5 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors"
          >
            Plan een demo
          </Link>
        </div>
      </section>
    </MarketingLayout>
  );
}
