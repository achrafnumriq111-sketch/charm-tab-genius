
-- 1. Platform admins table
CREATE TABLE public.platform_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- 2. Helper: check if user is platform admin
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = _user_id
  )
$$;

-- 3. RLS for platform_admins table
CREATE POLICY "Admins read platform_admins"
ON public.platform_admins FOR SELECT TO authenticated
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Admins insert platform_admins"
ON public.platform_admins FOR INSERT TO authenticated
WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Admins delete platform_admins"
ON public.platform_admins FOR DELETE TO authenticated
USING (is_platform_admin(auth.uid()));

-- 4. Platform admins can read ALL tenants (not just active)
CREATE POLICY "Platform admins read all tenants"
ON public.tenants FOR SELECT TO authenticated
USING (is_platform_admin(auth.uid()));

-- 5. Platform admins can update any tenant (activate/deactivate)
CREATE POLICY "Platform admins update tenants"
ON public.tenants FOR UPDATE TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

-- 6. Platform admins can delete tenants
CREATE POLICY "Platform admins delete tenants"
ON public.tenants FOR DELETE TO authenticated
USING (is_platform_admin(auth.uid()));

-- 7. Platform admins can read all locations
CREATE POLICY "Platform admins read all locations"
ON public.locations FOR SELECT TO authenticated
USING (is_platform_admin(auth.uid()));
