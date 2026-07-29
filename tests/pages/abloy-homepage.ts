// abloy-homepage.ts — page object for the Abloy UK manufacturer page on NBS Source.
//
// Follows the same design pattern as dyson-homepage.ts: it holds the checks
// specific to the Abloy UK page — verifying UI elements, a test that calls the
// OneTrust geolocation API, and checking the navigation bar.
//
// Note on scope: unlike the Dyson page, Abloy UK's manufacturer page has no
// "Certifications" tab (its nav shows a "CPD" tab instead) and no "Certification
// bodies" section on the Overview. The Dyson page object's certifications / 500-
// error methods therefore don't apply here and have deliberately been left out
// rather than cloned onto locators that would never resolve. If we later want to
// cover the CPD tab's data behaviour, add it here as its own set of methods.

import { Page, Locator } from "@playwright/test";
import { expect as playwrightExpect } from "@playwright/test";

// The Abloy UK manufacturer Overview page. Kept as a constant so the navigate
// method and any URL assertions share one source of truth.
const ABLOY_OVERVIEW_URL =
  "https://source.thenbs.com/en/gb/manufacturer/abloy-uk/nbAnmJUFmBRb9A2M4g4Gpz/overview";

export class AbloyHomepage {
  readonly page: Page;
  // The telephone link. We target it by its action attribute rather than its
  // href or text, because that's less likely to change when content is updated.
  readonly telephoneLink: Locator;
  readonly externalManufacturerLink: Locator;
  // Targets the tab strip container — individual tabs are queried from within it.
  readonly navigationTabs: Locator;
  readonly localeLabel: Locator;
  // The page's main heading ("Abloy UK"). Used as a "real content has rendered"
  // anchor: the Dyson page waits on its "Certification bodies" section for this,
  // but Abloy's Overview has no such section, so we wait on the h1 instead.
  readonly pageHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.telephoneLink = page.locator('a[action="telephone"]');
    this.externalManufacturerLink = page.getByRole("button", {
      name: "Contact manufacturer",
    });
    this.navigationTabs = page.locator(".mat-mdc-tab-links");
    this.localeLabel = page.getByRole("button", {
      name: "Choose location and language",
    });
    this.pageHeading = page.getByRole("heading", { name: "Abloy UK", level: 1 });
  }

  // Navigates directly to the Abloy UK manufacturer Overview page, waits for the
  // DOM to be ready, then clears the cookie / "new feature" overlays if the site
  // shows them. This mirrors HomePage.navigateToNBSHomepage: because the context
  // is fresh per scenario, those overlays can appear on a direct manufacturer
  // navigation too, so we dismiss them here in one place. Each click is wrapped
  // in a short-timeout try/catch so a run where an overlay isn't shown simply
  // moves on rather than failing.
  async navigateToAbloyHomepage(): Promise<void> {
    await this.page.goto(ABLOY_OVERVIEW_URL, {
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

  // Makes a real request to the OneTrust geolocation API and checks the API
  // response and the UI's locale label agree. The response comes wrapped in a
  // JSONP callback (jsonFeed({...})), so we use a regex to pull out the JSON
  // inside before parsing it.
  async verifyUIandAPIContent() {
    const response = await this.page.request.get(
      "https://geolocation.onetrust.com/cookieconsentpub/v1/geo/location",
      {
        ignoreHTTPSErrors: true,
      },
    );

    // Confirms the API is reachable and returning a successful response.
    playwrightExpect(response.status()).toBe(200);

    const text = await response.text();

    // Strips the JSONP wrapper to get the raw JSON object.
    const match = text.match(/jsonFeed\((.*)\);?/);
    if (!match) {
      throw new Error("Unexpected response format");
    }
    const body = JSON.parse(match[1]);

    // Validates the detected country is one of the expected values for this test environment.
    playwrightExpect(["GB", "US"]).toContain(body.country);

    // Verifies the UI reflects the correct locale — expected to show "UK" for GB users.
    await playwrightExpect(this.localeLabel).toContainText("UK");
    await playwrightExpect(this.localeLabel).toBeVisible();
  }

  // Verifies the telephone link is visible, displays the correct number,
  // and uses the tel: protocol in its href so clicking it triggers a phone call.
  async verifyTelNo(telNo: string, expectedHref: string): Promise<void> {
    await playwrightExpect(this.telephoneLink).toBeVisible({ timeout: 10000 });
    await playwrightExpect(this.telephoneLink).toHaveText(telNo, {
      timeout: 10000,
    });
    await playwrightExpect(this.telephoneLink).toHaveAttribute(
      "href",
      expectedHref,
      { timeout: 10000 },
    );
  }

  // Verifies the Contact manufacturer button is visible and displays the correct text.
  // The href assertion is commented out because the button uses a click handler
  // rather than a standard anchor href (same behaviour as the Dyson page).
  async verifyExternalManufacturerLink(_expectedLink: string): Promise<void> {
    // _expectedLink isn't used yet — the _ prefix tells the linter that's on
    // purpose. It'll be used by the commented-out href check below once the
    // button becomes a normal link instead of using a click handler.
    await playwrightExpect(this.externalManufacturerLink).toBeVisible({
      timeout: 10000,
    });
    await playwrightExpect(this.externalManufacturerLink).toHaveText(
      " Contact manufacturer ",
      { timeout: 10000 },
    );
    // await playwrightExpect(this.externalManufacturerLink).toHaveAttribute('href', _expectedLink, { timeout: 10000 });
  }

  // Checks the Contact manufacturer button shows exactly the text passed in.
  // It's separate from verifyExternalManufacturerLink because here the expected
  // text comes from the feature file (scenarios can pass different text),
  // whereas that method always checks for "Contact manufacturer".
  async verifyContactButtonText(expectedText: string): Promise<void> {
    await playwrightExpect(this.externalManufacturerLink).toHaveText(
      expectedText,
    );
  }

  // Verifies the Abloy UK manufacturer page's core content renders: the nav tab
  // strip, the Contact manufacturer button, and the "Abloy UK" heading. Used to
  // prove the page shell plus real heading content has loaded (the counterpart
  // to the Dyson page's core-content check, which waits on its Certifications
  // "Certification bodies" section — a section Abloy's Overview doesn't have).
  async verifyCoreContentRenders(): Promise<void> {
    await playwrightExpect(this.navigationTabs).toBeVisible();
    await playwrightExpect(this.externalManufacturerLink).toBeVisible({
      timeout: 10000,
    });
    await playwrightExpect(this.pageHeading).toBeVisible({ timeout: 10000 });
  }

  // Verifies the navigation bar is visible, that each expected tab is present in the
  // correct order, and that each links to the correct href. The expected labels and
  // hrefs are passed in from the feature file's data table rather than hardcoded here.
  async verifyAbloyNavigationBar(
    tabs: { label: string; href: string }[],
  ): Promise<void> {
    await playwrightExpect(this.navigationTabs).toBeVisible();

    // Grab all anchor elements within the nav container, in DOM order.
    const allTabs = this.navigationTabs.locator("a");

    // Fail fast if the bar has a different number of tabs than expected — this
    // catches added/removed tabs that a per-position label check alone would miss.
    await playwrightExpect(allTabs).toHaveCount(tabs.length);

    // Strip surrounding whitespace from each tab label before comparing.
    const actualLabels = (await allTabs.allInnerTexts()).map((t) => t.trim());

    // Loop through each expected tab by its position (index). i starts at 0 (first
    // tab) and increments by 1 each iteration until all expected tabs are checked.
    for (let i = 0; i < tabs.length; i++) {
      // Compare the actual tab at this position against the expected label.
      // If they don't match, the tab is either wrong or in the wrong order.
      if (actualLabels[i] !== tabs[i].label) {
        // i + 1 is used in the message so the position is human-readable (1-based, not 0-based).
        throw new Error(
          `Tab order mismatch at position ${i + 1}: expected "${tabs[i].label}" but found "${actualLabels[i]}"`,
        );
      }

      // Verify the tab at this position links to the expected href.
      await playwrightExpect(allTabs.nth(i)).toHaveAttribute(
        "href",
        tabs[i].href,
      );
    }
  }
}
