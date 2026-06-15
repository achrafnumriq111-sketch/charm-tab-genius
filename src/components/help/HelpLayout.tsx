import { useMemo, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { BookOpen, Search, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HELP_ARTICLES, searchArticles } from "@/pages/help/registry";

interface Props {
  activeSlug?: string;
  children: ReactNode;
}

export function HelpLayout({ activeSlug, children }: Props) {
  const [query, setQuery] = useState("");
  const { pathname } = useLocation();
  const results = useMemo(() => searchArticles(query), [query]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof HELP_ARTICLES>();
    for (const a of results) {
      const list = map.get(a.category) ?? [];
      list.push(a);
      map.set(a.category, list);
    }
    return Array.from(map.entries());
  }, [results]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/help" className="flex items-center gap-2 font-semibold">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <BookOpen className="h-4 w-4" />
            </div>
            Helpcentrum
          </Link>
          <div className="flex-1 max-w-lg ml-4 relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Zoek in alle artikelen..."
              className="pl-9"
            />
          </div>
          {pathname !== "/help" && (
            <Link to="/help">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Alle artikelen
              </Button>
            </Link>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <nav className="space-y-5">
            {grouped.length === 0 && (
              <p className="text-sm text-muted-foreground">Geen artikelen gevonden voor "{query}".</p>
            )}
            {grouped.map(([category, items]) => (
              <div key={category}>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                  {category}
                </div>
                <ul className="space-y-1">
                  {items.map((a) => {
                    const Icon = a.icon;
                    const active = activeSlug === a.slug;
                    return (
                      <li key={a.slug}>
                        <NavLink
                          to={`/help/${a.slug}`}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                            active
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-foreground/80 hover:bg-muted"
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{a.title}</span>
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <main>
          {query.trim() && pathname === "/help" && (
            <div className="mb-4">
              <Badge variant="secondary">{results.length} resultaten voor "{query}"</Badge>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
