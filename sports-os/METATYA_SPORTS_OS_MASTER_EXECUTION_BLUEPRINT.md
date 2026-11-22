# METATYA SPORTS OS — Master Architecture & V1 Execution Blueprint

**Version:** 1.0  
**Evidence date:** 2026-11-22  
**Repository:** `maytyafx-debug/ilam-shooting`  
**Execution branch:** `feat/sports-os-shooting-integrated-v1`  
**Application root:** `sports-os/`  
**Current branch head at review:** `521c0563bbd8ac5a992342279c2e444a876cfc12`

> This is the governing architecture and execution contract for the Sports OS product family. It distinguishes product intent, source implementation, automated test evidence, live-environment verification, and release authorization. A documented or visible feature is not considered operational.

## 1. Product hierarchy and ownership boundaries

METATYA SPORTS OS is the reusable product platform and shared core. The Ilam provincial-board management system is the first customer/product deployment on that platform, not the platform itself.

The hierarchy is:

1. **METATYA product ownership and governance** — ownership, licensing, security policy, release authority and shared engineering standards.
2. **METATYA SPORTS OS Core** — reusable identity integration, organizations, tenancy, permissions, audit, workflow, files, notifications, configuration, reporting, integration contracts and operational controls.
3. **Sport-domain adapter/module** — only sport-specific vocabulary, configuration, lifecycle rules and domain extensions. It must consume Core contracts and must not fork Core.
4. **Tenant deployment/configuration** — a customer organization, organizational hierarchy, enabled modules, branding, policy and scoped users/data.
5. **First product: Ilam Provincial Board Management V1** — the first operational administrative deployment, configured for the Ilam provincial board. It is the acceptance reference for reusable Core capabilities.

Future sports products are separate tenant/module configurations on the same Core. They do not get copied dashboards, duplicate identity systems, parallel member directories or independent implementations of shared services.

## 2. Product boundary for the first release

V1 is an administrative management system. It is not a specialist sporting-operations system.

### Included in V1

- Organization directory and administrative hierarchy
- Clubs/centres and their administrative profiles
- Member registry with minimum necessary profile data
- Professionals and credential register with expiry metadata
- Administrative calendar, meetings and reminders
- Membership periods, renewals and status history
- Restricted insurance coverage metadata and expiry tracking
- Administrative finance records, invoices/receipts references and reconciliation controls
- Secretariat, correspondence register and classified document metadata
- General facilities/assets register and maintenance administration
- Announcements and authorized communications
- Aggregate management reports with privacy thresholds
- User access administration, approvals, audit and security operations

### Excluded from V1

- Specialist sporting-operation workflows
- Detailed technical activity instructions
- Automated high-impact decisions about people
- Public exposure of personal, minor, guardian, health, insurance or financial records
- Live payment-card processing or storage of payment credentials
- Unreviewed imports of real personal data

The public static site/demo is not the authenticated management application. The canonical authenticated interface remains `/platform`; `/workspace` is a compatibility redirect only.

## 3. Shared Core capability contracts

Every capability below is a shared platform service. A module may extend it through documented interfaces but must not reimplement it.

| Core capability | Required contract | V1 evidence / gap |
|---|---|---|
| Identity integration | Existing identity provider, verified server session, account recovery and session lifecycle | Supabase SSR auth exists; existing owner account and recovery lifecycle still require release verification |
| Organization directory | Tenant-scoped hierarchy, parent/child integrity, active status and provenance | Not connected |
| Tenancy | Server-resolved tenant membership; tenant ID from browser is only a selection hint | Basic implementation exists; full negative cross-tenant matrix remains |
| Authorization | Role + resource scope + action + purpose + time bounds; deny by default | Basic role mapping/guards exist; scoped grant workflow is incomplete |
| Audit | Append-only actor/action/resource/time/outcome evidence; sensitive values redacted | Incomplete; no verified end-to-end audit coverage |
| Workflow | Explicit state machine, authorized transitions, separation of duties | Not connected as a reusable service |
| Files | Classification, ownership, validation, quarantine, signed access, versioning and retention | Not connected |
| Notifications | Authorized audiences, templates, consent/preferences, delivery receipts and retry policy | Not connected |
| Configuration | Tenant feature flags, localization, policy settings and versioned configuration | Static configuration only |
| Reporting | Source-defined metrics, tenant scope, aggregation thresholds and export audit | Not connected |
| Integrations | Per-integration owner, purpose, least-privilege scopes, secret rotation, validation, rate limits and revocation | Not connected |
| Subscription/billing | Server-authoritative entitlements, verified provider events, idempotency and export/grace rules | Not connected; not a V1 launch prerequisite unless commercial contract requires it |
| Security operations | MFA, alerts, vulnerability handling, backup, restore and incident runbooks | Partial; critical release blockers remain |

