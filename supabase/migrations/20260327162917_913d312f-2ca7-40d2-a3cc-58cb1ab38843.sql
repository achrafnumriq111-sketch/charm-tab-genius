
CREATE TABLE public.pos_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  order_id TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  discount_name TEXT,
  total NUMERIC NOT NULL DEFAULT 0,
  tip NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'card',
  customer_id TEXT,
  customer_name TEXT,
  table_id TEXT,
  employee_id TEXT,
  employee_name TEXT,
  loyalty_provider TEXT,
  loyalty_id TEXT,
  gift_card_deduction NUMERIC NOT NULL DEFAULT 0,
  gift_card_id TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  source TEXT NOT NULL DEFAULT 'pos'
);

ALTER TABLE public.pos_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read transactions"
ON public.pos_transactions FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert transactions"
ON public.pos_transactions FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update transactions"
ON public.pos_transactions FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);
