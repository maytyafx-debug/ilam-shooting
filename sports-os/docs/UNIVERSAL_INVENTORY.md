# METATYA Sports OS — Universal Inventory

This module is a shared, tenant-scoped inventory service for every sports discipline. It is not tied to shooting or any other single sport.

## Supported inventory models

- **Quantity-tracked stock:** consumables and interchangeable goods measured in units such as pieces, pairs, kilograms, packs, or sets.
- **Individually tracked assets:** durable equipment with a unique asset code, serial number (when available), QR/barcode payload, current warehouse, condition, and lifecycle status.

## Main workflows

1. Create warehouses and discipline-neutral or discipline-specific categories.
2. Register catalog items and choose quantity or individual tracking.
3. Record receipts, returns, issues, consumption, and controlled stock corrections.
4. Transfer quantity stock between two warehouses atomically. The database locks both balance rows, rejects insufficient source stock, and writes a paired transfer ledger.
5. Register individually tracked assets. The database assigns a unique code when one is not supplied and stores it as the QR payload.
6. Transfer serialized assets and record issue, return, maintenance, and retirement lifecycle events.
7. Review stock thresholds, warehouse summaries, transfer history, asset labels, and CSV inventory reports.

## Integrity and access

- Every row is tenant-scoped; composite foreign keys prevent cross-tenant item/warehouse references.
- Management APIs require an authenticated owner/admin role and pass the active tenant explicitly.
- Database RPCs independently verify the authenticated actor and tenant role.
- Quantity transfers are a single database transaction. Both sides of the movement ledger reference one transfer record.
- Quantity movements cannot be applied to individually tracked items.
- Movement and asset-event histories are append-only. Corrections are new records, not edits.
- Unique tenant-level constraints protect item SKUs, warehouse codes, asset codes, and barcode payloads.
- Private inventory responses use Cache-Control: private, no-store.

## Validation

The CI workflow runs:
- TypeScript, ESLint, Next.js production build, and static security regression checks.
- Migration 010 result-verification integration tests.
- Migration 011 universal inventory tests.
- Migration 012 quantity transfer, serialized asset, QR identifier, lifecycle, and tenant authorization tests.

All SQL integration tests use the disposable PostgreSQL service in CI. No production database migration or deployment is performed by these tests.

## Migration order

1. 010_result_verification_guard.sql
2. 011_universal_sports_inventory.sql
3. 012_inventory_transfers_and_assets.sql

A manual rollback script for Migration 012 is provided under supabase/rollback/. Review data and dependencies before running any rollback.
