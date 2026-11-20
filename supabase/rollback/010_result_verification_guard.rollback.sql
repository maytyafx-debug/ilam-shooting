-- Rollback for 010_result_verification_guard.sql.
-- Safe for existing data: removes only the verification guard trigger/function.
-- Does not alter result rows, columns, policies, grants, or migration history.

BEGIN;

DROP TRIGGER IF EXISTS sports_results_verification_guard
  ON public.sports_results;

DROP FUNCTION IF EXISTS public.sports_guard_results_verification();

COMMIT;
