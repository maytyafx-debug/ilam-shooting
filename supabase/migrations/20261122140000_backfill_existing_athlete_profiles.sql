-- Backfill only existing members who already have recorded results.
-- This creates no invented identities and leaves all other member rows unchanged.
insert into public.sports_athlete_profiles (tenant_id, member_id, membership_status)
select sm.tenant_id, sm.id,
  case when sm.status in ('active','inactive','suspended') then sm.status else 'pending' end
from public.sports_members sm
where exists (
  select 1 from public.sports_results sr
  where sr.tenant_id = sm.tenant_id and sr.member_id = sm.id
)
on conflict (member_id, tenant_id) do nothing;