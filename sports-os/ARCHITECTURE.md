# METATYA Sports OS — Shooting Sports Architecture v1

## Product shape
METATYA Sports OS is a modular, multi-discipline sports management platform. This repository is the first implementation and primary working foundation of METATYA Sports OS. It contains two strictly separated layers: (1) Core Sports Layer, providing reusable, discipline-agnostic capabilities for clubs, member profiles, events, results, roles, and auditability; and (2) the Shooting module, containing shooting-specific workflows, terminology, rules, and configuration. The initial pilot tenant is the Ilam Shooting Board. Future sport disciplines must integrate through the shared Core contracts without copying or coupling their domain logic to the Shooting module.

## Tenant model
- A tenant represents a shooting-sport federation/board at a regional or organizational level.
- The current configuration contains only `ilam-shooting`.
- Tenant-owned records always include `tenant_id`.
- Tenant selection in the browser is presentation only. The server must derive and enforce tenant scope from verified host/session membership.
- No cross-tenant query is permitted by default.
- Platform operations and tenant operations use separate authorization paths.

## Roles
- `tenant_admin`: manage tenant profile, memberships through a trusted server workflow, and all tenant content.
- `president`: tenant-scoped senior role; may access only explicitly authorized aggregate administrative reports, never individual athlete records.
- `editor`: create and edit draft content and upload proposed media.
- `reviewer`: review, approve, publish, or archive content.
- `viewer`: read tenant-private drafts only when explicitly granted.
- Platform operators use a separate privileged control plane and do not receive implicit public-tenant editing access.

## Shared content types
- `news`, `notice`, `organization`, `honour`, `document`.
- The honours type is a historical editorial archive, not a live performance database.
- The current public/demo foundation does not yet implement operational competition scheduling, participant registration, athlete performance, score capture, or ranking workflows. These are planned product domains and require separate backend implementation and acceptance tests.

## Content lifecycle
`draft → in_review → approved → published → archived`

Every transition must be authorized server-side and produce an audit event. Publishing requires a reviewer or tenant administrator. Media must have a verified usage/license status before public display.

## Security requirements before production
1. Supabase Auth or equivalent identity provider with MFA for tenant admins.
2. Server-side tenant resolution; never trust a client-provided tenant ID.
3. Row Level Security on every tenant-owned table.
4. Membership changes only through a trusted server function; no public self-enrollment.
5. Public reads limited to published content and approved media.
6. Immutable audit events for role changes, review decisions, publishing, and deletion.
7. File type/size validation, malware scanning, signed upload/download paths, and image rights confirmation.
8. Rate limiting, abuse monitoring, secrets management, backups, and restore tests.
9. Automated tests for cross-tenant access denial and role boundaries.
10. Privacy review and retention policy before accepting personal information.

## Current demo limits
The current web demo is static. The tenant switcher reads `tenants.json`; the admin console is illustrative. There is no login, backend, database, persistent editing, or real tenant security yet. The SQL migration is a proposed foundation only and must be reviewed in an isolated new database before use.


## Reporting modules
### Aggregate demographic reports
- Annual totals by age band and gender category are stored only as aggregate cells.
- No names, member IDs, athlete profiles, or person-level participation records are stored in this reporting module.
- Public cells below five are suppressed; the database constraint prevents publishing a non-suppressed count below five.
- Every report requires a source reference and passes the editorial approval process.

### Historical medal archive
- Structured categories: provincial, national, Asian, world, and Olympic; medal types: gold, silver, bronze.
- Each historical record requires event name, year, achievement title, source reference, and an editorial status.
- Publication requires reviewer/admin approval and an official source reference.
- This is a historical archive, not a current ranking, performance tracker, or live competition database.


## Confidential aggregate statistics access
- Athlete-count aggregates split by age band and gender are confidential management data.
- Only users with the `president` or `tenant_admin` role for that same tenant may SELECT these rows.
- Editors, reviewers, viewers, other tenants, and anonymous/public visitors cannot read these statistics.
- The public website must never embed real aggregate values in HTML, JavaScript, JSON, or static assets.
- Public pages may show only a locked notice explaining that the report is available in the authorized management console.
- Authorization must be enforced by database RLS and verified server-side identity; hiding a UI element is not access control.
- The role `president` is tenant-scoped and must be granted only through a trusted administrator workflow.


