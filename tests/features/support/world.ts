// world.ts — Cucumber world configuration and lifecycle hooks.
//
// The "world" is Cucumber's equivalent of a test fixture. An instance of CustomWorld
// is created fresh for every scenario, giving each test its own isolated browser,
// page, and page object instances. The Before and After hooks handle setup and
// teardown automatically so step definitions don't need to manage the browser directly.

// Loads variables from .env into process.env on module import, so any step
// definition can read TEST_EMAIL / TEST_PASSWORD without each file re-configuring dotenv.
import "dotenv/config";
import {
  setWorldConstructor,
  Before,
  After,
  BeforeAll,
  ITestCaseHookParameter,
  World,
} from "@cucumber/cucumber";
import {
  Browser,
  BrowserContext,
  Page,
  chromium,
} from "playwright";
import fs from "fs";
import path from "path";
import { HomePage } from "../../pages/home-page";
import { DysonHomepage } from "../../pages/dyson-homepage";
import { BasePage } from "../../pages/base-page";
import { LoginPage } from "../../pages/login-page";

// Where the cached signed-in browser state is written by BeforeAll and read
// by the per-scenario Before hook. Path is absolute so it works regardless
// of which directory cucumber-js was invoked from.
const STORAGE_STATE_PATH = path.resolve(".auth/user.json");

// How long to trust the cached storage state before re-running the sign-in
// flow. One hour is a sensible balance: short enough to catch session expiry
// during a long dev session, long enough to skip sign-in on consecutive runs.
const STORAGE_STATE_TTL_MS = 60 * 60 * 1000;

// The name injected into the first certification by the @stub-certifications
// route below. The feature file asserts this exact string, so the two must stay
// in sync. Deliberately not a real certification name so a passing test proves
// the stub took effect (the live data never contains this value).
const STUBBED_CERTIFICATION_NAME = "Stubbed Test Certification";

// CustomWorld extends Cucumber's base World class and holds all shared state for a scenario.
// Properties are declared here so step definitions can access them via `this`.
export class CustomWorld extends World {
  browser!: Browser;
  context!: BrowserContext;
  page!: Page;
  homePage!: HomePage;
  dysonPage!: DysonHomepage;
  basePage!: BasePage;
  loginPage!: LoginPage;
  // Holds the URL captured just before sign-in so a later step can assert
  // the user is returned to the same page. Optional because not every
  // scenario sets it.
  capturedUrl?: string;
  // Path to the pixel-diff PNG written by a failed visual regression check.
  // When set, the After hook attaches this (rather than a live page
  // screenshot) so the report shows exactly what changed. Optional because
  // only scenarios that run a visual check and fail it set it.
  visualDiffPath?: string;

  // constructor(options: IWorldOptions) {
  //   super(options);
  // }
}

// Registers CustomWorld as the world constructor so Cucumber uses it for every scenario.
setWorldConstructor(CustomWorld);

