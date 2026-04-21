// index.ts — Custom Playwright fixtures for the NBS Source test suite.
//
// This is the Playwright equivalent of Cypress's custom commands. Fixtures are
// injected into tests as function parameters, meaning each test only receives
// the page objects it actually needs. Playwright constructs and tears them down
// automatically, so there's no need for beforeEach hooks or module-level variables.
//
// Usage: import { test, expect } from "./fixtures" instead of "@playwright/test"
// and declare any fixture by name in the test's parameter list, e.g:
//   test("my test", async ({ basePage, dysonPage }) => { ... })

import { test as base } from "@playwright/test";
import { HomePage } from "../pages/home-page";
import { DysonHomepage } from "../pages/dyson-homepage";
import { BasePage } from "../pages/base-page";

// Declares the shape of all custom fixtures available to tests in this suite.
type PageFixtures = {
  homePage: HomePage;
  dysonPage: DysonHomepage;
  basePage: BasePage;
  nbsReady: void;
};

// Extends the base Playwright test object with the custom fixtures defined below.
// Exporting this as `test` means spec files can use it as a drop-in replacement
// for the standard `import { test } from "@playwright/test"`.
export const test = base.extend<PageFixtures>({

  // Constructs a HomePage instance using the built-in Playwright page fixture.
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },

  // Constructs a DysonHomepage instance using the built-in Playwright page fixture.
  dysonPage: async ({ page }, use) => {
    await use(new DysonHomepage(page));
  },

  // Constructs a BasePage instance using the built-in Playwright page fixture.
  basePage: async ({ page }, use) => {
    await use(new BasePage(page));
  },

  // Composite fixture that combines navigation and search into a single reusable setup step.
  // Add `nbsReady` to a test's parameter list to land on the Dyson manufacturer page
  // before the test body runs. `auto: false` means it only runs when explicitly requested.
  nbsReady: [
    async ({ homePage, basePage }, use) => {
      await homePage.navigateToNBSHomepage();
      await basePage.verifyWebpageURL("https://source.thenbs.com/en/");
      await homePage.searchFor("Dyson");
      await use();
    },
    { auto: false },
  ],
});

// Re-exports expect from Playwright so spec files only need to import from this file.
export { expect } from "@playwright/test";
