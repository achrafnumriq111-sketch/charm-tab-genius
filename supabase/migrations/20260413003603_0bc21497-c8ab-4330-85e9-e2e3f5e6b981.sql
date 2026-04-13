
-- Inventory item categories
CREATE TYPE public.inventory_category AS ENUM ('ingredient', 'packaging', 'pastry', 'retail', 'cleaning', 'misc');

-- Stock movement types
CREATE TYPE public.movement_type AS ENUM ('sale_deduction', 'stock_intake', 'manual_correction', 'waste', 'count_adjustment', 'refund_restore');

-- 1. Inventory Master
CREATE TABLE public.inventory_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_name TEXT NOT NULL,
  sku TEXT,
  category inventory_category NOT NULL DEFAULT 'ingredient',
  unit_type TEXT NOT NULL DEFAULT 'pieces',
  current_stock NUMERIC NOT NULL DEFAULT 0,
  minimum_stock NUMERIC NOT NULL DEFAULT 0,
  reorder_level NUMERIC NOT NULL DEFAULT 0,
  cost_per_unit NUMERIC NOT NULL DEFAULT 0,
  supplier TEXT,
  avg_monthly_usage NUMERIC NOT NULL DEFAULT 0,
  waste_percentage NUMERIC NOT NULL DEFAULT 0,
  last_count_date DATE,
  last_delivery_date DATE,
  location TEXT DEFAULT 'main',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read inventory" ON public.inventory_items FOR SELECT USING (true);
CREATE POLICY "Public insert inventory" ON public.inventory_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update inventory" ON public.inventory_items FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete inventory" ON public.inventory_items FOR DELETE USING (true);

-- 2. Product Recipes (BOM)
CREATE TABLE public.product_recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'pieces',
  is_optional BOOLEAN NOT NULL DEFAULT false,
  waste_factor_pct NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read recipes" ON public.product_recipes FOR SELECT USING (true);
CREATE POLICY "Public insert recipes" ON public.product_recipes FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update recipes" ON public.product_recipes FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete recipes" ON public.product_recipes FOR DELETE USING (true);

-- 3. Stock Movements (audit log)
CREATE TABLE public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  movement_type movement_type NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  product_sold TEXT,
  source TEXT,
  employee_name TEXT,
  employee_id TEXT,
  order_id TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read movements" ON public.stock_movements FOR SELECT USING (true);
CREATE POLICY "Public insert movements" ON public.stock_movements FOR INSERT WITH CHECK (true);

-- 4. Stock Intakes (deliveries)
CREATE TABLE public.stock_intakes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  supplier TEXT,
  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'pieces',
  purchase_price NUMERIC NOT NULL DEFAULT 0,
  invoice_reference TEXT,
  location TEXT DEFAULT 'main',
  employee_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_intakes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read intakes" ON public.stock_intakes FOR SELECT USING (true);
CREATE POLICY "Public insert intakes" ON public.stock_intakes FOR INSERT WITH CHECK (true);

-- 5. Stock Counts (monthly count sessions)
CREATE TABLE public.stock_counts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  count_session_id TEXT NOT NULL,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  system_stock NUMERIC NOT NULL DEFAULT 0,
  physical_count NUMERIC NOT NULL DEFAULT 0,
  difference NUMERIC NOT NULL DEFAULT 0,
  difference_pct NUMERIC NOT NULL DEFAULT 0,
  adjustment_reason TEXT,
  counted_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read counts" ON public.stock_counts FOR SELECT USING (true);
CREATE POLICY "Public insert counts" ON public.stock_counts FOR INSERT WITH CHECK (true);

-- 6. Margin Targets
CREATE TABLE public.margin_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL UNIQUE,
  target_margin_pct NUMERIC NOT NULL DEFAULT 80,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.margin_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read margin targets" ON public.margin_targets FOR SELECT USING (true);
CREATE POLICY "Public insert margin targets" ON public.margin_targets FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update margin targets" ON public.margin_targets FOR UPDATE USING (true) WITH CHECK (true);

-- Insert default margin targets
INSERT INTO public.margin_targets (category, target_margin_pct) VALUES
  ('Drinks', 80),
  ('Food', 70),
  ('Retail', 60);

-- Updated_at trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_product_recipes_updated_at BEFORE UPDATE ON public.product_recipes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_margin_targets_updated_at BEFORE UPDATE ON public.margin_targets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
