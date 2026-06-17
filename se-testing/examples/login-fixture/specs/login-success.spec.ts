// intention: login-success.yaml (v1)
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { LoginPage } from "../support/pages/login.page";

const users = JSON.parse(
  readFileSync(fileURLToPath(new URL("../support/fixtures/users.json", import.meta.url)), "utf8")
);
const password = process.env.E2E_VALID_PASSWORD ?? "correct-horse";

test.describe("login-success", () => {
  test("正确凭证登录后进入仪表盘并保持会话", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(users.validUser.username, password);

    // assertion: redirect-dashboard
    await expect(page).toHaveURL(/\/dashboard$/);

    // assertion: greet-user
    await login.expectGreetingContains(users.validUser.name);

    // assertion: session-persisted
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard$/);
    await login.expectGreetingContains(users.validUser.name);
  });
});
