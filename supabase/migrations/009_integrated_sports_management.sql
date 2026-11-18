-- METATYA Sports OS integrated management foundation.
-- Additive migration only: preserves existing members, events, results and memberships.
-- Tenant isolation remains enforced by RLS on every new table.

begin;

-- Link a sports record to an authenticated athlete account when explicitly assigned
-- by an organization administrator. Null remains valid for offline/non-login athletes.
alter table public.sports_members
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create unique index if not exists sports_members_tenant_user_uidx
  on public.sports_members (tenant_id, user_id)
  where user_id is not null;

-- Restricted athlete profile. Keep identity and sensitive fields separate from the
-- ordinary roster table; only admins/coaches and the linked athlete can read it.
create table if not exists public.sports_athlete_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.sports_tenants(id) on delete cascade,
  member_id uuid not null,
  birth_date date,
  gender text check (gender is null or gender in ('female','male','unspecified')),
  athlete_code text,
  development_category text,
  emergency_contact_name text,
  emergency_contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, tenant_id),
  foreign key (member_id, tenant_id)
    references public.sports_members(id, tenant_id) on delete cascade,
  check (birth_date is null or birth_date <= current_date)
);

-- Explicit, revocable guardian permissions. A separate row is required for each
-- purpose; media consent is never implied by registration/training consent.
create table if not exists public.sports_guardian_consents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.sports_tenants(id) on delete cascade,
  member_id uuid not null,
  guardian_name text not null check (length(trim(guardian_name)) between 2 and 150),
  relationship text not null check (length(trim(relationship)) between 2 and 80),
  guardian_contact text,
  consent_scope text not null check (consent_scope in ('registration','training','competition','media','data_processing')),
  consent_version text not null,
  consented_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (member_id, tenant_id)
    references public.sports_members(id, tenant_id) on delete cascade,
  check (expires_at is null or expires_at > consented_at),
  check (revoked_at is null or revoked_at >= consented_at)
);

-- Club/organization membership periods and fee state. This is not an app login role.
create table if not exists public.sports_club_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.sports_tenants(id) on delete cascade,
  member_id uuid not null,
  membership_type text not null default 'standard',
  status text not null default 'active' check (status in ('pending','active','expired','suspended','cancelled')),
  start_date date not null default current_date,
  end_date date,
  fee_amount numeric(14,2) check (fee_amount is null or fee_amount >= 0),
  currency text not null default 'IRR' check (currency ~ '^[A-Z]{3}$'),
  billing_period text check (billing_period is null or billing_period in ('monthly','quarterly','semiannual','annual','one_time')),
  notes text check (notes is null or length(notes) <= 1000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, tenant_id)
    references public.sports_members(id, tenant_id) on delete cascade,
  check (end_date is null or end_date >= start_date)
);

-- Insurance coverage metadata only. Do not store policy numbers or medical records here.
create table if not exists public.sports_insurance_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.sports_tenants(id) on delete cascade,
  member_id uuid not null,
  provider_name text not null check (length(trim(provider_name)) between 2 and 160),
  coverage_start date,
  coverage_end date not null,
  status text not null default 'pending' check (status in ('pending','active','expired','rejected')),
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (member_id, tenant_id)
    references public.sports_members(id, tenant_id) on delete cascade,
  check (coverage_start is null or coverage_end >= coverage_start)
);

-- Event registration/participation is separate from a recorded result.
create table if not exists public.sports_event_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.sports_tenants(id) on delete cascade,
  event_id uuid not null,
  member_id uuid not null,
  status text not null default 'registered' check (status in ('registered','approved','waitlisted','withdrawn','disqualified')),
  registered_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  notes text check (notes is null or length(notes) <= 1000),
  foreign key (event_id, tenant_id)
    references public.sports_events(id, tenant_id) on delete cascade,
  foreign key (member_id, tenant_id)
    references public.sports_members(id, tenant_id) on delete cascade,
  unique (event_id, member_id)
);

-- Coach-assigned development plans. Goals are structured JSON, not free-form medical data.
create table if not exists public.sports_development_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.sports_tenants(id) on delete cascade,
  member_id uuid not null,
  coach_user_id uuid references auth.users(id) on delete set null,
  title text not null check (length(trim(title)) between 2 and 180),
  stage text not null default 'foundation' check (stage in ('discovery','foundation','development','performance','maintenance')),
  goals jsonb not null default '[]'::jsonb check (jsonb_typeof(goals) = 'array'),
  status text not null default 'active' check (status in ('draft','active','completed','paused')),
  review_date date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, tenant_id)
    references public.sports_members(id, tenant_id) on delete cascade
);

