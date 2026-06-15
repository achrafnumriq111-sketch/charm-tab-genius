
CREATE OR REPLACE FUNCTION public.qa_structural_isolation_checks()
RETURNS TABLE(check_name text, status text, details jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  -- Tables that legitimately do not need RLS (cross-tenant lookup, queue, public reads).
  _rls_allowlist text[] := ARRAY['email_send_state'];
  -- Tables that intentionally expose at least one public/anon row (QR, signup helpers, etc.).
  _wide_policy_allowlist text[] := ARRAY['qr_orders','customers','device_pairing_codes','employee_invites','platform_admins'];
  r record;
  missing_rls text[];
  wide_open jsonb := '[]'::jsonb;
  missing_helpers text[] := ARRAY[]::text[];
  helper text;
BEGIN
  -- Restrict to platform admins (or service role bypass via direct DB call).
  IF _user IS NOT NULL AND NOT public.is_platform_admin(_user) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- ---------- 1. RLS enabled on every public table ----------
  SELECT array_agg(c.relname ORDER BY c.relname)
  INTO missing_rls
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relrowsecurity = false
    AND NOT (c.relname = ANY(_rls_allowlist));

  RETURN QUERY SELECT
    'rls_enabled_all_public_tables'::text,
    CASE WHEN missing_rls IS NULL THEN 'pass' ELSE 'fail' END,
    jsonb_build_object('tables_without_rls', COALESCE(to_jsonb(missing_rls), '[]'::jsonb));

  -- ---------- 2. No wide-open (USING true) policies for authenticated role ----------
  FOR r IN
    SELECT p.schemaname, p.tablename, p.policyname, p.qual, p.roles
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.qual ILIKE '%true%'
      AND (p.qual = 'true' OR p.qual ~ '^\(true\)$')
      AND NOT ('service_role' = ANY(p.roles))
      AND NOT (p.tablename = ANY(_wide_policy_allowlist))
  LOOP
    wide_open := wide_open || jsonb_build_object(
      'table', r.tablename, 'policy', r.policyname, 'roles', r.roles
    );
  END LOOP;

  RETURN QUERY SELECT
    'no_wide_open_policies'::text,
    CASE WHEN jsonb_array_length(wide_open) = 0 THEN 'pass' ELSE 'fail' END,
    jsonb_build_object('offending_policies', wide_open);

  -- ---------- 3. Required SECURITY DEFINER helper functions present ----------
  FOREACH helper IN ARRAY ARRAY[
    'get_employee_location_id', 'get_employee_role', 'location_in_user_tenant',
    'get_tenant_id_for_user', 'is_platform_admin', 'sync_tenant_id_from_location'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = helper AND p.prosecdef = true
    ) THEN
      missing_helpers := missing_helpers || helper;
    END IF;
  END LOOP;

  RETURN QUERY SELECT
    'security_definer_helpers_present'::text,
    CASE WHEN array_length(missing_helpers, 1) IS NULL THEN 'pass' ELSE 'fail' END,
    jsonb_build_object('missing', COALESCE(to_jsonb(missing_helpers), '[]'::jsonb));

  -- ---------- 4. Per-tenant unique employee username (no global collisions) ----------
  RETURN QUERY SELECT
    'employees_per_tenant_unique_username'::text,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'employees'
        AND indexdef ILIKE '%username_normalized%'
        AND (indexdef ILIKE '%tenant_id%' OR indexdef ILIKE '%location_id%')
        AND indexdef ILIKE '%UNIQUE%'
    ) THEN 'pass' ELSE 'fail' END,
    '{}'::jsonb;

  -- ---------- 5. Hot tables carry denormalized tenant_id ----------
  RETURN QUERY
  WITH expected(tbl) AS (VALUES
    ('pos_transactions'),('products'),('inventory_items'),('customers'),
    ('qr_orders'),('cash_closings'),('stock_movements'),('marketplace_orders'),
    ('loyalty_campaigns'),('customer_segments'),('loyalty_tiers')
  ),
  missing AS (
    SELECT e.tbl
    FROM expected e
    LEFT JOIN information_schema.columns c
      ON c.table_schema='public' AND c.table_name=e.tbl AND c.column_name='tenant_id'
    WHERE c.column_name IS NULL
  )
  SELECT
    'hot_tables_have_tenant_id'::text,
    CASE WHEN (SELECT count(*) FROM missing) = 0 THEN 'pass' ELSE 'fail' END,
    jsonb_build_object('missing', COALESCE((SELECT jsonb_agg(tbl) FROM missing), '[]'::jsonb));

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.qa_structural_isolation_checks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qa_structural_isolation_checks() TO authenticated, service_role;
