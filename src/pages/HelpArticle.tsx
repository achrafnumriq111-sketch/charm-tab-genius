import { useParams, Navigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HelpLayout } from "@/components/help/HelpLayout";
import { HelpFeedback } from "@/components/help/HelpFeedback";
import { getArticle } from "./help/registry";

export default function HelpArticle() {
  const { slug = "" } = useParams();
  const article = getArticle(slug);

  if (!article) return <Navigate to="/help" replace />;
  if (article.custom) {
    // Custom pages handle their own route; fall back just in case.
    return <Navigate to={`/help/${article.slug}`} replace />;
  }

  const Icon = article.icon;

  return (
    <HelpLayout activeSlug={article.slug}>
      <article className="max-w-3xl">
        <header className="mb-8">
          <Badge variant="secondary" className="mb-3">{article.category}</Badge>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 rounded-2xl bg-primary/10 text-primary">
              <Icon className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{article.title}</h1>
          </div>
          <p className="text-lg text-muted-foreground">{article.description}</p>
        </header>

        {(article.sections ?? []).map((s) => (
          <section key={s.heading} className="mb-8">
            <h2 className="text-xl font-semibold mb-2">{s.heading}</h2>
            <p className="text-muted-foreground">{s.body}</p>
            {s.bullets && s.bullets.length > 0 && (
              <ul className="mt-3 space-y-1 list-disc pl-5 text-sm text-muted-foreground">
                {s.bullets.map((b) => <li key={b}>{b}</li>)}
              </ul>
            )}
          </section>
        ))}

        {(!article.sections || article.sections.length === 0) && (
          <Card className="p-6 text-muted-foreground">
            Documentatie voor deze module komt binnenkort. Heb je tussentijds een vraag, gebruik dan het
            feedbackformulier hieronder.
          </Card>
        )}

        <HelpFeedback slug={article.slug} />
      </article>
    </HelpLayout>
  );
}