## 4. Tenant and data ownership model

- A tenant represents the customer organization boundary. The initial configured tenant is the Ilam provincial board.
- Organizational units (committees, counties, clubs/centres) are subordinate scopes inside a tenant; they are not separate tenants unless a later commercial/ownership decision explicitly requires it.
- Every tenant-owned record has an immutable `tenant_id`. Where needed, it also has an `organization_unit_id`.
- Every record has a stable ID, lifecycle status, creation/update timestamps, actor attribution, source/provenance and retention classification appropriate to its domain.
- Cross-tenant reads and writes are denied by default. Cross-unit access requires explicit scoped grants.
- Platform operators do not automatically receive tenant content access. Technical access is separately authorized, time-bound and audited.
- Customer/tenant data, METATYA intellectual property, third-party service data and data-subject rights are distinct legal and technical categories.
- No new production data model is considered active until it has an approved forward migration, rollback plan, isolated test evidence, RLS review and a restorable backup.

## 5. V1 domain model

The V1 data model is organized around shared Core services and bounded administrative domains:

- `organizations`: tenant, unit, parent relationship, type, status and official contact references
- `clubs_centres`: administrative profile, address/contact, status and linked organization unit
- `members`: minimum profile, membership state and organization references
- `professionals`: professional category, credential reference, issuing authority and expiry
- `membership_periods`: period, application/renewal state, decision actor and history
- `insurance_records`: provider/reference, coverage period and restricted status metadata; no unnecessary medical details
- `calendar_items`: meetings, administrative appointments, reminders and authorized audience
- `finance_records`: accounting references and approved administrative state; no card data or client-authoritative payment status
- `document_records`: classification, storage reference, version, provenance, retention and approval state
- `assets`: general administrative assets, custodian, location, condition and maintenance history
- `announcements`: draft/review/approved/published state and audience scope
- `audit_events`: append-only audit evidence
- `access_grants`: subject, role, resource scope, purpose, authorizer, start/end, status and revocation evidence

This list is a logical contract, not permission to apply a migration to the currently connected database. Physical names and constraints must be reconciled against the active schema before any migration is approved.

## 6. API and module extension rules

- Route handlers authenticate with the server-side session and call one shared authorization layer.
- Tenant selection headers are never authorization evidence. Each request re-resolves active membership and role.
- Services receive a verified tenant context; tenant ID is not accepted from arbitrary request bodies.
- Input schemas are validated at the API boundary; outputs are explicitly selected and never return unrestricted database rows.
- Every mutation emits an audit event in the same transaction or through a reliable transactional outbox.
- List APIs are paginated, deterministically ordered, no-store for private data and protected against unbounded queries.
- Mutations use idempotency where retries could create duplicate records.
- Domain modules register routes and capabilities through versioned contracts; they cannot change Core authorization semantics.
- Breaking API/data changes require a versioned contract, migration plan, compatibility window and tests.

## 7. Roles, access and separation of duties

The active pilot currently has a narrower mapping than the target model. The target model is not evidence of implementation.

Target roles include platform owner/operator, tenant administrator, board official, unit/club administrator, records officer, finance officer, reviewer, professional, member, guardian (where lawful and necessary) and auditor.

