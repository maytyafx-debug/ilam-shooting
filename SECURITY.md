# METATYA Sports OS — Security Review

**Review baseline:** branch `feat/sports-os-shooting-integrated-v1`  
**Scope:** Active Next.js application under `sports-os/`, the five live `public.sports_*` pilot tables, and repository migration history. The old `sports_core` migrations are historical design artifacts, not the active runtime.  
**Status:** security hardening in progress; **not approved for production or real athlete/minor data**.

## Status vocabulary

- **IMPLEMENTED** — code or migration definition exists in this repository.
- **STATIC-TESTED** — repository checks verify expected source/configuration patterns.
- **NOT LIVE-VERIFIED** — the behavior has not been exercised against the connected Supabase project.
- **BLOCKER** — must be resolved before production or multi-organization onboarding.

## 1. Authentication and sessions

- **IMPLEMENTED:** Supabase Auth password login uses `signInWithPassword` through the Supabase SSR browser client.
- **IMPLEMENTED:** the server client reads/writes the Supabase SSR cookie session.
- **IMPLEMENTED:** middleware calls `auth.getUser()` to refresh/validate the session and redirects unauthenticated requests for the dashboard to `/login`.
- **IMPLEMENTED:** the Auth callback exchanges the one-time authorization code and accepts only a safe relative `next` path; callback failures return to the login page.
- **IMPLEMENTED:** logout is performed by a server route using `auth.signOut()`, which clears the server-managed session cookies.
- **STATIC-TESTED:** source-level checks cover the login, callback, middleware, logout route and role guard.
- **NOT LIVE-VERIFIED:** password login, callback exchange, cookie rotation, expiry, refresh and logout must be tested against the target Supabase Auth project.
- **Operational requirement:** configure the exact production Site URL and redirect allow-list in Supabase Auth. Do not use wildcard production redirects.

## 2. RBAC

The current schema defines these persisted roles:

| Stored role | Intended product role | Allowed operations |
|---|---|---|
| `owner` / `admin` | مدیر سازمان | manage members/events and read/write permitted operational data within the active tenant |
| `referee` | داور | read operational members/events/results and insert results only |
| `coach` / `staff` / `member` | ورزشکار / همکار | no operational-row access in the current pilot; self-service remains blocked pending a verified account-to-member link |

- **IMPLEMENTED:** API handlers call `requireCoreRole`; unauthenticated requests receive 401 and missing/invalid/disallowed profiles receive 403.
- **IMPLEMENTED:** the role guard obtains the user through `auth.getUser()`; it does not trust a role supplied by the browser or user metadata.
- **IMPLEMENTED:** role values are allow-listed before authorization succeeds.
- **IMPORTANT LIMITATION:** no public self-registration or client-side role assignment is provided. An administrator must be provisioned through a trusted owner-controlled process.
- **NOT LIVE-VERIFIED:** create test users for all three roles and verify positive and negative cases against the deployed database.

## 3. Row Level Security

### Active pilot schema — `public.sports_*`

The active Next.js runtime uses exactly these five operational tables:

- `public.sports_tenants`
- `public.sports_tenant_memberships`
- `public.sports_members`
- `public.sports_events`
- `public.sports_results`

**LIVE-APPLIED AND READ-VERIFIED: 2026-11-17.** RLS is enabled and FORCE-enabled on all five tables. `PUBLIC` and `anon` table privileges were revoked. Authenticated access is constrained by table grants and row policies:

- `owner` / `admin`: read and manage members, events and results within their active tenant.
- `referee`: read members/events/results and insert results only; cannot manage members/events or update/delete results.
- `coach`, `staff`, and `member`: no operational-row access in the current policy set. Athlete self-service remains blocked until a verified Auth-user-to-member-record link and dedicated self-row policies exist.
- Tenant memberships are self-readable only; membership provisioning remains owner-controlled.
- A database trigger rejects changes to `tenant_id` on member, event and result rows.
- Authenticated clients have no TRUNCATE, REFERENCES or TRIGGER privileges on these tables.

Live read-back confirmed RLS + FORCE RLS on all five tables, no `anon`/PUBLIC table privileges, and unchanged pilot row counts. A simulated authenticated read for the existing identity returned only its original tenant and did not expose the QA tenant. This is a focused verification, not a complete two-user integration test or production certification.

### Legacy schema proposal — not active

Repository migrations `005_sports_os_namespaced.sql` and `006_sports_os_tenant_isolation.sql` describe an older `sports_core` schema design. They are not used by the current application and must not be applied to the connected pilot. The active runtime uses the `public.sports_*` tables listed above. Any future schema transition requires a separate reviewed migration, verified backup, explicit owner approval, and cross-tenant integration tests.

## 4. Multi-tenancy and organization isolation

**LIVE IMPLEMENTED IN THE CURRENT PILOT:** the tenant API returns only active memberships for the authenticated user. When more than one active membership exists, the dashboard presents an organization selector. The last authorized selection is remembered in browser `sessionStorage` only as a UI preference and is restored only if it still appears in the server-verified membership list. Every operational GET/POST request sends the selected ID in `x-tenant-id`; every API route independently checks the authenticated user's active membership and role. The header and browser storage are selection hints, never authorization.

