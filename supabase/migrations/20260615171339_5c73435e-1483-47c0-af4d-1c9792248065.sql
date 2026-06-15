-- Extend setup_tenant_onboarding to also create a 14-day trialing subscription
CREATE OR REPLACE FUNCTION public.setup_tenant_onboarding(
  _tenant_name text,
  _slug text,
  _owner_name text,
  _city text DEFAULT ''::text,
  _address text DEFAULT ''::text,
  _timezone text DEFAULT 'Europe/Amsterdam'::text,
  _currency text DEFAULT 'EUR'::text,
  _plan_type text DEFAULT 'trial'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _tenant_id uuid;
  _location_id uuid;
  _employee_id uuid;
  _subscription_id uuid;
  _plan subscription_plan;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM public.tenants WHERE slug = _slug) THEN
    RAISE EXCEPTION 'Slug already taken';
  END IF;

  -- Validate plan
  BEGIN
    _plan := _plan_type::subscription_plan;
  EXCEPTION WHEN OTHERS THEN
    _plan := 'trial'::subscription_plan;
  END;

  INSERT INTO public.tenants (name, slug, owner_user_id)
  VALUES (_tenant_name, _slug, _user_id)
  RETURNING id INTO _tenant_id;

  INSERT INTO public.locations (name, city, address, timezone, currency, tenant_id)
  VALUES (_tenant_name, _city, _address, _timezone, _currency, _tenant_id)
  RETURNING id INTO _location_id;

  INSERT INTO public.employees (full_name, username_normalized, role, user_id, location_id, is_active)
  VALUES (_owner_name, lower(replace(_owner_name, ' ', '')), 'owner', _user_id, _location_id, true)
  RETURNING id INTO _employee_id;

  -- Create 14-day trialing subscription
  INSERT INTO public.subscriptions (
    location_id, tenant_id, plan_type, status, price_cents, currency,
    trial_ends_at, current_period_start, current_period_end, environment
  ) VALUES (
    _location_id, _tenant_id, _plan, 'trialing', 0, _currency,
    now() + interval '14 days', now(), now() + interval '14 days', 'sandbox'
  ) RETURNING id INTO _subscription_id;

  RETURN jsonb_build_object(
    'tenant_id', _tenant_id,
    'location_id', _location_id,
    'employee_id', _employee_id,
    'subscription_id', _subscription_id,
    'slug', _slug,
    'trial_ends_at', (now() + interval '14 days')
  );
END;
$function$;

-- Demo data seeding function: adds sample products + floor plan to a fresh location
CREATE OR REPLACE FUNCTION public.seed_demo_data(_location_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _tenant_id uuid;
  _zone_id uuid;
  _products_count int := 0;
  _tables_count int := 0;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify ownership
  IF NOT public.location_in_user_tenant(_location_id, _user_id) THEN
    RAISE EXCEPTION 'Location not in user tenant';
  END IF;

  SELECT tenant_id INTO _tenant_id FROM public.locations WHERE id = _location_id;

  -- Skip if already seeded (has products)
  IF EXISTS (SELECT 1 FROM public.products WHERE location_id = _location_id) THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'location already has products');
  END IF;

  -- Demo products (matcha-themed defaults)
  INSERT INTO public.products (name, category, price_cents, location_id, tenant_id, is_active, vat_category)
  VALUES
    ('Matcha Latte', 'Drinks', 525, _location_id, _tenant_id, true, 'food_drinks'),
    ('Iced Matcha', 'Drinks', 575, _location_id, _tenant_id, true, 'food_drinks'),
    ('Hojicha Latte', 'Drinks', 550, _location_id, _tenant_id, true, 'food_drinks'),
    ('Espresso', 'Drinks', 350, _location_id, _tenant_id, true, 'food_drinks'),
    ('Cappuccino', 'Drinks', 425, _location_id, _tenant_id, true, 'food_drinks'),
    ('Matcha Cookie', 'Food', 395, _location_id, _tenant_id, true, 'food_drinks'),
    ('Mochi (3 stuks)', 'Food', 650, _location_id, _tenant_id, true, 'food_drinks'),
    ('Avocado Toast', 'Food', 895, _location_id, _tenant_id, true, 'food_drinks'),
    ('Matcha Powder 30g', 'Retail', 1495, _location_id, _tenant_id, true, 'retail_other'),
    ('Bamboo Whisk', 'Retail', 1995, _location_id, _tenant_id, true, 'retail_other');

  GET DIAGNOSTICS _products_count = ROW_COUNT;

  -- Demo floor plan: 1 zone + 6 tables
  INSERT INTO public.floor_zones (name, location_id, tenant_id, display_order)
  VALUES ('Hoofdzaak', _location_id, _tenant_id, 1)
  RETURNING id INTO _zone_id;

  INSERT INTO public.floor_tables (table_number, zone_id, location_id, tenant_id, seats, x_position, y_position, shape)
  VALUES
    ('T1', _zone_id, _location_id, _tenant_id, 2, 100, 100, 'round'),
    ('T2', _zone_id, _location_id, _tenant_id, 2, 250, 100, 'round'),
    ('T3', _zone_id, _location_id, _tenant_id, 4, 400, 100, 'square'),
    ('T4', _zone_id, _location_id, _tenant_id, 4, 100, 280, 'square'),
    ('T5', _zone_id, _location_id, _tenant_id, 6, 280, 280, 'rectangle'),
    ('T6', _zone_id, _location_id, _tenant_id, 2, 500, 280, 'round');

  GET DIAGNOSTICS _tables_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'products_seeded', _products_count,
    'tables_seeded', _tables_count,
    'zone_id', _zone_id
  );
END;
$function$;