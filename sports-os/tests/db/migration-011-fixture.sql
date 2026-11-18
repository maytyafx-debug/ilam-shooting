-- Disposable PostgreSQL fixture for Migration 011 integration tests only.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY);
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE TABLE IF NOT EXISTS public.sports_tenants (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active'
);
CREATE TABLE IF NOT EXISTS public.sports_tenant_memberships (
  tenant_id uuid NOT NULL REFERENCES public.sports_tenants(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  PRIMARY KEY (tenant_id,user_id)
);
