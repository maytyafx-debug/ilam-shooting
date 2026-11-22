-- METATYA SPORTS OS — administrative V1 schema proposal
-- STATUS: PROPOSAL ONLY. NOT APPLIED TO THE CONNECTED PROJECT.
-- Apply only in an isolated Supabase development database after review.
-- The proposal intentionally stores administrative metadata only.

begin;

create table if not exists public.sports_admin_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.sports_tenants(id) on delete restrict,
  record_type text not null check (record_type in (
    'organization_unit',
    'club',
    'professional',
    'membership',
    'calendar',
    'insurance',
    'finance',
    'document',
    'asset',
    'announcement',
    'training',
    'honour'
  )),
  title text not null check (char_length(btrim(title)) between 2 and 180),
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 16384),
  status text not null default 'active'
    check (status in ('draft','pending','active','approved','rejected','expired','archived','paid','void')),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id)
);

create index if not exists sports_admin_records_tenant_type_created_idx
  on public.sports_admin_records (tenant_id, record_type, created_at desc);
create index if not exists sports_admin_records_tenant_status_idx
  on public.sports_admin_records (tenant_id, status, updated_at desc);

alter table public.sports_admin_records enable row level security;
alter table public.sports_admin_records force row level security;

drop policy if exists sports_admin_records_select_admin on public.sports_admin_records;
create policy sports_admin_records_select_admin
  on public.sports_admin_records for select to authenticated
  using ((select private.has_active_tenant_role(tenant_id, array['owner','admin'])));

drop policy if exists sports_admin_records_insert_admin on public.sports_admin_records;
create policy sports_admin_records_insert_admin
  on public.sports_admin_records for insert to authenticated
  with check ((select private.has_active_tenant_role(tenant_id, array['owner','admin'])));

drop policy if exists sports_admin_records_update_admin on public.sports_admin_records;
create policy sports_admin_records_update_admin
  on public.sports_admin_records for update to authenticated
  using ((select private.has_active_tenant_role(tenant_id, array['owner','admin'])))
  with check ((select private.has_active_tenant_role(tenant_id, array['owner','admin'])));

drop policy if exists sports_admin_records_delete_admin on public.sports_admin_records;
create policy sports_admin_records_delete_admin
  on public.sports_admin_records for delete to authenticated
  using ((select private.has_active_tenant_role(tenant_id, array['owner','admin'])));

-- Privileged users must complete TOTP MFA before any direct Data API access.
drop policy if exists sports_admin_records_mfa_required on public.sports_admin_records;
create policy sports_admin_records_mfa_required
  on public.sports_admin_records as restrictive for all to authenticated
  using (
    (select auth.jwt()->>'aal') = 'aal2'
    or not (select private.has_active_tenant_role(tenant_id, array['owner','admin']))
  )
  with check (
    (select auth.jwt()->>'aal') = 'aal2'
    or not (select private.has_active_tenant_role(tenant_id, array['owner','admin']))
  );

create table if not exists public.sports_admin_audit_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.sports_tenants(id) on delete restrict,
  record_id uuid not null,
  record_type text not null,
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  actor_user_id uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now()
);

create index if not exists sports_admin_audit_tenant_time_idx
  on public.sports_admin_audit_events (tenant_id, occurred_at desc);
create index if not exists sports_admin_audit_record_idx
  on public.sports_admin_audit_events (record_id, occurred_at desc);

alter table public.sports_admin_audit_events enable row level security;
alter table public.sports_admin_audit_events force row level security;

drop policy if exists sports_admin_audit_select_admin on public.sports_admin_audit_events;
create policy sports_admin_audit_select_admin
  on public.sports_admin_audit_events for select to authenticated
  using ((select private.has_active_tenant_role(tenant_id, array['owner','admin'])));

drop policy if exists sports_admin_audit_mfa_required on public.sports_admin_audit_events;
create policy sports_admin_audit_mfa_required
  on public.sports_admin_audit_events as restrictive for select to authenticated
  using (
    (select auth.jwt()->>'aal') = 'aal2'
    or not (select private.has_active_tenant_role(tenant_id, array['owner','admin']))
  );

create or replace function private.sports_admin_records_audit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
begin
  if tg_op = 'DELETE' then
    insert into public.sports_admin_audit_events
      (tenant_id, record_id, record_type, action, actor_user_id)
    values (old.tenant_id, old.id, old.record_type, tg_op, auth.uid());
    return old;
  end if;

  if tg_op = 'UPDATE' and old.tenant_id is distinct from new.tenant_id then
    raise exception 'tenant_id is immutable';
  end if;

  new.updated_at := now();
  new.updated_by := auth.uid();

  insert into public.sports_admin_audit_events
    (tenant_id, record_id, record_type, action, actor_user_id)
  values (new.tenant_id, new.id, new.record_type, tg_op, auth.uid());

  return new;
end;
$function$;

revoke all on function private.sports_admin_records_audit() from public, anon, authenticated;

drop trigger if exists sports_admin_records_audit_trigger on public.sports_admin_records;
create trigger sports_admin_records_audit_trigger
  before insert or update or delete on public.sports_admin_records
  for each row execute function private.sports_admin_records_audit();

grant select, insert, update, delete on public.sports_admin_records to authenticated;
grant select on public.sports_admin_audit_events to authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.sports_admin_audit_events from anon, authenticated;

commit;

-- Supabase changed Data API exposure defaults for newly created public tables.
-- Keep the public schema exposed only if required, and retain the explicit
-- authenticated grants above; RLS remains the row-level authorization boundary.
