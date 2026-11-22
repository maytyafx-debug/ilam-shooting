import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [schema, auth, mfaPage, platform, collectionApi, itemApi, panel, modules] = await Promise.all([
  read("../database/proposals/20261122_admin_v1_mfa_audit.sql"),
  read("../lib/core-sports/auth.ts"),
  read("../app/security/mfa/page.tsx"),
  read("../app/platform/page.tsx"),
  read("../app/api/core-sports/admin-records/route.ts"),
  read("../app/api/core-sports/admin-records/[id]/route.ts"),
  read("../app/platform/admin-module-panel.tsx"),
  read("../lib/core-sports/admin-records.ts"),
]);

assert.ok(schema.includes("PROPOSAL ONLY"));
assert.ok(schema.includes("enable row level security"));
assert.ok(schema.includes("force row level security"));
assert.ok(schema.includes("as restrictive for all to authenticated"));
assert.ok(schema.includes("auth.jwt()->>'aal'"));
assert.ok(schema.includes("private.has_active_tenant_role"));
assert.ok(schema.includes("tenant_id is immutable"));
assert.ok(schema.includes("revoke all on function private.sports_admin_records_audit()"));
assert.ok(schema.includes("grant select, insert, update, delete on public.sports_admin_records to authenticated"));
assert.ok(!/drop\s+table|truncate\s+/i.test(schema));

assert.ok(auth.includes("getAuthenticatorAssuranceLevel"));
assert.ok(auth.includes('assurance.currentLevel !== "aal2"'));
assert.ok(auth.includes('status: 428'));
assert.ok(mfaPage.includes("mfa.enroll"));
assert.ok(mfaPage.includes("mfa.challenge"));
assert.ok(mfaPage.includes("mfa.verify"));
assert.ok(mfaPage.includes('router.replace("/platform")'));
assert.ok(platform.includes('router.replace("/security/mfa")'));

assert.ok(collectionApi.includes('request.headers.get("x-tenant-id")'));
assert.ok(collectionApi.includes('requireCoreRole(db, ["admin"]'));
assert.ok(collectionApi.includes('.eq("tenant_id", auth.tenantId)'));
assert.ok(collectionApi.includes("validateAdminPayload"));
assert.ok(collectionApi.includes("ADMIN_SCHEMA_NOT_APPLIED"));
assert.ok(itemApi.includes('.eq("tenant_id", auth.tenantId)'));
assert.ok(itemApi.includes('status: "archived"') === false);
assert.ok(panel.includes("ADMIN_SCHEMA_NOT_APPLIED"));
assert.ok(panel.includes("onSchemaReady"));
assert.ok(panel.includes("بایگانی"));
assert.ok(modules.includes("validateAdminPayload"));
assert.ok(modules.includes("finance"));
assert.ok(modules.includes("insurance"));
assert.ok(modules.includes("document"));
assert.ok(modules.includes("organization_unit"));

console.log("METATYA Sports OS administrative modules and MFA contract checks passed.");
