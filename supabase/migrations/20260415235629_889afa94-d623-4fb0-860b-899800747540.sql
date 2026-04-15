
-- Helper expression used in all policies:
-- Owner sees all, others see only their location
-- get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid())

-- ============================================================
-- INVENTORY_ITEMS
-- ============================================================
DROP POLICY IF EXISTS "Authenticated read inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Authenticated insert inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Authenticated update inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Authenticated delete inventory" ON public.inventory_items;

CREATE POLICY "Location-scoped read inventory" ON public.inventory_items FOR SELECT TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped insert inventory" ON public.inventory_items FOR INSERT TO authenticated
  WITH CHECK (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped update inventory" ON public.inventory_items FOR UPDATE TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped delete inventory" ON public.inventory_items FOR DELETE TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));

-- ============================================================
-- STOCK_MOVEMENTS
-- ============================================================
DROP POLICY IF EXISTS "Authenticated read movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Authenticated insert movements" ON public.stock_movements;

CREATE POLICY "Location-scoped read movements" ON public.stock_movements FOR SELECT TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped insert movements" ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));

-- ============================================================
-- STOCK_INTAKES
-- ============================================================
DROP POLICY IF EXISTS "Authenticated read intakes" ON public.stock_intakes;
DROP POLICY IF EXISTS "Authenticated insert intakes" ON public.stock_intakes;

CREATE POLICY "Location-scoped read intakes" ON public.stock_intakes FOR SELECT TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped insert intakes" ON public.stock_intakes FOR INSERT TO authenticated
  WITH CHECK (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));

-- ============================================================
-- STOCK_COUNTS
-- ============================================================
DROP POLICY IF EXISTS "Authenticated read counts" ON public.stock_counts;
DROP POLICY IF EXISTS "Authenticated insert counts" ON public.stock_counts;

CREATE POLICY "Location-scoped read counts" ON public.stock_counts FOR SELECT TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped insert counts" ON public.stock_counts FOR INSERT TO authenticated
  WITH CHECK (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));

-- ============================================================
-- PRODUCT_RECIPES
-- ============================================================
DROP POLICY IF EXISTS "Authenticated read recipes" ON public.product_recipes;
DROP POLICY IF EXISTS "Authenticated insert recipes" ON public.product_recipes;
DROP POLICY IF EXISTS "Authenticated update recipes" ON public.product_recipes;
DROP POLICY IF EXISTS "Authenticated delete recipes" ON public.product_recipes;

CREATE POLICY "Location-scoped read recipes" ON public.product_recipes FOR SELECT TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped insert recipes" ON public.product_recipes FOR INSERT TO authenticated
  WITH CHECK (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped update recipes" ON public.product_recipes FOR UPDATE TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped delete recipes" ON public.product_recipes FOR DELETE TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));

-- ============================================================
-- PRODUCT_COSTS
-- ============================================================
DROP POLICY IF EXISTS "Authenticated read product_costs" ON public.product_costs;
DROP POLICY IF EXISTS "Authenticated insert product_costs" ON public.product_costs;
DROP POLICY IF EXISTS "Authenticated update product_costs" ON public.product_costs;

CREATE POLICY "Location-scoped read product_costs" ON public.product_costs FOR SELECT TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped insert product_costs" ON public.product_costs FOR INSERT TO authenticated
  WITH CHECK (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped update product_costs" ON public.product_costs FOR UPDATE TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));

-- ============================================================
-- PRODUCT_MODIFIER_GROUPS
-- ============================================================
DROP POLICY IF EXISTS "Authenticated read product_modifier_groups" ON public.product_modifier_groups;
DROP POLICY IF EXISTS "Authenticated insert product_modifier_groups" ON public.product_modifier_groups;
DROP POLICY IF EXISTS "Authenticated update product_modifier_groups" ON public.product_modifier_groups;
DROP POLICY IF EXISTS "Authenticated delete product_modifier_groups" ON public.product_modifier_groups;

CREATE POLICY "Location-scoped read pmg" ON public.product_modifier_groups FOR SELECT TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped insert pmg" ON public.product_modifier_groups FOR INSERT TO authenticated
  WITH CHECK (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped update pmg" ON public.product_modifier_groups FOR UPDATE TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped delete pmg" ON public.product_modifier_groups FOR DELETE TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));

-- ============================================================
-- MODIFIER_GROUPS
-- ============================================================
DROP POLICY IF EXISTS "Authenticated read modifier_groups" ON public.modifier_groups;
DROP POLICY IF EXISTS "Authenticated insert modifier_groups" ON public.modifier_groups;
DROP POLICY IF EXISTS "Authenticated update modifier_groups" ON public.modifier_groups;
DROP POLICY IF EXISTS "Authenticated delete modifier_groups" ON public.modifier_groups;

