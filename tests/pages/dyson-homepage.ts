// dyson-homepage.ts — page object for the Dyson manufacturer page on NBS Source.
//
// Holds the checks specific to the Dyson page: verifying UI elements, a test
// that calls the OneTrust geolocation API, and checking the navigation bar.

import { Page, Locator } from "@playwright/test";
import { expect as playwrightExpect } from "@playwright/test";

export class DysonHomepage {
  readonly page: Page;
  // The telephone link. We target it by its action attribute rather than its
  // href or text, because that's less likely to change when content is updated.
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
  // The Certifications tab's content area, and the results wrapper inside it
  // that holds EITHER the result tiles or the "no results" message. The content
  // area always appears when the tab opens; the wrapper only appears if the
  // request succeeds — so if the wrapper is missing, we know the request
  // errored (a 500).
  readonly certificateList: Locator;
  readonly searchResultWrapper: Locator;
  // The "Certification bodies" section shown on the Overview tab. It's fetched
  // and rendered asynchronously, a fraction of a second after the page shell —
  // so anything that needs to see it must wait for it explicitly rather than
  // assume it's there as soon as the tabs and buttons appear.
  readonly certificationBodiesSection: Locator;

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
    this.certificationBodiesSection = page.getByText("Certification bodies");
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

  // Opens the Certifications tab and waits for its data request to come back.
  // We wait for the network response (recognised by "paginatedResponse" in the
  // request) rather than for a specific element, so this works for all three
  // possible outcomes: results shown, no results shown, or a 500 error (where
  // nothing renders). Each outcome's own verify method then checks what appeared.
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

  // Opens the Certifications tab when its data request is expected to FAIL at
  // the network level (e.g. an aborted / dropped connection). The normal open
  // waits for a successful response, which never arrives here — so instead we
  // wait for the tiles request to *fail*. Without this the click would just hang
  // until the step times out.
  async openCertificationsTabExpectingFailure(): Promise<void> {
    const tileRequestFailed = this.page.waitForEvent("requestfailed", {
      predicate: (request) =>
        request.url().includes("api.source.thenbs.com/graphql") &&
        (request.postData() || "").includes("paginatedResponse"),
      timeout: 30000,
    });
    await this.certificationsTab.click();
    await tileRequestFailed;
  }

  // Verifies the Certifications tab renders its results normally. Used by the
  // slow-network scenario to prove the tab waits for a slow backend and still
  // shows its tiles rather than erroring or giving up.
  async verifyCertificationsRender(): Promise<void> {
    await playwrightExpect(this.searchResultWrapper).toBeVisible();
    await playwrightExpect(this.certificationTileTitles.first()).toBeVisible();
  }

  // Verifies the tab opened but rendered no result tiles. Used by the
  // dropped-connection and malformed-payload scenarios: in both, the backing
  // request never yields usable data, so the tab's content area appears but no
  // certification tiles do. We assert the tab navigated (content area attached)
  // and that zero tiles rendered — without asserting any specific empty/error
  // styling, because the app gives no explicit feedback in these states (the
  // same blank, unhandled behaviour the 500 scenario documents).
  async verifyNoCertificationTiles(): Promise<void> {
    await playwrightExpect(this.certificateList).toBeAttached();
    await playwrightExpect(this.certificationTileTitles).toHaveCount(0);
  }

  // Verifies the Dyson manufacturer page's core content still renders when all
  // analytics / consent / third-party requests are blocked — proving the page
  // doesn't depend on that non-essential traffic to function.
  //
  // As well as the page shell (nav tabs + Contact button, which appear almost
  // immediately) we wait for the Overview's "Certification bodies" section. That
  // section is fetched asynchronously a moment later, so waiting for it both
  // strengthens the check (real content, not just the shell, survives blocking)
  // and keeps it in the trace — without the wait the scenario finished and the
  // browser closed before the section had rendered.
  async verifyCoreContentRenders(): Promise<void> {
    await playwrightExpect(this.navigationTabs).toBeVisible();
    await playwrightExpect(this.externalManufacturerLink).toBeVisible({
      timeout: 10000,
    });
    await playwrightExpect(this.certificationBodiesSection).toBeVisible({
      timeout: 10000,
    });
  }

  // Checks the first certification tile shows the expected title. toHaveText
  // ignores surrounding spaces, so the tile's padded " ... " text still matches
  // the trimmed expected text.
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

  // Checks how the app behaves when the certifications request returns a 500.
  // What actually happens: the tab opens and its content area appears, but the
  // results wrapper (which normally holds either the tiles or the "no results"
  // message) never shows up — so the user just sees a blank panel with no tiles,
  // no "no results" message, and no error message. We check for exactly that,
  // which also keeps this distinct from the "has results" and "no results" states.
  async verifyCertificationsServerError(): Promise<void> {
    // The tab itself loaded — navigation to the Certifications panel succeeded.
    await playwrightExpect(this.certificateList).toBeAttached();
    // The results wrapper never renders because the backing request errored.
    await playwrightExpect(this.searchResultWrapper).toHaveCount(0);
    // No result tiles — and importantly no "no results" message either. This is
    // a blank, unhandled state, not the normal "no results" one.
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