// home-page.ts — Cucumber step definitions for the Dyson manufacturer homepage tests.
//
// Each function here is mapped to a Gherkin step in regression-tests.feature.
// `this` refers to the CustomWorld instance for the current scenario, which provides
// the page objects (homePage, dysonPage, basePage) set up in world.ts.
// The step text in each Given/Then call must match the feature file exactly.

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
  "The API response and content is as expected",
  async function (this: CustomWorld) {
    await this.dysonPage.verifyUIandAPIContent();
  },
);

// Opens the Certifications tab on the Dyson manufacturer page.
When("I open the Certifications tab", async function (this: CustomWorld) {
  await this.dysonPage.openCertificationsTab();
});

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

// Reads the test account credentials from the environment (loaded by dotenv in world.ts),
// records the current page URL so a later step can assert the user is returned to it,
// clicks the header Sign in button to open the form, then runs the full sign-in flow.
// Throws immediately if either credential is missing so the failure is obvious rather
// than surfacing as a confusing selector timeout inside the form.
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

// Strict equality against the URL captured before sign-in. Uses toBe rather than
// basePage.verifyWebpageURL because that helper does a substring match, which would
// let a redirect to a different path silently pass.
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
      // Record the diff PNG path so the After hook attaches it to the report
      // instead of a live page screenshot, then rethrow to fail the step.
      this.visualDiffPath = (err as { diffPath?: string }).diffPath;
      throw err;
    }
  },
);

