
DO $$
DECLARE
  v_tenant uuid;
  v_loc_ids uuid[];
BEGIN
  SELECT id INTO v_tenant FROM public.tenants WHERE slug = 'saakouk';
  IF v_tenant IS NULL THEN RETURN; END IF;

  SELECT array_agg(id) INTO v_loc_ids FROM public.locations WHERE tenant_id = v_tenant;

  -- Remove platform admin entry for saakouk owner
  DELETE FROM public.platform_admins WHERE user_id = '659db922-a662-4293-9418-85067088cf83';

  IF v_loc_ids IS NOT NULL THEN
    DELETE FROM public.business_daily_facts        WHERE location_id = ANY(v_loc_ids);
    DELETE FROM public.business_hourly_facts       WHERE location_id = ANY(v_loc_ids);
    DELETE FROM public.weather_daily_observations  WHERE location_id = ANY(v_loc_ids);
    DELETE FROM public.weather_hourly_observations WHERE location_id = ANY(v_loc_ids);
    DELETE FROM public.weather_business_correlations WHERE location_id = ANY(v_loc_ids);
    DELETE FROM public.forecast_learning_metrics   WHERE location_id = ANY(v_loc_ids);
    DELETE FROM public.product_costs               WHERE location_id = ANY(v_loc_ids);
    DELETE FROM public.product_recipes             WHERE location_id = ANY(v_loc_ids);
    DELETE FROM public.margin_targets              WHERE location_id = ANY(v_loc_ids);
    DELETE FROM public.product_modifier_groups     WHERE location_id = ANY(v_loc_ids);
    DELETE FROM public.modifier_groups             WHERE location_id = ANY(v_loc_ids);
    DELETE FROM public.upsell_rules                WHERE location_id = ANY(v_loc_ids);
    DELETE FROM public.stock_movements             WHERE location_id = ANY(v_loc_ids);
    DELETE FROM public.stock_intakes               WHERE location_id = ANY(v_loc_ids);
    DELETE FROM public.stock_counts                WHERE location_id = ANY(v_loc_ids);
    DELETE FROM public.inventory_items             WHERE location_id = ANY(v_loc_ids);
    DELETE FROM public.cash_audit_notes            WHERE location_id = ANY(v_loc_ids);
    DELETE FROM public.cash_closings               WHERE location_id = ANY(v_loc_ids);
    DELETE FROM public.qr_orders                   WHERE location_id = ANY(v_loc_ids);
    DELETE FROM public.pos_transactions            WHERE location_id = ANY(v_loc_ids);
    DELETE FROM public.login_audit_logs            WHERE location_id = ANY(v_loc_ids);
    DELETE FROM public.employees                   WHERE location_id = ANY(v_loc_ids);
  END IF;

  -- Now delete the tenant — remaining children (locations, products, customers, subscriptions, etc.) cascade.
  DELETE FROM public.tenants WHERE id = v_tenant;

  -- Free up the saakouk owner auth account so the email can be reused.
  DELETE FROM auth.users WHERE id = '659db922-a662-4293-9418-85067088cf83';
END $$;
