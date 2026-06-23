---
name: testing-run
description: 执行 Playwright 测试并做失败分析。按失败决策树自主修执行层问题；疑似意图层问题只能升级 critic 并产出提案、停下等人；收工前必须跑 validate/check-intentions/check-journeys/check-binding 并在 report.md 或 artifacts 中保留可复核输出；支持按测试分片并发运行。
---

# testing-run：执行 -> 报告 / 失败 -> 处置

> RFC 2119：MUST / MUST NOT / SHOULD / MAY。

## 何时用

意图已有 spec，需要运行、分析失败、产出带证据的可审计报告。

## 信任锚点：收工前 MUST 跑检查脚本并保留可复核输出

放弃硬强制后，可信度全压在「机器证据」上。收工前 **MUST**：

1. `node <se-testing>/tools/validate-intention.mjs .` —— 保存 stdout 原文，记录退出码，并在 `report.md` 第 2 区提供可复核索引。
2. `node <se-testing>/tools/check-intentions.mjs .` —— 保存 stdout 原文，记录退出码，严格检查意图质量。
3. `node <se-testing>/tools/check-journeys.mjs .` —— 若项目维护 journey，保存 stdout 原文，记录退出码；warning 必须在报告中回应。
4. `node <se-testing>/tools/check-binding.mjs .` —— 保存 stdout 原文，记录退出码；`projectErrors` 与 `assertionCoverage` 必须为空。
5. 填满 `report.md` 全部证据区（意图链 / validate / check-intentions / check-journeys / check-binding / git diff 摘要 / Playwright 报告与 trace）。

**留空的区块就是「没跑」的铁证**，critic 和人类一眼看到。于是「跑 validate 并保留可验证证据」反而是最省力路径——这是整个信任模型的支点。**MUST NOT** 手写编造脚本输出。

## 报告长度控制

`report.md` 是审计入口，不是无限日志仓库。stdout / runner 输出 **MUST** 原样保留，但 **MAY** 在过长时放入 artifacts 文件，避免 `report.md` 失控。

默认阈值：

- `REPORT_INLINE_MAX_LINES=300`
- `REPORT_INLINE_MAX_BYTES=50000`
- `REPORT_EXCERPT_HEAD_LINES=80`
- `REPORT_EXCERPT_TAIL_LINES=40`

规则：

- 当某段 stdout 同时不超过 `REPORT_INLINE_MAX_LINES` 与 `REPORT_INLINE_MAX_BYTES` 时，**MAY** 原样内联到 `report.md`。
- 当 stdout 超过任一阈值时，**MUST** 原样写入 `test-artifacts/<name>.stdout.txt`，`report.md` **MUST** 写命令、退出码、artifact 路径、字节数、行数、sha256，并只内联 bounded excerpt（head/tail）。
- Playwright 长输出、trace 列表、失败日志同理：长内容进 `test-artifacts/`，`report.md` 放索引和摘要。
- `report.md` 中的摘要 **MUST NOT** 替代原始 stdout；artifact 缺失、sha256 缺失或 excerpt 标注不清都视为证据不完整。

推荐 artifact 命名：

```text
test-artifacts/
  validate-intention.stdout.txt
  check-intentions.stdout.txt
  check-journeys.stdout.txt
  check-binding.stdout.txt
  playwright-output.txt
```

## 失败分类决策树

```text
runner 跑出失败
  |-- 选择器失效   -> 自主修 support/pages/*.page.ts -> 重跑
  |-- 数据问题     -> 自主修 support/fixtures/*.json -> 重跑
  |-- 环境抖动     -> 记 flaky-cases.md，不改测试逻辑
  `-- 疑似意图层问题（断言与现状矛盾）-> MUST NOT 自行改意图！
        `-- 升级 critic 判断
              |-- 断言设计偏差 -> 生成意图修正「提案」(带 git diff) -> 停，等人确认
              `-- 业务变更     -> 把意图标 needs_update 的「提案」 -> 停，等人裁决
```

## 并发加速

编排者 **MAY** 并发派发多个 runner 跑独立测试分片，例如：

- `npx playwright test specs/auth`
- `npx playwright test specs/assets`
- `npx playwright test specs/vulnerabilities`

并发约束：

- 每个 runner **MUST** 只修自己分片对应的执行层文件，如已分配的 Page Object、fixture 或分片专属 helper。
- 多个 runner **MUST NOT** 同时写 `report.md`；最终报告由主上下文统一生成。
- Playwright 输出、trace、失败日志 **SHOULD** 按分片写入 `test-artifacts/<shard>/`，避免互相覆盖。
- runner 发现疑似意图层问题时仍 **MUST** 升级 critic 并停下等人，不能因为并发执行而直接改 active 意图。
- 主上下文最终 **MUST** 串行跑全量检查脚本与必要的全量 Playwright 验证，作为交付结论。

## MUST / MUST NOT（守护意图不妥协）

- runner **MUST NOT** 直接落盘修改 `active` 意图，**只能提议**：提案是带 git diff 的草稿，人批准前不进意图。
- **MUST NOT** 用 `test.skip`/`.only`、放宽断言、删断言来让测试变绿。任何此类改动都留在 git diff，report 第 4 区必须如实列出断言增删。
- 执行层失败（选择器/数据/环境）**MAY** 自主修复并重跑，无需等人。
- **报告产出前 MUST 唤起 critic**：挑「有没有 skip、`projectErrors`/`assertionCoverage` 是否为空、断言是否被弱化、validate/check-intentions/check-journeys/check-binding 跑了没、journey warning 是否回应、长输出 artifact 是否存在且 sha256 可复核」。

## 步骤

1. 跑 Playwright（如 `npx playwright test`），保留 trace（config 已设 `retain-on-failure`）。
2. 失败按决策树处置；执行层自主修复后重跑直到稳定。
3. 跑检查脚本，stdout 原样保留；短输出可内联进 report，长输出写入 artifacts 并在 report 中记录索引、摘要和 sha256。
4. 填 report 证据区 + 失败处置记录。
5. 唤起 critic 做报告产出前审查；critic 死锁超上限则把分歧原样呈人。
