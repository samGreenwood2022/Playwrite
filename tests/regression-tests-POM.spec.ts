import { test, expect } from '@playwright/test';
import { HomePage } from './pages/home-page';
import { AxeBuilder } from '@axe-core/playwright';
import fs from 'fs';
import { createHtmlReport } from 'axe-html-reporter';

let homePage: HomePage;

test.beforeEach(async ({ page }) => {
  homePage = new HomePage(page);
  await homePage.navigateToNBSHomepageAndClickToAcceptCookies();

  // Expect the page title to contain the substring 'NBS Source'
  await homePage.verifyWebpageURL('https://source.thenbs.com/');

  // Search for and select Dyson result
  await homePage.searchFor('Dyson');
});

test('Verify the manufacturers homepage URL contains expected text', async () => {
  // Expect the page title to contain the substring 'NBS Source'
  await homePage.verifyWebpageURL('https://source.thenbs.com/manufacturer/dyson/nakAxHWxDZprdqkBaCdn4U/overview');
});

test('I verify the telephone link has the correct number, protocol and href', async ({ page }) => {
  // Expect the page title to contain the substring 'NBS Source'
  await homePage.verifyTelNo();

});

test('I verify the h1 title text on page is as expected', async () => {
  // Expect the page title to contain the substring 'NBS Source'
  await homePage.verifyH1('Dyson');

});

test('I verify the href attribute of the Source logo is as expected', async () => {
  // Expect the page title to contain the substring 'NBS Source'
  await homePage.logoHref('/');

});

test('I verify the contact manufacturer button link attribute contains the correct url', async () => {
  // Expect the external manufacturer link to have the correct URL
  await homePage.verifyExternalManufacturerLink();
});

test('Run Accessibility tests and report on any violations', async () => {
  // Run accessibility tests and report on any violations
  const accessibilityScanResults = await new AxeBuilder({ page: homePage.page }).analyze();
  const html = createHtmlReport({ results: accessibilityScanResults });
  fs.writeFileSync('axe-report.html', html);
  console.log(accessibilityScanResults.violations);
});
