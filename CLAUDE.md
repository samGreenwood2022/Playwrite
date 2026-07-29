# CLAUDE.md

Playwright + Cucumber (TypeScript) UI test suite running against the **live** NBS
Source site (`https://source.thenbs.com`). There is no local app and no fixture
data — tests hit production, so real-world flakiness is a constraint to design
around rather than a bug to paper over.

## Commands

| Task | Command |
| --- | --- |
| Full suite / smoke / regression / accessibility | `npm run cucumber` · `npm run smoke` · `npm run regression` · `npm run accessibility` |
| With Playwright traces | `npm run cucumber:trace` (then `npm run show-trace <zip>`) |
| Lint | `npm run lint` / `npm run lint:fix` |

Always go through the npm scripts — they wrap `scripts/run-cucumber-suite.mjs`,
which wipes stale JSON, creates the output dirs cucumber-js won't create itself,
and generates the HTML report **even when the run fails** (which is when it's
most useful).

For a one-off single feature:

```
npx cucumber-js --require-module ts-node/register \
  --require "tests/features/support/*.ts" \
  --require "tests/step_definitions/*.ts" \
  "tests/features/<name>.feature"
```

`playwright.config.ts` and `tests/specs/example.spec.ts` are leftover scaffold
from `npm init playwright`. The Cucumber suite is the real one.

## Gotchas

These are the things that have actually cost time. Most are not discoverable by
reading the code.

### Waiting

- **Never use `waitForLoadState("networkidle")` on post-sign-in navigation.** It
  times out — analytics, polling and lazy images keep the connection count above
  zero indefinitely. Wait for a concrete element instead; `LoginPage.signIn`
  waits for the "Open user menu" button.
- `BasePage.verifyVisualRegression` still uses `networkidle` after the lazy-load
  scroll. It does currently resolve there, but treat it as a known flake risk.

### Auth

- `BeforeAll` signs in once and caches the session to `.auth/user.json` with a
  **1-hour TTL**. Inside that hour the sign-in code never executes — so to test a
  change to it, move the file aside first or you'll verify nothing.
- Cucumber runs `BeforeAll` **once per worker**, not once per run. Suites use
  `--parallel 2`, so two workers each sign in and race to write that file (hence
  the temp-file-plus-rename in `world.ts`).
- A throw in `BeforeAll` kills the worker process outright — the run dies with
  `Unexpected error on worker.receiveMessage` and no scenario reports. Keep the
  sign-in wrapped in try/catch so failures degrade to "`@authenticated`
  scenarios fail" instead.
- Scenarios opt in with `@authenticated`.

### Visual regression

- **Masks are painted at screenshot time**, so they must be present in the
  baseline *and* every comparison run. You cannot mask an existing baseline
  image — any mask change means deleting and regenerating the baseline.
- Baselines are **per-OS**: `<name>-win32.png` / `<name>-linux.png`, both
  committed. A mask change invalidates both, and the Linux one can only be
  regenerated on Linux. There's no CI workflow in the repo yet, so
  `nbs-homepage-linux.png` is currently stale and will fail when one is added.
- **Playwright silently ignores a mask locator that matches nothing** — no error,
  no warning, the area just gets compared pixel-for-pixel. This hid a dead
  selector for a long time. `verifyVisualRegression` now throws when a mask
  matches zero elements; keep that guard.
- Mask locators must be validated **after** the lazy-load scroll — the sponsored
  and inspiration sections aren't in the DOM before it.
- The NBS homepage currently masks ~35% of the page (three ad slots plus the
  inspiration grid). Before widening masks further, prefer stubbing the data via
  `network-stubs.ts` or moving to component-scoped `locator.screenshot()`.
- **A baseline and a screenshot of different sizes used to produce no diff
  image at all.** pixelmatch throws `Image sizes do not match.` on mismatched
  buffers, and that throw escaped before the `-diff.png` was written — so a CI
  failure uploaded an actual image and nothing to compare it against.
  `verifyVisualRegression` now pads both images onto a shared canvas, writes the
  diff, *then* fails with the two sets of dimensions in the message. Keep the
  write before the throws.
- A failure *before* the comparison (a dead mask locator, a `waitFor` timeout)
  still produces no diff — there's nothing to diff yet. The `After` hook falls
  back to a plain full-page screenshot in that case, which is the right
  artefact.
- Masking only survives while the masked box keeps its size and position. The
  inspiration grid mixes tile heights, so a layout change there shifts the whole
  page below it and no mask will help.
- Prefer Angular component tags (`app-sponsored-products`) over the classes
  beside them — `.ng-star-inserted` and `.ng-tns-c*` are build-generated and
  change on every rebuild.

## Conventions

- Page objects live in `tests/pages/`, one per page. `BasePage` holds site-wide
  behaviour and is **composed alongside** the others, not extended.
- Step definitions orchestrate only. Locators and assertions belong in page
  objects.
- All `page.route()` trickery lives in `network-stubs.ts`; scenario tags map to
  stub modes in `world.ts`.
- Comments here are unusually thorough on purpose — full sentences explaining
  *why*, aimed at someone still learning the stack. Match that density rather
  than the terser style you'd use elsewhere.
