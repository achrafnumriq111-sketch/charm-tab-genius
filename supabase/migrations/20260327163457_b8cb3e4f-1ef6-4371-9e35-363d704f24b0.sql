
DROP POLICY "Authenticated users can insert transactions" ON public.pos_transactions;
DROP POLICY "Authenticated users can read transactions" ON public.pos_transactions;
DROP POLICY "Authenticated users can update transactions" ON public.pos_transactions;

CREATE POLICY "Anyone can read transactions" ON public.pos_transactions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can insert transactions" ON public.pos_transactions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update transactions" ON public.pos_transactions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
