# 业务测试模板

## 职责

`se-testing/template/` 是复制到业务项目的测试资产骨架。复制后，业务项目拥有自己的意图、spec、fixture、Page Object 和报告文件；`se-testing` 只继续作为能力包和校验工具来源。

## 目录结构

- `intentions/login-success.yaml`：示例 active 意图，展示版本、状态、业务上下文、fixture 声明和 assertion。
- `specs/login-success.spec.ts`：示例 Playwright spec，首行绑定意图版本，并用 `// assertion: <id>` 标记三条断言。
- `support/fixtures/users.json`：示例用户数据，密码以 `<from-env:E2E_VALID_PASSWORD>` 表达来源，不在 fixture 中保存真实密码。
- `support/pages/login.page.ts`：登录 Page Object，封装选择器和登录动作。
- `playwright.config.ts`：Playwright 配置，写出 list、JSON、HTML 三类报告，并在失败时保留 trace。
- `report.md`：可审计报告模板，要求填满意图链、两个校验脚本输出、diff 摘要和 Playwright 证据。

## 运行方式

业务项目运行测试时，Playwright 读取 `E2E_BASE_URL`，默认指向 `http://localhost:3000`。示例 spec 从 fixture 读取用户名和展示名，从环境变量读取有效密码。

校验命令从业务项目根执行：

```powershell
node <se-testing-root>\tools\validate-intention.mjs .
node <se-testing-root>\tools\check-binding.mjs .
```

## 边界

模板不是业务规范本身。业务项目应按自身需求维护 `intentions/` 与 `specs/`，但必须保留意图 schema、spec 绑定头、assertion 标记和报告证据这些架构契约。

选择器或页面结构变化属于执行层问题，优先修改 Page Object；业务真相变化属于意图层问题，需要人类裁决并同步意图版本。
