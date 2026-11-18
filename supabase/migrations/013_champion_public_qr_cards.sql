-- METATYA Sports OS — consent-gated champion cards with revocable public QR tokens.
-- Additive migration. Public RPC returns a strict allow-list; private athlete data stays private.
BEGIN;
CREATE TABLE IF NOT EXISTS public.sports_athlete_public_cards (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.sports_tenants(id) ON DELETE CASCADE,
 member_id uuid NOT NULL,
 public_token uuid NOT NULL DEFAULT gen_random_uuid(),
 published_at timestamptz, revoked_at timestamptz,
 created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,member_id), UNIQUE(public_token),
 FOREIGN KEY(member_id,tenant_id) REFERENCES public.sports_members(id,tenant_id) ON DELETE CASCADE,
 CHECK(revoked_at IS NULL OR published_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS sports_athlete_public_cards_tenant_published_idx
 ON public.sports_athlete_public_cards(tenant_id,published_at DESC)
 WHERE published_at IS NOT NULL AND revoked_at IS NULL;
ALTER TABLE public.sports_athlete_public_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sports_athlete_public_cards_admin_manage ON public.sports_athlete_public_cards;
CREATE POLICY sports_athlete_public_cards_admin_manage ON public.sports_athlete_public_cards
 FOR ALL TO authenticated
 USING(EXISTS(SELECT 1 FROM public.sports_tenant_memberships tm
  WHERE tm.tenant_id=sports_athlete_public_cards.tenant_id AND tm.user_id=(SELECT auth.uid())
  AND tm.status='active' AND tm.role IN('owner','admin')))
 WITH CHECK(EXISTS(SELECT 1 FROM public.sports_tenant_memberships tm
  WHERE tm.tenant_id=sports_athlete_public_cards.tenant_id AND tm.user_id=(SELECT auth.uid())
  AND tm.status='active' AND tm.role IN('owner','admin')));
REVOKE ALL ON public.sports_athlete_public_cards FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.sports_athlete_public_cards TO authenticated;

CREATE OR REPLACE FUNCTION public.sports_publish_athlete_public_card(p_tenant_id uuid,p_member_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $publish_card$
DECLARE v_actor uuid:=auth.uid(); v_birth_date date; v_status text; v_token uuid;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.sports_tenant_memberships tm
  WHERE tm.tenant_id=p_tenant_id AND tm.user_id=v_actor AND tm.status='active' AND tm.role IN('owner','admin'))
 THEN RAISE EXCEPTION 'Active organization administrator required' USING ERRCODE='42501'; END IF;
 SELECT m.status,p.birth_date INTO v_status,v_birth_date FROM public.sports_members m
 LEFT JOIN public.sports_athlete_profiles p ON p.member_id=m.id AND p.tenant_id=m.tenant_id
 WHERE m.id=p_member_id AND m.tenant_id=p_tenant_id;
 IF NOT FOUND OR v_status<>'active' THEN
  RAISE EXCEPTION 'Only active athlete records can receive a public card' USING ERRCODE='22023';
 END IF;
 -- Unknown age is treated conservatively as a minor.
 IF v_birth_date IS NULL OR age(current_date,v_birth_date)<interval '18 years' THEN
  IF NOT EXISTS(SELECT 1 FROM public.sports_guardian_consents gc
   WHERE gc.tenant_id=p_tenant_id AND gc.member_id=p_member_id AND gc.consent_scope='media'
   AND gc.revoked_at IS NULL AND (gc.expires_at IS NULL OR gc.expires_at>now()))
  THEN RAISE EXCEPTION 'Current guardian media consent is required' USING ERRCODE='42501'; END IF;
 END IF;
 INSERT INTO public.sports_athlete_public_cards(tenant_id,member_id,public_token,published_at,revoked_at,created_by,updated_at)
 VALUES(p_tenant_id,p_member_id,gen_random_uuid(),now(),NULL,v_actor,now())
 ON CONFLICT(tenant_id,member_id) DO UPDATE SET public_token=gen_random_uuid(),published_at=now(),
 revoked_at=NULL,created_by=v_actor,updated_at=now() RETURNING public_token INTO v_token;
 RETURN v_token;
END;
$publish_card$;

CREATE OR REPLACE FUNCTION public.sports_revoke_athlete_public_card(p_tenant_id uuid,p_member_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $revoke_card$
DECLARE v_actor uuid:=auth.uid();
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.sports_tenant_memberships tm
  WHERE tm.tenant_id=p_tenant_id AND tm.user_id=v_actor AND tm.status='active' AND tm.role IN('owner','admin'))
 THEN RAISE EXCEPTION 'Active organization administrator required' USING ERRCODE='42501'; END IF;
 UPDATE public.sports_athlete_public_cards SET revoked_at=COALESCE(revoked_at,now()),updated_at=now()
 WHERE tenant_id=p_tenant_id AND member_id=p_member_id;
 RETURN FOUND;
END;
$revoke_card$;

-- Anonymous access is limited to this allow-listed projection.
CREATE OR REPLACE FUNCTION public.sports_get_public_athlete_card(p_token uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $public_card$
 SELECT jsonb_build_object('full_name',m.full_name,'sport_type',m.sport_type,
  'athlete_category',p.athlete_category,'organization',t.name,'published_at',c.published_at,
  'achievements',COALESCE((
   SELECT jsonb_agg(jsonb_build_object('event_title',e.title,'sport_type',e.sport_type,
    'event_date',e.event_date,'rank',r.rank,
    'medal',CASE r.rank WHEN 1 THEN 'طلا' WHEN 2 THEN 'نقره' WHEN 3 THEN 'برنز' END)
    ORDER BY e.event_date DESC)
   FROM public.sports_results r JOIN public.sports_events e ON e.id=r.event_id AND e.tenant_id=r.tenant_id
   WHERE r.member_id=m.id AND r.tenant_id=m.tenant_id AND r.verification_status='verified'
    AND r.rank IN(1,2,3)
  ),'[]'::jsonb))
 FROM public.sports_athlete_public_cards c
 JOIN public.sports_members m ON m.id=c.member_id AND m.tenant_id=c.tenant_id
 JOIN public.sports_tenants t ON t.id=c.tenant_id
 LEFT JOIN public.sports_athlete_profiles p ON p.member_id=m.id AND p.tenant_id=m.tenant_id
 WHERE c.public_token=p_token AND c.published_at IS NOT NULL AND c.revoked_at IS NULL
  AND m.status='active' AND t.status='active' LIMIT 1;
$public_card$;

REVOKE ALL ON FUNCTION public.sports_publish_athlete_public_card(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sports_publish_athlete_public_card(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.sports_revoke_athlete_public_card(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sports_revoke_athlete_public_card(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.sports_get_public_athlete_card(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sports_get_public_athlete_card(uuid) TO anon,authenticated;
REVOKE ALL ON FUNCTION public.sports_prevent_tenant_change() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS sports_athlete_public_cards_tenant_immutable ON public.sports_athlete_public_cards;
CREATE TRIGGER sports_athlete_public_cards_tenant_immutable BEFORE UPDATE ON public.sports_athlete_public_cards
 FOR EACH ROW EXECUTE FUNCTION public.sports_prevent_tenant_change();
COMMIT;
