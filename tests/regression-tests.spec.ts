import { test, expect } from '@playwright/test';
import { HomePage } from './pages/home-page';

test('Assert the Source home page has the correct Title', async ({ page }) => {
  await page.goto('https://source.thenbs.com/');

  // Click the second instance of 'Accept All Cookies' if it appears
  const acceptCookiesButtons = page.locator('text=Accept All Cookies');
  if (await acceptCookiesButtons.nth(1).isVisible()) {
    await acceptCookiesButtons.nth(1).click();
  }

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/NBS Source/);

  // Create an instance of HomePage and perform a search
  const homePage = new HomePage(page);
  await homePage.searchFor('Dyson');
});