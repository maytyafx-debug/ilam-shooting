-- METATYA Sports OS — personal portals for athletes, coaches and referees.
-- Depends on 009_integrated_sports_management.sql. Additive and tenant-scoped.
-- DO NOT apply until the owner approves the migration and confirms a fresh backup.

begin;

alter table public.sports_athlete_profiles
  add column if not exists personal_code text;

update public.sports_athlete_profiles
set personal_code = 'MTX-ATH-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
where personal_code is null;

alter table public.sports_athlete_profiles
  alter column personal_code set not null,
  alter column personal_code set default ('MTX-ATH-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)));

create unique index if not exists sports_athlete_profiles_tenant_personal_code_uq
  on public.sports_athlete_profiles(tenant_id, personal_code);

create table if not exists public.sports_staff_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.sports_tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  staff_type text not null check (staff_type in ('coach','referee')),
  personal_code text not null default (
    'MTX-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
  ),
  display_name text,
  credential_title text,
  credential_number text,
  credential_level text,
  credential_expires_on date,
  status text not null default 'active' check (status in ('pending','active','suspended','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id),
  unique (tenant_id, personal_code)
);

create table if not exists public.sports_official_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.sports_tenants(id) on delete cascade,
  event_id uuid not null,
  referee_user_id uuid not null references auth.users(id) on delete cascade,
  assignment_role text not null default 'referee',
  status text not null default 'assigned' check (status in ('assigned','confirmed','completed','cancelled')),
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  notes text check (notes is null or length(notes) <= 1000),
  foreign key (event_id, tenant_id)
    references public.sports_events(id, tenant_id) on delete cascade
);

create index if not exists sports_staff_profiles_user_idx
  on public.sports_staff_profiles(user_id, tenant_id);
create index if not exists sports_official_assignments_referee_idx
  on public.sports_official_assignments(tenant_id, referee_user_id, assigned_at desc);

create or replace function public.sports_staff_profile_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists sports_staff_profiles_updated_at on public.sports_staff_profiles;
create trigger sports_staff_profiles_updated_at
before update on public.sports_staff_profiles
for each row execute function public.sports_staff_profile_updated_at();

alter table public.sports_staff_profiles enable row level security;
alter table public.sports_staff_profiles force row level security;
alter table public.sports_official_assignments enable row level security;
alter table public.sports_official_assignments force row level security;

-- A linked athlete can read only their own roster row. No self-linking or writes.
drop policy if exists sports_members_select_linked_self on public.sports_members;
create policy sports_members_select_linked_self
on public.sports_members
for select to authenticated
using (user_id = (select auth.uid()));

-- Linked athletes may read only their own results; verification status remains visible.
drop policy if exists sports_results_select_linked_athlete on public.sports_results;
create policy sports_results_select_linked_athlete
on public.sports_results
for select to authenticated
using (
  exists (
    select 1 from public.sports_members sm
    where sm.id = sports_results.member_id
      and sm.tenant_id = sports_results.tenant_id
      and sm.user_id = (select auth.uid())
  )
);

-- Athletes can read only events in which their own linked member has an entry/result.
drop policy if exists sports_events_select_linked_athlete on public.sports_events;
create policy sports_events_select_linked_athlete
on public.sports_events
for select to authenticated
using (
  exists (
    select 1 from public.sports_results sr
    join public.sports_members sm
      on sm.id = sr.member_id and sm.tenant_id = sr.tenant_id
    where sr.event_id = sports_events.id
      and sr.tenant_id = sports_events.tenant_id
      and sm.user_id = (select auth.uid())
  )
  or exists (
    select 1 from public.sports_event_entries ee
    join public.sports_members sm
      on sm.id = ee.member_id and sm.tenant_id = ee.tenant_id
    where ee.event_id = sports_events.id
      and ee.tenant_id = sports_events.tenant_id
      and sm.user_id = (select auth.uid())
  )
);

drop policy if exists sports_staff_profiles_self_or_admin_read on public.sports_staff_profiles;
create policy sports_staff_profiles_self_or_admin_read
on public.sports_staff_profiles
for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.sports_tenant_memberships tm
    where tm.tenant_id = sports_staff_profiles.tenant_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and tm.role in ('owner','admin')
  )
);

drop policy if exists sports_staff_profiles_admin_manage on public.sports_staff_profiles;
create policy sports_staff_profiles_admin_manage
on public.sports_staff_profiles
for all to authenticated
using (
  exists (
    select 1 from public.sports_tenant_memberships tm
    where tm.tenant_id = sports_staff_profiles.tenant_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and tm.role in ('owner','admin')
  )
)
with check (
  exists (
    select 1 from public.sports_tenant_memberships tm
    where tm.tenant_id = sports_staff_profiles.tenant_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and tm.role in ('owner','admin')
  )
);

