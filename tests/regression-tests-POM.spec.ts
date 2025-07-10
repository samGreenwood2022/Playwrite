import { test, expect } from '@playwright/test';
import { HomePage } from './pages/home-page';

test('Assert the Source home page has the correct URL', async ({ page }) => {

  // Create an instance of HomePage and perform a search for 'Dyson'
  const homePage = new HomePage(page);
  // Navigate to the Source home page and click to accept cookies
  await homePage.navigateToNBSHomepageAndClickToAcceptCookies();

  // Expect the page title to contain the substring 'NBS Source'
  await homePage.verifyWebpageURLFor('https://source.thenbs.com/');

  await homePage.searchFor('Dyson');
});