Every grant must specify:
- subject and verified identity
- role and permitted actions
- tenant and organizational scope
- purpose and lawful/contractual basis
- authorizer and evidence
- start/end time, status and revocation
- audit trail

Sensitive actions require separation of duties. The same person must not be able to initiate and finally approve a high-risk transaction or publish restricted records without the configured independent review.

## 8. Privacy and security requirements

These controls are release requirements, not optional enhancements:

1. Least-privilege access and server-side authorization for every read and write.
2. Tenant isolation at API and database/RLS layers.
3. MFA for privileged accounts and verified account recovery.
4. Secrets only in protected environment configuration; never in source or browser bundles.
5. Encryption in transit and at rest, with key ownership/rotation documented.
6. Data minimization, purpose limitation, retention and deletion/export procedures.
7. Additional safeguards and verified guardian authority where records concern minors.
8. Restricted handling of insurance and financial metadata.
9. File allowlists, size limits, malware scanning/quarantine and signed access.
10. Append-only audit coverage for access grants, approvals, exports and sensitive mutations.
11. Rate limits, abuse monitoring, security incident response and dependency review.
12. Encrypted backups and a successful isolated restore drill.
13. Synthetic data only until privacy, authorization and recovery controls are independently verified.

Do not place real member, minor, guardian, insurance or financial data in public demos, repository fixtures or logs.

## 9. Current repository baseline — evidence, not aspiration

At the evidence date, branch head is `521c0563bbd8ac5a992342279c2e444a876cfc12`.

### Implemented in source

- Next.js application under `sports-os/`
- Supabase SSR login/session integration
- One canonical `/platform` management interface; `/workspace` redirects
- Server-side active tenant resolution and basic role checks
- Basic tenant-scoped member list/create API and UI
- Basic event and result endpoints exist in source but are not V1 acceptance criteria
- Static security regression checks and lockfile-based CI workflow

### Automated evidence

- GitHub Actions run `45030202961` completed with conclusion `success` for the exact branch head `521c0563bbd8ac5a992342279c2e444a876cfc12`.
- This validates the configured dependency install, TypeScript/build, static security checks and legacy checks in that workflow.
- It does not verify live RLS, the existing owner account, MFA, real-world role boundaries, backups, restore, privacy compliance or production operation.

### Not implemented / not verified

- Organization hierarchy and clubs/centres
- Professional/credential directory
- Administrative calendar and notification delivery
- Membership lifecycle
- Insurance administration
- Finance administration
- Secure documents/secretariat
- Facilities/assets register
- Communications
- Aggregate analytics
- Full access-grant administration and audit coverage
- Full tenant/role negative test matrix
- Privileged MFA and leaked-password protection
- Encrypted backup and isolated restore drill
- Independent security/privacy review
- Authorized user acceptance and production release

### Active database boundary

The application runtime uses the existing `public` schema and the five recorded `public.sports_*` tables: tenants, tenant memberships, members, events and results. Historical migrations for a `sports_core` schema are not the active runtime contract and must not be applied to the connected project.

Do not alter unrelated tables such as `public.data_bank`, `public.finance_ledger` or `public.monetization_opportunities`. Do not apply migrations, alter Auth settings, create/delete production records or deploy publicly without separate scoped authorization.

## 10. Integrated implementation sequence

Execution must proceed in this order. A later stage cannot be marked complete because an earlier stage has merely been documented.

### Stage A — Source integrity and single application shell
- Preserve one canonical dashboard and one shared navigation.
- Run lockfile install, TypeScript, static security checks, demo checks and production build.
- Fix all reproducible source/test defects.
- Acceptance: clean CI on the exact commit; no secrets or personal data in source.

### Stage B — Identity, tenancy and authorization
- Verify the existing owner account without creating a duplicate.
- Build an authorization matrix and test allowed/denied actions across roles, inactive memberships, invalid tenant IDs and cross-tenant requests.
- Add scoped access grants, expiry, revocation and audit.
- Acceptance: automated negative tests and authorized live read-only verification pass.

