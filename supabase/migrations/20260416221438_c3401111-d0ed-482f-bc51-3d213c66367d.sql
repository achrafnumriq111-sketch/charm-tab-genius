-- Create gift_cards table
CREATE TABLE public.gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text NOT NULL,
  initial_value numeric NOT NULL DEFAULT 0,
  balance numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  source_order_id text,
  issued_by_employee_id text,
  issued_by_employee_name text,
  passkit_member_id text,
  passkit_enrolled boolean NOT NULL DEFAULT false,
  location_id uuid REFERENCES public.locations(id) ON DELETE CASCADE,
  issued_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_gift_cards_location ON public.gift_cards(location_id);
CREATE INDEX idx_gift_cards_code ON public.gift_cards(code);
CREATE INDEX idx_gift_cards_status ON public.gift_cards(status);

-- Enable RLS
ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;

-- Tenant-scoped read
CREATE POLICY "Tenant-scoped read gift_cards"
ON public.gift_cards
FOR SELECT
TO authenticated
USING (
  (location_id = get_employee_location_id(auth.uid()))
  OR ((get_employee_role(auth.uid()) = 'owner'::employee_role) AND location_in_user_tenant(location_id, auth.uid()))
);

-- Tenant-scoped insert
CREATE POLICY "Tenant-scoped insert gift_cards"
ON public.gift_cards
FOR INSERT
TO authenticated
WITH CHECK (
  (location_id = get_employee_location_id(auth.uid()))
  OR ((get_employee_role(auth.uid()) = 'owner'::employee_role) AND location_in_user_tenant(location_id, auth.uid()))
);

-- Tenant-scoped update (for redemption / balance updates)
CREATE POLICY "Tenant-scoped update gift_cards"
ON public.gift_cards
FOR UPDATE
TO authenticated
USING (
  (location_id = get_employee_location_id(auth.uid()))
  OR ((get_employee_role(auth.uid()) = 'owner'::employee_role) AND location_in_user_tenant(location_id, auth.uid()))
);

-- Trigger for updated_at
CREATE TRIGGER update_gift_cards_updated_at
BEFORE UPDATE ON public.gift_cards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();