// base-page.ts — Base Page Object Model shared across all pages.
//
// Contains locators and methods that are common to every page in the test suite.
// Other page objects do not extend this class — they are instantiated separately
// and used alongside it. Any assertion or action that applies site-wide (URL checks,
// page title, logo, accessibility) belongs here rather than in a specific page object.

import { Page, Locator } from "@playwright/test";
import { expect as playwrightExpect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { chromium } from "playwright";
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

  // Asserts the current URL contains the expected substring, retrying for up
  // to 10s. Playwright's toHaveURL auto-waits and auto-retries internally —
  // matching the previous hand-rolled polling loop but with better error
  // messages, trace integration, and no manual timing code.
  //
  // Substring semantics are preserved by escaping the input into a RegExp,
  // because toHaveURL(string) does an EXACT match, not a contains. Callers
  // (and the matching feature file step) pass either full URLs or path
  // fragments and rely on the contains behaviour.
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
    //    from final paints, CSS transitions, or skeleton fade-outs. Uses a
    //    plain setTimeout rather than page.waitForTimeout because the latter
    //    is discouraged by Playwright (it's a code smell in real tests, but
    //    intentional here to absorb sub-frame paint variance).
    await new Promise((resolve) => setTimeout(resolve, 500));

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

  // Runs a Lighthouse audit against the URL the page is currently on and
  // fails the scenario if any supplied category score falls below its
  // threshold.
  //
  // Why this method launches its own Chrome instead of reusing
  // Playwright's browser:
  //
  // playwright-lighthouse + Playwright share a single Chromium over CDP.
  // Two clients on one connection fight over the navigation lifecycle:
  // Lighthouse issues Page.navigate, Playwright's connection cancels the
  // in-flight request, and the audit returns FAILED_DOCUMENT_REQUEST
  // with all-zero scores. No amount of pipe vs port, persistent context,
  // or page juggling fixes the underlying conflict.
  //
  // Instead we:
  //   1. Capture the target URL from Playwright's already-navigated page.
  //   2. Spawn a separate Chrome process via chrome-launcher (Lighthouse's
  //      official launcher) using Playwright's bundled Chromium binary —
  //      no system Chrome required, no version surprises.
  //   3. Run lighthouse() directly against that isolated Chrome.
  //   4. Kill the audit Chrome regardless of outcome.
  //
  // Parameters:
  //   thresholds — minimum acceptable Lighthouse scores per category (0-100).
  //                Categories not listed are not enforced. Keep these
  //                conservative when auditing a third-party live site:
  //                external content (CDN images, ads, fonts) drives perf
  //                scores up and down between runs and would flake an
  //                aggressive threshold.
  //   reportName — filename stem for the generated HTML report under reports/.
  async runLighthouseAudit(
    thresholds: {
      performance?: number;
      accessibility?: number;
      "best-practices"?: number;
      seo?: number;
      pwa?: number;
    },
    reportName: string = "lighthouse-report",
    urlOverride?: string,
  ) {
    // 1. Choose the URL to audit. Defaults to whatever URL Playwright's
    //    page is currently on (so the Background's navigation drives the
    //    target by default). Callers can pass urlOverride to audit a
    //    different page — e.g. when the page Playwright navigated to has
    //    SPA-redirect behaviour that makes Lighthouse abort with
    //    FAILED_DOCUMENT_REQUEST. The Dyson manufacturer page on NBS
    //    Source is one such page; the homepage is a stable alternative.
    const auditUrl = urlOverride ?? this.page.url();

    // 2. Dynamic imports keep these heavy modules out of the hot path
    //    for non-lighthouse scenarios. lighthouse is ESM-only so we use
    //    .default to get the callable. chrome-launcher is exposed via
    //    its `launch` export.
    const lighthouse = (await import("lighthouse")).default;
    const { launch: launchChrome } = await import("chrome-launcher");

    // 3. Spawn an isolated Chrome process. chromePath points at the
    //    Chromium binary Playwright already downloaded — guarantees a
    //    version Lighthouse 13 supports without requiring a system
    //    Chrome install.
    //
    //    Headed (no --headless flag) intentionally: NBS Source detects
    //    --headless=new and aborts the navigation with
    //    net::ERR_ABORTED, which is why the same audit run from Chrome
    //    DevTools (headed) succeeds while a headless equivalent fails.
    //    A short-lived Chrome window will appear during the audit;
    //    that's expected. For CI we'd revisit this with anti-detection
    //    flags or a non-headless-detectable build.
    const chrome = await launchChrome({
      chromePath: chromium.executablePath(),
      chromeFlags: [
        "--no-sandbox",
        "--disable-gpu",
      ],
    });

    try {
      // 4. Run Lighthouse against the isolated Chrome via its DevTools
      //    port. No Playwright connection is competing for control —
      //    Lighthouse owns the navigation lifecycle end-to-end.
      const result = await lighthouse(auditUrl, {
        port: chrome.port,
        output: "html",
        logLevel: "error",
      });

      if (!result) {
        throw new Error("Lighthouse audit returned no result.");
      }

      // 5. Persist the HTML report so failures can be debugged visually.
      //    lighthouse() returns either a string or a string[] depending
      //    on the `output` option shape — we requested a single format
      //    so pick the first if it came back as an array.
      fs.mkdirSync("reports", { recursive: true });
      const report = Array.isArray(result.report)
        ? result.report[0]
        : result.report;
      fs.writeFileSync(path.join("reports", `${reportName}.html`), report);

      // 6. Threshold check. lighthouse scores are 0-1 floats (or null
      //    when a category errors); thresholds are 0-100 ints, so we
      //    convert before comparing. A null score is treated as 0 — the
      //    same way playwright-lighthouse did it — so a broken audit
      //    fails loudly rather than silently passing.
      const failures: string[] = [];
      for (const [category, minScore] of Object.entries(thresholds)) {
        const rawScore = result.lhr.categories[category]?.score;
        const actualScore =
          rawScore === null || rawScore === undefined
            ? 0
            : Math.round(rawScore * 100);
        if (actualScore < (minScore as number)) {
          failures.push(
            `${category} scored ${actualScore}, below threshold ${minScore}`,
          );
        }
      }

      if (failures.length > 0) {
        throw new Error(
          `Lighthouse thresholds not met:\n  ${failures.join("\n  ")}\n` +
            `Full report: reports/${reportName}.html`,
        );
      }
    } finally {
      // 7. Always tear down the audit Chrome — even if lighthouse threw —
      //    so we don't leak a Chromium process per failed run.
      //
      //    Wrapped in try/catch because chrome-launcher's destroyTmp step
      //    hits EPERM on Windows when the just-killed Chrome is still
      //    releasing file handles in the temp user-data dir. That's a
      //    cleanup quirk, not a real failure — letting it bubble would
      //    mask any real audit failure (the throw inside try) AND fail
      //    otherwise-passing runs purely on Windows.
      try {
        await chrome.kill();
      } catch (cleanupError) {
        console.warn(
          "Lighthouse audit Chrome cleanup hit a non-fatal error " +
            "(safe to ignore on Windows):",
          cleanupError,
        );
      }
    }
  }
}