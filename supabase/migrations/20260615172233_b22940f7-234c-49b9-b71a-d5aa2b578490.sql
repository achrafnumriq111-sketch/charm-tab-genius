
-- TIERS
CREATE TABLE public.loyalty_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#7cb342',
  min_total_spent numeric NOT NULL DEFAULT 0,
  min_visit_count integer NOT NULL DEFAULT 0,
  point_multiplier numeric NOT NULL DEFAULT 1.0,
  perks text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_tiers TO authenticated;
GRANT ALL ON public.loyalty_tiers TO service_role;
ALTER TABLE public.loyalty_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant read loyalty_tiers" ON public.loyalty_tiers FOR SELECT TO authenticated
  USING (tenant_id = get_tenant_id_for_user(auth.uid()) OR is_platform_admin(auth.uid()));
CREATE POLICY "owner manage loyalty_tiers" ON public.loyalty_tiers FOR ALL TO authenticated
  USING (tenant_id = get_tenant_id_for_user(auth.uid()) AND get_employee_role(auth.uid()) = 'owner'::employee_role)
  WITH CHECK (tenant_id = get_tenant_id_for_user(auth.uid()) AND get_employee_role(auth.uid()) = 'owner'::employee_role);
CREATE TRIGGER loyalty_tiers_updated_at BEFORE UPDATE ON public.loyalty_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SEGMENTS
CREATE TABLE public.customer_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  -- definition example: {"min_total_spent":50,"min_visits":3,"days_since_last_visit_max":30,"marketing_opt_in":true,"tier_id":"<uuid>"}
  definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_segments TO authenticated;
GRANT ALL ON public.customer_segments TO service_role;
ALTER TABLE public.customer_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant read segments" ON public.customer_segments FOR SELECT TO authenticated
  USING (tenant_id = get_tenant_id_for_user(auth.uid()) OR is_platform_admin(auth.uid()));
CREATE POLICY "owner manage segments" ON public.customer_segments FOR ALL TO authenticated
  USING (tenant_id = get_tenant_id_for_user(auth.uid()) AND get_employee_role(auth.uid()) = 'owner'::employee_role)
  WITH CHECK (tenant_id = get_tenant_id_for_user(auth.uid()) AND get_employee_role(auth.uid()) = 'owner'::employee_role);
CREATE TRIGGER customer_segments_updated_at BEFORE UPDATE ON public.customer_segments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CAMPAIGNS
CREATE TABLE public.loyalty_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  segment_id uuid REFERENCES public.customer_segments(id) ON DELETE SET NULL,
  name text NOT NULL,
  channel text NOT NULL DEFAULT 'push', -- push | email | passkit
  subject text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'draft', -- draft | scheduled | sending | sent | cancelled
  scheduled_at timestamptz,
  sent_at timestamptz,
  recipients_count integer NOT NULL DEFAULT 0,
  delivered_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_campaigns TO authenticated;
GRANT ALL ON public.loyalty_campaigns TO service_role;
ALTER TABLE public.loyalty_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant read campaigns" ON public.loyalty_campaigns FOR SELECT TO authenticated
  USING (tenant_id = get_tenant_id_for_user(auth.uid()) OR is_platform_admin(auth.uid()));
CREATE POLICY "owner manage campaigns" ON public.loyalty_campaigns FOR ALL TO authenticated
  USING (tenant_id = get_tenant_id_for_user(auth.uid()) AND get_employee_role(auth.uid()) = 'owner'::employee_role)
  WITH CHECK (tenant_id = get_tenant_id_for_user(auth.uid()) AND get_employee_role(auth.uid()) = 'owner'::employee_role);
CREATE TRIGGER loyalty_campaigns_updated_at BEFORE UPDATE ON public.loyalty_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- HELPERS
CREATE OR REPLACE FUNCTION public.customer_current_tier(_customer_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.id
  FROM public.customers c
  JOIN public.loyalty_tiers t ON t.tenant_id = c.tenant_id AND t.is_active = true
  WHERE c.id = _customer_id
    AND c.total_spent >= t.min_total_spent
    AND c.visit_count >= t.min_visit_count
  ORDER BY t.min_total_spent DESC, t.min_visit_count DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.segment_match_query(_tenant_id uuid, _definition jsonb)
RETURNS TABLE(customer_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _min_spent numeric := COALESCE((_definition->>'min_total_spent')::numeric, 0);
  _min_visits int := COALESCE((_definition->>'min_visits')::int, 0);
  _days_max int := COALESCE((_definition->>'days_since_last_visit_max')::int, NULL);
  _opt_in boolean := COALESCE((_definition->>'marketing_opt_in')::boolean, NULL);
  _tier_id uuid := NULLIF(_definition->>'tier_id','')::uuid;
BEGIN
  RETURN QUERY
  SELECT c.id
  FROM public.customers c
  WHERE c.tenant_id = _tenant_id
    AND c.total_spent >= _min_spent
    AND c.visit_count >= _min_visits
    AND (_days_max IS NULL OR c.last_seen_at >= now() - make_interval(days => _days_max))
    AND (_opt_in IS NULL OR c.marketing_opt_in = _opt_in)
    AND (_tier_id IS NULL OR public.customer_current_tier(c.id) = _tier_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.segment_preview(_segment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _tenant uuid;
  _def jsonb;
  _count int;
  _sample jsonb;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT tenant_id, definition INTO _tenant, _def FROM public.customer_segments WHERE id = _segment_id;
  IF _tenant IS NULL THEN RAISE EXCEPTION 'Segment not found'; END IF;
  IF _tenant <> get_tenant_id_for_user(_user) AND NOT is_platform_admin(_user) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT COUNT(*)::int INTO _count FROM public.segment_match_query(_tenant, _def);

  SELECT jsonb_agg(jsonb_build_object('id', c.id, 'full_name', c.full_name, 'total_spent', c.total_spent, 'visit_count', c.visit_count))
  INTO _sample
  FROM (
    SELECT c.* FROM public.customers c
    WHERE c.id IN (SELECT customer_id FROM public.segment_match_query(_tenant, _def))
    ORDER BY c.total_spent DESC
    LIMIT 10
  ) c;

  RETURN jsonb_build_object('count', _count, 'sample', COALESCE(_sample, '[]'::jsonb));
END;
$$;
