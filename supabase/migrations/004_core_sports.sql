-- METATYA Sports OS shared Core layer; additive and isolated.
CREATE SCHEMA IF NOT EXISTS sports_core;

CREATE TABLE IF NOT EXISTS sports_core.profiles (
 id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 full_name text NOT NULL, email text,
 role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin','referee','member')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sports_core.clubs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
 description text, address text, phone text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sports_core.members (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 profile_id uuid UNIQUE REFERENCES sports_core.profiles(id) ON DELETE SET NULL,
 club_id uuid REFERENCES sports_core.clubs(id) ON DELETE SET NULL,
 full_name text NOT NULL, membership_number text UNIQUE, phone text, birth_date date,
 sport_type text, status text NOT NULL DEFAULT 'active'
 CHECK (status IN ('active','inactive','suspended')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sports_core.events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 club_id uuid REFERENCES sports_core.clubs(id) ON DELETE SET NULL,
 title text NOT NULL, description text, sport_type text NOT NULL,
 event_date timestamptz NOT NULL, location text,
 status text NOT NULL DEFAULT 'scheduled'
 CHECK (status IN ('scheduled','ongoing','completed','cancelled')),
 created_by uuid REFERENCES sports_core.profiles(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sports_core.results (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id uuid NOT NULL REFERENCES sports_core.events(id) ON DELETE CASCADE,
 member_id uuid NOT NULL REFERENCES sports_core.members(id) ON DELETE CASCADE,
 score numeric(12,3), rank integer CHECK (rank IS NULL OR rank > 0),
 notes text, recorded_by uuid NOT NULL REFERENCES sports_core.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(event_id,member_id)
);
CREATE TABLE IF NOT EXISTS sports_core.audit_logs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid REFERENCES sports_core.profiles(id) ON DELETE SET NULL,
 action text NOT NULL, table_name text NOT NULL, record_id uuid,
 details jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_core_members_club ON sports_core.members(club_id);
CREATE INDEX IF NOT EXISTS idx_core_members_profile ON sports_core.members(profile_id);
CREATE INDEX IF NOT EXISTS idx_core_events_date ON sports_core.events(event_date);
CREATE INDEX IF NOT EXISTS idx_core_results_member ON sports_core.results(member_id);
CREATE INDEX IF NOT EXISTS idx_core_results_event ON sports_core.results(event_id);
CREATE INDEX IF NOT EXISTS idx_core_audit_created ON sports_core.audit_logs(created_at DESC);

CREATE OR REPLACE FUNCTION sports_core.current_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
 SELECT p.role FROM sports_core.profiles p WHERE p.id = (SELECT auth.uid()) LIMIT 1
$$;
REVOKE ALL ON FUNCTION sports_core.current_role() FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA sports_core TO authenticated;
GRANT EXECUTE ON FUNCTION sports_core.current_role() TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sports_core TO authenticated;

ALTER TABLE sports_core.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports_core.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports_core.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports_core.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports_core.results ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports_core.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_self_or_admin_read ON sports_core.profiles FOR SELECT TO authenticated
 USING (id = (SELECT auth.uid()) OR sports_core.current_role() = 'admin');
CREATE POLICY profiles_admin_insert ON sports_core.profiles FOR INSERT TO authenticated
 WITH CHECK (sports_core.current_role() = 'admin');
CREATE POLICY profiles_admin_update ON sports_core.profiles FOR UPDATE TO authenticated
 USING (sports_core.current_role() = 'admin') WITH CHECK (sports_core.current_role() = 'admin');
CREATE POLICY profiles_admin_delete ON sports_core.profiles FOR DELETE TO authenticated
 USING (sports_core.current_role() = 'admin');

CREATE POLICY clubs_admin_all ON sports_core.clubs FOR ALL TO authenticated
 USING (sports_core.current_role() = 'admin') WITH CHECK (sports_core.current_role() = 'admin');
CREATE POLICY clubs_referee_read ON sports_core.clubs FOR SELECT TO authenticated
 USING (sports_core.current_role() = 'referee');

CREATE POLICY members_admin_all ON sports_core.members FOR ALL TO authenticated
 USING (sports_core.current_role() = 'admin') WITH CHECK (sports_core.current_role() = 'admin');
CREATE POLICY members_referee_read ON sports_core.members FOR SELECT TO authenticated
 USING (sports_core.current_role() = 'referee');
CREATE POLICY members_self_read ON sports_core.members FOR SELECT TO authenticated
 USING (profile_id = (SELECT auth.uid()));

CREATE POLICY events_admin_all ON sports_core.events FOR ALL TO authenticated
 USING (sports_core.current_role() = 'admin') WITH CHECK (sports_core.current_role() = 'admin');
CREATE POLICY events_referee_read ON sports_core.events FOR SELECT TO authenticated
 USING (sports_core.current_role() = 'referee');

CREATE POLICY results_admin_all ON sports_core.results FOR ALL TO authenticated
 USING (sports_core.current_role() = 'admin') WITH CHECK (sports_core.current_role() = 'admin');
CREATE POLICY results_referee_insert ON sports_core.results FOR INSERT TO authenticated
 WITH CHECK (sports_core.current_role() = 'referee' AND recorded_by = (SELECT auth.uid()));
CREATE POLICY results_member_self_read ON sports_core.results FOR SELECT TO authenticated
 USING (EXISTS (
   SELECT 1 FROM sports_core.members m
   WHERE m.id = results.member_id AND m.profile_id = (SELECT auth.uid())
 ));

CREATE POLICY audit_admin_all ON sports_core.audit_logs FOR ALL TO authenticated
 USING (sports_core.current_role() = 'admin') WITH CHECK (sports_core.current_role() = 'admin');

CREATE OR REPLACE FUNCTION sports_core.write_audit_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE rid uuid;
BEGIN
 rid := (to_jsonb(NEW)->>'id')::uuid;
 INSERT INTO sports_core.audit_logs(user_id,action,table_name,record_id,details)
 VALUES (auth.uid(),lower(TG_OP),TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME,rid,
         jsonb_build_object('source','database_trigger'));
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION sports_core.write_audit_log() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER core_members_audit AFTER INSERT OR UPDATE ON sports_core.members
 FOR EACH ROW EXECUTE FUNCTION sports_core.write_audit_log();
CREATE TRIGGER core_events_audit AFTER INSERT OR UPDATE ON sports_core.events
 FOR EACH ROW EXECUTE FUNCTION sports_core.write_audit_log();
CREATE TRIGGER core_results_audit AFTER INSERT ON sports_core.results
 FOR EACH ROW EXECUTE FUNCTION sports_core.write_audit_log();

-- Provision the first admin profile manually in Supabase SQL Editor after creating its Auth user.
-- Never allow users to assign their own role.
