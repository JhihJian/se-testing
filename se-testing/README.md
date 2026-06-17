# se-testing

> Codex plugin：面向 Codex Agent 自主执行的测试工程能力包。v0 (MVP)。
> 设计蓝图见 [../STANDALONE_DESIGN.md](../STANDALONE_DESIGN.md)。

`se-testing` 通过 Codex plugin 暴露 testing skills，让 Codex 在业务项目中按 **意图生成 → spec 实现 → 执行 → 失败分析 → 审计报告** 的闭环工作。本插件只提供能力和模板，不持有业务测试资产。

## 插件结构

```text
se-testing/
  .codex-plugin/plugin.json       # Codex plugin manifest
  skills/                         # Codex skills：按阶段注入流程规范
    testing-intent/SKILL.md       #   需求 → 意图
    testing-spec/SKILL.md         #   意图 → spec
    testing-run/SKILL.md          #   执行 + 失败分析
  agents/                         # subagent 角色说明，供支持子代理的编排器使用
    test-author.md  test-runner.md  critic.md
  tools/                          # 插件内核：可独立运行的 Node 校验脚本
    validate-intention.mjs        #   意图 schema / fixture / 占位符 / 硬编码提示
    check-binding.mjs             #   version / assertion 覆盖 / skip 扫描 / 空扫防护
    run-dogfood.mjs               #   正式 dogfood：fixture e2e + 两个审计脚本
  template/                       # 复制到业务项目的测试资产骨架
    intentions/ specs/ support/ playwright.config.ts report.md
  examples/login-fixture/         # dogfood 业务项目：真实 Web 登录页 + Playwright spec
  package.json
```

## 安装到 Codex

本目录已经是一个 Codex plugin。Codex 通过 marketplace 安装插件；开发期常用方式是把插件目录放到本地 marketplace 指向的位置。若使用默认个人 marketplace，插件源路径通常是：

```text
%USERPROFILE%\plugins\se-testing
```

安装依赖：

```powershell
cd <se-testing-plugin-root>
npm install
```

安装或更新插件后，在新线程中使用，Codex 才会加载新的 skills。若你的个人 marketplace 已有 `se-testing` 条目并指向该目录，重新安装命令形如：

```powershell
codex plugin add se-testing@personal
```

如果还没有 marketplace 条目，应先把 `se-testing` 作为本地插件加入 marketplace；如果插件来自非默认 marketplace，使用该 marketplace 的实际名称替换 `personal`。

## 在业务项目中使用

打开业务项目的新 Codex 线程后，直接请求 Codex 使用本插件的测试能力，例如：

```text
使用 se-testing，为这份 PRD 生成测试意图、Playwright spec，运行并产出 report.md
```

首次接入业务项目时，把插件的 `template/` 内容复制到业务项目根，形成业务侧测试资产：

```powershell
Copy-Item -Recurse <se-testing-plugin-root>\template\* <business-project-root>\
```

之后业务项目中维护的是：

- `intentions/*.yaml`：测试意图，回答“测什么”。
- `specs/*.spec.ts`：Playwright 测试，回答“怎么测”。
- `support/fixtures/*.json`：业务测试数据。
- `support/pages/*.page.ts`：Page Object。
- `report.md`：runner 收工前填充的可审计报告。

## 工具命令

在业务项目根运行插件内核脚本：

```powershell
node <se-testing-plugin-root>\tools\validate-intention.mjs .
node <se-testing-plugin-root>\tools\check-binding.mjs .
```

在插件根自检：

```powershell
npm test
npm run validate
npm run dogfood
```

两脚本输出结构化 JSON；有错误时退出码为 1。`validate-intention` 会拒绝空扫，缺少 `intentions/` 或没有任何 `*.yaml` 会失败。`check-binding` 会在 `projectErrors` 中报告缺目录、空意图集或 YAML 解析失败，避免路径传错却误以为通过。

`npm run dogfood` 会把本插件当作接入方实际使用：进入 `examples/login-fixture/`，必要时安装 fixture 依赖，自动选择可用端口，运行真实 Playwright Chromium 登录测试，再运行 `validate-intention` 与 `check-binding`，最后刷新 `examples/login-fixture/report.md`。这条命令用于证明模板、执行层和审计脚本组合起来能服务一个真实业务形态。

## 意图与 spec 约束

意图 YAML 使用 `js-yaml` 解析，支持标准 YAML 写法；读取 YAML/spec/fixture 时兼容 UTF-8 BOM。`fixtures` 必须显式声明存在的 `.json` 文件，占位符使用的 fixture 也必须声明。

```yaml
id: login-success
version: 1
status: active
title: 用户用正确凭证登录成功
business_context: |
  这条意图覆盖的业务真相。
fixtures: [users.json]
assertions:
  - id: greet-user
    description: 顶栏欢迎语含 {{users.validUser.name}}
```

同一意图内的 `assertions[].id` 必须唯一。

spec 首个非空行必须绑定意图版本：

```ts
// intention: login-success.yaml (v1)
```

spec 内每条断言必须用独立注释行绑定：

```ts
// assertion: greet-user
await expect(page.getByTestId("topbar-greeting")).toContainText(users.validUser.name);
```

## 信任模型

本插件不靠 hook 强制 Agent 行为，而是让证据可审计：

1. Playwright 结果是机器事实。
2. 意图层与 spec 分离，弱化或漏测会表现为绑定/覆盖缺口。
3. `report.md` 必须原样贴入 `validate-intention` 和 `check-binding` 输出。

当前机器层能检查 schema、fixture、version、active 缺 spec、assertion 标记覆盖、skip/only/fixme。断言语义是否被弱化仍由 critic + git diff 审计承担。

## 验收

当前插件根验证结果应满足：

```powershell
npm test          # 29 项全通过
npm run validate  # template 两脚本均 ok:true
npm run dogfood   # examples/login-fixture e2e + 审计脚本全通过
```

可手工制造对抗样例验证：

- 把 spec 头从 `(v1)` 改成 `(v2)`，`check-binding` 应返回 `driftErrors` 且退出 1。
- 删除某条 `// assertion: <id>`，`check-binding` 应返回 `assertionCoverage` 且退出 1。
- 添加真实 `test.skip(...)`，`check-binding` 应返回 `skipFindings` 且退出 1。

## 非 Codex 适配

[entry-map.claude-code.md](entry-map.claude-code.md) 保留为 Claude Code 等其他 Agent runtime 的入口映射参考；Codex 主路径以 `.codex-plugin/plugin.json` 和 `skills/` 为准。
