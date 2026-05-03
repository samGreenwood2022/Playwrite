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
  // The 250ms pause at each step gives the IntersectionObserver time to fire and
  // the browser time to start the image download — without this pause we scroll
  // past viewport positions before lazy loads kick in.
  async triggerLazyLoad() {
    await this.page.evaluate(async () => {
      const total = document.body.scrollHeight;
      const step = window.innerHeight;
      for (let y = 0; y < total; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 250));
      }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 250));
    });
  }

  // Resolves once every <img> on the page has finished loading or has errored
  // out. We only check `img.complete` — the browser sets it to true after a
  // successful load, a failed load (404, broken src), or when no src was ever
  // set. Errored images are not considered blockers since waiting indefinitely
  // would hang the test, and a previous `naturalWidth > 0` check excluded them
  // by mistake. By the time this runs, networkidle has already given every
  // image its chance to download.
  async waitForImagesLoaded(timeout: number = 15000) {
    await this.page.waitForFunction(
      () => Array.from(document.images).every((img) => img.complete),
      undefined,
      { timeout },
    );
  }

  // Captures a full-page screenshot and compares it pixel-by-pixel against a
  // saved "baseline" image to catch unintended visual changes (layout shifts,
  // missing images, font swaps, colour regressions, etc).
  //
  // How it works (read top-to-bottom):
  //   1. Wait for the caller's "must be visible" locators — the page-specific
  //      things (hero banner, product grid, etc.) that prove the page is ready.
  //      BasePage doesn't know what each page should contain, so callers pass
  //      these in.
  //   2. Scroll the whole page to trigger lazy-loaded images. Many sites only
  //      fetch images when they scroll into view; without this, the screenshot
  //      would capture empty placeholder boxes.
  //   3. Wait for the network to go idle so the image requests kicked off by
  //      the scroll actually finish downloading. This is the key step that was
  //      missing before — scrolling *starts* the downloads, networkidle waits
  //      for them to *complete*.
  //   4. Belt-and-braces check that every <img> element is decoded and ready.
  //   5. Wait for web fonts. Text rendered with a fallback font has different
  //      metrics and would cause false positives.
  //   6. Small settle pause for any final paint/animation frame to land.
  //   7. Take the screenshot and compare to baseline with pixelmatch.
  //
  // Files written to tests/snapshots/:
  //   <name>.png         — the baseline (commit this; it's the source of truth)
  //   <name>-actual.png  — what the page looked like on this run
  //   <name>-diff.png    — pink-highlighted PNG showing where the two differ
  //
  // First run: no baseline exists, so the current screenshot is saved as the
  // baseline and the method returns. Re-run to actually compare.
  async verifyVisualRegression(name: string = "baseline", waitFor: Locator[] = []) {
    // 1. Wait for page-specific elements the caller said must be on screen.
    for (const loc of waitFor) {
      await loc.waitFor({ state: "visible", timeout: 15000 });
    }

    // 2. Scroll top-to-bottom so any lazy-loaded images start fetching.
    await this.triggerLazyLoad();

    // 3. Wait for in-flight network requests (the images we just triggered)
    //    to finish. Without this the screenshot can be taken while images are
    //    still downloading and they show up as empty boxes in the baseline.
    await this.page.waitForLoadState("networkidle", { timeout: 30000 });

    // 4. Belt-and-braces check that every <img> reports complete. Soft-fails:
    //    on pages with carousels, animations, or trackers that keep injecting
    //    new <img> nodes, this check can never settle. networkidle (step 3)
    //    is the real safety net for image downloads, so if this times out we
    //    log the offenders and continue rather than fail the whole test.
    try {
      await this.waitForImagesLoaded();
    } catch {
      const pending = await this.page.evaluate(() =>
        Array.from(document.images)
          .filter((img) => !img.complete)
          .map((img) => img.currentSrc || img.src || "<no src>"),
      );
      console.warn(
        `waitForImagesLoaded timed out — ${pending.length} image(s) still loading. ` +
          `Continuing with screenshot. Pending:\n  ${pending.join("\n  ")}`,
      );
    }

    // 5. Wait for web fonts. document.fonts.ready resolves once all @font-face
    //    declarations the page actually uses have loaded. Playwright's evaluate
    //    awaits the returned promise.
    await this.page.evaluate(() => document.fonts.ready);

    // 6. Small settle pause — cheap insurance against off-by-one-frame diffs
    //    from final paints, CSS transitions, or skeleton fade-outs.
    await this.page.waitForTimeout(500);

    // --- Set up file paths ---
    // Baselines are per-OS because text rendering differs between Windows
    // (ClearType) and Linux (freetype), causing different text wrapping and
    // therefore different page layout heights. process.platform is "win32"
    // locally and "linux" in GitHub Actions, so each environment compares
    // against its own committed baseline. Both baselines should be checked
    // into git; CI will fail if its baseline file is missing on second run.
    const snapshotDir = path.resolve("tests/snapshots");
    const platformSuffix = process.platform;
    const baselinePath = path.join(snapshotDir, `${name}-${platformSuffix}.png`);
    const actualPath = path.join(snapshotDir, `${name}-${platformSuffix}-actual.png`);
    const diffPath = path.join(snapshotDir, `${name}-${platformSuffix}-diff.png`);

    fs.mkdirSync(snapshotDir, { recursive: true });

    // 7. Capture the screenshot. fullPage: true stitches the entire scrollable
    //    document together, not just the current viewport.
    const screenshotBuffer = await this.page.screenshot({ fullPage: true });

    // First run for this `name`: save as baseline and exit. Re-run to compare.
    if (!fs.existsSync(baselinePath)) {
      fs.writeFileSync(baselinePath, screenshotBuffer);
      console.log(`Baseline created at ${baselinePath}. Re-run to compare.`);
      return;
    }

    // Save what we just captured so a human can inspect it after a failure.
    fs.writeFileSync(actualPath, screenshotBuffer);

    // Decode both PNGs into raw pixel buffers for pixelmatch to compare.
    const baseline = PNG.sync.read(fs.readFileSync(baselinePath));
    const actual = PNG.sync.read(screenshotBuffer);
    const { width, height } = baseline;
    const diff = new PNG({ width, height });

    // threshold: 0.2 = how different two pixels must be to count as "different".
    // Higher = more tolerant of minor colour shifts (anti-aliasing, subpixel
    // rendering); lower = stricter. 0.2 is a sensible default.
    const diffPixels = pixelmatch(
      baseline.data, actual.data, diff.data,
      width, height,
      { threshold: 0.2 },
    );

    fs.writeFileSync(diffPath, PNG.sync.write(diff));

    // Allow up to 2% of pixels to differ before failing — small enough to
    // catch real regressions, big enough to forgive minor renderer noise.
    const diffRatio = diffPixels / (width * height);
    if (diffRatio > 0.02) {
      throw new Error(
        `Visual regression detected: ${diffPixels} pixels differ (${(diffRatio * 100).toFixed(6)}%). Diff saved to ${diffPath}`
      );
    }
  }


}