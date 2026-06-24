---
name: testing-intent
description: 定义和校验「测试意图」——测什么的可审计声明。Use when Codex needs to create, normalize, or review intention YAML for testing before writing Playwright specs; includes the generic intention schema, quality rules, lifecycle, validation tools, and safe subagent parallelization by business domain.
---

# testing-intent：需求 -> 意图

意图层回答 **「测什么」**（业务真相），与 spec 的 **「怎么测」** 严格分离。这层分离是放弃硬强制后的核心审计面：偷偷弱化断言会造成意图与 spec 不一致，被 `check-binding` 与 critic 检出。

> 规范性语言沿用 RFC 2119：MUST / MUST NOT / SHOULD / MAY。

## 适用范围

在创建、规范化或审查测试意图时使用。意图层只定义业务上必须为真的可观察事实；具体任务中的文件范围、迁移策略、是否保留旧字段、是否同步 spec，由用户提示词或仓库约定决定。

## 意图 Schema（单一来源）

每条意图是 `intentions/<id>.yaml`：

```yaml
id: login-success            # MUST，kebab-case，与文件名一致
version: 1                   # MUST，正整数；spec 头 (vN) 必须与之一致
priority: P0                 # MUST，P0|P1|P2
status: draft                # MUST，draft|reviewed|active|needs_update
title: 用户用正确凭证登录成功    # MUST，一句话
business_context: |          # MUST，这条意图覆盖的业务真相、为什么重要
  注册用户用有效凭证登录应进入仪表盘，是发布前必过路径。
precondition: 已存在可登录用户。 # MUST，业务前置条件，不写实现细节
fixtures:                    # MAY，引用的 fixture 文件（相对 support/fixtures/）
  - users.json
assertions:                  # MUST，至少一条
  - id: redirect-dashboard
    description: 提交后跳转到 /dashboard
  - id: greet-user
    description: 顶栏欢迎语含 {{users.validUser.name}}
edge_cases:                  # MUST，可为空列表；建议覆盖失败、权限、边界
  - id: invalid-password
    description: 密码错误时登录被拒绝，并返回可理解的认证失败错误
tags: [api, identity]        # MUST，字符串列表
```

- 断言里任何具体业务数据 **MUST** 用 `{{file.key.path}}` 占位符引用 fixture，**MUST NOT** 硬编码（邮箱、手机号、长 id 会被 `validate-intention` 告警）。
- `fixtures` **MUST** 显式列出每个被占位符使用的 `.json` 文件；文件必须存在于 `support/fixtures/`。
- 占位符首段 = `support/fixtures/<段>.json`，其余是该 JSON 内的路径。
- 同一意图内 `assertions[].id` **MUST** 唯一，因为 spec 通过 `// assertion: <id>` 与它绑定；`edge_cases[].id` 同理。
- `id`、`assertions[].id`、`edge_cases[].id` **MUST** 是 kebab-case。

## 生命周期与状态

```text
draft --(人确认「真反映业务」)--> reviewed --(spec 生成+首次通过, 机器事实)--> active
  ^                                                                              |
  +---------------- needs_update （业务变了，等人裁决后回炉） <--------------------+
```

- `draft -> reviewed` 是 **人类介入点**：是否真反映业务需求由人拍板（见编排说明第 7 节）。Agent **MUST NOT** 自行推进。
- `reviewed -> active` 由机器事实驱动（spec 写出并首次通过），无需人。

## 产出步骤

1. 通读需求，列出**业务上必须为真的事实**，每条成为一个 assertion 的 `description`。
2. 做一轮**语义边界审计**：找出名称相近或存储复用但约束不同的概念，例如状态终点、操作类别、原因/备注/说明、枚举字段/自由文本字段、展示字段/提交字段。
3. 为每条意图建或更新 `intentions/<id>.yaml`，按当前业务语义设置 `status` 与 `version`。
4. 将具体业务数据抽到 fixture，断言里用占位符引用。
5. 跑适用的校验工具，修到 `ok:true`；意图和 spec 都存在时再检查绑定。
6. **意图即将定稿前 MUST 唤起 critic**（对抗审查：断言是否真覆盖业务、有没有避重就轻），再交人确认 `draft -> reviewed`。

## 语义边界规则

当多个流程复用同一个字段名、状态名、接口参数名或 UI 文案时，意图 **MUST** 分别声明它们的业务约束。尤其注意：

