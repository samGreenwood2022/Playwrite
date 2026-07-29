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
import path from "node:path";

// Each suite writes its JSON into its own directory because
// multiple-cucumber-html-reporter aggregates *every* JSON file in the dir
// it's pointed at — sharing one dir would mix suite results together.
// Every suite traces. traceMode is passed through to world.ts as PW_TRACE:
// "retain-on-failure" records each scenario and keeps the recording only when
// the scenario fails, so a failing run is debuggable straight away without
// having to reproduce it — which against a live site is exactly the thing you
// can't rely on doing. Only the dedicated cucumber-trace suite keeps every
// trace. Each suite gets its own trace dir because the dir is wiped at the
// start of a run; sharing one would mean running smoke deleted the traces
// regression just produced.
const suites = {
  cucumber: {
    tags: null,
    parallel: 2,
    jsonDir: "reports/json/cucumber",
    json: "reports/json/cucumber/cucumber.json",
    out: "reports/cucumber-report",
    name: "Cucumber Tests",
    traceMode: "retain-on-failure",
    traceDir: "reports/traces/cucumber",
  },
  "cucumber-trace": {
    tags: null,
    parallel: 2,
    jsonDir: "reports/json/cucumber-trace",
    json: "reports/json/cucumber-trace/cucumber-trace.json",
    out: "reports/cucumber-trace-report",
    name: "Cucumber Tests (with Traces)",
    traceMode: "on",
    traceDir: "reports/traces/cucumber-trace",
  },
  regression: {
    tags: "@regression",
    parallel: 2,
    jsonDir: "reports/json/regression",
    json: "reports/json/regression/regression.json",
    out: "reports/cucumber-regression-report",
    name: "Regression Tests",
    traceMode: "retain-on-failure",
    traceDir: "reports/traces/regression",
  },
  smoke: {
    tags: "@smoke",
    parallel: 2,
    jsonDir: "reports/json/smoke",
    json: "reports/json/smoke/smoke.json",
    out: "reports/cucumber-smoke-report",
    name: "Smoke Tests",
    traceMode: "retain-on-failure",
    traceDir: "reports/traces/smoke",
  },
  accessibility: {
    tags: "@accessibility",
    parallel: null,
    jsonDir: "reports/json/accessibility",
    json: "reports/json/accessibility/accessibility.json",
    out: "reports/cucumber-accessibility-report",
    name: "Accessibility Tests",
    traceMode: "retain-on-failure",
    traceDir: "reports/traces/accessibility",
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

// Wipe and recreate the trace dir so the run starts with a clean slate —
// otherwise traces from a previous failure hang around after you've fixed it
// and it's no longer obvious which run they came from. world.ts reads
// PW_TRACE_DIR and writes a .zip per retained scenario into it.
//
// PW_TRACE can be overridden on the command line to change this per run:
//   PW_TRACE=on npm run smoke   — keep every trace, not just failures
//   PW_TRACE=off npm run smoke  — no tracing at all
const traceMode = process.env.PW_TRACE ?? suite.traceMode;
const traceDir = process.env.PW_TRACE_DIR ?? suite.traceDir;
fs.rmSync(traceDir, { recursive: true, force: true });
fs.mkdirSync(traceDir, { recursive: true });

// Retry flaky scenarios up to twice on CI only. process.env.CI is set by
// GitHub Actions (and most CI providers); locally it's undefined, so a
// failing scenario fails immediately rather than masking real bugs behind
// retries. Mirrors the retries setting in playwright.config.ts.
const retries = process.env.CI ? 2 : 0;

// Glob patterns are quoted so the shell (spawnSync uses shell: true) passes
// them through literally and cucumber-js expands them itself. Without the
// quotes, Linux/macOS shells expand the globs before cucumber sees them: a
// multi-file match like tests/features/support/*.ts becomes several words,
// only the first is consumed by --require, and the rest are mis-read as
// positional feature paths ("must end with .feature or .md"). Windows shells
// don't expand globs for native commands, which is why this only bites on CI.
const cucumberArgs = [
  "cucumber-js",
  "--require-module",
  "ts-node/register",
  "--require",
  '"tests/features/support/*.ts"',
  "--require",
  '"tests/step_definitions/*.ts"',
  '"tests/features/*.feature"',
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
    PW_TRACE: traceMode,
    PW_TRACE_DIR: traceDir,
  },
});

// Surface any traces the run left behind. Under retain-on-failure a trace only
// exists when a scenario failed, so this printing anything at all is itself the
// signal — and it saves hunting for the path in a wall of cucumber output.
const traceFiles = fs.existsSync(traceDir)
  ? fs.readdirSync(traceDir).filter((f) => f.endsWith(".zip"))
  : [];
if (traceFiles.length > 0) {
  console.log(`\n${traceFiles.length} trace(s) written to ${traceDir}/`);
  console.log(
    `View one with: npm run show-trace "${path.join(traceDir, traceFiles[0])}"`,
  );
}

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
