// world.ts — Cucumber setup that runs around every test.
//
// A "world" is Cucumber's version of a test fixture: a fresh CustomWorld is
// created for each scenario, giving every test its own browser, page, and page
// objects so tests can't interfere with each other. The Before/After hooks do
// the setup and cleanup automatically, so the step definitions never have to
// start or stop the browser themselves.

// Loads the values from the .env file so any test can read things like
// TEST_EMAIL / TEST_PASSWORD. Doing it here once means no other file has to.
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

// The file where we save the signed-in session. BeforeAll writes it once and
// each scenario's Before hook reads it. We use a full (absolute) path so it
// works no matter which folder the tests are run from.
const STORAGE_STATE_PATH = path.resolve(".auth/user.json");

// How long to reuse the saved session before signing in again. One hour is a
// good middle ground: long enough to skip sign-in on back-to-back runs, short
// enough to recover if the real session expires partway through a dev session.
const STORAGE_STATE_TTL_MS = 60 * 60 * 1000;

// A fake certification name we inject via the @stub-certifications route below.
// The feature file checks for this exact text, so if you change it here, change
// it there too. It's deliberately not a real name — if the test sees it, we
// know our fake data (the "stub") was used instead of the live data.
const STUBBED_CERTIFICATION_NAME = "Stubbed Test Certification";

// CustomWorld holds everything a single scenario needs to share. Each property
// declared here is reachable from any step definition through `this`.
export class CustomWorld extends World {
  browser!: Browser;
  context!: BrowserContext;
  page!: Page;
  homePage!: HomePage;
  dysonPage!: DysonHomepage;
  basePage!: BasePage;
  loginPage!: LoginPage;
  // Remembers the page URL from just before sign-in, so a later step can check
  // the user was returned to that same page. Optional — only some scenarios set it.
  capturedUrl?: string;
  // Path to the "what changed" image created when a visual comparison fails.
  // If it's set, the After hook attaches this image (instead of a normal
  // screenshot) so the report shows exactly what differed. Optional — only set
  // by visual-check scenarios that actually fail.
  visualDiffPath?: string;

  // constructor(options: IWorldOptions) {
  //   super(options);
  // }
}

// Registers CustomWorld as the world constructor so Cucumber uses it for every scenario.
setWorldConstructor(CustomWorld);

// Runs once before the whole test run. It signs in with the test account a
// single time and saves the resulting session (cookies + localStorage) to
// .auth/user.json. Scenarios tagged @authenticated then load that file and
// start already signed in, so they don't each have to sign in themselves.
//
// The saved session is reused for one hour. To force a fresh sign-in, delete
// .auth/user.json or wait for the hour to pass (e.g. if the session expired).
BeforeAll(async function () {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;

  // If there are no credentials, stop here quietly. Tests that actually need
  // sign-in (@authenticated) will fail on their own with a clear message, while
  // tests that don't need it (e.g. smoke) still pass — handy on machines that
  // haven't set up a .env file.
  if (!email || !password) {
    console.warn(
      "TEST_EMAIL / TEST_PASSWORD not set — skipping storage state setup. " +
        "@authenticated scenarios will fail until creds are provided.",
    );
    return;
  }

  // If we already saved a session recently (newer than the one-hour limit),
  // reuse it and skip signing in again. Saves about 5-10s per run locally.
  if (fs.existsSync(STORAGE_STATE_PATH)) {
    const ageMs = Date.now() - fs.statSync(STORAGE_STATE_PATH).mtimeMs;
    if (ageMs < STORAGE_STATE_TTL_MS) {
      return;
    }
  }

  // Make sure the .auth/ folder exists before we try to save the file into it.
  // Playwright won't create a missing folder for us — it would just error. With
  // recursive: true this does nothing if the folder is already there, so it's
  // safe to call every time.
  fs.mkdirSync(path.dirname(STORAGE_STATE_PATH), { recursive: true });

  // Open a temporary browser just to sign in. We reuse the same page objects
  // (HomePage / LoginPage) that the real tests use, so this follows the exact
  // path a real user would. If sign-in ever breaks, this setup breaks too —
  // a clear, early signal rather than a confusing failure later on.
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

  // Save the logged-in session (cookies etc.) to a file so other tests can
  // reuse it instead of signing in again.
  //
  // The catch: when we run tests in parallel, two workers can try to write
  // this same file at the same moment. If they both wrote to it directly, one
  // could overwrite the other halfway through and leave a corrupt, unreadable
  // file. To avoid that, each worker writes to its own temporary file first,
  // then renames it into place. Renaming is instant and all-or-nothing, so
  // anyone reading the file always sees a complete version — never a
  // half-written one.

  // 1. Grab the current session data from the browser.
  const state = await context.storageState();
  // 2. Build a temp filename unique to this process (process.pid = its ID).
  const tmpPath = `${STORAGE_STATE_PATH}.${process.pid}.tmp`;
  // 3. Write the session to the temp file.
  fs.writeFileSync(tmpPath, JSON.stringify(state));
  // 4. Rename the temp file to the real name in one atomic step.
  fs.renameSync(tmpPath, STORAGE_STATE_PATH);
  await browser.close();
});

