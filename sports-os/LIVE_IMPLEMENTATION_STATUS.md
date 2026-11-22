# METATYA Sports OS — Version 1 Readiness Status

Last source review: 2026-11-22
Repository: `maytyafx-debug/ilam-shooting`
Working branch: `feat/sports-os-shooting-integrated-v1`
Application root: `sports-os/`

## Release decision

**Current state: authenticated development pilot / partial MVP. NOT ready for production or real sensitive records.**

This document is the single source of truth for Version 1 readiness. Completion is evidence-based: a feature is not complete merely because it appears in the navigation.

Version 1 scope is the safe administrative platform: organization directory, clubs/centres, member registry, professional/credential directory, administrative calendar, membership administration, insurance administration, finance administration, document/secretariat, facilities/assets, communications, aggregate management reports, access administration, security and audit. Any operational specialist workflows outside this administrative scope are explicitly excluded from this V1 delivery.

## Architecture and current implementation

- Next.js application under `sports-os/`, Supabase Auth with SSR cookie sessions.
- One canonical management interface: `/platform`. Legacy `/workspace` redirects to `/platform`; do not create another dashboard or parallel navigation.
- Protected routes: `/login`, `/`, `/platform`; server-side user and active-tenant membership checks.
- Tenant selection is limited to active memberships returned by the server. Every tenant-scoped API request revalidates membership and role.
- Tenant-bound UI data is cleared on tenant changes. A request-sequence guard ignores stale responses from a previously selected tenant.
- Existing account is to be retained and verified; do not create a duplicate account.
- Current connected data surface is limited to the five existing `public.sports_*` tables: `sports_tenants`, `sports_tenant_memberships`, `sports_members`, `sports_events`, `sports_results`.
- Current live pilot evidence previously recorded: two tenant rows, one membership, one member, one event, one result. These figures must be re-queried before being treated as current.
- Existing API surfaces include tenant resolution, member, event and result endpoints. The V1 administrative release must not expand specialist operational workflows; retain only administrative calendar/event metadata where appropriate and do not use specialist scoring/result functions as a V1 acceptance requirement.
- Persian RTL dashboard and a single module directory exist. At last source review, only the basic member directory is identified as connected in the canonical platform; other module cards are honest placeholders, not completed modules.

## Security and data boundary

- Runtime uses the `public` schema. Older migrations `005_sports_os_namespaced.sql` and `006_sports_os_tenant_isolation.sql` describe a legacy `sports_core` design and must not be applied to the connected project.
- Existing RLS/FORCE RLS and grants were previously read-back verified for the five operational tables. Re-run live checks before release.
- Tenant context is resolved from the authenticated user's active membership; the client-supplied tenant identifier is never trusted by itself.
- Do not alter unrelated tables such as `public.data_bank`, `public.finance_ledger`, or `public.monetization_opportunities` as part of this project.
- Do not import real personal, minor, guardian, health, insurance, or financial data until purpose limitation, consent/authority, least-privilege access, retention, encryption, audit and recovery controls have been independently verified.
- Use synthetic data only for development and automated tests.
- Do not create, modify or delete production database records, apply migrations to the connected Supabase project, change authentication settings, or deploy publicly without explicit scoped approval.
- Privileged MFA and leaked-password protection remain release blockers until enabled and verified in the Supabase project.
- Encrypted backup and an isolated restore drill are release blockers.

## Current module readiness

