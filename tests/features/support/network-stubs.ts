// network-stubs.ts — reusable page.route() helpers for the Dyson tests.
//
// These keep the Before hook in world.ts readable: instead of a big inline
// route handler, each scenario just maps a tag to a mode and this file owns the
// network trickery. Two helpers live here:
//
//   stubCertifications(page, mode) — intercepts the Certifications tab's data
//     request and forces a chosen outcome (renamed item, empty, 500, dropped
//     connection, slow response, or a malformed payload). Lets us test edge
//     cases the live API won't produce on demand.
//
//   blockAnalytics(page) — aborts analytics / consent / third-party requests so
//     we can prove the page still works without that non-essential traffic.

import { Page } from "playwright";

// A fake certification name injected by the "rename" mode. The feature file
// checks for this exact text, so if you change it here, change it there too.
// It's deliberately not a real name — if the test sees it, we know our fake
// data (the "stub") was used instead of Dyson's live data.
export const STUBBED_CERTIFICATION_NAME = "Stubbed Test Certification";

// How long the "slow" mode holds the response back before delivering it. Kept
// comfortably under the 30s wait in openCertificationsTab and the 60s step
// timeout, so the tab still receives its data and the test asserts a successful
// (if delayed) render rather than a timeout.
const SLOW_CERT_DELAY_MS = 3000;

// The outcomes stubCertifications can force on the Certifications tiles request.
//   rename    — rename the first certification to STUBBED_CERTIFICATION_NAME.
//   empty     — return no certifications (the "no results" empty state).
//   error     — fail with HTTP 500 (a server error).
//   abort     — drop the connection so no response ever arrives.
//   slow      — deliver the real response after a deliberate delay.
//   malformed — reply 200 OK but with a broken body (paginatedResponse: null).
export type CertStubMode =
  | "rename"
  | "empty"
  | "error"
  | "abort"
  | "slow"
  | "malformed";

// Intercepts the GraphQL request that fills the Certifications tab and forces
// the chosen outcome.
//
// Tricky part (unchanged from the original inline version): two different
// requests share the operation name "certifications" — one loads the filter
// options, the other loads the result tiles. We must only touch the tiles one;
// failing the filter-options request would break the page before the tab even
// appears. We tell them apart by shape: only the tiles response carries a
// paginatedResponse. So we fetch the real response first, find that entry, and
// only then act on it.
export async function stubCertifications(
  page: Page,
  mode: CertStubMode,
): Promise<void> {
  await page.route("**/api.source.thenbs.com/graphql", async (route) => {
    const reqBody = JSON.parse(route.request().postData() || "[]");
    const ops = (Array.isArray(reqBody) ? reqBody : [reqBody]).map(
      (o) => o.operationName,
    );
    // Not a certifications batch — pass it straight through.
    if (!ops.includes("certifications")) return route.continue();

    // Fetch the real response so we can (a) identify the tiles request by its
    // shape and (b) give the data-transforming modes something real to work
    // from. The fabricating modes (error/abort/malformed) discard it.
    const response = await route.fetch();
    let json;
    try {
      json = await response.json();
    } catch {
      return route.fulfill({ response });
    }
    const arr = Array.isArray(json) ? json : [json];
    const tileEntry = arr.find((entry) =>
      Array.isArray(
        entry?.data?.certifications?.byBrandId?.paginatedResponse?.items,
      ),
    );

    // This batch is the filter-options request, not the result tiles — always
    // let it through untouched so the page loads normally.
    if (!tileEntry) return route.fulfill({ response, json: arr });

    switch (mode) {
      // Make only the tiles request fail with a 500 so we can test how the app
      // handles a server error. The rest of the page still loads.
      case "error":
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            errors: [{ message: "Internal Server Error" }],
          }),
        });

      // Drop the connection: the browser never receives a response at all,
      // which is a different failure from a 500 (no response vs. an error
      // response). "connectionreset" mimics the connection being severed.
      case "abort":
        return route.abort("connectionreset");

      // 200 OK but a broken body — paginatedResponse is null, so the field the
      // UI relies on to render tiles is missing. The classic "the request
      // succeeded but the data is unusable" case. We keep the response shape
      // (array vs. object) so only the data is wrong, not the envelope.
      case "malformed": {
        const brokenEntry = {
          data: { certifications: { byBrandId: { paginatedResponse: null } } },
        };
        const brokenBody = Array.isArray(json)
          ? json.map((entry) => (entry === tileEntry ? brokenEntry : entry))
          : brokenEntry;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(brokenBody),
        });
      }

      // Hold the real response back, then deliver it — proves the tab tolerates
      // a slow backend and still renders rather than erroring or giving up.
      case "slow":
        await new Promise((resolve) => setTimeout(resolve, SLOW_CERT_DELAY_MS));
        return route.fulfill({ response, json: arr });

      // Transform the real tiles in place: blank the list, or rename the first.
      case "empty":
      case "rename":
        for (const entry of arr) {
          const pr =
            entry?.data?.certifications?.byBrandId?.paginatedResponse;
          if (!pr || !Array.isArray(pr.items)) continue;
          if (mode === "empty") {
            pr.items = [];
            // Keep the total consistent so the UI commits to the empty state.
            if (typeof pr.totalItems === "number") pr.totalItems = 0;
          } else if (pr.items.length) {
            pr.items[0].name = STUBBED_CERTIFICATION_NAME;
          }
        }
        return route.fulfill({ response, json: arr });
    }
  });
}

// Hostnames whose requests we treat as analytics / consent / third-party noise.
// Blocking these proves the page doesn't depend on them to function, and is the
// real-world use of route.abort(): keeping flaky third-party traffic out of the
// test. We match on a substring of the hostname so subdomains are covered too.
const ANALYTICS_HOSTS = [
  "googletagmanager.com",
  "google-analytics.com",
  "analytics.google.com",
  "googleadservices.com",
  "doubleclick.net",
  "facebook.com",
  "facebook.net",
  "hotjar.com",
  "hotjar.io",
  "clarity.ms",
  "segment.com",
  "segment.io",
  "onetrust.com",
  "cookielaw.org",
  "linkedin.com",
  "licdn.com",
  "bing.com",
];

// Aborts every request to a known analytics / consent / third-party host. Set
// this up before navigation (in the Before hook) so the blocks are in place as
// the page loads. Requests to the app's own domains are untouched.
export async function blockAnalytics(page: Page): Promise<void> {
  await page.route(
    (url) => ANALYTICS_HOSTS.some((host) => url.hostname.includes(host)),
    (route) => route.abort(),
  );
}
