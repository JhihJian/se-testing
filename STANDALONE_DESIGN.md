# 面向 AI Agent 的独立测试工程设计

> 版本：0.1（设计草案） · 日期：2026-06-17 · 定位：参考资料
>
> 本文档是「把 `se.testing` 拆分为一个独立、完全面向 AI Agent 自主执行的测试工程项目」的设计蓝图。它只描述**应当如何设计**，不包含可运行测试代码，也不负责管理具体业务测试资产。

---

## 规范性语言

沿用 [TEST_ARCHITECTURE.md](framework/meta/TEST_ARCHITECTURE.md) 的 RFC 2119 风格：**MUST** / **MUST NOT** / **SHOULD** / **MAY**。

---

## 1. 背景与目标

当前 `se.testing` 通过「Agent 读 prompt → 遵守 markdown 规范」工作，本质是**文档约定**，依赖人类在每一步 review。本设计的目标是把它独立成一个项目，使其：

- **完全面向 AI Agent 自主执行**：Agent 接收任务（如「为这份 PRD 生成测试并运行」），自主完成 **意图生成 → spec 实现 → 执行 → 失败分析** 的完整闭环。
- **可在任意支持 subagent 的 Agent 工具中使用**：Claude Code、Codex 或其他，同一套资产通用。
- **只提供能力，不持有业务测试资产**：独立项目交付 skill / subagent / 检查脚本 / 项目骨架；具体测试代码留在各业务项目里。

### 角色定位（核心前提）

Agent 是**执行者**，不是协作者。它自主推进闭环，人类只在少数语义节点介入（见第 6 节）。

---

## 2. 信任模型

### 2.1 根本矛盾

当 Agent 自主跑完闭环时，它同时是**意图作者、spec 实现者、失败分析者**。它有动机为了让测试变绿而偷偷弱化断言、擅改意图、skip 用例。这是自主测试 Agent 的根本信任问题。

### 2.2 设计取舍：放弃硬强制

skill / subagent / prompt 本质都是「注入上下文的文档」，是**软引导**，Agent 读了可以选择不照做。真正的机器强制只能落在 Agent 绕不过的执行路径上（Claude Code 的 hooks、git pre-commit、CI）。

本设计**放弃硬强制**，换取轻量与跨工具一致性。硬强制作为 **opt-in 增强**保留（见第 7 节），不进核心。

### 2.3 不依赖强制的三个天然杠杆

放弃硬强制不等于放弃防护。信任支点转移到三个**不依赖任何 hook** 的事实面：

1. **Playwright 断言结果是机器事实**：Agent 无法让一个真正 failing 的测试显示 pass，它只能改测试内容，而改动逃不过 git diff。
2. **意图层的存在即审计面**：把「测什么」（意图）与「怎么测」（spec）分离后，偷偷弱化断言会造成意图与 spec 不一致，可被检查脚本检出。
3. **Git diff 是廉价审计面**：意图与断言的任何弱化都是可见的版本变更。

### 2.4 核心原则

> **让作弊留痕，让诚实成为最省力路径。**

检查脚本（`validate`）定位为 **Agent 自检 + 人类事后审计的廉价工具**，不是强制 gate。流程设计让「跑 validate 并贴结果」成为最省力路径，而「不跑」会在审计产物里露馅。

---

## 3. 整体形态与目录

独立项目（暂称 `se-testing`）是一个**可安装的 Agent 能力包 + 可移植内核**：

```text
se-testing/
  skills/                  # 流程规范（运行时无关的 markdown）
    testing-intent/        #   需求 → 意图 引导
    testing-spec/          #   意图 → spec 引导
    testing-run/           #   执行 + 失败分析 引导
  agents/                  # subagent 定义（自主执行角色）
    test-author.md         #   写意图 / 写 spec
    test-runner.md         #   执行 + 失败分类
    critic.md              #   对抗审查
  tools/                   # 语言无关检查脚本（与 agent 无关）
    validate-intention.mjs #   意图 schema / fixtures 引用 / 无硬编码
    check-binding.mjs      #   意图↔spec version 一致性 / skip 扫描
  template/                # 业务项目接入骨架
    intentions/  specs/  support/  playwright.config.ts
    report.md              #   可审计产物模板
  <entry-map>              # 各工具入口映射（见第 5 节）
  README.md
```

**壳与核**：`skills` / `agents` 是壳，负责把正确流程教给 Agent；`tools` / `template` 是核，可独立运行（`node tools/validate-intention.mjs`），不依赖任何 agent 运行时。

**业务项目接入**：把 `template/` 复制进目标项目（如 `test-engineering/`），Agent 在那里维护 `intentions/` 与 `specs/`。`se-testing` 本身只提供能力。

---

## 4. 自主闭环：skill 拆分与 subagent 分工（方案 A）

自主闭环有四阶段：**需求→意图 / 意图→spec / 执行→报告 / 失败→处置**。