-- Append-only financial ledger. Corrections must be represented by a new reversal row.
create table if not exists public.sports_financial_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.sports_tenants(id) on delete cascade,
  member_id uuid,
  transaction_type text not null check (transaction_type in ('income','expense','refund','reversal')),
  category text not null check (length(trim(category)) between 2 and 100),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'IRR' check (currency ~ '^[A-Z]{3}$'),
  transaction_date date not null default current_date,
  reference_code text,
  description text check (description is null or length(description) <= 1000),
  reverses_transaction_id uuid references public.sports_financial_transactions(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (member_id, tenant_id)
    references public.sports_members(id, tenant_id) on delete restrict,
  check (
    (transaction_type = 'reversal' and reverses_transaction_id is not null)
    or (transaction_type <> 'reversal' and reverses_transaction_id is null)
  )
);

-- Result integrity: entries remain pending until an authorized reviewer verifies them.
alter table public.sports_results
  add column if not exists verification_status text not null default 'pending_review',
  add column if not exists verified_by uuid references auth.users(id) on delete set null,
  add column if not exists verified_at timestamptz;

alter table public.sports_results
  drop constraint if exists sports_results_verification_status_check;
alter table public.sports_results
  add constraint sports_results_verification_status_check
  check (verification_status in ('pending_review','verified','rejected'));

create index if not exists sports_athlete_profiles_tenant_member_idx
  on public.sports_athlete_profiles(tenant_id, member_id);
create index if not exists sports_guardian_consents_member_scope_idx
  on public.sports_guardian_consents(tenant_id, member_id, consent_scope, consented_at desc);
create index if not exists sports_club_memberships_tenant_status_idx
  on public.sports_club_memberships(tenant_id, status, end_date);
create index if not exists sports_insurance_tenant_expiry_idx
  on public.sports_insurance_records(tenant_id, status, coverage_end);
create index if not exists sports_event_entries_event_status_idx
  on public.sports_event_entries(tenant_id, event_id, status);
create index if not exists sports_development_plans_member_status_idx
  on public.sports_development_plans(tenant_id, member_id, status);
create index if not exists sports_financial_tenant_date_idx
  on public.sports_financial_transactions(tenant_id, transaction_date desc);
create index if not exists sports_results_verification_idx
  on public.sports_results(tenant_id, verification_status, created_at desc);

-- Updated-at maintenance.
create or replace function public.sports_set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists sports_athlete_profiles_updated_at on public.sports_athlete_profiles;
create trigger sports_athlete_profiles_updated_at before update on public.sports_athlete_profiles
for each row execute function public.sports_set_updated_at();
drop trigger if exists sports_club_memberships_updated_at on public.sports_club_memberships;
create trigger sports_club_memberships_updated_at before update on public.sports_club_memberships
for each row execute function public.sports_set_updated_at();
drop trigger if exists sports_development_plans_updated_at on public.sports_development_plans;
create trigger sports_development_plans_updated_at before update on public.sports_development_plans
for each row execute function public.sports_set_updated_at();

-- Prevent edits/deletes to ledger entries; use reversal transactions instead.
create or replace function public.sports_prevent_finance_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'Financial ledger is append-only; create a reversal transaction instead';
end;
$$;

drop trigger if exists sports_finance_append_only on public.sports_financial_transactions;
create trigger sports_finance_append_only before update or delete on public.sports_financial_transactions
for each row execute function public.sports_prevent_finance_mutation();

-- Enable RLS and grant only the SQL verbs required by each workflow.
alter table public.sports_athlete_profiles enable row level security;
alter table public.sports_guardian_consents enable row level security;
alter table public.sports_club_memberships enable row level security;
alter table public.sports_insurance_records enable row level security;
alter table public.sports_event_entries enable row level security;
alter table public.sports_development_plans enable row level security;
alter table public.sports_financial_transactions enable row level security;

