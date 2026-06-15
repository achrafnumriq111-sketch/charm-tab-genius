
CREATE OR REPLACE FUNCTION public.set_employee_pin(_employee_id uuid, _pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF _pin !~ '^\d{6}$' THEN
    RAISE EXCEPTION 'pin must be 6 digits';
  END IF;
  UPDATE public.employees
     SET pin_hash = extensions.crypt(_pin, extensions.gen_salt('bf', 10)),
         failed_login_attempts = 0,
         locked_until = NULL
   WHERE id = _employee_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_employee_pin(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_employee_pin(uuid, text) TO service_role;