```text
/test <PRD>  ──▶  编排者（主上下文）
                    │
   ┌────────────────┼────────────────────────┐
   ▼                ▼                          ▼
test-author      test-runner            critic（仅高风险节点）
意图→spec草稿     执行+失败分类           对抗审查
   │                │                          ▲
   └─ testing-intent / testing-spec skill      │
                    └─ testing-run skill        │
   意图定稿前、报告产出前 ─────────────────────┘
```

### 4.1 设计要点

- **三个 skill 对应阶段，按需懒加载**：继承 `se.testing` 的优点，不一次性灌满上下文。
- **两个执行 subagent**：`test-author`（写）与 `test-runner`（跑）天然形成职责分离。
- **critic 是放弃硬强制后唯一的结构性防作弊杠杆**。它不是独立阶段，只在两个高风险节点被编排者唤起：
  1. **意图即将定稿时**：挑「断言是否真覆盖业务」。
  2. **报告产出前**：挑「有没有 skip、断言是否被弱化、validate 跑了没」。

  critic **MUST** 使用全新上下文、对抗性 prompt，专门跟 author / runner 唱反调。

### 4.2 防作弊分工

- **validate 抓可机检的作弊**：version 漂移、skip、断言计数下降。
- **critic 抓语义作弊**：断言测错了点、意图没覆盖业务。

二者互补，缺一不可。

---

## 5. 统一运行时抽象

设计**不绑定具体工具**，而是声明一组**运行时原语**。任何 Agent 工具只要提供这四个能力，就能原样运行，**MUST NOT** 为某个工具特判：

| 原语 | 用途 | 依赖资产 |
|---|---|---|
| **规范加载** | 把流程规范注入上下文 | `skills/*.md` |
| **subagent** | 独立上下文执行角色 | `agents/*.md` |
| **shell 调用** | 跑检查脚本 | `tools/*.mjs` |
| **文件读写** | 维护意图与 spec | `template/` |

### 5.1 单一来源，零分支

`skills/`、`agents/`、`tools/`、`template/` 四类资产**逐字节通用**。每个工具只需一个**几行的入口映射**，声明：从哪读 skill、subagent 定义在哪、用什么命令跑脚本。映射之外 **MUST NOT** 存在任何按工具分叉的逻辑。

### 5.2 前提假设

目标工具 **MUST** 支持 subagent / 独立上下文子任务。不满足的工具不在支持范围内——用边界换设计的纯粹，而非用降级把复杂度摊进核心。

由此，critic 在所有端都是**真 subagent**，职责分离（独立上下文、对抗视角）是全局保证；第 4、6 节的闭环与信任链在所有 runtime 上**等价成立**。

---

## 6. 信任锚点：validate 脚本与可审计产物

放弃硬强制后，可信度全压在这一层。核心：**Agent 的每个「绿色」声明都 MUST 附带机器证据，使人类或 critic 能用证据反验。**

### 6.1 两个独立脚本（`tools/`，node 实现、零 agent 依赖）

- **`validate-intention.mjs`**：意图 yaml schema 合规、`status` 合法、`{{}}` 占位符指向的 fixtures 真实存在、无硬编码数据。
- **`check-binding.mjs`**：逐个 spec 解析头部 `// intention: x.yaml (vN)`，与 yaml 的 `version` 比对，漂移即报错（**直接消灭原 se.testing 最大技术债**）；检查每条 `active` 意图有对应 spec；统计 spec 内 `expect` 数 vs 意图 `assertions` 数做**弱化启发式告警**；静态扫描 `skip` / `fixme` / `.only`。

两脚本**只报告、不阻断**（无 hook），但输出结构化 JSON + 非零退出码。

### 6.2 可审计产物 `report.md`（runner 产出）

```text
意图 → spec → pass/fail 链（每条带 Playwright JSON 证据）
validate-intention 输出原文（退出码 + stdout 原样粘贴）
check-binding 输出原文（version 漂移 / 弱化告警逐条）
本次 git diff 摘要：改了哪些意图、哪些断言被增删
Playwright 原始报告 + trace 路径
```

### 6.3 关键机制

skill 引导 Agent 在收工前跑两个脚本、把 stdout **原样**贴进报告。Agent 想跳过 validate，报告里那两栏就是空的——critic 和人类一眼看到。**「不跑」本身会露馅，于是跑反而成了最省力路径。**

---

## 7. 人类介入点与失败处置闭环

A 模式让 Agent 尽量自主，但有三类事**机器和 Agent 都给不出可信答案**，**MUST** 停下等人；其余全自主。

### 7.1 人类介入点（最小集，只留三个）

1. **意图定稿确认**（`draft → reviewed`）：「是否真反映业务需求」是语义真相，人拍板。
2. **业务真相裁决**：失败退回意图层时，判断断言失配是「代码 bug」还是「需求变了」。
3. **critic 死锁**：critic 与 author / runner 对抗循环超过上限仍不收敛，把分歧原样呈给人。

