import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const blueprint = await readFile(
  new URL("../METATYA_SPORTS_OS_MASTER_EXECUTION_BLUEPRINT.md", import.meta.url),
  "utf8",
);

const required = [
  "METATYA SPORTS OS is the reusable product platform and shared core",
  "First product: Ilam Provincial Board Management V1",
  "## 2. Product boundary for the first release",
  "### Included in V1",
  "### Excluded from V1",
  "## 3. Shared Core capability contracts",
  "## 4. Tenant and data ownership model",
  "## 6. API and module extension rules",
  "## 8. Privacy and security requirements",
  "## 9. Current repository baseline — evidence, not aspiration",
  "## 10. Integrated implementation sequence",
  "## 11. Acceptance evidence format",
  "Current release status: NOT PRODUCTION READY.",
];

for (const phrase of required) {
  assert.ok(blueprint.includes(phrase), `Master execution blueprint missing: ${phrase}`);
}

assert.ok(blueprint.includes("45030202961"));
assert.ok(blueprint.includes("521c0563bbd8ac5a992342279c2e444a876cfc12"));
assert.ok(blueprint.includes("Do not apply migrations"));
assert.ok(blueprint.includes("without separate scoped authorization"));

console.log("METATYA Sports OS master architecture contract checks passed.");
