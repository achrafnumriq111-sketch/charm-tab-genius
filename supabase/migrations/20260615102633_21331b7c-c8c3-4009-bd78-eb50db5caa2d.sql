
-- ============================================================
-- Phase 0 / Migratie 2: location_id NOT NULL + add to gap-D tables
-- ============================================================

-- Step 0: Backfill legacy weather observations (dev seed without location)
DO $$
DECLARE
  _fallback uuid;
BEGIN
  SELECT id INTO _fallback FROM public.locations ORDER BY created_at LIMIT 1;
  IF _fallback IS NOT NULL THEN
    UPDATE public.weather_daily_observations SET location_id = _fallback WHERE location_id IS NULL;
    UPDATE public.weather_hourly_observations SET location_id = _fallback WHERE location_id IS NULL;
  END IF;
END $$;

-- Step 1: SET NOT NULL on hot tables (all confirmed 0 NULL)
ALTER TABLE public.pos_transactions             ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE public.qr_orders                    ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE public.cash_closings                ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE public.inventory_items              ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE public.stock_movements              ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE public.stock_intakes                ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE public.stock_counts                 ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE public.cash_audit_notes             ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE public.product_costs                ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE public.product_recipes              ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE public.margin_targets               ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE public.modifier_groups              ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE public.upsell_rules                 ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE public.product_modifier_groups      ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE public.business_daily_facts         ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE public.business_hourly_facts        ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE public.weather_daily_observations   ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE public.weather_hourly_observations  ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE public.weather_business_correlations ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE public.forecast_learning_metrics    ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE public.role_permissions             ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE public.employees                    ALTER COLUMN location_id SET NOT NULL;

-- Step 2: gift_cards location_id NOT NULL (0 rows currently)
ALTER TABLE public.gift_cards ALTER COLUMN location_id SET NOT NULL;

-- Step 3: modifiers — add location_id derived from modifier_groups
ALTER TABLE public.modifiers
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.locations(id) ON DELETE CASCADE;
UPDATE public.modifiers m
  SET location_id = mg.location_id
  FROM public.modifier_groups mg
  WHERE m.group_id = mg.id AND m.location_id IS NULL;
ALTER TABLE public.modifiers ALTER COLUMN location_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_modifiers_location ON public.modifiers(location_id);

-- Trigger: enforce that modifier.location_id always matches its group's location_id
CREATE OR REPLACE FUNCTION public.enforce_modifier_location()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _grp_loc uuid;
BEGIN
  SELECT location_id INTO _grp_loc FROM public.modifier_groups WHERE id = NEW.group_id;
  IF _grp_loc IS NULL THEN
    RAISE EXCEPTION 'modifier_group % has no location', NEW.group_id;
  END IF;
  IF NEW.location_id IS NOT NULL AND NEW.location_id <> _grp_loc THEN
    RAISE EXCEPTION 'modifier.location_id (%) does not match modifier_group.location_id (%)', NEW.location_id, _grp_loc;
  END IF;
  NEW.location_id := _grp_loc;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_modifier_location ON public.modifiers;
CREATE TRIGGER trg_enforce_modifier_location
  BEFORE INSERT OR UPDATE ON public.modifiers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_modifier_location();

-- Step 4: RLS policies for modifiers (currently relies on group join via existing policy if any)
-- Drop any pre-existing modifiers policies to start clean
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='modifiers' LOOP
    EXECUTE format('DROP POLICY %I ON public.modifiers', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.modifiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "modifiers_select" ON public.modifiers
  FOR SELECT TO authenticated
  USING (
    location_id = public.get_employee_location_id(auth.uid())
    OR (public.get_employee_role(auth.uid()) = 'owner'
        AND public.location_in_user_tenant(location_id, auth.uid()))
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "modifiers_write" ON public.modifiers
  FOR ALL TO authenticated
  USING (
    public.get_employee_role(auth.uid()) IN ('owner','manager')
    AND public.location_in_user_tenant(location_id, auth.uid())
  )
  WITH CHECK (
    public.get_employee_role(auth.uid()) IN ('owner','manager')
    AND public.location_in_user_tenant(location_id, auth.uid())
  );

-- Step 5: RLS for gift_cards (audit found NO policies — table was fully locked / inaccessible)
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='gift_cards' LOOP
    EXECUTE format('DROP POLICY %I ON public.gift_cards', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gift_cards_select" ON public.gift_cards
  FOR SELECT TO authenticated
  USING (
    location_id = public.get_employee_location_id(auth.uid())
    OR (public.get_employee_role(auth.uid()) = 'owner'
        AND public.location_in_user_tenant(location_id, auth.uid()))
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "gift_cards_insert" ON public.gift_cards
  FOR INSERT TO authenticated
  WITH CHECK (
    location_id = public.get_employee_location_id(auth.uid())
    OR (public.get_employee_role(auth.uid()) = 'owner'
        AND public.location_in_user_tenant(location_id, auth.uid()))
  );

CREATE POLICY "gift_cards_update" ON public.gift_cards
  FOR UPDATE TO authenticated
  USING (
    location_id = public.get_employee_location_id(auth.uid())
    OR (public.get_employee_role(auth.uid()) = 'owner'
        AND public.location_in_user_tenant(location_id, auth.uid()))
  )
  WITH CHECK (
    location_id = public.get_employee_location_id(auth.uid())
    OR (public.get_employee_role(auth.uid()) = 'owner'
        AND public.location_in_user_tenant(location_id, auth.uid()))
  );

-- Anon redemption path: scan-and-balance reads are public by code (gift cards work cross-device)
-- For now no anon policy — redemptions must go through an edge function with service_role.
-- This is more conservative than the legacy state where the table was openly accessible.

CREATE INDEX IF NOT EXISTS idx_gift_cards_location ON public.gift_cards(location_id);

-- Step 6: Ensure indexes exist for new NOT NULL columns
CREATE INDEX IF NOT EXISTS idx_pos_transactions_location ON public.pos_transactions(location_id);
CREATE INDEX IF NOT EXISTS idx_qr_orders_location ON public.qr_orders(location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_location ON public.inventory_items(location_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_location ON public.stock_movements(location_id);
CREATE INDEX IF NOT EXISTS idx_employees_location ON public.employees(location_id);
