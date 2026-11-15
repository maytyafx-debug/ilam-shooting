# METATYA Sports OS — Architecture v1

## Product shape
A SaaS platform with one shared application core and isolated tenant workspaces. Each tenant receives its own public website, theme, domain mapping, organization profile, editors, approved news, public documents, media library, and historical honours archive.

## Tenant model
- A tenant represents one sports federation/board at a regional or organizational level.
- Tenant-owned records always include `tenant_id`.
- Tenant selection in the browser is presentation only. The server must derive and enforce tenant scope from verified host/session membership.
- No cross-tenant query is permitted by default.
- Platform operations and tenant operations use separate authorization paths.

## Roles
- `tenant_admin`: manage tenant profile, memberships through a trusted server workflow, and all tenant content.
- `editor`: create and edit draft content and upload proposed media.
- `reviewer`: review, approve, publish, or archive content.
- `viewer`: read tenant-private drafts only when explicitly granted.
- Platform operators use a separate privileged control plane and do not receive implicit public-tenant editing access.

## Shared content types
- `news`, `notice`, `organization`, `honour`, `document`.
- The honours type is a historical editorial archive, not a live performance database.
- There are deliberately no competition scheduling, participant registration, athlete performance, score capture, or ranking tables in this foundation.

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
