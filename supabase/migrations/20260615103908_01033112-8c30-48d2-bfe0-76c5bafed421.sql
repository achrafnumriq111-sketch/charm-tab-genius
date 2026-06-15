-- Phase 1: per-location staff scoping for clearly per-location tables.
-- Staff sees only own location; owners see all locations within their tenant.

-- floor_tables
DROP POLICY IF EXISTS "tables location read" ON public.floor_tables;
DROP POLICY IF EXISTS "tables location update" ON public.floor_tables;
DROP POLICY IF EXISTS "tables owner delete" ON public.floor_tables;
CREATE POLICY "tables location read" ON public.floor_tables FOR SELECT
USING (
  is_platform_admin(auth.uid())
  OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid()))
  OR location_id = get_employee_location_id(auth.uid())
);
CREATE POLICY "tables location update" ON public.floor_tables FOR UPDATE
USING (
  is_platform_admin(auth.uid())
  OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid()))
  OR location_id = get_employee_location_id(auth.uid())
);
CREATE POLICY "tables owner delete" ON public.floor_tables FOR DELETE
USING (
  is_platform_admin(auth.uid())
  OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid()))
);

-- reservations
DROP POLICY IF EXISTS "res location read" ON public.reservations;
DROP POLICY IF EXISTS "res location update" ON public.reservations;
DROP POLICY IF EXISTS "res owner delete" ON public.reservations;
CREATE POLICY "res location read" ON public.reservations FOR SELECT
USING (
  is_platform_admin(auth.uid())
  OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid()))
  OR location_id = get_employee_location_id(auth.uid())
);
CREATE POLICY "res location update" ON public.reservations FOR UPDATE
USING (
  is_platform_admin(auth.uid())
  OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid()))
  OR location_id = get_employee_location_id(auth.uid())
);
CREATE POLICY "res owner delete" ON public.reservations FOR DELETE
USING (
  is_platform_admin(auth.uid())
  OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid()))
);

-- discounts
DROP POLICY IF EXISTS "disc loc read" ON public.discounts;
DROP POLICY IF EXISTS "disc loc update" ON public.discounts;
DROP POLICY IF EXISTS "disc owner delete" ON public.discounts;
CREATE POLICY "disc loc read" ON public.discounts FOR SELECT
USING (
  is_platform_admin(auth.uid())
  OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid()))
  OR location_id = get_employee_location_id(auth.uid())
);
CREATE POLICY "disc loc update" ON public.discounts FOR UPDATE
USING (
  is_platform_admin(auth.uid())
  OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid()))
  OR location_id = get_employee_location_id(auth.uid())
);
CREATE POLICY "disc owner delete" ON public.discounts FOR DELETE
USING (
  is_platform_admin(auth.uid())
  OR (get_employee_role(auth.uid()) = 'owner' AND location_in_user_tenant(location_id, auth.uid()))
);