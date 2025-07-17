import { Page, Locator } from '@playwright/test';
import { expect as playwrightExpect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import fs from 'fs';
import { createHtmlReport } from 'axe-html-reporter';

export class BasePage {
    readonly page: Page;
    readonly h1: Locator;
    readonly nbsLogoLink: Locator;

    //Locators
    // Constructor to initialize the page and locators
    constructor(page: Page) {
        this.page = page;
        this.h1 = page.locator('h1');
        this.nbsLogoLink = page.locator('app-product-logo-with-name:has(app-name:text("NBS Source")) a');
    }

    //Actions

    // Method to verify a webpage URL
    async verifyWebpageURL(URL: string) {
        await playwrightExpect(this.page).toHaveURL(URL, { timeout: 10000 });
    }

    // Method to verify H1 (Title of the webpage)
    async verifyH1(title: string) {
        // Assert the h1 element is visible
        await playwrightExpect(this.h1).toBeVisible();

        // Assert the h1 element text is correct
        await playwrightExpect(this.h1).toHaveText(title);

    }

    // Method to verify a webpage Title
    async verifyWebpageTitle(title: string) {
        await playwrightExpect(this.page).toHaveTitle(title, { timeout: 10000 });
    }



    // Method to verify value for the NBS Logo
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