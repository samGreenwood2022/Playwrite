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
  // The regression suite is the one CI runs, and it's the biggest, so it gets
  // four workers rather than two. The scenarios spend nearly all their time
  // waiting on the live site rather than using CPU, so workers can outnumber
  // cores without them slowing each other down; the GitHub-hosted Linux runner
  // this repo uses (public repo, so 4 vCPU / 16GB) has ample room for four
  // Chromium instances. Raising this is the cheap alternative to sharding the
  // suite across several CI machines: sharding would make every machine repeat
  // the ~2-3 minutes of checkout, npm ci and browser install, which is most of
  // the job. Worth revisiting only once the suite takes appreciably longer than
  // that setup cost.
  //
  // Note the ceiling on this: world.ts runs BeforeAll once per worker, so four
  // workers means four sign-ins against the live auth endpoint at roughly the
  // same moment. That's the thing that will break first if this number grows,
  // and it breaks quietly — a rate-limited sign-in degrades to "@authenticated
  // scenarios fail", which reads like a product bug rather than a CI setting.
  regression: {
    tags: "@regression",
    parallel: 4,
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
  // Tag a single scenario with @trace-this and run this suite to get its trace
  // regardless of pass/fail (traceMode "on"), without tracing the whole regression
  // suite. If nothing is tagged, cucumber-js just runs zero scenarios and exits 0.
  "trace-scenario": {
    tags: "@trace-this",
    parallel: null,
    jsonDir: "reports/json/trace-scenario",
    json: "reports/json/trace-scenario/trace-scenario.json",
    out: "reports/cucumber-trace-scenario-report",
    name: "Traced Scenario",
    traceMode: "on",
    traceDir: "reports/traces/trace-scenario",
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

// Which browser engine this run uses. world.ts reads BROWSER itself to pick the
// engine; this script only needs to know about it to keep one engine's output
// from landing on top of another's, and to say which engine a report belongs to.
//
// chromium keeps the original, unsuffixed paths so a default run behaves exactly
// as it always has and the existing report links still work. Only firefox and
// webkit get a suffix. In CI each engine runs on its own matrix machine, so the
// suffix matters less there than it does locally, where running two engines
// back to back would otherwise leave you with one report and no way to tell
// which engine produced it.
const browser = (process.env.BROWSER ?? "chromium").toLowerCase();
if (browser !== "chromium") {
  const jsonFile = path.basename(suite.json);
  suite.jsonDir = `${suite.jsonDir}-${browser}`;
  // Built with a forward slash rather than path.join: this string is passed
  // through to cucumber's --format argument, and on Windows path.join would
  // produce backslashes that the shell then treats as escapes.
  suite.json = `${suite.jsonDir}/${jsonFile}`;
  suite.out = `${suite.out}-${browser}`;
  suite.traceDir = `${suite.traceDir}-${browser}`;
  suite.name = `${suite.name} (${browser})`;

  // Skip the pixel-comparison scenarios on anything but chromium. Baselines are
  // per engine (BasePage.verifyVisualRegression), and we deliberately only keep
  // chromium ones — see the comment on the @visual tag in
  // tests/features/visual-regression.feature for why. Without this filter the
  // first firefox run would silently *create* firefox baselines and pass, then
  // start failing on the second run, which is a confusing way to find out.
  suite.tags = suite.tags ? `${suite.tags} and not @visual` : "not @visual";
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
//
// The tag expression is quoted for a related reason. It used to be a single
// token ("@regression"), but a non-chromium run appends "and not @visual" and
// spawnSync with shell: true would hand those on as separate words — cucumber
// would take "@regression" as the tag expression and then choke on "and" as a
// stray feature path.
const cucumberArgs = [
  "cucumber-js",
  "--require-module",
  "ts-node/register",
  "--require",
  '"tests/features/support/*.ts"',
  "--require",
  '"tests/step_definitions/*.ts"',
  '"tests/features/*.feature"',
  ...(suite.tags ? ["--tags", `"${suite.tags}"`] : []),
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
