import { Page, Locator } from '@playwright/test';
import { expect as playwrightExpect } from '@playwright/test';

export class DysonHomepage {
    // Locators
    readonly page: Page;
    readonly telephoneLink: Locator;
    readonly externalManufacturerLink: Locator;

    constructor(page: Page) {
        this.page = page;
        this.telephoneLink = page.locator('a[action="telephone"]');
        this.externalManufacturerLink = page.getByRole('button', { name: 'Contact manufacturer' });
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
        const localeLabel = this.page.locator('button[aria-label="Choose locale"] .mdc-button__label').first();
        await playwrightExpect(localeLabel).toHaveText(/UK/);
        await playwrightExpect(localeLabel).toBeVisible();
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



}