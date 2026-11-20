# METATYA Sports OS — Foundation Specification
Version: 1.0
Product scope: sports shooting only.
Pilot: Ilam Shooting Board.
Status: DEFINED. This document is the target foundation specification, not evidence that every listed domain or table is deployed.

## Current pilot implementation boundary
The active Next.js pilot uses Supabase schema `public` and exactly these operational tables: `public.sports_tenants`, `public.sports_tenant_memberships`, `public.sports_members`, `public.sports_events`, and `public.sports_results`. The broader entity catalogue below is a future design specification; its generic entity names are not a description of current database tables. The legacy `sports_core` migrations are not used by the active runtime and must not be applied to the connected pilot.

## 1. System boundaries
The platform is divided into bounded domains, but starts as a modular monolith:
- Organization: federation, provincial/county boards, committees, clubs and centers.
- Identity & Access: user identities, scoped memberships, role grants, consent and sessions.
- Athlete & Membership: athlete profiles, membership periods, affiliations and service requests.
- Professional Credentials: coaches, referees and experts, qualifications, scope and expiry.
- Disciplines & Rulesets: shooting discipline catalogue, official rule references, versions and effective dates.
- Competitions & Results: events, entries, assignments, provisional results, reviews, protests and final results.
- Talent & Training: consent-based intake, expert reviews, development plans and course records.
- Finance & Insurance: dues, invoices, receipts, refunds, reconciliation and insurance references.
- Facilities & Assets: centers, facilities, administrative equipment inventory, custody and maintenance.
- Documents & Communications: official documents, notices, media rights and delivery records.
- Analytics: authorized aggregate statistics and provenance-aware reports.
- Audit & Security: append-only audit, security events, access reviews and recovery evidence.

## 2. Core relational entities
Every tenant-owned entity must include tenant_id; organizational records should also include org_unit_id where applicable. Use UUID primary keys, UTC timestamps, foreign keys, explicit status constraints and source provenance.

### Organization
- organizations: id, tenant_id, parent_id, type, official_name, status, effective_from, effective_to.
- organizational_units: id, tenant_id, organization_id, parent_unit_id, unit_type, name, status.
- clubs: id, tenant_id, org_unit_id, official_name, location_reference, status, approved_at.
- facilities: id, tenant_id, club_id, facility_type, status, public_contact_reference.

### Identity and scoped authorization
- user_profiles: auth_user_id, display_name, preferred_locale, account_state; avoid duplicating identity-provider secrets.
- tenant_memberships: id, tenant_id, user_id, org_unit_id, membership_state, valid_from, valid_until.
- role_grants: id, tenant_id, user_id, role_code, scope_type, scope_id, purpose, granted_by, valid_from, expires_at, revoked_at.
- consent_records: id, tenant_id, subject_reference, guardian_reference, purpose, consent_version, status, captured_at, expires_at, evidence_reference.
- access_reviews: id, tenant_id, grant_reference, reviewer_id, decision, reviewed_at, rationale.

### Athlete and professional records
- athletes: id, tenant_id, person_reference, public_display_policy, lifecycle_state, created_at.
- athlete_affiliations: id, tenant_id, athlete_id, club_id, discipline_id, valid_from, valid_until, state.
- athlete_memberships: id, tenant_id, athlete_id, membership_number_reference, state, valid_from, valid_until.
- athlete_documents: id, tenant_id, athlete_id, document_type, storage_reference, classification, verification_state, retention_until.
- guardianships: id, tenant_id, athlete_id, guardian_user_id, verification_state, purpose_scope, valid_from, valid_until.
- professionals: id, tenant_id, user_id, professional_type, profile_state.
- professional_credentials: id, tenant_id, professional_id, credential_type, issuer, credential_reference, valid_from, valid_until, verification_state.
- professional_assignments: id, tenant_id, professional_id, org_unit_id, competition_id, assignment_scope, valid_from, valid_until.

