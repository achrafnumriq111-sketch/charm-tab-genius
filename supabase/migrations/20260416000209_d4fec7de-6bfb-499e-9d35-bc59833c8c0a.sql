
-- =============================================
-- SaaS HARDENING: Fix all permissive RLS policies
-- =============================================

-- 1. MODIFIERS TABLE: Replace "true" policies with location-scoped via group join
-- Drop old overly-permissive policies
DROP POLICY IF EXISTS "Authenticated delete modifiers" ON public.modifiers;
DROP POLICY IF EXISTS "Authenticated insert modifiers" ON public.modifiers;
DROP POLICY IF EXISTS "Authenticated update modifiers" ON public.modifiers;
DROP POLICY IF EXISTS "Authenticated read modifiers" ON public.modifiers;

-- Create helper function to check modifier ownership via group's location_id
CREATE OR REPLACE FUNCTION public.get_modifier_group_location(_group_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT location_id FROM public.modifier_groups WHERE id = _group_id LIMIT 1
$$;

-- Location-scoped read: owner sees all, others see only their location's modifiers
CREATE POLICY "Location-scoped read modifiers"
ON public.modifiers FOR SELECT TO authenticated
USING (
  get_employee_role(auth.uid()) = 'owner'::employee_role
  OR get_modifier_group_location(group_id) = get_employee_location_id(auth.uid())
);

-- Location-scoped insert
CREATE POLICY "Location-scoped insert modifiers"
ON public.modifiers FOR INSERT TO authenticated
WITH CHECK (
  get_employee_role(auth.uid()) = 'owner'::employee_role
  OR get_modifier_group_location(group_id) = get_employee_location_id(auth.uid())
);

-- Location-scoped update
CREATE POLICY "Location-scoped update modifiers"
ON public.modifiers FOR UPDATE TO authenticated
USING (
  get_employee_role(auth.uid()) = 'owner'::employee_role
  OR get_modifier_group_location(group_id) = get_employee_location_id(auth.uid())
);

-- Location-scoped delete
CREATE POLICY "Location-scoped delete modifiers"
ON public.modifiers FOR DELETE TO authenticated
USING (
  get_employee_role(auth.uid()) = 'owner'::employee_role
  OR get_modifier_group_location(group_id) = get_employee_location_id(auth.uid())
);

-- 2. POS_TRANSACTIONS: Tighten anon SELECT — only allow reading by specific order_id
-- (QR flow needs to check order status, but not browse all transactions)
DROP POLICY IF EXISTS "Anon read transactions" ON public.pos_transactions;
-- No replacement: anon users don't need to read pos_transactions at all.
-- QR order status is tracked via qr_orders table, not pos_transactions.

-- 3. QR_ORDERS: Tighten anon SELECT — only orders from the last 24h (session window)
DROP POLICY IF EXISTS "Anon read qr_orders" ON public.qr_orders;
CREATE POLICY "Anon read recent qr_orders"
ON public.qr_orders FOR SELECT TO anon
USING (
  created_at > (now() - interval '24 hours')
);

-- 4. POS_TRANSACTIONS anon INSERT: add guardrails — must have order_id and source = 'qr'
DROP POLICY IF EXISTS "Anon insert transactions" ON public.pos_transactions;
CREATE POLICY "Anon insert qr transactions only"
ON public.pos_transactions FOR INSERT TO anon
WITH CHECK (
  source = 'qr' AND order_id IS NOT NULL
);

-- 5. QR_ORDERS anon INSERT: must have table_id
DROP POLICY IF EXISTS "Anon insert qr_orders" ON public.qr_orders;
CREATE POLICY "Anon insert qr_orders with table"
ON public.qr_orders FOR INSERT TO anon
WITH CHECK (
  table_id IS NOT NULL AND table_id != ''
);
