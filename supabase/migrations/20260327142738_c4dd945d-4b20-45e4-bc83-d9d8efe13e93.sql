
DROP POLICY "Authenticated users can read QR orders" ON public.qr_orders;
DROP POLICY "Authenticated users can update QR orders" ON public.qr_orders;

CREATE POLICY "Anyone can read QR orders" ON public.qr_orders FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can update QR orders" ON public.qr_orders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
