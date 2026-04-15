
CREATE TABLE public.upsell_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trigger_product_id TEXT,
  trigger_category TEXT,
  suggested_product_id TEXT NOT NULL,
  suggestion_type TEXT NOT NULL DEFAULT 'combo',
  prompt_text_nl TEXT NOT NULL DEFAULT '',
  priority INTEGER NOT NULL DEFAULT 10,
  extra_price_override NUMERIC,
  active_from TIME,
  active_until TIME,
  location_id TEXT DEFAULT 'main',
  is_active BOOLEAN NOT NULL DEFAULT true,
  conversion_count INTEGER NOT NULL DEFAULT 0,
  impression_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.upsell_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read upsell_rules" ON public.upsell_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert upsell_rules" ON public.upsell_rules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update upsell_rules" ON public.upsell_rules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete upsell_rules" ON public.upsell_rules FOR DELETE TO authenticated USING (true);

-- Also allow anon read for QR ordering
CREATE POLICY "Anon read upsell_rules" ON public.upsell_rules FOR SELECT TO anon USING (true);

CREATE TRIGGER update_upsell_rules_updated_at
  BEFORE UPDATE ON public.upsell_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_upsell_rules_trigger_product ON public.upsell_rules(trigger_product_id);
CREATE INDEX idx_upsell_rules_trigger_category ON public.upsell_rules(trigger_category);
CREATE INDEX idx_upsell_rules_active ON public.upsell_rules(is_active);
