-- Phase 2 Block 1: Allow tenant owners to manage their own feature flags
-- Existing policies: platform_admins manage all; tenant owners can SELECT.
-- Add: tenant owners can INSERT/UPDATE/DELETE their own tenant's flags.

CREATE POLICY "Tenant owners insert own feature_flags"
  ON public.tenant_feature_flags
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.get_tenant_id_for_user(auth.uid())
    AND public.get_employee_role(auth.uid()) = 'owner'
  );

CREATE POLICY "Tenant owners update own feature_flags"
  ON public.tenant_feature_flags
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.get_tenant_id_for_user(auth.uid())
    AND public.get_employee_role(auth.uid()) = 'owner'
  )
  WITH CHECK (
    tenant_id = public.get_tenant_id_for_user(auth.uid())
    AND public.get_employee_role(auth.uid()) = 'owner'
  );

CREATE POLICY "Tenant owners delete own feature_flags"
  ON public.tenant_feature_flags
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.get_tenant_id_for_user(auth.uid())
    AND public.get_employee_role(auth.uid()) = 'owner'
  );