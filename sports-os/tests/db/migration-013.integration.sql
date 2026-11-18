-- Integration tests for Migration 013. Run after fixture on disposable CI PostgreSQL only.
BEGIN;
INSERT INTO auth.users(id) VALUES
 ('aaaaaaaa-0000-4000-8000-000000000011'),
 ('aaaaaaaa-0000-4000-8000-000000000012')
ON CONFLICT DO NOTHING;
INSERT INTO public.sports_tenants(id,name,status) VALUES
 ('11111111-1111-4111-8111-111111111113','Champion Test Club','active')
ON CONFLICT DO NOTHING;
INSERT INTO public.sports_tenant_memberships(tenant_id,user_id,role,status) VALUES
 ('11111111-1111-4111-8111-111111111113','aaaaaaaa-0000-4000-8000-000000000011','owner','active')
ON CONFLICT DO NOTHING;
INSERT INTO public.sports_members(id,tenant_id,full_name,sport_type,status) VALUES
 ('22222222-2222-4222-8222-222222222221','11111111-1111-4111-8111-111111111113','Adult Champion','Athletics','active'),
 ('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111113','Youth Champion','Swimming','active')
ON CONFLICT DO NOTHING;
INSERT INTO public.sports_athlete_profiles(tenant_id,member_id,birth_date,athlete_category) VALUES
 ('11111111-1111-4111-8111-111111111113','22222222-2222-4222-8222-222222222221','1990-01-01','بزرگسالان'),
 ('11111111-1111-4111-8111-111111111113','22222222-2222-4222-8222-222222222222','2012-01-01','نوجوانان')
ON CONFLICT(member_id,tenant_id) DO NOTHING;
INSERT INTO public.sports_events(id,tenant_id,title,sport_type,event_date) VALUES
 ('33333333-3333-4333-8333-333333333331','11111111-1111-4111-8111-111111111113','National Final','Athletics','2026-06-01')
ON CONFLICT DO NOTHING;
INSERT INTO public.sports_results(id,tenant_id,member_id,event_id,rank,score,verification_status) VALUES
 ('44444444-4444-4444-8444-444444444441','11111111-1111-4111-8111-111111111113','22222222-2222-4222-8222-222222222221','33333333-3333-4333-8333-333333333331',1,9.8,'verified'),
 ('44444444-4444-4444-8444-444444444442','11111111-1111-4111-8111-111111111113','22222222-2222-4222-8222-222222222221','33333333-3333-4333-8333-333333333331',2,9.1,'pending_review')
ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000011',true);

DO $$
DECLARE v_token uuid; v_card jsonb; v_youth_token uuid;
BEGIN
 -- Adult card can be issued without guardian media consent.
 v_token:=public.sports_publish_athlete_public_card(
  '11111111-1111-4111-8111-111111111113','22222222-2222-4222-8222-222222222221');
 v_card:=public.sports_get_public_athlete_card(v_token);
 IF v_card->>'full_name'<>'Adult Champion' OR jsonb_array_length(v_card->'achievements')<>1
   OR v_card ? 'birth_date' OR v_card ? 'phone' OR v_card ? 'membership_number' THEN
  RAISE EXCEPTION 'Public QR projection exposed private data or unverified results';
 END IF;
 -- Direct table writes must not bypass the consent-checked publishing RPC.
 BEGIN
  INSERT INTO public.sports_athlete_public_cards(tenant_id,member_id)
  VALUES('11111111-1111-4111-8111-111111111113','22222222-2222-4222-8222-222222222221');
  RAISE EXCEPTION 'Direct public-card insertion unexpectedly succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 -- Minor/unknown-age publication is denied until an active media consent exists.
 BEGIN
  PERFORM public.sports_publish_athlete_public_card(
   '11111111-1111-4111-8111-111111111113','22222222-2222-4222-8222-222222222222');
  RAISE EXCEPTION 'Minor publication unexpectedly succeeded without consent';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 INSERT INTO public.sports_guardian_consents(tenant_id,member_id,consent_scope)
 VALUES('11111111-1111-4111-8111-111111111113','22222222-2222-4222-8222-222222222222','media');
 v_youth_token:=public.sports_publish_athlete_public_card(
  '11111111-1111-4111-8111-111111111113','22222222-2222-4222-8222-222222222222');
 IF public.sports_get_public_athlete_card(v_youth_token) IS NULL THEN
  RAISE EXCEPTION 'Minor card should be visible while current guardian media consent exists';
 END IF;
 UPDATE public.sports_guardian_consents SET revoked_at=now()
 WHERE member_id='22222222-2222-4222-8222-222222222222';
 IF public.sports_get_public_athlete_card(v_youth_token) IS NOT NULL THEN
  RAISE EXCEPTION 'Revoked guardian consent did not immediately hide public card';
 END IF;
 PERFORM public.sports_revoke_athlete_public_card(
  '11111111-1111-4111-8111-111111111113','22222222-2222-4222-8222-222222222221');
 IF public.sports_get_public_athlete_card(v_token) IS NOT NULL THEN
  RAISE EXCEPTION 'Revoked QR token still resolves';
 END IF;
END $$;
RESET ROLE;
ROLLBACK;
