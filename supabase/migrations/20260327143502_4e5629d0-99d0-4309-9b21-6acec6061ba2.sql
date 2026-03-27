
ALTER TABLE public.qr_orders 
ADD COLUMN customer_name TEXT NOT NULL DEFAULT '',
ADD COLUMN customer_email TEXT NOT NULL DEFAULT '',
ADD COLUMN customer_phone TEXT NOT NULL DEFAULT '';
