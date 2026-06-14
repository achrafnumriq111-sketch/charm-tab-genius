
CREATE TABLE public.employee_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role public.employee_role NOT NULL DEFAULT 'sales',
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  accepted_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_employee_invites_token ON public.employee_invites(token);
CREATE INDEX idx_employee_invites_location ON public.employee_invites(location_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_invites TO authenticated;
GRANT ALL ON public.employee_invites TO service_role;

ALTER TABLE public.employee_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view invites in their tenant"
ON public.employee_invites FOR SELECT
TO authenticated
USING (
  public.location_in_user_tenant(location_id, auth.uid())
  AND public.get_employee_role(auth.uid()) = 'owner'
);

CREATE POLICY "Owners create invites in their tenant"
ON public.employee_invites FOR INSERT
TO authenticated
WITH CHECK (
  public.location_in_user_tenant(location_id, auth.uid())
  AND public.get_employee_role(auth.uid()) = 'owner'
);

CREATE POLICY "Owners delete invites in their tenant"
ON public.employee_invites FOR DELETE
TO authenticated
USING (
  public.location_in_user_tenant(location_id, auth.uid())
  AND public.get_employee_role(auth.uid()) = 'owner'
);

CREATE TRIGGER update_employee_invites_updated_at
BEFORE UPDATE ON public.employee_invites
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
