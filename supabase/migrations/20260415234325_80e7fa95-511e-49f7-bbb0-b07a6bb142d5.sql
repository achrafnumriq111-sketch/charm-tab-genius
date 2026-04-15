
-- ============================================================
-- STEP 1: Create the locations table
-- ============================================================

CREATE TABLE public.locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  timezone TEXT NOT NULL DEFAULT 'Europe/Amsterdam',
  currency TEXT NOT NULL DEFAULT 'EUR',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read locations" ON public.locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anon read active locations" ON public.locations FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "Owners insert locations" ON public.locations FOR INSERT TO authenticated WITH CHECK (get_employee_role(auth.uid()) = 'owner');
CREATE POLICY "Owners update locations" ON public.locations FOR UPDATE TO authenticated USING (get_employee_role(auth.uid()) = 'owner') WITH CHECK (get_employee_role(auth.uid()) = 'owner');
CREATE POLICY "Owners delete locations" ON public.locations FOR DELETE TO authenticated USING (get_employee_role(auth.uid()) = 'owner');

CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- STEP 2: Insert Amsterdam as the default location
-- ============================================================

INSERT INTO public.locations (id, name, city, address, timezone, currency)
VALUES (
  'a0000001-0000-0000-0000-000000000001',
  'SAAKOUK Amsterdam',
  'Amsterdam',
  'Amsterdam, NL',
  'Europe/Amsterdam',
  'EUR'
);

-- ============================================================
-- STEP 3: Add location_id to ALL tables + migrate data
-- ============================================================

-- employees
ALTER TABLE public.employees ADD COLUMN location_id UUID REFERENCES public.locations(id);
UPDATE public.employees SET location_id = 'a0000001-0000-0000-0000-000000000001';

-- pos_transactions
ALTER TABLE public.pos_transactions ADD COLUMN location_id UUID REFERENCES public.locations(id);
UPDATE public.pos_transactions SET location_id = 'a0000001-0000-0000-0000-000000000001';

-- qr_orders
ALTER TABLE public.qr_orders ADD COLUMN location_id UUID REFERENCES public.locations(id);
UPDATE public.qr_orders SET location_id = 'a0000001-0000-0000-0000-000000000001';

-- cash_closings
ALTER TABLE public.cash_closings ADD COLUMN location_id UUID REFERENCES public.locations(id);
UPDATE public.cash_closings SET location_id = 'a0000001-0000-0000-0000-000000000001';

-- cash_audit_notes
ALTER TABLE public.cash_audit_notes ADD COLUMN location_id UUID REFERENCES public.locations(id);
UPDATE public.cash_audit_notes SET location_id = 'a0000001-0000-0000-0000-000000000001';

-- inventory_items (keep existing 'location' TEXT field as storage_location)
ALTER TABLE public.inventory_items ADD COLUMN location_id UUID REFERENCES public.locations(id);
UPDATE public.inventory_items SET location_id = 'a0000001-0000-0000-0000-000000000001';

-- stock_movements
ALTER TABLE public.stock_movements ADD COLUMN location_id UUID REFERENCES public.locations(id);
UPDATE public.stock_movements SET location_id = 'a0000001-0000-0000-0000-000000000001';

-- stock_intakes (keep existing 'location' TEXT field as storage_location)
ALTER TABLE public.stock_intakes ADD COLUMN location_id UUID REFERENCES public.locations(id);
UPDATE public.stock_intakes SET location_id = 'a0000001-0000-0000-0000-000000000001';

-- stock_counts
ALTER TABLE public.stock_counts ADD COLUMN location_id UUID REFERENCES public.locations(id);
UPDATE public.stock_counts SET location_id = 'a0000001-0000-0000-0000-000000000001';

-- business_daily_facts
ALTER TABLE public.business_daily_facts ADD COLUMN location_id UUID REFERENCES public.locations(id);
UPDATE public.business_daily_facts SET location_id = 'a0000001-0000-0000-0000-000000000001';

-- business_hourly_facts
ALTER TABLE public.business_hourly_facts ADD COLUMN location_id UUID REFERENCES public.locations(id);
UPDATE public.business_hourly_facts SET location_id = 'a0000001-0000-0000-0000-000000000001';

