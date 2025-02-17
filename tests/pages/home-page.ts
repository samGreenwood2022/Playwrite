import { Page, Locator } from '@playwright/test';

export class HomePage {
  readonly page: Page;
  readonly searchField: Locator;
  readonly searchButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchField = page.locator('[data-cy="searchFieldSearch"]').last();
    this.searchButton = page.locator('[data-cy="searchButton"]').last();
  }

  async searchFor(term: string) {
    await this.searchField.fill(term);
    await this.searchButton.click();
    await this.page.waitForTimeout(3000); // Wait for 3 seconds
  }
}