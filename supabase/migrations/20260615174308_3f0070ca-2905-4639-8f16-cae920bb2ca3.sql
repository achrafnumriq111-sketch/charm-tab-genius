
-- Helper: strict access predicate for location-scoped rows.
CREATE OR REPLACE FUNCTION public.is_location_writable_by(_user_id uuid, _location_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    _location_id = public.get_employee_location_id(_user_id)
    OR (
      public.get_employee_role(_user_id) = 'owner'::employee_role
      AND public.location_in_user_tenant(_location_id, _user_id)
    )
$$;

CREATE OR REPLACE FUNCTION public.is_location_readable_by(_user_id uuid, _location_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_location_writable_by(_user_id, _location_id)
    OR public.is_platform_admin(_user_id)
$$;

REVOKE ALL ON FUNCTION public.is_location_writable_by(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_location_readable_by(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_location_writable_by(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_location_readable_by(uuid, uuid) TO authenticated, service_role;

-- ===========================================================================
-- DROP WIDE "FOR ALL" tenant guards (they OR-bypass the narrow location policies)
-- ===========================================================================
DROP POLICY IF EXISTS products_tenant_guard          ON public.products;
DROP POLICY IF EXISTS pos_transactions_tenant_guard  ON public.pos_transactions;
DROP POLICY IF EXISTS inventory_items_tenant_guard   ON public.inventory_items;
DROP POLICY IF EXISTS cash_closings_tenant_guard     ON public.cash_closings;
DROP POLICY IF EXISTS qr_orders_tenant_guard         ON public.qr_orders;
DROP POLICY IF EXISTS stock_movements_tenant_guard   ON public.stock_movements;

-- ===========================================================================
-- products — replace loose policies with strict ones
-- ===========================================================================
DROP POLICY IF EXISTS "Employees read own location products"   ON public.products;
DROP POLICY IF EXISTS "Employees insert own location products" ON public.products;
DROP POLICY IF EXISTS "Employees update own location products" ON public.products;
DROP POLICY IF EXISTS "Owners delete own location products"    ON public.products;

CREATE POLICY "products_select_strict" ON public.products FOR SELECT TO authenticated
  USING (public.is_location_readable_by(auth.uid(), location_id));
CREATE POLICY "products_insert_strict" ON public.products FOR INSERT TO authenticated
  WITH CHECK (public.is_location_writable_by(auth.uid(), location_id));
CREATE POLICY "products_update_strict" ON public.products FOR UPDATE TO authenticated
  USING (public.is_location_writable_by(auth.uid(), location_id))
  WITH CHECK (public.is_location_writable_by(auth.uid(), location_id));
CREATE POLICY "products_delete_strict" ON public.products FOR DELETE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (public.get_employee_role(auth.uid()) = 'owner'
        AND public.location_in_user_tenant(location_id, auth.uid()))
  );

-- ===========================================================================
-- floor_zones
-- ===========================================================================
DROP POLICY IF EXISTS "zones location read"    ON public.floor_zones;
DROP POLICY IF EXISTS "zones location write"   ON public.floor_zones;
DROP POLICY IF EXISTS "zones location update"  ON public.floor_zones;
DROP POLICY IF EXISTS "zones owner delete"     ON public.floor_zones;

CREATE POLICY "floor_zones_select_strict" ON public.floor_zones FOR SELECT TO authenticated
  USING (public.is_location_readable_by(auth.uid(), location_id));
CREATE POLICY "floor_zones_insert_strict" ON public.floor_zones FOR INSERT TO authenticated
  WITH CHECK (public.is_location_writable_by(auth.uid(), location_id));
CREATE POLICY "floor_zones_update_strict" ON public.floor_zones FOR UPDATE TO authenticated
  USING (public.is_location_writable_by(auth.uid(), location_id))
  WITH CHECK (public.is_location_writable_by(auth.uid(), location_id));
CREATE POLICY "floor_zones_delete_strict" ON public.floor_zones FOR DELETE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (public.get_employee_role(auth.uid()) = 'owner'
        AND public.location_in_user_tenant(location_id, auth.uid()))
  );

-- ===========================================================================
-- floor_tables (tighten insert & update; read & delete were already strict)
-- ===========================================================================
DROP POLICY IF EXISTS "tables location insert" ON public.floor_tables;
DROP POLICY IF EXISTS "tables location update" ON public.floor_tables;

CREATE POLICY "floor_tables_insert_strict" ON public.floor_tables FOR INSERT TO authenticated
  WITH CHECK (public.is_location_writable_by(auth.uid(), location_id));
CREATE POLICY "floor_tables_update_strict" ON public.floor_tables FOR UPDATE TO authenticated
  USING (public.is_location_writable_by(auth.uid(), location_id))
  WITH CHECK (public.is_location_writable_by(auth.uid(), location_id));

-- ===========================================================================
-- discounts (tighten insert; others already had owner-or-staff)
-- ===========================================================================
DROP POLICY IF EXISTS "disc loc insert" ON public.discounts;
CREATE POLICY "discounts_insert_strict" ON public.discounts FOR INSERT TO authenticated
  WITH CHECK (public.is_location_writable_by(auth.uid(), location_id));

-- ===========================================================================
-- location_settings
-- ===========================================================================
DROP POLICY IF EXISTS "ls loc read"     ON public.location_settings;
DROP POLICY IF EXISTS "ls owner write"  ON public.location_settings;
DROP POLICY IF EXISTS "ls owner update" ON public.location_settings;

CREATE POLICY "location_settings_select_strict" ON public.location_settings FOR SELECT TO authenticated
  USING (public.is_location_readable_by(auth.uid(), location_id));
CREATE POLICY "location_settings_insert_strict" ON public.location_settings FOR INSERT TO authenticated
  WITH CHECK (
    public.get_employee_role(auth.uid()) = 'owner'
    AND public.location_in_user_tenant(location_id, auth.uid())
  );
CREATE POLICY "location_settings_update_strict" ON public.location_settings FOR UPDATE TO authenticated
  USING (
    public.get_employee_role(auth.uid()) = 'owner'
    AND public.location_in_user_tenant(location_id, auth.uid())
  )
  WITH CHECK (
    public.get_employee_role(auth.uid()) = 'owner'
    AND public.location_in_user_tenant(location_id, auth.uid())
  );

-- ===========================================================================
-- activity_logs
-- ===========================================================================
DROP POLICY IF EXISTS "logs location read"   ON public.activity_logs;
DROP POLICY IF EXISTS "logs location insert" ON public.activity_logs;

CREATE POLICY "activity_logs_select_strict" ON public.activity_logs FOR SELECT TO authenticated
  USING (
    location_id IS NULL
    AND public.get_tenant_id_for_user(auth.uid()) IS NOT NULL  -- system-wide rows visible to any tenant member
    OR (location_id IS NOT NULL AND public.is_location_readable_by(auth.uid(), location_id))
  );
CREATE POLICY "activity_logs_insert_strict" ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (
    location_id IS NULL
    OR public.is_location_writable_by(auth.uid(), location_id)
  );

-- ===========================================================================
-- vat_category_rates (owner-only writes; readable per location)
-- ===========================================================================
DROP POLICY IF EXISTS "vat loc read"     ON public.vat_category_rates;
DROP POLICY IF EXISTS "vat owner write"  ON public.vat_category_rates;
DROP POLICY IF EXISTS "vat owner update" ON public.vat_category_rates;
DROP POLICY IF EXISTS "vat owner delete" ON public.vat_category_rates;

CREATE POLICY "vat_select_strict" ON public.vat_category_rates FOR SELECT TO authenticated
  USING (public.is_location_readable_by(auth.uid(), location_id));
CREATE POLICY "vat_insert_strict" ON public.vat_category_rates FOR INSERT TO authenticated
  WITH CHECK (
    public.get_employee_role(auth.uid()) = 'owner'
    AND public.location_in_user_tenant(location_id, auth.uid())
  );
CREATE POLICY "vat_update_strict" ON public.vat_category_rates FOR UPDATE TO authenticated
  USING (
    public.get_employee_role(auth.uid()) = 'owner'
    AND public.location_in_user_tenant(location_id, auth.uid())
  )
  WITH CHECK (
    public.get_employee_role(auth.uid()) = 'owner'
    AND public.location_in_user_tenant(location_id, auth.uid())
  );
CREATE POLICY "vat_delete_strict" ON public.vat_category_rates FOR DELETE TO authenticated
  USING (
    public.get_employee_role(auth.uid()) = 'owner'
    AND public.location_in_user_tenant(location_id, auth.uid())
  );

-- ===========================================================================
-- reservations (tighten insert; reads/updates already had owner-or-staff)
-- ===========================================================================
DROP POLICY IF EXISTS "res location insert" ON public.reservations;
CREATE POLICY "reservations_insert_strict" ON public.reservations FOR INSERT TO authenticated
  WITH CHECK (public.is_location_writable_by(auth.uid(), location_id));

-- ===========================================================================
-- upsell_rules (tighten insert; keep anon read of active rules)
-- ===========================================================================
DROP POLICY IF EXISTS "Tenant-scoped insert upsell_rules" ON public.upsell_rules;
CREATE POLICY "upsell_rules_insert_strict" ON public.upsell_rules FOR INSERT TO authenticated
  WITH CHECK (public.is_location_writable_by(auth.uid(), location_id));
