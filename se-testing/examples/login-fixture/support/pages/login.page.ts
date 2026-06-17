import { expect, type Locator, type Page } from "@playwright/test";

export class LoginPage {
  readonly page: Page;
  readonly username: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly greeting: Locator;

  constructor(page: Page) {
    this.page = page;
    this.username = page.getByLabel("用户名");
    this.password = page.getByLabel("密码");
    this.submit = page.getByRole("button", { name: "登录" });
    this.greeting = page.getByTestId("topbar-greeting");
  }

  async goto() {
    await this.page.goto("/login");
  }

  async login(username: string, password: string) {
    await this.username.fill(username);
    await this.password.fill(password);
    await this.submit.click();
  }

  async expectGreetingContains(text: string) {
    await expect(this.greeting).toContainText(text);
  }
}
