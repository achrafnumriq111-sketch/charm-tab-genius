
CREATE TYPE marketplace_provider AS ENUM ('mock','uber_eats','deliveroo','thuisbezorgd');
CREATE TYPE marketplace_integration_status AS ENUM ('disconnected','connected','error','syncing');

CREATE TABLE public.marketplace_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  provider marketplace_provider NOT NULL,
  status marketplace_integration_status NOT NULL DEFAULT 'disconnected',
  display_name text,
  external_store_id text,
  external_menu_id text,
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  webhook_secret text,
  auto_accept boolean NOT NULL DEFAULT true,
  prep_time_minutes integer NOT NULL DEFAULT 15,
  last_sync_at timestamptz,
  last_sync_status text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, provider)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_integrations TO authenticated;
GRANT ALL ON public.marketplace_integrations TO service_role;
ALTER TABLE public.marketplace_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant read marketplace_integrations" ON public.marketplace_integrations
  FOR SELECT TO authenticated
  USING (tenant_id = get_tenant_id_for_user(auth.uid()) OR is_platform_admin(auth.uid()));
CREATE POLICY "owner manage marketplace_integrations" ON public.marketplace_integrations
  FOR ALL TO authenticated
  USING (tenant_id = get_tenant_id_for_user(auth.uid()) AND get_employee_role(auth.uid()) = 'owner'::employee_role)
  WITH CHECK (tenant_id = get_tenant_id_for_user(auth.uid()) AND get_employee_role(auth.uid()) = 'owner'::employee_role);
CREATE TRIGGER marketplace_integrations_updated_at BEFORE UPDATE ON public.marketplace_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER marketplace_integrations_sync_tenant BEFORE INSERT OR UPDATE ON public.marketplace_integrations
  FOR EACH ROW EXECUTE FUNCTION public.sync_tenant_id_from_location();

CREATE TABLE public.marketplace_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES public.marketplace_integrations(id) ON DELETE SET NULL,
  provider marketplace_provider NOT NULL,
  external_order_id text NOT NULL,
  external_order_number text,
  status text NOT NULL DEFAULT 'received', -- received|accepted|in_kitchen|ready|completed|cancelled
  customer_name text,
  customer_phone text,
  delivery_type text NOT NULL DEFAULT 'delivery', -- delivery|pickup
  total numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  qr_order_id uuid REFERENCES public.qr_orders(id) ON DELETE SET NULL,
  pos_transaction_id uuid REFERENCES public.pos_transactions(id) ON DELETE SET NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  ready_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_order_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_orders TO authenticated;
GRANT ALL ON public.marketplace_orders TO service_role;
ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant read marketplace_orders" ON public.marketplace_orders
  FOR SELECT TO authenticated
  USING (tenant_id = get_tenant_id_for_user(auth.uid()) OR is_platform_admin(auth.uid()));
CREATE POLICY "tenant update marketplace_orders" ON public.marketplace_orders
  FOR UPDATE TO authenticated
  USING (tenant_id = get_tenant_id_for_user(auth.uid()))
  WITH CHECK (tenant_id = get_tenant_id_for_user(auth.uid()));
CREATE TRIGGER marketplace_orders_updated_at BEFORE UPDATE ON public.marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER marketplace_orders_sync_tenant BEFORE INSERT OR UPDATE ON public.marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION public.sync_tenant_id_from_location();
CREATE INDEX marketplace_orders_location_idx ON public.marketplace_orders(location_id, received_at DESC);

CREATE TABLE public.marketplace_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES public.marketplace_integrations(id) ON DELETE CASCADE,
  kind text NOT NULL, -- menu_push|webhook_in|status_update
  status text NOT NULL, -- success|error
  message text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.marketplace_sync_log TO authenticated;
GRANT ALL ON public.marketplace_sync_log TO service_role;
ALTER TABLE public.marketplace_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant read sync_log" ON public.marketplace_sync_log
  FOR SELECT TO authenticated
  USING (tenant_id = get_tenant_id_for_user(auth.uid()) OR is_platform_admin(auth.uid()));
CREATE INDEX marketplace_sync_log_integration_idx ON public.marketplace_sync_log(integration_id, created_at DESC);
