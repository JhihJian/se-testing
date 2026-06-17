# 验证夹具

## 职责

验证夹具用于证明能力包能在真实 Playwright 目录结构中跑通，不参与业务项目运行时架构。

当前有两份同类夹具：

- `se-testing/examples/login-fixture/`：插件内 dogfood 示例。
- `e2e-fixture-project/`：根目录独立端到端夹具项目。

两者都实现虚构业务“星河协作台”的登录成功路径，包含意图、spec、fixture、Page Object、Playwright 配置和本地 HTTP 示例应用。

## 夹具应用

夹具应用位于 `app/server.mjs`，用 Node `http` 模块提供：

- `GET /health` 健康检查。
- `GET /login` 登录页。
- `POST /login` 校验用户名和密码，通过后写入 session cookie 并跳转 `/dashboard`。
- `GET /dashboard` 需要 session，展示顶栏欢迎语。

Playwright `webServer` 会启动该应用，并在 `/health` 可用后执行测试。

## dogfood 脚本

`se-testing/tools/run-dogfood.mjs` 会：

1. 确保 `examples/login-fixture` 已安装 Playwright 测试依赖。
2. 寻找可用端口并设置 `E2E_BASE_URL`、`E2E_PORT`、`E2E_VALID_PASSWORD`。
3. 运行夹具项目的 Playwright 测试。
4. 运行 `validate-intention` 和 `check-binding`。
5. 根据 Playwright JSON 结果和两个校验脚本输出重写夹具 `report.md`。

## 边界

夹具内的登录业务、用户名、欢迎语和本地服务不是 `se-testing` 的核心领域模型。它们只用于验证能力包和模板约定是否自洽。
