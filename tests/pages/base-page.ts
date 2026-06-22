// base-page.ts — shared page object used alongside all the others.
//
// Holds the elements and actions that are the same on every page (URL checks,
// page title, the logo, accessibility scans, etc.). The other page objects don't
// extend this one — they're created separately and used next to it. If something
// applies to the whole site rather than one specific page, it belongs here.

import { Page, Locator } from "@playwright/test";
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
  // The NBS Source logo link. The selector finds the link inside the logo
  // component only when its name text reads "NBS Source".
  readonly nbsLogoLink: Locator;
  // The "Sign in" button in the header, shown on every page until the user logs
  // in. It lives here (not on LoginPage) because it's part of the site-wide header.
  readonly signInButton: Locator;
  // The header elements shown once logged in — the user-menu button and the
  // avatar showing the account's initials. They replace the Sign in button
  // after a successful login.
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

  // Checks the current URL contains the expected text, retrying for up to 10s.
  // Playwright's toHaveURL waits and retries on its own, so we don't need a
  // manual polling loop, and we get clearer error messages if it fails.
  //
  // We turn the expected text into a regular expression so it matches as
  // "contains" rather than "equals" — toHaveURL with a plain string would
  // require an exact match, but callers pass either full URLs or just path
  // fragments and expect a contains check. The escaping step makes any special
  // characters in the text be treated as plain text rather than regex symbols.
  async verifyWebpageURL(expectedURL: string) {
    const escaped = expectedURL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    await playwrightExpect(this.page).toHaveURL(new RegExp(escaped), {
      timeout: 10000,
    });
  }

  // Verifies the h1 element is visible and contains the expected text.
  async verifyH1(title: string) {
    await playwrightExpect(this.h1).toBeVisible();
    await playwrightExpect(this.h1).toHaveText(title);
  }

  // Checks the browser tab's <title> matches the expected text. Allows 10s
  // because some pages set their title shortly after they first load.
  async verifyWebpageTitle(title: string) {
    await playwrightExpect(this.page).toHaveTitle(title, { timeout: 10000 });
  }

  // Verifies the NBS Source logo anchor has the expected href attribute value.
  async logoHref(href: string) {
    await playwrightExpect(this.nbsLogoLink).toHaveAttribute("href", href);
  }

  // Checks the header shows a logged-in user: the Sign in button is gone, the
  // user-menu button is showing, and the avatar shows the expected initials.
  async verifyLoggedInUI() {
    await playwrightExpect(this.signInButton).toBeHidden();
    await playwrightExpect(this.openUserMenuButton).toBeVisible();
    await playwrightExpect(this.userInitials).toContainText("TH");
  }

  // Runs an Axe accessibility scan against the current page and writes the
  // results to an HTML report under reports/. Open that file to review any
  // violations. An optional slug gives the report its own filename
  // (accessibility-report-<slug>.html) so scans of different pages don't
  // overwrite each other; with no slug it falls back to accessibility-report.html.
  async generateAccessibilityReport(reportSlug?: string) {
    const accessibilityScanResults = await new AxeBuilder({
      page: this.page,
    }).analyze();
    // doNotCreateReportFile stops the reporter writing its own copy and logging
    // a generic message — we save the file and log a clearer one ourselves.
    const html = createHtmlReport({
      results: accessibilityScanResults,
      options: { doNotCreateReportFile: true },
    });
    fs.mkdirSync("reports", { recursive: true });
    const reportFile = reportSlug
      ? `reports/accessibility-report-${reportSlug}.html`
      : "reports/accessibility-report.html";
    const reportPath = path.resolve(reportFile);
    fs.writeFileSync(reportPath, html);
    console.info(
      `Accessibility report was saved into the following directory ${reportPath}`,
    );
  }

  // Forces "lazy-loaded" images to start loading by scrolling down the page a
  // screen at a time, then scrolling back to the top. Many sites only load an
  // image once it scrolls into view, and a full-page screenshot can otherwise
  // capture them before they finish. The 250ms pause at each step gives the page
  // time to notice the scroll and begin downloading — without it we'd scroll
  // past each position before loading kicks in.
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

  // Waits until every <img> on the page has finished — whether it loaded
  // successfully, failed (e.g. a 404), or had no source at all. We check
  // img.complete, which the browser sets to true in all of those cases. We don't
  // treat broken images as blockers, because waiting forever would just hang the
  // test (an earlier check accidentally did this). By the time this runs, the
  // "network idle" wait has already given every image a chance to download.
  async waitForImagesLoaded(timeout: number = 15000) {
    await this.page.waitForFunction(
      () => Array.from(document.images).every((img) => img.complete),
      undefined,
      { timeout },
    );
  }

  // Takes a full-page screenshot and compares it, pixel by pixel, against a
  // saved "baseline" image to catch visual changes we didn't mean to make
  // (shifted layouts, missing images, swapped fonts, colour changes, etc.).
  //
  // How it works (top to bottom):
  //   1. Wait for the elements the caller says must be on screen — the page-
  //      specific bits (hero banner, product grid, etc.) that prove the page is
  //      ready. BasePage doesn't know what each page contains, so callers pass
  //      these in.
  //   2. Scroll the whole page to start loading lazy images. Without this the
  //      screenshot can capture empty placeholder boxes.
  //   3. Wait for the network to go quiet so those images actually finish
  //      downloading. Scrolling only *starts* the downloads; this waits for
  //      them to *finish*.
  //   4. Extra safety check that every <img> is loaded and ready.
  //   5. Wait for web fonts to load. Text shown in a fallback font is a slightly
  //      different size and would cause a false difference.
  //   6. A short pause to let any final animation or repaint settle.
  //   7. Take the screenshot and compare it to the baseline using pixelmatch.
  //
  // Files written to tests/snapshots/:
  //   <name>.png         — the baseline (commit this; it's the "correct" image)
  //   <name>-actual.png  — what the page looked like on this run
  //   <name>-diff.png    — an image highlighting where the two differ (in pink)
  //
  // First run: there's no baseline yet, so we save the current screenshot as the
  // baseline and stop. Run it again to actually compare against it.
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

    // 4. Extra check that every <img> reports as loaded. This is "soft" — on
    //    pages that keep adding new <img> tags (carousels, ads, trackers) it may
    //    never settle, so if it times out we just log the stragglers and carry
    //    on. Step 3 (network idle) is the real safety net for image downloads.
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

    // 5. Wait for web fonts. document.fonts.ready finishes once the fonts the
    //    page uses have loaded. (Playwright waits for the returned promise.)
    await this.page.evaluate(() => document.fonts.ready);

    // 6. A short pause to absorb tiny last-moment changes (final repaints, CSS
    //    transitions, loading skeletons fading out) that could otherwise show
    //    up as differences. We use a plain setTimeout here on purpose —
    //    Playwright discourages fixed waits in normal tests, but a small one is
    //    justified for smoothing out paint timing right before a screenshot.
    await new Promise((resolve) => setTimeout(resolve, 500));

    // --- Work out the file paths ---
    // We keep a separate baseline per operating system because Windows and Linux
    // render text slightly differently, which changes wrapping and overall page
    // height. process.platform is "win32" locally and "linux" on GitHub Actions,
    // so each environment compares against its own baseline. Commit both
    // baselines; CI will fail if its baseline is missing on the second run.
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
      // Attach the diff image's path to the error so the After hook can put that
      // image in the report. A normal screenshot would only show the current
      // page, not what actually changed — the diff image does.
      const error = new Error(
        `Visual regression detected: ${diffPixels} pixels differ (${(diffRatio * 100).toFixed(6)}%). Diff saved to ${diffPath}`
      );
      (error as Error & { diffPath?: string }).diffPath = diffPath;
      throw error;
    }
  }

}