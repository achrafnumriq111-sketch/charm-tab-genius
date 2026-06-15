import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { HelpLayout } from "@/components/help/HelpLayout";
import { HELP_ARTICLES, searchArticles } from "./help/registry";

export default function Help() {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchArticles(query), [query]);

  return (
    <HelpLayout>
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Helpcentrum</h1>
        <p className="text-lg text-muted-foreground">
          Documentatie, gidsen en best practices voor SAAKOUK POS.
        </p>
      </header>

      <div className="relative mb-6">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Zoek op term, module of trefwoord..."
          className="pl-9 h-11"
        />
      </div>

      {query.trim() && (
        <p className="text-sm text-muted-foreground mb-4">
          {results.length} {results.length === 1 ? "resultaat" : "resultaten"} voor "{query}"
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {results.map((a) => {
          const Icon = a.icon;
          return (
            <Link key={a.slug} to={`/help/${a.slug}`}>
              <Card className="p-5 hover:shadow-md hover:border-primary/40 transition-all h-full group">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold truncate">{a.title}</h3>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform shrink-0" />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{a.description}</p>
                    <Badge variant="outline" className="mt-2 text-[10px]">{a.category}</Badge>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {results.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">
          Geen artikelen gevonden. Probeer een andere term.
        </Card>
      )}
    </HelpLayout>
  );
}
