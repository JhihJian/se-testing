# se-testing v0 (MVP) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use summ:executing-plans to implement this plan task-by-task.

**Goal:** 依据 `STANDALONE_DESIGN.md` 实现 `se-testing` 独立测试工程能力包的 v0（MVP）——一个面向 AI Agent 自主执行的「能力包 + 可移植内核」，跑通一条 happy path：PRD → draft 意图 → 人确认 → spec → 执行 → 带证据的 report。

**Architecture:** 壳（`skills/` + `agents/`，运行时无关的 markdown）教 Agent 正确流程；核（`tools/` + `template/`，零 agent 依赖的 node 脚本与骨架）可独立运行。`tools/` 两个检查脚本是信任锚点，必须有测试覆盖。只接一个工具（Claude Code）的入口映射。

**Tech Stack:** Markdown（skills/agents/template），Node.js ESM（`.mjs` 检查脚本），`node:test` + `node:assert`（脚本测试），`js-yaml`（意图 YAML 解析，唯一第三方依赖，因 Node 无内建 YAML），Playwright（template 配置，不在本仓库运行）。

---

## 设计决策（实现期补充）

- **意图格式 = YAML**（设计明文要求）。Node 无内建 YAML，引入 `js-yaml`（标准、稳健）优于手写脆弱解析器。这是「能用标准库就不引入依赖」原则的合理让步。
- **当前 `check-binding` 做五类硬检查**：项目目录/意图解析错误、version 漂移、`active` 意图缺 spec、`// assertion: <id>` 覆盖、`skip`/`.only`/`fixme` 代码扫描。断言语义弱化仍由 critic + git diff 审计承担。
- **`validate-intention` 做**：YAML schema 合规、`status` 取值合法、`fixtures` 声明存在且为 JSON、`{{fixture.path}}` 占位符指向真实存在且已声明的 fixture、无硬编码业务数据（启发式：assertion description 内的 email/手机号/纯数字 id 等可疑字面量告警）。读取 YAML/spec/fixture 时兼容 UTF-8 BOM。
- **两脚本只报告不阻断**：输出结构化 JSON 到 stdout，有问题时非零退出码。
- 非 git 仓库环境，省略 commit 步骤；每个 Task 末尾以「运行测试/脚本确认」替代 commit gate。

---

## 意图 Schema（单一来源，脚本与 skill 共用）

意图文件 `intentions/<id>.yaml`：

```yaml
id: login-success            # MUST，kebab-case，与文件名一致
version: 1                   # MUST，正整数，spec 头部 vN 必须与之一致
status: active               # MUST，draft|reviewed|active|needs_update
title: 用户用正确凭证登录成功   # MUST
business_context: |          # MUST，这条意图覆盖的业务真相
  注册用户用有效用户名+密码登录，应进入仪表盘。
fixtures:                    # MAY，引用的 fixture 文件（相对 support/fixtures/）
  - users.json
assertions:                  # MUST，至少一条
  - id: redirect-dashboard
    description: 登录后跳转到 /dashboard
  - id: greet-user
    description: 顶栏显示欢迎语，含 {{users.validUser.name}}
```

占位符语法 `{{file.key.path}}`：首段 `users` → `support/fixtures/users.json`，其余为 JSON 路径，validate 校验文件存在且路径可解析。

Spec 头部约定（首个非空行）：`// intention: login-success.yaml (v1)`

---

### Task 1: 项目骨架与 README

**Files:**
- Create: `se-testing/README.md`
- Create: `se-testing/package.json`

**Step 1:** 写 `package.json`：`type: module`，依赖 `js-yaml`，scripts: `test`（`node --test tools/`）、`validate`（依次跑两脚本）。
**Step 2:** 写 `README.md`：项目定位（壳与核）、目录树、`node tools/*.mjs <dir>` 用法、接入方式（复制 `template/`）、指向 `entry-map`。
**Step 3:** `cd se-testing && npm install` 确认 js-yaml 安装成功。

---

### Task 2: validate-intention.mjs（TDD）

**Files:**
- Create: `se-testing/tools/validate-intention.mjs`
- Create: `se-testing/tools/validate-intention.test.mjs`
- Create: `se-testing/tools/lib/intention.mjs`（共享：加载/解析意图、占位符提取）

**Step 1: 写失败测试** `validate-intention.test.mjs`，覆盖：
- 合法意图集 → 退出意义上的 `ok:true`，errors 空。
- 缺 `id`/`status` 非法值 → 报对应 error。
- `{{users.validUser.name}}` 指向不存在的 fixture 文件 → error。
- 占位符 JSON 路径在 fixture 内不存在 → error。
- assertion description 含硬编码 email（`a@b.com`）→ warning。
用 `node:test` 的临时目录 fixture 构造输入。

**Step 2:** 运行 `node --test tools/validate-intention.test.mjs`，预期 FAIL（模块未实现）。

**Step 3:** 实现 `lib/intention.mjs`（`loadIntentions(dir)`、`extractPlaceholders(text)`、`resolveFixturePath(...)`）与 `validate-intention.mjs`：
- 读 `<dir>/intentions/*.yaml`，js-yaml 解析。
- 校验 schema（必填字段、status 枚举、version 正整数、assertions 非空）。
- 对每个 `{{...}}` 占位符：解析 fixture 文件已声明、文件存在、JSON 路径可达。
- 硬编码启发式：description 内匹配 email/长数字串/手机号 → warning。
- 输出 `{ ok, errors, warnings }` JSON 到 stdout；`errors` 非空时 `process.exit(1)`。
- 支持 CLI：`node validate-intention.mjs <project-dir>`（默认 `.`）。

