-- METATYA Sports OS core schema (proposed v1)
-- Review and apply only to a dedicated, isolated Supabase project.
-- This schema intentionally models neutral content administration only.

create extension if not exists pgcrypto;

create table if not exists public.sports_tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  display_name text not null,
  sport_label text not null,
  region_label text not null,
  theme jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sports_tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.sports_tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('tenant_admin','editor','reviewer','viewer')),
  status text not null default 'invited' check (status in ('invited','active','disabled')),
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table if not exists public.sports_media_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.sports_tenants(id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 15728640),
  alt_text text not null default '',
  rights_status text not null default 'pending' check (rights_status in ('pending','approved','restricted')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, storage_path),
  unique (id, tenant_id)
);

create table if not exists public.sports_content_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.sports_tenants(id) on delete cascade,
  content_type text not null check (content_type in ('news','notice','organization','honour','document')),
  status text not null default 'draft' check (status in ('draft','in_review','approved','published','archived')),
  title text not null,
  slug text not null,
  summary text not null default '',
  body text not null default '',
  source_reference text,
  historical_person_name text,
  historical_award_label text,
  historical_award_year integer check (historical_award_year is null or historical_award_year between 1900 and 2200),
  media_asset_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug),
  foreign key (media_asset_id, tenant_id)
    references public.sports_media_assets(id, tenant_id)
    on delete restrict
);

