-- Integration tests for supabase/migrations/010_result_verification_guard.sql.
-- Run only against the disposable PostgreSQL service in GitHub Actions.

BEGIN;

-- 1. Referee can insert, but supplied verification fields are discarded.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000002', true);

DO $$
DECLARE
  v_result public.sports_results%ROWTYPE;
  v_count integer;
BEGIN
  INSERT INTO public.sports_results (
    id, tenant_id, score, verification_status, verified_by, verified_at
  ) VALUES (
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
    '11111111-1111-4111-8111-111111111111',
    9.25,
    'verified',
    'bbbbbbbb-0000-4000-8000-000000000001',
    now()
  )
  RETURNING * INTO v_result;

  IF v_result.verification_status <> 'pending_review'
     OR v_result.verified_by IS NOT NULL
     OR v_result.verified_at IS NOT NULL THEN
    RAISE EXCEPTION 'INSERT did not force pending_review and clear verifier metadata';
  END IF;

  UPDATE public.sports_results
  SET verification_status = 'verified'
  WHERE id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Referee unexpectedly updated verification status';
  END IF;
END;
$$;

-- 2. Active same-tenant owner can verify; DB stamps actor/time.
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000001', true);

DO $$
DECLARE
  v_result public.sports_results%ROWTYPE;
BEGIN
  UPDATE public.sports_results
  SET verification_status = 'verified'
  WHERE id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2'
  RETURNING * INTO v_result;

  IF v_result.verification_status <> 'verified'
     OR v_result.verified_by <> auth.uid()
     OR v_result.verified_at IS NULL THEN
    RAISE EXCEPTION 'Owner verification was not stamped by the database';
  END IF;

  UPDATE public.sports_results
  SET score = 9.5
  WHERE id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2'
  RETURNING * INTO v_result;
  IF v_result.score <> 9.5 OR v_result.verified_by <> auth.uid() THEN
    RAISE EXCEPTION 'Ordinary result edit unexpectedly changed verification metadata';
  END IF;

  UPDATE public.sports_results
  SET verification_status = 'pending_review'
  WHERE id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2'
  RETURNING * INTO v_result;
  IF v_result.verified_by IS NOT NULL OR v_result.verified_at IS NOT NULL THEN
    RAISE EXCEPTION 'Reset to pending_review did not clear verifier metadata';
  END IF;

  BEGIN
    UPDATE public.sports_results
    SET verified_by = 'bbbbbbbb-0000-4000-8000-000000000001'
    WHERE id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2';
    RAISE EXCEPTION 'Independent verifier metadata edit unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;

-- 3. An admin in another tenant cannot see/update this tenant's result.
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-4000-8000-000000000001', true);

DO $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.sports_results
  SET verification_status = 'verified'
  WHERE id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Cross-tenant admin unexpectedly changed a result';
  END IF;
END;
$$;

-- 4. A trusted service role without an end-user JWT cannot verify.
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.sub', '', true);

DO $$
BEGIN
  BEGIN
    UPDATE public.sports_results
    SET verification_status = 'verified'
    WHERE id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
    RAISE EXCEPTION 'Service role without auth.uid() unexpectedly verified a result';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;

ROLLBACK;
