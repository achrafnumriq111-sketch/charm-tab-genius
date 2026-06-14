
-- Severity enum
CREATE TYPE public.security_event_severity AS ENUM ('info', 'warning', 'critical');

-- Events table
CREATE TABLE public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL,
  severity public.security_event_severity NOT NULL DEFAULT 'warning',
  source text NOT NULL DEFAULT 'client',
  user_id uuid,
  tenant_id uuid,
  target_table text,
  target_resource text,
  error_code text,
  error_message text,
  request_path text,
  user_agent text,
  ip_address text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_security_events_occurred_at ON public.security_events (occurred_at DESC);
CREATE INDEX idx_security_events_type ON public.security_events (event_type);
CREATE INDEX idx_security_events_severity ON public.security_events (severity);
CREATE INDEX idx_security_events_tenant ON public.security_events (tenant_id);

GRANT SELECT ON public.security_events TO authenticated;
GRANT ALL ON public.security_events TO service_role;

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins read all security events"
  ON public.security_events
  FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Service role manages security events"
  ON public.security_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Alert config table
CREATE TABLE public.security_alert_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL DEFAULT 'global',
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  threshold_per_hour int NOT NULL DEFAULT 10,
  min_severity public.security_event_severity NOT NULL DEFAULT 'warning',
  notify_email text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  last_triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_alert_config TO authenticated;
GRANT ALL ON public.security_alert_config TO service_role;

ALTER TABLE public.security_alert_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins manage alert config"
  ON public.security_alert_config
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Service role manages alert config"
  ON public.security_alert_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_security_alert_config_updated_at
  BEFORE UPDATE ON public.security_alert_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Security definer function so client + edge functions can log without giving INSERT to all
CREATE OR REPLACE FUNCTION public.log_security_event(
  _event_type text,
  _severity public.security_event_severity DEFAULT 'warning',
  _source text DEFAULT 'client',
  _target_table text DEFAULT NULL,
  _target_resource text DEFAULT NULL,
  _error_code text DEFAULT NULL,
  _error_message text DEFAULT NULL,
  _request_path text DEFAULT NULL,
  _user_agent text DEFAULT NULL,
  _ip_address text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _user uuid := auth.uid();
  _tenant uuid;
BEGIN
  IF _user IS NOT NULL THEN
    _tenant := public.get_tenant_id_for_user(_user);
  END IF;

  INSERT INTO public.security_events (
    event_type, severity, source, user_id, tenant_id,
    target_table, target_resource, error_code, error_message,
    request_path, user_agent, ip_address, metadata
  ) VALUES (
    _event_type, _severity, _source, _user, _tenant,
    _target_table, _target_resource, _error_code, left(coalesce(_error_message, ''), 2000),
    _request_path, _user_agent, _ip_address, coalesce(_metadata, '{}'::jsonb)
  ) RETURNING id INTO _id;

  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_security_event(text, public.security_event_severity, text, text, text, text, text, text, text, text, jsonb) TO authenticated, anon, service_role;

-- Summary function for dashboard
CREATE OR REPLACE FUNCTION public.security_events_summary(
  _since timestamptz DEFAULT (now() - interval '24 hours')
)
RETURNS TABLE (
  total bigint,
  critical bigint,
  warning bigint,
  info bigint,
  unique_users bigint,
  unique_tenants bigint,
  rls_rejects bigint,
  cross_tenant bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    count(*)::bigint AS total,
    count(*) FILTER (WHERE severity = 'critical')::bigint AS critical,
    count(*) FILTER (WHERE severity = 'warning')::bigint AS warning,
    count(*) FILTER (WHERE severity = 'info')::bigint AS info,
    count(DISTINCT user_id)::bigint AS unique_users,
    count(DISTINCT tenant_id)::bigint AS unique_tenants,
    count(*) FILTER (WHERE error_code = '42501')::bigint AS rls_rejects,
    count(*) FILTER (WHERE event_type = 'cross_tenant_attempt')::bigint AS cross_tenant
  FROM public.security_events
  WHERE occurred_at >= _since
    AND public.is_platform_admin(auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.security_events_summary(timestamptz) TO authenticated;
