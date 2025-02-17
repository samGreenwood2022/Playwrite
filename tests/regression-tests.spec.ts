import { test, expect } from '@playwright/test';

test('Assert the SSource home page has the correct Title', async ({ page }) => {
    await page.goto('https://source.thenbs.com/');

  // Click the second 'Accept All Cookies' button if it appears
  const acceptCookiesButtons = page.locator('text=Accept All Cookies');
  if (await acceptCookiesButtons.nth(1).isVisible()) {
    await acceptCookiesButtons.nth(1).click();
  }

    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/NBS Source/);
  });
