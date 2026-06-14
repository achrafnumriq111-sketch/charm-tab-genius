
-- 1) Remove anon SELECT policies that leak business / customer data
DROP POLICY IF EXISTS "Anon read active tenants" ON public.tenants;
DROP POLICY IF EXISTS "Anon read active locations" ON public.locations;
DROP POLICY IF EXISTS "Anon read active products" ON public.products;
DROP POLICY IF EXISTS "Anon read recent qr_orders" ON public.qr_orders;
DROP POLICY IF EXISTS "Anon read feature_flags" ON public.tenant_feature_flags;

-- Revoke now-unused anon SELECT grants (keep INSERT on qr_orders for guest orders)
REVOKE SELECT ON public.tenants FROM anon;
REVOKE SELECT ON public.locations FROM anon;
REVOKE SELECT ON public.products FROM anon;
REVOKE SELECT ON public.qr_orders FROM anon;
REVOKE SELECT ON public.tenant_feature_flags FROM anon;

-- 2) Slug availability check for the public signup page (no row data leaked)
CREATE OR REPLACE FUNCTION public.is_slug_available(_slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.tenants WHERE slug = _slug);
$$;

REVOKE ALL ON FUNCTION public.is_slug_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_slug_available(text) TO anon, authenticated;

-- 3) Tighten SECURITY DEFINER helpers (RLS / trigger-only) so the API can't call them
-- These are used only inside RLS policies, triggers, or other SECURITY DEFINER functions.
REVOKE EXECUTE ON FUNCTION public.get_employee_location_id(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_employee_role(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_modifier_group_location(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_tenant_id_for_user(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.modifier_group_in_user_tenant(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.location_in_user_tenant(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- pgmq helpers are for edge functions (service_role); revoke from clients
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;

-- Keep callable by signed-in users (they are the documented client RPCs):
--   public.is_platform_admin(uuid)
--   public.log_security_event(...)
--   public.security_events_summary(timestamptz)
--   public.setup_tenant_onboarding(...)
GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_security_event(text, security_event_severity, text, text, text, text, text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.security_events_summary(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.setup_tenant_onboarding(text, text, text, text, text, text, text) TO authenticated;
