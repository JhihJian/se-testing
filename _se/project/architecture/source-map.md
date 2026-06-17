# 来源映射

记录架构结论与输入资料的对应关系。

| 结论 | 来源 | 状态 |
|---|---|---|
| 项目主体是 `se-testing` 能力包，面向 Codex Agent 自主测试闭环。 | `se-testing/README.md`、`se-testing/.codex-plugin/plugin.json` | 已确认 |
| 项目采用“壳与核”分层：skills/agents 是流程壳，tools/template 是可移植核心。 | `STANDALONE_DESIGN.md` 第 3 节、`se-testing/README.md` | 已确认 |
| Codex plugin 通过 manifest 暴露 skills 和界面提示。 | `se-testing/.codex-plugin/plugin.json` | 已确认 |
| Claude Code 只是参考入口映射，不能引入第二套工具逻辑。 | `se-testing/entry-map.claude-code.md` | 已确认 |
| Agent 流程分为意图生成、spec 实现、执行失败分析和审计报告。 | `se-testing/skills/testing-intent/SKILL.md`、`se-testing/skills/testing-spec/SKILL.md`、`se-testing/skills/testing-run/SKILL.md` | 已确认 |
| `test-author` 负责写意图和 spec，`test-runner` 负责执行和报告，`critic` 负责对抗审查。 | `se-testing/agents/test-author.md`、`se-testing/agents/test-runner.md`、`se-testing/agents/critic.md` | 已确认 |
| 意图生命周期包含 `draft`、`reviewed`、`active`、`needs_update`。 | `se-testing/tools/lib/intention.mjs`、`se-testing/skills/testing-intent/SKILL.md` | 已确认 |
| `draft -> reviewed` 和业务真相裁决需要人类确认。 | `se-testing/skills/testing-intent/SKILL.md`、`se-testing/skills/testing-run/SKILL.md` | 已确认 |
| 意图文件必须使用 YAML，目标项目的意图目录为 `intentions/`。 | `se-testing/tools/lib/intention.mjs`、`se-testing/tools/validate-intention.mjs` | 已确认 |
| YAML 解析依赖 `js-yaml`，项目要求 Node `>=18`。 | `se-testing/tools/lib/yaml.mjs`、`se-testing/package.json` | 已确认 |
| `validate-intention` 负责 schema、状态、版本、id、assertions、fixture 和占位符校验。 | `se-testing/tools/validate-intention.mjs`、`se-testing/tools/validate-intention.test.mjs` | 已确认 |
| `validate-intention` 会对硬编码 email、手机号和长数字串产生 warning。 | `se-testing/tools/validate-intention.mjs`、`se-testing/tools/validate-intention.test.mjs` | 已确认 |
| `check-binding` 负责 spec 头、版本漂移、active 缺 spec、assertion 覆盖和 skip/only/fixme 扫描。 | `se-testing/tools/check-binding.mjs`、`se-testing/tools/check-binding.test.mjs` | 已确认 |
| skip/only/fixme 扫描会剥离注释和字符串以降低误报。 | `se-testing/tools/check-binding.mjs`、`se-testing/tools/check-binding.test.mjs` | 已确认 |
| 两个校验脚本输出 JSON，有错误时以非零退出码结束。 | `se-testing/tools/validate-intention.mjs`、`se-testing/tools/check-binding.mjs` | 已确认 |
| 业务项目接入时复制 `template/`，并维护自己的 intentions、specs、support 和 report。 | `se-testing/README.md`、`se-testing/template/` | 已确认 |
| 模板 Playwright 配置输出 list、JSON 和 HTML 报告，失败保留 trace 和 screenshot。 | `se-testing/template/playwright.config.ts` | 已确认 |
| spec 通过 `// intention: <file>.yaml (vN)` 绑定意图版本。 | `se-testing/tools/lib/intention.mjs`、`se-testing/template/specs/login-success.spec.ts` | 已确认 |
| spec 每条断言通过 `// assertion: <id>` 与意图 assertion 关联。 | `se-testing/tools/check-binding.mjs`、`se-testing/template/specs/login-success.spec.ts` | 已确认 |
| 模板 fixture 通过环境变量占位表达密码来源，不保存真实密码。 | `se-testing/template/support/fixtures/users.json`、`se-testing/template/specs/login-success.spec.ts` | 已确认 |
| `report.md` 必须包含意图链、两个校验脚本输出、diff 摘要和 Playwright 证据。 | `se-testing/template/report.md`、`se-testing/skills/testing-run/SKILL.md` | 已确认 |
| 插件内 `examples/login-fixture` 和根目录 `e2e-fixture-project` 是登录验证夹具。 | `se-testing/examples/login-fixture/`、`e2e-fixture-project/` | 已确认 |
| `run-dogfood.mjs` 会运行示例 Playwright 测试、两个校验脚本并重写示例报告。 | `se-testing/tools/run-dogfood.mjs` | 已确认 |
| 默认不使用 hook/CI 硬强制，硬强制是 opt-in 增强。 | `STANDALONE_DESIGN.md` 第 8 节、`se-testing/entry-map.claude-code.md` | 已确认 |
| `agents/` 是否被 Codex plugin 自动注册为可调度 subagent 需要具体运行时确认。 | `se-testing/.codex-plugin/plugin.json` 只声明 `skills`，`se-testing/agents/*.md` 为角色文档 | 待确认 |
