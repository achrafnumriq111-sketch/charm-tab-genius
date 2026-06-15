
-- Strengthen the trigger: forbid both-NULL situations
CREATE OR REPLACE FUNCTION public.sync_tenant_id_from_location()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant uuid;
BEGIN
  IF NEW.location_id IS NOT NULL THEN
    SELECT tenant_id INTO _tenant FROM public.locations WHERE id = NEW.location_id;
    IF _tenant IS NULL THEN
      RAISE EXCEPTION 'sync_tenant_id_from_location: location % has no tenant', NEW.location_id;
    END IF;
    IF NEW.tenant_id IS NOT NULL AND NEW.tenant_id <> _tenant THEN
      RAISE EXCEPTION 'tenant_id (%) does not match location.tenant_id (%) for location %', NEW.tenant_id, _tenant, NEW.location_id;
    END IF;
    NEW.tenant_id := _tenant;
  ELSE
    -- location_id is NULL: require an explicit tenant_id (used by qr-anon path for customers, etc.)
    IF NEW.tenant_id IS NULL THEN
      RAISE EXCEPTION 'sync_tenant_id_from_location: both location_id and tenant_id are NULL on table %', TG_TABLE_NAME;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop NOT NULL — trigger + restrictive RLS guarantee isolation
ALTER TABLE public.pos_transactions ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE public.products          ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE public.inventory_items   ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE public.customers         ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE public.qr_orders         ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE public.cash_closings     ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE public.stock_movements   ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE public.employees         ALTER COLUMN tenant_id DROP NOT NULL;
