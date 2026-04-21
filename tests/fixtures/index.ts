import { test as base } from "@playwright/test";
import { HomePage } from "../pages/home-page";
import { DysonHomepage } from "../pages/dyson-homepage";
import { BasePage } from "../pages/base-page";

type PageFixtures = {
  homePage: HomePage;
  dysonPage: DysonHomepage;
  basePage: BasePage;
  nbsReady: void;
};

export const test = base.extend<PageFixtures>({
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },

  dysonPage: async ({ page }, use) => {
    await use(new DysonHomepage(page));
  },

  basePage: async ({ page }, use) => {
    await use(new BasePage(page));
  },

  // Composite fixture: navigates to NBS and searches for Dyson.
  // Use this in tests that need to start on the Dyson manufacturer page.
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

export { expect } from "@playwright/test";
