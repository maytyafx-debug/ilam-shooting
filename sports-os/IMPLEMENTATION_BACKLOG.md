# METATYA Sports OS — Integrated Implementation Backlog
Version: 1.0
Scope: Shooting sports only; initial pilot: Ilam Shooting Board.
This is a planning and acceptance artifact. It does not claim that listed capabilities are implemented.

## Status vocabulary
- DEFINED: requirement and acceptance criteria documented.
- IMPLEMENTED: code exists in the intended environment.
- TESTED: defined tests executed and passed.
- VERIFIED: independent or authorized review confirms evidence.
- UNREVIEWED: evidence is absent or insufficient.

## Current evidence-based baseline
| Area | Current evidence | Status |
|---|---|---|
| Integrated shooting product blueprint | `sports-os/MASTER_BLUEPRINT.md` committed on the execution branch | DEFINED |
| Foundation data, role and workflow specification | `sports-os/FOUNDATION_SPEC.md` | DEFINED |
| Shooting-only pilot tenant config | `sports-os/tenants.json` contains only Ilam shooting | IMPLEMENTED (static configuration) |
| Shooting discipline catalogue | `sports-os/config/shooting-disciplines.json` | IMPLEMENTED (static catalogue only) |
| Public demo | Static HTML/CSS/JS, no authenticated backend | IMPLEMENTED (demo only) |
| Tenant authorization | Five active `public.sports_*` tables have RLS + FORCE RLS; owner/admin/referee policy set is live; one existing identity was verified to see only its assigned tenant. Dashboard selection is session-persisted as a hint, and each operational API request revalidates membership/role. Full two-user/two-tenant negative tests remain pending. | IMPLEMENTED / PARTIALLY TESTED / UNREVIEWED |
| Identity and role authorization | Supabase Auth session, server-side membership/role guard, admin/referee/member mapping, and multi-tenant selection implemented. Referee/member real-account tests remain pending. | IMPLEMENTED / STATIC-TESTED |
| Basic member registry | Tenant-scoped member create/list endpoints and dashboard; not yet a complete athlete/guardian registry. | IMPLEMENTED (BASIC) |
| Basic events and results | Tenant-scoped event and result create/list endpoints; no official competition lifecycle, review, protest, or versioned correction workflow. | IMPLEMENTED (BASIC) / DEFINED (FULL WORKFLOW) |
| Finance and insurance | Requirements documented; no operational workflow | DEFINED |
| Security and recovery | Live RLS/grants/policy read-back and static CI checks recorded; two-tenant role tests, independent review, MFA, and isolated backup/restore exercise are not evidenced. | PARTIALLY IMPLEMENTED / UNREVIEWED |
| Existing Supabase baseline | Read-only audit documented in `sports-os/SUPABASE_READ_ONLY_AUDIT_2026-11-16.md`; live advisor warnings remain open | REVIEW REQUIRED |
| Production deployment | Not authorized or evidenced | UNREVIEWED |

## Work packages and acceptance criteria

### FND-01 — Product scope and governance
- Keep this product restricted to sports shooting.
- Pilot tenant is Ilam Shooting Board.
- Discipline catalogue is versioned and references official rulesets by authority, version and effective date.
- Product ownership, usage license, technical access and athlete data rights are distinct.
Acceptance: automated checks reject non-shooting tenants and verify the discipline catalogue.

### FND-02 — Organization and tenancy
- Model federation, provincial board, county board/committee, club and center.
- Resolve tenant and organizational scope server-side from authenticated memberships.
- Deny cross-tenant and cross-unit access by default.
Acceptance: negative authorization tests prove a user cannot read or change records outside assigned scope.

### FND-03 — Identity and role authorization
- Support scoped roles for platform owner/operator, federation admin, tenant admin, board official, club admin, coach, referee, expert, finance officer, records officer, reviewer, athlete, guardian and auditor.
- Every grant records purpose, scope, authorizer, start/end, revocation and audit evidence.
- Privileged users require MFA.
Acceptance: role matrix tests cover allowed and denied actions; no browser-only authorization.

### FND-04 — Athlete, guardian and professional records
- Collect only necessary personal information.
- Verify guardian relationship and consent where required for minors.
- Separate sensitive documents from ordinary profile data.
- Support athlete access, correction requests and scoped access history.
Acceptance: privacy, consent, correction, retention and access tests pass using synthetic data.

### FND-05 — Competition and result integrity
- Version rule sets and preserve source authority.
- Separate entered, provisional, under-review, verified, final, corrected and withdrawn states.
- Preserve correction history and reason.
- Require authorized official review and separation of duties.
Acceptance: workflow and negative permission tests pass; no demo result can be represented as official.

### FND-06 — Finance, insurance and membership
- Keep payment state server-authoritative.
- Store provider references and redacted metadata only; never card secrets.
- Track membership and insurance validity with restricted access.
Acceptance: reconciliation, webhook signature, idempotency, expiry and access tests pass.

### FND-08 — Talent, training and development
- Require qualified human review for consequential assessments.
- Provide documented criteria, correction and appeal paths.
- Apply additional safeguards for minors.
Acceptance: human-review and appeal tests pass; no automated high-impact decision.

### FND-09 — Security, privacy, audit and recovery
- Enforce tenant isolation, least privilege, encryption, secrets separation and audit integrity.
- Use immutable encrypted backups and isolated restore tests.
- Require human authorization for risky or irreversible recovery.
Acceptance: scoped security review, restore evidence, and cross-tenant negative tests pass.

### FND-10 — Pilot readiness
- Synthetic-data acceptance testing, accessibility, performance, operational runbooks, support training and incident response.
- Obtain authorized user acceptance and sign-off.
Acceptance: no production rollout until all critical controls have VERIFIED evidence and owner approval.

## Execution constraints
- No schema is applied to a live database by this backlog.
- No merge to `main`, public deployment, domain change, billing activation or third-party data sharing is authorized by this document.
- Never use real athlete/minor/health/insurance/financial data in the static demo or public repository.
- Existing SQL proposals require independent review and isolated database tests before use.
