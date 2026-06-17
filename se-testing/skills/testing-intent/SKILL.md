---
name: testing-intent
description: 把需求/PRD 转成「意图」——测什么的可审计声明。在写任何 Playwright 代码之前使用，产出 draft 意图 yaml，定稿前必须经人确认与 critic 审查。
---

# testing-intent：需求 → 意图

意图层回答 **「测什么」**（业务真相），与 spec 的 **「怎么测」** 严格分离。这层分离是放弃硬强制后的核心审计面：偷偷弱化断言会造成意图与 spec 不一致，被 `check-binding` 与 critic 检出。

> 规范性语言沿用 RFC 2119：MUST / MUST NOT / SHOULD / MAY。

## 何时用

接到「为这份 PRD/需求生成测试」类任务，**在动任何 spec 代码之前**。

## 意图 Schema（单一来源）

每条意图是 `intentions/<id>.yaml`：

```yaml
id: login-success            # MUST，kebab-case，与文件名一致
version: 1                   # MUST，正整数；spec 头 (vN) 必须与之一致
status: draft                # MUST，draft|reviewed|active|needs_update
title: 用户用正确凭证登录成功    # MUST，一句话
business_context: |          # MUST，这条意图覆盖的业务真相、为什么重要
  注册用户用有效凭证登录应进入仪表盘，是发布前必过路径。
fixtures:                    # MAY，引用的 fixture 文件（相对 support/fixtures/）
  - users.json
assertions:                  # MUST，至少一条
  - id: redirect-dashboard
    description: 提交后跳转到 /dashboard
  - id: greet-user
    description: 顶栏欢迎语含 {{users.validUser.name}}
```

- 断言里任何具体业务数据 **MUST** 用 `{{file.key.path}}` 占位符引用 fixture，**MUST NOT** 硬编码（邮箱、手机号、长 id 会被 `validate-intention` 告警）。
- `fixtures` **MUST** 显式列出每个被占位符使用的 `.json` 文件；文件必须存在于 `support/fixtures/`。
- 占位符首段 = `support/fixtures/<段>.json`，其余是该 JSON 内的路径。
- 同一意图内 `assertions[].id` **MUST** 唯一，因为 spec 通过 `// assertion: <id>` 与它绑定。

## 生命周期与状态

```text
draft ──(人确认「真反映业务」)──▶ reviewed ──(spec 生成+首次通过, 机器事实)──▶ active
  ▲                                                                              │
  └──────────────── needs_update （业务变了，等人裁决后回炉） ◀────────────────────┘
```

- `draft → reviewed` 是 **人类介入点**：是否真反映业务需求由人拍板（见编排说明第 7 节）。Agent **MUST NOT** 自行推进。
- `reviewed → active` 由机器事实驱动（spec 写出并首次通过），无需人。

## 步骤

1. 通读需求，列出**业务上必须为真的事实**，每条成为一个 assertion 的 `description`。
2. 为每条意图建 `intentions/<id>.yaml`，`status: draft`，`version: 1`。
3. 抽出数据到 `support/fixtures/*.json`，断言里改用占位符。
4. 跑 `node <se-testing>/tools/validate-intention.mjs .`，修到 `ok:true`。
5. **意图即将定稿前 MUST 唤起 critic**（对抗审查：断言是否真覆盖业务、有没有避重就轻），再交人确认 `draft → reviewed`。

## MUST / MUST NOT

- 断言 **MUST** 表达业务可观察结果，**MUST NOT** 表达实现细节（如「调用了某函数」）。
- **MUST NOT** 为了好测而砍掉业务上重要的断言——那是用执行困难绑架意图。
- 修改一条 `active` 意图的语义时 **MUST** 同步 `version`，否则造成 spec 漂移。

下一步：意图 reviewed 后用 [testing-spec](../testing-spec/SKILL.md) 写 spec。
