-- Remove the legacy duplicate self-membership SELECT policy.
-- The equivalent policy is now maintained as sports_tenant_memberships_select_self.
DROP POLICY IF EXISTS sports_memberships_select_self
ON public.sports_tenant_memberships;