-- Athlete profiles: organization admins/coaches, or the athlete linked to this member row.
drop policy if exists sports_athlete_profiles_read on public.sports_athlete_profiles;
create policy sports_athlete_profiles_read on public.sports_athlete_profiles
for select to authenticated using (
  exists (
    select 1 from public.sports_tenant_memberships tm
    where tm.tenant_id = sports_athlete_profiles.tenant_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and tm.role in ('owner','admin','coach')
  )
  or exists (
    select 1 from public.sports_members sm
    where sm.id = sports_athlete_profiles.member_id
      and sm.tenant_id = sports_athlete_profiles.tenant_id
      and sm.user_id = (select auth.uid())
  )
);
drop policy if exists sports_athlete_profiles_manage on public.sports_athlete_profiles;
create policy sports_athlete_profiles_manage on public.sports_athlete_profiles
for all to authenticated using (
  exists (
    select 1 from public.sports_tenant_memberships tm
    where tm.tenant_id = sports_athlete_profiles.tenant_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and tm.role in ('owner','admin')
  )
) with check (
  exists (
    select 1 from public.sports_tenant_memberships tm
    where tm.tenant_id = sports_athlete_profiles.tenant_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and tm.role in ('owner','admin')
  )
);

-- Guardian details and consent evidence are admin-only.
drop policy if exists sports_guardian_consents_admin on public.sports_guardian_consents;
create policy sports_guardian_consents_admin on public.sports_guardian_consents
for all to authenticated using (
  exists (
    select 1 from public.sports_tenant_memberships tm
    where tm.tenant_id = sports_guardian_consents.tenant_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and tm.role in ('owner','admin')
  )
) with check (
  exists (
    select 1 from public.sports_tenant_memberships tm
    where tm.tenant_id = sports_guardian_consents.tenant_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and tm.role in ('owner','admin')
  )
);

-- Membership records: admins manage; staff can view; linked athletes can view their own.
drop policy if exists sports_club_memberships_read on public.sports_club_memberships;
create policy sports_club_memberships_read on public.sports_club_memberships
for select to authenticated using (
  exists (
    select 1 from public.sports_tenant_memberships tm
    where tm.tenant_id = sports_club_memberships.tenant_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and tm.role in ('owner','admin','staff')
  )
  or exists (
    select 1 from public.sports_members sm
    where sm.id = sports_club_memberships.member_id
      and sm.tenant_id = sports_club_memberships.tenant_id
      and sm.user_id = (select auth.uid())
  )
);
drop policy if exists sports_club_memberships_admin_manage on public.sports_club_memberships;
create policy sports_club_memberships_admin_manage on public.sports_club_memberships
for all to authenticated using (
  exists (
    select 1 from public.sports_tenant_memberships tm
    where tm.tenant_id = sports_club_memberships.tenant_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and tm.role in ('owner','admin')
  )
) with check (
  exists (
    select 1 from public.sports_tenant_memberships tm
    where tm.tenant_id = sports_club_memberships.tenant_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and tm.role in ('owner','admin')
  )
);

-- Insurance: admin and the linked athlete can read; only admins manage/verify.
drop policy if exists sports_insurance_read on public.sports_insurance_records;
create policy sports_insurance_read on public.sports_insurance_records
for select to authenticated using (
  exists (
    select 1 from public.sports_tenant_memberships tm
    where tm.tenant_id = sports_insurance_records.tenant_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and tm.role in ('owner','admin')
  )
  or exists (
    select 1 from public.sports_members sm
    where sm.id = sports_insurance_records.member_id
      and sm.tenant_id = sports_insurance_records.tenant_id
      and sm.user_id = (select auth.uid())
  )
);
drop policy if exists sports_insurance_admin_manage on public.sports_insurance_records;
create policy sports_insurance_admin_manage on public.sports_insurance_records
for all to authenticated using (
  exists (
    select 1 from public.sports_tenant_memberships tm
    where tm.tenant_id = sports_insurance_records.tenant_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and tm.role in ('owner','admin')
  )
) with check (
  exists (
    select 1 from public.sports_tenant_memberships tm
    where tm.tenant_id = sports_insurance_records.tenant_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and tm.role in ('owner','admin')
  )
);

