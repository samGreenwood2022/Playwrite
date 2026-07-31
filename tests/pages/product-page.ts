// product-page.ts — page object for a product detail page.
//
// Product pages are reached directly by URL rather than by driving the site's
// search box. See navigateToProduct below for why.

import { Page } from "@playwright/test";

// Products are addressed by id rather than by anything derived from their name,
// so these paths survive a product being renamed. Keeping them in one map means
// a scenario refers to a product the way a person would and only this file
// knows the URL.
//
// The name used as the key is the product's h1 minus the ™, which keeps it
// typeable in a feature file. The HU03 suffix is worth keeping: the Airblade V
// (HU02) sits in the same category, so an unqualified "Dyson Airblade" would be
// ambiguous to whoever adds the next product here.
//
// Note the URL carries two ids — the product, then the specific listing beneath
// it. Both are stable keys.
const PRODUCT_PATHS: Record<string, string> = {
  "Dyson Airblade 9kJ Hand Dryer (HU03)":
    "/en/gb/product/dyson-airblade-9kj-hand-dryer-hu03/fmdLoC3ZGuYUyy8pKSG7Au/jmJPorRKb1DV8KXyP2uCS3",
};

export class ProductPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // Goes straight to a product page by name.
  //
  // Direct navigation rather than driving the site's search box. The ids in the
  // URL are stable primary keys, so this is no more brittle than searching for
  // the product — and it drops a dependency on the live search index returning
  // the right result, ranked first, within the timeout. It's also several
  // seconds quicker per scenario. Same approach as
  // AbloyHomepage.navigateToAbloyHomepage.
  //
  // Deliberately does NOT wait for the breadcrumbs here. They're what the
  // breadcrumb scenario is testing, so waiting on them during navigation would
  // report a missing breadcrumb bar as a navigation timeout instead of as the
  // assertion failure it is. The assertions do their own waiting.
  //
  // An unknown name throws with the list of known products, because the
  // alternative — navigating to "https://source.thenbs.comundefined" — fails
  // much later and much less clearly.
  async navigateToProduct(productName: string) {
    const path = PRODUCT_PATHS[productName];
    if (!path) {
      throw new Error(
        `Unknown product "${productName}". Known products: ` +
          `${Object.keys(PRODUCT_PATHS).join(", ")}.`,
      );
    }
    await this.page.goto(`https://source.thenbs.com${path}`, {
      timeout: 60000,
      waitUntil: "domcontentloaded",
    });
  }
}
