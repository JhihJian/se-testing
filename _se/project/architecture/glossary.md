# 术语表

| 术语 | 含义 | 来源 |
|---|---|---|
| se-testing | 面向 Codex Agent 的测试工程能力包，包含 skills、agents、tools、template 和 plugin manifest。 | `se-testing/README.md`、`se-testing/.codex-plugin/plugin.json` |
| 壳 | 面向 Agent 运行时的流程资产，包括 skills、agents 和入口映射。 | `STANDALONE_DESIGN.md`、`se-testing/README.md` |
| 核 | 可独立运行的校验脚本和业务测试模板，不依赖 Agent 运行时。 | `STANDALONE_DESIGN.md`、`se-testing/tools/` |
| 测试意图 | `intentions/*.yaml`，描述“测什么”的业务事实、版本、状态、fixture 和 assertions。 | `se-testing/skills/testing-intent/SKILL.md` |
| spec | `specs/**/*.spec.ts`，描述“怎么测”的 Playwright 测试实现。 | `se-testing/skills/testing-spec/SKILL.md` |
| assertion | 意图中的可观察业务断言，必须在 spec 中以 `// assertion: <id>` 标记绑定。 | `se-testing/tools/check-binding.mjs` |
| 绑定锚点 | spec 首个非空行 `// intention: <file>.yaml (vN)`，用于关联意图文件和版本。 | `se-testing/tools/lib/intention.mjs` |
| fixture | `support/fixtures/*.json` 中的业务测试数据。 | `se-testing/template/support/fixtures/users.json` |
| 占位符 | 意图描述中的 `{{file.key.path}}`，用于引用 fixture 内的 JSON 路径。 | `se-testing/tools/lib/intention.mjs` |
| validate-intention | 校验意图 schema、fixture、占位符和硬编码启发式的 Node 脚本。 | `se-testing/tools/validate-intention.mjs` |
| check-binding | 校验意图与 spec 版本绑定、active 覆盖、assertion 标记和 skip/only/fixme 的 Node 脚本。 | `se-testing/tools/check-binding.mjs` |
| critic | 对抗审查角色，在意图定稿前和报告产出前复核覆盖、弱化、skip 和校验证据。 | `se-testing/agents/critic.md` |
| report.md | runner 收工前产出的可审计报告，包含 Playwright 结果和两个校验脚本输出。 | `se-testing/template/report.md` |
| 业务项目 | 复制 `template/` 后承载实际测试资产的目标项目。 | `se-testing/README.md` |
| 验证夹具 | 用于 dogfood 的登录示例项目，不属于核心业务资产。 | `se-testing/examples/login-fixture/`、`e2e-fixture-project/` |
