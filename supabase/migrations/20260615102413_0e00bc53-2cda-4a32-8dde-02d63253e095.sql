
-- ============================================================
-- Phase 0 / Migratie 1: Denormalized tenant_id on hot tables
-- ============================================================

-- Helper trigger function: sync tenant_id from location_id
CREATE OR REPLACE FUNCTION public.sync_tenant_id_from_location()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant uuid;
BEGIN
  -- Only act when location_id is present
  IF NEW.location_id IS NOT NULL THEN
    SELECT tenant_id INTO _tenant FROM public.locations WHERE id = NEW.location_id;
    IF _tenant IS NULL THEN
      RAISE EXCEPTION 'sync_tenant_id_from_location: location % has no tenant', NEW.location_id;
    END IF;
    -- Refuse drift: if caller supplied a different tenant_id, reject
    IF NEW.tenant_id IS NOT NULL AND NEW.tenant_id <> _tenant THEN
      RAISE EXCEPTION 'tenant_id (%) does not match location.tenant_id (%) for location %', NEW.tenant_id, _tenant, NEW.location_id;
    END IF;
    NEW.tenant_id := _tenant;
  END IF;
  RETURN NEW;
END;
$$;

-- ---------- pos_transactions ----------
ALTER TABLE public.pos_transactions ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.pos_transactions t SET tenant_id = l.tenant_id FROM public.locations l WHERE t.location_id = l.id AND t.tenant_id IS NULL;
ALTER TABLE public.pos_transactions ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pos_transactions_tenant ON public.pos_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pos_transactions_tenant_location ON public.pos_transactions(tenant_id, location_id);
DROP TRIGGER IF EXISTS trg_sync_tenant_id ON public.pos_transactions;
CREATE TRIGGER trg_sync_tenant_id BEFORE INSERT OR UPDATE ON public.pos_transactions FOR EACH ROW EXECUTE FUNCTION public.sync_tenant_id_from_location();

-- ---------- products ----------
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.products t SET tenant_id = l.tenant_id FROM public.locations l WHERE t.location_id = l.id AND t.tenant_id IS NULL;
ALTER TABLE public.products ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_tenant ON public.products(tenant_id);
DROP TRIGGER IF EXISTS trg_sync_tenant_id ON public.products;
CREATE TRIGGER trg_sync_tenant_id BEFORE INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.sync_tenant_id_from_location();

-- ---------- inventory_items ----------
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.inventory_items t SET tenant_id = l.tenant_id FROM public.locations l WHERE t.location_id = l.id AND t.tenant_id IS NULL;
ALTER TABLE public.inventory_items ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_items_tenant ON public.inventory_items(tenant_id);
DROP TRIGGER IF EXISTS trg_sync_tenant_id ON public.inventory_items;
CREATE TRIGGER trg_sync_tenant_id BEFORE INSERT OR UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.sync_tenant_id_from_location();

-- ---------- customers ----------
-- customers.location_id is nullable by design (QR anonymous path).
-- For the QR-anonymous insert path, the trigger fires only when location_id is set; for rows with NULL location_id, tenant_id must be supplied explicitly OR the row stays tenant-less.
-- To still get hard isolation, we make tenant_id NOT NULL and force callers (or the trigger) to provide it. The anon QR policy requires location_id IS NOT NULL, so anon writes always go through the trigger.
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.customers t SET tenant_id = l.tenant_id FROM public.locations l WHERE t.location_id = l.id AND t.tenant_id IS NULL;
ALTER TABLE public.customers ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON public.customers(tenant_id);
DROP TRIGGER IF EXISTS trg_sync_tenant_id ON public.customers;
CREATE TRIGGER trg_sync_tenant_id BEFORE INSERT OR UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.sync_tenant_id_from_location();

-- ---------- qr_orders ----------
ALTER TABLE public.qr_orders ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.qr_orders t SET tenant_id = l.tenant_id FROM public.locations l WHERE t.location_id = l.id AND t.tenant_id IS NULL;
ALTER TABLE public.qr_orders ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_qr_orders_tenant ON public.qr_orders(tenant_id);
DROP TRIGGER IF EXISTS trg_sync_tenant_id ON public.qr_orders;
CREATE TRIGGER trg_sync_tenant_id BEFORE INSERT OR UPDATE ON public.qr_orders FOR EACH ROW EXECUTE FUNCTION public.sync_tenant_id_from_location();

-- ---------- cash_closings ----------
ALTER TABLE public.cash_closings ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.cash_closings t SET tenant_id = l.tenant_id FROM public.locations l WHERE t.location_id = l.id AND t.tenant_id IS NULL;
ALTER TABLE public.cash_closings ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cash_closings_tenant ON public.cash_closings(tenant_id);
DROP TRIGGER IF EXISTS trg_sync_tenant_id ON public.cash_closings;
CREATE TRIGGER trg_sync_tenant_id BEFORE INSERT OR UPDATE ON public.cash_closings FOR EACH ROW EXECUTE FUNCTION public.sync_tenant_id_from_location();

-- ---------- stock_movements ----------
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.stock_movements t SET tenant_id = l.tenant_id FROM public.locations l WHERE t.location_id = l.id AND t.tenant_id IS NULL;
ALTER TABLE public.stock_movements ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant ON public.stock_movements(tenant_id);
DROP TRIGGER IF EXISTS trg_sync_tenant_id ON public.stock_movements;
CREATE TRIGGER trg_sync_tenant_id BEFORE INSERT OR UPDATE ON public.stock_movements FOR EACH ROW EXECUTE FUNCTION public.sync_tenant_id_from_location();

-- ---------- employees ----------
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.employees t SET tenant_id = l.tenant_id FROM public.locations l WHERE t.location_id = l.id AND t.tenant_id IS NULL;
ALTER TABLE public.employees ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employees_tenant ON public.employees(tenant_id);
DROP TRIGGER IF EXISTS trg_sync_tenant_id ON public.employees;
CREATE TRIGGER trg_sync_tenant_id BEFORE INSERT OR UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.sync_tenant_id_from_location();

-- ============================================================
-- Defense-in-depth RLS predicates: add tenant_id check to existing operational policies.
-- We use a separate, narrowly-scoped policy named "*_tenant_guard" that runs in addition
-- to existing policies (PostgreSQL RLS: multiple permissive policies are OR'd, but a
-- RESTRICTIVE policy is AND'd). We use RESTRICTIVE so it tightens, never widens.
-- ============================================================

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'pos_transactions','products','inventory_items','customers',
    'qr_orders','cash_closings','stock_movements','employees'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_tenant_guard', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
        USING (
          tenant_id = public.get_tenant_id_for_user(auth.uid())
          OR public.is_platform_admin(auth.uid())
        )
        WITH CHECK (
          tenant_id = public.get_tenant_id_for_user(auth.uid())
          OR public.is_platform_admin(auth.uid())
        )',
      t || '_tenant_guard', t
    );
  END LOOP;
END $$;

-- Note: anon-facing policies (e.g. QR insert into customers/qr_orders) are NOT covered by
-- the restrictive guard above because it targets `authenticated`. Those anon paths still
-- rely on (a) the trigger setting tenant_id from location_id, (b) the existing WITH CHECK
-- requiring location_id IS NOT NULL, and (c) the NOT NULL constraint on tenant_id which
-- now makes tenant-less anon inserts impossible.
