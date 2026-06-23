---
name: testing-journey
description: 定义和维护测试旅程 journeys：用上层索引描述同一业务测试路径下的不同分支、公共前置条件、分支覆盖与意图引用。Use when Codex needs to group multiple testing intentions as branches of the same path, create or review intentions/journeys/*.yaml, audit branch coverage, or explain relationships between intent files without replacing testing-intent/spec binding.
---

# testing-journey：路径 / 分支索引

journey 层回答 **「哪些意图属于同一条业务测试路径，以及它们分别覆盖哪个分支」**。它是意图集合的上层索引，不直接回答「测什么」或「怎么测」。

> RFC 2119：MUST / MUST NOT / SHOULD / MAY。

## 边界

- `testing-intent` 定义单条业务真相：可审计断言、fixture、状态、版本。
- `testing-journey` 定义路径关系：公共上下文、分支条件、分支结果、引用哪些 intent。
- `testing-spec` 仍只绑定具体 intent：`// intention: <id>.yaml (vN)`。
- journey **MUST NOT** 直接绑定 spec，**MUST NOT** 替代 intent 的 `assertions`。

## 文件位置

journey 文件放在：

```text
intentions/journeys/<id>.yaml
```

如果业务项目把测试资产放在 `tests/` 下，则放在：

```text
tests/intentions/journeys/<id>.yaml
```

单条 intent 仍放在业务域目录或 `intentions/` 下，例如：

```text
intentions/
  journeys/
    auth-login.yaml
  auth/
    auth-login-success.yaml
    auth-login-invalid-password.yaml
    auth-login-locked-account.yaml
```

## Journey Schema（单一来源）

```yaml
id: auth-login                 # MUST，kebab-case，与文件名一致
version: 1                     # MUST，正整数；路径结构或分支语义变化时递增
status: draft                  # MUST，draft|reviewed|active|needs_update
title: 登录路径                  # MUST，一句话
business_context: |            # MUST，说明这条路径为什么需要整体审查
  用户从登录页提交凭证后，系统根据凭证和账号状态进入不同业务分支。
shared_precondition: 用户访问登录页。 # MUST，公共业务前置条件，不写实现细节
tags: [auth, login]            # MUST，字符串列表
branches:                      # MUST，至少一条
  - id: success                 # MUST，kebab-case，journey 内唯一
    intent: auth-login-success  # MUST，引用 intent 的 id，不写路径、不带 .yaml
    condition: 凭证正确且账号可用 # MUST，触发该分支的业务条件
    result: 进入仪表盘           # MUST，该分支应观察到的业务结果摘要
    priority: P0                # MAY，P0|P1|P2；默认继承 intent priority
  - id: invalid-password
    intent: auth-login-invalid-password
    condition: 密码错误
    result: 登录被拒绝，并返回认证失败错误
edge_branches:                 # MUST，可为空列表；记录尚未落 intent 的已知缺口
  - id: disabled-account
    condition: 账号已禁用
    expected_result: 登录被拒绝，并提示账号不可用
    reason: 当前需求未明确错误语义，等待产品确认
```

## 字段规则

- `id`、`branches[].id`、`edge_branches[].id` **MUST** 是 kebab-case。
- `id` **MUST** 与文件名一致，如 `intentions/journeys/auth-login.yaml`。
- `branches[].intent` **MUST** 引用已存在的 intent `id`；不要引用文件路径。
- 同一 journey 内 `branches[].id` **MUST** 唯一。
- 同一 journey 内 `branches[].intent` **SHOULD** 唯一；只有同一 intent 明确覆盖多个业务条件时才可复用，并在 `result` 写清楚。`check-journeys.mjs` 会对复用给 warning。
- `edge_branches` **MUST** 用来暴露未覆盖分支，**MUST NOT** 悄悄省略已知重要分支。
- journey 中的 `condition` / `result` 是摘要；完整断言仍写在被引用的 intent 中。

## 路径 vs 覆盖矩阵

默认一个 journey **SHOULD** 围绕一个用户动作、状态机阶段、业务流程或接口族中的同一决策点，例如「登录提交」「工单初审」「漏洞关闭」。不要把一个业务域下所有 intent 简单按文件名前缀塞进同一个 journey。

判断标准：

- 如果分支共享同一 `shared_precondition`，且由同一动作/状态/入口触发不同结果，通常是 journey。
- 如果只是按模块罗列许多不共享同一触发点的测试点，通常是覆盖矩阵，不是 journey。
- 审计、质量、横切契约这类天然跨路径主题 **MAY** 使用 journey 文件承载覆盖索引，但 **MUST** 在 `tags` 中加入 `coverage`、`matrix`、`contract` 或 `cross-module` 等标记，并在 `business_context` 说明它是覆盖索引。
- branch 数量过多通常表示粒度过宽；`check-journeys.mjs` 会对超过阈值且未标 coverage/matrix/contract 的 journey 给 warning。

## 生命周期

```text
draft --(人确认路径和分支完整)--> reviewed --(引用的 reviewed/active intents 与 spec 覆盖齐备)--> active
  ^                                                                                 |
  +---------------- needs_update （业务路径或分支语义变化） <------------------------+
```

- `draft -> reviewed` 是 **人类介入点**：人确认路径拆分、分支条件和已知缺口是否真实完整。
- `reviewed -> active` 需要所有 `branches[].intent` 至少为 `reviewed`，所有 `edge_branches` 已被接受为延期缺口或转成 draft intent，且进入执行阶段时每个 active intent 应有对应 spec 绑定。
- 修改分支语义、增删重要分支、改变 intent 引用时 **MUST** 递增 journey `version`。
- 修改被引用 intent 的业务断言时按 `testing-intent` 规则递增 intent `version`；journey 只有在路径/分支语义也变化时才递增。
- 被引用 intent 语义变化时 **SHOULD** 复核相关 journey；如果 branch 的 `condition` / `result` 摘要不再准确，journey **MUST** 递增 `version` 并更新。

## 产出步骤

1. 通读需求，识别同一用户动作或业务流程下的公共路径。
2. 列出成功、失败、权限、边界、状态变化等互斥或关键分支。
3. 为每个已明确分支创建或引用一条独立 intent；不要把多个分支塞进同一 intent 的断言里。
4. 把已知但暂不能定稿的分支写入 `edge_branches`，带上阻塞原因。
5. 建或更新 `intentions/journeys/<id>.yaml`，只写路径关系和分支摘要。
6. 跑 `node <se-testing>/tools/check-journeys.mjs <assetRoot>`；如果项目根下没有 `intentions/` 但有 `tests/intentions/`，可传项目根或 `tests`，工具会自动识别。
7. 对照 `testing-intent` 校验每个被引用 intent 的断言质量；spec 阶段仍用 `testing-spec` 逐 intent 绑定。
8. journey 即将定稿前 **MUST** 唤起 critic 审查：是否遗漏重要分支、是否把实现细节写成业务条件、是否用 journey 掩盖缺失 intent。

## MUST / MUST NOT

- journey **MUST** 让审查者一眼看出同一路径下有哪些分支已经覆盖、哪些仍是缺口。
- journey **MUST NOT** 写执行步骤、选择器、接口路径、SQL、mock 细节等实现信息。
- journey **MUST NOT** 包含完整断言列表；断言只属于 intent。
- journey **MUST NOT** 作为跳过某个分支 intent/spec 的理由；缺口必须进入 `edge_branches` 或创建 draft intent。
- journey **MUST NOT** 为了降低 warning 而删除真实分支；warning 是审查入口，不是删减目标。
- 当用户问「这些测试意图之间是什么关系」「同一路径有哪些分支」「覆盖矩阵缺什么」时，优先用 journey 表达。

## 工具

这些工具路径相对当前插件目录；**不要假设项目仓库内存在 `tools/check-journeys.mjs`**。

- `tools/check-journeys.mjs`：校验 journey schema、intent 引用、spec 不直接绑定 journey，并输出质量 warning。
- `tools/check-intentions.mjs`：校验被引用 intent 的业务断言质量。
- `tools/check-binding.mjs`：校验 active intent 与 spec 绑定。

交付前至少运行：

```bash
node <se-testing>/tools/check-journeys.mjs <project-or-tests-dir>
node <se-testing>/tools/check-intentions.mjs <project-or-tests-dir>
node <se-testing>/tools/check-binding.mjs <project-or-tests-dir>
```

`check-journeys` 的 warning（如 intent 复用、空 `edge_branches`、过宽 journey）不阻断，但 **MUST** 在交付说明或 critic 审查中回应：确认接受、拆分 journey、拆分 intent，或补充 edge branch。

下一步：路径分支明确后，用 [testing-intent](../testing-intent/SKILL.md) 维护每条 intent，再用 [testing-spec](../testing-spec/SKILL.md) 写 spec。
