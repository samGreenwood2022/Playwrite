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
  IWorldOptions,
  ITestCaseHookParameter,
  World,
} from "@cucumber/cucumber";
import {
  Browser,
  BrowserContext,
  Page,
  LaunchOptions,
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

// Fixed port that playwright-lighthouse attaches to. Only opened on Chromium
// instances that run @lighthouse scenarios so unrelated runs aren't exposed
// to the DevTools protocol over a TCP port.
const LIGHTHOUSE_DEBUG_PORT = 9222;

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

  constructor(options: IWorldOptions) {
    super(options);
  }
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

  await context.storageState({ path: STORAGE_STATE_PATH });
  await browser.close();
});

// Runs before each scenario — launches a fresh browser, creates an isolated
// context and page, then instantiates all page objects against that page.
//
// The hook reads the scenario's tags so it can:
//   - Hydrate the context from .auth/user.json for @authenticated scenarios
//     (no sign-in step needed inside the scenario itself).
//   - Open Chromium with --remote-debugging-port for @lighthouse scenarios
//     so playwright-lighthouse can attach.
Before(async function (
  this: CustomWorld,
  scenario: ITestCaseHookParameter,
) {
  const tags = scenario.pickle.tags.map((t) => t.name);
  const isAuthenticated = tags.includes("@authenticated");
  const isLighthouse = tags.includes("@lighthouse");

  // Lighthouse needs a TCP debugging port so the lighthouse runner can
  // connect to the same Chromium instance Playwright is driving. Only
  // opened when we actually need it — most scenarios stay on Playwright's
  // default --remote-debugging-pipe (no exposed port).
  const launchOptions: LaunchOptions = isLighthouse
    ? { args: [`--remote-debugging-port=${LIGHTHOUSE_DEBUG_PORT}`] }
    : {};
  this.browser = await chromium.launch(launchOptions);

  // Pin viewport and device scale factor so screenshots have consistent
  // dimensions across local (Windows) and CI (Linux) — visual regression
  // baselines depend on this. Layout differences from OS font rendering
  // are handled separately by per-OS baseline filenames.
  //
  // For @authenticated scenarios, hydrate from the saved storage state so
  // the new context starts already signed in. The fs.existsSync guard
  // means a missing file falls through to a normal anonymous session
  // rather than crashing the hook — the scenario will then fail its
  // signed-in assertion with a clear message instead.
  const useStoredAuth =
    isAuthenticated && fs.existsSync(STORAGE_STATE_PATH);
  this.context = await this.browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    ...(useStoredAuth ? { storageState: STORAGE_STATE_PATH } : {}),
  });

  // Open a fresh tab inside the isolated context. Each scenario gets its
  // own page, so cookies, local storage, and history can't leak between
  // scenarios — the source of most cross-test flakiness.
  this.page = await this.context.newPage();

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

// Runs after each scenario — closes the browser context and browser to free resources.
// Optional chaining (?.) prevents errors if setup failed before these were assigned.
After(async function (this: CustomWorld) {
  await this.context?.close();
  await this.browser?.close();
});
