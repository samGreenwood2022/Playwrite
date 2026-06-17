// dyson-steps.ts — Cucumber step definitions for the Dyson tests.
//
// Each function here links to one Gherkin step in the .feature files. `this` is
// the CustomWorld for the current scenario, which gives us the page objects
// (homePage, dysonPage, basePage) created in world.ts. The step text in each
// Given/When/Then must match the feature file word for word.

import {
  Given,
  When,
  Then,
  DataTable,
  setDefaultTimeout,
} from "@cucumber/cucumber";
import { expect } from "@playwright/test";
import { CustomWorld } from "../features/support/world";

// Extends the default Cucumber step timeout to 60 seconds to allow for slow page loads.
setDefaultTimeout(60 * 1000);

// Navigates to the NBS Source homepage, verifies the URL, then searches for Dyson.
// This runs as the Background step before every scenario in the feature file.
Given(
  "I navigate to the Dyson manufacturer homepage",
  async function (this: CustomWorld) {
    await this.homePage.navigateToNBSHomepage();
    await this.basePage.verifyWebpageURL("https://source.thenbs.com/en/");
    await this.homePage.searchFor("Dyson");
    // await this.basePage.verifyWebpageURL("/en/manufacturers/dyson/");
  },
);

// Verifies the current page URL contains the expected substring passed from the feature file.
Then(
  "The URL will contain the expected text {string}",
  async function (this: CustomWorld, expectedText: string) {
    await this.basePage.verifyWebpageURL(expectedText);
  },
);

// Verifies the telephone link displays the correct number, uses the tel: protocol, and has the correct href.
// The expected number and href are read from a single-row data table so both values
// are visible in the feature file rather than the href being constructed in code.
Then(
  "The telephone link displays the correct details",
  async function (this: CustomWorld, details: DataTable) {
    // hashes() turns the table into [{ number, href }] keyed by the header row.
    const { number, href } = details.hashes()[0];
    await this.dysonPage.verifyTelNo(number, href);
  },
);

// Verifies the HTML <title> of the page matches the expected string exactly.
Then(
  "The webpage title will be as expected {string}",
  async function (this: CustomWorld, title: string) {
    await this.basePage.verifyWebpageTitle(title);
  },
);

// Verifies the NBS Source logo links to the expected href attribute value.
Then(
  "The href attribute of the Source logo will be as expected {string}",
  async function (this: CustomWorld, expectedHref: string) {
    await this.basePage.logoHref(expectedHref);
  },
);

// Verifies the external manufacturer link (Contact manufacturer button) points to the correct URL.
Then(
  "The manufacturer website link is correct {string}",
  async function (this: CustomWorld, expectedLink: string) {
    await this.dysonPage.verifyExternalManufacturerLink(expectedLink);
  },
);

// Verifies the Contact manufacturer button displays the correct visible text.
Then(
  "The button will display the correct text {string}",
  async function (this: CustomWorld, expectedText: string) {
    await this.dysonPage.verifyContactButtonText(expectedText);
  },
);

// Runs an Axe accessibility scan on the current page and outputs any violations to an HTML report.
Then(
  "The results of the accessibility checks will be output to an HTML report",
  async function (this: CustomWorld) {
    await this.basePage.generateAccessibilityReport();
  },
);

// Calls the geolocation API, validates the JSON response, and verifies the UI locale label matches.
Then(
  "The API response and the UI locale label are as expected",
  async function (this: CustomWorld) {
    await this.dysonPage.verifyUIandAPIContent();
  },
);

// Opens the Certifications tab on the Dyson manufacturer page.
When("I open the Certifications tab", async function (this: CustomWorld) {
  await this.dysonPage.openCertificationsTab();
});

// Opens the Certifications tab when its data request is dropped (aborted) so no
// response ever arrives. Uses the failure-aware open, which waits for the
// request to fail rather than for a response that never comes.
When(
  "I open the Certifications tab with its request dropped",
  async function (this: CustomWorld) {
    await this.dysonPage.openCertificationsTabExpectingFailure();
  },
);

