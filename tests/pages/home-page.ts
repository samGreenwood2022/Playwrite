// home-page.ts — page object for the NBS Source homepage.
//
// Handles going to the homepage and using the search box to reach a
// manufacturer page. The search is built to cope with a flaky live site: the
// autocomplete dropdown is sometimes slow or doesn't open, so the code checks
// quickly for it, retypes in the box to nudge it, and only reloads the whole
// page as a last resort.

import { Page, Locator } from "@playwright/test";

// How long to allow for Angular to render the homepage header after the initial
// document has loaded. Generous on purpose: this covers app startup on a CI
// runner that's running four browsers at once, and it only ever waits as long as
// it actually takes.
const HEADER_RENDER_TIMEOUT_MS = 30000;

export class HomePage {
  readonly page: Page;
  readonly searchField: Locator;
  readonly searchButton: Locator;
  readonly searchAutocomplete: Locator;
  readonly dysonManufacturerOption: Locator;
  // The four areas of the homepage whose content changes on every load: three
  // sponsored ad slots and the "Find some inspiration" grid. A full-page visual
  // screenshot can never match a fixed baseline across these, so they're passed
  // to verifyVisualRegression as masks — Playwright paints each one a flat
  // colour before capturing, so the comparison ignores what's inside them while
  // still checking that the box is the same size and in the same place.
  //
  // Each is the section-level component rather than the individual tiles inside
  // it: fewer boxes to line up, and it also covers the rotating "Sponsored by
  // <brand>" heading that sits above the tiles.
  readonly sponsoredBrands: Locator;
  readonly sponsoredProducts: Locator;
  readonly sponsoredCpd: Locator;
  readonly inspirationGrid: Locator;

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
    // Angular component tags, which are far more stable than the generated
    // class names alongside them (.ng-star-inserted, .ng-tns-c2177291178-0 —
    // those change whenever the app is rebuilt).
    this.sponsoredBrands = page.locator("app-sponsored-brands");
    this.sponsoredProducts = page.locator("app-sponsored-products");
    this.sponsoredCpd = page.locator("app-sponsored-cpd");
    this.inspirationGrid = page.locator("app-inspiration-grid");
  }

  // All the dynamic regions in one list, ready to hand to
  // verifyVisualRegression. Kept here next to the locators so the visual test's
  // step definition doesn't have to know which sections of this page happen to
  // be ad slots — if the site adds another one, it's a one-line change here.
  get dynamicRegions(): Locator[] {
    return [
      this.sponsoredBrands,
      this.sponsoredProducts,
      this.sponsoredCpd,
      this.inspirationGrid,
    ];
  }

  // Types the given term, presses Enter, opens the Manufacturers tab and clicks
  // the Dyson result. This copies what a real user does rather than jumping
  // straight to the manufacturer URL.
  //
  // The wait after the final click is the important part, and it is not
  // optional. Playwright's auto-waiting covers the *click* — is the element
  // present, stable, enabled — and stops the instant the click lands. It knows
  // nothing about the navigation that click sets off. This site makes that gap
  // unusually wide and unusually misleading: clicking the tile first rewrites
  // the URL you're already on with a relevance score
  //
  //   .../search-results/manufacturers?search=Dyson&score=44.29
  //
  // and only routes on to
  //
  //   .../manufacturer/dyson/<id>/overview
  //
  // a few hundred milliseconds later. So for that window the page has a URL
  // that has visibly changed — it just hasn't changed to the destination.
  //
  // Without this wait the method returns mid-route, and anything reading
  // page.url() immediately afterwards records the search-results URL instead of
  // the manufacturer one. page.url() is a plain synchronous snapshot with no
  // retry, so it takes whatever is there at that microsecond. That is what made
  // the sign-in scenario flaky: it captures the URL before signing in to check
  // the user is returned to the page they started on, and was sometimes
  // capturing a page they were never really on.
  //
  // Waiting on the URL rather than a load state is deliberate. This is an
  // Angular client-side route, so there is no document load to wait for, and
  // "networkidle" never settles on this site (see CLAUDE.md).
  async searchFor(term: string) {
    await this.navigateToNBSHomepage();
    await this.page.getByRole('textbox', { name: 'Search' }).click();
    await this.page.getByRole('textbox', { name: 'Search' }).fill(term);
    await this.page.getByRole('textbox', { name: 'Search' }).press('Enter');
    await this.page.getByRole('tab', { name: 'Manufacturers' }).click();
    await this.page.getByRole('link', { name: 'Dyson Dyson Technology for' }).click();
    // Deliberately loose about the locale segment (/en/gb/) and the id in the
    // path, both of which are free to change; strict about the bit that proves
    // we've left the search results behind. Note it's "/manufacturer/" singular
    // here — the plural "/manufacturers" belongs to the search-results route,
    // so a regex using the plural would match the very page we're waiting to
    // leave.
    await this.page.waitForURL(/\/manufacturer\/dyson\//, { timeout: 30000 });
  }

  // Navigates directly to the NBS Source homepage and waits until its header has
  // rendered.
  //
  // Dismissing the consent banner and the "new feature" popup is deliberately
  // *not* done here any more. It used to be — one click({ timeout: 2000 }) per
  // overlay, immediately after navigation — and that races the site: the dialog
  // arrives at no fixed moment, so a check made here either finds nothing because
  // it's too early, or finds it by luck. On a loaded CI runner it was too early,
  // the popup stayed up for the rest of the scenario, and its backdrop swallowed
  // every subsequent click. That job now belongs to
  // dismissOverlaysAutomatically (tests/features/support/overlays.ts), which
  // registers a handler Playwright re-checks before every action, so the timing
  // stops mattering.
  //
  // What's left here is worth keeping: waitUntil "domcontentloaded" returns
  // before Angular has rendered anything, so without this wait the first locator
  // in a scenario absorbs the whole app-startup delay and reports it as its own
  // timeout.
  async navigateToNBSHomepage() {
    await this.page.goto("https://source.thenbs.com/en/gb", {
      timeout: 60000,
      waitUntil: "domcontentloaded",
    });
    // "Sign in" when signed out, "Open user menu" when a stored session loaded —
    // either proves the header is up. Note this stays true while a dialog is
    // covering the page, because the dialog sets aria-modal="false" and so hides
    // nothing from the accessibility tree; it's a render signal, not a
    // "safe to click" signal.
    await this.page
      .getByRole("button", { name: "Sign in" })
      .or(this.page.getByRole("button", { name: "Open user menu" }))
      .waitFor({ state: "visible", timeout: HEADER_RENDER_TIMEOUT_MS });
  }

}
