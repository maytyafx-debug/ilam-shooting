# Ilam Pilot — First Delivery Integration Plan

**Status:** Draft integration plan; not an implementation or release approval.  
**Target:** `main` of the pilot repository.  
**Integration branch:** `integrate/ilam-pilot-first-delivery-v1`.  
**Starting point:** `feat/sports-os-integrated-management-v1`.

## Purpose

Consolidate the existing pilot foundation and the minimum required first-delivery capabilities into one reviewable pull request. Preserve the independent METATYA Sports OS repository and the pilot's own data boundary.

This document is an execution register. It does not authorize production database changes, migrations, deployments, or merging.

## Evidence-based starting point

- The selected source branch is 215 commits ahead of `main` and 2 commits behind it at the time this plan was prepared.
- The source branch contains the integrated pilot foundation, application routes, tenant-scoped data model, and migrations through `009_integrated_sports_management.sql`.
- Existing PR #3 is based on the integrated foundation and contains personal portal work, including migration `010_personal_identity_portals.sql`.
- Existing PR #4 is also based on the integrated foundation and contains club-management work, result-verification safeguards, tests, and a separate migration currently named `010_result_verification_guard.sql`.
- PR #3 and PR #4 modify overlapping application and workflow files. Their migration filenames collide and must not be copied unchanged into one migration chain.
- PR #5 and PR #6 are downstream work and are not required for the bounded first delivery unless the signed customer scope explicitly requires them.

## First-delivery scope

The integration target is limited to:

1. Public information portal and core navigation.
2. Authenticated administrative access and tenant-scoped administration.
3. Organization and club structure required by the pilot.
4. Member records and personal self-service portal.
5. Events, entries where in scope, and results.
6. Result verification and auditability.
7. Achievements, documents, and basic operational reporting already represented in the pilot foundation.
8. Responsive UI, access control, and documented handover.

Do not add future marketplace, ticketing, advanced inventory, or other roadmap-only modules to this delivery without a confirmed customer requirement.

## Ordered integration work

### 1. Reconcile the base

- Compare the current `main` with the selected integrated-foundation branch.
- Incorporate the two commits that are present on `main` but absent from the source branch.
- Resolve any resulting conflicts without overwriting newer main-branch work.
- Record the resulting base and commit SHAs in this PR.

### 2. Integrate result integrity and club management

- Bring in the relevant PR #4 changes.
- Review all overlapping application routes, UI files, security documentation, and workflow changes.
- Preserve the result-verification trigger, rollback script, and database integration tests.
- Ensure the database-side authorization checks match the active tenant membership model and RLS policies.

### 3. Integrate personal portals

- Bring in the relevant PR #3 changes.
- Review overlapping routes, pages, styles, package metadata, and CI workflows.
- Preserve account-linking protections and tenant-scoped personal data access.
- Verify that users can only access their own permitted records.

### 4. Normalize migration history

- Resolve the two competing migration names currently numbered `010`.
- Assign a single sequential migration order after `009_integrated_sports_management.sql`.
- Update migration references, fixtures, integration tests, and rollback documentation consistently.
- Replay the complete migration chain against a disposable database.
- Compare the proposed chain with the live database history before proposing any live migration.

No migration is to be applied to a live database under this PR preparation authorization.

### 5. Run integrated verification

- Install dependencies from the committed lockfile.
- Run lint, type checks, production build, static security tests, and database integration tests.
- Test tenant isolation and role boundaries.
- Test the primary administrator and member journeys with synthetic test data.
- Verify that public pages expose only intended public information.
- Record exact CI run links and outcomes in this PR.

### 6. Prepare acceptance and handover

- Produce a working preview only after CI and security checks pass.
- Document setup, environment variables by name only, backup prerequisites, known limitations, and operator workflows.
- Confirm the actual customer acceptance scope before treating any optional payment or registration workflow as included.
- Keep production release blocked until explicit owner approval.

## Explicit exclusions and safety gates

- No production database writes or migrations.
- No deployment or production configuration changes.
- No merge to `main` without a separate explicit approval.
- No secrets, access tokens, or personal customer data in commits or test fixtures.
- No expansion into deferred product modules unless supported by the agreed first-delivery scope.

## Acceptance checklist

- [ ] Base reconciliation complete; no main-branch commits lost.
- [ ] PR #4 changes integrated and reviewed.
- [ ] PR #3 changes integrated and reviewed.
- [ ] Migration numbering and replay tests pass.
- [ ] RLS and application authorization checks are aligned.
- [ ] Lint, type checks, build, static security, and DB tests pass.
- [ ] Primary administrator and member journeys pass.
- [ ] Preview reviewed against the agreed customer scope.
- [ ] Handover documentation complete.
- [ ] Owner explicitly approves merge.
- [ ] Owner separately approves any production migration or deployment.

## Current status

This branch currently starts from the integrated foundation. The PR #3 and PR #4 implementation changes have not yet been integrated into this branch. This plan must be updated as each integration step is completed and verified.
