
-- Allow updates on cash_closings (for status changes)
CREATE POLICY "Anyone can update cash closings"
ON public.cash_closings
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Create audit notes table
CREATE TABLE public.cash_audit_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cash_closing_id uuid NOT NULL REFERENCES public.cash_closings(id) ON DELETE CASCADE,
  employee_name text NOT NULL,
  note_text text NOT NULL,
  action_type text NOT NULL DEFAULT 'notitie',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_audit_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read audit notes"
ON public.cash_audit_notes
FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "Anyone can insert audit notes"
ON public.cash_audit_notes
FOR INSERT TO anon, authenticated
WITH CHECK (true);
