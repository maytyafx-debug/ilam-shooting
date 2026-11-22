-- Audit only rows actually written; keep update timestamps in a separate BEFORE trigger.
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
  return new;
end;
$$;

create or replace function public.sports_specialist_profile_touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists sports_athlete_profile_audit on public.sports_athlete_profiles;
drop trigger if exists sports_coach_profile_audit on public.sports_coach_profiles;
drop trigger if exists sports_referee_profile_audit on public.sports_referee_profiles;

drop trigger if exists sports_athlete_profile_touch_updated_at on public.sports_athlete_profiles;
create trigger sports_athlete_profile_touch_updated_at
before update on public.sports_athlete_profiles
for each row execute function public.sports_specialist_profile_touch_updated_at();
create trigger sports_athlete_profile_audit
after insert or update on public.sports_athlete_profiles
for each row execute function public.sports_specialist_profile_audit('athlete');

drop trigger if exists sports_coach_profile_touch_updated_at on public.sports_coach_profiles;
create trigger sports_coach_profile_touch_updated_at
before update on public.sports_coach_profiles
for each row execute function public.sports_specialist_profile_touch_updated_at();
create trigger sports_coach_profile_audit
after insert or update on public.sports_coach_profiles
for each row execute function public.sports_specialist_profile_audit('coach');

drop trigger if exists sports_referee_profile_touch_updated_at on public.sports_referee_profiles;
create trigger sports_referee_profile_touch_updated_at
before update on public.sports_referee_profiles
for each row execute function public.sports_specialist_profile_touch_updated_at();
create trigger sports_referee_profile_audit
after insert or update on public.sports_referee_profiles
for each row execute function public.sports_specialist_profile_audit('referee');

revoke all on function public.sports_specialist_profile_audit() from public, anon, authenticated;
revoke all on function public.sports_specialist_profile_touch_updated_at() from public, anon, authenticated;