import { test, expect } from '@playwright/test';
import { HomePage } from './pages/home-page';
import { DysonHomepage } from './pages/dyson-homepage'
import { BasePage } from './pages/base-page'

let homePage: HomePage;
let dysonPage: DysonHomepage;
let basePage: BasePage;

test.beforeEach(async ({ page }) => {
  homePage = new HomePage(page);
  dysonPage = new DysonHomepage(page);
  basePage = new BasePage(page);

  await homePage.navigateToNBSHomepageAndClickToAcceptCookies();

  // Expect the page title to contain the substring 'NBS Source'
  await basePage.verifyWebpageURL('https://source.thenbs.com/');
  // Debug step
  await page.pause();
  // Search for and select Dyson result
  await homePage.searchFor('Dyson');
});

test('Verify the manufacturers homepage URL contains expected text', async () => {
  // Expect the page title to contain the substring 'NBS Source'
  await basePage.verifyWebpageURL('https://source.thenbs.com/manufacturer/dyson/nakAxHWxDZprdqkBaCdn4U/overview');
});

test('I verify the telephone link has the correct number, protocol and href', async () => {
 
  // Expect the page title to contain the substring 'NBS Source'
  await dysonPage.verifyTelNo("08003457788");

});

test('I verify the webpage html Title on page is as expected', async () => {
  // Expect the page title to contain the substring 'Dyson | Overview | NBS BIM Library'
  await basePage.verifyWebpageTitle('Dyson | Overview | NBS BIM Library');

});

test('I verify the href attribute of the Source logo is as expected', async () => {
  // Expect the page title to contain the substring 'NBS Source'
  await basePage.logoHref('/');

});

test('I verify the contact manufacturer button link attribute contains the correct url', async () => {
  // Expect the external manufacturer link to have the correct URL
  await dysonPage.verifyExternalManufacturerLink('https://www.dyson.co.uk/commercial/overview/architects-designers');
});

test('Run Accessibility tests and report on any violations', async () => {
  // Run accessibility tests and report on any violations
  await basePage.generateAccessibilityReport();

});

test('I perform an api test and verify the response and content is as expected', async () => {
  // Perform api test and verify response and content
  await dysonPage.verifyUIandAPIContent();

});
