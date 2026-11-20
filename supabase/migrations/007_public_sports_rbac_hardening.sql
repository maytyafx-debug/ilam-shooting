-- METATYA Sports OS: harden the active public-schema pilot RBAC.
-- Scope is limited to the five public.sports_* tables used by sports-os/lib/supabase/server.ts.
-- No rows are inserted, updated, deleted, or backfilled by this migration.
-- Existing service_role privileges are intentionally left unchanged.

ALTER TABLE public.sports_tenant_memberships
  DROP CONSTRAINT IF EXISTS sports_tenant_memberships_role_check;

ALTER TABLE public.sports_tenant_memberships
  ADD CONSTRAINT sports_tenant_memberships_role_check
  CHECK (role IN ('owner', 'admin', 'referee', 'coach', 'staff', 'member'));

-- RLS must apply even when a table owner accesses these operational tables.
ALTER TABLE public.sports_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sports_tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_tenant_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sports_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sports_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sports_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_results FORCE ROW LEVEL SECURITY;

-- Remove broad default grants, especially anon access and non-RLS TRUNCATE.
REVOKE ALL PRIVILEGES ON TABLE
  public.sports_tenants,
  public.sports_tenant_memberships,
  public.sports_members,
  public.sports_events,
  public.sports_results
FROM PUBLIC, anon, authenticated;

-- Tenant resolution needs only read access to the current user's membership
-- and the organizations to which that user actively belongs.
GRANT SELECT ON TABLE
  public.sports_tenants,
  public.sports_tenant_memberships
TO authenticated;

-- RLS below restricts these DML grants by tenant and role.
-- No client role receives TRUNCATE, REFERENCES, or TRIGGER privileges.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.sports_members,
  public.sports_events,
  public.sports_results
TO authenticated;

-- Remove the previous broad active-member read and staff-write policies.
DROP POLICY IF EXISTS sports_tenants_select_member ON public.sports_tenants;
DROP POLICY IF EXISTS sports_tenant_memberships_select_self ON public.sports_tenant_memberships;

DROP POLICY IF EXISTS sports_members_select_member ON public.sports_members;
DROP POLICY IF EXISTS sports_members_insert_staff ON public.sports_members;
DROP POLICY IF EXISTS sports_members_select_admin_referee ON public.sports_members;
DROP POLICY IF EXISTS sports_members_insert_admin ON public.sports_members;
DROP POLICY IF EXISTS sports_members_update_admin ON public.sports_members;
DROP POLICY IF EXISTS sports_members_delete_admin ON public.sports_members;

DROP POLICY IF EXISTS sports_events_select_member ON public.sports_events;
DROP POLICY IF EXISTS sports_events_insert_staff ON public.sports_events;
DROP POLICY IF EXISTS sports_events_select_admin_referee ON public.sports_events;
DROP POLICY IF EXISTS sports_events_insert_admin ON public.sports_events;
DROP POLICY IF EXISTS sports_events_update_admin ON public.sports_events;
DROP POLICY IF EXISTS sports_events_delete_admin ON public.sports_events;

DROP POLICY IF EXISTS sports_results_select_member ON public.sports_results;
DROP POLICY IF EXISTS sports_results_insert_staff ON public.sports_results;
DROP POLICY IF EXISTS sports_results_select_admin_referee ON public.sports_results;
DROP POLICY IF EXISTS sports_results_insert_admin_referee ON public.sports_results;
DROP POLICY IF EXISTS sports_results_update_admin ON public.sports_results;
DROP POLICY IF EXISTS sports_results_delete_admin ON public.sports_results;

-- An active user can resolve only organizations for which they have
-- an active membership. Membership rows themselves remain self-readable only.
CREATE POLICY sports_tenants_select_active_member
ON public.sports_tenants
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sports_tenant_memberships AS m
    WHERE m.tenant_id = sports_tenants.id
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
  )
);

CREATE POLICY sports_tenant_memberships_select_self
ON public.sports_tenant_memberships
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

-- Admin/owner: manage member records. Referee: read operational member data.
-- Member/coach/staff self-service is denied until a verified profile-to-member
-- identity link and a dedicated least-privilege portal policy are implemented.
CREATE POLICY sports_members_select_admin_referee
ON public.sports_members
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sports_tenant_memberships AS m
    WHERE m.tenant_id = sports_members.tenant_id
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
      AND m.role IN ('owner', 'admin', 'referee')
  )
);

