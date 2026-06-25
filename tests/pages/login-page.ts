// login-page.ts — page object for the NBS Source sign-in form.
//
// The "Sign in" button in the header (which opens this form) appears on every
// page, so it lives in BasePage, not here. This page object covers only the
// form's fields and its submit button, which appear once sign-in has started.
// The single signIn() method runs through the whole normal sign-in sequence.

import { Page, Locator } from "@playwright/test";

export class LoginPage {
  readonly page: Page;
  readonly emailField: Locator;
  readonly nextButton: Locator;
  readonly passwordField: Locator;
  // The form's submit button has the same name ("Sign in") as the header
  // button. That's fine: by the time we use this, the header button has been
  // replaced by the form, so Playwright finds the form's button without any
  // extra targeting.
  readonly submitSignInButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailField = page.getByRole("textbox", { name: "Email address" });
    this.nextButton = page.getByRole("button", { name: "Next" });
    this.passwordField = page.getByRole("textbox", { name: "Password" });
    this.submitSignInButton = page.getByRole("button", { name: "Sign in" });
  }

  // Runs the full sign-in flow: enter email, click Next, enter password, click
  // Sign in. Waits for the network to go quiet at the end so any redirects or
  // header updates after login have settled before the test checks anything.
  async signIn(email: string, password: string) {
    await this.emailField.fill(email);
    await this.nextButton.click();
    await this.passwordField.fill(password);
    await this.submitSignInButton.click();
    await this.page.waitForLoadState("networkidle", { timeout: 30000 });
  }
}