# 更新日志

## 0.2.0 - 2026-06-23

- 新增 `testing-journey` skill，用 `intentions/journeys/*.yaml` 描述同一业务路径下的分支、公共前置条件、已覆盖 intent 和已知缺口。
- 新增 `testing-intent-visualization` skill，指导把 intentions 与 journeys 展示成可人工阅览的测试意图树，并将已有结构与可能漏掉的意图识别分开。
- 为 `testing-intent-visualization` 增加自包含 HTML 静态页面示例，供没有现成页面时参考实现。
- 新增 `check-intentions.mjs`，严格校验意图的 `priority`、`precondition`、`edge_cases`、`tags`、kebab-case 标识和空泛断言描述。
- 新增 `check-journeys.mjs`，校验 journey schema、intent 引用、spec 不直接绑定 journey，并输出可审查 warning。
- 增强 `validate-intention` / `check-binding` 的资产读取能力，支持 `intentions/<domain>/*.yaml`、`tests/intentions` 资产根，并排除 `intentions/journeys`。
- 更新 `testing-run` 流程，收工前要求保留 `validate-intention`、`check-intentions`、`check-journeys`、`check-binding` 四类机器证据，并支持长输出 artifact 索引。
- 更新模板、dogfood 示例、subagent 说明和跨运行时入口映射，使文档、示例和工具能力保持一致。

## 0.1.0 - 2026-06-17

- 初始 MVP：提供 testing-intent、testing-spec、testing-run 三个 skill。
- 提供 `validate-intention.mjs` 与 `check-binding.mjs` 两个审计脚本。
- 提供 Playwright 模板、登录 dogfood 示例和 Codex plugin manifest。
