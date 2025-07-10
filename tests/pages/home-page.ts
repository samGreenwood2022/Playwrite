import { Page, Locator } from '@playwright/test';
import { expect as playwrightExpect } from '@playwright/test';

export class HomePage {
  readonly page: Page;
  readonly searchField: Locator;
  readonly searchButton: Locator;
  readonly acceptCookiesButton: Locator;

  // Constructor to initialize the page and locators
  constructor(page: Page) {
    this.page = page;
    // Locator for the search input field using the data-cy attribute
    this.searchField = page.locator('[data-cy="searchFieldSearch"]').last();
    // Locator for the search button using the data-cy attribute
    this.searchButton = page.locator('[data-cy="searchButton"]').last();
    // Locator for the Accept All Cookies button
    this.acceptCookiesButton = page.locator('div[aria-label="Cookie banner"] button:has-text("Accept All Cookies")');
  }

  // Method to perform a search operation
  async searchFor(term: string) {
    // Fill the search field with the provided term
    await this.searchField.fill(term);
    // Click the search button to initiate the search
    await this.searchButton.click({ force: true });
    // Wait for 3 seconds to allow the search results to load
    await this.page.waitForTimeout(3000);
  }

  // Method to perform a search and click the result
  async navigateToNBSHomepageAndClickToAcceptCookies() {
    // Navigate to the Source home page
    await this.page.goto('https://source.thenbs.com/');

    // Click the 'Accept All Cookies' button if it appears

    try {
      if (await this.acceptCookiesButton.isVisible()) {
        await this.acceptCookiesButton.click(); // Click the second instance
        await this.acceptCookiesButton.waitFor({ state: 'hidden' }); // Ensure the button disappears
      }
    } catch (e) {
      console.warn("Cookies button not found or already accepted.");
    }
  }

  // Method to verify a webpage URL
  async verifyWebpageURLFor(URL: string) {
    await playwrightExpect(this.page).toHaveURL(URL);
  }

}