// Verifies the first certification tile renders the expected (stubbed) title.
Then(
  "The first certification tile shows {string}",
  async function (this: CustomWorld, expectedTitle: string) {
    await this.dysonPage.verifyFirstCertificationTile(expectedTitle);
  },
);

// Verifies the Certifications tab renders its empty state (no result tiles).
Then(
  "The Certifications tab shows no results",
  async function (this: CustomWorld) {
    await this.dysonPage.verifyNoCertificationResults();
  },
);

// Verifies the Certifications tab degrades gracefully when its API returns a 500:
// the panel renders blank (no tiles, no empty-state, no error message).
Then(
  "The Certifications tab shows a server error",
  async function (this: CustomWorld) {
    await this.dysonPage.verifyCertificationsServerError();
  },
);

// Verifies the Certifications tab still renders its tiles after a slow response.
Then(
  "The Certifications tab still renders its certifications",
  async function (this: CustomWorld) {
    await this.dysonPage.verifyCertificationsRender();
  },
);

// Verifies the tab opened but shows no certification tiles. Shared by the
// dropped-connection and malformed-payload scenarios — both leave the tab with
// no usable data and no explicit feedback to the user.
Then(
  "The Certifications tab renders no certification tiles",
  async function (this: CustomWorld) {
    await this.dysonPage.verifyNoCertificationTiles();
  },
);

// Verifies the Dyson page's core content still renders with analytics and other
// third-party requests blocked.
Then(
  "The Dyson page core content still renders",
  async function (this: CustomWorld) {
    await this.dysonPage.verifyCoreContentRenders();
  },
);

// Verifies the Dyson navigation bar contains the expected tabs in the expected order.
// The expected tab labels come from the feature file's data table, so the spec — not
// the page object — owns the list of what should appear.
Then(
  "The Dyson navigation bar displays the following tabs in order",
  async function (this: CustomWorld, tabs: DataTable) {
    // hashes() yields one object per row keyed by the header columns ("label", "href").
    const expectedTabs = tabs.hashes().map((row) => ({
      label: row.label,
      href: row.href,
    }));
    await this.dysonPage.verifyDysonNavigationBar(expectedTabs);
  },
);

// Reads the test account login details from the environment (loaded by dotenv
// in world.ts), saves the current URL so a later step can check the user comes
// back to it, clicks the header Sign in button to open the form, then signs in.
// If either credential is missing it throws straight away, so the failure is
// clear rather than showing up later as a confusing timeout inside the form.
When("I sign in with valid credentials", async function (this: CustomWorld) {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "TEST_EMAIL and TEST_PASSWORD must be set in .env for the sign-in scenario.",
    );
  }
  this.capturedUrl = this.page.url();
  await this.basePage.signInButton.click();
  await this.loginPage.signIn(email, password);
});

// Checks the URL exactly matches the one we saved before sign-in. We use toBe
// (an exact match) instead of the verifyWebpageURL helper, which only checks
// "contains" and would let a redirect to a different page slip through.
Then(
  "The user is then logged in and returned to their previous page",
  function (this: CustomWorld) {
    expect(this.page.url()).toBe(this.capturedUrl);
  },
);

// Delegates to BasePage which encapsulates all three header checks
// (Sign in hidden, user menu visible, avatar initials correct).
Then(
  "The UI will reflect that the user is logged in",
  async function (this: CustomWorld) {
    await this.basePage.verifyLoggedInUI();
  },
);

// Takes a screenshot of the Dyson homepage and compares it to a baseline image to check for visual regressions.
Then(
  "I take a screenshot of the Dyson homepage and compare it to the baseline image to check for visual regressions",
  async function (this: CustomWorld) {
    try {
      await this.basePage.verifyVisualRegression("baseline", [
        this.dysonPage.navigationTabs,
      ]);
    } catch (err) {
      // Save the diff image's path so the After hook attaches it to the report
      // instead of a normal screenshot, then re-throw to make the step fail.
      this.visualDiffPath = (err as { diffPath?: string }).diffPath;
      throw err;
    }
  },
);