CREATE POLICY sports_members_insert_admin
ON public.sports_members
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sports_tenant_memberships AS m
    WHERE m.tenant_id = sports_members.tenant_id
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
      AND m.role IN ('owner', 'admin')
  )
);

CREATE POLICY sports_members_update_admin
ON public.sports_members
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sports_tenant_memberships AS m
    WHERE m.tenant_id = sports_members.tenant_id
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
      AND m.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sports_tenant_memberships AS m
    WHERE m.tenant_id = sports_members.tenant_id
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
      AND m.role IN ('owner', 'admin')
  )
);

CREATE POLICY sports_members_delete_admin
ON public.sports_members
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sports_tenant_memberships AS m
    WHERE m.tenant_id = sports_members.tenant_id
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
      AND m.role IN ('owner', 'admin')
  )
);

-- Admin/owner manage events; referees may read them but cannot alter them.
CREATE POLICY sports_events_select_admin_referee
ON public.sports_events
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sports_tenant_memberships AS m
    WHERE m.tenant_id = sports_events.tenant_id
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
      AND m.role IN ('owner', 'admin', 'referee')
  )
);

CREATE POLICY sports_events_insert_admin
ON public.sports_events
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sports_tenant_memberships AS m
    WHERE m.tenant_id = sports_events.tenant_id
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
      AND m.role IN ('owner', 'admin')
  )
);

CREATE POLICY sports_events_update_admin
ON public.sports_events
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sports_tenant_memberships AS m
    WHERE m.tenant_id = sports_events.tenant_id
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
      AND m.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sports_tenant_memberships AS m
    WHERE m.tenant_id = sports_events.tenant_id
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
      AND m.role IN ('owner', 'admin')
  )
);

CREATE POLICY sports_events_delete_admin
ON public.sports_events
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sports_tenant_memberships AS m
    WHERE m.tenant_id = sports_events.tenant_id
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
      AND m.role IN ('owner', 'admin')
  )
);

-- Admin/owner manage results. Referees may read and insert results only.
CREATE POLICY sports_results_select_admin_referee
ON public.sports_results
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sports_tenant_memberships AS m
    WHERE m.tenant_id = sports_results.tenant_id
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
      AND m.role IN ('owner', 'admin', 'referee')
  )
);

CREATE POLICY sports_results_insert_admin_referee
ON public.sports_results
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sports_tenant_memberships AS m
    WHERE m.tenant_id = sports_results.tenant_id
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
      AND m.role IN ('owner', 'admin', 'referee')
  )
);

CREATE POLICY sports_results_update_admin
ON public.sports_results
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sports_tenant_memberships AS m
    WHERE m.tenant_id = sports_results.tenant_id
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
      AND m.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sports_tenant_memberships AS m
    WHERE m.tenant_id = sports_results.tenant_id
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
      AND m.role IN ('owner', 'admin')
  )
);

CREATE POLICY sports_results_delete_admin
ON public.sports_results
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sports_tenant_memberships AS m
    WHERE m.tenant_id = sports_results.tenant_id
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
      AND m.role IN ('owner', 'admin')
  )
);

-- Prevent an otherwise-authorized update from moving a record to another tenant.
CREATE OR REPLACE FUNCTION public.sports_prevent_tenant_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'tenant_id is immutable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sports_prevent_tenant_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sports_members_tenant_immutable ON public.sports_members;
CREATE TRIGGER sports_members_tenant_immutable
BEFORE UPDATE ON public.sports_members
FOR EACH ROW EXECUTE FUNCTION public.sports_prevent_tenant_change();

DROP TRIGGER IF EXISTS sports_events_tenant_immutable ON public.sports_events;
CREATE TRIGGER sports_events_tenant_immutable
BEFORE UPDATE ON public.sports_events
FOR EACH ROW EXECUTE FUNCTION public.sports_prevent_tenant_change();

DROP TRIGGER IF EXISTS sports_results_tenant_immutable ON public.sports_results;
CREATE TRIGGER sports_results_tenant_immutable
BEFORE UPDATE ON public.sports_results
FOR EACH ROW EXECUTE FUNCTION public.sports_prevent_tenant_change();

-- Deliberately no policies or client write grants for tenant provisioning or
-- membership provisioning. Those operations remain owner-controlled.
