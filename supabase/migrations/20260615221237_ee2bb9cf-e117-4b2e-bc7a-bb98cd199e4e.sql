CREATE TABLE public.help_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_slug text NOT NULL,
  rating text NOT NULL CHECK (rating IN ('helpful', 'not_helpful')),
  message text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.help_feedback TO authenticated;
GRANT INSERT ON public.help_feedback TO anon;
GRANT ALL ON public.help_feedback TO service_role;
ALTER TABLE public.help_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit help feedback" ON public.help_feedback FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Users can read own help feedback" ON public.help_feedback FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX idx_help_feedback_slug ON public.help_feedback(article_slug, created_at DESC);