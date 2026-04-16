
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  permission_key text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  location_id uuid REFERENCES public.locations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role, permission_key, location_id)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant-scoped read role_permissions" ON public.role_permissions
  FOR SELECT TO authenticated
  USING (location_in_user_tenant(location_id, auth.uid()));

CREATE POLICY "Owner insert role_permissions" ON public.role_permissions
  FOR INSERT TO authenticated
  WITH CHECK (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid()));

CREATE POLICY "Owner update role_permissions" ON public.role_permissions
  FOR UPDATE TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid()));

CREATE POLICY "Owner delete role_permissions" ON public.role_permissions
  FOR DELETE TO authenticated
  USING (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid()));

CREATE TRIGGER update_role_permissions_updated_at
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