// One-time sign-in for the whole test run. Signs in with the test account
// once, then dumps the resulting cookies + localStorage to .auth/user.json.
// Scenarios tagged @authenticated start fresh contexts hydrated from this
// file so they skip the per-scenario sign-in cost entirely.
//
// Cached for one hour — delete .auth/user.json (or wait for the TTL) to
// force a refresh, e.g. if the underlying session has expired.
BeforeAll(async function () {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;

  // Skip silently if creds are missing — @authenticated scenarios will
  // surface their own error when they try to load the missing file. This
  // keeps unrelated runs (e.g. smoke without auth) green even on machines
  // that don't have a .env populated.
  if (!email || !password) {
    console.warn(
      "TEST_EMAIL / TEST_PASSWORD not set — skipping storage state setup. " +
        "@authenticated scenarios will fail until creds are provided.",
    );
    return;
  }

  // Cache check: if the storage state file already exists and is younger
  // than the TTL, reuse it. Saves ~5-10s per run during local development.
  if (fs.existsSync(STORAGE_STATE_PATH)) {
    const ageMs = Date.now() - fs.statSync(STORAGE_STATE_PATH).mtimeMs;
    if (ageMs < STORAGE_STATE_TTL_MS) {
      return;
    }
  }

  // Ensure the parent directory (.auth/) exists before context.storageState
  // tries to write user.json into it — Playwright's writer doesn't create
  // missing parents, it just throws ENOENT. recursive: true makes this a
  // no-op when the directory already exists, so it's safe to run on every
  // sign-in regardless of cache state.
  fs.mkdirSync(path.dirname(STORAGE_STATE_PATH), { recursive: true });

  // Throwaway browser for the sign-in flow. Re-uses the existing HomePage /
  // LoginPage POMs so this setup follows exactly the same path a real user
  // would — if the sign-in flow breaks, this BeforeAll fails too, which is
  // a clear signal rather than a silent storage-state divergence.
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const homePage = new HomePage(page);
  const basePage = new BasePage(page);
  const loginPage = new LoginPage(page);

  await homePage.navigateToNBSHomepage();
  await basePage.signInButton.click();
  await loginPage.signIn(email, password);

  // Write the storage state atomically. Under --parallel, cucumber runs this
  // BeforeAll once per worker process; on a cold runner both workers miss the
  // cache and sign in, so two processes would otherwise write this same file
  // concurrently. A direct storageState({ path }) is a truncate-and-write, so
  // a shorter document landing over a longer one leaves trailing bytes —
  // surfacing later as "Unexpected non-whitespace character after JSON". We
  // serialize to a process-unique temp file then rename() into place; rename
  // is atomic, so any reader (or the other worker) sees either the old file
  // or a complete new one, never a half-written one.
  const state = await context.storageState();
  const tmpPath = `${STORAGE_STATE_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(state));
  fs.renameSync(tmpPath, STORAGE_STATE_PATH);
  await browser.close();
});

// Runs before each scenario — launches a fresh browser, creates an isolated
// context and page, then instantiates all page objects against that page.
//
// For @authenticated scenarios the context is hydrated from .auth/user.json
// so the browser starts already signed in (no sign-in step in the scenario
// itself). @lighthouse scenarios DON'T need any special handling here:
// BasePage.runLighthouseAudit launches its own isolated Chrome process via
// chrome-launcher, completely outside Playwright's browser, to avoid the
// CDP connection conflicts that broke earlier playwright-lighthouse runs.
Before(async function (
  this: CustomWorld,
  scenario: ITestCaseHookParameter,
) {
  const tags = scenario.pickle.tags.map((t) => t.name);
  const isAuthenticated = tags.includes("@authenticated");

  this.browser = await chromium.launch();

  // Pin viewport and device scale factor so screenshots have consistent
  // dimensions across local (Windows) and CI (Linux) — visual regression
  // baselines depend on this. Layout differences from OS font rendering
  // are handled separately by per-OS baseline filenames.
  //
  // For @authenticated scenarios, hydrate from the saved storage state
  // so the new context starts already signed in. The fs.existsSync
  // guard means a missing file falls through to a normal anonymous
  // session rather than crashing the hook — the scenario will then
  // fail its signed-in assertion with a clear message instead.
  const useStoredAuth =
    isAuthenticated && fs.existsSync(STORAGE_STATE_PATH);
  this.context = await this.browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    ...(useStoredAuth ? { storageState: STORAGE_STATE_PATH } : {}),
  });

  // When the runner sets PW_TRACE=1 (see scripts/run-cucumber-suite.mjs
  // cucumber-trace suite), start a Playwright trace for the scenario.
  // Sources are included so the trace viewer can show the step that
  // triggered each action — invaluable when triaging a failure.
  if (process.env.PW_TRACE === "1") {
    await this.context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: true,
    });
  }

  // Open a fresh tab inside the isolated context. Each scenario gets
  // its own page, so cookies, local storage, and history can't leak
  // between scenarios — the source of most cross-test flakiness.
  this.page = await this.context.newPage();

  // Intercept the GraphQL search that backs the Certifications tab so the tab's
  // content is deterministic and independent of Dyson's live certifications:
  //   @stub-certifications       — rename the first certification to a known value.
  //   @stub-empty-certifications — return zero certifications (empty-state path).
  //   @stub-error-certifications — fail the request with a 500 (server-error path).
  // Registered here (before the Background navigates) so it's active by the time
  // the tab fires its query.
  //
  // Two different operations share the name "certifications": one returns the
  // filter facets (issuingBodyByBrandId), the other the result tiles
  // (byBrandId.paginatedResponse.items). We patch only the latter — matching on
  // the response shape, not the operation name — which is why we fetch the real
  // response first and modify just the tile list.
  const renameFirstCert = tags.includes("@stub-certifications");
  const emptyCerts = tags.includes("@stub-empty-certifications");
  const errorCerts = tags.includes("@stub-error-certifications");
  if (renameFirstCert || emptyCerts || errorCerts) {
    await this.page.route(
      "**/api.source.thenbs.com/graphql",
      async (route) => {
        const reqBody = JSON.parse(route.request().postData() || "[]");
        const ops = (Array.isArray(reqBody) ? reqBody : [reqBody]).map(
          (o) => o.operationName,
        );
        // Skip batches that don't touch certifications — pass them through.
        if (!ops.includes("certifications")) return route.continue();

        const response = await route.fetch();
        let json;
        try {
          json = await response.json();
        } catch {
          return route.fulfill({ response });
        }
        const arr = Array.isArray(json) ? json : [json];
        // The operationName "certifications" is shared by the filter-facets
        // query and the result-tiles query; only the latter carries a
        // paginatedResponse. We therefore key every stub off that field so we
        // touch ONLY the tile-list request and leave the facets request (which
        // loads as part of the navbar/page chrome) untouched — 500ing the
        // facets request would break the page before the tab even renders.
        const tileEntry = arr.find(
          (entry) =>
            Array.isArray(
              entry?.data?.certifications?.byBrandId?.paginatedResponse?.items,
            ),
        );

        // @stub-error-certifications: replace the tile-list request with a 500
        // so we can exercise the app's server-error handling. Scoped to the
        // tile request only, so the rest of the page still loads and the user
        // can reach the Certifications tab before it fails.
        if (errorCerts && tileEntry) {
          return route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({
              errors: [{ message: "Internal Server Error" }],
            }),
          });
        }

        for (const entry of arr) {
          const pr = entry?.data?.certifications?.byBrandId?.paginatedResponse;
          if (!pr || !Array.isArray(pr.items)) continue;
          if (emptyCerts) {
            pr.items = [];
            // Keep the total consistent so the UI commits to the empty state.
            if (typeof pr.totalItems === "number") pr.totalItems = 0;
          } else if (renameFirstCert && pr.items.length) {
            pr.items[0].name = STUBBED_CERTIFICATION_NAME;
          }
        }
        await route.fulfill({ response, json: arr });
      },
    );
  }

  // Constructor-injection: hand the same Page instance to every page
  // object. They all act on the same browser tab, so a navigation in one
  // POM is visible to all the others without any extra wiring. Locators
  // inside each POM are lazy — they're declared here but only resolved
  // against the DOM the moment a step actually uses them.
  this.homePage = new HomePage(this.page);
  this.dysonPage = new DysonHomepage(this.page);
  this.basePage = new BasePage(this.page);
  this.loginPage = new LoginPage(this.page);
});

// Runs after each scenario — captures a failure screenshot, then closes
// the browser context and browser to free resources. Optional chaining
// (?.) prevents errors if setup failed before these were assigned.
//
// On failure we attach a PNG to the cucumber result via this.attach.
// The HTML report generator picks attachments up automatically and
// embeds them inline next to the failed step, so a triager can see
// the page state at the moment of failure without re-running the suite.
After(async function (this: CustomWorld, scenario: ITestCaseHookParameter) {
  if (scenario.result?.status === "FAILED" && this.page) {
    // A visual regression failure records the pixel-diff PNG path on the
    // world. That diff highlights exactly what changed, so attach it instead
    // of a live page screenshot (which only shows the current state, not the
    // mismatch). Any other failure falls back to the live screenshot.
    if (this.visualDiffPath && fs.existsSync(this.visualDiffPath)) {
      try {
        this.attach(fs.readFileSync(this.visualDiffPath), "image/png");
      } catch {
        // Diff file unreadable — fall through to nothing rather than mask the
        // real failure with an attachment error.
      }
    } else {
      try {
        const screenshot = await this.page.screenshot({ fullPage: true });
        this.attach(screenshot, "image/png");
      } catch {
        // Page may already be closed or in a broken state — swallow so the
        // teardown still runs and the original failure (not a screenshot
        // error) is what the report surfaces.
      }
    }
  }

  // Stop the trace before closing the context — once the context is
  // closed, tracing.stop has nothing to flush. One .zip per scenario,
  // named after the scenario plus a timestamp so parallel runs of the
  // same scenario don't overwrite each other.
  if (process.env.PW_TRACE === "1" && this.context) {
    try {
      const traceDir = process.env.PW_TRACE_DIR || "reports/traces";
      fs.mkdirSync(traceDir, { recursive: true });
      const safeName = scenario.pickle.name
        .replace(/[^a-z0-9]+/gi, "_")
        .toLowerCase();
      const tracePath = path.join(
        traceDir,
        `${safeName}-${Date.now()}.zip`,
      );
      await this.context.tracing.stop({ path: tracePath });
    } catch {
      // Tracing may already have been stopped or the context torn down;
      // don't mask the real scenario result with a teardown error.
    }
  }

  await this.context?.close();
  await this.browser?.close();
});
