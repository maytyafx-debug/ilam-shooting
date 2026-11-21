-- Isolated integration tests for migration 011 after migration 010.
-- The fixture and migrations run in a disposable PostgreSQL database only.

BEGIN;

-- An active same-tenant owner links an existing confirmed athlete account.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000001', true);

DO $$
DECLARE
  v_user uuid;
  v_code text;
BEGIN
  SELECT linked_user_id, personal_code
    INTO v_user, v_code
  FROM public.sports_admin_link_person(
    '11111111-1111-4111-8111-111111111111',
    'athlete@example.test',
    'athlete',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'
  );

  IF v_user <> 'aaaaaaaa-0000-4000-8000-000000000002'
     OR v_code IS NULL
     OR v_code !~ '^MTX-ATH-' THEN
    RAISE EXCEPTION 'Confirmed athlete account was not linked with a generated identifier';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.sports_members
    WHERE id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'
      AND user_id = v_user
  ) THEN
    RAISE EXCEPTION 'The selected member record was not linked to the confirmed account';
  END IF;
END;
$$;

-- The result guard from migration 010 and the personal portal policies from 011
-- must coexist: the owner verifies, and the linked account reads only its own result.
UPDATE public.sports_results
SET verification_status = 'verified'
WHERE id = '99999999-9999-4999-8999-999999999991';

DO $$
DECLARE
  v_result public.sports_results%ROWTYPE;
BEGIN
  SELECT * INTO v_result
  FROM public.sports_results
  WHERE id = '99999999-9999-4999-8999-999999999991';

  IF v_result.verification_status <> 'verified'
     OR v_result.verified_by <> auth.uid()
     OR v_result.verified_at IS NULL THEN
    RAISE EXCEPTION 'Migration 010 result verification guard did not stamp the owner';
  END IF;
END;
$$;

-- Coach and referee profiles are created only through owner-controlled linking.
DO $$
BEGIN
  PERFORM * FROM public.sports_admin_link_person(
    '11111111-1111-4111-8111-111111111111',
    'coach@example.test',
    'coach',
    NULL
  );
  PERFORM * FROM public.sports_admin_link_person(
    '11111111-1111-4111-8111-111111111111',
    'referee@example.test',
    'referee',
    NULL
  );
END;
$$;

-- An owner can assign a referee inside the same tenant.
INSERT INTO public.sports_official_assignments
  (id, tenant_id, event_id, referee_user_id)
VALUES
  ('88888888-8888-4888-8888-888888888881',
   '11111111-1111-4111-8111-111111111111',
   'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
   'aaaaaaaa-0000-4000-8000-000000000004');

-- Cross-tenant owner cannot link an account into another tenant.
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-4000-8000-000000000001', true);

DO $$
DECLARE
  v_rejected boolean := false;
BEGIN
  BEGIN
    PERFORM * FROM public.sports_admin_link_person(
      '11111111-1111-4111-8111-111111111111',
      'unconfirmed@example.test',
      'athlete',
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'
    );
  EXCEPTION WHEN OTHERS THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'Cross-tenant owner unexpectedly linked a person';
  END IF;
END;
$$;

-- Unconfirmed email accounts cannot be linked by an authorized owner.
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000001', true);

DO $$
DECLARE
  v_rejected boolean := false;
BEGIN
  BEGIN
    PERFORM * FROM public.sports_admin_link_person(
      '11111111-1111-4111-8111-111111111111',
      'unconfirmed@example.test',
      'athlete',
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'
    );
  EXCEPTION WHEN OTHERS THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'Unconfirmed account was unexpectedly linked';
  END IF;
END;
$$;

-- A linked athlete can read only its own member, result, and related event.
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000002', true);

DO $$
DECLARE
  v_members integer;
  v_results integer;
  v_events integer;
BEGIN
  SELECT count(*) INTO v_members FROM public.sports_members;
  SELECT count(*) INTO v_results FROM public.sports_results;
  SELECT count(*) INTO v_events FROM public.sports_events;

  IF v_members <> 1 OR v_results <> 1 OR v_events <> 1 THEN
    RAISE EXCEPTION 'Personal portal exposed unexpected rows (members %, results %, events %)',
      v_members, v_results, v_events;
  END IF;
END;
$$;

-- Coach sees only their own staff profile.
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000003', true);

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.sports_staff_profiles;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Coach personal profile isolation failed';
  END IF;
END;
$$;

-- Referee sees only their own staff profile and assignment.
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000004', true);

DO $$
DECLARE
  v_profiles integer;
  v_assignments integer;
BEGIN
  SELECT count(*) INTO v_profiles FROM public.sports_staff_profiles;
  SELECT count(*) INTO v_assignments FROM public.sports_official_assignments;
  IF v_profiles <> 1 OR v_assignments <> 1 THEN
    RAISE EXCEPTION 'Referee personal profile or assignment isolation failed';
  END IF;
END;
$$;

-- A member cannot self-link or create a personal link.
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000002', true);

DO $$
DECLARE
  v_rejected boolean := false;
BEGIN
  BEGIN
    PERFORM * FROM public.sports_admin_link_person(
      '11111111-1111-4111-8111-111111111111',
      'athlete@example.test',
      'athlete',
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'
    );
  EXCEPTION WHEN OTHERS THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'A member unexpectedly self-linked through the admin function';
  END IF;
END;
$$;

ROLLBACK;
