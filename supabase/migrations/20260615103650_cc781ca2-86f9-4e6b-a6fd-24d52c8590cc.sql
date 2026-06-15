-- Restore EXECUTE for authenticated users on helper functions used in RLS policies.
-- The earlier REVOKE FROM PUBLIC also denied authenticated, breaking owner reads.
GRANT EXECUTE ON FUNCTION public.get_tenant_id_for_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_location_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.location_in_user_tenant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.modifier_group_in_user_tenant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_modifier_group_location(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.location_has_active_subscription(uuid) TO authenticated;