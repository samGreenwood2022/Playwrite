import { test, expect } from '@playwright/test';
import { HomePage } from './pages/home-page';

test('Assert the Source home page has the correct Title', async ({ page }) => {
  // Navigate to the Source home page
  await page.goto('https://source.thenbs.com/');

  // Click the second instance of 'Accept All Cookies' if it appears
  const acceptCookiesButton = page.locator('button:has-text("Accept All Cookies")');
  try {
    if (await acceptCookiesButton.isVisible()) {
      await acceptCookiesButton.nth(1).click(); // Click the second instance
      await expect(acceptCookiesButton.nth(1)).toBeHidden(); // Ensure the button disappears
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