// Runs before every scenario. It starts a fresh browser, opens a clean,
// isolated session and tab, and then creates all the page objects for that tab.
//
// For @authenticated scenarios it loads the saved session from .auth/user.json,
// so the browser starts already signed in (the scenario itself has no sign-in
// step). @lighthouse scenarios need nothing special here: their audit launches
// its own separate Chrome (via chrome-launcher), outside Playwright, to avoid
// the connection clashes that used to break earlier Lighthouse runs.
Before(async function (
  this: CustomWorld,
  scenario: ITestCaseHookParameter,
) {
  const tags = scenario.pickle.tags.map((t) => t.name);
  const isAuthenticated = tags.includes("@authenticated");

  this.browser = await chromium.launch();

  // Fix the window size and scale so screenshots are always the same size on
  // local Windows and on CI Linux — our visual comparisons rely on that. (Font
  // differences between operating systems are handled by keeping a separate
  // baseline image per OS.)
  //
  // For @authenticated scenarios, load the saved session so the new tab starts
  // signed in. The fs.existsSync check means that if the file is missing we just
  // continue as a normal logged-out session instead of crashing here — the
  // scenario then fails its "is signed in" check with a clear message.
  const useStoredAuth =
    isAuthenticated && fs.existsSync(STORAGE_STATE_PATH);
  this.context = await this.browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    ...(useStoredAuth ? { storageState: STORAGE_STATE_PATH } : {}),
  });

  // If PW_TRACE=1 is set (used by the cucumber-trace suite in
  // scripts/run-cucumber-suite.mjs), record a Playwright "trace" of the
  // scenario. Including sources lets the trace viewer show which step caused
  // each action — really helpful when figuring out why a test failed.
  if (process.env.PW_TRACE === "1") {
    await this.context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: true,
    });
  }

  // Open a new tab in the isolated session. Because each scenario has its own
  // tab, cookies, storage, and history can't leak from one scenario to the next
  // — that leaking is what causes most flaky, order-dependent test failures.
  this.page = await this.context.newPage();

  // Catch the network request that fills the Certifications tab so we can
  // control exactly what it shows, instead of relying on Dyson's live data:
  //   @stub-certifications       — rename the first certification to a known name.
  //   @stub-empty-certifications — return no certifications (tests the empty state).
  //   @stub-error-certifications — make the request fail with a 500 (tests errors).
  // We set this up here, before the page navigates, so it's ready when the tab
  // asks for its data.
  //
  // Tricky part: two different requests share the name "certifications" — one
  // loads the filter options, the other loads the result tiles. We only want to
  // change the tiles, so instead of matching on the name we look at the shape of
  // the response: we fetch the real data first, then tweak only the tile list.
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
        // As noted above, both the filter-options request and the result-tiles
        // request are called "certifications", but only the tiles one has a
        // paginatedResponse. So we use that field to find the right one and only
        // change that request. We must leave the filter-options request alone —
        // it loads as part of the page itself, so failing it would break the
        // page before the tab even appears.
        const tileEntry = arr.find(
          (entry) =>
            Array.isArray(
              entry?.data?.certifications?.byBrandId?.paginatedResponse?.items,
            ),
        );

        // @stub-error-certifications: make only the tiles request fail with a
        // 500 so we can test how the app handles a server error. Because it's
        // just this request, the rest of the page still loads and the user can
        // open the Certifications tab before it shows the error.
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

  // Give every page object the same page (tab). Because they all share one tab,
  // navigating in one of them is immediately visible to the others — no extra
  // wiring needed. The element locators inside each page object are "lazy":
  // they're defined now but only actually look at the page when a step uses them.
  this.homePage = new HomePage(this.page);
  this.dysonPage = new DysonHomepage(this.page);
  this.basePage = new BasePage(this.page);
  this.loginPage = new LoginPage(this.page);
});

// Runs after every scenario. If the scenario failed it saves a screenshot,
// then it closes the tab and browser to free up resources. The ?. (optional
// chaining) safely does nothing if setup failed before these were created.
//
// On failure we attach a PNG to the result with this.attach. The HTML report
// automatically shows attachments right next to the failed step, so whoever
// reviews it can see what the page looked like at the moment of failure without
// having to run the test again.
After(async function (this: CustomWorld, scenario: ITestCaseHookParameter) {
  if (scenario.result?.status === "FAILED" && this.page) {
    // A failed visual check saves the path to its "what changed" image. That
    // image highlights the exact differences, so attach it instead of a normal
    // screenshot (which would only show the current page, not the mismatch).
    // For any other kind of failure, fall back to a normal screenshot.
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

  // Stop the trace before closing the tab — once the tab is closed there's
  // nothing left to save. We write one .zip per scenario, named after the
  // scenario plus a timestamp so two parallel runs of the same scenario don't
  // overwrite each other's file.
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
