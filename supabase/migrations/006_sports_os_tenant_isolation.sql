-- METATYA Sports OS tenant isolation for operational sports_core tables.
-- REVIEWED DRAFT: do not apply to a live database until the owner approves the
-- single-pilot backfill and verifies a restorable backup.
-- Tenant selection arrives through x-tenant-id. The database independently
-- verifies active membership; the header is never treated as authorization.

CREATE TABLE IF NOT EXISTS sports_core.sports_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sports_core.sports_tenant_memberships (
  tenant_id uuid NOT NULL REFERENCES sports_core.sports_tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('tenant_admin','referee','athlete')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('invited','active','disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,user_id)
);

-- Existing pilot data is deliberately grouped into ONE pilot tenant.
-- If the existing database already contains multiple organizations, stop and
-- design a tenant-by-tenant mapping before applying this migration.
INSERT INTO sports_core.sports_tenants (slug,display_name,status)
VALUES ('ilam-shooting-pilot','Ilam Shooting Pilot','active')
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE sports_core.sports_clubs ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE sports_core.sports_members ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE sports_core.sports_events ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE sports_core.sports_results ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE sports_core.sports_audit_logs ADD COLUMN IF NOT EXISTS tenant_id uuid;

UPDATE sports_core.sports_clubs SET tenant_id = (
  SELECT id FROM sports_core.sports_tenants WHERE slug='ilam-shooting-pilot'
) WHERE tenant_id IS NULL;
UPDATE sports_core.sports_members SET tenant_id = (
  SELECT id FROM sports_core.sports_tenants WHERE slug='ilam-shooting-pilot'
) WHERE tenant_id IS NULL;
UPDATE sports_core.sports_events SET tenant_id = (
  SELECT id FROM sports_core.sports_tenants WHERE slug='ilam-shooting-pilot'
) WHERE tenant_id IS NULL;
UPDATE sports_core.sports_results SET tenant_id = (
  SELECT id FROM sports_core.sports_tenants WHERE slug='ilam-shooting-pilot'
) WHERE tenant_id IS NULL;
UPDATE sports_core.sports_audit_logs SET tenant_id = (
  SELECT id FROM sports_core.sports_tenants WHERE slug='ilam-shooting-pilot'
) WHERE tenant_id IS NULL;

ALTER TABLE sports_core.sports_clubs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE sports_core.sports_members ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE sports_core.sports_events ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE sports_core.sports_results ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE sports_core.sports_audit_logs ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE sports_core.sports_clubs
  ADD CONSTRAINT sports_clubs_tenant_fk FOREIGN KEY (tenant_id)
  REFERENCES sports_core.sports_tenants(id);
ALTER TABLE sports_core.sports_members
  ADD CONSTRAINT sports_members_tenant_fk FOREIGN KEY (tenant_id)
  REFERENCES sports_core.sports_tenants(id);
ALTER TABLE sports_core.sports_events
  ADD CONSTRAINT sports_events_tenant_fk FOREIGN KEY (tenant_id)
  REFERENCES sports_core.sports_tenants(id);
ALTER TABLE sports_core.sports_results
  ADD CONSTRAINT sports_results_tenant_fk FOREIGN KEY (tenant_id)
  REFERENCES sports_core.sports_tenants(id);
ALTER TABLE sports_core.sports_audit_logs
  ADD CONSTRAINT sports_audit_tenant_fk FOREIGN KEY (tenant_id)
  REFERENCES sports_core.sports_tenants(id);

CREATE UNIQUE INDEX IF NOT EXISTS sports_clubs_id_tenant_uq
  ON sports_core.sports_clubs(id,tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS sports_members_id_tenant_uq
  ON sports_core.sports_members(id,tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS sports_events_id_tenant_uq
  ON sports_core.sports_events(id,tenant_id);

-- Composite foreign keys prevent records from linking across tenants.
ALTER TABLE sports_core.sports_members
  ADD CONSTRAINT sports_members_club_tenant_fk
  FOREIGN KEY (club_id,tenant_id)
  REFERENCES sports_core.sports_clubs(id,tenant_id);
ALTER TABLE sports_core.sports_events
  ADD CONSTRAINT sports_events_club_tenant_fk
  FOREIGN KEY (club_id,tenant_id)
  REFERENCES sports_core.sports_clubs(id,tenant_id);
ALTER TABLE sports_core.sports_results
  ADD CONSTRAINT sports_results_member_tenant_fk
  FOREIGN KEY (member_id,tenant_id)
  REFERENCES sports_core.sports_members(id,tenant_id);
ALTER TABLE sports_core.sports_results
  ADD CONSTRAINT sports_results_event_tenant_fk
  FOREIGN KEY (event_id,tenant_id)
  REFERENCES sports_core.sports_events(id,tenant_id);


-- Identifiers are tenant-scoped: different organizations may reuse the same
-- membership number, and one Auth user may have a member record per tenant.
ALTER TABLE sports_core.sports_members
  DROP CONSTRAINT IF EXISTS sports_members_profile_id_key;
ALTER TABLE sports_core.sports_members
  DROP CONSTRAINT IF EXISTS sports_members_membership_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS sports_members_profile_tenant_uq
  ON sports_core.sports_members(profile_id,tenant_id)
  WHERE profile_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sports_members_number_tenant_uq
  ON sports_core.sports_members(tenant_id,membership_number)
  WHERE membership_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS sports_members_tenant_idx
  ON sports_core.sports_members(tenant_id,created_at DESC);
CREATE INDEX IF NOT EXISTS sports_events_tenant_date_idx
  ON sports_core.sports_events(tenant_id,event_date);
CREATE INDEX IF NOT EXISTS sports_results_tenant_idx
  ON sports_core.sports_results(tenant_id,event_id,member_id);
CREATE INDEX IF NOT EXISTS sports_audit_tenant_idx
  ON sports_core.sports_audit_logs(tenant_id,created_at DESC);

-- Backfill legacy global roles into the first tenant only. Membership writes
-- remain owner-controlled; authenticated users receive read access only.
INSERT INTO sports_core.sports_tenant_memberships(tenant_id,user_id,role,status)
SELECT t.id,p.id,
  CASE p.role WHEN 'admin' THEN 'tenant_admin'
              WHEN 'referee' THEN 'referee'
              ELSE 'athlete' END,
  'active'
FROM sports_core.sports_profiles p
CROSS JOIN sports_core.sports_tenants t
WHERE t.slug='ilam-shooting-pilot'
ON CONFLICT (tenant_id,user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION sports_core.sports_current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
SET row_security = off
AS $$
DECLARE
  requested_tenant uuid;
BEGIN
  requested_tenant := nullif(
    (nullif(current_setting('request.headers',true),'')::jsonb ->> 'x-tenant-id'),
    ''
  )::uuid;

  IF requested_tenant IS NULL THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM sports_core.sports_tenant_memberships m
    JOIN sports_core.sports_tenants t ON t.id=m.tenant_id
    WHERE m.tenant_id=requested_tenant
      AND m.user_id=(SELECT auth.uid())
      AND m.status='active'
      AND t.status='active'
  ) THEN
    RETURN requested_tenant;
  END IF;
  RETURN NULL;
EXCEPTION WHEN invalid_text_representation OR invalid_parameter_value THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION sports_core.sports_has_tenant_role(
  target_tenant uuid, allowed_roles text[]
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sports_core.sports_tenant_memberships m
    WHERE m.tenant_id=target_tenant
      AND m.user_id=(SELECT auth.uid())
      AND m.status='active'
      AND m.role=ANY(allowed_roles)
      AND target_tenant=sports_core.sports_current_tenant_id()
  )
$$;

REVOKE ALL ON FUNCTION sports_core.sports_current_tenant_id() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION sports_core.sports_has_tenant_role(uuid,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION sports_core.sports_current_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION sports_core.sports_has_tenant_role(uuid,text[]) TO authenticated;
GRANT SELECT ON sports_core.sports_tenants,sports_core.sports_tenant_memberships TO authenticated;
GRANT ALL ON sports_core.sports_tenants,sports_core.sports_tenant_memberships TO service_role;
ALTER TABLE sports_core.sports_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports_core.sports_tenant_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sports_profiles_self_or_admin_read ON sports_core.sports_profiles;
DROP POLICY IF EXISTS sports_profiles_admin_insert ON sports_core.sports_profiles;
DROP POLICY IF EXISTS sports_profiles_admin_update ON sports_core.sports_profiles;
DROP POLICY IF EXISTS sports_profiles_admin_delete ON sports_core.sports_profiles;
DROP POLICY IF EXISTS sports_clubs_admin_all ON sports_core.sports_clubs;
DROP POLICY IF EXISTS sports_clubs_referee_read ON sports_core.sports_clubs;
DROP POLICY IF EXISTS sports_members_admin_all ON sports_core.sports_members;
DROP POLICY IF EXISTS sports_members_referee_read ON sports_core.sports_members;
DROP POLICY IF EXISTS sports_members_self_read ON sports_core.sports_members;
DROP POLICY IF EXISTS sports_events_admin_all ON sports_core.sports_events;
DROP POLICY IF EXISTS sports_events_referee_read ON sports_core.sports_events;
DROP POLICY IF EXISTS sports_results_admin_all ON sports_core.sports_results;
DROP POLICY IF EXISTS sports_results_referee_insert ON sports_core.sports_results;
DROP POLICY IF EXISTS sports_results_member_self_read ON sports_core.sports_results;
DROP POLICY IF EXISTS sports_audit_admin_read ON sports_core.sports_audit_logs;

CREATE POLICY sports_tenants_member_read ON sports_core.sports_tenants
FOR SELECT TO authenticated
USING (id=sports_core.sports_current_tenant_id());
CREATE POLICY sports_memberships_self_or_admin_read ON sports_core.sports_tenant_memberships
FOR SELECT TO authenticated
USING (
  user_id=(SELECT auth.uid())
  OR sports_core.sports_has_tenant_role(tenant_id,ARRAY['tenant_admin'])
);

CREATE POLICY sports_profiles_self_or_tenant_admin_read ON sports_core.sports_profiles
FOR SELECT TO authenticated
USING (
  id=(SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM sports_core.sports_tenant_memberships m
    WHERE m.user_id=sports_profiles.id
      AND m.tenant_id=sports_core.sports_current_tenant_id()
      AND sports_core.sports_has_tenant_role(m.tenant_id,ARRAY['tenant_admin'])
  )
);

CREATE POLICY sports_profiles_tenant_admin_manage ON sports_core.sports_profiles
FOR ALL TO authenticated
USING (sports_core.sports_has_tenant_role(sports_core.sports_current_tenant_id(),ARRAY['tenant_admin']))
WITH CHECK (sports_core.sports_has_tenant_role(sports_core.sports_current_tenant_id(),ARRAY['tenant_admin']));

CREATE POLICY sports_clubs_tenant_admin_all ON sports_core.sports_clubs
FOR ALL TO authenticated
USING (sports_core.sports_has_tenant_role(tenant_id,ARRAY['tenant_admin']))
WITH CHECK (sports_core.sports_has_tenant_role(tenant_id,ARRAY['tenant_admin']));

CREATE POLICY sports_members_tenant_admin_all ON sports_core.sports_members
FOR ALL TO authenticated
USING (sports_core.sports_has_tenant_role(tenant_id,ARRAY['tenant_admin']))
WITH CHECK (sports_core.sports_has_tenant_role(tenant_id,ARRAY['tenant_admin']));
CREATE POLICY sports_members_referee_read ON sports_core.sports_members
FOR SELECT TO authenticated
USING (sports_core.sports_has_tenant_role(tenant_id,ARRAY['tenant_admin','referee']));
CREATE POLICY sports_members_self_read ON sports_core.sports_members
FOR SELECT TO authenticated
USING (tenant_id=sports_core.sports_current_tenant_id() AND profile_id=(SELECT auth.uid()));

CREATE POLICY sports_events_tenant_admin_all ON sports_core.sports_events
FOR ALL TO authenticated
USING (sports_core.sports_has_tenant_role(tenant_id,ARRAY['tenant_admin']))
WITH CHECK (sports_core.sports_has_tenant_role(tenant_id,ARRAY['tenant_admin']));
CREATE POLICY sports_events_referee_read ON sports_core.sports_events
FOR SELECT TO authenticated
USING (sports_core.sports_has_tenant_role(tenant_id,ARRAY['tenant_admin','referee']));

CREATE POLICY sports_results_tenant_admin_all ON sports_core.sports_results
FOR ALL TO authenticated
USING (sports_core.sports_has_tenant_role(tenant_id,ARRAY['tenant_admin']))
WITH CHECK (sports_core.sports_has_tenant_role(tenant_id,ARRAY['tenant_admin']));
CREATE POLICY sports_results_referee_insert ON sports_core.sports_results
FOR INSERT TO authenticated
WITH CHECK (
  sports_core.sports_has_tenant_role(tenant_id,ARRAY['referee','tenant_admin'])
  AND recorded_by=(SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM sports_core.sports_events e
    JOIN sports_core.sports_members m ON m.tenant_id=e.tenant_id
    WHERE e.id=sports_results.event_id
      AND m.id=sports_results.member_id
      AND e.tenant_id=sports_results.tenant_id
      AND m.tenant_id=sports_results.tenant_id
  )
);
CREATE POLICY sports_results_member_self_read ON sports_core.sports_results
FOR SELECT TO authenticated
USING (
  tenant_id=sports_core.sports_current_tenant_id()
  AND EXISTS (
    SELECT 1 FROM sports_core.sports_members m
    WHERE m.id=sports_results.member_id
      AND m.tenant_id=sports_results.tenant_id
      AND m.profile_id=(SELECT auth.uid())
  )
);

CREATE POLICY sports_audit_tenant_admin_read ON sports_core.sports_audit_logs
FOR SELECT TO authenticated
USING (sports_core.sports_has_tenant_role(tenant_id,ARRAY['tenant_admin']));

CREATE OR REPLACE FUNCTION sports_core.sports_prevent_tenant_move()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'tenant_id is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sports_clubs_tenant_immutable ON sports_core.sports_clubs;
CREATE TRIGGER sports_clubs_tenant_immutable BEFORE UPDATE ON sports_core.sports_clubs
FOR EACH ROW EXECUTE FUNCTION sports_core.sports_prevent_tenant_move();
DROP TRIGGER IF EXISTS sports_members_tenant_immutable ON sports_core.sports_members;
CREATE TRIGGER sports_members_tenant_immutable BEFORE UPDATE ON sports_core.sports_members
FOR EACH ROW EXECUTE FUNCTION sports_core.sports_prevent_tenant_move();
DROP TRIGGER IF EXISTS sports_events_tenant_immutable ON sports_core.sports_events;
CREATE TRIGGER sports_events_tenant_immutable BEFORE UPDATE ON sports_core.sports_events
FOR EACH ROW EXECUTE FUNCTION sports_core.sports_prevent_tenant_move();
DROP TRIGGER IF EXISTS sports_results_tenant_immutable ON sports_core.sports_results;
CREATE TRIGGER sports_results_tenant_immutable BEFORE UPDATE ON sports_core.sports_results
FOR EACH ROW EXECUTE FUNCTION sports_core.sports_prevent_tenant_move();
DROP TRIGGER IF EXISTS sports_audit_tenant_immutable ON sports_core.sports_audit_logs;
CREATE TRIGGER sports_audit_tenant_immutable BEFORE UPDATE ON sports_core.sports_audit_logs
FOR EACH ROW EXECUTE FUNCTION sports_core.sports_prevent_tenant_move();


-- Referees may read clubs and recorded results only inside their active tenant.
CREATE POLICY sports_clubs_referee_read ON sports_core.sports_clubs
FOR SELECT TO authenticated
USING (sports_core.sports_has_tenant_role(tenant_id,ARRAY['tenant_admin','referee']));
CREATE POLICY sports_results_referee_read ON sports_core.sports_results
FOR SELECT TO authenticated
USING (sports_core.sports_has_tenant_role(tenant_id,ARRAY['tenant_admin','referee']));

-- The original audit trigger must carry tenant_id after it becomes mandatory.
CREATE OR REPLACE FUNCTION sports_core.sports_write_audit_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $
DECLARE rid uuid;
BEGIN
  rid := (to_jsonb(NEW)->>'id')::uuid;
  INSERT INTO sports_core.sports_audit_logs(
    tenant_id,user_id,action,table_name,record_id,details
  ) VALUES (
    NEW.tenant_id,auth.uid(),lower(TG_OP),
    TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME,rid,
    jsonb_build_object('source','database_trigger')
  );
  RETURN NEW;
END;
$;

-- Tenant membership provisioning must be performed by a trusted owner-controlled
-- backend workflow. Do not grant authenticated clients membership write privileges.
