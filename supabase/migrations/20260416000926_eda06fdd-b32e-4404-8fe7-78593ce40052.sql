
-- =============================================
-- STEP A: TENANT MODEL
-- =============================================

-- 1. Create tenants table
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  owner_user_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  plan text NOT NULL DEFAULT 'free',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Slug index for fast subdomain lookup
CREATE UNIQUE INDEX idx_tenants_slug ON public.tenants (slug);
CREATE INDEX idx_tenants_owner ON public.tenants (owner_user_id);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at
CREATE TRIGGER update_tenants_updated_at
BEFORE UPDATE ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add tenant_id to locations
ALTER TABLE public.locations ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
CREATE INDEX idx_locations_tenant ON public.locations (tenant_id);

-- 3. Helper: get tenant_id for a user (via employees → locations → tenants)
CREATE OR REPLACE FUNCTION public.get_tenant_id_for_user(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id
  FROM public.employees e
  JOIN public.locations l ON l.id = e.location_id
  JOIN public.tenants t ON t.id = l.tenant_id
  WHERE e.user_id = _user_id AND e.is_active = true
  LIMIT 1
$$;

-- 4. RLS policies for tenants
-- Anon can read active tenants (subdomain resolution)
CREATE POLICY "Anon read active tenants"
ON public.tenants FOR SELECT TO anon
USING (is_active = true);

-- Authenticated users can read their own tenant
CREATE POLICY "Users read own tenant"
ON public.tenants FOR SELECT TO authenticated
USING (
  id = get_tenant_id_for_user(auth.uid())
  OR owner_user_id = auth.uid()
);

-- Owner can update their tenant
CREATE POLICY "Owner update own tenant"
ON public.tenants FOR UPDATE TO authenticated
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());

-- Anyone authenticated can insert (for self-service signup)
CREATE POLICY "Authenticated insert tenant"
ON public.tenants FOR INSERT TO authenticated
WITH CHECK (owner_user_id = auth.uid());

-- 5. Onboarding function: creates tenant + location + owner employee in one transaction
CREATE OR REPLACE FUNCTION public.setup_tenant_onboarding(
  _tenant_name text,
  _slug text,
  _owner_name text,
  _city text DEFAULT '',
  _address text DEFAULT '',
  _timezone text DEFAULT 'Europe/Amsterdam',
  _currency text DEFAULT 'EUR'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _tenant_id uuid;
  _location_id uuid;
  _employee_id uuid;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check slug uniqueness
  IF EXISTS (SELECT 1 FROM public.tenants WHERE slug = _slug) THEN
    RAISE EXCEPTION 'Slug already taken';
  END IF;

  -- Create tenant
  INSERT INTO public.tenants (name, slug, owner_user_id)
  VALUES (_tenant_name, _slug, _user_id)
  RETURNING id INTO _tenant_id;

  -- Create first location
  INSERT INTO public.locations (name, city, address, timezone, currency, tenant_id)
  VALUES (_tenant_name, _city, _address, _timezone, _currency, _tenant_id)
  RETURNING id INTO _location_id;

  -- Create owner employee
  INSERT INTO public.employees (full_name, username_normalized, role, user_id, location_id, is_active)
  VALUES (_owner_name, lower(replace(_owner_name, ' ', '')), 'owner', _user_id, _location_id, true)
  RETURNING id INTO _employee_id;

  RETURN jsonb_build_object(
    'tenant_id', _tenant_id,
    'location_id', _location_id,
    'employee_id', _employee_id,
    'slug', _slug
  );
END;
$$;
