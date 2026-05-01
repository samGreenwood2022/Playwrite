// base-page.ts — Base Page Object Model shared across all pages.
//
// Contains locators and methods that are common to every page in the test suite.
// Other page objects do not extend this class — they are instantiated separately
// and used alongside it. Any assertion or action that applies site-wide (URL checks,
// page title, logo, accessibility) belongs here rather than in a specific page object.

import { Page, Locator, expect } from "@playwright/test";
import { expect as playwrightExpect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import fs from "fs";
import path from "path";
import { createHtmlReport } from "axe-html-reporter";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

export class BasePage {
  readonly page: Page;
  readonly h1: Locator;
  // Targets the NBS Source logo link using a compound selector that finds the anchor
  // inside the component only when its app-name text matches "NBS Source".
  readonly nbsLogoLink: Locator;
  // Header Sign in button, visible on every page until the user authenticates.
  // Lives here (rather than on LoginPage) because it is a site-wide header element.
  readonly signInButton: Locator;
  // Logged-in header elements — the user menu button and the avatar figure
  // that displays the account initials. Both replace the Sign in button once
  // authentication succeeds.
  readonly openUserMenuButton: Locator;
  readonly userInitials: Locator;

  constructor(page: Page) {
    this.page = page;
    this.h1 = page.locator("h1");
    this.nbsLogoLink = page.locator(
      'app-product-logo-with-name:has(app-name:text("NBS Source")) a',
    );
    this.signInButton = page.getByRole("button", { name: "Sign in" });
    this.openUserMenuButton = page.getByRole("button", {
      name: "Open user menu",
    });
    this.userInitials = page.getByRole("figure");
  }

  // Polls the current URL every 200ms until it contains the expected substring.
  // Playwright's built-in URL assertions only check at a single point in time,
  // so this handles pages that redirect or update the URL after initial load.
  async verifyWebpageURL(expectedURL: string) {
    const timeout = 10000;
    const pollInterval = 200;
    const start = Date.now();
    while (true) {
      const currentUrl = this.page.url();
      if (currentUrl.includes(expectedURL)) {
        expect(currentUrl).toContain(expectedURL);
        break;
      }
      if (Date.now() - start > timeout) {
        throw new Error(
          `Timed out after ${timeout}ms waiting for URL to contain "${expectedURL}". Last URL: ${currentUrl}`,
        );
      }
      await new Promise((res) => setTimeout(res, pollInterval));
    }
  }

  // Verifies the h1 element is visible and contains the expected text.
  async verifyH1(title: string) {
    await playwrightExpect(this.h1).toBeVisible();
    await playwrightExpect(this.h1).toHaveText(title);
  }

  // Verifies the HTML <title> element matches the expected string with a 10s timeout
  // to account for pages that set the title after the initial render.
  async verifyWebpageTitle(title: string) {
    await playwrightExpect(this.page).toHaveTitle(title, { timeout: 10000 });
  }

  // Verifies the NBS Source logo anchor has the expected href attribute value.
  async logoHref(href: string) {
    await playwrightExpect(this.nbsLogoLink).toHaveAttribute("href", href);
  }

  // Verifies the header reflects an authenticated user: the Sign in button
  // is gone, the user menu button has appeared, and the avatar figure shows
  // the expected account initials.
  async verifyLoggedInUI() {
    await playwrightExpect(this.signInButton).toBeHidden();
    await playwrightExpect(this.openUserMenuButton).toBeVisible();
    await playwrightExpect(this.userInitials).toContainText("TH");
  }

  // Runs an Axe accessibility scan against the current page and writes the
  // results to reports/accessibility-report.html. Any violations are also printed to the console
  // so they show up in the test runner output without needing to open the file.
  async generateAccessibilityReport() {
    const accessibilityScanResults = await new AxeBuilder({
      page: this.page,
    }).analyze();
    const html = createHtmlReport({ results: accessibilityScanResults });
    fs.mkdirSync("reports", { recursive: true });
    fs.writeFileSync("reports/accessibility-report.html", html);
    console.log(accessibilityScanResults.violations);
  }

  // Triggers any intersection-observer lazy loading by scrolling the full document
  // height in steps, then scrolls back to the top. Necessary because Playwright's
  // fullPage screenshot does scroll the page, but if the site uses lazy loading
  // some images may not finish loading before the screenshot frames are stitched.
  async triggerLazyLoad() {
    await this.page.evaluate(async () => {
      const total = document.body.scrollHeight;
      const step = window.innerHeight;
      for (let y = 0; y < total; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 100));
      }
      window.scrollTo(0, 0);
    });
  }

  // Resolves once every <img> on the page is either fully loaded (complete and
  // has a real naturalWidth) or has failed to load. Errored images are not
  // considered blockers since waiting indefinitely would hang the test.
  async waitForImagesLoaded(timeout: number = 15000) {
    await this.page.waitForFunction(
      () =>
        Array.from(document.images).every(
          (img) => img.complete && (img.naturalWidth > 0 || img.src === ""),
        ),
      undefined,
      { timeout },
    );
  }

  // Takes a full-page screenshot and compares it against a stored baseline using
  // pixelmatch. On first run the baseline is created automatically. Subsequent
  // runs fail if more than 2% of pixels differ beyond the per-pixel threshold.
  // Callers pass page-specific locators in `waitFor` so the screenshot is only
  // taken once those elements are visible — keeps BasePage generic while still
  // gating capture on page-readiness.
  async verifyVisualRegression(name: string = "baseline", waitFor: Locator[] = []) {
    for (const loc of waitFor) {
      await loc.waitFor({ state: "visible", timeout: 15000 });
    }

    await this.triggerLazyLoad();
    await this.waitForImagesLoaded();
    await this.page.evaluate(() => document.fonts.ready);

    const snapshotDir = path.resolve("tests/snapshots");
    const baselinePath = path.join(snapshotDir, `${name}.png`);
    const actualPath = path.join(snapshotDir, `${name}-actual.png`);
    const diffPath = path.join(snapshotDir, `${name}-diff.png`);

    fs.mkdirSync(snapshotDir, { recursive: true });

    const screenshotBuffer = await this.page.screenshot({ fullPage: true });

    if (!fs.existsSync(baselinePath)) {
      fs.writeFileSync(baselinePath, screenshotBuffer);
      console.log(`Baseline created at ${baselinePath}. Re-run to compare.`);
      return;
    }

    fs.writeFileSync(actualPath, screenshotBuffer);

    const baseline = PNG.sync.read(fs.readFileSync(baselinePath));
    const actual = PNG.sync.read(screenshotBuffer);
    const { width, height } = baseline;
    const diff = new PNG({ width, height });

    const diffPixels = pixelmatch(
      baseline.data, actual.data, diff.data,
      width, height,
      { threshold: 0.2 }
    );

    fs.writeFileSync(diffPath, PNG.sync.write(diff));

    const diffRatio = diffPixels / (width * height);
    if (diffRatio > 0.02) {
      throw new Error(
        `Visual regression detected: ${diffPixels} pixels differ (${(diffRatio * 100).toFixed(2)}%). Diff saved to ${diffPath}`
      );
    }
  }


}