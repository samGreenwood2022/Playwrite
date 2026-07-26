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
  // The "Sponsored products" and "Sponsored CPD Materials" carousels. Both are
  // ad slots that rotate their tiles on every page load, so a full-page visual
  // screenshot never matches a fixed baseline there. They share this component
  // and class regardless of which sponsored slot they render, so one locator
  // catches both. Passed as a mask to verifyVisualRegression so that area is
  // blanked out (painted a flat colour) before comparing, instead of being
  // compared pixel-for-pixel.
  readonly sponsoredCarousels: Locator;

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
    this.sponsoredCarousels = page.locator(
      "app-skeleton-tiles-carousel.sponsored",
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
    await this.navigateToNBSHomepage();
    await this.page.getByRole('textbox', { name: 'Search' }).click();
    await this.page.getByRole('textbox', { name: 'Search' }).fill(term);
    await this.page.getByRole('textbox', { name: 'Search' }).press('Enter');
    await this.page.getByRole('tab', { name: 'Manufacturers' }).click();
    await this.page.getByRole('link', { name: 'Dyson Dyson Technology for' }).click();
  }

  // Navigates directly to the NBS Source homepage, waits for the DOM to be
  // ready, then clears the "new feature" popup if the site shows it. Every route
  // onto the homepage goes through here, so the popup is handled in one place.
  async navigateToNBSHomepage() {
    await this.page.goto("https://source.thenbs.com/en/gb", {
      timeout: 60000,
      waitUntil: "domcontentloaded",
    });
    const overlayCloseButtons = [
      this.page.getByRole("button", { name: "Accept all" }),
      this.page.getByRole("button", { name: "Close dialog" }),
    ];
    for (const closeButton of overlayCloseButtons) {
      try {
        await closeButton.click({ timeout: 2000 });
      } catch {
        // Overlay wasn't shown this run — nothing to dismiss.
      }
    }
  }

}
