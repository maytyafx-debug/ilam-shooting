-- Disposable fixture for Migration 013 champion QR card integration tests.
CREATE TABLE IF NOT EXISTS public.sports_members (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, full_name text NOT NULL,
 sport_type text, status text NOT NULL DEFAULT 'active', UNIQUE(id,tenant_id)
);
CREATE TABLE IF NOT EXISTS public.sports_athlete_profiles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, member_id uuid NOT NULL,
 birth_date date, athlete_category text, UNIQUE(member_id,tenant_id)
);
CREATE TABLE IF NOT EXISTS public.sports_guardian_consents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, member_id uuid NOT NULL,
 consent_scope text NOT NULL, consented_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz, revoked_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.sports_events (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, title text NOT NULL,
 sport_type text NOT NULL, event_date date NOT NULL, UNIQUE(id,tenant_id)
);
ALTER TABLE public.sports_results ADD COLUMN IF NOT EXISTS member_id uuid;
ALTER TABLE public.sports_results ADD COLUMN IF NOT EXISTS event_id uuid;
ALTER TABLE public.sports_results ADD COLUMN IF NOT EXISTS rank integer;
CREATE OR REPLACE FUNCTION public.sports_athlete_public_cards_prevent_tenant_change()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $tenant_guard$
BEGIN
 IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
  RAISE EXCEPTION 'Tenant ID cannot be changed' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END;
$tenant_guard$;
