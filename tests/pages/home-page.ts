// home-page.ts — page object for the NBS Source homepage.
//
// Handles going to the homepage and using the search box to reach a
// manufacturer page. The search is built to cope with a flaky live site: the
// autocomplete dropdown is sometimes slow or doesn't open, so the code checks
// quickly for it, retypes in the box to nudge it, and only reloads the whole
// page as a last resort.

import { Page, Locator } from "@playwright/test";

export class HomePage {
  readonly page: Page;
  readonly searchField: Locator;
  readonly searchButton: Locator;
  readonly searchAutocomplete: Locator;
  readonly dysonManufacturerOption: Locator;

  constructor(page: Page) {
    this.page = page;
    // Uses the data-cy attribute, which is a stable selector meant for testing.
    // The site has both a mobile and a desktop copy of the search box, so we
    // keep only the visible one(s), then take .first() as a safety net in case
    // a future layout ever shows more than one at once.
    this.searchField = page
      .locator('[data-cy="searchFieldSearch"]')
      .filter({ visible: true })
      .first();
    this.searchButton = page
      .locator('[data-cy="searchButton"]')
      .filter({ visible: true })
      .first();
    // The dropdown of search suggestions. We target the component's own tag
    // rather than its auto-generated id (which changes each time), so we can
    // reliably tell whether the dropdown actually opened.
    this.searchAutocomplete = page.locator("app-autocomplete");
    // The Dyson entry in the dropdown's "Manufacturers" section. There are also
    // "Dyson <product>" results in a separate products section, so we scope to
    // the manufacturers section plus the /manufacturer/dyson/ link to match
    // exactly one.
    this.dysonManufacturerOption = page.locator(
      'app-autocomplete article.manufacturers a[href*="/manufacturer/dyson/"]',
    );
  }

  // Types the given term and clicks the matching Dyson entry in the dropdown.
  // This copies what a real user does (type, then click a result) instead of
  // jumping straight to the URL.
  //
  // Because the live site's dropdown is flaky, each attempt (up to 3) does this:
  //   1. Click the field and clear it with fill("") — more reliable than
  //      selecting all + typing, which can leave stray characters behind.
  //   2. Type the term one character at a time so the site's search reacts.
  //   3. Wait for the dropdown to appear, but only for a set time. Giving up
  //      rather than waiting forever leaves us time to recover before
  //      Cucumber's step timeout.
  //   4. If the dropdown didn't open, just clear and retype, then wait again.
  //      Often it failed only because the very first keystroke was missed, and
  //      a clean retype fixes it without reloading.
  //   5. Click the result while also waiting for the URL to change, so a click
  //      that does nothing (dropdown closed without navigating) fails loudly
  //      instead of passing silently. Reloading the page is the last resort.
  async searchFor(term: string) {
    // Try the whole thing up to 3 times, each time waiting a set period for the
    // dropdown to appear. If an attempt fully succeeds, we return straight away.
    const maxAttempts = 3;
    const dropdownTimeout = 30000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Wait until the page's HTML has loaded before typing — otherwise the
        // search box may not be ready for input yet and our keystrokes get lost.
        await this.page.waitForLoadState("domcontentloaded", {
          timeout: 15000,
        });

        // Click the field, clear anything left from a previous attempt, then
        // type slowly (100ms per character) so the site's search has time to
        // react. pressSequentially types one real key press at a time.
        await this.searchField.click();
        await this.searchField.fill("");
        await this.searchField.pressSequentially(term, { delay: 100 });

        // Did the dropdown actually open? We wait for the dropdown container to
        // appear. Giving up reasonably quickly here (rather than waiting on the
        // result item itself) leaves time to recover within Cucumber's timeout.
        try {
          await this.searchAutocomplete.waitFor({
            state: "visible",
            timeout: dropdownTimeout,
          });
        } catch {
          // Quick recovery: clear and retype before resorting to a reload.
          // Often the dropdown only failed because the first keystroke was
          // missed, and retyping fixes it without reloading the page.
          await this.searchField.fill("");
          await this.searchField.pressSequentially(term, { delay: 100 });
          await this.searchAutocomplete.waitFor({
            state: "visible",
            timeout: dropdownTimeout,
          });
        }

        // Click the result while also waiting for the URL to change. If the
        // click does nothing (the dropdown just closes), the URL wait fails
        // instead of the test passing by mistake. Both must start together
        // (Promise.all) so the URL wait is already listening before the click.
        await Promise.all([
          this.page.waitForURL(/\/manufacturer\/dyson\//, { timeout: 30000 }),
          this.dysonManufacturerOption.click({ timeout: 10000 }),
        ]);
        return;
      } catch (error) {
        // Don't fail yet — log a warning and let the loop try again (after a
        // reload). The warning keeps flaky-but-eventually-passing runs visible
        // in the logs so they can still be looked into.
        console.warn(`Attempt ${attempt} to search for "${term}" failed:`, error);
      }

      // Last resort between attempts: reload the page to reset whatever made
      // the dropdown misbehave. Skipped on the final attempt (nothing left to
      // retry) and if the page is already closed.
      if (attempt < maxAttempts && !this.page.isClosed()) {
        await this.page.reload({
          waitUntil: "domcontentloaded",
          timeout: 20000,
        });
      }
    }

    // Every attempt (typing, retyping, and reloading) has been used up without
    // ever reaching the Dyson manufacturer page.
    throw new Error(
      `Failed to find and click the "${term}" search result after ${maxAttempts} attempts (with page reloads).`,
    );
  }

  // Navigates directly to the NBS Source homepage and waits for the DOM to be ready.
  async navigateToNBSHomepage() {
    await this.page.goto("https://source.thenbs.com/en/", {
      timeout: 60000,
      waitUntil: "domcontentloaded",
    });
  }

}
