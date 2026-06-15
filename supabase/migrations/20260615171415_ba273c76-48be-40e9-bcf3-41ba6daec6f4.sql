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

  IF NOT public.location_in_user_tenant(_location_id, _user_id) THEN
    RAISE EXCEPTION 'Location not in user tenant';
  END IF;

  SELECT tenant_id INTO _tenant_id FROM public.locations WHERE id = _location_id;

  IF EXISTS (SELECT 1 FROM public.products WHERE location_id = _location_id) THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'location already has products');
  END IF;

  INSERT INTO public.products (name, section, price, vat_rate, location_id, is_active, sort_order, color)
  VALUES
    ('Matcha Latte', 'Hot Drinks', 5.25, 9, _location_id, true, 1, '#7cb342'),
    ('Iced Matcha', 'Cold Drinks', 5.75, 9, _location_id, true, 2, '#26c6da'),
    ('Hojicha Latte', 'Hot Drinks', 5.50, 9, _location_id, true, 3, '#a1887f'),
    ('Espresso', 'Hot Drinks', 3.50, 9, _location_id, true, 4, '#5d4037'),
    ('Cappuccino', 'Hot Drinks', 4.25, 9, _location_id, true, 5, '#8d6e63'),
    ('Matcha Cookie', 'Food', 3.95, 9, _location_id, true, 6, '#dce775'),
    ('Mochi (3 stuks)', 'Food', 6.50, 9, _location_id, true, 7, '#f48fb1'),
    ('Avocado Toast', 'Food', 8.95, 9, _location_id, true, 8, '#aed581'),
    ('Matcha Powder 30g', 'Retail', 14.95, 21, _location_id, true, 9, '#558b2f'),
    ('Bamboo Whisk', 'Retail', 19.95, 21, _location_id, true, 10, '#8d6e63');

  GET DIAGNOSTICS _products_count = ROW_COUNT;

  INSERT INTO public.floor_zones (name, location_id, sort_order)
  VALUES ('Hoofdzaak', _location_id, 1)
  RETURNING id INTO _zone_id;

  INSERT INTO public.floor_tables (name, zone_id, location_id, seats, x, y, w, h, shape)
  VALUES
    ('T1', _zone_id, _location_id, 2, 60, 60, 70, 70, 'round'),
    ('T2', _zone_id, _location_id, 2, 160, 60, 70, 70, 'round'),
    ('T3', _zone_id, _location_id, 4, 260, 60, 90, 90, 'square'),
    ('T4', _zone_id, _location_id, 4, 60, 180, 90, 90, 'square'),
    ('T5', _zone_id, _location_id, 6, 180, 180, 140, 70, 'rectangle'),
    ('T6', _zone_id, _location_id, 2, 360, 180, 70, 70, 'round');

  GET DIAGNOSTICS _tables_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'products_seeded', _products_count,
    'tables_seeded', _tables_count,
    'zone_id', _zone_id
  );
END;
$function$;