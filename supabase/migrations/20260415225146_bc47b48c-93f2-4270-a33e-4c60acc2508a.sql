
-- ============================================
-- LOCK DOWN INTERNAL TABLES: authenticated only
-- ============================================

-- business_daily_facts
DROP POLICY IF EXISTS "Public insert business_daily" ON public.business_daily_facts;
DROP POLICY IF EXISTS "Public read business_daily" ON public.business_daily_facts;
DROP POLICY IF EXISTS "Public update business_daily" ON public.business_daily_facts;

CREATE POLICY "Authenticated read business_daily" ON public.business_daily_facts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert business_daily" ON public.business_daily_facts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update business_daily" ON public.business_daily_facts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- business_hourly_facts
DROP POLICY IF EXISTS "Public insert business_hourly" ON public.business_hourly_facts;
DROP POLICY IF EXISTS "Public read business_hourly" ON public.business_hourly_facts;
DROP POLICY IF EXISTS "Public update business_hourly" ON public.business_hourly_facts;

CREATE POLICY "Authenticated read business_hourly" ON public.business_hourly_facts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert business_hourly" ON public.business_hourly_facts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update business_hourly" ON public.business_hourly_facts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- cash_audit_notes
DROP POLICY IF EXISTS "Anyone can insert audit notes" ON public.cash_audit_notes;
DROP POLICY IF EXISTS "Anyone can read audit notes" ON public.cash_audit_notes;

CREATE POLICY "Authenticated read audit notes" ON public.cash_audit_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert audit notes" ON public.cash_audit_notes FOR INSERT TO authenticated WITH CHECK (true);

-- cash_closings
DROP POLICY IF EXISTS "Anyone can insert cash closings" ON public.cash_closings;
DROP POLICY IF EXISTS "Anyone can read cash closings" ON public.cash_closings;
DROP POLICY IF EXISTS "Anyone can update cash closings" ON public.cash_closings;

CREATE POLICY "Authenticated read cash closings" ON public.cash_closings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert cash closings" ON public.cash_closings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update cash closings" ON public.cash_closings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- forecast_learning_metrics
DROP POLICY IF EXISTS "Public insert forecast_learning" ON public.forecast_learning_metrics;
DROP POLICY IF EXISTS "Public read forecast_learning" ON public.forecast_learning_metrics;
DROP POLICY IF EXISTS "Public update forecast_learning" ON public.forecast_learning_metrics;

CREATE POLICY "Authenticated read forecast_learning" ON public.forecast_learning_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert forecast_learning" ON public.forecast_learning_metrics FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update forecast_learning" ON public.forecast_learning_metrics FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- inventory_items
DROP POLICY IF EXISTS "Public delete inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Public insert inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Public read inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Public update inventory" ON public.inventory_items;

CREATE POLICY "Authenticated read inventory" ON public.inventory_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert inventory" ON public.inventory_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update inventory" ON public.inventory_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete inventory" ON public.inventory_items FOR DELETE TO authenticated USING (true);

-- margin_targets
DROP POLICY IF EXISTS "Public insert margin targets" ON public.margin_targets;
DROP POLICY IF EXISTS "Public read margin targets" ON public.margin_targets;
DROP POLICY IF EXISTS "Public update margin targets" ON public.margin_targets;

CREATE POLICY "Authenticated read margin targets" ON public.margin_targets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert margin targets" ON public.margin_targets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update margin targets" ON public.margin_targets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- product_costs
DROP POLICY IF EXISTS "Allow public read" ON public.product_costs;

CREATE POLICY "Authenticated read product_costs" ON public.product_costs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert product_costs" ON public.product_costs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update product_costs" ON public.product_costs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- product_recipes
DROP POLICY IF EXISTS "Public delete recipes" ON public.product_recipes;
DROP POLICY IF EXISTS "Public insert recipes" ON public.product_recipes;
DROP POLICY IF EXISTS "Public read recipes" ON public.product_recipes;
DROP POLICY IF EXISTS "Public update recipes" ON public.product_recipes;

CREATE POLICY "Authenticated read recipes" ON public.product_recipes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert recipes" ON public.product_recipes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update recipes" ON public.product_recipes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete recipes" ON public.product_recipes FOR DELETE TO authenticated USING (true);

-- stock_counts
DROP POLICY IF EXISTS "Public insert counts" ON public.stock_counts;
DROP POLICY IF EXISTS "Public read counts" ON public.stock_counts;

CREATE POLICY "Authenticated read counts" ON public.stock_counts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert counts" ON public.stock_counts FOR INSERT TO authenticated WITH CHECK (true);

-- stock_intakes
DROP POLICY IF EXISTS "Public insert intakes" ON public.stock_intakes;
DROP POLICY IF EXISTS "Public read intakes" ON public.stock_intakes;

CREATE POLICY "Authenticated read intakes" ON public.stock_intakes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert intakes" ON public.stock_intakes FOR INSERT TO authenticated WITH CHECK (true);

-- stock_movements
DROP POLICY IF EXISTS "Public insert movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Public read movements" ON public.stock_movements;

CREATE POLICY "Authenticated read movements" ON public.stock_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert movements" ON public.stock_movements FOR INSERT TO authenticated WITH CHECK (true);

-- weather_business_correlations
DROP POLICY IF EXISTS "Public insert correlations" ON public.weather_business_correlations;
DROP POLICY IF EXISTS "Public read correlations" ON public.weather_business_correlations;
DROP POLICY IF EXISTS "Public update correlations" ON public.weather_business_correlations;

CREATE POLICY "Authenticated read correlations" ON public.weather_business_correlations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert correlations" ON public.weather_business_correlations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update correlations" ON public.weather_business_correlations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- weather_daily_observations
DROP POLICY IF EXISTS "Public insert weather_daily" ON public.weather_daily_observations;
DROP POLICY IF EXISTS "Public read weather_daily" ON public.weather_daily_observations;
DROP POLICY IF EXISTS "Public update weather_daily" ON public.weather_daily_observations;

CREATE POLICY "Authenticated read weather_daily" ON public.weather_daily_observations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert weather_daily" ON public.weather_daily_observations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update weather_daily" ON public.weather_daily_observations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- weather_hourly_observations
DROP POLICY IF EXISTS "Public insert weather_hourly" ON public.weather_hourly_observations;
DROP POLICY IF EXISTS "Public read weather_hourly" ON public.weather_hourly_observations;
DROP POLICY IF EXISTS "Public update weather_hourly" ON public.weather_hourly_observations;

CREATE POLICY "Authenticated read weather_hourly" ON public.weather_hourly_observations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert weather_hourly" ON public.weather_hourly_observations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update weather_hourly" ON public.weather_hourly_observations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- QR_ORDERS & POS_TRANSACTIONS: keep anon access (intentional)
-- ============================================
-- No changes needed — these already correctly allow anon+authenticated
