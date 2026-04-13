ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS is_dynamic boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recommended_threshold numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_forecast_enabled boolean NOT NULL DEFAULT false;