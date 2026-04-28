// world.ts — Cucumber world configuration and lifecycle hooks.
//
// The "world" is Cucumber's equivalent of a test fixture. An instance of CustomWorld
// is created fresh for every scenario, giving each test its own isolated browser,
// page, and page object instances. The Before and After hooks handle setup and
// teardown automatically so step definitions don't need to manage the browser directly.

// Loads variables from .env into process.env on module import, so any step
// definition can read TEST_EMAIL / TEST_PASSWORD without each file re-configuring dotenv.
import "dotenv/config";
import { setWorldConstructor, Before, After, IWorldOptions, World } from "@cucumber/cucumber";
import { Browser, BrowserContext, Page, chromium } from "playwright";
import { HomePage } from "../../pages/home-page";
import { DysonHomepage } from "../../pages/dyson-homepage";
import { BasePage } from "../../pages/base-page";
import { LoginPage } from "../../pages/login-page";

// CustomWorld extends Cucumber's base World class and holds all shared state for a scenario.
// Properties are declared here so step definitions can access them via `this`.
export class CustomWorld extends World {
  browser!: Browser;
  context!: BrowserContext;
  page!: Page;
  homePage!: HomePage;
  dysonPage!: DysonHomepage;
  basePage!: BasePage;
  loginPage!: LoginPage;
  // Holds the URL captured just before sign-in so a later step can assert
  // the user is returned to the same page. Optional because not every
  // scenario sets it.
  capturedUrl?: string;

  constructor(options: IWorldOptions) {
    super(options);
  }
}

// Registers CustomWorld as the world constructor so Cucumber uses it for every scenario.
setWorldConstructor(CustomWorld);

// Runs before each scenario — launches a fresh browser, creates an isolated context
// and page, then instantiates all page objects against that page.
Before(async function (this: CustomWorld) {
  this.browser = await chromium.launch();
  this.context = await this.browser.newContext();
  this.page = await this.context.newPage();
  this.homePage = new HomePage(this.page);
  this.dysonPage = new DysonHomepage(this.page);
  this.basePage = new BasePage(this.page);
  this.loginPage = new LoginPage(this.page);
});

// Runs after each scenario — closes the browser context and browser to free resources.
// Optional chaining (?.) prevents errors if setup failed before these were assigned.
After(async function (this: CustomWorld) {
  await this.context?.close();
  await this.browser?.close();
});