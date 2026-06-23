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
2. 为每条意图建或更新 `intentions/<id>.yaml`，按当前业务语义设置 `status` 与 `version`。
3. 将具体业务数据抽到 fixture，断言里用占位符引用。
4. 跑适用的校验工具，修到 `ok:true`；意图和 spec 都存在时再检查绑定。
5. **意图即将定稿前 MUST 唤起 critic**（对抗审查：断言是否真覆盖业务、有没有避重就轻），再交人确认 `draft -> reviewed`。

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
