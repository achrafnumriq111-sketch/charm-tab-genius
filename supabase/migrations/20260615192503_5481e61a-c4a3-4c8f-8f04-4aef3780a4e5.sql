
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS pin_hash text;

CREATE OR REPLACE FUNCTION public.verify_employee_pin(_employee_id uuid, _pin text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees
    WHERE id = _employee_id
      AND is_active = true
      AND pin_hash IS NOT NULL
      AND pin_hash = extensions.crypt(_pin, pin_hash)
  )
$$;
REVOKE ALL ON FUNCTION public.verify_employee_pin(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_employee_pin(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_employee_pin(uuid, text) TO service_role;
