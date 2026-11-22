-- Backfill only existing members who already have recorded results.
-- NOT EXISTS avoids firing the insert audit trigger for already-created profiles.
insert into public.sports_athlete_profiles (tenant_id, member_id, membership_status)
select sm.tenant_id, sm.id,
  case when sm.status in ('active','inactive','suspended') then sm.status else 'pending' end
from public.sports_members sm
where exists (
  select 1 from public.sports_results sr
  where sr.tenant_id = sm.tenant_id and sr.member_id = sm.id
)
and not exists (
  select 1 from public.sports_athlete_profiles ap
  where ap.tenant_id = sm.tenant_id and ap.member_id = sm.id
);