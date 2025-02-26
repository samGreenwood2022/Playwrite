import { Page, Locator } from '@playwright/test';

export class HomePage {
  readonly page: Page;
  readonly searchField: Locator;
  readonly searchButton: Locator;

  // Constructor to initialize the page and locators
  constructor(page: Page) {
    this.page = page;
    // Locator for the search input field using the data-cy attribute
    this.searchField = page.locator('[data-cy="searchFieldSearch"]').last();
    // Locator for the search button using the data-cy attribute
    this.searchButton = page.locator('[data-cy="searchButton"]').last();
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
}