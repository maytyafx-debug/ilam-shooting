# METATYA Sports OS — Live Implementation Status

Last source review: 2026-11-22  
Repository: `maytyafx-debug/ilam-shooting`  
Working branch: `feat/sports-os-shooting-integrated-v1`  
Application root: `sports-os/`  
Connected Supabase project: `megbqtoihsuouiaxpifl`

## 1. Scope

This is the first authenticated operational pilot of the reusable METATYA Sports OS Core, configured for shooting-sports administration in Ilam. It is not the complete nationwide sports federation platform and is not approved for real athlete/minor data or production operations.

## 2. Live database evidence

The active Next.js runtime uses the `public` schema and these five operational tables:

| Table | Current rows | RLS | FORCE RLS |
|---|---:|---|---|
| `sports_tenants` | 2 | enabled | enabled |
| `sports_tenant_memberships` | 1 | enabled | enabled |
| `sports_members` | 1 | enabled | enabled |
| `sports_events` | 1 | enabled | enabled |
| `sports_results` | 1 | enabled | enabled |

Live hardening applied and read-back verified:
- `007_public_sports_rbac_hardening.sql`
- `008_public_sports_rbac_policy_cleanup.sql`

Verified grants/policies:
- `PUBLIC` and `anon` have no table privileges on the five active operational tables.
- `authenticated` can read tenant and self-membership rows; operational DML is constrained by RLS.
- `owner` and `admin` can manage operational rows in their active tenant.
- `referee` can read members/events/results and insert results, but cannot manage members/events or update/delete results.
- `coach`, `staff`, and `member` do not have operational data access in this pilot.
- Tenant ID changes on member, event, and result records are rejected by database triggers.
- Tenant and membership provisioning remain owner-controlled.

Tenant records:
- Original pilot: `باشگاه ورزشی نمونه`, ID `e1f77f6f-da48-493f-94fb-db0c3398188d`
- QA tenant: `سازمان آزمایشی دوم`, ID `7c82debc-10f0-4c31-9c43-2135b083db50`

The current provisioned identity is a member of the original pilot only. A simulated authenticated read showed that identity can see the original tenant and cannot see the QA tenant. The QA tenant currently has no test membership. This is a useful first isolation check, not a complete two-user/two-tenant security test.

Current operational sample data remains one member, one event, and one result in the original tenant. The QA tenant creation did not insert or modify operational records.

## 3. Active application behavior

Implemented in `sports-os/`:
- Supabase Auth password login with SSR cookie sessions.
- Server-side user and active-membership verification.
- Role mapping: owner/admin → admin; referee → referee; coach/staff/member → member.
- Multi-tenant selector when a user has more than one active tenant membership; the last authorized selection is remembered for the current browser session only.
- The selected `tenant_id` is sent as `x-tenant-id` on every operational API request and revalidated against the authenticated user's active membership and role.
- Tenant changes clear tenant-bound lists and form selections; a request-sequence guard prevents slower responses from a previous tenant overwriting the newly selected tenant.
- Admin: create and list members, create and list events, create and list results.
- Referee: read members/events/results and record results only.
- Member: operational data remains blocked; no unverified profile-to-athlete mapping is assumed.
- Persian RTL dashboard, responsive layout, and manual refresh.
- Input validation for names, phone, event date, location, UUID references, score, rank, and notes.
- Private/no-store responses for tenant and operational reads.

Main routes:
- `/login`
- `/`
- `/api/core-sports/tenant`
- `/api/core-sports/members`
- `/api/core-sports/events`
- `/api/core-sports/results`
- `/api/auth/logout`

## 4. Migration distinction — do not mix schemas

The live pilot uses `public.sports_*`.

Repository migrations `005_sports_os_namespaced.sql` and `006_sports_os_tenant_isolation.sql` describe an older `sports_core` schema design. Those migrations are not recorded as applied in the connected project's current migration history and are not used by the active application. Do not run them on the connected project.

