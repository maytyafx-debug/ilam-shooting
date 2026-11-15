import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [pricingText, tenantsText, html, appJs, legacySubmit] = await Promise.all([
  read("../pricing.json"),
  read("../tenants.json"),
  read("../index.html"),
  read("../app.js"),
  read("../../functions/api/submit.js")
]);
const pricing = JSON.parse(pricingText);
const tenants = JSON.parse(tenantsText);

assert.deepEqual(pricing.plans.map((p) => p.id), ["basic", "professional", "enterprise"]);
for (const plan of pricing.plans) {
  assert.deepEqual(plan.termOptions.map((t) => t.months), [3, 6, 12]);
  assert.equal(plan.termOptions[0].discountPercent, 0);
  assert.equal(plan.termOptions[1].discountPercent, 8);
  assert.ok(Math.abs(plan.termOptions[2].discountPercent - 16.67) < 0.01);
}
assert.equal(pricing.pricingStatus, "quote_required");
assert.ok(html.includes('id="pricingCards"'));
assert.ok(html.includes('id="subscription-preview"'));
assert.ok(appJs.includes('fetch("pricing.json")'));
assert.ok(appJs.includes('fetch("tenants.json")'));
assert.ok(legacySubmit.includes("status: 410"));
assert.ok(legacySubmit.includes("FORM_SUBMISSIONS_DISABLED"));
assert.ok(!legacySubmit.includes("api.telegram.org"));
assert.ok(!legacySubmit.includes("request.formData()"));

const shooting = tenants.tenants.find((t) => t.id === "ilam-shooting");
assert.ok(shooting);
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
