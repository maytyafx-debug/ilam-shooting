import { spawnSync } from "node:child_process";

const result = spawnSync("npm", ["audit", "--json"], {
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
});

if (result.error) {
  console.error("DEPENDENCY_AUDIT_UNAVAILABLE:", result.error.message);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(result.stdout || "");
} catch {
  console.error("DEPENDENCY_AUDIT_UNAVAILABLE: npm did not return valid JSON.");
  if (result.stderr) console.error(result.stderr.trim());
  process.exit(1);
}

const counts = report.metadata?.vulnerabilities ?? {};
const total = Number(counts.total ?? 0);
console.log(
  `npm audit summary: ${total} total; ${counts.critical ?? 0} critical; ${counts.high ?? 0} high; ${counts.moderate ?? 0} moderate; ${counts.low ?? 0} low; ${counts.info ?? 0} info.`,
);

for (const [name, item] of Object.entries(report.vulnerabilities ?? {})) {
  const fix = item.fixAvailable === undefined
    ? "not reported"
    : JSON.stringify(item.fixAvailable);
  const via = (item.via ?? [])
    .map((entry) => typeof entry === "string" ? entry : entry.title)
    .filter(Boolean)
    .join("; ");
  console.log(
    `- ${name}: severity=${item.severity}; direct=${Boolean(item.isDirect)}; range=${item.range ?? "unknown"}; fixAvailable=${fix}; via=${via || "details unavailable"}`,
  );
}

if (result.status !== 0 && total === 0) {
  console.error("DEPENDENCY_AUDIT_INCOMPLETE: npm audit exited unsuccessfully without a vulnerability summary.");
  process.exit(1);
}

if (total === 0) console.log("DEPENDENCY_AUDIT_CLEAN");
