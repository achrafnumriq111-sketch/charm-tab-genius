
ALTER TABLE public.pos_transactions ADD COLUMN IF NOT EXISTS idempotency_key uuid;
ALTER TABLE public.cash_closings   ADD COLUMN IF NOT EXISTS idempotency_key uuid;
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS idempotency_key uuid;
ALTER TABLE public.qr_orders       ADD COLUMN IF NOT EXISTS idempotency_key uuid;

CREATE UNIQUE INDEX IF NOT EXISTS pos_transactions_idem_uq ON public.pos_transactions(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cash_closings_idem_uq   ON public.cash_closings(idempotency_key)   WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS stock_movements_idem_uq ON public.stock_movements(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS qr_orders_idem_uq       ON public.qr_orders(idempotency_key)       WHERE idempotency_key IS NOT NULL;
