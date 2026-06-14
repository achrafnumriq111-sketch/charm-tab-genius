
-- ============ trusted_devices ============
CREATE TABLE public.trusted_devices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  device_name text NOT NULL,
  paired_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  last_seen_at timestamptz,
  last_ip text,
  user_agent text,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_trusted_devices_tenant ON public.trusted_devices(tenant_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_trusted_devices_token ON public.trusted_devices(device_token) WHERE revoked_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trusted_devices TO authenticated;
GRANT ALL ON public.trusted_devices TO service_role;

ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;

-- Owners/managers can see devices in their own tenant
CREATE POLICY "Owners and managers view tenant devices"
ON public.trusted_devices FOR SELECT TO authenticated
USING (
  tenant_id = public.get_tenant_id_for_user(auth.uid())
  AND public.get_employee_role(auth.uid()) IN ('owner','manager')
);

-- Owners/managers can revoke devices in their own tenant
CREATE POLICY "Owners and managers revoke tenant devices"
ON public.trusted_devices FOR UPDATE TO authenticated
USING (
  tenant_id = public.get_tenant_id_for_user(auth.uid())
  AND public.get_employee_role(auth.uid()) IN ('owner','manager')
)
WITH CHECK (
  tenant_id = public.get_tenant_id_for_user(auth.uid())
);

-- Platform admins full access
CREATE POLICY "Platform admins manage all devices"
ON public.trusted_devices FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE TRIGGER update_trusted_devices_updated_at
BEFORE UPDATE ON public.trusted_devices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ device_pairing_codes ============
CREATE TABLE public.device_pairing_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  device_name text NOT NULL,
  created_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by_device_id uuid REFERENCES public.trusted_devices(id) ON DELETE SET NULL,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique active code (only one unused per code value)
CREATE UNIQUE INDEX idx_pairing_codes_active ON public.device_pairing_codes(code) WHERE used_at IS NULL;
CREATE INDEX idx_pairing_codes_tenant ON public.device_pairing_codes(tenant_id);

GRANT ALL ON public.device_pairing_codes TO service_role;
-- No grants to authenticated/anon — only edge functions touch this table

ALTER TABLE public.device_pairing_codes ENABLE ROW LEVEL SECURITY;

-- Only platform admins can read directly; pairing flow goes through edge functions
CREATE POLICY "Platform admins read pairing codes"
ON public.device_pairing_codes FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- ============ Helper: validate device token ============
CREATE OR REPLACE FUNCTION public.get_device_context(_token uuid)
RETURNS TABLE(tenant_id uuid, location_id uuid, device_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id, location_id, id
  FROM public.trusted_devices
  WHERE device_token = _token AND revoked_at IS NULL
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.get_device_context(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_device_context(uuid) TO service_role;
