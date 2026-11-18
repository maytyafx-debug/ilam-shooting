-- Run only after explicit approval. Removes Migration 013 objects only.
BEGIN;
DROP FUNCTION IF EXISTS public.sports_get_public_athlete_card(uuid);
DROP FUNCTION IF EXISTS public.sports_revoke_athlete_public_card(uuid,uuid);
DROP FUNCTION IF EXISTS public.sports_publish_athlete_public_card(uuid,uuid);
DROP TABLE IF EXISTS public.sports_athlete_public_cards;
COMMIT;