### 7.2 全自主（Agent + critic 闭环，无需人）

- 意图 `reviewed → active`（spec 生成 + 首次通过，是机器事实）。
- 所有执行层失败修复（见下）。

### 7.3 失败处置闭环

继承 [failure-spec.md](framework/docs/failure-spec.md)，映射到自主角色：

```text
runner 跑出失败 → 失败分类决策树
  ├─ 选择器失效   → runner 自主修 Page Object → 重跑
  ├─ 数据问题     → runner 自主修 fixtures   → 重跑
  ├─ 环境抖动     → runner 记 flaky-cases.md
  └─ 疑似意图层问题 → runner MUST NOT 自行改意图！
        └─ 升级 critic 判断
              ├─ 断言设计偏差 → 生成意图修正「提案」→ 停，等人确认
              └─ 业务变更     → 生成 needs_update「提案」→ 停，等人裁决
```

### 7.4 守护「意图不因执行困难而妥协」

`test-runner` / `test-author` **MUST NOT** 直接落盘修改 `active` 意图，**只能「提议」**。提案是带 git diff 的草稿，人类批准前不进意图。技术上没有 hook 拦它，但流程让「擅自改意图」必然表现为一条**没有人类批准记录的意图变更**——critic 和审计一眼可见。**修改权受控，靠的是流程可见性，不是程序锁。**

---

## 8. opt-in 硬强制（可选增强）

给重视强制的接入方留口子，**MUST NOT** 进核心、**MUST NOT** 成为默认：

- **Claude Code**：`Stop` hook 在 Agent 想收工时跑 `tools/` 脚本，非零退出则不许结束。
- **通用场景**：git pre-commit hook / CI 跑同一套 `tools/` 脚本。

要硬强制的人自己装，不要的人零负担。复用同一套 `tools/`，不产生第二份逻辑。

---

## 9. MVP 范围与迭代路线

**YAGNI 砍到底**——MVP 只为证明：**自主闭环能跑通，且信任模型在对抗下成立。**

### 9.1 v0（MVP）必含

- 三 skill（intent / spec / run）+ 三 subagent（author / runner / critic）。
- 两个最硬的检查：`check-binding` 的 **version 漂移**检测 + **skip / .only 静态扫描**（断言计数等启发式留到二期）。
- `template/` 骨架 + `report.md` 模板。
- **只接一个工具**的入口映射，跑通一条 happy path：PRD → draft 意图 → 人确认 → spec → 执行 → 带证据的 report。

### 9.2 MVP 砍掉

契约测试、知识层 / memory 沉淀、弱化启发式、多环境、CI、opt-in hook、第二个工具适配。

### 9.3 迭代路线

| 版本 | 增量 | 验证的命题 |
|---|---|---|
| v0 | 单工具闭环 + 两硬检查 | 自主闭环成立 |
| v1 | 第二工具入口映射 + 完整失败分类 + critic 对抗循环 | 统一抽象真的零分支 |
| v2 | 知识层、memory、弱化启发式、契约测试 | 经验可沉淀 |
| v3 | opt-in 硬强制模板、多环境 | 重强制场景可选增强 |

### 9.4 验收标准（关键是第 2、3 条对抗测试）

1. 真实 PRD 走通全链，report 含 validate 原文 + Playwright 证据。
2. **诱惑测试**：构造「改一行断言就变绿」的场景，验证 runner **不自行改 active 意图**，而是产出升级提案、停下等人。
3. **审计测试**：手工制造一个 version 漂移，验证 `check-binding` 必抓出，且 report 中可见。

第 2、3 条直接拷问「放弃硬强制后可信度还在不在」——过不了，整个设计前提被证伪，须回炉。

---

## 10. 设计决策记录

| 决策 | 选择 | 理由 |
|---|---|---|
| Agent 角色 | **执行者**（自主闭环） | 目标是自主完成意图→spec→执行→分析 |
| 强制力 | **放弃硬强制，纯 skill/agent** | 换取轻量与跨工具一致性；防护转移到三个天然杠杆 |
| 闭环拆分 | **方案 A**：阶段化 skill + 双执行角色 + 节点 critic | 保住懒加载，用最小代价补回职责分离 |
| 跨端策略 | **统一运行时抽象，不做区别化** | 假设所有工具支持 subagent；用边界换纯粹 |
| 意图修改权 | **runner/author 只能提议，人类批准** | 靠流程可见性守护「意图不妥协」 |

---

## 关联文档

- [TEST_ARCHITECTURE.md](framework/meta/TEST_ARCHITECTURE.md) — 现行测试工程宪法
- [intention-spec.md](framework/docs/intention-spec.md) — 意图层 Schema 与生命周期
- [execution-spec.md](framework/docs/execution-spec.md) — 执行层规范（version 对齐技术债来源）
- [failure-spec.md](framework/docs/failure-spec.md) — 失败分类与退回机制
- [ai-spec.md](framework/docs/ai-spec.md) — AI 辅助边界
