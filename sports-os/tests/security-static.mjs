import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [
  login,
  callback,
  middleware,
  browserClient,
  serverClient,
  auth,
  logout,
  migration,
  securityDoc,
  tenantMigration,
  services,
  membersApi,
  eventsApi,
  resultsApi,
  tenantApi,
  dashboard,
] = await Promise.all([
  read("../app/login/page.tsx"),
  read("../app/auth/callback/route.ts"),
  read("../middleware.ts"),
  read("../lib/supabase/client.ts"),
  read("../lib/supabase/server.ts"),
  read("../lib/core-sports/auth.ts"),
  read("../app/api/auth/logout/route.ts"),
  read("../../supabase/migrations/005_sports_os_namespaced.sql"),
  read("../../SECURITY.md"),
  read("../../supabase/migrations/006_sports_os_tenant_isolation.sql"),
  read("../lib/core-sports/services.ts"),
  read("../app/api/core-sports/members/route.ts"),
  read("../app/api/core-sports/events/route.ts"),
  read("../app/api/core-sports/results/route.ts"),
  read("../app/api/core-sports/tenant/route.ts"),
  read("../app/page.tsx"),
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
assert.ok(middleware.includes('schema: "public"'));
assert.ok(browserClient.includes('schema: "public"'));
assert.ok(serverClient.includes('schema: "public"'));
assert.ok(!browserClient.includes("sports_core"));
assert.ok(!serverClient.includes("sports_core"));
assert.ok(!middleware.includes("sports_core"));
assert.ok(logout.includes("auth.signOut()"));

assert.ok(auth.includes("db.auth.getUser()"));
assert.ok(auth.includes('["admin", "referee", "member"]'));
assert.ok(auth.includes("listUserActiveTenants"));
assert.ok(auth.includes('admin: "admin"'));
assert.ok(auth.includes("allowed.includes(role)"));
assert.ok(auth.includes('.eq("user_id", userId)'));
assert.ok(auth.includes('.eq("status", "active")'));

assert.ok(migration.includes("ENABLE ROW LEVEL SECURITY"));
assert.ok(securityDoc.includes("IMPLEMENTED IN SOURCE / NOT LIVE-VERIFIED"));
assert.ok(securityDoc.includes("NOT LIVE-VERIFIED"));
assert.ok(tenantMigration.includes("sports_tenant_memberships"));
assert.ok(tenantMigration.includes("sports_current_tenant_id"));
assert.ok(tenantMigration.includes("sports_has_tenant_role"));
assert.ok(tenantMigration.includes("FOREIGN KEY (member_id,tenant_id)"));
assert.ok(tenantMigration.includes("FOREIGN KEY (event_id,tenant_id)"));
assert.ok(tenantMigration.includes("tenant_id is immutable"));

assert.ok(services.includes('this.db.from("sports_members")'));
assert.ok(services.includes('this.db.from("sports_events")'));
assert.ok(services.includes('this.db.from("sports_results")'));
assert.ok(services.includes("tenant_id: this.tenantId"));
assert.ok(!services.includes('rpc("sports_current_tenant_id")'));
for (const route of [membersApi, eventsApi, resultsApi]) {
  assert.ok(route.includes('request.headers.get("x-tenant-id")'));
  assert.ok(route.includes("requireCoreRole(db"));
  assert.ok(route.includes("new CoreSportsService(db, auth.tenantId)"));
}
assert.ok(tenantApi.includes("listUserActiveTenants"));
assert.ok(tenantApi.includes("result.tenants.length > 1"));
assert.ok(dashboard.includes('fetch("/api/core-sports/tenant"'));
assert.ok(dashboard.includes('"x-tenant-id": activeTenantId'));
assert.ok(dashboard.includes('"x-tenant-id": tenantId'));
assert.ok(dashboard.includes("console.error"));

console.log("METATYA Sports OS static security checks passed.");
