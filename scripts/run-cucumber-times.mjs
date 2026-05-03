#!/usr/bin/env node
// Runs `npm run cucumber` N times in sequence, regardless of pass/fail.
// Prints a summary at the end and exits non-zero if any run failed, so it
// can be used in CI as a flake-detection gate.
//
// Usage: node scripts/run-cucumber-times.mjs <count>
//   e.g. node scripts/run-cucumber-times.mjs 10

import { spawnSync } from "node:child_process";

const times = Number(process.argv[2]);
if (!Number.isInteger(times) || times < 1) {
  console.error(`Usage: node ${process.argv[1]} <positive integer>`);
  process.exit(2);
}

// On Windows the npm executable is npm.cmd; spawnSync needs the full name
// or `shell: true` to resolve it. Using shell: true keeps the call portable.
const results = [];
for (let i = 1; i <= times; i++) {
  console.log(`\n========== Cucumber run ${i} of ${times} ==========\n`);
  const result = spawnSync("npm run cucumber", {
    stdio: "inherit",
    shell: true,
  });
  results.push(result.status === 0);
}

const passed = results.filter(Boolean).length;
const failed = times - passed;

console.log(`\n========== Summary ==========`);
console.log(`Passed: ${passed} / ${times}`);
console.log(`Failed: ${failed} / ${times}`);
if (failed > 0) {
  const failedRuns = results
    .map((ok, idx) => (ok ? null : idx + 1))
    .filter((n) => n !== null);
  console.log(`Failed runs: ${failedRuns.join(", ")}`);
}
console.log(`=============================\n`);

process.exit(failed > 0 ? 1 : 0);
