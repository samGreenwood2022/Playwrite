import { Page, Locator } from '@playwright/test';
import { expect as playwrightExpect } from '@playwright/test';

export class HomePage {
  readonly page: Page;
  readonly searchField: Locator;
  readonly searchButton: Locator;
  readonly acceptCookiesButton: Locator;
  readonly selectSearchResult: Locator;
  readonly telephoneLink: Locator;

  //Locators
  // Constructor to initialize the page and locators
  constructor(page: Page) {
    this.page = page;
    // Locator for the search input field using the data-cy attribute
    this.searchField = page.locator('[data-cy="searchFieldSearch"]').last();
    // Locator for the search button using the data-cy attribute
    this.searchButton = page.locator('[data-cy="searchButton"]').last();
    // Locator for selecting an option from the search results drop down menu
    this.selectSearchResult = page.getByRole('option', { name: /Dyson/i });
    // Locator for the Accept All Cookies button
    this.acceptCookiesButton = page.getByRole('button', { name: 'Accept All Cookies' });
    this.telephoneLink = page.locator('a[action="telephone"]');
  }

  //Actions

  // Method to perform a search operation
  async searchFor(term: string) {
    // Fill the search field with the provided term
    await this.searchField.fill(term);
    // Click the search button to initiate the search
    await this.selectSearchResult.first().click({ force: true });
    // Wait for 3 seconds to allow the search results to load
    await this.page.waitForTimeout(3000);
  }

  // Method to perform a search and click the result
  async navigateToNBSHomepageAndClickToAcceptCookies() {
    // Navigate to the Source home page
    await this.page.goto('https://source.thenbs.com/');

    // Wait for the 'Accept All Cookies' button to appear, then click if visible
    try {
      await this.acceptCookiesButton.waitFor({ state: 'visible', timeout: 10000 });
      await this.acceptCookiesButton.click();
      await this.acceptCookiesButton.waitFor({ state: 'hidden', timeout: 10000 });
    } catch (e) {
      // If the button does not appear or is already accepted, log and continue
      console.warn("Cookies button not found, not visible, or already accepted.");
    }
  }

  // Method to verify a webpage URL
  async verifyWebpageURL(URL: string) {
    await playwrightExpect(this.page).toHaveURL(URL);
  }

  // Method to verify a webpage URL
  async selectSearchResultFromDropdown() {
    await this.selectSearchResult.click();
  }

  // Method to verify a webpage URL
  async verifyTelNo() {
    // Assert the link is visible
    await playwrightExpect(this.telephoneLink).toBeVisible();

    // Assert the link text is correct
    await playwrightExpect(this.telephoneLink).toHaveText('08003457788');

    // Assert the href attribute is correct
    await playwrightExpect(this.telephoneLink).toHaveAttribute('href', 'tel:08003457788');
  }

}

