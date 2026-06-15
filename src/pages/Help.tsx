import { Link } from "react-router-dom";
import { TrendingUp, BookOpen, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";

const articles = [
  {
    slug: "forecasting",
    title: "Forecasting",
    description: "Anticipate revenue, demand, staffing and inventory needs.",
    icon: TrendingUp,
  },
];

export default function Help() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 rounded-2xl bg-primary/10 text-primary">
              <BookOpen className="h-7 w-7" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Helpdesk</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Documentation, guides and best practices for SAAKOUK POS.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {articles.map((a) => {
            const Icon = a.icon;
            return (
              <Link key={a.slug} to={`/help/${a.slug}`}>
                <Card className="p-5 hover:shadow-md hover:border-primary/40 transition-all h-full group">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">{a.title}</h3>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{a.description}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