### Stage C — Shared administrative schema
- Reconcile logical V1 model against the actual connected schema.
- Produce a reviewed forward migration and rollback plan in source control.
- Test against an isolated disposable database with synthetic data.
- Verify RLS/FORCE RLS, grants, constraints, indexes and tenant immutability.
- Acceptance: isolated migration + rollback + RLS test suite pass. No connected production migration is implied.

### Stage D — Shared service layer
- Implement reusable validation, authorization, pagination, audit/outbox, file metadata, workflow, notification and configuration services.
- Acceptance: contract tests prove modules use shared services rather than duplicating them.

### Stage E — V1 administrative modules
Implement and connect in this dependency order:
1. Organizations and clubs/centres
2. Member registry and professional credentials
3. Membership lifecycle
4. Administrative calendar and notifications
5. Documents and secretariat
6. Facilities/assets
7. Insurance metadata
8. Finance administration
9. Communications
10. Aggregate management reports

Each module must have: schema, RLS, API, UI, validation, audit, empty/loading/error states, pagination, role matrix, automated tests and user-facing operational notes. A navigation card is not acceptance evidence.

### Stage F — Operational assurance
- MFA and account recovery verification
- Privacy and retention review
- File security and integration review
- Encrypted backup and isolated restore drill
- Monitoring, incident response and support runbooks
- Accessibility and responsive acceptance
- Synthetic-data end-to-end test and authorized user acceptance

### Stage G — Release decision
Production release requires all critical gates marked VERIFIED, named owner approval, a tested rollback/recovery plan and a separately authorized deployment. Preview URLs and green CI are not production release evidence.

## 11. Acceptance evidence format

Every capability must be tracked with exactly one evidence state:

- **DEFINED** — requirement and acceptance test are specified.
- **IMPLEMENTED** — code exists in the intended source/environment.
- **TESTED** — automated/manual test evidence exists and passed.
- **VERIFIED** — authorized independent or live-environment evidence confirms the behavior.
- **BLOCKED** — dependency, access, safety or authorization prevents completion.
- **UNREVIEWED** — evidence has not been collected.

Progress reports must name the artifact, commit, test/run identifier, environment and remaining blocker. Do not report guessed percentages.

## 12. Commercial productization

The Ilam deployment is the first reference customer configuration. Commercialization must be based on tenant subscription/license, enabled modules, user/seat policy, support tier, data export/exit terms and service-level commitments.

- Shared Core fixes are delivered once and made available to compatible tenant deployments.
- Customer-specific configuration is data/configuration, not a permanent fork.
- Customer data remains tenant-scoped and exportable under contract.
- Pricing/entitlements are server-authoritative and must not be represented as active until billing verification exists.
- Onboarding includes organization verification, authorized administrator, data-processing terms, role setup, training, synthetic acceptance, controlled import and signed handover.

## 13. Decision log

| Decision | Rule |
|---|---|
| Product identity | METATYA SPORTS OS is the parent platform; Ilam is the first product deployment |
| Architecture | Shared Core + replaceable sport-domain modules + tenant configuration |
| V1 scope | Administrative management only |
| UI | One canonical authenticated management interface |
| Data | Existing account and connected database are preserved; no duplicate identity |
| Runtime schema | Existing `public` schema only until an approved migration decision |
| Test data | Synthetic until release gates pass |
| Expansion | New sports consume Core contracts; no Core duplication |
| Release | No production claim without live verification, restore evidence and owner authorization |

## 14. Immediate next engineering work

1. Build the shared V1 administrative schema as an isolated, reviewable migration proposal with rollback and RLS tests.
2. Implement the shared audit/access-grant foundation before exposing sensitive modules.
3. Deliver organization and club/centre administration end-to-end on the canonical platform.
4. Expand the same reusable service/API/UI pattern to the remaining V1 domains.
5. Keep the live database, existing account and public deployment unchanged until their explicit release gates are satisfied.

**Current release status: NOT PRODUCTION READY.** The current branch has a successful CI run, but only a partial authenticated development pilot is evidenced.
