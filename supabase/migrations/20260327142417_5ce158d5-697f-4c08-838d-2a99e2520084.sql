
CREATE TABLE public.qr_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_id TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.qr_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert QR orders" ON public.qr_orders FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can read QR orders" ON public.qr_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update QR orders" ON public.qr_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.qr_orders;