-- Event entries: admin/referee/coach read; admin/coach register; admin/referee review.
drop policy if exists sports_event_entries_read on public.sports_event_entries;
create policy sports_event_entries_read on public.sports_event_entries
for select to authenticated using (
  exists (
    select 1 from public.sports_tenant_memberships tm
    where tm.tenant_id = sports_event_entries.tenant_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and tm.role in ('owner','admin','referee','coach')
  )
  or exists (
    select 1 from public.sports_members sm
    where sm.id = sports_event_entries.member_id
      and sm.tenant_id = sports_event_entries.tenant_id
      and sm.user_id = (select auth.uid())
  )
);
drop policy if exists sports_event_entries_insert on public.sports_event_entries;
create policy sports_event_entries_insert on public.sports_event_entries
for insert to authenticated with check (
  exists (
    select 1 from public.sports_tenant_memberships tm
    where tm.tenant_id = sports_event_entries.tenant_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and tm.role in ('owner','admin','coach')
  )
);
drop policy if exists sports_event_entries_update on public.sports_event_entries;
create policy sports_event_entries_update on public.sports_event_entries
for update to authenticated using (
  exists (
    select 1 from public.sports_tenant_memberships tm
    where tm.tenant_id = sports_event_entries.tenant_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and tm.role in ('owner','admin','referee')
  )
) with check (
  exists (
    select 1 from public.sports_tenant_memberships tm
    where tm.tenant_id = sports_event_entries.tenant_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and tm.role in ('owner','admin','referee')
  )
);

-- Development plans: admin/coach manage; linked athlete may read own plan.
drop policy if exists sports_development_plans_read on public.sports_development_plans;
create policy sports_development_plans_read on public.sports_development_plans
for select to authenticated using (
  exists (
    select 1 from public.sports_tenant_memberships tm
    where tm.tenant_id = sports_development_plans.tenant_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and tm.role in ('owner','admin','coach')
  )
  or exists (
    select 1 from public.sports_members sm
    where sm.id = sports_development_plans.member_id
      and sm.tenant_id = sports_development_plans.tenant_id
      and sm.user_id = (select auth.uid())
  )
);
drop policy if exists sports_development_plans_manage on public.sports_development_plans;
create policy sports_development_plans_manage on public.sports_development_plans
for all to authenticated using (
  exists (
    select 1 from public.sports_tenant_memberships tm
    where tm.tenant_id = sports_development_plans.tenant_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and tm.role in ('owner','admin','coach')
  )
) with check (
  exists (
    select 1 from public.sports_tenant_memberships tm
    where tm.tenant_id = sports_development_plans.tenant_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and tm.role in ('owner','admin','coach')
  )
);

-- Financial records: admin only, append-only at both grant and trigger layers.
drop policy if exists sports_financial_transactions_admin on public.sports_financial_transactions;
create policy sports_financial_transactions_admin on public.sports_financial_transactions
for all to authenticated using (
  exists (
    select 1 from public.sports_tenant_memberships tm
    where tm.tenant_id = sports_financial_transactions.tenant_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and tm.role in ('owner','admin')
  )
) with check (
  exists (
    select 1 from public.sports_tenant_memberships tm
    where tm.tenant_id = sports_financial_transactions.tenant_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and tm.role in ('owner','admin')
  )
);

grant select, insert, update, delete on
  public.sports_athlete_profiles,
  public.sports_guardian_consents,
  public.sports_club_memberships,
  public.sports_insurance_records,
  public.sports_event_entries,
  public.sports_development_plans
to authenticated;

grant select, insert on public.sports_financial_transactions to authenticated;


-- ---------------------------------------------------------------------------
-- P0 MEMBER MANAGEMENT + SECURITY HARDENING
-- Additive only: existing member/event/result rows are preserved.
-- National identifiers are intentionally excluded from this general profile.
-- ---------------------------------------------------------------------------

ALTER TABLE public.sports_members
  ADD COLUMN IF NOT EXISTS membership_number text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS athlete_category text,
  ADD COLUMN IF NOT EXISTS joined_on date NOT NULL DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.sports_members
  DROP CONSTRAINT IF EXISTS sports_members_membership_number_length_check,
  ADD CONSTRAINT sports_members_membership_number_length_check
    CHECK (membership_number IS NULL OR length(trim(membership_number)) BETWEEN 1 AND 40),
  DROP CONSTRAINT IF EXISTS sports_members_athlete_category_length_check,
  ADD CONSTRAINT sports_members_athlete_category_length_check
    CHECK (athlete_category IS NULL OR length(trim(athlete_category)) BETWEEN 1 AND 80);

CREATE UNIQUE INDEX IF NOT EXISTS sports_members_tenant_membership_number_uq
  ON public.sports_members(tenant_id, membership_number)
  WHERE membership_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS sports_members_tenant_name_idx
  ON public.sports_members(tenant_id, lower(full_name));

