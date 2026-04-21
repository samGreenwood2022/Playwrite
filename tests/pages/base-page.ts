// base-page.ts — Base Page Object Model shared across all pages.
//
// Contains locators and methods that are common to every page in the test suite.
// Other page objects do not extend this class — they are instantiated separately
// and used alongside it. Any assertion or action that applies site-wide (URL checks,
// page title, logo, accessibility) belongs here rather than in a specific page object.

import { Page, Locator, expect } from "@playwright/test";
import { expect as playwrightExpect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import fs from "fs";
import { createHtmlReport } from "axe-html-reporter";

export class BasePage {
  readonly page: Page;
  readonly h1: Locator;
  // Targets the NBS Source logo link using a compound selector that finds the anchor
  // inside the component only when its app-name text matches "NBS Source".
  readonly nbsLogoLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.h1 = page.locator("h1");
    this.nbsLogoLink = page.locator(
      'app-product-logo-with-name:has(app-name:text("NBS Source")) a',
    );
  }

  // Polls the current URL every 200ms until it contains the expected substring.
  // Playwright's built-in URL assertions only check at a single point in time,
  // so this handles pages that redirect or update the URL after initial load.
  async verifyWebpageURL(expectedURL: string) {
    const timeout = 10000;
    const pollInterval = 200;
    const start = Date.now();
    while (true) {
      const currentUrl = this.page.url();
      if (currentUrl.includes(expectedURL)) {
        expect(currentUrl).toContain(expectedURL);
        break;
      }
      if (Date.now() - start > timeout) {
        throw new Error(
          `Timed out after ${timeout}ms waiting for URL to contain "${expectedURL}". Last URL: ${currentUrl}`,
        );
      }
      await new Promise((res) => setTimeout(res, pollInterval));
    }
  }

  // Verifies the h1 element is visible and contains the expected text.
  async verifyH1(title: string) {
    await playwrightExpect(this.h1).toBeVisible();
    await playwrightExpect(this.h1).toHaveText(title);
  }

  // Verifies the HTML <title> element matches the expected string with a 10s timeout
  // to account for pages that set the title after the initial render.
  async verifyWebpageTitle(title: string) {
    await playwrightExpect(this.page).toHaveTitle(title, { timeout: 10000 });
  }

  // Verifies the NBS Source logo anchor has the expected href attribute value.
  async logoHref(href: string) {
    await playwrightExpect(this.nbsLogoLink).toHaveAttribute("href", href);
  }

  // Runs an Axe accessibility scan against the current page and writes the
  // results to axe-report.html. Any violations are also printed to the console
  // so they show up in the test runner output without needing to open the file.
  async generateAccessibilityReport() {
    const accessibilityScanResults = await new AxeBuilder({
      page: this.page,
    }).analyze();
    const html = createHtmlReport({ results: accessibilityScanResults });
    fs.writeFileSync("axe-report.html", html);
    console.log(accessibilityScanResults.violations);
  }
}
