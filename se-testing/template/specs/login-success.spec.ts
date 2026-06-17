// intention: login-success.yaml (v1)
//
// 头部一行是意图↔spec 的绑定锚点：check-binding 解析 `(v1)` 与意图 yaml 的 version 比对，
// 漂移即报错。修改本 spec 覆盖的业务时，MUST 同步意图与此处版本号。
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { LoginPage } from "../support/pages/login.page";

// fixtures 是唯一数据来源；spec 内 MUST NOT 出现硬编码业务数据。
const users = JSON.parse(
  readFileSync(fileURLToPath(new URL("../support/fixtures/users.json", import.meta.url)), "utf8")
);
const password = process.env.E2E_VALID_PASSWORD ?? "";

test.describe("login-success", () => {
  test("正确凭证登录后进入仪表盘并显示欢迎语", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(users.validUser.username, password);

    // assertion: redirect-dashboard
    await expect(page).toHaveURL(/\/dashboard$/);

    // assertion: greet-user
    // 文案取自 fixture，对齐意图占位符 {{users.validUser.name}}
    await login.expectGreetingContains(users.validUser.name);

    // assertion: session-persisted
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
