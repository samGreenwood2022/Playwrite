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

  //Locators
  // Constructor to initialize the page and locators
  constructor(page: Page) {
    this.page = page;
    // Locator for the search input field using the data-cy attribute
    this.searchField = page.locator('[data-cy="searchFieldSearch"]').last();
    // Locator for the search button using the data-cy attribute
    this.searchButton = page.locator('[data-cy="searchButton"]').last();
    // Locator for selecting an option from the search results drop down menu
    this.selectSearchResult = page.locator("a").filter({ hasText: /^Dyson$/ });
    // Locator for the Accept All Cookies button
    this.acceptCookiesButton = page.getByRole("button", {
      name: "Accept All Cookies",
    });
    // Locator for the NBS logo link (update selector as needed)
    this.nbsLogoLink = page.locator(
      'app-product-logo-with-name a:has(app-name:text("NBS Source"))',
    );
  }

  //Actions

  // Method to perform a search operation and click on the results from the dropdown menu that appears after entering the search term
  async searchFor(term: string) {
    const maxAttempts = 3;
    const perAttemptTimeout = 5000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await this.searchField.click();
      await this.searchField.fill("");
      await this.searchField.pressSequentially(term, { delay: 100 });

      try {
        await playwrightExpect(this.selectSearchResult).toBeVisible({
          timeout: perAttemptTimeout,
        });
        await this.selectSearchResult.click();
        return;
      } catch {
        if (attempt === maxAttempts) {
          throw new Error(
            `Search dropdown for "${term}" did not appear after ${maxAttempts} attempts`,
          );
        }
      }
    }
  }

  // Method to perform a search and click the result
  async navigateToNBSHomepageAndClickToAcceptCookies() {
    await this.page.goto("https://source.thenbs.com/en/", {
      timeout: 60000,
      waitUntil: "domcontentloaded",
    });
  }

  // Method to select the Dyson result from the dropdown
  async selectSearchResultFromDropdown() {
    // Wait for the result to appear (up to 10 seconds)
    await this.selectSearchResult.waitFor({ state: "visible", timeout: 10000 });
    // Click the result if it is visible
    await this.selectSearchResult.click({ force: true });
  }

  // Method to verify H1 (Title of the webpage)
  async logoHref(href: string) {
    // Assert the href attribute of the logo is correct
    await playwrightExpect(this.nbsLogoLink).toHaveAttribute("href", href);
  }

  // Method to generate a report showing accessibility violations
  async generateAccessibilityReport() {
    // Logic to generate the report
    console.log("Generating accessibility report...");
    const accessibilityScanResults = await new AxeBuilder({
      page: this.page,
    }).analyze();
    const html = createHtmlReport({ results: accessibilityScanResults });
    fs.writeFileSync("axe-report.html", html);
    console.log(accessibilityScanResults.violations);
  }
}