CREATE INDEX IF NOT EXISTS sports_members_tenant_status_idx
  ON public.sports_members(tenant_id, status, created_at DESC);

-- Append-only, administrator-visible member change history.
CREATE TABLE IF NOT EXISTS public.sports_member_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.sports_tenants(id) ON DELETE CASCADE,
  member_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('created','updated','archived')),
  changed_fields jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(changed_fields) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sports_member_history_member_tenant_fk
    FOREIGN KEY (member_id, tenant_id)
    REFERENCES public.sports_members(id, tenant_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS sports_member_history_member_idx
  ON public.sports_member_history(tenant_id, member_id, created_at DESC);

-- Updated timestamp for member records.
DROP TRIGGER IF EXISTS sports_members_updated_at ON public.sports_members;
CREATE TRIGGER sports_members_updated_at
BEFORE UPDATE ON public.sports_members
FOR EACH ROW EXECUTE FUNCTION public.sports_set_updated_at();

-- All new and existing P009 tables enforce row-level security, including
-- table-owner access. Client grants are explicitly least-privilege.
ALTER TABLE public.sports_athlete_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_athlete_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sports_guardian_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_guardian_consents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sports_club_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_club_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sports_insurance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_insurance_records FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sports_event_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_event_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sports_development_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_development_plans FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sports_financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_financial_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sports_member_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_member_history FORCE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
  public.sports_athlete_profiles,
  public.sports_guardian_consents,
  public.sports_club_memberships,
  public.sports_insurance_records,
  public.sports_event_entries,
  public.sports_development_plans,
  public.sports_financial_transactions,
  public.sports_member_history
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.sports_athlete_profiles,
  public.sports_guardian_consents,
  public.sports_club_memberships,
  public.sports_insurance_records,
  public.sports_event_entries,
  public.sports_development_plans
TO authenticated;

GRANT SELECT, INSERT ON TABLE
  public.sports_financial_transactions,
  public.sports_member_history
TO authenticated;

-- Until verified athlete-account linking and coach-to-athlete assignments exist,
-- sensitive personal, insurance, consent and development data remain admin-only.
DROP POLICY IF EXISTS sports_athlete_profiles_read ON public.sports_athlete_profiles;
DROP POLICY IF EXISTS sports_athlete_profiles_manage ON public.sports_athlete_profiles;
CREATE POLICY sports_athlete_profiles_admin_only
ON public.sports_athlete_profiles FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sports_tenant_memberships tm
    WHERE tm.tenant_id = sports_athlete_profiles.tenant_id
      AND tm.user_id = (SELECT auth.uid())
      AND tm.status = 'active'
      AND tm.role IN ('owner','admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sports_tenant_memberships tm
    WHERE tm.tenant_id = sports_athlete_profiles.tenant_id
      AND tm.user_id = (SELECT auth.uid())
      AND tm.status = 'active'
      AND tm.role IN ('owner','admin')
  )
);

-- Guardian consent records are administrator-only.
DROP POLICY IF EXISTS sports_guardian_consents_admin ON public.sports_guardian_consents;
CREATE POLICY sports_guardian_consents_admin
ON public.sports_guardian_consents FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sports_tenant_memberships tm
    WHERE tm.tenant_id = sports_guardian_consents.tenant_id
      AND tm.user_id = (SELECT auth.uid())
      AND tm.status = 'active'
      AND tm.role IN ('owner','admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sports_tenant_memberships tm
    WHERE tm.tenant_id = sports_guardian_consents.tenant_id
      AND tm.user_id = (SELECT auth.uid())
      AND tm.status = 'active'
      AND tm.role IN ('owner','admin')
  )
);

-- Membership and insurance details are administrator-only until a dedicated
-- least-privilege staff/athlete workflow is implemented.
DROP POLICY IF EXISTS sports_club_memberships_read ON public.sports_club_memberships;
DROP POLICY IF EXISTS sports_club_memberships_admin_manage ON public.sports_club_memberships;
CREATE POLICY sports_club_memberships_admin_only
ON public.sports_club_memberships FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sports_tenant_memberships tm
    WHERE tm.tenant_id = sports_club_memberships.tenant_id
      AND tm.user_id = (SELECT auth.uid())
      AND tm.status = 'active'
      AND tm.role IN ('owner','admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sports_tenant_memberships tm
    WHERE tm.tenant_id = sports_club_memberships.tenant_id
      AND tm.user_id = (SELECT auth.uid())
      AND tm.status = 'active'
      AND tm.role IN ('owner','admin')
  )
);

