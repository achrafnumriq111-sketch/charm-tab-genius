
-- Modifier Groups table
CREATE TABLE public.modifier_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  location_id TEXT DEFAULT 'main',
  is_required BOOLEAN NOT NULL DEFAULT false,
  min_select INTEGER NOT NULL DEFAULT 0,
  max_select INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_modifier_group_name UNIQUE (name)
);

ALTER TABLE public.modifier_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read modifier_groups" ON public.modifier_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert modifier_groups" ON public.modifier_groups FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update modifier_groups" ON public.modifier_groups FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete modifier_groups" ON public.modifier_groups FOR DELETE TO authenticated USING (true);

-- Modifiers table
CREATE TABLE public.modifiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.modifier_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  extra_price NUMERIC NOT NULL DEFAULT 0,
  cost_price NUMERIC NOT NULL DEFAULT 0,
  stock_sensitive BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_modifier_name_per_group UNIQUE (group_id, name)
);

ALTER TABLE public.modifiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read modifiers" ON public.modifiers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert modifiers" ON public.modifiers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update modifiers" ON public.modifiers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete modifiers" ON public.modifiers FOR DELETE TO authenticated USING (true);

-- Product-Modifier Groups junction table
CREATE TABLE public.product_modifier_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id TEXT NOT NULL,
  modifier_group_id UUID NOT NULL REFERENCES public.modifier_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_product_modifier_group UNIQUE (product_id, modifier_group_id)
);

ALTER TABLE public.product_modifier_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read product_modifier_groups" ON public.product_modifier_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert product_modifier_groups" ON public.product_modifier_groups FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update product_modifier_groups" ON public.product_modifier_groups FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete product_modifier_groups" ON public.product_modifier_groups FOR DELETE TO authenticated USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_modifier_groups_updated_at
  BEFORE UPDATE ON public.modifier_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_modifiers_updated_at
  BEFORE UPDATE ON public.modifiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_modifiers_group_id ON public.modifiers(group_id);
CREATE INDEX idx_modifiers_active ON public.modifiers(is_active, display_order);
CREATE INDEX idx_product_modifier_groups_product ON public.product_modifier_groups(product_id);
CREATE INDEX idx_product_modifier_groups_group ON public.product_modifier_groups(modifier_group_id);
