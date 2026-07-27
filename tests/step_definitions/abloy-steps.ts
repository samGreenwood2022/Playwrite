// abloy-steps.ts — Cucumber step definitions for the Abloy UK tests.
//
// Same design pattern as dyson-steps.ts: each function links to one Gherkin step
// in the Abloy feature file, and `this` is the CustomWorld for the scenario,
// which gives us the page objects (abloyPage, basePage) created in world.ts.
//
// Note on shared steps: the generic URL / page-title / logo-href checks are NOT
// redefined here — they live in dyson-steps.ts, use basePage (not the Dyson page
// object), and work on any page, so the Abloy feature reuses them directly.
// Cucumber registers all step files together, so redefining them here would be a
// duplicate-step error. The steps below are the Abloy-specific ones, worded so
// they never collide with the Dyson steps.

import { Given, Then, DataTable } from "@cucumber/cucumber";
import { CustomWorld } from "../features/support/world";

// Navigates to the Abloy UK manufacturer Overview page. This runs as the
// Background step before every scenario in the Abloy feature file.
Given("I navigate to the Abloy UK manufacturer homepage", async function (this: CustomWorld) {
  await this.abloyPage.navigateToAbloyHomepage();
});

// Calls the geolocation API, validates the JSON response, and verifies the UI locale label matches.
Then("The Abloy API response and the UI locale label are as expected", async function (this: CustomWorld) {
  await this.abloyPage.verifyUIandAPIContent();
});

// Verifies the telephone link displays the correct number, uses the tel: protocol, and has the correct href.
// The expected number and href are read from a single-row data table so both values
// are visible in the feature file rather than the href being constructed in code.
Then("The Abloy telephone link displays the correct details", async function (this: CustomWorld, details: DataTable) {
  // hashes() turns the table into [{ number, href }] keyed by the header row.
  const { number, href } = details.hashes()[0];
  await this.abloyPage.verifyTelNo(number, href);
});

// Verifies the external manufacturer link (Contact manufacturer button) points to the correct URL.
Then("The Abloy manufacturer website link is correct {string}", async function (this: CustomWorld, expectedLink: string) {
  await this.abloyPage.verifyExternalManufacturerLink(expectedLink);
});

// Verifies the Contact manufacturer button displays the correct visible text.
Then("The Abloy contact button will display the correct text {string}", async function (this: CustomWorld, expectedText: string) {
  await this.abloyPage.verifyContactButtonText(expectedText);
});

// Verifies the Abloy UK page's core content still renders (nav strip, Contact
// button, and the "Abloy UK" heading).
Then("The Abloy page core content renders", async function (this: CustomWorld) {
  await this.abloyPage.verifyCoreContentRenders();
});

// Verifies the Abloy navigation bar contains the expected tabs in the expected order.
// The expected tab labels and hrefs come from the feature file's data table, so the
// spec — not the page object — owns the list of what should appear.
Then("The Abloy navigation bar displays the following tabs in order", async function (this: CustomWorld, tabs: DataTable) {
  // hashes() yields one object per row keyed by the header columns ("label", "href").
  const expectedTabs = tabs.hashes().map((row) => ({
    label: row.label,
    href: row.href,
  }));
  await this.abloyPage.verifyAbloyNavigationBar(expectedTabs);
});
