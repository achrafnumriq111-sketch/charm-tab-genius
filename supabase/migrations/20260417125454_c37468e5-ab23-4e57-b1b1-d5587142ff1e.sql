-- Unified customer registry across all capture points
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  marketing_opt_in boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'pos', -- gift_card | qr_order | pos | manual | passkit
  passkit_member_id text,
  total_spent numeric NOT NULL DEFAULT 0,
  visit_count integer NOT NULL DEFAULT 0,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique per location + email (case-insensitive); fallback uniqueness on phone when email absent
CREATE UNIQUE INDEX customers_unique_email_per_location
  ON public.customers (location_id, lower(email))
  WHERE email IS NOT NULL AND email <> '';

CREATE UNIQUE INDEX customers_unique_phone_per_location
  ON public.customers (location_id, phone)
  WHERE (email IS NULL OR email = '') AND phone IS NOT NULL AND phone <> '';

CREATE INDEX customers_location_idx ON public.customers (location_id);
CREATE INDEX customers_last_seen_idx ON public.customers (last_seen_at DESC);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant-scoped read customers"
  ON public.customers FOR SELECT TO authenticated
  USING (
    location_id = get_employee_location_id(auth.uid())
    OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid()))
  );

CREATE POLICY "Tenant-scoped insert customers"
  ON public.customers FOR INSERT TO authenticated
  WITH CHECK (
    location_id = get_employee_location_id(auth.uid())
    OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid()))
  );

CREATE POLICY "Tenant-scoped update customers"
  ON public.customers FOR UPDATE TO authenticated
  USING (
    location_id = get_employee_location_id(auth.uid())
    OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid()))
  );

-- Allow QR ordering (anonymous) to insert customer rows for their own location
CREATE POLICY "Anon insert customers from qr"
  ON public.customers FOR INSERT TO anon
  WITH CHECK (source = 'qr_order' AND location_id IS NOT NULL);

CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill from existing qr_orders
INSERT INTO public.customers (location_id, full_name, email, phone, source, total_spent, visit_count, first_seen_at, last_seen_at)
SELECT
  location_id,
  customer_name,
  NULLIF(customer_email, ''),
  NULLIF(customer_phone, ''),
  'qr_order',
  COALESCE(SUM(total), 0),
  COUNT(*),
  MIN(created_at),
  MAX(created_at)
FROM public.qr_orders
WHERE customer_name IS NOT NULL AND customer_name <> ''
GROUP BY location_id, customer_name, customer_email, customer_phone
ON CONFLICT DO NOTHING;