drop policy if exists sports_official_assignments_self_or_admin_read on public.sports_official_assignments;
create policy sports_official_assignments_self_or_admin_read
on public.sports_official_assignments
for select to authenticated
using (
  referee_user_id = (select auth.uid())
  or exists (
    select 1 from public.sports_tenant_memberships tm
    where tm.tenant_id = sports_official_assignments.tenant_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and tm.role in ('owner','admin')
  )
);

drop policy if exists sports_official_assignments_admin_manage on public.sports_official_assignments;
create policy sports_official_assignments_admin_manage
on public.sports_official_assignments
for all to authenticated
using (
  exists (
    select 1 from public.sports_tenant_memberships tm
    where tm.tenant_id = sports_official_assignments.tenant_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and tm.role in ('owner','admin')
  )
)
with check (
  exists (
    select 1 from public.sports_tenant_memberships tm
    where tm.tenant_id = sports_official_assignments.tenant_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and tm.role in ('owner','admin')
  )
);

grant select on public.sports_staff_profiles, public.sports_official_assignments to authenticated;
grant insert, update, delete on public.sports_staff_profiles, public.sports_official_assignments to authenticated;


-- Admin-controlled account linking. Email is resolved server-side to an existing
-- confirmed Auth account; users cannot self-link by changing a browser-supplied ID.
create or replace function public.sports_admin_link_person(
  p_tenant_id uuid,
  p_email text,
  p_person_type text,
  p_member_id uuid default null
)
returns table(linked_user_id uuid, personal_code text, display_name text)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $portal$
declare
  v_actor uuid;
  v_target uuid;
  v_role text;
  v_member_id uuid;
  v_code text;
  v_name text;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Authenticated actor required';
  end if;
  if p_person_type is null or p_person_type not in ('athlete','coach','referee') then
    raise exception 'Unsupported person type';
  end if;
  if p_email is null or length(trim(p_email)) < 5 or length(trim(p_email)) > 254 then
    raise exception 'Valid account email required';
  end if;
  if not exists (
    select 1
    from public.sports_tenant_memberships tm
    join public.sports_tenants t on t.id = tm.tenant_id
    where tm.tenant_id = p_tenant_id
      and tm.user_id = v_actor
      and tm.status = 'active'
      and tm.role in ('owner','admin')
      and t.status = 'active'
  ) then
    raise exception 'Organization administrator permission required';
  end if;

  select u.id, coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'),''), u.email)
    into v_target, v_name
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
    and u.email_confirmed_at is not null
  limit 1;

  if v_target is null then
    raise exception 'No confirmed account found for this email';
  end if;

  select tm.role into v_role
  from public.sports_tenant_memberships tm
  where tm.tenant_id = p_tenant_id and tm.user_id = v_target
  for update;

  if p_person_type = 'athlete' then
    if p_member_id is null then
      raise exception 'Athlete member record is required';
    end if;
    if v_role is not null and v_role <> 'member' then
      raise exception 'The account already has a different organization role';
    end if;

    update public.sports_members sm
    set user_id = v_target
    where sm.id = p_member_id
      and sm.tenant_id = p_tenant_id
      and (sm.user_id is null or sm.user_id = v_target)
    returning sm.id into v_member_id;

    if v_member_id is null then
      raise exception 'Member record not found or already linked to another account';
    end if;

    insert into public.sports_tenant_memberships(tenant_id,user_id,role,status)
    values (p_tenant_id,v_target,'member','active')
    on conflict (tenant_id,user_id) do update
      set status = 'active'
      where public.sports_tenant_memberships.role = 'member';

    insert into public.sports_athlete_profiles(tenant_id,member_id)
    values (p_tenant_id,v_member_id)
    on conflict (member_id,tenant_id) do nothing;

    select ap.personal_code into v_code
    from public.sports_athlete_profiles ap
    where ap.tenant_id = p_tenant_id and ap.member_id = v_member_id;
  else
    if p_member_id is not null then
      raise exception 'Member record must not be supplied for staff profiles';
    end if;
    if v_role is not null and v_role not in ('member','staff',p_person_type) then
      raise exception 'The account already has a different organization role';
    end if;

    insert into public.sports_tenant_memberships(tenant_id,user_id,role,status)
    values (p_tenant_id,v_target,p_person_type,'active')
    on conflict (tenant_id,user_id) do update
      set role = excluded.role, status = 'active';

    insert into public.sports_staff_profiles(tenant_id,user_id,staff_type,display_name)
    values (p_tenant_id,v_target,p_person_type,v_name)
    on conflict (tenant_id,user_id) do update
      set staff_type = excluded.staff_type,
          display_name = coalesce(public.sports_staff_profiles.display_name, excluded.display_name);

    select sp.personal_code into v_code
    from public.sports_staff_profiles sp
    where sp.tenant_id = p_tenant_id and sp.user_id = v_target;
  end if;

  return query select v_target, v_code, v_name;
end;
$portal$;
REVOKE ALL ON FUNCTION public.sports_admin_link_person(uuid,text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sports_admin_link_person(uuid,text,text,uuid) TO authenticated;

commit;