### Disciplines, competitions and results
- disciplines: id, code, name, status, catalogue_version.
- rulesets: id, discipline_id, issuing_authority, official_reference, version_label, effective_from, effective_until, verification_state.
- competitions: id, tenant_id, org_unit_id, discipline_id, ruleset_id, title, event_state, registration_opens_at, registration_closes_at, starts_at, ends_at.
- competition_entries: id, tenant_id, competition_id, athlete_id, eligibility_state, registration_state, reviewed_by, reviewed_at.
- competition_officials: id, tenant_id, competition_id, professional_id, assigned_role, assignment_state.
- results: id, tenant_id, competition_id, entry_id, result_state, value_reference, source_reference, recorded_by, verified_by, verified_at, current_revision.
- result_revisions: id, tenant_id, result_id, revision_number, prior_value_reference, new_value_reference, change_reason, changed_by, reviewed_by, changed_at.
- protests: id, tenant_id, competition_id, entry_id, submitted_by, category, case_state, decision_reference, decided_by, decided_at.

### Development, finance, insurance and assets
- talent_assessments: id, tenant_id, athlete_id, assessor_id, criteria_version, assessment_state, reviewed_at, appeal_state.
- development_plans: id, tenant_id, athlete_id, owner_professional_id, plan_state, review_due_at.
- training_courses: id, tenant_id, provider_org_id, title, course_type, starts_at, ends_at, state.
- training_records: id, tenant_id, course_id, participant_reference, attendance_state, credential_reference.
- invoices: id, tenant_id, account_reference, invoice_number, amount_minor, currency, invoice_state, issued_at, due_at.
- payment_events: id, tenant_id, provider_event_reference, signature_state, idempotency_key, amount_minor, currency, event_state, received_at.
- insurance_records: id, tenant_id, athlete_id, provider_reference, policy_reference, coverage_state, valid_from, valid_until.
- assets: id, tenant_id, facility_id, asset_type, inventory_reference, custody_state, service_state.
- asset_maintenance: id, tenant_id, asset_id, maintenance_type, due_at, completed_at, evidence_reference.

### Documents, audit and reporting
- documents: id, tenant_id, org_unit_id, document_type, classification, storage_reference, version, lifecycle_state, retention_until.
- communications: id, tenant_id, audience_scope, template_reference, delivery_state, sent_at.
- aggregate_reports: id, tenant_id, period, dimensions_version, aggregation_reference, suppression_state, source_reference, approval_state.
- audit_events: id, tenant_id, actor_reference, action, entity_type, entity_id, before_digest, after_digest, reason, occurred_at, correlation_id.
- security_events: id, tenant_id, event_type, severity, asset_reference, detected_at, case_state, evidence_reference.

Sensitive personal data, guardian evidence, financial records and private assessments must be stored separately or under stricter policies than ordinary organizational content. Never put real personal data in public JSON or static assets.

## 3. Role and permission model
Permissions are scope-bound; a role name alone is never sufficient. All decisions are evaluated server-side using authenticated identity, tenant, organizational unit, purpose, validity interval and current grant state.

| Role | Typical allowed scope | Explicitly excluded by default |
|---|---|---|
| platform_owner | Product ownership and explicitly approved platform governance | Routine access to tenant personal data |
| platform_operator | Infrastructure operations under ticketed/time-limited grant | Reading tenant records or changing tenant business data |
| federation_admin | Authorized federation-level records and workflows | Unrelated tenant private data |
| tenant_admin | Assigned tenant administration | Other tenants; self-approval of sensitive grants |
| board_official | Assigned board workflows | Unassigned units and private athlete documents |
| club_admin | Assigned club/center records | Other clubs and board-wide confidential reports |
| coach | Assigned athletes and approved training context | Financial records, unrelated athletes, private guardian evidence |
| referee | Assigned competitions and result review | Athlete financial or unrelated profile data |
| expert | Assigned assessments | Final unilateral high-impact decisions |
| finance_officer | Invoices, dues and reconciliation within scope | Private assessments and unrelated identity documents |
| records_officer | Authorized documents and records | Unrelated financial and athlete-private records |
| reviewer | Assigned approval queue | Approving own sensitive submission |
| athlete | Own profile and own approved records | Other persons' data and internal confidential notes |
| guardian | Relevant minor's limited information with verified authority | Other minors, unrelated organizational or financial records |
| auditor | Read-only, time-limited evidence scope | Changes, broad browsing and unscoped exports |

