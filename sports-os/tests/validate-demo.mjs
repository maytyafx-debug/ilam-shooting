import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [pricingText, tenantsText, disciplineText, html, appJs, legacySubmit, coreSql, billingSql, membershipMigration, analyticsMigration, masterBlueprint, backlog, foundationSpec, supabaseAudit] = await Promise.all([
  read("../pricing.json"),
  read("../tenants.json"),
  read("../config/shooting-disciplines.json"),
  read("../index.html"),
  read("../app.js"),
  read("../../functions/api/submit.js"),
  read("../database/001_core.sql"),
  read("../database/billing_schema_proposal.sql"),
  read("../../supabase/migrations/002_disable_legacy_membership_rpc.sql"),
  read("../../supabase/migrations/003_restrict_analytics_stats_to_admins.sql"),
  read("../MASTER_BLUEPRINT.md"),
  read("../IMPLEMENTATION_BACKLOG.md"),
  read("../FOUNDATION_SPEC.md"),
  read("../SUPABASE_READ_ONLY_AUDIT_2026-11-16.md")
]);
const pricing = JSON.parse(pricingText);
const tenants = JSON.parse(tenantsText);
const disciplineCatalogue = JSON.parse(disciplineText);

assert.deepEqual(pricing.plans.map((p) => p.id), ["basic", "professional", "enterprise"]);
for (const plan of pricing.plans) {
  assert.deepEqual(plan.termOptions.map((t) => t.months), [3, 6, 12]);
  assert.equal(plan.termOptions[0].discountPercent, 0);
  assert.equal(plan.termOptions[1].discountPercent, 8);
  assert.ok(Math.abs(plan.termOptions[2].discountPercent - 16.67) < 0.01);
}
assert.equal(pricing.pricingStatus, "quote_required");
assert.ok(masterBlueprint.includes("Scope: Sports shooting administration and management only."));
assert.ok(masterBlueprint.includes("Talent Identification & Development"));
assert.ok(masterBlueprint.includes("Competition and result integrity"));
assert.ok(masterBlueprint.includes("METATYA Sovereign Ownership"));
assert.ok(masterBlueprint.includes("immutable encrypted backups"));
assert.ok(masterBlueprint.includes("No merge to main, production deployment"));
assert.ok(html.includes('id="pricingCards"'));
assert.ok(html.includes('id="subscription-preview"'));
assert.equal((html.match(/<article><b>\d{2}<\/b><span>/g) || []).length, 15, "The landing page must list all 15 shooting Sports OS domains.");
assert.ok(html.includes("برای تیراندازی ورزشی."));
assert.ok(!/کشتی|والیبال|فوتبال|MANY SPORTS|چندرشته/.test(html), "The public UI must remain shooting-only.");
assert.ok(appJs.includes('fetch("pricing.json")'));
assert.ok(appJs.includes('fetch("tenants.json")'));
assert.ok(legacySubmit.includes("status: 410"));
assert.ok(legacySubmit.includes("FORM_SUBMISSIONS_DISABLED"));
assert.ok(!legacySubmit.includes("api.telegram.org"));
assert.ok(!legacySubmit.includes("request.formData()"));

assert.ok(!/^as \$(?!\$)/m.test(coreSql));
assert.ok(!/^\$;$/m.test(coreSql));
assert.ok((coreSql.match(/enable row level security/gi) || []).length >= 7);
assert.ok(coreSql.includes("array['tenant_admin','president']"));
assert.ok(!/create table[^;]*(athlete_profiles|competition_entries|performance_scores|rankings)/i.test(coreSql));
assert.ok(billingSql.includes("revoke all on all tables in schema sports_private from public, anon, authenticated"));
assert.ok(billingSql.includes("grant select, insert on sports_private.subscription_audit_events to service_role"));
assert.ok(!billingSql.includes("grant select, insert, update on all tables in schema sports_private"));
assert.ok(membershipMigration.includes("revoke execute on function public.submit_membership"));
assert.ok(analyticsMigration.includes("revoke execute on function public.is_admin()"));
assert.ok(analyticsMigration.includes("not public.is_admin()"));


const shooting = tenants.tenants.find((t) => t.id === "ilam-shooting");
assert.ok(shooting);
assert.equal(tenants.tenants.length, 1, "Shooting edition must contain only the Ilam shooting tenant.");
assert.equal(tenants.tenants[0].id, "ilam-shooting");
assert.equal(tenants.tenants[0].sport, "تیراندازی");
assert.equal(disciplineCatalogue.scope, "shooting-sports-only");
assert.equal(disciplineCatalogue.status, "catalogue-definition-only");
assert.deepEqual(disciplineCatalogue.disciplines.map((d) => d.id), [
  "air-rifle", "air-pistol", "fixed-target", "moving-target", "flying-target-skeet", "sport-bullet-shooting"
]);
assert.ok(disciplineCatalogue.disciplines.every((d) => d.ruleSetRequired === true));
assert.ok(backlog.includes("No merge to `main`"));
assert.ok(backlog.includes("UNREVIEWED"));
assert.ok(foundationSpec.includes("## 3. Role and permission model"));
assert.ok(foundationSpec.includes("## 4. State machines"));
assert.ok(foundationSpec.includes("## 6. Minimum acceptance tests"));
assert.ok(foundationSpec.includes("Guardian sees only the linked minor"));
assert.ok(supabaseAudit.includes("No database schema, data, policies, functions, credentials or project settings were changed."));
assert.ok(supabaseAudit.includes("public.record_pageview(p_path text)"));
assert.ok(!JSON.stringify(tenants).match(/کشتی|والیبال|فوتبال/), "Non-shooting tenants must not be configured.");
assert.ok(shooting.modules.includes("organization"));
assert.ok(shooting.modules.includes("historical-honours"));
for (const forbidden of ["athlete-registration", "competition-registration", "performance-tracking", "ranking"]) {
  assert.ok(!shooting.modules.includes(forbidden), `Unexpected shooting module: ${forbidden}`);
}

for (const path of ["../../register-athlete.html", "../../register-competition.html", "../../register-member.html", "../../calendar.html"]) {
  const page = await read(path);
  assert.ok(!/<form\b/i.test(page), `Unexpected form in ${path}`);
  assert.ok(page.includes('name="robots" content="noindex, nofollow"'));
}

console.log("METATYA Sports OS demo validation passed.");
