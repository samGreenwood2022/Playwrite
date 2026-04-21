import { Page, Locator, expect } from "@playwright/test";
import { expect as playwrightExpect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import fs from "fs";
import { createHtmlReport } from "axe-html-reporter";

// BasePage contains actions and assertions shared across all pages
export class BasePage {
  readonly page: Page;
  readonly h1: Locator;
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

  async verifyH1(title: string) {
    await playwrightExpect(this.h1).toBeVisible();
    await playwrightExpect(this.h1).toHaveText(title);
  }

  async verifyWebpageTitle(title: string) {
    await playwrightExpect(this.page).toHaveTitle(title, { timeout: 10000 });
  }

  async logoHref(href: string) {
    await playwrightExpect(this.nbsLogoLink).toHaveAttribute("href", href);
  }

  // Runs an axe accessibility scan against the current page and writes the
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
