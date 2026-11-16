# METATYA Sports OS — Shooting Sports Foundation

A shooting-sports-only foundation for the Ilam Shooting Board pilot, designed for federation, club, athlete, coach, referee, competition, records, and administrative workflows.

## Product boundary
The current deliverable is a static demo plus an integrated shooting-sports architecture blueprint. It does not yet implement live athlete enrollment, competition scheduling, score capture, financial processing, or operational athlete records.

The discipline catalogue covers air rifle, air pistol, fixed targets, moving targets, flying/clay targets including skeet, and sport bullet-shooting. Rules and eligibility must be validated against the applicable official rule set before production use. The demo uses fictional sample content only.

## Current implementation
- Static, responsive RTL Persian product demo.
- Tenant configuration loaded from `tenants.json`.
- Single configured pilot tenant: Ilam Shooting Board. No other sport tenants are included.
- Public content categories are configuration-driven.
- Admin interface is a UI preview only; it has no authentication, database, persistence, or real publishing capability.
- No personal data is collected or transmitted.

## Integrated foundation specification
- `MASTER_BLUEPRINT.md` describes the complete shooting-only product architecture.
- `FOUNDATION_SPEC.md` defines core entities, scoped role permissions, workflow states, API resource groups, and minimum acceptance tests.
- `IMPLEMENTATION_BACKLOG.md` records evidence-based implementation status and staged delivery gates.
- `SUPABASE_READ_ONLY_AUDIT_2026-11-16.md` records the existing Ilam Supabase project's schema baseline and security-advisor findings; no live database changes were made.
- `config/shooting-disciplines.json` is the canonical shooting-only discipline catalogue; it is not a technical rules engine.

## Run locally
From the repository root:
```bash
python -m http.server 8080
```
Open `http://localhost:8080/sports-os/`.

## Production architecture (next engineering stage)
1. Tenant-aware API with tenant isolation enforced server-side.
2. Authentication and role-based authorization (platform owner, tenant admin, editor, reviewer).
3. PostgreSQL schema with tenant-scoped foreign keys and row-level security.
4. Media storage with upload validation, malware scanning, and access controls.
5. Draft/review/publish workflow with immutable audit events.
6. Backups, restore drills, monitoring, rate limiting, and security testing.
7. Domain mapping and subscription/billing only after core isolation and security are verified.

## Data isolation rules
Every tenant-owned record must carry a non-null tenant identifier. The server derives tenant scope from verified host/session context, never from an untrusted client-supplied tenant ID alone. Cross-tenant reads and writes must be denied by default and covered by automated tests.

## Deployment status
This folder is a prototype foundation, not a production SaaS service. Do not collect real member, athlete, financial, or sensitive personal data until backend authentication, authorization, privacy, and security controls are implemented and independently tested.

## Backend foundation
- `ARCHITECTURE.md` defines tenant isolation, roles, content lifecycle, and production security requirements.
- `database/001_core.sql` is a proposed Supabase/PostgreSQL schema with tenant-scoped content, media, memberships, audit records, and RLS policies.
- The migration has not been applied to any database. Apply it only to a new, dedicated Sports OS project after independent SQL/RLS review and test coverage.
- Membership provisioning, audit writes, and privileged state transitions must run through trusted server-side functions; never expose a service-role key in browser code.


## Reporting
The demo now includes:
- Annual aggregate statistics by age band and gender (fictional demonstration values only; no individual athlete profiles).
- Historical medal summaries by provincial, national, Asian, world, and Olympic level, split by gold/silver/bronze.
- The SQL proposal adds aggregate-only reporting and a structured historical medal archive with tenant-scoped RLS.
- Public small demographic cells are suppressed below five. Medal entries require official source references before publication.


## Confidentiality of athlete aggregate reports
Athlete counts split by age band and gender are private management reports. Only the tenant-scoped `president` and `tenant_admin` roles can read them. Public pages show a locked notice, never the figures. The proposed SQL migration applies this restriction with RLS. This is not active until the migration is reviewed, deployed to a dedicated backend, and tested with real authenticated roles.


## Subscription and commercial model
- Commercial model: SaaS subscription plus a separately quoted one-time setup fee.
- Plans: Basic, Professional, and Enterprise.
- Terms: 3 months at list price; 6 months with a proposed 8% discount; 12 months priced as 10 months (about 16.67% off).
- Enterprise, setup, onboarding, customization, and premium support require a scoped quote.
- Published UI deliberately shows quote-required pricing rather than invented currency amounts.
- The subscription panel and plan catalogue are demo-only. No checkout, payment processing, automatic renewal, or entitlement enforcement is active.
- Before production billing: implement server-side subscription state, invoice records, payment-provider webhooks, idempotency, audit logs, cancellation/refund rules, data retention, and tenant-scoped authorization. Never trust browser-supplied payment or tenant status.
- Subscription expiry must not automatically erase customer content. Apply contract-defined read-only/export/grace-period behavior after legal and operational review.


## Billing data isolation
The proposed server-only billing schema is documented in `database/billing_schema_proposal.sql`. It is deliberately outside exposed API schemas, has RLS enabled, and grants no direct billing-table access to browser roles. It is not applied or connected to a payment provider. Only a trusted backend may process subscription state and verified payment events.


## Demo validation
Run `node sports-os/tests/validate-demo.mjs` from the repository root to validate tenant configuration, plan terms, UI hooks, and disabled legacy participation pages. This is a static smoke test, not a browser, backend, or RLS security test.


## Legacy submission shutdown
- Old registration and competition pages are informational-only and no longer collect form data.
- The legacy Cloudflare Pages `/api/submit` handler returns HTTP 410 and does not forward form content to Telegram.
- The public `submit_membership` RPC was revoked from `PUBLIC`, `anon`, and `authenticated` on the dedicated `ilam-shooting-federation` Supabase project; the matching guarded SQL migration is tracked at `supabase/migrations/002_disable_legacy_membership_rpc.sql`.
- No membership rows existed when checked. Existing admin and analytics records were not modified.

- The existing analytics statistics RPC now checks the signed-in user against the admin table before returning aggregates; anonymous execution of the admin-check RPC is revoked. The matching migration is tracked at `supabase/migrations/003_restrict_analytics_stats_to_admins.sql`.