- Tenant resolution is performed from `sports_tenant_memberships` joined to active `sports_tenants`.
- Admin/owner may manage operational records only within their active tenant.
- Referee may read operational records and insert results only within their active tenant.
- Member/coach/staff have no operational-row access until a verified member-account link and dedicated self-service policies are implemented.
- Tenant membership provisioning remains owner-controlled; authenticated clients cannot create or change memberships.
- The database has immutable `tenant_id` guards on operational members, events and results.
- The UI clears prior tenant data and tenant-bound form selections before loading a newly selected tenant.
- A request-sequence guard prevents a slower response from the previously selected tenant from overwriting the current tenant view.
- Role labels only control presentation; server-side role checks and database RLS remain authoritative.

**Live evidence (2026-11-17):**
- Two active tenant records exist: the original pilot tenant `e1f77f6f-da48-493f-94fb-db0c3398188d` and a QA-only second tenant `7c82debc-10f0-4c31-9c43-2135b083db50`.
- The currently provisioned identity has an active membership only in the original tenant. A simulated authenticated read returned the original tenant and did not expose the QA tenant.
- The existing operational row counts were unchanged by the security hardening and tenant QA setup.
- No real referee, athlete/member, or second-tenant Auth test user has yet been provisioned. Therefore, the full two-user/two-tenant cross-access matrix is still pending.

**Important migration distinction:** repository migrations `005_sports_os_namespaced.sql` and `006_sports_os_tenant_isolation.sql` define an older design in schema `sports_core`. They are not part of the active public-schema runtime and are not recorded as applied in the connected project's migration history. Do not apply them to the connected project. Any future move to a dedicated Sports OS schema/project requires a separately reviewed, reversible migration plan and verified backup.

**IMPLEMENTED IN SOURCE / NOT LIVE-VERIFIED:** finer organizational-unit scoping (federation, board, county committee, club and center), time-bound role grants, guardian links, and scoped professional assignments remain architecture requirements, not implemented access controls.

**Remaining verification:** provision distinct test identities through Supabase Auth and link them through the trusted membership process. Then test positive and negative access for admin, referee, member and tenant-2 user, including read/write denial, suspended tenant, suspended membership, and cross-tenant foreign-key attempts. This is not production security certification.

## 5. Secrets, environment and data handling

- Only the Supabase project URL and publishable/anon key belong in `NEXT_PUBLIC_*` variables.
- Never expose a service-role key, database password, JWT secret or other privileged credential to browser code or commit it to Git.
- Keep environment files with real secrets out of Git; use the ignored local env file and the hosting provider's secret store.
- Do not import real athlete, guardian, insurance, finance or minor data until tenant isolation, consent, least-privilege access, retention and recovery controls are implemented and verified.

## 6. Verification record

| Check | Result |
|---|---|
| Previous Next.js production build (before the current dashboard update) | SUCCESS |
| Current multi-tenant dashboard TypeScript validation | SUCCESS in GitHub Actions run #110 |
| Current Next.js production build | SUCCESS in GitHub Actions run #110 |
| Current static security regression checks | SUCCESS in GitHub Actions run #110 |
| Demo/legacy validation and legacy JavaScript syntax | SUCCESS in GitHub Actions run #110 |
| Auth/RBAC source hardening | IMPLEMENTED; earlier static CI checks passed |
| Live public-schema RLS, FORCE RLS and grants | LIVE READ-BACK VERIFIED |
| Live tenant resolution for the existing identity | VERIFIED: original tenant visible; QA tenant not visible |
| Multi-tenant dashboard selector | IMPLEMENTED; session persistence and stale-response guard included; CI SUCCESS in run #110 |
| Separate admin/referee/member/Tenant2 Auth accounts | NOT PROVISIONED |
| Full two-user/two-tenant integration matrix | NOT RUN |
| Member self-service / verified account-to-member link | BLOCKED BY DESIGN; NOT IMPLEMENTED |
| Backup/restore exercise in an isolated environment | NOT EVIDENCED |
| Independent production security approval | NOT GRANTED |

Latest source validation evidence: [GitHub Actions run #110](https://github.com/maytyafx-debug/ilam-shooting/actions/runs/44088065437) — SUCCESS at commit `dd6bdd46373dec86bc9ece84695c95c1e0f5615c`. This run passed TypeScript validation, Next.js production build, static security regression checks, legacy JavaScript syntax, and demo/legacy validation. This validates source/build checks only, not live role integration or production security.

## 7. Pre-production acceptance checklist

- [ ] Apply reviewed migrations only after explicit owner approval and backup verification.
- [ ] Verify exact Auth redirect URLs, email confirmation policy, session expiry and leaked-password protection.
- [ ] Test admin/referee/member authorization with separate accounts.
- [ ] Test RLS with anon, authenticated users of each role, and a service-role boundary review.
- [x] Implement browser tenant selection and send `x-tenant-id` on operational API requests; each API request still verifies membership and role server-side.
- [ ] Provision distinct Auth test users and complete the full two-user/two-tenant authorization matrix.
- [ ] Keep the old `sports_core` migrations 005/006 unapplied; any future schema move requires a separate reviewed migration and backup plan.
- [ ] Verify two-tenant isolation tests, including negative cross-tenant reads and writes.
- [ ] Verify audit logging, backup/restore, retention and incident response.
- [ ] Run dependency/security scanning and an independent application/database security review.

**Conclusion:** the current pilot has live public-schema tenant tables, forced RLS, role-aware API guards, and a multi-tenant selector in the Next.js dashboard. One existing identity was verified not to see the second QA tenant. Separate role accounts, full two-tenant negative tests, isolated restore evidence and independent review remain outstanding; this is not a production security certification.
