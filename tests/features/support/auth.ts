// auth.ts — signing in once and saving the session for the rest of the run.
//
// This is shared by two callers that want the same thing for different reasons:
//
//   scripts/setup-auth.ts — run as its own CI step, before cucumber starts.
//   world.ts's BeforeAll  — the local convenience path, so a developer running
//                           a scenario doesn't have to remember a setup command.
//
// The reason CI uses a separate step is worth spelling out, because it isn't
// obvious. Cucumber runs BeforeAll once per *worker*, not once per run, and the
// suites use --parallel 4. So the old arrangement had four workers each launch
// their own extra browser and sign in at the same instant, on a 4-vCPU runner
// that was already running four scenario browsers. Under that contention the
// webkit job's sign-in timed out on all four workers, no session file was
// written, and every @authenticated scenario silently ran signed out. Signing in
// once, in a dedicated step, removes the stampede and makes a sign-in failure a
// single loud red step instead of four warnings buried in the scrollback.

import fs from "fs";
import path from "path";
import { BrowserType, Page } from "playwright";
import { HomePage } from "../../pages/home-page";
import { BasePage } from "../../pages/base-page";
import { LoginPage } from "../../pages/login-page";
import { dismissOverlaysAutomatically } from "./overlays";

// The file where we save the signed-in session. Callers read it back as
// Playwright's storageState. We use a full (absolute) path so it works no matter
// which folder the tests are run from.
export const STORAGE_STATE_PATH = path.resolve(".auth/user.json");

// How long to reuse the saved session before signing in again. One hour is a
// good middle ground: long enough to skip sign-in on back-to-back runs, short
// enough to recover if the real session expires partway through a dev session.
export const STORAGE_STATE_TTL_MS = 60 * 60 * 1000;

// Where the diagnostics from a failed sign-in go. Under reports/ because the CI
// workflow already uploads that whole directory as an artifact, so the
// screenshot and HTML are downloadable without touching the workflow again.
// Note that run-cucumber-suite.mjs only wipes the json and trace directories, so
// a file written here before cucumber starts survives the run.
const AUTH_FAILURE_DIR = path.resolve("reports/auth-failure");

// True if a saved session exists and is still inside its TTL. Both callers check
// this before signing in, which is what makes the CI setup step and the local
// BeforeAll path cooperate rather than duplicate work: whichever runs first
// writes the file, and the other one sees it and returns.
export function hasFreshStorageState(): boolean {
  if (!fs.existsSync(STORAGE_STATE_PATH)) return false;
  const ageMs = Date.now() - fs.statSync(STORAGE_STATE_PATH).mtimeMs;
  return ageMs < STORAGE_STATE_TTL_MS;
}

// Saves whatever the page can tell us about a failed sign-in.
//
// Before this existed, a sign-in failure gave you a stack trace pointing at a
// click that timed out, and nothing about what the page actually looked like —
// which is not enough to tell "the button moved" from "a modal is covering it"
// from "the site served an error page". The screenshot answers that in one look.
//
// Everything here is best-effort and swallows its own errors: this runs on a
// page that has already misbehaved, and a failure to collect diagnostics must
// not replace the real error with a less useful one.
async function captureSignInFailure(
  page: Page,
  browserName: string,
): Promise<void> {
  try {
    fs.mkdirSync(AUTH_FAILURE_DIR, { recursive: true });
    // The pid keeps two workers from overwriting each other's diagnostics on the
    // local path, where BeforeAll can still run more than once.
    const stem = path.join(AUTH_FAILURE_DIR, `${browserName}-${process.pid}`);
    await page.screenshot({ path: `${stem}.png`, fullPage: true });
    fs.writeFileSync(`${stem}.html`, await page.content(), "utf8");
    console.error(
      `Sign-in diagnostics written to ${stem}.png and ${stem}.html ` +
        `(the page was at ${page.url()}).`,
    );
  } catch (diagnosticError) {
    console.error(
      "Could not capture sign-in diagnostics: " +
        (diagnosticError instanceof Error
          ? diagnosticError.message
          : String(diagnosticError)),
    );
  }
}

// Signs in with the test account and writes the session to STORAGE_STATE_PATH.
//
// Throws if sign-in fails, after capturing diagnostics. Callers decide what a
// failure means: the CI step reports it and lets the suite continue signed out,
// while BeforeAll degrades to a warning because a throw there would kill the
// worker process outright.
export async function createStorageState(
  engine: BrowserType,
  browserName: string,
  email: string,
  password: string,
): Promise<void> {
  // Make sure the .auth/ folder exists before we try to save the file into it.
  // Playwright won't create a missing folder for us — it would just error. With
  // recursive: true this does nothing if the folder is already there, so it's
  // safe to call every time.
  fs.mkdirSync(path.dirname(STORAGE_STATE_PATH), { recursive: true });

  // Open a temporary browser just to sign in. We reuse the same page objects
  // (HomePage / LoginPage) that the real tests use, so this follows the exact
  // path a real user would. If sign-in ever breaks, this breaks too — a clear,
  // early signal rather than a confusing failure later on.
  //
  // This signs in using whichever engine the run is using, not always chromium.
  // The saved file is only cookies and localStorage, so a session captured in one
  // engine would in principle load into another — but signing in with the engine
  // under test is what proves the sign-in flow works there, which is a large part
  // of the point of running cross-browser at all.
  const browser = await engine.launch();

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    // Register overlay dismissal before anything navigates. The sign-in flow
    // starts on the homepage, which is where the new-feature popup appears, and
    // its backdrop blocking the "Sign in" click is what broke the webkit job.
    await dismissOverlaysAutomatically(page);
    const homePage = new HomePage(page);
    const basePage = new BasePage(page);
    const loginPage = new LoginPage(page);

    try {
      await homePage.navigateToNBSHomepage();
      await basePage.signInButton.click();
      await loginPage.signIn(email, password);
    } catch (error) {
      await captureSignInFailure(page, browserName);
      throw error;
    }

    // Save the logged-in session (cookies etc.) to a file so the tests can reuse
    // it instead of signing in again.
    //
    // The catch: two processes can try to write this same file at the same
    // moment. If they both wrote to it directly, one could overwrite the other
    // halfway through and leave a corrupt, unreadable file. To avoid that, each
    // writes to its own temporary file first, then renames it into place.
    // Renaming is instant and all-or-nothing, so anyone reading the file always
    // sees a complete version — never a half-written one.
    const state = await context.storageState();
    const tmpPath = `${STORAGE_STATE_PATH}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(state));
    fs.renameSync(tmpPath, STORAGE_STATE_PATH);
  } finally {
    // Always close the temporary browser, success or failure, so a failed
    // sign-in doesn't leave a browser process running for the whole suite.
    await browser.close();
  }
}
