import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [login, callback, middleware, auth, logout, migration, securityDoc, tenantMigration, services, membersApi, eventsApi, resultsApi] = await Promise.all([
  read("../app/login/page.tsx"),
  read("../app/auth/callback/route.ts"),
  read("../middleware.ts"),
  read("../lib/core-sports/auth.ts"),
  read("../app/api/auth/logout/route.ts"),
  read("../../supabase/migrations/005_sports_os_namespaced.sql"),
  read("../../SECURITY.md"),
  read("../../supabase/migrations/006_sports_os_tenant_isolation.sql"),
  read("../lib/core-sports/services.ts"),
  read("../app/api/core-sports/members/route.ts"),
  read("../app/api/core-sports/events/route.ts"),
  read("../app/api/core-sports/results/route.ts"),
]);

assert.ok(login.includes("signInWithPassword"));
assert.ok(login.includes("router.replace"));
assert.ok(callback.includes("exchangeCodeForSession"));
assert.ok(callback.includes('requestedNext?.startsWith("/")'));
assert.ok(callback.includes('!requestedNext.startsWith("//")'));
assert.ok(callback.includes("redirectUrl.origin !== requestUrl.origin"));
assert.ok(callback.includes("auth_callback_failed"));
assert.ok(middleware.includes('pathname === "/"'));
assert.ok(middleware.includes("auth.getUser()"));
assert.ok(middleware.includes('"/login"'));
assert.ok(logout.includes("auth.signOut()"));
assert.ok(auth.includes("db.auth.getUser()"));
assert.ok(auth.includes('["admin", "referee", "member"]'));
assert.ok(auth.includes("allowed.includes(role)"));
assert.ok(migration.includes("ENABLE ROW LEVEL SECURITY"));
assert.ok(migration.includes("profile_id = (SELECT auth.uid())"));
assert.ok(migration.includes("recorded_by = (SELECT auth.uid())"));
assert.ok(migration.includes("sports_results_member_self_read"));
assert.ok(securityDoc.includes("BLOCKER — multi-tenancy is not yet implemented"));
assert.ok(securityDoc.includes("NOT LIVE-VERIFIED"));
assert.ok(tenantMigration.includes("sports_tenant_memberships"));
assert.ok(tenantMigration.includes("sports_current_tenant_id"));
assert.ok(tenantMigration.includes("sports_has_tenant_role"));
assert.ok(tenantMigration.includes("FOREIGN KEY (member_id,tenant_id)"));
assert.ok(tenantMigration.includes("FOREIGN KEY (event_id,tenant_id)"));
assert.ok(tenantMigration.includes("sports_results_referee_insert"));
assert.ok(tenantMigration.includes("tenant_id is immutable"));
assert.ok(services.includes('rpc("sports_current_tenant_id")'));
assert.ok(services.includes("tenant_id: tenantId"));
for (const route of [membersApi, eventsApi, resultsApi]) {
  assert.ok(route.includes('request.headers.get("x-tenant-id")'));
  assert.ok(route.includes("requireCoreRole(db"));
}

console.log("METATYA Sports OS static security checks passed.");
