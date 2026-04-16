
-- 1. Helper: check if a location belongs to the user's tenant
CREATE OR REPLACE FUNCTION public.location_in_user_tenant(_location_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.locations l
    WHERE l.id = _location_id
    AND l.tenant_id = get_tenant_id_for_user(_user_id)
  )
$$;

-- Helper for modifiers: check if modifier group's location is in user's tenant
CREATE OR REPLACE FUNCTION public.modifier_group_in_user_tenant(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.modifier_groups mg
    JOIN public.locations l ON l.id = mg.location_id
    WHERE mg.id = _group_id
    AND l.tenant_id = get_tenant_id_for_user(_user_id)
  )
$$;

-- =============================================
-- 2. Drop all old location-scoped + owner policies
-- =============================================

-- business_daily_facts
DROP POLICY IF EXISTS "Location-scoped read business_daily" ON public.business_daily_facts;
DROP POLICY IF EXISTS "Location-scoped insert business_daily" ON public.business_daily_facts;
DROP POLICY IF EXISTS "Location-scoped update business_daily" ON public.business_daily_facts;

-- business_hourly_facts
DROP POLICY IF EXISTS "Location-scoped read business_hourly" ON public.business_hourly_facts;
DROP POLICY IF EXISTS "Location-scoped insert business_hourly" ON public.business_hourly_facts;
DROP POLICY IF EXISTS "Location-scoped update business_hourly" ON public.business_hourly_facts;

-- cash_audit_notes
DROP POLICY IF EXISTS "Location-scoped read audit_notes" ON public.cash_audit_notes;
DROP POLICY IF EXISTS "Location-scoped insert audit_notes" ON public.cash_audit_notes;

-- cash_closings
DROP POLICY IF EXISTS "Location-scoped read cash_closings" ON public.cash_closings;
DROP POLICY IF EXISTS "Location-scoped insert cash_closings" ON public.cash_closings;
DROP POLICY IF EXISTS "Location-scoped update cash_closings" ON public.cash_closings;

-- employees
DROP POLICY IF EXISTS "Location-scoped read employees" ON public.employees;
DROP POLICY IF EXISTS "Owners can insert employees" ON public.employees;
DROP POLICY IF EXISTS "Owners can update employees" ON public.employees;
DROP POLICY IF EXISTS "Owners can delete employees" ON public.employees;

-- forecast_learning_metrics
DROP POLICY IF EXISTS "Location-scoped read forecast" ON public.forecast_learning_metrics;
DROP POLICY IF EXISTS "Location-scoped insert forecast" ON public.forecast_learning_metrics;
DROP POLICY IF EXISTS "Location-scoped update forecast" ON public.forecast_learning_metrics;

-- inventory_items
DROP POLICY IF EXISTS "Location-scoped read inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Location-scoped insert inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Location-scoped update inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Location-scoped delete inventory" ON public.inventory_items;

-- login_audit_logs
DROP POLICY IF EXISTS "Owner read audit_logs" ON public.login_audit_logs;
DROP POLICY IF EXISTS "Location-scoped insert audit_logs" ON public.login_audit_logs;

-- margin_targets
DROP POLICY IF EXISTS "Location-scoped read margin_targets" ON public.margin_targets;
DROP POLICY IF EXISTS "Location-scoped insert margin_targets" ON public.margin_targets;
DROP POLICY IF EXISTS "Location-scoped update margin_targets" ON public.margin_targets;

-- modifier_groups
DROP POLICY IF EXISTS "Location-scoped read modifier_groups" ON public.modifier_groups;
DROP POLICY IF EXISTS "Location-scoped insert modifier_groups" ON public.modifier_groups;
DROP POLICY IF EXISTS "Location-scoped update modifier_groups" ON public.modifier_groups;
DROP POLICY IF EXISTS "Location-scoped delete modifier_groups" ON public.modifier_groups;

-- modifiers
DROP POLICY IF EXISTS "Location-scoped read modifiers" ON public.modifiers;
DROP POLICY IF EXISTS "Location-scoped insert modifiers" ON public.modifiers;
DROP POLICY IF EXISTS "Location-scoped update modifiers" ON public.modifiers;
DROP POLICY IF EXISTS "Location-scoped delete modifiers" ON public.modifiers;

-- pos_transactions
DROP POLICY IF EXISTS "Location-scoped read transactions" ON public.pos_transactions;
DROP POLICY IF EXISTS "Location-scoped insert transactions" ON public.pos_transactions;
DROP POLICY IF EXISTS "Location-scoped update transactions" ON public.pos_transactions;