-- product_costs
ALTER TABLE public.product_costs ADD COLUMN location_id UUID REFERENCES public.locations(id);
UPDATE public.product_costs SET location_id = 'a0000001-0000-0000-0000-000000000001';

-- product_recipes
ALTER TABLE public.product_recipes ADD COLUMN location_id UUID REFERENCES public.locations(id);
UPDATE public.product_recipes SET location_id = 'a0000001-0000-0000-0000-000000000001';

-- margin_targets
ALTER TABLE public.margin_targets ADD COLUMN location_id UUID REFERENCES public.locations(id);
UPDATE public.margin_targets SET location_id = 'a0000001-0000-0000-0000-000000000001';

-- forecast_learning_metrics
ALTER TABLE public.forecast_learning_metrics ADD COLUMN location_id UUID REFERENCES public.locations(id);
UPDATE public.forecast_learning_metrics SET location_id = 'a0000001-0000-0000-0000-000000000001';

-- login_audit_logs
ALTER TABLE public.login_audit_logs ADD COLUMN location_id UUID REFERENCES public.locations(id);
UPDATE public.login_audit_logs SET location_id = 'a0000001-0000-0000-0000-000000000001';

-- modifier_groups: convert TEXT location_id to UUID
ALTER TABLE public.modifier_groups DROP COLUMN location_id;
ALTER TABLE public.modifier_groups ADD COLUMN location_id UUID REFERENCES public.locations(id);
UPDATE public.modifier_groups SET location_id = 'a0000001-0000-0000-0000-000000000001';

-- upsell_rules: convert TEXT location_id to UUID
ALTER TABLE public.upsell_rules DROP COLUMN location_id;
ALTER TABLE public.upsell_rules ADD COLUMN location_id UUID REFERENCES public.locations(id);
UPDATE public.upsell_rules SET location_id = 'a0000001-0000-0000-0000-000000000001';

-- product_modifier_groups
ALTER TABLE public.product_modifier_groups ADD COLUMN location_id UUID REFERENCES public.locations(id);
UPDATE public.product_modifier_groups SET location_id = 'a0000001-0000-0000-0000-000000000001';

-- weather_daily_observations (keep location_key TEXT for geo reference)
ALTER TABLE public.weather_daily_observations ADD COLUMN location_id UUID REFERENCES public.locations(id);
UPDATE public.weather_daily_observations SET location_id = 'a0000001-0000-0000-0000-000000000001';

-- weather_hourly_observations
ALTER TABLE public.weather_hourly_observations ADD COLUMN location_id UUID REFERENCES public.locations(id);
UPDATE public.weather_hourly_observations SET location_id = 'a0000001-0000-0000-0000-000000000001';

-- weather_business_correlations
ALTER TABLE public.weather_business_correlations ADD COLUMN location_id UUID REFERENCES public.locations(id);
UPDATE public.weather_business_correlations SET location_id = 'a0000001-0000-0000-0000-000000000001';

-- ============================================================
-- STEP 4: Create indexes for performance
-- ============================================================

CREATE INDEX idx_employees_location ON public.employees(location_id);
CREATE INDEX idx_pos_transactions_location ON public.pos_transactions(location_id);
CREATE INDEX idx_qr_orders_location ON public.qr_orders(location_id);
CREATE INDEX idx_cash_closings_location ON public.cash_closings(location_id);
CREATE INDEX idx_inventory_items_location ON public.inventory_items(location_id);
CREATE INDEX idx_stock_movements_location ON public.stock_movements(location_id);
CREATE INDEX idx_business_daily_location ON public.business_daily_facts(location_id);
CREATE INDEX idx_business_hourly_location ON public.business_hourly_facts(location_id);
CREATE INDEX idx_modifier_groups_location ON public.modifier_groups(location_id);
CREATE INDEX idx_upsell_rules_location ON public.upsell_rules(location_id);
CREATE INDEX idx_weather_daily_location ON public.weather_daily_observations(location_id);
CREATE INDEX idx_weather_hourly_location ON public.weather_hourly_observations(location_id);

-- ============================================================
-- STEP 5: Helper function for location-scoped RLS
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_employee_location_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT location_id FROM public.employees
  WHERE user_id = _user_id AND is_active = true
  LIMIT 1
$$;
