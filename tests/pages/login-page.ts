// login-page.ts — Page Object Model for the NBS Source sign-in form.
//
// The header Sign in button (which opens this form) lives on every page
// and therefore belongs in BasePage, not here. This POM covers only the
// form fields and final submit button that appear once the sign-in flow
// has started. A single signIn() method runs the whole happy-path sequence.

import { Page, Locator } from "@playwright/test";

export class LoginPage {
  readonly page: Page;
  readonly emailField: Locator;
  readonly nextButton: Locator;
  readonly passwordField: Locator;
  // The form's submit button shares its accessible name ("Sign in") with
  // the header button. By the time this locator is used the header button
  // has been replaced by the form, so Playwright's actionability wait
  // resolves to the form submit without needing additional scoping.
  readonly submitSignInButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailField = page.getByRole("textbox", { name: "Email address" });
    this.nextButton = page.getByRole("button", { name: "Next" });
    this.passwordField = page.getByRole("textbox", { name: "Password" });
    this.submitSignInButton = page.getByRole("button", { name: "Sign in" });
  }

  // Runs the full sign-in flow: email → Next → password → Sign in.
  // Waits for network idle at the end so any post-login redirects or
  // header re-renders have settled before the calling step asserts state.
  async signIn(email: string, password: string) {
    await this.emailField.fill(email);
    await this.nextButton.click();
    await this.passwordField.fill(password);
    await this.submitSignInButton.click();
    await this.page.waitForLoadState("networkidle", { timeout: 30000 });
  }
}