CREATE POLICY "Location-scoped read modifier_groups" ON public.modifier_groups FOR SELECT TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped insert modifier_groups" ON public.modifier_groups FOR INSERT TO authenticated
  WITH CHECK (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped update modifier_groups" ON public.modifier_groups FOR UPDATE TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped delete modifier_groups" ON public.modifier_groups FOR DELETE TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));

-- ============================================================
-- POS_TRANSACTIONS (keep anon access for QR flow)
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read transactions" ON public.pos_transactions;
DROP POLICY IF EXISTS "Anyone can insert transactions" ON public.pos_transactions;
DROP POLICY IF EXISTS "Anyone can update transactions" ON public.pos_transactions;

CREATE POLICY "Anon insert transactions" ON public.pos_transactions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon read transactions" ON public.pos_transactions FOR SELECT TO anon USING (true);
CREATE POLICY "Location-scoped read transactions" ON public.pos_transactions FOR SELECT TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped insert transactions" ON public.pos_transactions FOR INSERT TO authenticated
  WITH CHECK (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped update transactions" ON public.pos_transactions FOR UPDATE TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));

-- ============================================================
-- QR_ORDERS (keep anon access)
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read QR orders" ON public.qr_orders;
DROP POLICY IF EXISTS "Anyone can insert QR orders" ON public.qr_orders;
DROP POLICY IF EXISTS "Anyone can update QR orders" ON public.qr_orders;

CREATE POLICY "Anon insert qr_orders" ON public.qr_orders FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon read qr_orders" ON public.qr_orders FOR SELECT TO anon USING (true);
CREATE POLICY "Location-scoped read qr_orders" ON public.qr_orders FOR SELECT TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped insert qr_orders" ON public.qr_orders FOR INSERT TO authenticated
  WITH CHECK (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped update qr_orders" ON public.qr_orders FOR UPDATE TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));

-- ============================================================
-- CASH_CLOSINGS
-- ============================================================
DROP POLICY IF EXISTS "Authenticated read cash closings" ON public.cash_closings;
DROP POLICY IF EXISTS "Authenticated insert cash closings" ON public.cash_closings;
DROP POLICY IF EXISTS "Authenticated update cash closings" ON public.cash_closings;

CREATE POLICY "Location-scoped read cash_closings" ON public.cash_closings FOR SELECT TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped insert cash_closings" ON public.cash_closings FOR INSERT TO authenticated
  WITH CHECK (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped update cash_closings" ON public.cash_closings FOR UPDATE TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));

-- ============================================================
-- CASH_AUDIT_NOTES
-- ============================================================
DROP POLICY IF EXISTS "Authenticated read audit notes" ON public.cash_audit_notes;
DROP POLICY IF EXISTS "Authenticated insert audit notes" ON public.cash_audit_notes;

CREATE POLICY "Location-scoped read audit_notes" ON public.cash_audit_notes FOR SELECT TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped insert audit_notes" ON public.cash_audit_notes FOR INSERT TO authenticated
  WITH CHECK (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));

-- ============================================================
-- BUSINESS_DAILY_FACTS
-- ============================================================
DROP POLICY IF EXISTS "Authenticated read business_daily" ON public.business_daily_facts;
DROP POLICY IF EXISTS "Authenticated insert business_daily" ON public.business_daily_facts;
DROP POLICY IF EXISTS "Authenticated update business_daily" ON public.business_daily_facts;

CREATE POLICY "Location-scoped read business_daily" ON public.business_daily_facts FOR SELECT TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped insert business_daily" ON public.business_daily_facts FOR INSERT TO authenticated
  WITH CHECK (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped update business_daily" ON public.business_daily_facts FOR UPDATE TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));

-- ============================================================
-- BUSINESS_HOURLY_FACTS
-- ============================================================
DROP POLICY IF EXISTS "Authenticated read business_hourly" ON public.business_hourly_facts;
DROP POLICY IF EXISTS "Authenticated insert business_hourly" ON public.business_hourly_facts;
DROP POLICY IF EXISTS "Authenticated update business_hourly" ON public.business_hourly_facts;

CREATE POLICY "Location-scoped read business_hourly" ON public.business_hourly_facts FOR SELECT TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped insert business_hourly" ON public.business_hourly_facts FOR INSERT TO authenticated
  WITH CHECK (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped update business_hourly" ON public.business_hourly_facts FOR UPDATE TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));

-- ============================================================
-- FORECAST_LEARNING_METRICS
-- ============================================================
DROP POLICY IF EXISTS "Authenticated read forecast_learning" ON public.forecast_learning_metrics;
DROP POLICY IF EXISTS "Authenticated insert forecast_learning" ON public.forecast_learning_metrics;
DROP POLICY IF EXISTS "Authenticated update forecast_learning" ON public.forecast_learning_metrics;

CREATE POLICY "Location-scoped read forecast" ON public.forecast_learning_metrics FOR SELECT TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped insert forecast" ON public.forecast_learning_metrics FOR INSERT TO authenticated
  WITH CHECK (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped update forecast" ON public.forecast_learning_metrics FOR UPDATE TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));

-- ============================================================
-- WEATHER_DAILY_OBSERVATIONS
-- ============================================================
DROP POLICY IF EXISTS "Authenticated read weather_daily" ON public.weather_daily_observations;
DROP POLICY IF EXISTS "Authenticated insert weather_daily" ON public.weather_daily_observations;
DROP POLICY IF EXISTS "Authenticated update weather_daily" ON public.weather_daily_observations;

CREATE POLICY "Location-scoped read weather_daily" ON public.weather_daily_observations FOR SELECT TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped insert weather_daily" ON public.weather_daily_observations FOR INSERT TO authenticated
  WITH CHECK (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped update weather_daily" ON public.weather_daily_observations FOR UPDATE TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));

-- ============================================================
-- WEATHER_HOURLY_OBSERVATIONS
-- ============================================================
DROP POLICY IF EXISTS "Authenticated read weather_hourly" ON public.weather_hourly_observations;
DROP POLICY IF EXISTS "Authenticated insert weather_hourly" ON public.weather_hourly_observations;
DROP POLICY IF EXISTS "Authenticated update weather_hourly" ON public.weather_hourly_observations;

CREATE POLICY "Location-scoped read weather_hourly" ON public.weather_hourly_observations FOR SELECT TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped insert weather_hourly" ON public.weather_hourly_observations FOR INSERT TO authenticated
  WITH CHECK (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped update weather_hourly" ON public.weather_hourly_observations FOR UPDATE TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));

-- ============================================================
-- WEATHER_BUSINESS_CORRELATIONS
-- ============================================================
DROP POLICY IF EXISTS "Authenticated read correlations" ON public.weather_business_correlations;
DROP POLICY IF EXISTS "Authenticated insert correlations" ON public.weather_business_correlations;
DROP POLICY IF EXISTS "Authenticated update correlations" ON public.weather_business_correlations;

CREATE POLICY "Location-scoped read correlations" ON public.weather_business_correlations FOR SELECT TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped insert correlations" ON public.weather_business_correlations FOR INSERT TO authenticated
  WITH CHECK (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped update correlations" ON public.weather_business_correlations FOR UPDATE TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));

-- ============================================================
-- MARGIN_TARGETS
-- ============================================================
DROP POLICY IF EXISTS "Authenticated read margin targets" ON public.margin_targets;
DROP POLICY IF EXISTS "Authenticated insert margin targets" ON public.margin_targets;
DROP POLICY IF EXISTS "Authenticated update margin targets" ON public.margin_targets;

CREATE POLICY "Location-scoped read margin_targets" ON public.margin_targets FOR SELECT TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped insert margin_targets" ON public.margin_targets FOR INSERT TO authenticated
  WITH CHECK (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped update margin_targets" ON public.margin_targets FOR UPDATE TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));

-- ============================================================
-- UPSELL_RULES (keep anon read for QR menu)
-- ============================================================
DROP POLICY IF EXISTS "Anon read upsell_rules" ON public.upsell_rules;
DROP POLICY IF EXISTS "Authenticated read upsell_rules" ON public.upsell_rules;
DROP POLICY IF EXISTS "Authenticated insert upsell_rules" ON public.upsell_rules;
DROP POLICY IF EXISTS "Authenticated update upsell_rules" ON public.upsell_rules;
DROP POLICY IF EXISTS "Authenticated delete upsell_rules" ON public.upsell_rules;

CREATE POLICY "Anon read upsell_rules" ON public.upsell_rules FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "Location-scoped read upsell_rules" ON public.upsell_rules FOR SELECT TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped insert upsell_rules" ON public.upsell_rules FOR INSERT TO authenticated
  WITH CHECK (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped update upsell_rules" ON public.upsell_rules FOR UPDATE TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
CREATE POLICY "Location-scoped delete upsell_rules" ON public.upsell_rules FOR DELETE TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));

-- ============================================================
-- EMPLOYEES (location-scoped: staff sees own location, owner sees all)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read employees" ON public.employees;

CREATE POLICY "Location-scoped read employees" ON public.employees FOR SELECT TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));

-- ============================================================
-- LOGIN_AUDIT_LOGS (location-scoped for owners, already restricted)
-- ============================================================
DROP POLICY IF EXISTS "Owners can read audit logs" ON public.login_audit_logs;

CREATE POLICY "Owner read audit_logs" ON public.login_audit_logs FOR SELECT TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner');
CREATE POLICY "Location-scoped insert audit_logs" ON public.login_audit_logs FOR INSERT TO authenticated
  WITH CHECK (get_employee_role(auth.uid()) = 'owner' OR location_id = get_employee_location_id(auth.uid()));
