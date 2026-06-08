
-- =========================================================================
-- PRODUCTS
-- =========================================================================
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  name text NOT NULL,
  section text NOT NULL DEFAULT 'Hot Drinks',
  price numeric(10,2) NOT NULL DEFAULT 0,
  cost_price numeric(10,2) NOT NULL DEFAULT 0,
  vat_rate numeric(5,2),
  color text DEFAULT '#94a3b8',
  tags text[] DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_location ON public.products(location_id) WHERE is_active;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
GRANT SELECT ON public.products TO anon;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon read active products"
  ON public.products FOR SELECT TO anon
  USING (is_active = true);

CREATE POLICY "Employees read own location products"
  ON public.products FOR SELECT TO authenticated
  USING (location_id = get_employee_location_id(auth.uid()) OR location_in_user_tenant(location_id, auth.uid()) OR is_platform_admin(auth.uid()));

CREATE POLICY "Employees insert own location products"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (location_id = get_employee_location_id(auth.uid()) OR location_in_user_tenant(location_id, auth.uid()));

CREATE POLICY "Employees update own location products"
  ON public.products FOR UPDATE TO authenticated
  USING (location_id = get_employee_location_id(auth.uid()) OR location_in_user_tenant(location_id, auth.uid()))
  WITH CHECK (location_id = get_employee_location_id(auth.uid()) OR location_in_user_tenant(location_id, auth.uid()));

CREATE POLICY "Owners delete own location products"
  ON public.products FOR DELETE TO authenticated
  USING (location_in_user_tenant(location_id, auth.uid()));

CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- FLOOR ZONES
-- =========================================================================
CREATE TABLE public.floor_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_floor_zones_location ON public.floor_zones(location_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.floor_zones TO authenticated;
GRANT ALL ON public.floor_zones TO service_role;
ALTER TABLE public.floor_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zones location read" ON public.floor_zones FOR SELECT TO authenticated
  USING (location_id = get_employee_location_id(auth.uid()) OR location_in_user_tenant(location_id, auth.uid()) OR is_platform_admin(auth.uid()));
CREATE POLICY "zones location write" ON public.floor_zones FOR INSERT TO authenticated
  WITH CHECK (location_id = get_employee_location_id(auth.uid()) OR location_in_user_tenant(location_id, auth.uid()));
CREATE POLICY "zones location update" ON public.floor_zones FOR UPDATE TO authenticated
  USING (location_id = get_employee_location_id(auth.uid()) OR location_in_user_tenant(location_id, auth.uid()));
CREATE POLICY "zones owner delete" ON public.floor_zones FOR DELETE TO authenticated
  USING (location_in_user_tenant(location_id, auth.uid()));
CREATE TRIGGER trg_zones_updated BEFORE UPDATE ON public.floor_zones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- FLOOR TABLES
-- =========================================================================
CREATE TABLE public.floor_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  zone_id uuid REFERENCES public.floor_zones(id) ON DELETE SET NULL,
  name text NOT NULL,
  seats int NOT NULL DEFAULT 2,
  shape text NOT NULL DEFAULT 'square',
  x int NOT NULL DEFAULT 60,
  y int NOT NULL DEFAULT 60,
  w int NOT NULL DEFAULT 70,
  h int NOT NULL DEFAULT 70,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_floor_tables_location ON public.floor_tables(location_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.floor_tables TO authenticated;
GRANT ALL ON public.floor_tables TO service_role;
ALTER TABLE public.floor_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tables location read" ON public.floor_tables FOR SELECT TO authenticated
  USING (location_id = get_employee_location_id(auth.uid()) OR location_in_user_tenant(location_id, auth.uid()) OR is_platform_admin(auth.uid()));
CREATE POLICY "tables location insert" ON public.floor_tables FOR INSERT TO authenticated
  WITH CHECK (location_id = get_employee_location_id(auth.uid()) OR location_in_user_tenant(location_id, auth.uid()));
CREATE POLICY "tables location update" ON public.floor_tables FOR UPDATE TO authenticated
  USING (location_id = get_employee_location_id(auth.uid()) OR location_in_user_tenant(location_id, auth.uid()));
CREATE POLICY "tables owner delete" ON public.floor_tables FOR DELETE TO authenticated
  USING (location_in_user_tenant(location_id, auth.uid()));
CREATE TRIGGER trg_tables_updated BEFORE UPDATE ON public.floor_tables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- RESERVATIONS
-- =========================================================================
CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  guest_name text NOT NULL,
  reservation_date date NOT NULL,
  reservation_time time NOT NULL,
  guests int NOT NULL DEFAULT 2,
  table_name text,
  table_id uuid REFERENCES public.floor_tables(id) ON DELETE SET NULL,
  phone text,
  email text,
  notes text,
  status text NOT NULL DEFAULT 'confirmed',
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_reservations_location_date ON public.reservations(location_id, reservation_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations TO authenticated;
GRANT ALL ON public.reservations TO service_role;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "res location read" ON public.reservations FOR SELECT TO authenticated
  USING (location_id = get_employee_location_id(auth.uid()) OR location_in_user_tenant(location_id, auth.uid()) OR is_platform_admin(auth.uid()));
CREATE POLICY "res location insert" ON public.reservations FOR INSERT TO authenticated
  WITH CHECK (location_id = get_employee_location_id(auth.uid()) OR location_in_user_tenant(location_id, auth.uid()));
CREATE POLICY "res location update" ON public.reservations FOR UPDATE TO authenticated
  USING (location_id = get_employee_location_id(auth.uid()) OR location_in_user_tenant(location_id, auth.uid()));
CREATE POLICY "res owner delete" ON public.reservations FOR DELETE TO authenticated
  USING (location_in_user_tenant(location_id, auth.uid()));
CREATE TRIGGER trg_res_updated BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- ACTIVITY LOGS (append-only)
-- =========================================================================
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  employee_name text,
  employee_role text,
  action text NOT NULL,
  details text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_logs_location_time ON public.activity_logs(location_id, created_at DESC);
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "logs location read" ON public.activity_logs FOR SELECT TO authenticated
  USING (location_id = get_employee_location_id(auth.uid()) OR location_in_user_tenant(location_id, auth.uid()) OR is_platform_admin(auth.uid()));
CREATE POLICY "logs location insert" ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (location_id = get_employee_location_id(auth.uid()) OR location_in_user_tenant(location_id, auth.uid()) OR location_id IS NULL);

-- =========================================================================
-- DISCOUNTS
-- =========================================================================
CREATE TABLE public.discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  name text NOT NULL,
  discount_type text NOT NULL DEFAULT 'percent',
  value numeric(10,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_discounts_location ON public.discounts(location_id) WHERE is_active;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discounts TO authenticated;
GRANT ALL ON public.discounts TO service_role;
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disc loc read" ON public.discounts FOR SELECT TO authenticated
  USING (location_id = get_employee_location_id(auth.uid()) OR location_in_user_tenant(location_id, auth.uid()) OR is_platform_admin(auth.uid()));
CREATE POLICY "disc loc insert" ON public.discounts FOR INSERT TO authenticated
  WITH CHECK (location_id = get_employee_location_id(auth.uid()) OR location_in_user_tenant(location_id, auth.uid()));
CREATE POLICY "disc loc update" ON public.discounts FOR UPDATE TO authenticated
  USING (location_id = get_employee_location_id(auth.uid()) OR location_in_user_tenant(location_id, auth.uid()));
CREATE POLICY "disc owner delete" ON public.discounts FOR DELETE TO authenticated
  USING (location_in_user_tenant(location_id, auth.uid()));
CREATE TRIGGER trg_disc_updated BEFORE UPDATE ON public.discounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- VAT CATEGORY RATES
-- =========================================================================
CREATE TABLE public.vat_category_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  category text NOT NULL,
  rate numeric(5,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, category)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vat_category_rates TO authenticated;
GRANT ALL ON public.vat_category_rates TO service_role;
ALTER TABLE public.vat_category_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vat loc read" ON public.vat_category_rates FOR SELECT TO authenticated
  USING (location_id = get_employee_location_id(auth.uid()) OR location_in_user_tenant(location_id, auth.uid()) OR is_platform_admin(auth.uid()));
CREATE POLICY "vat owner write" ON public.vat_category_rates FOR INSERT TO authenticated
  WITH CHECK (location_in_user_tenant(location_id, auth.uid()));
CREATE POLICY "vat owner update" ON public.vat_category_rates FOR UPDATE TO authenticated
  USING (location_in_user_tenant(location_id, auth.uid()));
CREATE POLICY "vat owner delete" ON public.vat_category_rates FOR DELETE TO authenticated
  USING (location_in_user_tenant(location_id, auth.uid()));
CREATE TRIGGER trg_vat_updated BEFORE UPDATE ON public.vat_category_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- LOCATION SETTINGS (one row per location)
-- =========================================================================
CREATE TABLE public.location_settings (
  location_id uuid PRIMARY KEY REFERENCES public.locations(id) ON DELETE CASCADE,
  passkit_program_id text DEFAULT '',
  passkit_tier_id text DEFAULT '',
  points_per_euro numeric(6,2) NOT NULL DEFAULT 1,
  auto_enrol boolean NOT NULL DEFAULT true,
  feature_tips boolean NOT NULL DEFAULT true,
  feature_passkit boolean NOT NULL DEFAULT true,
  feature_piggy boolean NOT NULL DEFAULT false,
  feature_leat boolean NOT NULL DEFAULT false,
  feature_qr boolean NOT NULL DEFAULT true,
  feature_kitchen boolean NOT NULL DEFAULT false,
  extra jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.location_settings TO authenticated;
GRANT ALL ON public.location_settings TO service_role;
ALTER TABLE public.location_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ls loc read" ON public.location_settings FOR SELECT TO authenticated
  USING (location_id = get_employee_location_id(auth.uid()) OR location_in_user_tenant(location_id, auth.uid()) OR is_platform_admin(auth.uid()));
CREATE POLICY "ls owner write" ON public.location_settings FOR INSERT TO authenticated
  WITH CHECK (location_in_user_tenant(location_id, auth.uid()));
CREATE POLICY "ls owner update" ON public.location_settings FOR UPDATE TO authenticated
  USING (location_in_user_tenant(location_id, auth.uid()));
CREATE TRIGGER trg_ls_updated BEFORE UPDATE ON public.location_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- REALTIME
-- =========================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.floor_zones;
ALTER PUBLICATION supabase_realtime ADD TABLE public.floor_tables;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.discounts;
