import { Given, When, Then } from '@cucumber/cucumber';
import { chromium, Browser, Page, Locator } from 'playwright';
import { expect } from '@playwright/test';
import { HomePage } from '../pages/home-page.ts';
import { DysonHomepage } from '../pages/dyson-homepage.ts';
import { BasePage } from '../pages/base-page.ts';
import { setDefaultTimeout } from '@cucumber/cucumber';

setDefaultTimeout(60 * 1000); // 60 seconds

let browser: Browser;
let page: Page;
let homePage: HomePage;
let dysonPage: DysonHomepage;
let basePage: BasePage;

Given('I sign into NBS and visit the manufacturer home page', async function () {
    browser = await chromium.launch();
    const context = await browser.newContext();
    page = await context.newPage();
    homePage = new HomePage(page);
    dysonPage = new DysonHomepage(page);
    basePage = new BasePage(page);

    await homePage.navigateToNBSHomepageAndClickToAcceptCookies();
    await basePage.verifyWebpageURL('https://source.thenbs.com/');
    // Debug step
    // await page.pause();
    await homePage.searchFor('Dyson');
});

Then('The URL will contain the expected text {string}', async function (expectedText: string) {
    await basePage.verifyWebpageURL(expectedText);
});

Then('The number will be correct, the href will be as expected, and the telephone protocol will correct {string}', async function (telNo: string) {
    await dysonPage.verifyTelNo(telNo);
});

Then('The webpage title will be as expected {string}', async function (title: string) {
    await basePage.verifyWebpageTitle(title);
});

Then('The href attribute of the Source logo will be as expected {string}', async function (expectedHref: string) {
    await basePage.logoHref(expectedHref);
});

Then('The manufacturer website link is correct {string}', async function (expectedLink: string) {
    await dysonPage.verifyExternalManufacturerLink(expectedLink);
});

Then('The button will display the correct text {string}', async function (expectedText: string) {
    await expect(dysonPage.externalManufacturerLink).toHaveText(expectedText);
});

Then('The results of the accessibility checks will be output to the console', async function () {
    await basePage.generateAccessibilityReport();
});

Then('The api reponse and content is expected', async function () {
    await dysonPage.verifyUIandAPIContent();
});

Then('The Dyson navigation bar should have the correct tabs and href links', async function () {
    await dysonPage.verifyDysonNavigationBar();
});