The intended long-term direction is a dedicated, carefully isolated Sports OS data environment. Any move from the current public-schema pilot must have a separately reviewed migration, explicit owner approval, a restorable backup, and negative cross-tenant integration tests.

## 5. Git and test evidence

- Earlier security-hardening CI passed at commit `d5ccc740fb89d8a636ee5835fecd5d92d793c978`.
- The current update adds multi-tenant selection, role-gated UI, stricter API validation, unified npm test scripts, and documentation reconciliation.
- GitHub Actions run #108 passed at commit `250a0529597a53636e95fb63759f398909218bd8`: dependency install, TypeScript validation, Next.js production build, static security regression checks, legacy JavaScript syntax, and demo/legacy validation all succeeded.
- Run evidence: https://github.com/maytyafx-debug/ilam-shooting/actions/runs/44086200664
- `npm test` now runs TypeScript validation, static security checks, and demo/legacy validation.
- A successful static test/build does not establish live RLS behavior or production readiness.

## 6. Outstanding blockers

1. Create separate Auth users through Supabase Dashboard or an approved Auth Admin workflow for admin, referee, member, and QA tenant-2 testing. Never insert directly into `auth.users` with SQL.
2. Add only the intended membership rows through a trusted owner-controlled process.
3. Run a full positive/negative matrix across two real user identities and two tenants.
4. Implement a verified Auth-user-to-athlete/member link before enabling athlete self-service.
5. Complete competition entries, official assignments, result review/finalization, protests, versioned corrections, and audit history.
6. Complete athlete and guardian records, minor consent, professional credentials, membership periods, insurance, dues/finance, facilities, documents, talent development, and privacy-preserving analytics.
7. Configure MFA for privileged roles and enable leaked-password protection in Supabase Auth.
8. Review Supabase advisor findings for unrelated existing tables: `public.data_bank`, `public.finance_ledger`, and `public.monetization_opportunities` have RLS enabled but no policies. They were not changed because they are outside the current Sports OS table scope.
9. Run encrypted backup and isolated restore exercises, independent security/privacy review, accessibility/performance checks, and pilot stakeholder acceptance.

## 7. Current Supabase advisor findings

At the time of review:
- WARN: leaked-password protection is disabled in Supabase Auth.
- INFO: `public.data_bank`, `public.finance_ledger`, and `public.monetization_opportunities` have RLS enabled but no policies.

No changes were made to those unrelated tables or Auth settings in this pass.

## 8. Release decision

**Status: authenticated pilot / development MVP — not production-ready.**

Use synthetic test data only. Do not import real athlete, minor, health, insurance, or financial records; do not activate payments; do not merge to `main` or deploy publicly without a separate explicit release decision and verified readiness evidence.


## 7. Authenticated management platform — source review 2026-11-22

Added `app/platform/page.tsx) as the primary post-login management platform. It provides a responsive Persian RTL management shell, 16 navigable module areas, tenant-aware overview, and a basic member directory with a create-member action backed by the existing tenant-scoped API. The module catalogue clearly marks the areas that are not yet connected to operational tables or APIs.

Added `app/workspace/page.tsx) as a supplementary module directory with feature inventories and explicit implementation states. The login flow routes authenticated users to `/platform`; middleware protects `/platform` and `/workspace` and routes authenticated root visits to `/platform`.

Validation evidence: GitHub Actions run 45028421318 passed dependency installation, TypeScript validation, Next.js production build, static security regression checks, legacy JavaScript syntax, and demo validation at commit `1e610c9df0339343787efba84a050979d98f1bbf`. A follow-up route-protection and test-fixture update is now committed and its validation run is pending.

No database migrations, production data writes, or production deployment were performed for these interface changes.

## 8. Single management entry point — 2026-11-22

The legacy `/workspace` route now redirects to the canonical authenticated `/platform` experience. It no longer renders a second dashboard, duplicate module catalogue, tenant selector, or separate navigation. Existing links remain compatible. The canonical platform is the only management UI; module implementation must be added there once and backed by shared domain services.
