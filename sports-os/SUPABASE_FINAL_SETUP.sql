-- ============================================================================
-- METATYA Sports OS — SUPABASE FINAL SETUP
-- "Migration 006" consolidated replay + pilot tenant/admin seed.
--
-- Source of truth:
--   20261117090249 sports_multitenancy_core
--   20261117090346 sports_foreign_key_indexes
--
-- This file is a standalone setup script for a NEW / dedicated Supabase
-- project. The two source migrations are already recorded in the current
-- project. Do not blindly rerun this seed on an existing environment.
--
-- IMPORTANT:
--   1. Create the intended admin user in Supabase Auth first.
--   2. Replace ADMIN_EMAIL_PLACEHOLDER in the seed block below.
--   3. Run this script as a privileged operator in the Supabase SQL Editor.
--   4. This file creates objects in public; it does NOT create sports_core.
-- ============================================================================

begin;

-- 1. Tenant registry ---------------------------------------------------------
create table if not exists public.sports_tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null
    check (length(trim(name)) between 2 and 160),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status text not null default 'active'
    check (status in ('active', 'suspended', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Tenant memberships ------------------------------------------------------
create table if not exists public.sports_tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null
    references public.sports_tenants(id) on delete cascade,
  user_id uuid not null
    references auth.users(id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'coach', 'staff', 'member')),
  status text not null default 'active'
    check (status in ('invited', 'active', 'suspended', 'left')),
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id),
  unique (id, tenant_id)
);

create index if not exists sports_memberships_user_status_idx
  on public.sports_tenant_memberships(user_id, status);
create index if not exists sports_memberships_tenant_role_idx
  on public.sports_tenant_memberships(tenant_id, role, status);

-- 3. Sports members ----------------------------------------------------------
create table if not exists public.sports_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null
    references public.sports_tenants(id) on delete cascade,
  full_name text not null
    check (length(trim(full_name)) between 2 and 150),
  sport_type text,
  phone text,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'suspended')),
  created_at timestamptz not null default now(),
  unique (id, tenant_id)
);

create index if not exists sports_members_tenant_created_idx
  on public.sports_members(tenant_id, created_at desc);

-- 4. Sports events -----------------------------------------------------------
create table if not exists public.sports_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null
    references public.sports_tenants(id) on delete cascade,
  title text not null
    check (length(trim(title)) between 2 and 200),
  sport_type text,
  event_date timestamptz not null,
  location text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'ongoing', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (id, tenant_id)
);

create index if not exists sports_events_tenant_date_idx
  on public.sports_events(tenant_id, event_date);

-- 5. Results: composite foreign keys prevent cross-tenant references ---------
create table if not exists public.sports_results (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null
    references public.sports_tenants(id) on delete cascade,
  member_id uuid not null,
  event_id uuid not null,
  score numeric(12,3),
  rank integer check (rank is null or rank > 0),
  notes text check (notes is null or length(notes) <= 2000),
  created_at timestamptz not null default now(),
  foreign key (member_id, tenant_id)
    references public.sports_members(id, tenant_id) on delete cascade,
  foreign key (event_id, tenant_id)
    references public.sports_events(id, tenant_id) on delete cascade
);

create index if not exists sports_results_tenant_created_idx
  on public.sports_results(tenant_id, created_at desc);
create index if not exists sports_results_event_tenant_idx
  on public.sports_results(event_id, tenant_id);
create index if not exists sports_results_member_tenant_idx
  on public.sports_results(member_id, tenant_id);
create index if not exists sports_tenants_created_by_idx
  on public.sports_tenants(created_by);

-- 6. Row Level Security ------------------------------------------------------
alter table public.sports_tenants enable row level security;
alter table public.sports_tenant_memberships enable row level security;
alter table public.sports_members enable row level security;
alter table public.sports_events enable row level security;
alter table public.sports_results enable row level security;

-- Memberships: users can read only their own membership rows.
drop policy if exists sports_memberships_select_self
  on public.sports_tenant_memberships;
create policy sports_memberships_select_self
  on public.sports_tenant_memberships
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Tenant metadata is visible only to active tenant members.
drop policy if exists sports_tenants_select_member on public.sports_tenants;
create policy sports_tenants_select_member
  on public.sports_tenants
  for select to authenticated
  using (
    exists (
      select 1
      from public.sports_tenant_memberships m
      where m.tenant_id = sports_tenants.id
        and m.user_id = (select auth.uid())
        and m.status = 'active'
    )
  );

