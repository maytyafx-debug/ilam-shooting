# METATYA Sports OS — Core Sports Layer
Shared, discipline-agnostic contracts, authorization, Supabase client, services, and reusable UI.

## Setup
- Install `@supabase/supabase-js` in the Next.js host application.
- Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Apply `supabase/migrations/004_core_sports.sql` in a reviewed environment.
- Add `sports_core` to Supabase Dashboard → API Settings → Exposed schemas.
- Mount the provided route handlers under `src/app/api/core-sports`.
- Provision Auth users and `sports_core.profiles` through a trusted administrator process; never permit self-assigned roles.
- Pass the authenticated user's access token to `ResultsDashboard`.

No service-role secret is used. Caller JWT and RLS govern every database operation. Referee result writes are INSERT-only and intentionally return no row.
