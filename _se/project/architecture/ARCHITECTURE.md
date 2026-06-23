# se-testing 架构基线

本文件记录当前项目的稳定架构事实。本文覆盖根目录下的 `se-testing` 能力包及其验证夹具；不覆盖 `node_modules/`、Playwright 生成报告、测试结果目录，以及业务项目接入后的具体业务测试资产。

## 项目概览

`se-testing` 是一个面向 Codex Agent 的测试工程能力包。它向 Agent 提供测试意图生成、journey 分支索引维护、Playwright spec 编写、测试执行、失败分析和审计报告生成的流程能力，同时提供可独立运行的 Node 校验脚本和可复制到业务项目的测试骨架。

项目采用“壳与核”边界：

- 壳：`skills/`、`agents/`、`.codex-plugin/plugin.json` 和 `entry-map.claude-code.md`，负责把正确流程暴露给 Agent 运行时。
- 核：`tools/` 和 `template/`，负责可机检的意图校验、意图与 spec 绑定检查，以及业务项目的可移植测试资产骨架。

能力包本身不持有真实业务测试资产。业务项目接入时复制 `template/`，之后在业务项目内维护 `intentions/`、`specs/`、`support/` 和 `report.md`，并通过 `se-testing/tools/*.mjs` 执行审计检查。

## 核心领域模型

核心对象是“意图层”和“执行层”的可审计绑定关系：

- 测试意图：`intentions/<id>.yaml`，回答“测什么”。它包含稳定业务事实、生命周期状态、版本、fixture 声明和 assertion 列表。
- Playwright spec：`specs/**/*.spec.ts`，回答“怎么测”。首个非空行必须绑定意图文件和版本，每条意图 assertion 必须通过独立 `// assertion: <id>` 标记落到 spec。
- Fixture：`support/fixtures/*.json`，提供业务测试数据。意图中的具体数据通过 `{{file.key.path}}` 占位符引用 fixture。
- Page Object：`support/pages/*.page.ts`，封装页面操作和选择器，使 spec 主要表达测试意图。
- Journey：`intentions/journeys/<id>.yaml`，回答“同一路径下有哪些分支”。它只索引公共前置条件、分支条件、分支结果、已覆盖 intent 和已知缺口，不直接绑定 spec。
- 审计报告：`report.md`，收敛 Playwright 证据、四个校验脚本输出、diff 摘要和失败处置记录。

意图生命周期是 `draft -> reviewed -> active`，业务变化或意图失配时进入 `needs_update`。其中 `draft -> reviewed` 和业务真相裁决是人类介入点；`reviewed -> active` 由 spec 首次通过等机器事实支撑。

## 核心流程

典型闭环如下：

1. Agent 读取需求，按 `testing-intent` 生成 draft 意图，并用 `validate-intention` 与 `check-intentions` 做 schema、fixture、占位符和严格质量自检。
2. critic 在意图定稿前做对抗审查，人确认业务语义后，意图从 `draft` 进入 `reviewed`。
3. 同一路径存在多分支时，test-author 按 `testing-journey` 维护 journey，并用 `check-journeys` 校验 intent 引用和分支索引。
4. test-author 按 `testing-spec` 将 reviewed/active 意图实现为 Playwright spec，写入版本绑定头和 assertion 标记。
5. test-runner 按 `testing-run` 运行 Playwright，执行层失败可自主修 Page Object 或 fixture；疑似意图层问题只能升级 critic 并产出提案。
6. 收工前必须运行 `validate-intention`、`check-intentions`、`check-journeys` 和 `check-binding`，并把 stdout 原样写入 `report.md` 或带 hash 的 artifact，再由 critic 复核报告和证据。

## 安全与权限

本项目没有传统用户认证和访问控制边界；主要风险是 Agent 为了让测试变绿而弱化意图、删除断言、跳过用例或伪造审计结果。架构上的防护是可审计性而不是默认硬强制：

- Playwright 结果提供机器事实。
- 意图与 spec 分层使弱化行为可在绑定检查、assertion 覆盖和 diff 中暴露。
- `validate-intention`、`check-intentions`、`check-journeys` 与 `check-binding` 输出结构化 JSON，作为报告中的机器证据。
- critic 必须在意图定稿前和报告产出前以对抗视角复核。

默认不安装 hook 或 CI gate；硬强制是 opt-in 增强，不能进入核心路径并复制第二套规则。

## 模块边界

- [Agent 运行时壳](modules/agent-runtime.md)：Codex plugin、skills、agents 和其他 Agent 运行时入口映射。
- [校验内核](modules/validation-core.md)：Node ESM 校验脚本、共享解析逻辑、JSON 输出和退出码规则。
- [业务测试模板](modules/business-test-template.md)：复制到业务项目的 Playwright 骨架、意图/spec/report 约定。
- [验证夹具](modules/verification-fixture.md)：用于 dogfood 的登录示例项目和端到端验证报告。

依赖方向必须保持为：Agent 运行时壳调用校验内核和维护业务测试模板；校验内核不依赖任何 Agent 运行时；业务项目模板只通过文件约定被校验内核读取；验证夹具只能验证能力包，不能成为核心依赖。

## 不变量

- `tools/` 不得依赖 Codex、Claude Code 或其他 Agent 运行时。
- 意图文件名、`id` 和 spec 头部绑定对象必须保持一致。
- Journey 只能引用 intent id，不得替代 intent assertion，也不得被 spec 直接绑定。
- 严格意图交付前必须带 `priority`、`precondition`、`edge_cases` 和 `tags` 等审计字段。
- spec 头部版本必须等于意图 `version`。
- `active` 意图必须至少有一个对应 spec。
- `active` 意图中的每条 assertion 必须被 spec 的独立 `// assertion: <id>` 标记覆盖。
- spec 中不得使用 `test.skip`、`.only` 或 `fixme` 隐藏未覆盖行为。
- 业务测试数据应从 fixture 读取；意图中的具体数据应通过占位符引用。
- runner/author 不应为了执行困难直接弱化或修改 `active` 意图；疑似意图层问题必须升级为提案并等待人类裁决。
- `report.md` 中的校验脚本输出必须来自真实运行结果，不能手写伪造。

## 相关文件

- [术语表](glossary.md)
- [来源映射](source-map.md)
- [架构决策](decisions/README.md)
