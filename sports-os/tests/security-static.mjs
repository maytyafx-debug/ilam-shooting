import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [login, callback, middleware, auth, logout, migration, securityDoc] = await Promise.all([
  read("../app/login/page.tsx"),
  read("../app/auth/callback/route.ts"),
  read("../middleware.ts"),
  read("../lib/core-sports/auth.ts"),
  read("../app/api/auth/logout/route.ts"),
  read("../../supabase/migrations/005_sports_os_namespaced.sql"),
  read("../../SECURITY.md"),
]);

assert.ok(login.includes("signInWithPassword"));
assert.ok(login.includes("router.replace"));
assert.ok(callback.includes("exchangeCodeForSession"));
assert.ok(callback.includes('next.startsWith("/")'));
assert.ok(callback.includes('!next.startsWith("//")'));
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

console.log("METATYA Sports OS static security checks passed.");
