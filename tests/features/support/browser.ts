// browser.ts — picks which browser engine the run uses.
//
// This lives on its own because two entry points need it: the Cucumber world
// (world.ts), which launches a browser per scenario, and scripts/setup-auth.ts,
// which launches one to sign in before the suite starts. If each kept its own
// copy of the engine list, adding an engine in one and forgetting the other
// would produce a run that quietly tested the wrong thing.

import { BrowserType, chromium, firefox, webkit } from "playwright";

// Which browser engine to run in, read from the BROWSER environment variable.
// Defaults to chromium so nothing has to change for a normal local run; CI sets
// it per matrix job so the same suite runs against all three engines:
//
//   BROWSER=chromium npm run regression   (the default)
//   BROWSER=firefox  npm run regression
//   BROWSER=webkit   npm run regression
//
// Playwright bundles its own build of each engine, so "webkit" here means
// Playwright's WebKit — close to Safari's rendering, but not literally Safari,
// and likewise Firefox rather than a shipped Firefox release. That's the usual
// trade: real engine differences get caught, vendor-specific browser UI does
// not.
//
// An unrecognised value falls back to chromium with a warning rather than
// throwing. A typo in a CI matrix would otherwise take out the whole worker
// (see the note on BeforeAll in world.ts), and a suite that quietly ran the
// wrong engine is easier to spot in the report — which names the browser — than
// a run that produced nothing at all.
const BROWSER_TYPES: Record<string, BrowserType> = {
  chromium,
  firefox,
  webkit,
};

export const BROWSER_NAME: string = (() => {
  const raw = (process.env.BROWSER ?? "chromium").toLowerCase();
  if (raw in BROWSER_TYPES) return raw;
  console.warn(
    `Unknown BROWSER "${raw}" — falling back to chromium. ` +
      `Valid values: ${Object.keys(BROWSER_TYPES).join(", ")}.`,
  );
  return "chromium";
})();

// The engine itself. Every launch site goes through this, so switching browsers
// is a single environment variable rather than an edit in the test code.
export const browserType: BrowserType = BROWSER_TYPES[BROWSER_NAME];
