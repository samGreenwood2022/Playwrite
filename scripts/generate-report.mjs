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
    data: [
      { label: "Project", value: pkg.name },
      { label: "Version", value: pkg.version },
      { label: "Suite", value: displayName },
      { label: "Generated", value: new Date().toISOString() },
    ],
  },
});

console.log(`Report generated: ${path.join(outDir, "index.html")}`);
