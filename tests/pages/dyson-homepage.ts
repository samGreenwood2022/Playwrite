import { Page, Locator } from '@playwright/test';
import { expect as playwrightExpect } from '@playwright/test';

export class DysonHomepage {
    // Locators
    readonly page: Page;
    readonly telephoneLink: Locator;
    readonly externalManufacturerLink: Locator;
    readonly navigationTabs: Locator
    readonly localeLabel: Locator;

    constructor(page: Page) {
        this.page = page;
        this.telephoneLink = page.locator('a[action="telephone"]');
        this.externalManufacturerLink = page.getByRole('button', { name: 'Contact manufacturer' });
        this.navigationTabs = page.locator('.mat-mdc-tab-links');
        this.localeLabel = page.getByRole('button', { name: 'Choose region' });
    }

    // Actions

    async verifyUIandAPIContent() {
        // Make the API request using Playwright's fetch, ignoring HTTPS errors
        const response = await this.page.request.get('https://geolocation.onetrust.com/cookieconsentpub/v1/geo/location', {
            ignoreHTTPSErrors: true
        });

        // Assert that the response status is 200
        playwrightExpect(response.status()).toBe(200);

        const text = await response.text();

        // The response is like: jsonFeed({...});
        const match = text.match(/jsonFeed\((.*)\);?/);
        if (!match) {
            throw new Error('Unexpected response format');
        }
        const body = JSON.parse(match[1]);

        // Check that the API response contains the correct country (GB or US)
        playwrightExpect(['GB', 'US']).toContain(body.country);

        // Now check that "UK" is present in the DOM and is visible
        await playwrightExpect(this.localeLabel).toContainText('UK');
        await playwrightExpect(this.localeLabel).toBeVisible();
    }

    // Method to verify a webpage URL
    async verifyTelNo(telNo: string): Promise<void> {
        // Assert the link is visible
        await this.page.screenshot({ path: 'telephoneLink.png' });
        await playwrightExpect(this.telephoneLink).toBeVisible({ timeout: 10000 });

        // Assert the link text is correct
        await playwrightExpect(this.telephoneLink).toHaveText(telNo, { timeout: 10000 });

        // Assert the href attribute is correct
        await playwrightExpect(this.telephoneLink).toHaveAttribute('href', `tel:${telNo}`, { timeout: 10000 });
    }

    // Method to verify the contact manufacturer link
    async verifyExternalManufacturerLink(expectedLink: string): Promise<void> {

        await this.page.screenshot({ path: 'externalManufacturerLink.png' });
        // Assert the external manufacturer link is visible
        await playwrightExpect(this.externalManufacturerLink).toBeVisible({ timeout: 10000 });
        // Assert the button text is correct and visible
        await playwrightExpect(this.externalManufacturerLink).toHaveText(" Contact manufacturer ", { timeout: 10000 });
        // Assert `href` attribute is correct
        // await playwrightExpect(this.externalManufacturerLink).toHaveAttribute('href', expectedLink, { timeout: 10000 });
    }

    // Verifies the Dyson Navigation Bar
    async verifyDysonNavigationBar(): Promise<void> {
        // Ensure the navigation bar is visible
        await playwrightExpect(this.navigationTabs).toBeVisible();

        // Ensure each tab is present and visible
        const tabNames = [
            'Overview',
            'Products',
            'Certifications',
            'Literature',
            'Case studies',
            'About us'
        ];

        for (const tab of tabNames) {
            const tabLocator = this.navigationTabs.locator('a', { hasText: tab });
            await playwrightExpect(tabLocator).toBeVisible();
        }
    }

}