-- Members: active tenant members can read; owner/admin/staff can insert.
drop policy if exists sports_members_select_member on public.sports_members;
create policy sports_members_select_member
  on public.sports_members
  for select to authenticated
  using (
    exists (
      select 1
      from public.sports_tenant_memberships m
      where m.tenant_id = sports_members.tenant_id
        and m.user_id = (select auth.uid())
        and m.status = 'active'
    )
  );

drop policy if exists sports_members_insert_staff on public.sports_members;
create policy sports_members_insert_staff
  on public.sports_members
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.sports_tenant_memberships m
      where m.tenant_id = sports_members.tenant_id
        and m.user_id = (select auth.uid())
        and m.status = 'active'
        and m.role in ('owner', 'admin', 'staff')
    )
  );

-- Events: active tenant members can read; staff/coach/admin can insert.
drop policy if exists sports_events_select_member on public.sports_events;
create policy sports_events_select_member
  on public.sports_events
  for select to authenticated
  using (
    exists (
      select 1
      from public.sports_tenant_memberships m
      where m.tenant_id = sports_events.tenant_id
        and m.user_id = (select auth.uid())
        and m.status = 'active'
    )
  );

drop policy if exists sports_events_insert_staff on public.sports_events;
create policy sports_events_insert_staff
  on public.sports_events
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.sports_tenant_memberships m
      where m.tenant_id = sports_events.tenant_id
        and m.user_id = (select auth.uid())
        and m.status = 'active'
        and m.role in ('owner', 'admin', 'staff', 'coach')
    )
  );

-- Results: active tenant members can read; staff/coach/admin can insert.
drop policy if exists sports_results_select_member on public.sports_results;
create policy sports_results_select_member
  on public.sports_results
  for select to authenticated
  using (
    exists (
      select 1
      from public.sports_tenant_memberships m
      where m.tenant_id = sports_results.tenant_id
        and m.user_id = (select auth.uid())
        and m.status = 'active'
    )
  );

drop policy if exists sports_results_insert_staff on public.sports_results;
create policy sports_results_insert_staff
  on public.sports_results
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.sports_tenant_memberships m
      where m.tenant_id = sports_results.tenant_id
        and m.user_id = (select auth.uid())
        and m.status = 'active'
        and m.role in ('owner', 'admin', 'staff', 'coach')
    )
  );

-- 7. Explicit least-privilege grants -----------------------------------------
revoke all on table
  public.sports_tenants,
  public.sports_tenant_memberships,
  public.sports_members,
  public.sports_events,
  public.sports_results
from anon, public;

grant usage on schema public to authenticated;
grant select on table
  public.sports_tenants,
  public.sports_tenant_memberships,
  public.sports_members,
  public.sports_events,
  public.sports_results
to authenticated;

grant insert on table
  public.sports_members,
  public.sports_events,
  public.sports_results
to authenticated;

-- 8. Idempotent pilot tenant + first administrator seed ----------------------
-- Create the admin in Supabase Authentication before running this block.
-- Replace the literal below with that user's exact Auth email address.
do $seed$
declare
  v_admin_email text := lower(btrim('ADMIN_EMAIL_PLACEHOLDER'));
  v_admin_user_id uuid;
  v_tenant_id uuid;
begin
  if v_admin_email = 'admin_email_placeholder'
     or v_admin_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception
      'Replace ADMIN_EMAIL_PLACEHOLDER with the existing Supabase Auth admin email before running the seed.';
  end if;

  select u.id
    into v_admin_user_id
  from auth.users u
  where lower(u.email) = v_admin_email
  limit 1;

  if v_admin_user_id is null then
    raise exception
      'No Supabase Auth user found for email %. Create that Auth user first.', v_admin_email;
  end if;

  insert into public.sports_tenants as tenant
    (name, slug, status, created_by)
  values
    ('هیئت تیراندازی استان ایلام', 'ilam-shooting-board', 'active', v_admin_user_id)
  on conflict (slug) do update
    set name = excluded.name,
        status = 'active',
        created_by = coalesce(tenant.created_by, excluded.created_by),
        updated_at = now()
  returning id into v_tenant_id;

  insert into public.sports_tenant_memberships
    (tenant_id, user_id, role, status)
  values
    (v_tenant_id, v_admin_user_id, 'admin', 'active')
  on conflict (tenant_id, user_id) do update
    set role = 'admin',
        status = 'active';
end;
$seed$;

commit;

-- No athlete, guardian, payment, insurance, competition or result records are
-- seeded. Real operational records must be entered only after their workflows,
-- consent rules, validation and authorization have been implemented and tested.
