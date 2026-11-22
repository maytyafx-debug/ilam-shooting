-- Three tenant-scoped specialist information banks for METATYA SPORTS OS.
-- Additive only: existing member, event, result and membership rows are preserved.
begin;

create table if not exists public.sports_athlete_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.sports_tenants(id) on delete cascade,
  member_id uuid not null,
  athlete_code text,
  gender text check (gender is null or gender in ('female','male','unspecified')),
  county text,
  membership_status text not null default 'active'
    check (membership_status in ('pending','active','inactive','suspended','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, tenant_id),
  unique (tenant_id, athlete_code),
  foreign key (member_id, tenant_id)
    references public.sports_members(id, tenant_id) on delete restrict
);

create table if not exists public.sports_coach_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.sports_tenants(id) on delete cascade,
  member_id uuid not null,
  coach_code text,
  specialty text,
  coaching_grade text,
  certificate_valid_until date,
  professional_status text not null default 'active'
    check (professional_status in ('pending','active','inactive','suspended','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, tenant_id),
  unique (tenant_id, coach_code),
  foreign key (member_id, tenant_id)
    references public.sports_members(id, tenant_id) on delete restrict
);

create table if not exists public.sports_referee_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.sports_tenants(id) on delete cascade,
  member_id uuid not null,
  referee_code text,
  referee_grade text,
  permitted_sports text[] not null default '{}',
  card_valid_until date,
  activity_status text not null default 'active'
    check (activity_status in ('pending','active','inactive','suspended','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, tenant_id),
  unique (tenant_id, referee_code),
  foreign key (member_id, tenant_id)
    references public.sports_members(id, tenant_id) on delete restrict
);

create table if not exists public.sports_specialist_profile_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.sports_tenants(id) on delete cascade,
  profile_type text not null check (profile_type in ('athlete','coach','referee')),
  profile_id uuid not null,
  member_id uuid not null,
  action text not null check (action in ('create','update')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists sports_athlete_profiles_tenant_idx
  on public.sports_athlete_profiles(tenant_id, membership_status);
create index if not exists sports_coach_profiles_tenant_idx
  on public.sports_coach_profiles(tenant_id, professional_status);
create index if not exists sports_referee_profiles_tenant_idx
  on public.sports_referee_profiles(tenant_id, activity_status);
create index if not exists sports_specialist_history_tenant_idx
  on public.sports_specialist_profile_history(tenant_id, created_at desc);

create or replace function public.sports_specialist_profile_audit()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  insert into public.sports_specialist_profile_history
    (tenant_id, profile_type, profile_id, member_id, action, old_data, new_data, changed_by)
  values
    (new.tenant_id, tg_argv[0], new.id, new.member_id,
     case when tg_op = 'INSERT' then 'create' else 'update' end,
     case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
     to_jsonb(new), (select auth.uid()));
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists sports_athlete_profile_audit on public.sports_athlete_profiles;
create trigger sports_athlete_profile_audit
before insert or update on public.sports_athlete_profiles
for each row execute function public.sports_specialist_profile_audit('athlete');
drop trigger if exists sports_coach_profile_audit on public.sports_coach_profiles;
create trigger sports_coach_profile_audit
before insert or update on public.sports_coach_profiles
for each row execute function public.sports_specialist_profile_audit('coach');
drop trigger if exists sports_referee_profile_audit on public.sports_referee_profiles;
create trigger sports_referee_profile_audit
before insert or update on public.sports_referee_profiles
for each row execute function public.sports_specialist_profile_audit('referee');

alter table public.sports_athlete_profiles enable row level security;
alter table public.sports_coach_profiles enable row level security;
alter table public.sports_referee_profiles enable row level security;
alter table public.sports_specialist_profile_history enable row level security;

drop policy if exists sports_athlete_profiles_admin_manage on public.sports_athlete_profiles;
create policy sports_athlete_profiles_admin_manage on public.sports_athlete_profiles
for all to authenticated
using (exists (
  select 1 from public.sports_tenant_memberships tm
  where tm.tenant_id = sports_athlete_profiles.tenant_id
    and tm.user_id = (select auth.uid())
    and tm.status = 'active' and tm.role in ('owner','admin')
))
with check (exists (
  select 1 from public.sports_tenant_memberships tm
  where tm.tenant_id = sports_athlete_profiles.tenant_id
    and tm.user_id = (select auth.uid())
    and tm.status = 'active' and tm.role in ('owner','admin')
));

drop policy if exists sports_coach_profiles_admin_manage on public.sports_coach_profiles;
create policy sports_coach_profiles_admin_manage on public.sports_coach_profiles
for all to authenticated
using (exists (
  select 1 from public.sports_tenant_memberships tm
  where tm.tenant_id = sports_coach_profiles.tenant_id
    and tm.user_id = (select auth.uid())
    and tm.status = 'active' and tm.role in ('owner','admin')
))
with check (exists (
  select 1 from public.sports_tenant_memberships tm
  where tm.tenant_id = sports_coach_profiles.tenant_id
    and tm.user_id = (select auth.uid())
    and tm.status = 'active' and tm.role in ('owner','admin')
));

drop policy if exists sports_referee_profiles_admin_manage on public.sports_referee_profiles;
create policy sports_referee_profiles_admin_manage on public.sports_referee_profiles
for all to authenticated
using (exists (
  select 1 from public.sports_tenant_memberships tm
  where tm.tenant_id = sports_referee_profiles.tenant_id
    and tm.user_id = (select auth.uid())
    and tm.status = 'active' and tm.role in ('owner','admin')
))
with check (exists (
  select 1 from public.sports_tenant_memberships tm
  where tm.tenant_id = sports_referee_profiles.tenant_id
    and tm.user_id = (select auth.uid())
    and tm.status = 'active' and tm.role in ('owner','admin')
));

drop policy if exists sports_specialist_history_admin_read on public.sports_specialist_profile_history;
create policy sports_specialist_history_admin_read on public.sports_specialist_profile_history
for select to authenticated using (exists (
  select 1 from public.sports_tenant_memberships tm
  where tm.tenant_id = sports_specialist_profile_history.tenant_id
    and tm.user_id = (select auth.uid())
    and tm.status = 'active' and tm.role in ('owner','admin')
));
drop policy if exists sports_specialist_history_admin_insert on public.sports_specialist_profile_history;
create policy sports_specialist_history_admin_insert on public.sports_specialist_profile_history
for insert to authenticated with check (exists (
  select 1 from public.sports_tenant_memberships tm
  where tm.tenant_id = sports_specialist_profile_history.tenant_id
    and tm.user_id = (select auth.uid())
    and tm.status = 'active' and tm.role in ('owner','admin')
));

grant select, insert, update on public.sports_athlete_profiles to authenticated;
grant select, insert, update on public.sports_coach_profiles to authenticated;
grant select, insert, update on public.sports_referee_profiles to authenticated;
grant select, insert on public.sports_specialist_profile_history to authenticated;

create or replace function public.create_sports_specialist(
  p_tenant_id uuid,
  p_kind text,
  p_full_name text,
  p_phone text,
  p_sport_type text,
  p_profile jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_member_id uuid;
  v_profile_id uuid;
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_kind not in ('athlete','coach','referee') then
    raise exception 'Invalid specialist type';
  end if;
  if p_full_name is null or length(trim(p_full_name)) < 2 or length(trim(p_full_name)) > 150 then
    raise exception 'Invalid full name';
  end if;
  if not exists (
    select 1 from public.sports_tenant_memberships tm
    where tm.tenant_id = p_tenant_id and tm.user_id = v_user_id
      and tm.status = 'active' and tm.role in ('owner','admin')
  ) then
    raise exception 'Forbidden';
  end if;

  insert into public.sports_members (tenant_id, full_name, phone, sport_type)
  values (p_tenant_id, trim(p_full_name), nullif(trim(p_phone), ''), nullif(trim(p_sport_type), ''))
  returning id into v_member_id;

  if p_kind = 'athlete' then
    insert into public.sports_athlete_profiles
      (tenant_id, member_id, athlete_code, gender, county, membership_status)
    values
      (p_tenant_id, v_member_id, nullif(trim(p_profile->>'code'), ''),
       nullif(p_profile->>'gender',''),
       nullif(trim(p_profile->>'county'), ''),
       coalesce(nullif(p_profile->>'status',''), 'active'))
    returning id into v_profile_id;
  elsif p_kind = 'coach' then
    insert into public.sports_coach_profiles
      (tenant_id, member_id, coach_code, specialty, coaching_grade, certificate_valid_until, professional_status)
    values
      (p_tenant_id, v_member_id, nullif(trim(p_profile->>'code'), ''),
       nullif(trim(p_profile->>'specialty'), ''),
       nullif(trim(p_profile->>'grade'), ''),
       nullif(p_profile->>'valid_until','')::date,
       coalesce(nullif(p_profile->>'status',''), 'active'))
    returning id into v_profile_id;
  else
    insert into public.sports_referee_profiles
      (tenant_id, member_id, referee_code, referee_grade, permitted_sports, card_valid_until, activity_status)
    values
      (p_tenant_id, v_member_id, nullif(trim(p_profile->>'code'), ''),
       nullif(trim(p_profile->>'grade'), ''),
       coalesce(array(select jsonb_array_elements_text(coalesce(p_profile->'permitted_sports','[]'::jsonb))), '{}'),
       nullif(p_profile->>'valid_until','')::date,
       coalesce(nullif(p_profile->>'status',''), 'active'))
    returning id into v_profile_id;
  end if;

  return v_profile_id;
end;
$$;

revoke all on function public.create_sports_specialist(uuid,text,text,text,text,jsonb) from public;
grant execute on function public.create_sports_specialist(uuid,text,text,text,text,jsonb) to authenticated;

commit;