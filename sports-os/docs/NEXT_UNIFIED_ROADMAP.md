# METATYA Sports OS — Unified Next Stages

This roadmap is the agreed execution order after the current result-integrity, universal-inventory, and champion-QR work. It is a planning baseline, not a claim that the modules below are already implemented.

## Current delivery gate
- PR #4: database-level result verification guard.
- PR #5: discipline-neutral inventory, transfers, and serialized assets.
- PR #6: champion honour cards with revocable QR profiles.
- All three remain dependent on their review/merge order. PR #6 is stacked on PR #5; PR #5 is stacked on PR #4.
- No production migration, deployment, or merge is implied by this roadmap.

## Next stages — execute in this order

### 1. Athlete identity and membership lifecycle
- Complete athlete profile linking to authenticated accounts with explicit administrator assignment.
- Add membership periods, renewal/expiry status, insurance coverage status, and document verification views.
- Add coach assignment and role-scoped access without exposing private contact or guardian data.
- Complete guardian-consent management with scope, version, expiry, revocation, and audit history.
- Exit gate: cross-tenant tests, member-role access tests, minor-consent tests, and a complete audit trail.

### 2. Events and competition operations
- Build event creation, registration, eligibility review, participation status, schedules, and event documentation.
- Add role-separated referee data entry and owner/admin verification.
- Connect every result to its event and athlete record; only verified results can feed public achievements.
- Exit gate: duplicate-entry prevention, status-transition tests, tenant isolation, and immutable verification history.

### 3. Awards and public achievement archive
- Extend champion cards with an approved achievement timeline and source evidence references.
- Add editorial review for historical honours and public announcements.
- Add media/photo publication only with explicit, current permission; never infer consent from athlete registration.
- Exit gate: revoked consent removes public media; unverified awards never appear publicly; all publication actions are auditable.

### 4. Club operations and finance
- Complete club membership administration, invoices/receipts, expenses, refunds/reversals, and subscription entitlements.
- Keep demo/test payment flows clearly separated from real payment processing.
- Do not store payment-card data; use a verified payment provider and signed webhooks before live checkout.
- Exit gate: append-only financial ledger, reconciliation tests, role restrictions, and tested reversal workflows.

### 5. Reporting and Sports Intelligence
- Add operational dashboards for membership, attendance, events, verified results, awards, insurance expiry, and inventory.
- Add CSV/PDF exports with tenant and role checks.
- Use aggregate privacy thresholds for demographic reporting; suppress small groups and avoid public person-level statistics.
- Exit gate: report totals reconcile with source tables, export permissions are tested, and no private fields leak into public reports.

### 6. Multi-sport productization
- Validate the shared core against at least three distinct sports with different membership, event, and inventory needs.
- Move sport-specific labels, fields, scoring rules, and workflows into configuration/modules rather than hard-coded branches.
- Keep tenant data, roles, branding, and reporting isolated.
- Exit gate: cross-discipline regression suite and tenant-isolation tests pass without sport-specific data leakage.

### 7. Production readiness and controlled rollout
- Complete backup/restore drills, point-in-time recovery review, audit-log retention, monitoring, alerting, rate limiting, and security review.
- Complete accessibility, responsive/mobile, load, and failure-recovery tests.
- Apply migrations only after a verified backup and separate explicit approval; deploy first to staging and validate with synthetic records.
- Exit gate: signed release checklist, verified rollback plan, staging acceptance, and explicit production authorization.

## Cross-cutting rules
- Security, privacy, tenant isolation, consent, data integrity, auditability, and safe recovery are release gates for every module.
- Preserve existing records; prefer additive migrations and reversible changes.
- Never fabricate athlete achievements, event results, insurance status, or financial records.
- Do not merge stacked pull requests out of order.
- Keep product work evidence-based: report only completed and tested capabilities, not planned percentages.
