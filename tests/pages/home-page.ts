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
  }

  //Actions

  // Method to perform a search operation with retry and page refresh logic
  async searchFor(term: string) {
    await this.page.waitForLoadState('domcontentloaded');
    const maxRetries = 5;

    // Helper function to attempt search up to maxRetries
    const trySearch = async () => {
      let retries = 0;
      while (retries < maxRetries) {
        await this.searchField.fill(term);
        await this.page.screenshot({ path: `searchTerm_attempt${retries + 1}.png` });
        try {
          await this.selectSearchResult.waitFor({ state: 'visible', timeout: 10000 });
          await this.selectSearchResult.click({ force: true });
          return true;
        } catch {
          await this.searchField.fill('');
          retries++;
        }
      }
      return false;
    };

    // First round of attempts
    if (await trySearch()) return;

    // Refresh and try again
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    if (await trySearch()) return;

    // If still not found, fail the test
    throw new Error(`Search result for "${term}" did not appear after ${maxRetries * 2} attempts (including page refresh).`);
  }

  // Method to perform a search and click the result
  async navigateToNBSHomepageAndClickToAcceptCookies() {
    await this.page.goto('https://source.thenbs.com/', { timeout: 60000, waitUntil: 'domcontentloaded' });
    debugger
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