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
  readonly telephoneLink: Locator;
  readonly h1: Locator;
  readonly nbsLogoLink: Locator;
  readonly externalManufacturerLink: Locator;

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
    this.h1 = page.locator('h1');
    this.nbsLogoLink = page.locator('app-product-logo-with-name:has(app-name:text("NBS Source")) a');
    this.externalManufacturerLink = page.getByRole('button', { name: 'Contact manufacturer' });
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

  // Method to verify H1 (Title of the webpage)
  async verifyH1(title: string) {
    // Assert the h1 element is visible
    await playwrightExpect(this.h1).toBeVisible();

    // Assert the h1 element text is correct
    await playwrightExpect(this.h1).toHaveText(title);

  }
  // Method to verify H1 (Title of the webpage)
  async logoHref(href: string) {
    // Assert the href attribute of the logo is correct
    await playwrightExpect(this.nbsLogoLink).toHaveAttribute('href', href);
  }

  // Method to verify the contact manufacturer link
  async verifyExternalManufacturerLink() {
    // Assert the external manufacturer link is visible
    await playwrightExpect(this.externalManufacturerLink).toBeVisible();

    // Assert the button text is correct and visible
    await playwrightExpect(this.externalManufacturerLink).toHaveText('Contact manufacturer');
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