-- Feature flags per tenant
CREATE TABLE public.tenant_feature_flags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, feature_key)
);

ALTER TABLE public.tenant_feature_flags ENABLE ROW LEVEL SECURITY;

-- Platform admins: full CRUD
CREATE POLICY "Platform admins manage feature_flags"
  ON public.tenant_feature_flags FOR ALL
  TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

-- Tenant owners: read own flags
CREATE POLICY "Tenant owners read own feature_flags"
  ON public.tenant_feature_flags FOR SELECT
  TO authenticated
  USING (tenant_id = get_tenant_id_for_user(auth.uid()));

-- Anon: read flags for active tenants (QR menu needs to know enabled modules)
CREATE POLICY "Anon read feature_flags"
  ON public.tenant_feature_flags FOR SELECT
  TO anon
  USING (is_enabled = true);

-- Auto-update updated_at
CREATE TRIGGER update_tenant_feature_flags_updated_at
  BEFORE UPDATE ON public.tenant_feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Impersonation audit log (platform-only, never visible to tenants)
CREATE TABLE public.admin_impersonation_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id uuid NOT NULL,
  target_tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  target_tenant_name text NOT NULL DEFAULT '',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  ip_address text,
  user_agent text
);

ALTER TABLE public.admin_impersonation_log ENABLE ROW LEVEL SECURITY;

-- Only platform admins can see impersonation logs
CREATE POLICY "Platform admins read impersonation_log"
  ON public.admin_impersonation_log FOR SELECT
  TO authenticated
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins insert impersonation_log"
  ON public.admin_impersonation_log FOR INSERT
  TO authenticated
  WITH CHECK (is_platform_admin(auth.uid()));

-- Insert default feature flags for existing tenants
INSERT INTO public.tenant_feature_flags (tenant_id, feature_key, is_enabled)
SELECT t.id, f.key, true
FROM public.tenants t
CROSS JOIN (VALUES 
  ('pos'), ('qr_ordering'), ('upsell'), ('loyalty'), 
  ('ai_forecast'), ('inventory'), ('prep_station'), 
  ('reservations'), ('cash_closing'), ('analytics')
) AS f(key)
ON CONFLICT DO NOTHING;