DROP POLICY IF EXISTS sports_insurance_read ON public.sports_insurance_records;
DROP POLICY IF EXISTS sports_insurance_admin_manage ON public.sports_insurance_records;
CREATE POLICY sports_insurance_admin_only
ON public.sports_insurance_records FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sports_tenant_memberships tm
    WHERE tm.tenant_id = sports_insurance_records.tenant_id
      AND tm.user_id = (SELECT auth.uid())
      AND tm.status = 'active'
      AND tm.role IN ('owner','admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sports_tenant_memberships tm
    WHERE tm.tenant_id = sports_insurance_records.tenant_id
      AND tm.user_id = (SELECT auth.uid())
      AND tm.status = 'active'
      AND tm.role IN ('owner','admin')
  )
);

-- Referees may read entries; only administrators may create or alter them.
DROP POLICY IF EXISTS sports_event_entries_read ON public.sports_event_entries;
DROP POLICY IF EXISTS sports_event_entries_insert ON public.sports_event_entries;
DROP POLICY IF EXISTS sports_event_entries_update ON public.sports_event_entries;
CREATE POLICY sports_event_entries_read
ON public.sports_event_entries FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sports_tenant_memberships tm
    WHERE tm.tenant_id = sports_event_entries.tenant_id
      AND tm.user_id = (SELECT auth.uid())
      AND tm.status = 'active'
      AND tm.role IN ('owner','admin','referee')
  )
);
CREATE POLICY sports_event_entries_admin_manage
ON public.sports_event_entries FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sports_tenant_memberships tm
    WHERE tm.tenant_id = sports_event_entries.tenant_id
      AND tm.user_id = (SELECT auth.uid())
      AND tm.status = 'active'
      AND tm.role IN ('owner','admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sports_tenant_memberships tm
    WHERE tm.tenant_id = sports_event_entries.tenant_id
      AND tm.user_id = (SELECT auth.uid())
      AND tm.status = 'active'
      AND tm.role IN ('owner','admin')
  )
);

-- Coach access is intentionally withheld until coach assignments are enforced.
DROP POLICY IF EXISTS sports_development_plans_read ON public.sports_development_plans;
DROP POLICY IF EXISTS sports_development_plans_manage ON public.sports_development_plans;
CREATE POLICY sports_development_plans_admin_only
ON public.sports_development_plans FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sports_tenant_memberships tm
    WHERE tm.tenant_id = sports_development_plans.tenant_id
      AND tm.user_id = (SELECT auth.uid())
      AND tm.status = 'active'
      AND tm.role IN ('owner','admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sports_tenant_memberships tm
    WHERE tm.tenant_id = sports_development_plans.tenant_id
      AND tm.user_id = (SELECT auth.uid())
      AND tm.status = 'active'
      AND tm.role IN ('owner','admin')
  )
);

DROP POLICY IF EXISTS sports_financial_transactions_admin ON public.sports_financial_transactions;
CREATE POLICY sports_financial_transactions_admin
ON public.sports_financial_transactions FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sports_tenant_memberships tm
    WHERE tm.tenant_id = sports_financial_transactions.tenant_id
      AND tm.user_id = (SELECT auth.uid())
      AND tm.status = 'active'
      AND tm.role IN ('owner','admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sports_tenant_memberships tm
    WHERE tm.tenant_id = sports_financial_transactions.tenant_id
      AND tm.user_id = (SELECT auth.uid())
      AND tm.status = 'active'
      AND tm.role IN ('owner','admin')
  )
);

DROP POLICY IF EXISTS sports_member_history_admin_read ON public.sports_member_history;
DROP POLICY IF EXISTS sports_member_history_admin_insert ON public.sports_member_history;
CREATE POLICY sports_member_history_admin_read
ON public.sports_member_history FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sports_tenant_memberships tm
    WHERE tm.tenant_id = sports_member_history.tenant_id
      AND tm.user_id = (SELECT auth.uid())
      AND tm.status = 'active'
      AND tm.role IN ('owner','admin')
  )
);
CREATE POLICY sports_member_history_admin_insert
ON public.sports_member_history FOR INSERT TO authenticated
WITH CHECK (
  actor_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.sports_tenant_memberships tm
    WHERE tm.tenant_id = sports_member_history.tenant_id
      AND tm.user_id = (SELECT auth.uid())
      AND tm.status = 'active'
      AND tm.role IN ('owner','admin')
  )
);

