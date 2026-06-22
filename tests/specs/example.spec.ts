import { expect, test } from "@playwright/test";

// Test 1: Go to NBS Homepage and verify url
test("Go to NBS Homepage and verify url", async ({ page }) => {
  await page.goto("https://source.thenbs.com/en/");
  await expect(page).toHaveURL("https://source.thenbs.com/en/");
  await page.getByRole("textbox", { name: "Search" }).click();
  await page.getByRole("textbox", { name: "Search" }).fill("dyson");
  await page.getByRole("textbox", { name: "Search" }).press("Enter");
  await page.getByRole("tab", { name: "Manufacturers" }).click();
  await page.getByRole("link", { name: "Dyson Dyson Technology for" }).click();
  // toHaveURL waits for the navigation to actually land on the overview page,
  // so the heading assertion below runs against the manufacturer page — not the
  // search results page we just left.
  await expect(page).toHaveURL(/\/manufacturer\/dyson\/.*\/overview/);
  // exact: true makes this case-sensitive and full-string, so it matches the
  // overview <h1>Dyson</h1> but NOT the search page's <h1>"dyson"</h1>.
  await expect(
    page.getByRole("heading", { name: "Dyson", exact: true, level: 1 })
  ).toBeVisible();
});
