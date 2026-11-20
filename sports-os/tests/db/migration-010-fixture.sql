-- Disposable PostgreSQL fixture for Migration 010 integration tests.
-- This intentionally models the relevant Supabase auth.uid(), roles, RLS,
-- and tenant-membership policies. It contains no production data.

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;

CREATE TABLE public.sports_tenant_memberships (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL,
  status text NOT NULL
);

CREATE TABLE public.sports_results (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  score numeric,
  verification_status text NOT NULL DEFAULT 'pending_review'
    CHECK (verification_status IN ('pending_review', 'verified', 'rejected')),
  verified_by uuid,
  verified_at timestamptz
);

ALTER TABLE public.sports_tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_tenant_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sports_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_results FORCE ROW LEVEL SECURITY;

GRANT SELECT ON public.sports_tenant_memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.sports_results TO authenticated;
GRANT ALL ON public.sports_results TO service_role;

CREATE POLICY sports_tenant_memberships_select_self
ON public.sports_tenant_memberships
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY sports_results_select_member
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

CREATE POLICY sports_results_insert_member
ON public.sports_results
FOR INSERT TO authenticated
WITH CHECK (
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

INSERT INTO public.sports_tenant_memberships (id, tenant_id, user_id, role, status) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001', 'owner', 'active'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000002', 'referee', 'active'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '22222222-2222-4222-8222-222222222222', 'bbbbbbbb-0000-4000-8000-000000000001', 'admin', 'active');

INSERT INTO public.sports_results (id, tenant_id, score) VALUES
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', '11111111-1111-4111-8111-111111111111', 8.5);
