
-- Employee roles enum
CREATE TYPE public.employee_role AS ENUM ('owner', 'manager', 'cashier', 'staff');

-- Employees table
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  username_normalized TEXT NOT NULL,
  role employee_role NOT NULL DEFAULT 'staff',
  is_active BOOLEAN NOT NULL DEFAULT true,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case-insensitive unique index on username
CREATE UNIQUE INDEX idx_employees_username ON public.employees (lower(username_normalized));

-- Enable RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Security definer function to check employee role without recursion
CREATE OR REPLACE FUNCTION public.get_employee_role(_user_id UUID)
RETURNS public.employee_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.employees WHERE user_id = _user_id AND is_active = true LIMIT 1
$$;

-- RLS: Authenticated users can read employees
CREATE POLICY "Authenticated users can read employees"
  ON public.employees FOR SELECT
  TO authenticated
  USING (true);

-- RLS: Owners can insert employees
CREATE POLICY "Owners can insert employees"
  ON public.employees FOR INSERT
  TO authenticated
  WITH CHECK (public.get_employee_role(auth.uid()) = 'owner');

-- RLS: Owners can update employees
CREATE POLICY "Owners can update employees"
  ON public.employees FOR UPDATE
  TO authenticated
  USING (public.get_employee_role(auth.uid()) = 'owner');

-- RLS: Owners can delete employees
CREATE POLICY "Owners can delete employees"
  ON public.employees FOR DELETE
  TO authenticated
  USING (public.get_employee_role(auth.uid()) = 'owner');

-- Trigger for updated_at
CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Login audit logs table
CREATE TABLE public.login_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  username_attempted TEXT,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.login_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS: Only owners can read audit logs
CREATE POLICY "Owners can read audit logs"
  ON public.login_audit_logs FOR SELECT
  TO authenticated
  USING (public.get_employee_role(auth.uid()) = 'owner');
