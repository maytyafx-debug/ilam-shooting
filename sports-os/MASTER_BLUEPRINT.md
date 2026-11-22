# METATYA Sports OS — Integrated Shooting Sports Blueprint
Version: 1.0
Status: Architecture baseline; implementation evidence is tracked separately.

## Current implementation baseline (2026-11-17)
The active Next.js pilot is connected to the Supabase `public` schema and uses `public.sports_tenants`, `public.sports_tenant_memberships`, `public.sports_members`, `public.sports_events`, and `public.sports_results`. The dashboard supports server-verified organization selection for users with multiple active memberships. The selected tenant ID is sent as `x-tenant-id` to operational API routes, which independently verify membership and role. This is a basic pilot, not implementation of all domains described in this blueprint. Legacy migrations 005/006 for `sports_core` are not part of the runtime and must not be applied to the connected project.
Scope: Sports shooting administration and management only. This repository work does not cover archery or other sports products.

## 1. Product mission
Build a modular, secure, Persian-first management platform for shooting-sport federations, provincial and county boards, clubs, shooting centers, athletes, coaches, referees, and authorized experts. The first pilot is the Ilam Shooting Board. The product architecture may support future organizational expansion, but this delivery scope is shooting only.

## 2. Shooting discipline catalogue
The discipline catalogue is configurable and must be validated against the applicable federation rules before production use:
- Air rifle
- Air pistol
- Fixed-target disciplines
- Moving-target disciplines
- Flying/clay-target disciplines, including skeet
- Sport bullet-shooting disciplines

A discipline record must include its governing rule-set reference, effective date, competition format, eligibility constraints, result schema, and approval history. Do not infer technical rules or eligibility from a display label.

## 3. Product domains
1. Organization & Federation Management — federation, provincial/county boards, committees, clubs, centers, organizational units.
2. Club & Center Management — facilities, operating status, authorized contacts, schedules, facility records.
3. Athlete Registry — identity-minimized profile, membership, discipline affiliations, verified documents, status history.
4. Coach, Referee & Expert Registry — credentials, authorization scope, expiry, assignments, conflict declarations.
5. Competition Management — event setup, ruleset version, registration review, scheduling, officials, protests, finalization.
6. Results & Sporting Records — provisional and verified results, corrections, source evidence, immutable revision history.
7. Talent Identification & Development — consent-based intake, expert assessment, development plans, progress reviews, human oversight.
8. Training & Education — courses, attendance, credentials, renewals, training history.
9. Finance & Administration — dues, invoices, receipts, debts, refunds and reconciliations; no card data stored.
10. Insurance & Membership — membership periods, insurance provider/reference, coverage status and expiry alerts.
11. Sports Intelligence & Analytics — authorized aggregate reports, competition summaries, trends, data-quality indicators and privacy thresholds.
12. Communications & Notifications — official notices, audience targeting by authorized organizational scope, delivery status and templates.
13. Documents & Workflow — correspondence, approvals, controlled archives, retention, versioning and provenance.
14. Platform Security & Administration — identity, access, ownership, privacy, audit, backup/recovery, integration and assurance.

## 4. Organizational and tenancy model
- The initial live pilot tenant is the Ilam Shooting Board.
- Organizational hierarchy is configurable: national federation → provincial board → county board/committee → club/center.
- Tenant and organizational scope are resolved and enforced server-side from verified identity and membership; browser-supplied tenant identifiers are never trusted as authorization.
- Each tenant-owned record carries a tenant identifier and, where applicable, an organizational-unit identifier.
- Cross-tenant and cross-unit access is denied by default and granted only by explicit, scoped policy.
- The platform control plane is separate from tenant administration. Platform operators receive no implicit rights to tenant records.
- Future sports expansion is out of scope for this shooting delivery and must not introduce other sport tenants or workflows into the Ilam pilot.