-- A reversal must reference a transaction in the same tenant.
CREATE UNIQUE INDEX IF NOT EXISTS sports_financial_transactions_id_tenant_uq
  ON public.sports_financial_transactions(id, tenant_id);
ALTER TABLE public.sports_financial_transactions
  DROP CONSTRAINT IF EXISTS sports_financial_transactions_reverses_transaction_id_fkey;
ALTER TABLE public.sports_financial_transactions
  ADD CONSTRAINT sports_financial_reversal_same_tenant_fk
  FOREIGN KEY (reverses_transaction_id, tenant_id)
  REFERENCES public.sports_financial_transactions(id, tenant_id)
  ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS sports_financial_single_reversal_uq
  ON public.sports_financial_transactions(reverses_transaction_id)
  WHERE reverses_transaction_id IS NOT NULL;

-- Tenant IDs are immutable on every newly introduced tenant-scoped table.
DROP TRIGGER IF EXISTS sports_athlete_profiles_tenant_immutable ON public.sports_athlete_profiles;
CREATE TRIGGER sports_athlete_profiles_tenant_immutable BEFORE UPDATE ON public.sports_athlete_profiles
FOR EACH ROW EXECUTE FUNCTION public.sports_prevent_tenant_change();
DROP TRIGGER IF EXISTS sports_guardian_consents_tenant_immutable ON public.sports_guardian_consents;
CREATE TRIGGER sports_guardian_consents_tenant_immutable BEFORE UPDATE ON public.sports_guardian_consents
FOR EACH ROW EXECUTE FUNCTION public.sports_prevent_tenant_change();
DROP TRIGGER IF EXISTS sports_club_memberships_tenant_immutable ON public.sports_club_memberships;
CREATE TRIGGER sports_club_memberships_tenant_immutable BEFORE UPDATE ON public.sports_club_memberships
FOR EACH ROW EXECUTE FUNCTION public.sports_prevent_tenant_change();
DROP TRIGGER IF EXISTS sports_insurance_records_tenant_immutable ON public.sports_insurance_records;
CREATE TRIGGER sports_insurance_records_tenant_immutable BEFORE UPDATE ON public.sports_insurance_records
FOR EACH ROW EXECUTE FUNCTION public.sports_prevent_tenant_change();
DROP TRIGGER IF EXISTS sports_event_entries_tenant_immutable ON public.sports_event_entries;
CREATE TRIGGER sports_event_entries_tenant_immutable BEFORE UPDATE ON public.sports_event_entries
FOR EACH ROW EXECUTE FUNCTION public.sports_prevent_tenant_change();
DROP TRIGGER IF EXISTS sports_development_plans_tenant_immutable ON public.sports_development_plans;
CREATE TRIGGER sports_development_plans_tenant_immutable BEFORE UPDATE ON public.sports_development_plans
FOR EACH ROW EXECUTE FUNCTION public.sports_prevent_tenant_change();
DROP TRIGGER IF EXISTS sports_financial_transactions_tenant_immutable ON public.sports_financial_transactions;
CREATE TRIGGER sports_financial_transactions_tenant_immutable BEFORE UPDATE ON public.sports_financial_transactions
FOR EACH ROW EXECUTE FUNCTION public.sports_prevent_tenant_change();
DROP TRIGGER IF EXISTS sports_member_history_tenant_immutable ON public.sports_member_history;
CREATE TRIGGER sports_member_history_tenant_immutable BEFORE UPDATE ON public.sports_member_history
FOR EACH ROW EXECUTE FUNCTION public.sports_prevent_tenant_change();

CREATE OR REPLACE FUNCTION public.sports_prevent_member_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $
BEGIN
  RAISE EXCEPTION 'Member history is append-only';
END;
$;
REVOKE ALL ON FUNCTION public.sports_prevent_member_history_mutation() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS sports_member_history_append_only ON public.sports_member_history;
CREATE TRIGGER sports_member_history_append_only
BEFORE UPDATE OR DELETE ON public.sports_member_history
FOR EACH ROW EXECUTE FUNCTION public.sports_prevent_member_history_mutation();

REVOKE ALL ON FUNCTION public.sports_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sports_prevent_finance_mutation() FROM PUBLIC, anon, authenticated;

commit;
