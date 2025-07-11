import { test, expect } from '@playwright/test';
import { HomePage } from './pages/home-page';

test('Verify the manufacturers homepage URL contains expected text', async ({ page }) => {

  // Create an instance of HomePage and perform a search for 'Dyson'
  const homePage = new HomePage(page);

  // Navigate to the Source home page and click to accept cookies
  await homePage.navigateToNBSHomepageAndClickToAcceptCookies();

  // Expect the page title to contain the substring 'NBS Source'
  await homePage.verifyWebpageURL('https://source.thenbs.com/');

  // Search for and select Dyson result
  await homePage.searchFor('Dyson');
});

test('I verify the telephone link has the correct number, protocol and href', async ({ page }) => {

  // Create an instance of HomePage and perform a search for 'Dyson'
  const homePage = new HomePage(page);

  // Navigate to the Source home page and click to accept cookies
  await homePage.navigateToNBSHomepageAndClickToAcceptCookies();

  // Expect the page URL to contain the expected text'
  await homePage.verifyWebpageURL('https://source.thenbs.com/');

  // Search for and select Dyson result
  await homePage.searchFor('Dyson');

  // Expect the page title to contain the substring 'NBS Source'
  await homePage.verifyTelNo();

});

test('I verify the h1 title text on page is as expected', async ({ page }) => {

  // Create an instance of HomePage and perform a search for 'Dyson'
  const homePage = new HomePage(page);
  
  // Navigate to the Source home page and click to accept cookies
  await homePage.navigateToNBSHomepageAndClickToAcceptCookies();

  // Search for and select Dyson result
  await homePage.searchFor('Dyson');

  // Expect the page title to contain the substring 'NBS Source'
  await homePage.verifyH1();

});