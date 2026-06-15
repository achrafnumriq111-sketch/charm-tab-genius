
-- Plan / status enums
DO $$ BEGIN
  CREATE TYPE public.subscription_plan AS ENUM ('all_in','custom','trial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('trialing','active','past_due','suspended','canceled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_type public.subscription_plan NOT NULL DEFAULT 'trial',
  status public.subscription_status NOT NULL DEFAULT 'trialing',
  price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  custom_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  stripe_customer_id text,
  stripe_subscription_id text,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(location_id)
);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON public.subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

-- Reuse the tenant-id sync trigger so tenant_id stays consistent with location_id
DROP TRIGGER IF EXISTS trg_sync_tenant_id ON public.subscriptions;
CREATE TRIGGER trg_sync_tenant_id BEFORE INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.sync_tenant_id_from_location();

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_select_own" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (
    public.location_in_user_tenant(location_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "subscriptions_admin_write" ON public.subscriptions
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- Helper: is a given location currently allowed to operate (active or trialing)?
-- Used by Phase-3 gating; NOT enforced yet by any RLS or trigger.
CREATE OR REPLACE FUNCTION public.location_has_active_subscription(_location_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE location_id = _location_id
      AND status IN ('trialing','active')
      AND (current_period_end IS NULL OR current_period_end > now())
  );
$$;

REVOKE EXECUTE ON FUNCTION public.location_has_active_subscription(uuid) FROM PUBLIC, anon, authenticated;
