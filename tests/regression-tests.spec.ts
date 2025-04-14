import { test, expect } from '@playwright/test';
import { HomePage } from './pages/home-page';

test('Assert the Source home page has the correct Title', async ({ page }) => {
  // Navigate to the Source home page
  await page.goto('https://source.thenbs.com/');

  // Click the 'Accept All Cookies' button if it appears
  const acceptCookiesButton = page.locator('div[aria-label="Cookie banner"] button:has-text("Accept All Cookies")');
  try {
    if (await acceptCookiesButton.isVisible()) {
      await acceptCookiesButton.click(); // Click the second instance
      await expect(acceptCookiesButton).toBeHidden(); // Ensure the button disappears
    }
  } catch (e) {
    console.warn("Cookies button not found or already accepted.");
  }

  // Expect the page title to contain the substring 'NBS Source'
  await expect(page).toHaveTitle(/NBS Source/);

  // Create an instance of HomePage and perform a search for 'Dyson'
  const homePage = new HomePage(page);
  await homePage.searchFor('Dyson');
});