## 5. Core identity and access roles
Roles are scoped to a tenant and/or organizational unit:
- platform_owner: product ownership and explicitly authorized platform-level decisions.
- platform_operator: narrowly scoped technical operations; no default content or personal-data access.
- federation_admin: authorized federation-level administration.
- tenant_admin: administration within the assigned tenant.
- board_official: assigned board workflows only.
- club_admin: assigned club/center workflows only.
- coach: assigned athlete and training context only, subject to consent and policy.
- referee: assigned competition and result workflows only.
- expert: assigned assessments only.
- finance_officer: financial records only.
- records_officer: documents and records within scope.
- reviewer: independent review/approval within assigned workflow.
- athlete: own profile, own approved records and own service requests.
- guardian: limited, verified access for a minor where legally appropriate and consent is recorded.
- auditor: read-only, time-limited, evidence-scoped access.
Role names do not grant access by themselves. Each grant also requires owner authorization, scope, purpose, start/end, status, and audit evidence. Separation of duties applies to sensitive approvals.

## 6. Athlete profile and minors' safeguards
The athlete profile may contain only data necessary for legitimate sports administration. It includes identity and contact data, age band, guardian relationship where applicable, membership, club, disciplines, coach assignments, verified competition history, approved results, honours, training records, insurance status, dues status and service requests.
- Collect the minimum necessary data; separate highly sensitive documents from ordinary profile data.
- Minors require age-appropriate privacy safeguards and verified parent/guardian consent where required.
- Guardian access is limited to the relevant minor and purpose; it does not provide access to unrelated athletes or organizational financial data.
- Athletes can view their own data, request correction, and see important access and change history where appropriate.
- Do not publicly expose individual athlete data, minor information, insurance, financial status, contact details or private assessment notes.
- Talent assessments require qualified human review, documented criteria, and a correction/appeal path. Automated scoring cannot make final high-impact decisions.

## 7. Competition and result integrity
Competition workflow: draft event → ruleset/eligibility review → authorized publication → registration window → eligibility review → schedule/assignment → competition administration → provisional result → referee/official validation → protest/review → final approval → publication → archival.
- Every competition references a versioned rule-set and the source/authority for it.
- Results are separate states: entered, provisional, under review, verified, final, corrected, withdrawn.
- Corrections create a new revision; prior values and reasons remain auditable.
- Only authorized officials may verify/finalize results within assigned competitions.
- Public results are released only after approval and privacy review.
- Never label sample, imported, unverified or demo data as official.

## 8. Data architecture
Use a modular relational model with shared identity references and domain-owned records. Initial bounded contexts:
- organization
- identity_and_access
- athlete_and_membership
- professional_credentials
- disciplines_and_rulesets
- competitions_and_results
- talent_and_training
- finance_and_insurance
- documents_and_workflows
- communications
- analytics
- audit_and_security

All domain records require stable IDs, tenant scope, provenance/source, created/updated timestamps, actor attribution, lifecycle status, and retention classification as appropriate. Use foreign keys and database constraints for integrity. Avoid duplicate copies of identity data; use references and carefully scoped views. Financial and sensitive personal records require stricter access boundaries.

## 9. Security, privacy, ownership and recovery baseline
Mandatory from the first implementation:
- METATYA Sovereign Ownership: no person, company, contractor, employee, or third-party service may use or access project assets without explicit, valid, provable, scoped owner authorization.
- Separate software ownership, license-to-use, technical access, and data-subject rights.
- MFA/passkeys for privileged users; least privilege; scoped, time-bound, revocable grants.
- Server-side authorization and tenant isolation; deny by default.
- Encryption in transit and at rest; secrets outside source control and browser bundles.
- Malware/file validation and quarantine before any uploaded file is made available.
- Append-only/tamper-evident audit trail for privileged actions, role changes, approvals, financial changes and result corrections.
- Privacy minimization, consent/guardian controls, retention schedules and rights handling.
- Immutable encrypted backups, point-in-time recovery where supported, isolated restore tests and human approval for risky recovery.
- Security incidents, vulnerability intake, vendor controls and continuous assurance.
- No production readiness claim without evidence. Distinguish DEFINED, IMPLEMENTED, TESTED, VERIFIED and UNREVIEWED.

