import { setWorldConstructor, Before, After, IWorldOptions, World } from "@cucumber/cucumber";
import { Browser, BrowserContext, Page, chromium } from "playwright";
import { HomePage } from "../../pages/home-page";
import { DysonHomepage } from "../../pages/dyson-homepage";
import { BasePage } from "../../pages/base-page";

export class CustomWorld extends World {
  browser!: Browser;
  context!: BrowserContext;
  page!: Page;
  homePage!: HomePage;
  dysonPage!: DysonHomepage;
  basePage!: BasePage;

  constructor(options: IWorldOptions) {
    super(options);
  }
}

setWorldConstructor(CustomWorld);

Before(async function (this: CustomWorld) {
  this.browser = await chromium.launch();
  this.context = await this.browser.newContext();
  this.page = await this.context.newPage();
  this.homePage = new HomePage(this.page);
  this.dysonPage = new DysonHomepage(this.page);
  this.basePage = new BasePage(this.page);
});

After(async function (this: CustomWorld) {
  await this.context?.close();
  await this.browser?.close();
});