-- product_costs
DROP POLICY IF EXISTS "Location-scoped read product_costs" ON public.product_costs;
DROP POLICY IF EXISTS "Location-scoped insert product_costs" ON public.product_costs;
DROP POLICY IF EXISTS "Location-scoped update product_costs" ON public.product_costs;

-- product_modifier_groups
DROP POLICY IF EXISTS "Location-scoped read pmg" ON public.product_modifier_groups;
DROP POLICY IF EXISTS "Location-scoped insert pmg" ON public.product_modifier_groups;
DROP POLICY IF EXISTS "Location-scoped update pmg" ON public.product_modifier_groups;
DROP POLICY IF EXISTS "Location-scoped delete pmg" ON public.product_modifier_groups;

-- product_recipes
DROP POLICY IF EXISTS "Location-scoped read recipes" ON public.product_recipes;
DROP POLICY IF EXISTS "Location-scoped insert recipes" ON public.product_recipes;
DROP POLICY IF EXISTS "Location-scoped update recipes" ON public.product_recipes;
DROP POLICY IF EXISTS "Location-scoped delete recipes" ON public.product_recipes;

-- qr_orders
DROP POLICY IF EXISTS "Location-scoped read qr_orders" ON public.qr_orders;
DROP POLICY IF EXISTS "Location-scoped insert qr_orders" ON public.qr_orders;
DROP POLICY IF EXISTS "Location-scoped update qr_orders" ON public.qr_orders;

-- stock_counts
DROP POLICY IF EXISTS "Location-scoped read counts" ON public.stock_counts;
DROP POLICY IF EXISTS "Location-scoped insert counts" ON public.stock_counts;

-- stock_intakes
DROP POLICY IF EXISTS "Location-scoped read intakes" ON public.stock_intakes;
DROP POLICY IF EXISTS "Location-scoped insert intakes" ON public.stock_intakes;

-- stock_movements
DROP POLICY IF EXISTS "Location-scoped read movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Location-scoped insert movements" ON public.stock_movements;

-- upsell_rules
DROP POLICY IF EXISTS "Location-scoped read upsell_rules" ON public.upsell_rules;
DROP POLICY IF EXISTS "Location-scoped insert upsell_rules" ON public.upsell_rules;
DROP POLICY IF EXISTS "Location-scoped update upsell_rules" ON public.upsell_rules;
DROP POLICY IF EXISTS "Location-scoped delete upsell_rules" ON public.upsell_rules;

-- weather_business_correlations
DROP POLICY IF EXISTS "Location-scoped read correlations" ON public.weather_business_correlations;
DROP POLICY IF EXISTS "Location-scoped insert correlations" ON public.weather_business_correlations;
DROP POLICY IF EXISTS "Location-scoped update correlations" ON public.weather_business_correlations;

-- weather_daily_observations
DROP POLICY IF EXISTS "Location-scoped read weather_daily" ON public.weather_daily_observations;
DROP POLICY IF EXISTS "Location-scoped insert weather_daily" ON public.weather_daily_observations;
DROP POLICY IF EXISTS "Location-scoped update weather_daily" ON public.weather_daily_observations;

-- weather_hourly_observations
DROP POLICY IF EXISTS "Location-scoped read weather_hourly" ON public.weather_hourly_observations;
DROP POLICY IF EXISTS "Location-scoped insert weather_hourly" ON public.weather_hourly_observations;
DROP POLICY IF EXISTS "Location-scoped update weather_hourly" ON public.weather_hourly_observations;

-- locations
DROP POLICY IF EXISTS "Authenticated read locations" ON public.locations;
DROP POLICY IF EXISTS "Owners insert locations" ON public.locations;
DROP POLICY IF EXISTS "Owners update locations" ON public.locations;
DROP POLICY IF EXISTS "Owners delete locations" ON public.locations;

-- =============================================
-- 3. Create new tenant-scoped policies
-- Pattern: owner sees all within tenant, staff sees own location
-- =============================================

-- MACRO: standard tenant+location check
-- Owner in tenant: location_in_user_tenant(location_id, auth.uid()) AND get_employee_role(auth.uid()) = 'owner'
-- Staff at location: location_id = get_employee_location_id(auth.uid())

