#!/usr/bin/env node
// Runs a named cucumber suite and ALWAYS post-processes the JSON output
// into a styled HTML report — even when the suite has failures, since
// that's exactly when an inspectable report is most useful.
//
// Suites are defined inline below so package.json scripts stay one-liners.
//
// Usage: node scripts/run-cucumber-suite.mjs <suite>
//   e.g. node scripts/run-cucumber-suite.mjs regression

import { spawnSync } from "node:child_process";
import fs from "node:fs";

// Each suite writes its JSON into its own directory because
// multiple-cucumber-html-reporter aggregates *every* JSON file in the dir
// it's pointed at — sharing one dir would mix suite results together.
const suites = {
  cucumber: {
    tags: null,
    parallel: 2,
    jsonDir: "reports/json/cucumber",
    json: "reports/json/cucumber/cucumber.json",
    out: "reports/cucumber-report",
    name: "Cucumber Tests",
  },
  "cucumber-trace": {
    tags: null,
    parallel: 2,
    jsonDir: "reports/json/cucumber-trace",
    json: "reports/json/cucumber-trace/cucumber-trace.json",
    out: "reports/cucumber-trace-report",
    name: "Cucumber Tests (with Traces)",
    traceDir: "reports/traces/cucumber",
  },
  regression: {
    tags: "@regression",
    parallel: 2,
    jsonDir: "reports/json/regression",
    json: "reports/json/regression/regression.json",
    out: "reports/cucumber-regression-report",
    name: "Regression Tests",
  },
  smoke: {
    tags: "@smoke",
    parallel: 2,
    jsonDir: "reports/json/smoke",
    json: "reports/json/smoke/smoke.json",
    out: "reports/cucumber-smoke-report",
    name: "Smoke Tests",
  },
  accessibility: {
    tags: "@accessibility",
    parallel: null,
    jsonDir: "reports/json/accessibility",
    json: "reports/json/accessibility/accessibility.json",
    out: "reports/cucumber-accessibility-report",
    name: "Accessibility Tests",
  },
};

const suiteName = process.argv[2];
const suite = suites[suiteName];
if (!suite) {
  console.error(
    `Unknown suite "${suiteName}". Valid: ${Object.keys(suites).join(", ")}`,
  );
  process.exit(2);
}

// Make sure the JSON output directory exists — cucumber-js will crash
// trying to write into a missing dir rather than create it itself.
// Wipe any prior JSON so the reporter doesn't aggregate stale runs from
// previous executions of this suite.
fs.rmSync(suite.jsonDir, { recursive: true, force: true });
fs.mkdirSync(suite.jsonDir, { recursive: true });

// When the suite opts into tracing, wipe and recreate the trace dir so
// the run starts with a clean slate. world.ts reads PW_TRACE_DIR and
// emits a .zip per scenario into it.
if (suite.traceDir) {
  fs.rmSync(suite.traceDir, { recursive: true, force: true });
  fs.mkdirSync(suite.traceDir, { recursive: true });
}

// Retry flaky scenarios up to twice on CI only. process.env.CI is set by
// GitHub Actions (and most CI providers); locally it's undefined, so a
// failing scenario fails immediately rather than masking real bugs behind
// retries. Mirrors the retries setting in playwright.config.ts.
const retries = process.env.CI ? 2 : 0;

const cucumberArgs = [
  "cucumber-js",
  "--require-module",
  "ts-node/register",
  "--require",
  "tests/features/support/*.ts",
  "--require",
  "tests/step_definitions/*.ts",
  "tests/features/*.feature",
  ...(suite.tags ? ["--tags", suite.tags] : []),
  ...(suite.parallel ? ["--parallel", String(suite.parallel)] : []),
  ...(retries ? ["--retry", String(retries)] : []),
  "--format",
  `json:${suite.json}`,
];

console.log(`\nRunning ${suite.name}...\n`);
const cucumberResult = spawnSync("npx", cucumberArgs, {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    ...(suite.traceDir
      ? { PW_TRACE: "1", PW_TRACE_DIR: suite.traceDir }
      : {}),
  },
});

// Generate the report regardless of cucumber's exit code, but only if a
// JSON file was actually written — otherwise the generator throws on a
// missing input which masks the real cucumber failure.
if (fs.existsSync(suite.json)) {
  const generatorResult = spawnSync(
    "node",
    [
      "scripts/generate-report.mjs",
      suite.jsonDir,
      suite.out,
      suite.name,
    ],
    { stdio: "inherit", shell: true },
  );
  if (generatorResult.status !== 0) {
    console.error("Report generation failed.");
  }
} else {
  console.warn(`No JSON output at ${suite.json} — skipping report.`);
}

// Propagate cucumber's exit code so CI still fails when tests fail.
process.exit(cucumberResult.status ?? 1);
