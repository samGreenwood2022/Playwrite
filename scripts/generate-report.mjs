#!/usr/bin/env node
// Post-processes a cucumber-js JSON output file into a styled dashboard
// HTML report via multiple-cucumber-html-reporter. Each test script
// (cucumber, regression, smoke, accessibility) writes its own JSON, then
// invokes this generator to produce a per-suite report directory.
//
// Usage: node scripts/generate-report.mjs <jsonDir> <outDir> <displayName>
//   e.g. node scripts/generate-report.mjs reports/json/regression reports/cucumber-regression-report "Regression Tests"
//
// multiple-cucumber-html-reporter takes a *directory* and aggregates every
// JSON file inside it, so each suite gets its own dir to keep reports isolated.

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import os from "node:os";
import report from "multiple-cucumber-html-reporter";

const [, , jsonDirArg, outDirArg, displayNameArg] = process.argv;

if (!jsonDirArg || !outDirArg) {
  console.error(
    "Usage: node scripts/generate-report.mjs <jsonDir> <outDir> [displayName]",
  );
  process.exit(2);
}

const jsonDir = path.resolve(jsonDirArg);
const outDir = path.resolve(outDirArg);
const displayName = displayNameArg ?? "Cucumber Tests";

if (!fs.existsSync(jsonDir) || !fs.statSync(jsonDir).isDirectory()) {
  console.error(`No cucumber JSON directory found at ${jsonDir}`);
  process.exit(1);
}

// Read package.json so the report shows the version of the suite under test
// rather than a hard-coded string that drifts.
const pkgPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "package.json",
);
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

// Tally scenario pass/fail across every cucumber JSON in the dir so the Run
// info panel can surface the headline numbers — the donut charts show the
// split but not the raw counts. Counting mirrors how the reporter derives a
// scenario's status: any failed step (including Before/After hooks) fails the
// scenario; otherwise every step must have passed for it to count as passed.
// Anything else (skipped/pending/undefined) is tallied separately so the
// totals still add up rather than silently dropping scenarios.
function tallyScenarios(dir) {
  let passed = 0;
  let failed = 0;
  let other = 0;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    let features;
    try {
      features = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    } catch {
      continue; // skip unreadable/partial JSON rather than crash the report
    }
    if (!Array.isArray(features)) continue;
    for (const feature of features) {
      for (const element of feature.elements ?? []) {
        // Backgrounds aren't scenarios — their steps are reported inline on
        // each scenario, so skip them to avoid double counting.
        if (element.type === "background") continue;
        const statuses = (element.steps ?? []).map((s) => s.result?.status);
        if (statuses.includes("failed")) failed++;
        else if (statuses.length > 0 && statuses.every((s) => s === "passed"))
          passed++;
        else other++;
      }
    }
  }
  return { passed, failed, other, total: passed + failed + other };
}

const tally = tallyScenarios(jsonDir);

// Build the Run info rows. Pass/fail/total are always shown; "other" only
// appears when there actually are skipped/pending scenarios so the panel
// stays clean on a normal run.
const runInfoData = [
  { label: "Project", value: pkg.name },
  { label: "Version", value: pkg.version },
  { label: "Suite", value: displayName },
  { label: "Scenarios total", value: String(tally.total) },
  { label: "Scenarios passed", value: String(tally.passed) },
  { label: "Scenarios failed", value: String(tally.failed) },
  ...(tally.other > 0
    ? [{ label: "Scenarios other", value: String(tally.other) }]
    : []),
  { label: "Generated", value: new Date().toISOString() },
];

report.generate({
  jsonDir,
  reportPath: outDir,
  pageTitle: displayName,
  reportName: displayName,
  displayDuration: true,
  displayReportTime: true,
  openReportInBrowser: false,
  metadata: {
    browser: { name: "chrome", version: "latest" },
    device: os.hostname(),
    platform: { name: os.platform(), version: os.release() },
  },
  customData: {
    title: "Run info",
    data: runInfoData,
  },
});

console.log(`Report generated: ${path.join(outDir, "index.html")}`);