| Area | Evidence-based status | V1 work remaining |
|---|---|---|
| Authentication and sessions | Implemented in source; existing account not yet fully revalidated for release | Verify the user's existing account, session renewal, logout and recovery flows |
| Tenant and role enforcement | Implemented in source; partial prior live checks | Positive and negative role/tenant test matrix; no duplicate real identity |
| Single platform shell | Implemented | Accessibility, responsive and navigation regression checks |
| Member registry | Basic list/create API and UI connected | Complete safe profile fields, validation, duplicate detection, audit and privacy controls |
| Organization hierarchy | Not connected | Units and hierarchy records, scoped management APIs and UI |
| Clubs and centres | Not connected | Administrative directory, status and document references |
| Professionals and credentials | Not connected | Credential records, expiry reminders, restricted document handling |
| Administrative calendar | Not connected as a complete module | Meetings, internal appointments and reminders |
| Membership administration | Not connected | Membership periods, renewals, status history and approvals |
| Insurance administration | Not connected | Restricted coverage metadata, expiry tracking and access controls |
| Finance administration | Not connected | Ledger-safe administrative records, reconciliation and approval boundaries |
| Documents and secretariat | Not connected | Secure storage, classification, versioning, retention and correspondence register |
| Facilities and assets | Not connected | Asset register, location, condition and maintenance records |
| Communications | Not connected | Announcement workflow, recipient permissions and delivery audit |
| Management analytics | Not connected | Privacy-preserving aggregate reports with verified source definitions |
| Access administration | Partial role enforcement only | Role assignment workflow, scope, expiry, approver, revocation and audit |
| Security and audit | Partial controls in source/database | Append-only audit evidence, MFA, alerting, backup/restore and security review |

## CI and source validation

- The repository has a committed lockfile at `sports-os/package-lock.json`.
- The validation workflow now uses `npm ci --no-audit --no-fund`, has `contents: read` permission only, and no longer writes generated lockfiles back to the branch.
- Static security regression checks include tenant request sequencing.
- Latest workflow configuration change is commit `e83880b2409500e1443280b13c9faf705603aa58`.
- CI status for that commit has not yet been confirmed. Do not mark the workflow as passed until GitHub Actions reports success for that exact commit.
- A green source/build workflow is necessary but does not prove live RLS, account, backup, or production readiness.

## Required completion gates — execute in order

1. **Source and build gate:** run lockfile-based install, TypeScript, static security tests, production build and legacy checks on the current branch; resolve every failure.
2. **Identity gate:** verify the owner's existing Auth account, active membership and intended role. Never create a duplicate real account. Create synthetic QA identities only if strictly needed, in an isolated test environment, with approval.
3. **Authorization gate:** test allowed and denied operations across roles and tenants, including missing, invalid, inactive and cross-tenant identifiers.
4. **Administrative data model gate:** design and review one coherent tenant-scoped schema for the missing administrative modules. Produce forward and rollback migrations; do not apply them to the connected project without explicit approval and a restorable backup.
5. **Module integration gate:** implement shared services, validation, authorization and audit once; connect each module to the same canonical platform. No duplicate forms, directories, dashboards or parallel data capture.
6. **Privacy and records gate:** define data classification, purpose, minimum fields, consent/guardian authority where applicable, retention, deletion/export and restricted document handling before sensitive fields are enabled.
7. **Operational controls gate:** enable and verify privileged MFA, leaked-password protection, rate limiting, secure secrets handling, logging and alerting.
8. **Recovery gate:** produce encrypted backups and demonstrate restore into an isolated environment; record recovery evidence.
9. **Quality gate:** test accessibility, mobile layout, keyboard navigation, performance, error handling, concurrency and tenant switching.
10. **Pilot gate:** obtain stakeholder acceptance using synthetic or explicitly approved low-risk records; document support, incident response and rollback.
11. **Release gate:** only after all gates pass, request explicit approval for production migration and deployment. No automatic promotion to main or public deployment.

## Definition of Version 1 operational

V1 may be declared operational only when:
- the existing owner account can sign in and use the correct authorized organization;
- every released administrative module has real, tenant-scoped persistence and server-side authorization;
- cross-tenant and unauthorized access tests fail closed;
- sensitive data controls and audit are verified;
- CI passes on the exact release candidate;
- encrypted backup and isolated restore are demonstrated;
- the pilot is accepted and rollback is documented;
- the owner explicitly approves the production release.

**Until then, status remains: development pilot / partial MVP.**
