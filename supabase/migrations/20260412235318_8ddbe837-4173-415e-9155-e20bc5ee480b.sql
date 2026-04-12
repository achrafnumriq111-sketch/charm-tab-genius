
CREATE TABLE public.cash_closings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  closing_date DATE NOT NULL DEFAULT CURRENT_DATE,
  primary_employee_id TEXT NOT NULL,
  primary_employee_name TEXT NOT NULL,
  second_checker_id TEXT NOT NULL,
  second_checker_name TEXT NOT NULL,
  counted_cash NUMERIC NOT NULL DEFAULT 0,
  float_amount NUMERIC NOT NULL DEFAULT 300,
  expense_receipts NUMERIC NOT NULL DEFAULT 0,
  expense_note TEXT,
  envelope_amount NUMERIC NOT NULL DEFAULT 0,
  envelope_code TEXT NOT NULL,
  expected_cash_revenue NUMERIC NOT NULL DEFAULT 0,
  expected_envelope NUMERIC NOT NULL DEFAULT 0,
  difference NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'correct',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_closings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert cash closings"
ON public.cash_closings
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Anyone can read cash closings"
ON public.cash_closings
FOR SELECT
TO anon, authenticated
USING (true);
