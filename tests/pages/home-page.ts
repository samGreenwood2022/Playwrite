// home-page.ts — Page Object Model for the NBS Source homepage.
//
// Handles navigation to the NBS Source homepage and the search interaction
// needed to reach a manufacturer page. The search logic uses fast-fail
// detection of the autocomplete dropdown with an in-page retype recovery
// before falling back to a full page reload, because the site's autocomplete
// is intermittently slow / sometimes fails to open on the live site.

import { Page, Locator } from "@playwright/test";
import { expect as playwrightExpect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import fs from "fs";
import { createHtmlReport } from "axe-html-reporter";

export class HomePage {
  readonly page: Page;
  readonly searchField: Locator;
  readonly searchButton: Locator;
  readonly acceptCookiesButton: Locator;
  readonly searchAutocomplete: Locator;
  readonly dysonManufacturerOption: Locator;
  readonly nbsLogoLink: Locator;

  constructor(page: Page) {
    this.page = page;
    // Uses the data-cy attribute for a stable, test-specific selector.
    // .last() is used because the search field appears twice in the DOM (mobile + desktop).
    this.searchField = page.locator('[data-cy="searchFieldSearch"]').last();
    this.searchButton = page.locator('[data-cy="searchButton"]').last();
    // The autocomplete dropdown overlay container. Anchored on the Angular
    // component selector rather than the dynamic #cdk-overlay-N id so we can
    // detect "did the dropdown actually open?" without brittle id matching.
    this.searchAutocomplete = page.locator("app-autocomplete");
    // The Dyson result inside the dropdown's "Manufacturers" section
    // specifically. The four "Dyson <product>" results below it sit in
    // article.products-section, so scoping to article.manufacturers + the
    // /manufacturer/dyson/ href pattern leaves exactly one match.
    this.dysonManufacturerOption = page.locator(
      'app-autocomplete article.manufacturers a[href*="/manufacturer/dyson/"]',
    );
    this.acceptCookiesButton = page.getByRole("button", {
      name: "Accept All Cookies",
    });
    this.nbsLogoLink = page.locator(
      'app-product-logo-with-name a:has(app-name:text("NBS Source"))',
    );
  }

  // Searches for the given term and clicks the matching Dyson manufacturer
  // entry in the autocomplete dropdown. Reflects the real user journey of
  // typing and clicking a result rather than navigating directly to the URL.
  //
  // Reliability strategy (per attempt, up to 3 attempts):
  //   1. Focus the field and clear it with fill("") — more reliable than
  //      Control+a + type, which can leave residual characters if focus drifts.
  //   2. Type the term character-by-character to trigger the site's
  //      autocomplete debounce.
  //   3. Wait up to 5s for the dropdown CONTAINER (app-autocomplete) to
  //      appear. Failing fast on this — instead of waiting 20s for the result
  //      item — is what lets us recover within the Cucumber step timeout.
  //   4. If the dropdown didn't open, do a cheap in-page nudge: clear and
  //      retype, then re-wait. Many "didn't open" cases are first-keystroke
  //      debounce races and resolve on a clean retype without a full reload.
  //   5. Race the click against a URL waiter so a no-op click (dropdown closes
  //      without navigating) throws instead of silently passing. Reload the
  //      page only as a last-resort recovery between attempts.
  async searchFor(term: string) {
    const maxAttempts = 3;
    const dropdownTimeout = 5000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.page.waitForLoadState("domcontentloaded", {
          timeout: 15000,
        });

        await this.searchField.click();
        await this.searchField.fill("");
        await this.searchField.pressSequentially(term, { delay: 100 });

        try {
          await this.searchAutocomplete.waitFor({
            state: "visible",
            timeout: dropdownTimeout,
          });
        } catch {
          // In-page recovery: clear and retype before falling back to reload.
          await this.searchField.fill("");
          await this.searchField.pressSequentially(term, { delay: 100 });
          await this.searchAutocomplete.waitFor({
            state: "visible",
            timeout: dropdownTimeout,
          });
        }

        await Promise.all([
          this.page.waitForURL(/\/manufacturer\/dyson\//, { timeout: 30000 }),
          this.dysonManufacturerOption.click({ timeout: 10000 }),
        ]);
        return;
      } catch (error) {
        console.warn(`Attempt ${attempt} to search for "${term}" failed:`, error);
      }

      if (attempt < maxAttempts && !this.page.isClosed()) {
        await this.page.reload({
          waitUntil: "domcontentloaded",
          timeout: 20000,
        });
      }
    }

    throw new Error(
      `Failed to find and click the "${term}" search result after ${maxAttempts} attempts (with page reloads).`,
    );
  }

  // Navigates directly to the NBS Source homepage and waits for the DOM to be ready.
  // The cookie banner handling is commented out as it is not consistently present.
  async navigateToNBSHomepage() {
    await this.page.goto("https://source.thenbs.com/en/", {
      timeout: 60000,
      waitUntil: "domcontentloaded",
    });
    // try {
    //   // Wait for the Accept Cookies button to be visible (max 60s)
    //   await this.acceptCookiesButton.waitFor({
    //     state: "visible",
    //     timeout: 60000,
    //   });
    //   await this.page.screenshot({ path: "cookies-banner.png" });
    //   await this.acceptCookiesButton.click({ timeout: 60000 });
    //   await this.acceptCookiesButton.waitFor({
    //     state: "hidden",
    //     timeout: 60000,
    //   });
    // } catch (error) {
    //   console.warn(
    //     "Cookies button not found, not visible, or could not be clicked.",
    //     error,
    //   );
    // }
  }

  // Verifies the NBS Source logo anchor has the expected href attribute value.
  async logoHref(href: string) {
    await playwrightExpect(this.nbsLogoLink).toHaveAttribute("href", href);
  }

  // Runs an Axe accessibility scan against the current page and writes the
  // results to reports/accessibility-report.html. Violations are also printed to the console.
  async generateAccessibilityReport() {
    console.log("Generating accessibility report...");
    const accessibilityScanResults = await new AxeBuilder({
      page: this.page,
    }).analyze();
    const html = createHtmlReport({ results: accessibilityScanResults });
    fs.mkdirSync("reports", { recursive: true });
    fs.writeFileSync("reports/accessibility-report.html", html);
    console.log(accessibilityScanResults.violations);
  }
}
