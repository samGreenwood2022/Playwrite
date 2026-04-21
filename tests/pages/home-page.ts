// home-page.ts — Page Object Model for the NBS Source homepage.
//
// Handles navigation to the NBS Source homepage and the search interaction
// needed to reach a manufacturer page. The search logic includes retry and
// refresh behaviour because the site's autocomplete can be flaky on first load.

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
  readonly selectSearchResult: Locator;
  readonly nbsLogoLink: Locator;

  constructor(page: Page) {
    this.page = page;
    // Uses the data-cy attribute for a stable, test-specific selector.
    // .last() is used because the search field appears twice in the DOM (mobile + desktop).
    this.searchField = page.locator('[data-cy="searchFieldSearch"]').last();
    this.searchButton = page.locator('[data-cy="searchButton"]').last();
    // Matches the exact text "Dyson" in the autocomplete dropdown to avoid partial matches.
    this.selectSearchResult = page.locator("a").filter({ hasText: /^Dyson$/ });
    this.acceptCookiesButton = page.getByRole("button", {
      name: "Accept All Cookies",
    });
    this.nbsLogoLink = page.locator(
      'app-product-logo-with-name a:has(app-name:text("NBS Source"))',
    );
  }

  // Searches for the given term and clicks the matching autocomplete result.
  // Retries up to 3 times with a page reload between attempts to handle cases
  // where the autocomplete dropdown fails to appear on the first load.
  async searchFor(term: string) {
    const maxAttempts = 3;
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt++;
      try {
        await this.page.waitForLoadState("domcontentloaded", {
          timeout: 15000,
        });

        // Selects all existing text before typing to avoid appending to a previous search.
        // Types character-by-character with a 150ms delay to trigger the site's autocomplete debounce.
        await this.searchField.click();
        await this.searchField.press('Control+a');
        await this.page.keyboard.type(term, { delay: 150 });
        await this.page.waitForTimeout(600);

        await this.selectSearchResult.waitFor({
          state: "visible",
          timeout: 20000,
        });

        if (await this.selectSearchResult.isVisible()) {
          // Clicks 10px from the left edge to avoid hitting any icons within the result element.
          const box = await this.selectSearchResult.boundingBox();
          if (box) {
            await this.selectSearchResult.click({
              position: { x: 10, y: box.height / 2 },
              timeout: 20000,
            });
            await this.page.waitForLoadState("networkidle", { timeout: 30000 });
          } else {
            throw new Error(
              "Could not find bounding box for Dyson search result",
            );
          }
          return;
        }
      } catch (error) {
        console.warn(`Attempt ${attempt} failed:`, error);
      }

      // Reloads the page before the next attempt if the dropdown did not appear.
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

  // Waits for the first autocomplete result to appear then clicks it.
  // Used as a simpler alternative to searchFor when retry logic is not needed.
  async selectSearchResultFromDropdown() {
    await this.selectSearchResult.waitFor({ state: "visible", timeout: 10000 });
    await this.selectSearchResult.click({ force: true });
  }

  // Verifies the NBS Source logo anchor has the expected href attribute value.
  async logoHref(href: string) {
    await playwrightExpect(this.nbsLogoLink).toHaveAttribute("href", href);
  }

  // Runs an Axe accessibility scan against the current page and writes the
  // results to axe-report.html. Violations are also printed to the console.
  async generateAccessibilityReport() {
    console.log("Generating accessibility report...");
    const accessibilityScanResults = await new AxeBuilder({
      page: this.page,
    }).analyze();
    const html = createHtmlReport({ results: accessibilityScanResults });
    fs.writeFileSync("axe-report.html", html);
    console.log(accessibilityScanResults.violations);
  }
}