### Sensitive-action separation
- Granting privileged access and approving that same grant must be separate where practicable.
- Creating and finalizing a competition result must be separated where practicable.
- A result author cannot be its sole final verifier.
- A finance operator cannot approve their own exceptional refund or write-off.
- Platform ownership does not automatically authorize access to athlete personal data.
- Emergency access must be pre-authorized by a documented owner policy, time-limited, logged and reviewed after use.

## 4. State machines
- Membership: pending → active → suspended/expired → renewed/closed.
- Professional credential: submitted → under_review → verified/rejected → expired/revoked.
- Competition: draft → review → published → registration_closed → in_progress → provisional_results → protest_window → final → archived.
- Result: entered → provisional → under_review → verified → final; corrections create a new revision; withdrawal retains history.
- Document: draft → review → approved → published/restricted → archived.
- Invoice: draft → issued → due → paid/part_paid/overdue → void/refunded; state transitions are server-authoritative.
- Consent: requested → granted/declined → withdrawn/expired; withdrawal must trigger policy-based reassessment, not silent loss of audit evidence.

Every transition requires an allowed actor, preconditions, reason where relevant, timestamp, and audit event. The UI must never be the only enforcement point.

## 5. API resource groups
The backend should expose versioned resource groups only after authentication and authorization middleware exist:
- /api/v1/organizations
- /api/v1/clubs
- /api/v1/athletes
- /api/v1/professionals
- /api/v1/disciplines
- /api/v1/rulesets
- /api/v1/competitions
- /api/v1/results
- /api/v1/protests
- /api/v1/training
- /api/v1/talent
- /api/v1/membership
- /api/v1/finance
- /api/v1/insurance
- /api/v1/facilities
- /api/v1/documents
- /api/v1/reports
- /api/v1/audit

Do not expose a resource until its server-side authorization, validation, audit, privacy and rate-limit tests exist. Tenant identifiers supplied by the client are hints only; the server resolves effective scope from verified memberships.

## 6. Minimum acceptance tests
1. Anonymous user cannot read private tenant data.
2. User from one tenant cannot read or mutate another tenant's records.
3. Club administrator cannot access a different club's records.
4. Coach sees only assigned athletes and only permitted fields.
5. Guardian sees only the linked minor's permitted records.
6. Athlete can read own approved data and submit a correction request.
7. Editor cannot publish without reviewer/tenant-admin approval.
8. Result author cannot independently finalize their own result.
9. Result corrections preserve prior revision, reason and actor.
10. Finance roles cannot read private assessment or guardian documents.
11. Browser-supplied tenant, role, payment or result-finalization state is ignored.
12. Expired/revoked role grants stop working immediately.
13. Audit records cannot be edited or deleted through user-facing roles.
14. Public pages contain no personal, financial, insurance or confidential aggregate data.
15. Small aggregate cells follow suppression policy and cannot be reconstructed by overlapping queries.
16. Uploaded files remain quarantined until validation and rights checks complete.
17. Recovery is tested in an isolated environment before any restore can affect production.
18. Real athlete/minor data is prohibited until privacy, security, consent and retention controls are verified.

## 7. Operational readiness gates
A production pilot requires all of the following:
- Dedicated Sports OS backend, database, storage, keys and service accounts.
- Reviewed schema and migrations in an isolated non-production environment.
- Verified identity, MFA for privileged roles, tenant isolation and row-level authorization.
- Documented consent, privacy, retention, correction and incident processes.
- Successful automated authorization and workflow tests.
- Successful encrypted backup and isolated restore exercise.
- Approved operating procedures, support ownership and incident contacts.
- Written owner authorization and pilot stakeholder acceptance.

Until these gates are evidenced, the application remains a demo and architecture foundation. Do not import real athlete data, activate billing, or claim production readiness.
