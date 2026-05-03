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

  constructor(page: Page) {
    this.page = page;
    this.telephoneLink = page.locator('a[action="telephone"]');
    this.externalManufacturerLink = page.getByRole("button", {
      name: "Contact manufacturer",
    });
    this.navigationTabs = page.locator(".mat-mdc-tab-links");
    this.localeLabel = page.getByRole("button", { name: "Choose location and language" });
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
  async verifyTelNo(telNo: string): Promise<void> {
    // await this.page.screenshot({ path: "telephoneLink.png" });
    await playwrightExpect(this.telephoneLink).toBeVisible({ timeout: 10000 });
    await playwrightExpect(this.telephoneLink).toHaveText(telNo, {
      timeout: 10000,
    });
    await playwrightExpect(this.telephoneLink).toHaveAttribute(
      "href",
      `tel:${telNo}`,
      { timeout: 10000 },
    );
  }

  // Verifies the Contact manufacturer button is visible and displays the correct text.
  // The href assertion is commented out because the button uses a click handler
  // rather than a standard anchor href.
  async verifyExternalManufacturerLink(expectedLink: string): Promise<void> {
    // await this.page.screenshot({ path: "externalManufacturerLink.png" });
    await playwrightExpect(this.externalManufacturerLink).toBeVisible({
      timeout: 10000,
    });
    await playwrightExpect(this.externalManufacturerLink).toHaveText(
      " Contact manufacturer ",
      { timeout: 10000 },
    );
    // await playwrightExpect(this.externalManufacturerLink).toHaveAttribute('href', expectedLink, { timeout: 10000 });
  }

  // Verifies the navigation bar is visible, that each expected tab is present,
  // and that they appear in the correct order.
  async verifyDysonNavigationBar(): Promise<void> {
    await playwrightExpect(this.navigationTabs).toBeVisible();

    const tabNames = [
      "Overview",
      "Products",
      "Certifications",
      "Literature",
      "Case studies",
      "About us",
    ];

    // Grab all anchor elements within the nav container and read their text in DOM order.
    const allTabs = this.navigationTabs.locator("a");
    // console.log(allTabs)
    const actualTabs = await allTabs.allInnerTexts();
    // console.log(actualTabs);
    // Strip surrounding whitespace from each tab label before comparing.
    const trimmedTabs = actualTabs.map((t) => t.trim());
    // console.log(trimmedTabs);

    // Loop through each expected tab name by its position (index).
    // i starts at 0 (first tab) and increments by 1 each iteration until
    // all expected tabs have been checked.
    for (let i = 0; i < tabNames.length; i++) {
      // Compare the actual tab at this position against the expected tab name.
      // If they don't match, the tab is either wrong or in the wrong order.
      if (trimmedTabs[i] !== tabNames[i]) {
        // i + 1 is used in the message so the position is human-readable (1-based, not 0-based).
        throw new Error(
          `Tab order mismatch at position ${i + 1}: expected "${tabNames[i]}" but found "${trimmedTabs[i]}"`
        );
      }
    }
  }
}