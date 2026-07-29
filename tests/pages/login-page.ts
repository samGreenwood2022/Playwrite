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
  // The user-menu button that replaces the header's "Sign in" button once login
  // succeeds. We wait on this to know sign-in finished. BasePage declares the
  // same locator for its assertions; this copy exists so signIn() doesn't need a
  // BasePage instance just to wait for one element.
  readonly userMenuButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailField = page.getByRole("textbox", { name: "Email address" });
    this.nextButton = page.getByRole("button", { name: "Next" });
    this.passwordField = page.getByRole("textbox", { name: "Password" });
    this.submitSignInButton = page.getByRole("button", { name: "Sign in" });
    this.userMenuButton = page.getByRole("button", { name: "Open user menu" });
  }

  // Runs the full sign-in flow: enter email, click Next, enter password, click
  // Sign in, then wait for the header's user menu to appear.
  //
  // We wait for that button rather than for the network to fall quiet
  // ("networkidle"). This site never goes fully quiet — analytics, polling and
  // lazy images keep requests flowing — so a networkidle wait just burns its
  // full timeout and then fails, even though sign-in worked. Waiting for the
  // user menu is the real "we're logged in now" signal: it usually resolves in a
  // couple of seconds, and if it times out the message actually tells you
  // sign-in didn't complete.
  async signIn(email: string, password: string) {
    await this.emailField.fill(email);
    await this.nextButton.click();
    await this.passwordField.fill(password);
    await this.submitSignInButton.click();
    await this.userMenuButton.waitFor({ state: "visible", timeout: 30000 });
  }
}