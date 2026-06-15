
-- Step 1: Per-tenant unique index on employees (tenant_id was added in Migratie 1)
DROP INDEX IF EXISTS public.idx_employees_username;
CREATE UNIQUE INDEX IF NOT EXISTS employees_tenant_username_uniq
  ON public.employees (tenant_id, lower(username_normalized))
  WHERE is_active = true;

-- Step 2: REVOKE EXECUTE on all SECURITY DEFINER helper functions from anon/authenticated/PUBLIC
-- These are only intended to be called from within RLS expressions (where they run as definer).
-- Keep service_role access.

REVOKE EXECUTE ON FUNCTION public.get_employee_location_id(uuid)        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_employee_role(uuid)               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_tenant_id_for_user(uuid)          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin(uuid)               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_slug_available(text)               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_device_context(uuid)              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_modifier_group_location(uuid)     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.modifier_group_in_user_tenant(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.location_in_user_tenant(uuid,uuid)    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_tenant_id_from_location()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_modifier_location()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.security_events_summary(timestamptz)  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_security_event(text, security_event_severity, text, text, text, text, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;

-- Tenant onboarding is intentionally callable by authenticated users (signed-up owners who don't yet have a tenant)
-- so keep its grant. Same for slug availability check — explicitly granted to authenticated.
GRANT EXECUTE ON FUNCTION public.setup_tenant_onboarding(text,text,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_slug_available(text) TO authenticated;
-- Allow signed-in users to log their own security events (RPC pattern used by client guards).
GRANT EXECUTE ON FUNCTION public.log_security_event(text, security_event_severity, text, text, text, text, text, text, text, text, jsonb) TO authenticated;
