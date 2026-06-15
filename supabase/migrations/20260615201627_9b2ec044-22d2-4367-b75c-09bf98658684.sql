
-- Remove unscoped anonymous SELECT on upsell_rules (used only by authenticated POS)
DROP POLICY IF EXISTS "Anon read upsell_rules" ON public.upsell_rules;

-- Tenant-scoped policies for device_pairing_codes (owner-only management)
CREATE POLICY "Owners can insert pairing codes for their tenant"
ON public.device_pairing_codes
FOR INSERT TO authenticated
WITH CHECK (
  get_employee_role(auth.uid()) = 'owner'::employee_role
  AND location_in_user_tenant(location_id, auth.uid())
);

CREATE POLICY "Owners can view pairing codes for their tenant"
ON public.device_pairing_codes
FOR SELECT TO authenticated
USING (
  get_employee_role(auth.uid()) = 'owner'::employee_role
  AND location_in_user_tenant(location_id, auth.uid())
);

CREATE POLICY "Owners can update pairing codes for their tenant"
ON public.device_pairing_codes
FOR UPDATE TO authenticated
USING (
  get_employee_role(auth.uid()) = 'owner'::employee_role
  AND location_in_user_tenant(location_id, auth.uid())
)
WITH CHECK (
  get_employee_role(auth.uid()) = 'owner'::employee_role
  AND location_in_user_tenant(location_id, auth.uid())
);

CREATE POLICY "Owners can delete pairing codes for their tenant"
ON public.device_pairing_codes
FOR DELETE TO authenticated
USING (
  get_employee_role(auth.uid()) = 'owner'::employee_role
  AND location_in_user_tenant(location_id, auth.uid())
);
