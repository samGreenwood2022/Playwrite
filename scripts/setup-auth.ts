#!/usr/bin/env node
// setup-auth.ts — signs in once and saves the session, before cucumber starts.
//
// Run as its own CI step (npm run setup-auth) ahead of the suite. Cucumber runs
// BeforeAll once per worker rather than once per run, so leaving sign-in to the
// workers means --parallel 4 produces four simultaneous sign-ins; see the header
// comment in tests/features/support/auth.ts for what that cost us. Doing it here
// means exactly one sign-in per job, before anything else is competing for the
// runner's CPU.
//
// Locally you don't need this: world.ts's BeforeAll still signs in on demand when
// no fresh session exists and the run isn't on CI.
//
// Exit codes:
//
//   0 — signed in, or reused a fresh session, or no credentials were configured.
//       The no-credentials case stays quiet on purpose: suites that don't need
//       sign-in should still run on a machine with no .env file.
//   1 — sign-in was attempted and failed.
//
// The workflow runs this step with continue-on-error: true, so a 1 marks the step
// red without killing the job. That combination is the point: the failure is
// visible at a glance, but the suite still runs and the @authenticated scenarios
// still report for themselves, rather than losing every result for that engine to
// a setup failure. Diagnostics land in reports/auth-failure/.

import "dotenv/config";
import { BROWSER_NAME, browserType } from "../tests/features/support/browser";
import {
  createStorageState,
  hasFreshStorageState,
  STORAGE_STATE_PATH,
} from "../tests/features/support/auth";

async function main(): Promise<void> {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;

  if (!email || !password) {
    console.warn(
      "TEST_EMAIL / TEST_PASSWORD not set — skipping session setup. " +
        "@authenticated scenarios will fail until credentials are provided.",
    );
    return;
  }

  // Reuse a session that's still inside its TTL. This matters most locally, where
  // running the setup twice in an hour shouldn't mean signing in twice; on CI the
  // runner is always fresh, so this is effectively always false there.
  if (hasFreshStorageState()) {
    console.log(
      `Reusing the existing session at ${STORAGE_STATE_PATH} — still fresh.`,
    );
    return;
  }

  console.log(`Signing in with ${BROWSER_NAME} to create a saved session...`);
  try {
    await createStorageState(browserType, BROWSER_NAME, email, password);
    console.log(`Session saved to ${STORAGE_STATE_PATH}.`);
  } catch (error) {
    console.error(
      "Sign-in failed — the suite will run signed out and @authenticated " +
        "scenarios will fail. Diagnostics (screenshot and page HTML) are in " +
        "reports/auth-failure/.\n" +
        (error instanceof Error ? error.stack ?? error.message : String(error)),
    );
    // Setting exitCode rather than calling process.exit() lets stdout and stderr
    // flush first — process.exit() can truncate the message above, which is the
    // one thing anyone reading a failed step actually needs.
    process.exitCode = 1;
  }
}

main();