**Step 4:** 运行测试，预期全 PASS。

---

### Task 3: check-binding.mjs（TDD）

**Files:**
- Create: `se-testing/tools/check-binding.mjs`
- Create: `se-testing/tools/check-binding.test.mjs`

**Step 1: 写失败测试**，覆盖：
- spec 头 `(v1)` 与意图 `version:1` 一致 → ok。
- spec 头 `(v1)` 但意图 `version:2` → version 漂移 error。
- spec 引用的意图文件不存在 → error。
- 某 `active` 意图无对应 spec → error。
- spec 内含 `test.skip`/`.only`/`fixme` → 各报 error（或 warning，按设计「只报告」，用 error 体现非零退出）。

**Step 2:** 运行测试，预期 FAIL。

**Step 3:** 实现 `check-binding.mjs`：
- 复用 `lib/intention.mjs` 载入意图。
- 读 `<dir>/specs/**/*.spec.ts`，解析首部 `// intention: <file> (v<N>)`。
- 比对 version；找不到意图文件报错。
- 对每条 `status: active` 意图，确认至少一个 spec 头引用它，且每条 assertion 都有独立行 `// assertion: <id>` 标记。
- 正则静态扫描 spec 文本：`\.skip\b`、`\.only\b`、`fixme`（大小写不敏感，排除注释说明可后置，MVP 直接命中即报）。
- 输出 `{ ok, projectErrors, driftErrors, missingSpec, assertionCoverage, skipFindings }` JSON；任一非空 `exit(1)`。

**Step 4:** 运行测试，预期全 PASS。

---

### Task 4: template/ 业务接入骨架

**Files:**
- Create: `se-testing/template/playwright.config.ts`
- Create: `se-testing/template/intentions/login-success.yaml`（示例 active 意图）
- Create: `se-testing/template/specs/login-success.spec.ts`（示例 spec，头部对齐 v1）
- Create: `se-testing/template/support/fixtures/users.json`
- Create: `se-testing/template/support/pages/login.page.ts`（Page Object 示例）
- Create: `se-testing/template/report.md`（可审计产物模板，含 6.2 五个区块占位）

**Step 1:** 写示例意图/spec/fixture，使其能通过两脚本（version 对齐、占位符可解析、无 skip）。
**Step 2:** 写 `report.md` 模板：意图→spec→pass/fail 链、validate 原文区、check-binding 原文区、git diff 摘要区、Playwright 报告/trace 路径区。
**Step 3:** 在 `se-testing/` 根运行 `node tools/validate-intention.mjs template` 与 `node tools/check-binding.mjs template`，预期 `ok:true`、退出码 0（验证骨架自洽）。

---

### Task 5: 三个 skill

**Files:**
- Create: `se-testing/skills/testing-intent/SKILL.md`
- Create: `se-testing/skills/testing-spec/SKILL.md`
- Create: `se-testing/skills/testing-run/SKILL.md`

每个 SKILL.md 带 frontmatter（`name`/`description`），正文用 RFC2119 措辞：
- **testing-intent**：需求→意图。引导产出 draft 意图（schema 见上），强调 assertion 必须映射业务真相，定稿前 MUST 经人确认（draft→reviewed）与 critic 审查。
- **testing-spec**：意图→spec。引导按 reviewed/active 意图写 Playwright spec，spec 头 MUST 写 `// intention: x.yaml (vN)` 且 version 对齐；MUST NOT 用 skip/.only。
- **testing-run**：执行+失败分析。引导跑测试→按失败决策树（7.3）处置；收工前 MUST 跑两脚本并把 stdout 原样贴进 `report.md`；runner MUST NOT 自改 active 意图，只能产出提案。

---

### Task 6: 三个 subagent

**Files:**
- Create: `se-testing/agents/test-author.md`
- Create: `se-testing/agents/test-runner.md`
- Create: `se-testing/agents/critic.md`

- **test-author**：写意图/spec，加载 testing-intent / testing-spec skill。
- **test-runner**：执行+失败分类，加载 testing-run skill；MUST NOT 落盘改 active 意图。
- **critic**：全新上下文、对抗性 prompt；两个高风险节点（意图定稿前、报告产出前）专挑断言是否真覆盖业务、有无 skip/弱化/未跑 validate。

---

### Task 7: 入口映射（Claude Code）+ 编排说明

**Files:**
- Create: `se-testing/entry-map.claude-code.md`
- Create: `se-testing/.claude/` 接入示例（在 README 说明如何把 skills/agents 暴露给 Claude Code）

**Step 1:** 写 `entry-map.claude-code.md`：声明从哪读 skill、subagent 定义位置、跑脚本命令（`node tools/...`）。映射之外 MUST NOT 有按工具分叉逻辑。
**Step 2:** 描述 `/test <PRD>` 编排流：主上下文派发 author → 人确认 → author 写 spec → runner 执行 → critic 在两节点介入 → 产出 report。

---

### Task 8: 端到端自检 + 对抗测试（验收 9.4）

**Step 1:** 在 `se-testing/` 跑 `npm test`，全绿。
**Step 2:** `node tools/validate-intention.mjs template` + `node tools/check-binding.mjs template`，退出 0，贴输出。
**Step 3: 审计测试（9.4#3）**：临时把 `template/specs/login-success.spec.ts` 头部改成 `(v2)`，重跑 check-binding，确认抓出 version 漂移并非零退出；改回。
**Step 4:** 把上述证据汇总进一份 `template/report.md` 的填充示例或 README 的「验收」小节。
