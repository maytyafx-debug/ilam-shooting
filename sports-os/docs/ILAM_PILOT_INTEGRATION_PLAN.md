# Ilam Pilot — First Delivery Integration Plan

**Status:** Draft integration in progress; not approved for merge or release.  
**Target:** `main` of the pilot repository.  
**Integration branch:** `integrate/ilam-pilot-first-delivery-v1`.  
**Base reconciliation:** completed; `main` history is included and the branch is 0 commits behind.

## Purpose

Consolidate the existing pilot foundation and the minimum required first-delivery capabilities into one reviewable pull request. Preserve the independent METATYA Sports OS repository and the pilot's own data boundary.

This document is an execution register. It does not authorize production database changes, migrations, deployments, or merging.

## Evidence-based integration record

- The integrated-management foundation was retained.
- The two commits on `main` that were previously absent from the foundation branch were reconciled through a two-parent merge commit; the resulting comparison reports 219 commits ahead and 0 behind.
- PR #4 was integrated first in commit `551ee30ed3f63581ebd95facfb9febcf8ab294dc`.
- PR #3 was integrated second in commit `ec27e4d398c02e2a4711ae2040cb0a3c250f1182`.
- Both changesets are in this branch and the existing PR #8. No parallel PR was created.
- The public information portal is now at `/`; the authenticated management dashboard is at `/admin`. The club and member navigation links were placed in the admin dashboard rather than exposing management navigation on the public page.
- The shared stylesheet was merged additively, preserving both portal and club-management style additions.
- Migration order is now unique and sequential after `009_integrated_sports_management.sql`: `010_result_verification_guard.sql`, followed by `011_personal_identity_portals.sql`. The personal-portal static test was updated to the new migration path.
- The original PR #4 database integration fixture and test remain named for migration 010 and target the result-verification guard.

## First-delivery scope

1. Public information portal and core navigation.
2. Authenticated administrative access and tenant-scoped administration.
3. Organization and club structure required by the pilot.
4. Member records and personal self-service portal.
5. Events, entries where in scope, and results.
6. Result verification and auditability.
7. Achievements, documents, and basic operational reporting already represented in the pilot foundation.
8. Responsive UI, access control, and documented handover.

Do not add future marketplace, ticketing, advanced inventory, or other roadmap-only modules to this delivery without a confirmed customer requirement.

## Integration and conflict decisions

### PR #4 — integrated first

- Club-management API and page, security regression coverage, disposable database fixture, result-verification integration test, migration and rollback script were added.
- The discipline-neutral member form changes were retained.
- Its dashboard navigation change was adapted to the new `/admin` dashboard created by PR #3.
- Its stylesheet additions were merged with the personal/public portal styles.

### PR #3 — integrated second

- Public federation page, admin dashboard route, personal portal page and API, account-linking API, login/layout updates, portal tests, and CI workflow were added.
- The dashboard was moved to `/admin`; the public page at `/` remains a public-only surface.
- The portal stylesheet was preserved together with the club-management stylesheet.
- Its migration was renumbered to `011_personal_identity_portals.sql`; its static test now references that path.
- The security document was updated to distinguish implemented source behavior from live verification that is still pending.

### Migration chain

- `009_integrated_sports_management.sql`
- `010_result_verification_guard.sql`
- `011_personal_identity_portals.sql`

The order is based on both additions depending on the core schema established by 009; the result guard is retained first to match the approved PR #4-then-PR #3 integration sequence. This is repository ordering only. No live migration has been executed.

## Verification status

- [x] Base reconciliation; no main-branch commits lost.
- [x] PR #4 changes integrated.
- [x] PR #3 changes integrated.
- [x] Migration filenames normalized and portal-test reference updated.
- [x] Re-run CI after correcting the stale dashboard path in the static security test (workflow run #8 passed).
- [x] TypeScript, lint, static security, portal, demo, production build, and migration 010 disposable-database integration tests passed (workflow run #240).
- [ ] Review primary administrator, public visitor, and personal-portal journeys.
- [ ] Add/replay a disposable-database integration test for migration 011 and verify its RLS/account-linking behavior against isolated test identities.
- [ ] Review preview against the agreed customer scope.
- [ ] Complete handover documentation.

**Latest CI evidence:** [Sports OS verification run #8](https://github.com/maytyafx-debug/ilam-shooting/actions/runs/44837583812) passed TypeScript validation, the complete npm test chain (security, demo, and personal portal static tests), and the production build. [Dependency install and validation run #240](https://github.com/maytyafx-debug/ilam-shooting/actions/runs/44837583875) passed TypeScript, ESLint, production build, static security checks, legacy JavaScript syntax, demo/legacy validation, and the isolated PostgreSQL integration test for migration 010. The Netlify pull-request preview check also succeeded. Migration 011 has passed source/static portal checks but does not yet have a dedicated disposable-database replay/integration test; that remains a review-readiness item.

## Explicit exclusions and safety gates

- No production database writes or migrations.
- No deployment or production configuration changes.
- No merge to `main` without separate explicit approval.
- No secrets, access tokens, or personal customer data in commits or test fixtures.
- No expansion into deferred product modules unless supported by the agreed first-delivery scope.

## Current status

Both requested PR changes are integrated into the single controlled branch and PR #8. The branch is aligned with the current `main` history. The current CI and migration 010 isolated-database checks pass. Migration 011 database replay/integration, identity-based RLS checks, and acceptance review remain open. PR #8 remains Draft.
