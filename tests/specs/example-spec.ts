import { test } from "@playwright/test";


// Test 1: Verifies the 'Im a manufacturer' button is visible, shows expected text and has the correct underlying href.
test("Go to NBS Homepage and verify url", async ({ page }) => {
   await page.goto("https://source.thenbs.com/en/");


});