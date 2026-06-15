import { useState } from "react";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { Mail, MapPin } from "lucide-react";

export default function MarketingContact() {
  const [sent, setSent] = useState(false);

  return (
    <MarketingLayout>
      <section className="max-w-3xl mx-auto px-6 pt-20 pb-24">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-center">Neem contact op.</h1>
        <p className="mt-4 text-lg text-muted-foreground text-center">
          Vragen over pricing, een demo of een enterprise deal? We reageren binnen 1 werkdag.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 mb-10">
          <div className="p-5 rounded-2xl border border-border bg-card flex items-center gap-3">
            <Mail className="w-5 h-5" />
            <div>
              <div className="text-xs text-muted-foreground">Email</div>
              <a href="mailto:hello@saakouk.nl" className="font-medium hover:underline">hello@saakouk.nl</a>
            </div>
          </div>
          <div className="p-5 rounded-2xl border border-border bg-card flex items-center gap-3">
            <MapPin className="w-5 h-5" />
            <div>
              <div className="text-xs text-muted-foreground">Bezoekadres</div>
              <div className="font-medium">Amsterdam, NL</div>
            </div>
          </div>
        </div>

        {sent ? (
          <div className="p-10 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 text-center">
            <div className="text-lg font-medium">Bedankt — we nemen snel contact op.</div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget as HTMLFormElement);
              const params = new URLSearchParams({
                subject: `[DOTTS] ${fd.get("subject") || ""}`,
                body: `Naam: ${fd.get("name")}\nEmail: ${fd.get("email")}\n\n${fd.get("message")}`,
              });
              window.location.href = `mailto:hello@saakouk.nl?${params}`;
              setSent(true);
            }}
            className="p-6 rounded-2xl border border-border bg-card space-y-4"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm text-muted-foreground">Naam</span>
                <input name="name" required className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm" />
              </label>
              <label className="block">
                <span className="text-sm text-muted-foreground">Email</span>
                <input name="email" type="email" required className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm" />
              </label>
            </div>
            <label className="block">
              <span className="text-sm text-muted-foreground">Onderwerp</span>
              <input name="subject" required className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm" />
            </label>
            <label className="block">
              <span className="text-sm text-muted-foreground">Bericht</span>
              <textarea name="message" rows={5} required className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </label>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Verstuur
            </button>
          </form>
        )}
      </section>
    </MarketingLayout>
  );
}