create table if not exists public.sports_audit_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.sports_tenants(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sports_memberships_user_tenant_idx
  on public.sports_tenant_memberships(user_id, tenant_id);
create index if not exists sports_content_tenant_status_idx
  on public.sports_content_items(tenant_id, status, content_type);
create index if not exists sports_media_tenant_rights_idx
  on public.sports_media_assets(tenant_id, rights_status);
create index if not exists sports_audit_tenant_created_idx
  on public.sports_audit_events(tenant_id, created_at desc);

create or replace function public.sports_touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $
begin
  new.updated_at = now();
  return new;
end;
$;

create or replace function public.sports_guard_tenant_owned_row()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $
begin
  if new.tenant_id is distinct from old.tenant_id then
    raise exception 'tenant_id is immutable';
  end if;
  return new;
end;
$;

create or replace function public.sports_guard_content_review()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $
begin
  if tg_op = 'INSERT' then
    if new.status not in ('draft','in_review') then
      raise exception 'new content must start as draft or in_review';
    end if;
    new.reviewed_by := null;
    new.published_at := null;
  else
    if new.created_by is distinct from old.created_by then
      raise exception 'created_by is immutable';
    end if;
    if new.status in ('approved','published') and old.status not in ('approved','published') then
      new.reviewed_by := auth.uid();
    end if;
    if new.status = 'published' and old.status <> 'published' then
      new.published_at := now();
    end if;
  end if;
  return new;
end;
$;

drop trigger if exists sports_tenants_touch_updated_at on public.sports_tenants;
create trigger sports_tenants_touch_updated_at
before update on public.sports_tenants
for each row execute function public.sports_touch_updated_at();

drop trigger if exists sports_content_touch_updated_at on public.sports_content_items;
create trigger sports_content_touch_updated_at
before update on public.sports_content_items
for each row execute function public.sports_touch_updated_at();

drop trigger if exists sports_content_guard_tenant on public.sports_content_items;
create trigger sports_content_guard_tenant
before update on public.sports_content_items
for each row execute function public.sports_guard_tenant_owned_row();

drop trigger if exists sports_media_guard_tenant on public.sports_media_assets;
create trigger sports_media_guard_tenant
before update on public.sports_media_assets
for each row execute function public.sports_guard_tenant_owned_row();

drop trigger if exists sports_memberships_guard_tenant on public.sports_tenant_memberships;
create trigger sports_memberships_guard_tenant
before update on public.sports_tenant_memberships
for each row execute function public.sports_guard_tenant_owned_row();

drop trigger if exists sports_content_guard_review on public.sports_content_items;
create trigger sports_content_guard_review
before insert or update on public.sports_content_items
for each row execute function public.sports_guard_content_review();

-- SECURITY DEFINER helpers avoid recursive membership-table RLS checks.
create or replace function public.sports_is_tenant_member(target_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select exists (
    select 1
    from public.sports_tenant_memberships m
    where m.tenant_id = target_tenant
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.sports_has_tenant_role(target_tenant uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select exists (
    select 1
    from public.sports_tenant_memberships m
    where m.tenant_id = target_tenant
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = any(allowed_roles)
  );
$;

revoke all on function public.sports_is_tenant_member(uuid) from public, anon;
revoke all on function public.sports_has_tenant_role(uuid, text[]) from public, anon;
grant execute on function public.sports_is_tenant_member(uuid) to authenticated;
grant execute on function public.sports_has_tenant_role(uuid, text[]) to authenticated;

alter table public.sports_tenants enable row level security;
alter table public.sports_tenant_memberships enable row level security;
alter table public.sports_media_assets enable row level security;
alter table public.sports_content_items enable row level security;
alter table public.sports_audit_events enable row level security;

-- Tenant workspaces are visible only to active members.
drop policy if exists sports_tenants_member_read on public.sports_tenants;
create policy sports_tenants_member_read
on public.sports_tenants for select
using (public.sports_is_tenant_member(id));

drop policy if exists sports_tenants_admin_update on public.sports_tenants;
create policy sports_tenants_admin_update
on public.sports_tenants for update
using (public.sports_has_tenant_role(id, array['tenant_admin']))
with check (public.sports_has_tenant_role(id, array['tenant_admin']));

-- Memberships are readable by the member or tenant admins.
-- No client-side INSERT/UPDATE/DELETE policies are provided intentionally.
drop policy if exists sports_memberships_read on public.sports_tenant_memberships;
create policy sports_memberships_read
on public.sports_tenant_memberships for select
using (
  user_id = auth.uid()
  or public.sports_has_tenant_role(tenant_id, array['tenant_admin'])
);

-- Published content is public; drafts and review states require membership.
drop policy if exists sports_content_read on public.sports_content_items;
create policy sports_content_read
on public.sports_content_items for select
using (
  status = 'published'
  or public.sports_is_tenant_member(tenant_id)
);

drop policy if exists sports_content_insert on public.sports_content_items;
create policy sports_content_insert
on public.sports_content_items for insert
with check (
  public.sports_has_tenant_role(tenant_id, array['tenant_admin','editor'])
  and created_by = auth.uid()
  and status in ('draft','in_review')
);

drop policy if exists sports_content_update on public.sports_content_items;
create policy sports_content_update
on public.sports_content_items for update
using (
  public.sports_has_tenant_role(tenant_id, array['tenant_admin','reviewer'])
  or (
    public.sports_has_tenant_role(tenant_id, array['editor'])
    and status in ('draft','in_review')
  )
)
with check (
  public.sports_has_tenant_role(tenant_id, array['tenant_admin','reviewer'])
  or (
    public.sports_has_tenant_role(tenant_id, array['editor'])
    and status in ('draft','in_review')
  )
);

drop policy if exists sports_content_delete on public.sports_content_items;
create policy sports_content_delete
on public.sports_content_items for delete
using (public.sports_has_tenant_role(tenant_id, array['tenant_admin']));

drop policy if exists sports_media_read on public.sports_media_assets;
create policy sports_media_read
on public.sports_media_assets for select
using (
  (rights_status = 'approved' and exists (
    select 1 from public.sports_content_items c
    where c.media_asset_id = id
      and c.tenant_id = sports_media_assets.tenant_id
      and c.status = 'published'
  ))
  or public.sports_is_tenant_member(tenant_id)
);

drop policy if exists sports_media_insert on public.sports_media_assets;
create policy sports_media_insert
on public.sports_media_assets for insert
with check (
  public.sports_has_tenant_role(tenant_id, array['tenant_admin','editor'])
  and created_by = auth.uid()
  and rights_status = 'pending'
);

drop policy if exists sports_media_update on public.sports_media_assets;
create policy sports_media_update
on public.sports_media_assets for update
using (
  public.sports_has_tenant_role(tenant_id, array['tenant_admin','reviewer'])
  or (
    public.sports_has_tenant_role(tenant_id, array['editor'])
    and rights_status <> 'approved'
  )
)
with check (
  public.sports_has_tenant_role(tenant_id, array['tenant_admin','reviewer'])
  or (
    public.sports_has_tenant_role(tenant_id, array['editor'])
    and rights_status <> 'approved'
  )
);

drop policy if exists sports_media_delete on public.sports_media_assets;
create policy sports_media_delete
on public.sports_media_assets for delete
using (public.sports_has_tenant_role(tenant_id, array['tenant_admin']));

-- Audit records are read-only to tenant admins/reviewers.
-- Inserts should be performed by trusted server-side code only.
drop policy if exists sports_audit_read on public.sports_audit_events;
create policy sports_audit_read
on public.sports_audit_events for select
using (public.sports_has_tenant_role(tenant_id, array['tenant_admin','reviewer']));

-- Membership provisioning, tenant creation, publication transitions, and audit writes
-- must be implemented as trusted server-side functions. Do not expose service-role keys.


-- Annual aggregate athlete statistics only. No person-level athlete records are stored.
-- Public small cells (<5) must be suppressed to reduce re-identification risk.
create table if not exists public.sports_aggregate_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.sports_tenants(id) on delete cascade,
  report_year integer not null check (report_year between 1900 and 2200),
  age_band text not null check (age_band in ('نوجوانان','جوانان','بزرگسالان','پیشکسوتان','نامشخص')),
  gender_group text not null check (gender_group in ('زن','مرد','ثبت‌نشده')),
  athlete_count integer,
  is_suppressed boolean not null default false,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  source_reference text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (is_suppressed = true and athlete_count is null)
    or (is_suppressed = false and athlete_count >= 5)
  ),
  unique (tenant_id, report_year, age_band, gender_group)
);

-- Historical medals are editorial archive entries, not a live ranking/performance system.
create table if not exists public.sports_historical_medals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.sports_tenants(id) on delete cascade,
  person_display_name text not null,
  achievement_title text not null,
  event_name text not null,
  medal_level text not null check (medal_level in ('استانی','کشوری','آسیایی','جهانی','المپیک')),
  medal_type text not null check (medal_type in ('طلا','نقره','برنز')),
  award_year integer not null check (award_year between 1900 and 2200),
  source_reference text not null,
  media_asset_id uuid,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (media_asset_id, tenant_id)
    references public.sports_media_assets(id, tenant_id)
    on delete restrict
);

create index if not exists sports_aggregate_tenant_year_idx
  on public.sports_aggregate_reports(tenant_id, report_year desc, status);
create index if not exists sports_medals_tenant_level_year_idx
  on public.sports_historical_medals(tenant_id, medal_level, award_year desc, status);

alter table public.sports_aggregate_reports enable row level security;
alter table public.sports_historical_medals enable row level security;

drop policy if exists sports_aggregate_read on public.sports_aggregate_reports;
create policy sports_aggregate_read
on public.sports_aggregate_reports for select
using (status = 'published' or public.sports_is_tenant_member(tenant_id));

drop policy if exists sports_aggregate_insert on public.sports_aggregate_reports;
create policy sports_aggregate_insert
on public.sports_aggregate_reports for insert
with check (
  public.sports_has_tenant_role(tenant_id, array['tenant_admin','editor'])
  and created_by = auth.uid()
  and status = 'draft'
);

drop policy if exists sports_aggregate_update on public.sports_aggregate_reports;
create policy sports_aggregate_update
on public.sports_aggregate_reports for update
using (
  public.sports_has_tenant_role(tenant_id, array['tenant_admin','reviewer'])
  or (public.sports_has_tenant_role(tenant_id, array['editor']) and status = 'draft')
)
with check (
  public.sports_has_tenant_role(tenant_id, array['tenant_admin','reviewer'])
  or (public.sports_has_tenant_role(tenant_id, array['editor']) and status = 'draft')
);

drop policy if exists sports_aggregate_delete on public.sports_aggregate_reports;
create policy sports_aggregate_delete
on public.sports_aggregate_reports for delete
using (public.sports_has_tenant_role(tenant_id, array['tenant_admin']));

drop policy if exists sports_medals_read on public.sports_historical_medals;
create policy sports_medals_read
on public.sports_historical_medals for select
using (status = 'published' or public.sports_is_tenant_member(tenant_id));

drop policy if exists sports_medals_insert on public.sports_historical_medals;
create policy sports_medals_insert
on public.sports_historical_medals for insert
with check (
  public.sports_has_tenant_role(tenant_id, array['tenant_admin','editor'])
  and created_by = auth.uid()
  and status = 'draft'
);

drop policy if exists sports_medals_update on public.sports_historical_medals;
create policy sports_medals_update
on public.sports_historical_medals for update
using (
  public.sports_has_tenant_role(tenant_id, array['tenant_admin','reviewer'])
  or (public.sports_has_tenant_role(tenant_id, array['editor']) and status = 'draft')
)
with check (
  public.sports_has_tenant_role(tenant_id, array['tenant_admin','reviewer'])
  or (public.sports_has_tenant_role(tenant_id, array['editor']) and status = 'draft')
);

drop policy if exists sports_medals_delete on public.sports_historical_medals;
create policy sports_medals_delete
on public.sports_historical_medals for delete
using (public.sports_has_tenant_role(tenant_id, array['tenant_admin']));

create or replace function public.sports_guard_aggregate_row()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.tenant_id is distinct from old.tenant_id then
    raise exception 'tenant_id is immutable';
  end if;
  if tg_op = 'UPDATE' and new.created_by is distinct from old.created_by then
    raise exception 'created_by is immutable';
  end if;
  return new;
end;
$$;

create or replace function public.sports_guard_historical_medal()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' then
    if new.tenant_id is distinct from old.tenant_id then
      raise exception 'tenant_id is immutable';
    end if;
    if new.created_by is distinct from old.created_by then
      raise exception 'created_by is immutable';
    end if;
  end if;
  if new.status = 'published' and (new.source_reference is null or length(trim(new.source_reference)) = 0) then
    raise exception 'official source reference required before publication';
  end if;
  if new.status = 'published' and old.status is distinct from 'published' then
    new.reviewed_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists sports_aggregate_guard on public.sports_aggregate_reports;
create trigger sports_aggregate_guard
before update on public.sports_aggregate_reports
for each row execute function public.sports_guard_aggregate_row();

drop trigger if exists sports_medal_guard on public.sports_historical_medals;
create trigger sports_medal_guard
before insert or update on public.sports_historical_medals
for each row execute function public.sports_guard_historical_medal();

-- No athlete-level profiles, participation records, event schedules, performance scores,
-- or ranking tables are created by this migration.
