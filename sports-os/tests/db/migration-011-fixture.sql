-- Disposable PostgreSQL fixture for Migration 011; runs after Migration 010 fixture.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY);
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

CREATE TABLE IF NOT EXISTS public.sports_tenants (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS public.sports_tenant_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  UNIQUE (tenant_id,user_id)
);
ALTER TABLE public.sports_tenant_memberships ALTER COLUMN id SET DEFAULT gen_random_uuid();
GRANT SELECT ON public.sports_tenant_memberships TO authenticated;
