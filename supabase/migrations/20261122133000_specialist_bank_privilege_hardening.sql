-- Tighten Data API privileges for specialist banks.
-- RLS remains enabled; authenticated admins can read/create/update, never delete.
begin;
revoke all on table public.sports_athlete_profiles from anon;
revoke all on table public.sports_coach_profiles from anon;
revoke all on table public.sports_referee_profiles from anon;
revoke all on table public.sports_specialist_profile_history from anon;

revoke delete on table public.sports_athlete_profiles from authenticated;
revoke delete on table public.sports_coach_profiles from authenticated;
revoke delete on table public.sports_referee_profiles from authenticated;
revoke update, delete on table public.sports_specialist_profile_history from authenticated;

grant select, insert, update on table public.sports_athlete_profiles to authenticated;
grant select, insert, update on table public.sports_coach_profiles to authenticated;
grant select, insert, update on table public.sports_referee_profiles to authenticated;
grant select, insert on table public.sports_specialist_profile_history to authenticated;
commit;