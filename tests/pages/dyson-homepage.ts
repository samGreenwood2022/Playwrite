// dyson-homepage.ts — Page Object Model for the Dyson manufacturer page on NBS Source.
//
// Handles all assertions specific to the Dyson manufacturer page, including
// UI element verification, an API test against the OneTrust geolocation endpoint,
// and navigation bar validation.

import { Page, Locator } from "@playwright/test";
import { expect as playwrightExpect } from "@playwright/test";

export class DysonHomepage {
  readonly page: Page;
  // Targets the telephone link using the action attribute rather than href or text,
  // as it is a more stable selector that is less likely to change with content updates.
  readonly telephoneLink: Locator;
  readonly externalManufacturerLink: Locator;
  // Targets the tab strip container — individual tabs are queried from within it.
  readonly navigationTabs: Locator;
  readonly localeLabel: Locator;
  // The Certifications tab in the manufacturer navigation bar, and the titles
  // of the certification result tiles it shows.
  readonly certificationsTab: Locator;
  readonly certificationTileTitles: Locator;
  // The empty-state panel shown when a search (e.g. the Certifications tab)
  // returns no results.
  readonly noResultsGuidance: Locator;
  // The Certifications tab content container, and the results wrapper inside it
  // that holds EITHER the result tiles or the no-results empty-state. The list
  // container always renders once the tab is open; the wrapper only renders
  // when the backing request resolves successfully, so its absence is how we
  // detect the server-error (500) state.
  readonly certificateList: Locator;
  readonly searchResultWrapper: Locator;

  constructor(page: Page) {
    this.page = page;
    this.telephoneLink = page.locator('a[action="telephone"]');
    this.externalManufacturerLink = page.getByRole("button", {
      name: "Contact manufacturer",
    });
    this.navigationTabs = page.locator(".mat-mdc-tab-links");
    this.localeLabel = page.getByRole("button", { name: "Choose location and language" });
    this.certificationsTab = page.locator('a[data-cy="certificatesTab"]');
    this.certificationTileTitles = page.locator(
      '[data-cy="searchResultTileTitle"]',
    );
    this.noResultsGuidance = page.locator("app-no-results-guidance");
    this.certificateList = page.locator("app-certificate-list");
    this.searchResultWrapper = page.locator("app-search-result-wrapper");
  }

  // Makes a real HTTP request to the OneTrust geolocation API and verifies both
  // the API response and the corresponding UI locale label are consistent.
  // The response is wrapped in a JSONP callback (jsonFeed({...})) so a regex is
  // used to extract the JSON body before parsing.
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
    // await this.page.screenshot({ path: "telephoneLink.png" });
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
  // rather than a standard anchor href.
  async verifyExternalManufacturerLink(_expectedLink: string): Promise<void> {
    // _expectedLink is currently unused — prefixed with _ to silence the
    // no-unused-vars rule. It will be wired into the commented-out href
    // assertion below once the button switches from a click handler to a
    // standard anchor href.
    await playwrightExpect(this.externalManufacturerLink).toBeVisible({
      timeout: 10000,
    });
    await playwrightExpect(this.externalManufacturerLink).toHaveText(
      " Contact manufacturer ",
      { timeout: 10000 },
    );
    // await playwrightExpect(this.externalManufacturerLink).toHaveAttribute('href', _expectedLink, { timeout: 10000 });
  }

  // Verifies the Contact manufacturer button displays the exact text passed in.
  // Separate from verifyExternalManufacturerLink because this assertion is
  // parameterised by the feature file (different scenarios may pass different
  // expected strings) whereas the other locks the text to "Contact manufacturer".
  async verifyContactButtonText(expectedText: string): Promise<void> {
    await playwrightExpect(this.externalManufacturerLink).toHaveText(
      expectedText,
    );
  }

  // Opens the Certifications tab and waits for the panel's backing request to
  // settle. We wait on the GraphQL tile response — identified by the
  // "paginatedResponse" selection in its query body — rather than a specific
  // DOM element, so the method works for ALL three outcomes without relying on
  // a timeout: populated (tiles render), empty (no-results renders), and the
  // server-error 500 (neither renders). Each outcome's verify method then
  // asserts the rendered state with auto-waiting assertions.
  async openCertificationsTab(): Promise<void> {
    const tileResponse = this.page.waitForResponse(
      (resp) =>
        resp.url().includes("api.source.thenbs.com/graphql") &&
        (resp.request().postData() || "").includes("paginatedResponse"),
      { timeout: 30000 },
    );
    await this.certificationsTab.click();
    await tileResponse;
  }

  // Verifies the first certification result tile shows the expected title.
  // toHaveText normalises surrounding whitespace, so the tile's padded " ... "
  // text matches the trimmed expected string.
  async verifyFirstCertificationTile(expectedTitle: string): Promise<void> {
    await playwrightExpect(this.certificationTileTitles.first()).toHaveText(
      expectedTitle,
    );
  }

  // Verifies the Certifications tab shows the empty state: the no-results panel
  // is visible and no result tiles are rendered.
  async verifyNoCertificationResults(): Promise<void> {
    await playwrightExpect(this.noResultsGuidance).toBeVisible();
    await playwrightExpect(this.noResultsGuidance).toContainText(
      "Sorry, no results were found",
    );
    await playwrightExpect(this.certificationTileTitles).toHaveCount(0);
  }

  // Verifies how the app handles a 500 on the certifications request. Observed
  // behaviour: the tab navigates and its list container renders, but the
  // results wrapper that normally holds EITHER the tiles or the no-results
  // empty-state never appears — so the user sees a blank panel with no tiles,
  // no empty-state guidance, and no explicit error message. We assert exactly
  // that, which also distinguishes the error state from both the populated and
  // the (graceful) empty states.
  async verifyCertificationsServerError(): Promise<void> {
    // The tab itself loaded — navigation to the Certifications panel succeeded.
    await playwrightExpect(this.certificateList).toBeAttached();
    // The results wrapper never renders because the backing request errored.
    await playwrightExpect(this.searchResultWrapper).toHaveCount(0);
    // No result tiles, and crucially NOT the graceful empty-state either —
    // this is a distinct, unhandled blank state rather than "no results".
    await playwrightExpect(this.certificationTileTitles).toHaveCount(0);
    await playwrightExpect(this.noResultsGuidance).toHaveCount(0);
  }

  // Verifies the navigation bar is visible, that each expected tab is present in the
  // correct order, and that each links to the correct href. The expected labels and
  // hrefs are passed in from the feature file's data table rather than hardcoded here.
  async verifyDysonNavigationBar(
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