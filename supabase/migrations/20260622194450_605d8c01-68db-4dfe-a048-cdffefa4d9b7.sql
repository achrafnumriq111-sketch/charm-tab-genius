-- Restrict marketplace_integrations SELECT to owner/manager only (credentials & webhook_secret are sensitive)
DROP POLICY IF EXISTS "tenant read marketplace_integrations" ON public.marketplace_integrations;

CREATE POLICY "owner/manager read marketplace_integrations"
ON public.marketplace_integrations
FOR SELECT
TO authenticated
USING (
  (tenant_id = get_tenant_id_for_user(auth.uid())
    AND get_employee_role(auth.uid()) IN ('owner'::employee_role, 'manager'::employee_role))
  OR is_platform_admin(auth.uid())
);

-- Restrict login_audit_logs INSERT to service role only (prevent fabricated audit entries)
DROP POLICY IF EXISTS "Tenant-scoped insert audit_logs" ON public.login_audit_logs;

CREATE POLICY "Service role inserts login audit logs"
ON public.login_audit_logs
FOR INSERT
TO service_role
WITH CHECK (true);