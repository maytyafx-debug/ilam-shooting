-- METATYA Sports OS application tables.
-- Additive migration: all operational tables are namespaced with sports_ and isolated
-- in the sports_core schema. This migration does not alter legacy public tables.
CREATE SCHEMA IF NOT EXISTS sports_core;

CREATE TABLE IF NOT EXISTS sports_core.sports_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  role text NOT NULL DEFAULT 'member'
    CHECK (role IN ('admin', 'referee', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sports_core.sports_clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  address text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sports_core.sports_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid UNIQUE REFERENCES sports_core.sports_profiles(id) ON DELETE SET NULL,
  club_id uuid REFERENCES sports_core.sports_clubs(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  membership_number text UNIQUE,
  phone text,
  birth_date date,
  sport_type text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sports_core.sports_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid REFERENCES sports_core.sports_clubs(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  sport_type text NOT NULL,
  event_date timestamptz NOT NULL,
  location text,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'ongoing', 'completed', 'cancelled')),
  created_by uuid REFERENCES sports_core.sports_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sports_core.sports_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES sports_core.sports_events(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES sports_core.sports_members(id) ON DELETE CASCADE,
  score numeric(12, 3),
  rank integer CHECK (rank IS NULL OR rank > 0),
  notes text,
  recorded_by uuid NOT NULL REFERENCES sports_core.sports_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, member_id)
);

CREATE TABLE IF NOT EXISTS sports_core.sports_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES sports_core.sports_profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sports_members_club_idx ON sports_core.sports_members(club_id);
CREATE INDEX IF NOT EXISTS sports_members_profile_idx ON sports_core.sports_members(profile_id);
CREATE INDEX IF NOT EXISTS sports_events_date_idx ON sports_core.sports_events(event_date);
CREATE INDEX IF NOT EXISTS sports_results_member_idx ON sports_core.sports_results(member_id);
CREATE INDEX IF NOT EXISTS sports_results_event_idx ON sports_core.sports_results(event_id);
CREATE INDEX IF NOT EXISTS sports_audit_created_idx ON sports_core.sports_audit_logs(created_at DESC);

CREATE OR REPLACE FUNCTION sports_core.sports_current_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.role
  FROM sports_core.sports_profiles AS p
  WHERE p.id = (SELECT auth.uid())
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION sports_core.sports_current_role() FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA sports_core TO authenticated;
GRANT EXECUTE ON FUNCTION sports_core.sports_current_role() TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  sports_core.sports_profiles,
  sports_core.sports_clubs,
  sports_core.sports_members,
  sports_core.sports_events,
  sports_core.sports_results,
  sports_core.sports_audit_logs
TO authenticated;

ALTER TABLE sports_core.sports_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports_core.sports_clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports_core.sports_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports_core.sports_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports_core.sports_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports_core.sports_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sports_profiles_self_or_admin_read ON sports_core.sports_profiles;
CREATE POLICY sports_profiles_self_or_admin_read
ON sports_core.sports_profiles FOR SELECT TO authenticated
USING (id = (SELECT auth.uid()) OR sports_core.sports_current_role() = 'admin');

DROP POLICY IF EXISTS sports_profiles_admin_insert ON sports_core.sports_profiles;
CREATE POLICY sports_profiles_admin_insert
ON sports_core.sports_profiles FOR INSERT TO authenticated
WITH CHECK (sports_core.sports_current_role() = 'admin');

DROP POLICY IF EXISTS sports_profiles_admin_update ON sports_core.sports_profiles;
CREATE POLICY sports_profiles_admin_update
ON sports_core.sports_profiles FOR UPDATE TO authenticated
USING (sports_core.sports_current_role() = 'admin')
WITH CHECK (sports_core.sports_current_role() = 'admin');

DROP POLICY IF EXISTS sports_profiles_admin_delete ON sports_core.sports_profiles;
CREATE POLICY sports_profiles_admin_delete
ON sports_core.sports_profiles FOR DELETE TO authenticated
USING (sports_core.sports_current_role() = 'admin');

DROP POLICY IF EXISTS sports_clubs_admin_all ON sports_core.sports_clubs;
CREATE POLICY sports_clubs_admin_all
ON sports_core.sports_clubs FOR ALL TO authenticated
USING (sports_core.sports_current_role() = 'admin')
WITH CHECK (sports_core.sports_current_role() = 'admin');

DROP POLICY IF EXISTS sports_clubs_referee_read ON sports_core.sports_clubs;
CREATE POLICY sports_clubs_referee_read
ON sports_core.sports_clubs FOR SELECT TO authenticated
USING (sports_core.sports_current_role() = 'referee');

DROP POLICY IF EXISTS sports_members_admin_all ON sports_core.sports_members;
CREATE POLICY sports_members_admin_all
ON sports_core.sports_members FOR ALL TO authenticated
USING (sports_core.sports_current_role() = 'admin')
WITH CHECK (sports_core.sports_current_role() = 'admin');

DROP POLICY IF EXISTS sports_members_referee_read ON sports_core.sports_members;
CREATE POLICY sports_members_referee_read
ON sports_core.sports_members FOR SELECT TO authenticated
USING (sports_core.sports_current_role() = 'referee');

DROP POLICY IF EXISTS sports_members_self_read ON sports_core.sports_members;
CREATE POLICY sports_members_self_read
ON sports_core.sports_members FOR SELECT TO authenticated
USING (profile_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS sports_events_admin_all ON sports_core.sports_events;
CREATE POLICY sports_events_admin_all
ON sports_core.sports_events FOR ALL TO authenticated
USING (sports_core.sports_current_role() = 'admin')
WITH CHECK (sports_core.sports_current_role() = 'admin');

DROP POLICY IF EXISTS sports_events_referee_read ON sports_core.sports_events;
CREATE POLICY sports_events_referee_read
ON sports_core.sports_events FOR SELECT TO authenticated
USING (sports_core.sports_current_role() = 'referee');

DROP POLICY IF EXISTS sports_results_admin_all ON sports_core.sports_results;
CREATE POLICY sports_results_admin_all
ON sports_core.sports_results FOR ALL TO authenticated
USING (sports_core.sports_current_role() = 'admin')
WITH CHECK (sports_core.sports_current_role() = 'admin');

DROP POLICY IF EXISTS sports_results_referee_insert ON sports_core.sports_results;
CREATE POLICY sports_results_referee_insert
ON sports_core.sports_results FOR INSERT TO authenticated
WITH CHECK (
  sports_core.sports_current_role() = 'referee'
  AND recorded_by = (SELECT auth.uid())
);

DROP POLICY IF EXISTS sports_results_member_self_read ON sports_core.sports_results;
CREATE POLICY sports_results_member_self_read
ON sports_core.sports_results FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM sports_core.sports_members AS m
    WHERE m.id = sports_results.member_id
      AND m.profile_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS sports_audit_admin_read ON sports_core.sports_audit_logs;
CREATE POLICY sports_audit_admin_read
ON sports_core.sports_audit_logs FOR SELECT TO authenticated
USING (sports_core.sports_current_role() = 'admin');

CREATE OR REPLACE FUNCTION sports_core.sports_write_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  record_uuid uuid;
BEGIN
  record_uuid := (to_jsonb(NEW)->>'id')::uuid;
  INSERT INTO sports_core.sports_audit_logs(user_id, action, table_name, record_id, details)
  VALUES (
    auth.uid(),
    lower(TG_OP),
    TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,
    record_uuid,
    jsonb_build_object('source', 'database_trigger')
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION sports_core.sports_write_audit_log() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sports_members_audit_trigger ON sports_core.sports_members;
CREATE TRIGGER sports_members_audit_trigger
AFTER INSERT OR UPDATE ON sports_core.sports_members
FOR EACH ROW EXECUTE FUNCTION sports_core.sports_write_audit_log();

DROP TRIGGER IF EXISTS sports_events_audit_trigger ON sports_core.sports_events;
CREATE TRIGGER sports_events_audit_trigger
AFTER INSERT OR UPDATE ON sports_core.sports_events
FOR EACH ROW EXECUTE FUNCTION sports_core.sports_write_audit_log();

DROP TRIGGER IF EXISTS sports_results_audit_trigger ON sports_core.sports_results;
CREATE TRIGGER sports_results_audit_trigger
AFTER INSERT ON sports_core.sports_results
FOR EACH ROW EXECUTE FUNCTION sports_core.sports_write_audit_log();

-- The first administrator must be provisioned by a trusted owner-controlled process.
-- Never allow public self-registration to assign privileged roles.
