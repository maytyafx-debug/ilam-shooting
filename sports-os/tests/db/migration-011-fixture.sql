-- Disposable schema fixture for migrations 010 and 011.
-- Models only the base-009 tables/columns used by the personal-portal migration.
-- All identities and records are synthetic; never run against a live project.

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END
$roles$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text UNIQUE NOT NULL,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;

CREATE TABLE public.sports_tenants (
  id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'active'
);

CREATE TABLE public.sports_tenant_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.sports_tenants(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role text NOT NULL,
  status text NOT NULL,
  UNIQUE (tenant_id, user_id)
);

CREATE TABLE public.sports_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.sports_tenants(id),
  user_id uuid REFERENCES auth.users(id),
  full_name text NOT NULL,
  UNIQUE (id, tenant_id)
);

CREATE TABLE public.sports_athlete_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.sports_tenants(id),
  member_id uuid NOT NULL,
  birth_date date,
  membership_number text,
  athlete_category text,
  UNIQUE (member_id, tenant_id),
  FOREIGN KEY (member_id, tenant_id)
    REFERENCES public.sports_members(id, tenant_id)
);

CREATE TABLE public.sports_events (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.sports_tenants(id),
  title text NOT NULL,
  UNIQUE (id, tenant_id)
);

CREATE TABLE public.sports_results (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.sports_tenants(id),
  member_id uuid NOT NULL,
  event_id uuid NOT NULL,
  score numeric,
  verification_status text NOT NULL DEFAULT 'pending_review'
    CHECK (verification_status IN ('pending_review', 'verified', 'rejected')),
  verified_by uuid,
  verified_at timestamptz,
  FOREIGN KEY (member_id, tenant_id)
    REFERENCES public.sports_members(id, tenant_id),
  FOREIGN KEY (event_id, tenant_id)
    REFERENCES public.sports_events(id, tenant_id)
);

CREATE TABLE public.sports_event_entries (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.sports_tenants(id),
  member_id uuid NOT NULL,
  event_id uuid NOT NULL,
  FOREIGN KEY (member_id, tenant_id)
    REFERENCES public.sports_members(id, tenant_id),
  FOREIGN KEY (event_id, tenant_id)
    REFERENCES public.sports_events(id, tenant_id)
);

ALTER TABLE public.sports_tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_tenant_memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY sports_tenant_memberships_select_self
ON public.sports_tenant_memberships
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

ALTER TABLE public.sports_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_members FORCE ROW LEVEL SECURITY;
CREATE POLICY sports_members_select_admin
ON public.sports_members
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sports_tenant_memberships tm
    WHERE tm.tenant_id = sports_members.tenant_id
      AND tm.user_id = (SELECT auth.uid())
      AND tm.status = 'active'
      AND tm.role IN ('owner', 'admin', 'referee')
  )
);
ALTER TABLE public.sports_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_results FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sports_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sports_event_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_event_entries FORCE ROW LEVEL SECURITY;

CREATE POLICY sports_results_select_admin
ON public.sports_results
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sports_tenant_memberships tm
    WHERE tm.tenant_id = sports_results.tenant_id
      AND tm.user_id = (SELECT auth.uid())
      AND tm.status = 'active'
      AND tm.role IN ('owner', 'admin', 'referee')
  )
);

CREATE POLICY sports_results_update_admin
ON public.sports_results
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sports_tenant_memberships tm
    WHERE tm.tenant_id = sports_results.tenant_id
      AND tm.user_id = (SELECT auth.uid())
      AND tm.status = 'active'
      AND tm.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sports_tenant_memberships tm
    WHERE tm.tenant_id = sports_results.tenant_id
      AND tm.user_id = (SELECT auth.uid())
      AND tm.status = 'active'
      AND tm.role IN ('owner', 'admin')
  )
);

GRANT SELECT ON public.sports_tenant_memberships TO authenticated;
GRANT SELECT ON public.sports_members, public.sports_results,
  public.sports_events, public.sports_event_entries TO authenticated;
GRANT UPDATE ON public.sports_results TO authenticated;

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', 'owner@example.test', now(), '{"full_name":"Pilot Owner"}'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'athlete@example.test', now(), '{"full_name":"Linked Member"}'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'coach@example.test', now(), '{"full_name":"Linked Coach"}'),
  ('aaaaaaaa-0000-4000-8000-000000000004', 'referee@example.test', now(), '{"full_name":"Linked Referee"}'),
  ('aaaaaaaa-0000-4000-8000-000000000005', 'unconfirmed@example.test', NULL, '{"full_name":"Unconfirmed"}'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'other-owner@example.test', now(), '{"full_name":"Other Tenant Owner"}');

INSERT INTO public.sports_tenants (id, status) VALUES
  ('11111111-1111-4111-8111-111111111111', 'active'),
  ('22222222-2222-4222-8222-222222222222', 'active');

INSERT INTO public.sports_tenant_memberships (tenant_id, user_id, role, status) VALUES
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001', 'owner', 'active'),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-0000-4000-8000-000000000001', 'admin', 'active');

INSERT INTO public.sports_members (id, tenant_id, user_id, full_name) VALUES
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', '11111111-1111-4111-8111-111111111111', NULL, 'Linked Member'),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', '22222222-2222-4222-8222-222222222222', NULL, 'Other Tenant Member');

INSERT INTO public.sports_athlete_profiles (tenant_id, member_id, membership_number) VALUES
  ('11111111-1111-4111-8111-111111111111', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'M-001'),
  ('22222222-2222-4222-8222-222222222222', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'M-002');

INSERT INTO public.sports_events (id, tenant_id, title) VALUES
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', '11111111-1111-4111-8111-111111111111', 'Tenant One Event'),
  ('ffffffff-ffff-4fff-8fff-fffffffffff1', '22222222-2222-4222-8222-222222222222', 'Tenant Two Event');

INSERT INTO public.sports_results (id, tenant_id, member_id, event_id, score) VALUES
  ('99999999-9999-4999-8999-999999999991', '11111111-1111-4111-8111-111111111111', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 8.5),
  ('99999999-9999-4999-8999-999999999992', '22222222-2222-4222-8222-222222222222', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'ffffffff-ffff-4fff-8fff-fffffffffff1', 9.0);
