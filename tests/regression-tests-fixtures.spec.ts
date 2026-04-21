import { test, expect } from "./fixtures";

test.beforeEach(async ({ nbsReady }) => {
  // nbsReady navigates to NBS Source and searches for Dyson
  void nbsReady;
});

test("Verify the manufacturers homepage URL contains expected text", async ({
  basePage,
}) => {
  await basePage.verifyWebpageURL(
    "https://source.thenbs.com/en/manufacturer/dyson/nakAxHWxDZprdqkBaCdn4U/overview",
  );
});

test("I verify the telephone link has the correct number, protocol and href", async ({
  dysonPage,
}) => {
  await dysonPage.verifyTelNo("08003457788");
});

test("I verify the webpage html Title on page is as expected", async ({
  basePage,
}) => {
  await basePage.verifyWebpageTitle("Dyson | Overview | NBS BIM Library");
});

test("I verify the href attribute of the Source logo is as expected", async ({
  basePage,
}) => {
  await basePage.logoHref("/en/");
});

test("I verify the contact manufacturer button link attribute contains the correct url", async ({
  dysonPage,
}) => {
  await dysonPage.verifyExternalManufacturerLink(
    "https://www.dyson.co.uk/commercial/overview/architects-designers",
  );
});

test("Run Accessibility tests and report on any violations", async ({
  basePage,
}) => {
  await basePage.generateAccessibilityReport();
});

test("I perform an api test and verify the response and content is as expected", async ({
  dysonPage,
}) => {
  await dysonPage.verifyUIandAPIContent();
});
