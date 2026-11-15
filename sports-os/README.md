# METATYA Sports OS — Foundation Demo

A multi-tenant, multi-sport public-information and administration portal foundation.

## Product boundary
The foundation provides configurable public websites, organization profiles, verified news, public documents, historical honours archives, media galleries, and content-governance previews. It intentionally excludes operational participation features, event/competition scheduling, athlete enrollment, performance tracking, and ranking calculations for shooting.

Sport-specific modules must pass a separate safety and legal review before implementation. The demo uses fictional sample content only.

## Current implementation
- Static, responsive RTL Persian product demo.
- Tenant configuration loaded from `tenants.json`.
- Sample tenants: Ilam shooting (administrative/public information only), wrestling, volleyball, and football.
- Public content categories are configuration-driven.
- Admin interface is a UI preview only; it has no authentication, database, persistence, or real publishing capability.
- No personal data is collected or transmitted.

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