## Subscription and billing architecture
### Commercial model
- SaaS subscriptions are sold as Basic, Professional, and Enterprise plans.
- Term options: 3 months (list price), 6 months (proposed 8% discount), and 12 months (10 paid months; approximately 16.67% discount).
- One-time setup and onboarding fees are separate from recurring subscription fees.
- Enterprise scope and premium support are quoted separately.
- Actual prices remain quote-based until hosting, support, tax, and contractual costs are validated.

### Required production records
- `subscription_plans`: versioned catalogue of entitlements and list-price metadata.
- `tenant_subscriptions`: tenant-scoped plan, term, start/end dates, renewal preference, and lifecycle state.
- `invoices`: immutable invoice number, amounts, currency, tax breakdown, due date, and status.
- `payment_events`: provider event IDs, verification state, idempotency key, and audit metadata; never store card secrets.
- `subscription_audit_events`: append-only records for plan changes, renewals, cancellations, and administrative overrides.

### Security and lifecycle
- Subscription changes and entitlement checks must be server-side; the browser is display-only.
- Verify payment-provider signatures and process webhooks idempotently.
- A tenant cannot change its own paid status or grant itself entitlements.
- Platform billing operators and tenant content administrators have separate permissions.
- Do not expose payment secrets or provider service keys in frontend code.
- Expiry must follow a documented grace/read-only/export policy and must not trigger silent data deletion.
- No payment processing or real billing state is active in the current demo. Implement only after dedicated backend isolation, legal review, and security testing.


## Billing data isolation
- Proposed billing records live in the non-exposed PostgreSQL schema `sports_private`, not in browser-readable tenant tables.
- The design includes versioned plans, tenant subscriptions, invoices, verified payment-event metadata, and subscription audit events.
- No direct `anon` or `authenticated` grants or policies are provided for billing tables; only a trusted server environment may use the service role.
- RLS is enabled as defense in depth. Service-role credentials must never enter browser code, public repositories, or tenant sessions.
- Payment events store redacted provider metadata only; card numbers, CVV, and payment secrets are never stored.
- The SQL file is a proposal only. It has not been applied, tested against a database, or connected to a payment provider.


## Commercial entitlements
- The commercial catalogue is configuration-driven in `pricing.json`; the browser renders display information only.
- Plan options are Basic, Professional, and Enterprise with 3/6/12-month terms.
- A six-month term has a proposed 8% discount. A twelve-month term costs the equivalent of ten monthly payments (approximately 16.67% off).
- Setup/onboarding is quoted separately; enterprise scope and premium support require a separate quote.
- Do not enforce plan entitlements in client JavaScript. The trusted backend must resolve subscription state and entitlements.
- No payment processor, checkout, automatic charge, or production subscription lifecycle is active in this demo.


## Core Sports Layer — repository architecture decision

The management decision is that `ilam-shooting` is not a standalone product. It is the first implementation and primary core repository of **METATYA Sports OS**.

### Module boundaries
- `src/core-sports/` contains discipline-agnostic contracts, services, Supabase access, authorization, and reusable UI.
- Shooting-specific rules, event formats, scoring semantics, terminology, and workflows remain in the Shooting module and existing files.
- Other disciplines integrate through stable Core types and service contracts; they must not import Shooting-specific domain logic.
- Shared records live in the isolated PostgreSQL schema `sports_core`. Existing `public` objects, including `public.members`, are not modified or reused.
- Tenant scope and permissions must remain explicit; cross-tenant access is denied by default.

### Shared entities and authorization
The initial shared entities are `profiles`, `clubs`, `members`, `events`, `results`, and `audit_logs`. RLS is enabled on every table. Admins manage Core records; referees read member/event context and INSERT results only; members read only their own profile, linked member record, and results.

### Supabase API exposure
Add `sports_core` to Supabase Dashboard → API Settings → Exposed schemas before using PostgREST. The application uses the caller's access token and RLS; a service-role key is never used in browser or request-scoped code.

### Migration safety
The Core migration is additive and namespaced. It creates objects only in `sports_core`; it does not drop, rename, or alter existing public tables, policies, functions, or migrations. Applying SQL is a separate deployment operation and is not performed by a Git commit.
