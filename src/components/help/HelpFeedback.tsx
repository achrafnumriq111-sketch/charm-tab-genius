import { useState } from "react";
import { ThumbsUp, ThumbsDown, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  slug: string;
}

export function HelpFeedback({ slug }: Props) {
  const [rating, setRating] = useState<"helpful" | "not_helpful" | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(finalRating: "helpful" | "not_helpful") {
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("help_feedback").insert({
      article_slug: slug,
      rating: finalRating,
      message: message.trim() || null,
      user_id: user?.id ?? null,
      user_agent: navigator.userAgent.slice(0, 500),
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Kon feedback niet opslaan", description: error.message, variant: "destructive" });
      return;
    }
    setDone(true);
    toast({ title: "Bedankt voor je feedback!" });
  }

  if (done) {
    return (
      <Card className="p-5 mt-10 border-primary/30 bg-primary/5">
        <div className="flex items-center gap-2 text-primary">
          <Check className="h-5 w-5" /> Bedankt! Je feedback is verzonden.
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5 mt-10">
      <h3 className="font-semibold mb-1">Was dit artikel nuttig?</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Help ons dit artikel te verbeteren. Geef fouten of suggesties door.
      </p>

      <div className="flex gap-2 mb-4">
        <Button
          size="sm"
          variant={rating === "helpful" ? "default" : "outline"}
          onClick={() => setRating("helpful")}
          disabled={submitting}
        >
          <ThumbsUp className="h-4 w-4 mr-2" /> Ja, nuttig
        </Button>
        <Button
          size="sm"
          variant={rating === "not_helpful" ? "default" : "outline"}
          onClick={() => setRating("not_helpful")}
          disabled={submitting}
        >
          <ThumbsDown className="h-4 w-4 mr-2" /> Nee
        </Button>
      </div>

      {rating && (
        <>
          <Textarea
            placeholder={
              rating === "helpful"
                ? "Optioneel: wat vond je goed?"
                : "Wat ontbreekt of klopt niet? (optioneel)"
            }
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
            rows={4}
            className="mb-3"
          />
          <div className="flex justify-end">
            <Button onClick={() => submit(rating)} disabled={submitting}>
              {submitting ? "Versturen..." : "Verstuur feedback"}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