- **同名字段不等于同一语义**：同一个 `reason`、`remark`、`note`、`status`、`type` 等字段在不同动作下可能代表不同概念。意图必须写清每个动作下的可观察约束。
- **同一终态不等于同一输入约束**：多个动作到达相同状态，不代表它们的输入字段使用相同枚举、格式或必填规则。
- **枚举与自由文本必须双向证明**：若需求说某字段受枚举限制，意图应覆盖非法非枚举失败；若需求说某字段允许自由文本，意图应覆盖非枚举文本成功。不要只用枚举值作为成功样本。
- **备注/说明/原因类字段必须覆盖真实输入形态**：富文本、长文本、自定义文本、带标点或普通自然语言等，必须至少用一种非模板化样本证明不会被误当成枚举。
- **不要把当前实现当 oracle**：如果现有接口返回、字段名或旧测试与需求语义冲突，应把意图标为 `needs_update` 或产出修正提案，而不是把现状写成业务真相。
- **负例不能反向固化 bug**：当一个失败用例证明某输入被拒绝时，必须说明为什么业务上应拒绝；否则它可能只是把实现缺陷锁进测试。

## 意图审查清单

定稿前至少检查这些问题：

- 断言里的约束是否能直接追溯到需求，而不是来自源码分支、错误信息或历史测试？
- 对名称相同但语义不同的字段，是否分别写了成功与失败边界？
- 对可自定义输入，是否存在“非枚举但合法”的成功断言？
- 对枚举输入，是否存在“非枚举非法”的失败断言？
- 若一个动作会产生终态或副作用，意图是否同时覆盖状态、副作用和输入约束，避免只测 happy path？

## 并发加速

当需求可按业务域拆分时，编排者 **SHOULD** 并发派发多个 intent worker。每个 worker 只负责一个域的意图与 fixture，例如：

- auth worker：`intentions/auth-*.yaml`、`support/fixtures/auth.json`
- asset worker：`intentions/asset-*.yaml`、`support/fixtures/assets.json`
- vulnerability worker：`intentions/vulnerability-*.yaml`、`support/fixtures/vulnerabilities.json`

并发约束：

- 每个 worker **MUST** 有明确文件所有权，**MUST NOT** 修改其他域文件。
- 共享 fixture **SHOULD** 先拆成域级 fixture；无法拆分时由主上下文串行合并。
- 多个 critic **MAY** 只读并发审查不同业务域；critic 不直接落盘改意图。
- 所有 draft 意图仍必须经过 critic 与人确认后才能变为 `reviewed`。

## MUST / MUST NOT

- 断言 **MUST** 表达业务可观察结果，**MUST NOT** 表达实现细节（如「调用了某函数」）。
- **MUST NOT** 为了好测而砍掉业务上重要的断言。
- 修改一条 `active` 意图的语义时 **MUST** 同步 `version`，否则造成 spec 漂移。
- `description` **MUST NOT** 使用空泛表述：如「功能正常」「返回正确结果」「保持不变」「校验成功」。要写清楚可观察结果、状态、权限、审计副作用或错误语义。
- **MUST NOT** 用实现里的字段名、错误消息或旧测试名称替代业务概念；这些只能作为线索，不能作为意图依据。

## 工具

这些工具是本 skill/plugin 自带资源，路径相对当前 `SKILL.md` 所在插件目录；**不要假设项目仓库内存在 `tools/validate-intention.mjs`**。

- `tools/validate-intention.mjs`：基础 schema、fixture 占位符和硬编码启发式检查。
- `tools/check-intentions.mjs`：严格意图质量检查，适合规范化、审查或交付前验收。
- `tools/check-journeys.mjs`：journey 路径/分支索引检查；当项目维护 `intentions/journeys/*.yaml` 时使用。
- `tools/check-binding.mjs`：意图和 spec 的版本、active spec、逐条 assertion 标记绑定检查。

调用时优先使用已加载 skill 的实际路径，例如：

```bash
node /path/to/se-testing/tools/check-intentions.mjs <projectDir>
```

如果运行环境无法访问 skill 自带工具，可以在 worktree 外写一次性**检查脚本**复刻同等校验，并在报告中说明；不要把临时脚本写成转换/迁移脚本，除非用户明确要求。

如果多条 intent 属于同一路径的不同分支，先用 [testing-journey](../testing-journey/SKILL.md) 建立路径索引；意图 reviewed 后用 [testing-spec](../testing-spec/SKILL.md) 写 spec。
