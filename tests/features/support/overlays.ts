// overlays.ts — deals with the site's dialogs appearing whenever they feel like it.
//
// The NBS Source homepage can throw up an Angular Material dialog — currently the
// "Discover NBS LCA" new-feature popup, plus the cookie consent banner — at some
// point after the page loads. Two properties make this genuinely awkward to
// handle at the call site:
//
//   1. It arrives late and at no fixed moment. Anything that checks for it once,
//      just after navigation, races it. A 2-second window used to be enough on a
//      developer machine and not enough on a loaded CI runner, which is how the
//      webkit job came to fail: the dialog turned up after the check, stayed up,
//      and every subsequent click failed.
//   2. It doesn't hide the page from assistive tech — the container carries
//      aria-modal="false" — so the header stays present and "visible" to
//      Playwright. There is no locator you can wait on that goes quiet while the
//      dialog is up. What actually breaks is only the *click*: the CDK backdrop
//      sits over the page and swallows pointer events, which surfaces as
//      "<div class="cdk-overlay-backdrop..."> intercepts pointer events" after a
//      30-second timeout on a button the screenshot plainly shows.
//
// So rather than dismissing it at a moment of our choosing, we register a handler
// and let Playwright dismiss it at the moment it matters. addLocatorHandler runs
// the callback whenever the given locator becomes visible and Playwright is about
// to perform an action, then carries on with that action. That covers the dialog
// appearing before a click, during a click, or halfway through a scenario — none
// of which the old check-once-after-navigation approach could.

import { Page } from "@playwright/test";

// The backdrop rather than the dialog itself. Every CDK overlay that blocks
// interaction has one, so this catches the consent banner and the feature popup
// without needing to know which is up — and it's the element Playwright names in
// the "intercepts pointer events" error, so it's provably the thing in the way.
const OVERLAY_BACKDROP = ".cdk-overlay-backdrop-showing";

// Registers automatic dismissal of blocking overlays on this page.
//
// Call once per page, straight after creating it — the handler then applies for
// the page's whole lifetime. Registering it twice would just dismiss twice, which
// is harmless but pointless.
export async function dismissOverlaysAutomatically(page: Page): Promise<void> {
  await page.addLocatorHandler(
    page.locator(OVERLAY_BACKDROP),
    async () => {
      // Tried in order of specificity. .first() on each because a page can hold
      // more than one dialog's markup at once, and a locator that matches two
      // elements would otherwise throw a strict-mode error from inside the
      // handler — turning a recoverable overlay into a hard failure.
      const closeButtons = [
        page.getByRole("button", { name: "Accept all" }).first(),
        page.getByRole("button", { name: "Close dialog" }).first(),
        page.getByRole("button", { name: "Close", exact: true }).first(),
      ];

      for (const closeButton of closeButtons) {
        if (await closeButton.isVisible()) {
          await closeButton.click({ timeout: 5000 }).catch(() => {
            // Lost a race with the dialog's own open/close animation. Playwright
            // re-runs this handler on the next action, so there's another go.
          });
          return;
        }
      }

      // Nothing recognised. Escape closes a Material dialog unless it was opened
      // with disableClose, and costs nothing if it doesn't — better than leaving
      // the backdrop in place and timing out on the real action.
      await page.keyboard.press("Escape").catch(() => {
        // Page may have navigated out from under us; the action that triggered
        // this handler will report anything that actually matters.
      });
    },
    // No noWaitAfter: we *want* Playwright to confirm the backdrop has gone
    // before it resumes the action it interrupted. If dismissal genuinely failed,
    // an error naming the backdrop is a far better clue than the click timeout
    // this function exists to prevent.
  );
}