-- business_daily_facts (SELECT, INSERT, UPDATE)
CREATE POLICY "Tenant-scoped read business_daily" ON public.business_daily_facts FOR SELECT TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped insert business_daily" ON public.business_daily_facts FOR INSERT TO authenticated
WITH CHECK (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped update business_daily" ON public.business_daily_facts FOR UPDATE TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

-- business_hourly_facts
CREATE POLICY "Tenant-scoped read business_hourly" ON public.business_hourly_facts FOR SELECT TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped insert business_hourly" ON public.business_hourly_facts FOR INSERT TO authenticated
WITH CHECK (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped update business_hourly" ON public.business_hourly_facts FOR UPDATE TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

-- cash_audit_notes
CREATE POLICY "Tenant-scoped read audit_notes" ON public.cash_audit_notes FOR SELECT TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped insert audit_notes" ON public.cash_audit_notes FOR INSERT TO authenticated
WITH CHECK (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

-- cash_closings
CREATE POLICY "Tenant-scoped read cash_closings" ON public.cash_closings FOR SELECT TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped insert cash_closings" ON public.cash_closings FOR INSERT TO authenticated
WITH CHECK (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped update cash_closings" ON public.cash_closings FOR UPDATE TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

-- employees
CREATE POLICY "Tenant-scoped read employees" ON public.employees FOR SELECT TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped insert employees" ON public.employees FOR INSERT TO authenticated
WITH CHECK (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid()));

CREATE POLICY "Tenant-scoped update employees" ON public.employees FOR UPDATE TO authenticated
USING (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid()));

CREATE POLICY "Tenant-scoped delete employees" ON public.employees FOR DELETE TO authenticated
USING (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid()));

-- forecast_learning_metrics
CREATE POLICY "Tenant-scoped read forecast" ON public.forecast_learning_metrics FOR SELECT TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped insert forecast" ON public.forecast_learning_metrics FOR INSERT TO authenticated
WITH CHECK (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped update forecast" ON public.forecast_learning_metrics FOR UPDATE TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

-- inventory_items (full CRUD)
CREATE POLICY "Tenant-scoped read inventory" ON public.inventory_items FOR SELECT TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped insert inventory" ON public.inventory_items FOR INSERT TO authenticated
WITH CHECK (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped update inventory" ON public.inventory_items FOR UPDATE TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped delete inventory" ON public.inventory_items FOR DELETE TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

-- login_audit_logs
CREATE POLICY "Tenant-scoped read audit_logs" ON public.login_audit_logs FOR SELECT TO authenticated
USING (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid()));

CREATE POLICY "Tenant-scoped insert audit_logs" ON public.login_audit_logs FOR INSERT TO authenticated
WITH CHECK (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

-- margin_targets
CREATE POLICY "Tenant-scoped read margin_targets" ON public.margin_targets FOR SELECT TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped insert margin_targets" ON public.margin_targets FOR INSERT TO authenticated
WITH CHECK (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped update margin_targets" ON public.margin_targets FOR UPDATE TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

-- modifier_groups
CREATE POLICY "Tenant-scoped read modifier_groups" ON public.modifier_groups FOR SELECT TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped insert modifier_groups" ON public.modifier_groups FOR INSERT TO authenticated
WITH CHECK (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped update modifier_groups" ON public.modifier_groups FOR UPDATE TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped delete modifier_groups" ON public.modifier_groups FOR DELETE TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

-- modifiers (via group)
CREATE POLICY "Tenant-scoped read modifiers" ON public.modifiers FOR SELECT TO authenticated
USING (get_modifier_group_location(group_id) = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND modifier_group_in_user_tenant(group_id, auth.uid())));

CREATE POLICY "Tenant-scoped insert modifiers" ON public.modifiers FOR INSERT TO authenticated
WITH CHECK (get_modifier_group_location(group_id) = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND modifier_group_in_user_tenant(group_id, auth.uid())));

CREATE POLICY "Tenant-scoped update modifiers" ON public.modifiers FOR UPDATE TO authenticated
USING (get_modifier_group_location(group_id) = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND modifier_group_in_user_tenant(group_id, auth.uid())));

CREATE POLICY "Tenant-scoped delete modifiers" ON public.modifiers FOR DELETE TO authenticated
USING (get_modifier_group_location(group_id) = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND modifier_group_in_user_tenant(group_id, auth.uid())));

-- pos_transactions
CREATE POLICY "Tenant-scoped read transactions" ON public.pos_transactions FOR SELECT TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped insert transactions" ON public.pos_transactions FOR INSERT TO authenticated
WITH CHECK (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped update transactions" ON public.pos_transactions FOR UPDATE TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

-- product_costs
CREATE POLICY "Tenant-scoped read product_costs" ON public.product_costs FOR SELECT TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped insert product_costs" ON public.product_costs FOR INSERT TO authenticated
WITH CHECK (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped update product_costs" ON public.product_costs FOR UPDATE TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

-- product_modifier_groups
CREATE POLICY "Tenant-scoped read pmg" ON public.product_modifier_groups FOR SELECT TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped insert pmg" ON public.product_modifier_groups FOR INSERT TO authenticated
WITH CHECK (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped update pmg" ON public.product_modifier_groups FOR UPDATE TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped delete pmg" ON public.product_modifier_groups FOR DELETE TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

-- product_recipes
CREATE POLICY "Tenant-scoped read recipes" ON public.product_recipes FOR SELECT TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped insert recipes" ON public.product_recipes FOR INSERT TO authenticated
WITH CHECK (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped update recipes" ON public.product_recipes FOR UPDATE TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped delete recipes" ON public.product_recipes FOR DELETE TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

-- qr_orders (keep anon policies untouched)
CREATE POLICY "Tenant-scoped read qr_orders" ON public.qr_orders FOR SELECT TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped insert qr_orders" ON public.qr_orders FOR INSERT TO authenticated
WITH CHECK (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped update qr_orders" ON public.qr_orders FOR UPDATE TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

-- stock_counts
CREATE POLICY "Tenant-scoped read counts" ON public.stock_counts FOR SELECT TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped insert counts" ON public.stock_counts FOR INSERT TO authenticated
WITH CHECK (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

-- stock_intakes
CREATE POLICY "Tenant-scoped read intakes" ON public.stock_intakes FOR SELECT TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped insert intakes" ON public.stock_intakes FOR INSERT TO authenticated
WITH CHECK (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

-- stock_movements
CREATE POLICY "Tenant-scoped read movements" ON public.stock_movements FOR SELECT TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped insert movements" ON public.stock_movements FOR INSERT TO authenticated
WITH CHECK (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

-- upsell_rules (keep anon policy untouched)
CREATE POLICY "Tenant-scoped read upsell_rules" ON public.upsell_rules FOR SELECT TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped insert upsell_rules" ON public.upsell_rules FOR INSERT TO authenticated
WITH CHECK (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped update upsell_rules" ON public.upsell_rules FOR UPDATE TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped delete upsell_rules" ON public.upsell_rules FOR DELETE TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

-- weather_business_correlations
CREATE POLICY "Tenant-scoped read correlations" ON public.weather_business_correlations FOR SELECT TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped insert correlations" ON public.weather_business_correlations FOR INSERT TO authenticated
WITH CHECK (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped update correlations" ON public.weather_business_correlations FOR UPDATE TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

-- weather_daily_observations
CREATE POLICY "Tenant-scoped read weather_daily" ON public.weather_daily_observations FOR SELECT TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped insert weather_daily" ON public.weather_daily_observations FOR INSERT TO authenticated
WITH CHECK (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped update weather_daily" ON public.weather_daily_observations FOR UPDATE TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

-- weather_hourly_observations
CREATE POLICY "Tenant-scoped read weather_hourly" ON public.weather_hourly_observations FOR SELECT TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped insert weather_hourly" ON public.weather_hourly_observations FOR INSERT TO authenticated
WITH CHECK (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

CREATE POLICY "Tenant-scoped update weather_hourly" ON public.weather_hourly_observations FOR UPDATE TO authenticated
USING (location_id = get_employee_location_id(auth.uid()) OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid())));

-- locations: tenant-scoped for authenticated
CREATE POLICY "Tenant-scoped read locations" ON public.locations FOR SELECT TO authenticated
USING (tenant_id = get_tenant_id_for_user(auth.uid()));

CREATE POLICY "Tenant-scoped owner insert locations" ON public.locations FOR INSERT TO authenticated
WITH CHECK (get_employee_role(auth.uid()) = 'owner' AND tenant_id = get_tenant_id_for_user(auth.uid()));

CREATE POLICY "Tenant-scoped owner update locations" ON public.locations FOR UPDATE TO authenticated
USING (get_employee_role(auth.uid()) = 'owner' AND tenant_id = get_tenant_id_for_user(auth.uid()));

CREATE POLICY "Tenant-scoped owner delete locations" ON public.locations FOR DELETE TO authenticated
USING (get_employee_role(auth.uid()) = 'owner' AND tenant_id = get_tenant_id_for_user(auth.uid()));
