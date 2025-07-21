import { Page, Locator } from '@playwright/test';
import { expect as playwrightExpect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import fs from 'fs';
import { createHtmlReport } from 'axe-html-reporter';

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
    this.selectSearchResult = page.locator('a').filter({ hasText: /^Dyson$/ });
    // Locator for the Accept All Cookies button
    this.acceptCookiesButton = page.getByRole('button', { name: 'Accept All Cookies' });
    // Locator for the NBS logo link (update selector as needed)
    this.nbsLogoLink = page.locator('app-product-logo-with-name a:has(app-name:text("NBS Source"))');
  }

  //Actions

  // Method to perform a search operation with retry and page refresh logic
  async searchFor(term: string) {
    const maxAttempts = 3;
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt++;
      try {
        // Ensure page is loaded
        await this.page.waitForLoadState('domcontentloaded', { timeout: 15000 });

        // Clear and type the search term
        await this.searchField.fill('');
        await this.searchField.fill(term, { timeout: 10000 });

        // Wait for the dropdown result to appear
        await this.selectSearchResult.waitFor({ state: 'visible', timeout: 10000 });

        // Click the result if visible
        if (await this.selectSearchResult.isVisible()) {
          // Click 10px from the left, vertically centered
          const box = await this.selectSearchResult.boundingBox();
          if (box) {
            await this.selectSearchResult.click({
              position: { x: 10, y: box.height / 2 }
            });
          } else {
            throw new Error('Could not find bounding box for Dyson search result');
          }
          return; // Success!
        }
      } catch (error) {
        // Optionally log the error for debugging
        console.warn(`Attempt ${attempt} failed:`, error);
      }

      // If not successful, refresh and try again
      if (attempt < maxAttempts && !this.page.isClosed()) {
        await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
      }
    }

    // If all attempts fail, throw an error
    throw new Error(`Failed to find and click the "${term}" search result after ${maxAttempts} attempts (with page reloads).`);
  }

  // Method to perform a search and click the result
  async navigateToNBSHomepageAndClickToAcceptCookies() {
    await this.page.goto('https://source.thenbs.com/', { timeout: 60000, waitUntil: 'domcontentloaded' });
    try {
      // Wait for the Accept Cookies button to be visible (max 60s)
      await this.acceptCookiesButton.waitFor({ state: 'visible', timeout: 60000 });
      await this.page.screenshot({ path: 'cookies-banner.png' });
      await this.acceptCookiesButton.click({ timeout: 60000 });
      await this.acceptCookiesButton.waitFor({ state: 'hidden', timeout: 60000 });
    } catch (error) {
      console.warn("Cookies button not found, not visible, or could not be clicked.", error);
    }
  }

  // Method to select the Dyson result from the dropdown
  async selectSearchResultFromDropdown() {
    // Wait for the result to appear (up to 10 seconds)
    await this.selectSearchResult.waitFor({ state: 'visible', timeout: 10000 });
    // Click the result if it is visible
    await this.selectSearchResult.click({ force: true });
  }

  // Method to verify H1 (Title of the webpage)
  async logoHref(href: string) {
    // Assert the href attribute of the logo is correct
    await playwrightExpect(this.nbsLogoLink).toHaveAttribute('href', href);
  }

  // Method to generate a report showing accessibility violations
  async generateAccessibilityReport() {
    // Logic to generate the report
    console.log("Generating accessibility report...");
    const accessibilityScanResults = await new AxeBuilder({ page: this.page }).analyze();
    const html = createHtmlReport({ results: accessibilityScanResults });
    fs.writeFileSync('axe-report.html', html);
    console.log(accessibilityScanResults.violations);
  }





}