## 10. Financial and subscription boundaries
Financial workflows are server-authoritative. The browser cannot set payment status, subscription entitlement, amount paid, refund status or invoice state. Store provider event references and redacted metadata only; never store card numbers, CVV or payment secrets. Verify webhook signatures and idempotency before production billing. Expiry must not silently delete customer data; apply contract-reviewed grace/read-only/export rules.

## 11. Integrations
Integrations are registered individually with owner, purpose, data scope, permissions, credential owner, expiry, webhook validation, rate limits, audit trail, revocation procedure and data-retention terms. No external service receives broad access by default. No production secrets are committed to Git.

## 12. Technical delivery strategy
- Keep the current static demo separate from the production application.
- Prefer a modular monolith and a dedicated Sports OS backend initially; split services only when justified by scale, security isolation or independent operations.
- Use a dedicated database/project for Sports OS. Do not reuse another METATYA product's database, credentials, keys or storage.
- Treat existing Supabase SQL as proposals until reviewed and tested in an isolated dedicated environment.
- Keep development, test/staging and production environments separate.
- All schema changes are versioned migrations; no manual untracked production edits.
- Automated checks must cover syntax, migration safety, role boundaries, tenant isolation, workflow state transitions, privacy rules and recovery evidence.

## 13. Delivery phases and exit criteria
### Phase 0 — Repository and architecture audit
Inventory branches, pull requests, files, workflows, secrets references, external services, migrations and backup evidence. No production changes.
Exit: evidence-backed inventory and conflict/merge plan.

### Phase 1 — Product foundation
Finalize requirements, organization model, role/permission matrix, domain model, audit model, privacy/retention model, threat model and dedicated-backend decision.
Exit: reviewed architecture, acceptance criteria and isolated test plan.

### Phase 2 — Secure identity and organization core
Implement trusted authentication, tenant/org provisioning, scoped memberships, authorization, audit events and administrative workflows.
Exit: automated positive/negative authorization tests and tenant-isolation tests pass.

### Phase 3 — Athlete and professional registries
Implement athlete, guardian, membership, coach, referee and expert records with consent and privacy controls.
Exit: data-minimization, correction, access and minor-safeguard tests pass.

### Phase 4 — Competition and verified results
Implement competitions, registration review, assignments, provisional results, official verification, protests, corrections and publication.
Exit: full lifecycle tests, audit trail and role-separation tests pass.

### Phase 5 — Finance, insurance, facilities and services
Implement financial ledgers, insurance references and notifications.
Exit: reconciliation, permission, expiry and recovery tests pass.

### Phase 6 — Talent, training and intelligence
Implement expert-reviewed development workflows, education and privacy-preserving analytics.
Exit: human-review, appeal, small-cell suppression and data provenance tests pass.

### Phase 7 — Pilot readiness and national expansion
Run user acceptance, security/privacy review, backup restore exercise, accessibility/performance checks, operational runbooks and support training.
Exit: signed acceptance and verified evidence; only then consider production deployment.

## 14. Non-negotiable exclusions
- No weapon construction, modification, optimization or operational use instructions.
- No real athlete, minor, health, insurance or financial data in the static demo or public repository.
- No live database migration without an isolated dedicated Sports OS project and explicit approval.
- No merge to main, production deployment, DNS changes, payment activation or third-party data sharing as part of architecture documentation.
- No fabricated officials, contact details, competition results, records, medals or statistics.

## 15. Evidence ledger
For every capability record: requirement ID, implementation reference, tests, test result, reviewer, evidence link, date, environment, known limitations and status. A passing static demo test is not evidence of backend, RLS, privacy or production security.
