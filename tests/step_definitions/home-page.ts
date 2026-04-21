import { Given, When, Then, setDefaultTimeout } from "@cucumber/cucumber";
import { expect } from "@playwright/test";
import { CustomWorld } from "../features/support/world";

setDefaultTimeout(60 * 1000);

Given(
  "I sign into NBS and visit the manufacturer home page",
  async function (this: CustomWorld) {
    await this.homePage.navigateToNBSHomepage();
    await this.basePage.verifyWebpageURL("https://source.thenbs.com/en/");
    await this.homePage.searchFor("Dyson");
  },
);

Then(
  "The URL will contain the expected text {string}",
  async function (this: CustomWorld, expectedText: string) {
    await this.basePage.verifyWebpageURL(expectedText);
  },
);

Then(
  "The number will be correct, the href will be as expected, and the telephone protocol will correct {string}",
  async function (this: CustomWorld, telNo: string) {
    await this.dysonPage.verifyTelNo(telNo);
  },
);

Then(
  "The webpage title will be as expected {string}",
  async function (this: CustomWorld, title: string) {
    await this.basePage.verifyWebpageTitle(title);
  },
);

Then(
  "The href attribute of the Source logo will be as expected {string}",
  async function (this: CustomWorld, expectedHref: string) {
    await this.basePage.logoHref(expectedHref);
  },
);

Then(
  "The manufacturer website link is correct {string}",
  async function (this: CustomWorld, expectedLink: string) {
    await this.dysonPage.verifyExternalManufacturerLink(expectedLink);
  },
);

Then(
  "The button will display the correct text {string}",
  async function (this: CustomWorld, expectedText: string) {
    await expect(this.dysonPage.externalManufacturerLink).toHaveText(expectedText);
  },
);

Then(
  "The results of the accessibility checks will be output to the console",
  async function (this: CustomWorld) {
    await this.basePage.generateAccessibilityReport();
  },
);

Then("The api reponse and content is expected", async function (this: CustomWorld) {
  await this.dysonPage.verifyUIandAPIContent();
});

Then(
  "The Dyson navigation bar should have the correct tabs and href links",
  async function (this: CustomWorld) {
    await this.dysonPage.verifyDysonNavigationBar();
  },
);
