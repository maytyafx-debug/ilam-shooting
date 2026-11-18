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
  rbacMigration,
  membershipCleanup,
  services,
  membersApi,
  eventsApi,
  resultsApi,
  tenantApi,
  dashboard,
  memberManagementApi,
  memberHistoryApi,
  memberManagementPage,
  integratedMigration,
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
  read("../../supabase/migrations/007_public_sports_rbac_hardening.sql"),
  read("../../supabase/migrations/008_public_sports_rbac_policy_cleanup.sql"),
  read("../lib/core-sports/services.ts"),
  read("../app/api/core-sports/members/route.ts"),
  read("../app/api/core-sports/events/route.ts"),
  read("../app/api/core-sports/results/route.ts"),
  read("../app/api/core-sports/tenant/route.ts"),
  read("../app/page.tsx"),
  read("../app/api/core-sports/member-management/route.ts"),
  read("../app/api/core-sports/member-management/history/route.ts"),
  read("../app/members/page.tsx"),
  read("../../supabase/migrations/009_integrated_sports_management.sql"),
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
assert.ok(auth.includes('owner: "admin"'));
assert.ok(auth.includes('referee: "referee"'));
assert.ok(!auth.includes('athlete: "member"'));
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

assert.ok(rbacMigration.includes("FORCE ROW LEVEL SECURITY"));
assert.ok(rbacMigration.includes("REVOKE ALL PRIVILEGES"));
assert.ok(rbacMigration.includes("FROM PUBLIC, anon, authenticated"));
assert.ok(rbacMigration.includes("sports_results_insert_admin_referee"));
assert.ok(rbacMigration.includes("role IN ('owner', 'admin', 'referee')"));
assert.ok(rbacMigration.includes("sports_prevent_tenant_change"));
assert.ok(membershipCleanup.includes("DROP POLICY IF EXISTS sports_memberships_select_self"));

assert.match(services, /this\.db\s*\.from\("sports_members"\)/);
assert.match(services, /this\.db\s*\.from\("sports_events"\)/);
assert.match(services, /this\.db\s*\.from\("sports_results"\)/);
assert.ok(services.includes("tenant_id: this.tenantId"));
assert.ok(!services.includes('rpc("sports_current_tenant_id")'));
for (const route of [membersApi, eventsApi, resultsApi]) {
  assert.ok(route.includes('request.headers.get("x-tenant-id")'));
  assert.ok(route.includes("requireCoreRole(db"));
  assert.ok(route.includes("new CoreSportsService(db, auth.tenantId)"));
}
assert.ok(tenantApi.includes("listUserActiveTenants"));
assert.ok(tenantApi.includes("tenants: result.tenants"));
assert.ok(tenantApi.includes("result.tenants.length === 1"));
assert.ok(dashboard.includes('fetch("/api/core-sports/tenant"'));
assert.ok(dashboard.includes('"x-tenant-id": activeTenantId'));
assert.ok(dashboard.includes('"x-tenant-id": activeTenantId'));
assert.ok(dashboard.includes("ACTIVE_TENANT_STORAGE_KEY"));
assert.ok(dashboard.includes("readStoredTenantId"));
assert.ok(dashboard.includes("persistActiveTenant"));
assert.ok(dashboard.includes("sessionStorage.getItem"));
assert.ok(dashboard.includes("sessionStorage.setItem"));
assert.ok(dashboard.includes("tenantLoadSequence"));
assert.ok(dashboard.includes("requestId !== tenantLoadSequence.current"));
assert.ok(dashboard.includes("const activeTenantId = tenantId"));
assert.equal((dashboard.match(/await postJson\(/g) ?? []).length, 3);
assert.equal((dashboard.match(/\}, activeTenantId\);/g) ?? []).length, 3);
assert.ok(dashboard.includes('setMemberId("");'));
assert.ok(dashboard.includes('setEventId("");'));
assert.ok(dashboard.includes("console.error"));
assert.ok(dashboard.includes('const canManage = activeRole === "admin"'));
assert.ok(dashboard.includes('const canRecordResults = activeRole === "admin" || activeRole === "referee"'));
assert.ok(dashboard.includes("const roleForLoad = roleOverride ?? activeRole"));
assert.ok(dashboard.includes('if (roleForLoad === "admin")'));
assert.ok(dashboard.includes("Total Members"));
assert.ok(dashboard.includes("bar-chart"));
assert.ok(dashboard.includes("filteredMembers"));
assert.ok(dashboard.includes("filteredEvents"));
assert.ok(dashboard.includes("جستجوی اعضا"));
assert.ok(dashboard.includes("جستجوی رویدادها"));
assert.ok(membersApi.includes('auth.profile.role === "referee"'));
const resultsGetRoute = resultsApi.split("export async function POST")[0];
assert.ok(resultsGetRoute.includes('requireCoreRole(db, ["admin"], tenantId)'));
assert.ok(resultsApi.includes('requireCoreRole(db, ["admin", "referee"], tenantId)'));
assert.ok(dashboard.includes('activeRole === "member"'));
assert.ok(dashboard.includes("tenantOptions.length > 1"));
assert.ok(dashboard.includes("پنل شخصی ورزشکار هنوز فعال نشده است"));
assert.ok(membersApi.includes("Invalid member data"));
assert.ok(eventsApi.includes("Invalid event data"));
assert.ok(resultsApi.includes("UUID_RE.test(body.event_id)"));
assert.ok(resultsApi.includes("score < 0"));

for (const route of [memberManagementApi, memberHistoryApi]) {
  assert.ok(route.includes('requireCoreRole(db, ["admin"]'));
  assert.ok(route.includes('request.headers.get("x-tenant-id")'));
  assert.ok(route.includes('eq("tenant_id", auth.tenantId)'));
}
assert.ok(memberManagementApi.includes("export async function PATCH"));
assert.ok(memberManagementApi.includes("export async function DELETE"));
assert.ok(memberManagementApi.includes('update({ status: "inactive" })'));
assert.ok(!memberManagementApi.includes("writeHistory"));
assert.ok(!membersApi.includes("sports_member_history"));
assert.ok(memberHistoryApi.includes('from("sports_member_history")'));
assert.ok(memberManagementPage.includes('selected.role !== "owner" && selected.role !== "admin"'));
assert.ok(memberManagementPage.includes("جستجو بر اساس نام، شماره عضویت یا تماس"));
assert.ok(memberManagementPage.includes("سوابق"));
assert.ok(memberManagementPage.includes("غیرفعال‌سازی"));
assert.ok(!memberManagementPage.includes("national_id"));
assert.ok(integratedMigration.includes("ADD COLUMN IF NOT EXISTS membership_number"));
assert.ok(integratedMigration.includes("ADD COLUMN IF NOT EXISTS birth_date"));
assert.ok(integratedMigration.includes("CREATE TABLE IF NOT EXISTS public.sports_member_history"));
assert.ok(integratedMigration.includes("CREATE OR REPLACE FUNCTION public.sports_audit_member_change()"));
assert.ok(integratedMigration.includes("AFTER INSERT OR UPDATE ON public.sports_members"));
assert.ok(integratedMigration.includes("FOR EACH ROW EXECUTE FUNCTION public.sports_audit_member_change()"));
assert.ok(integratedMigration.includes("FORCE ROW LEVEL SECURITY"));
assert.ok(integratedMigration.includes("sports_member_history_admin_insert"));
assert.ok(integratedMigration.includes("ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED"));
assert.ok(integratedMigration.includes("sports_financial_reversal_same_tenant_fk"));

console.log("METATYA Sports OS static security checks passed.");
