---
name: testing-run
description: 执行 Playwright 测试并做失败分析。按失败决策树自主修执行层问题；疑似意图层问题只能升级 critic 并产出提案、停下等人；收工前必须跑两个检查脚本并把输出原样贴进 report.md。
---

# testing-run：执行 → 报告 / 失败 → 处置

> RFC 2119：MUST / MUST NOT / SHOULD / MAY。

## 何时用

意图已有 spec，需要运行、分析失败、产出带证据的可审计报告。

## 信任锚点：收工前 MUST 跑两脚本并原样贴出

放弃硬强制后，可信度全压在「机器证据」上。收工前 **MUST**：

1. `node <se-testing>/tools/validate-intention.mjs .` —— 把 stdout **原样**贴进 `report.md` 第 2 区，含退出码。
2. `node <se-testing>/tools/check-binding.mjs .` —— 把 stdout **原样**贴进 `report.md` 第 3 区，含退出码；`projectErrors` 与 `assertionCoverage` 必须为空。
3. 填满 `report.md` 全部五区（意图链 / validate / check-binding / git diff 摘要 / Playwright 报告与 trace）。

**留空的区块就是「没跑」的铁证**，critic 和人类一眼看到。于是「跑 validate 并贴结果」反而是最省力路径——这是整个信任模型的支点。**MUST NOT** 手写编造脚本输出。

## 失败分类决策树

```text
runner 跑出失败
  ├─ 选择器失效   → 自主修 support/pages/*.page.ts → 重跑
  ├─ 数据问题     → 自主修 support/fixtures/*.json → 重跑
  ├─ 环境抖动     → 记 flaky-cases.md，不改测试逻辑
  └─ 疑似意图层问题（断言与现状矛盾）→ MUST NOT 自行改意图！
        └─ 升级 critic 判断
              ├─ 断言设计偏差 → 生成意图修正「提案」(带 git diff) → 停，等人确认
              └─ 业务变更     → 把意图标 needs_update 的「提案」 → 停，等人裁决
```

## MUST / MUST NOT（守护意图不妥协）

- runner **MUST NOT** 直接落盘修改 `active` 意图，**只能提议**：提案是带 git diff 的草稿，人批准前不进意图。
- **MUST NOT** 用 `test.skip`/`.only`、放宽断言、删断言来让测试变绿。任何此类改动都留在 git diff，report 第 4 区必须如实列出断言增删。
- 执行层失败（选择器/数据/环境）**MAY** 自主修复并重跑，无需等人。
- **报告产出前 MUST 唤起 critic**：挑「有没有 skip、`projectErrors`/`assertionCoverage` 是否为空、断言是否被弱化、validate 跑了没」。

## 步骤

1. 跑 Playwright（如 `npx playwright test`），保留 trace（config 已设 `retain-on-failure`）。
2. 失败按决策树处置；执行层自主修复后重跑直到稳定。
3. 跑两个检查脚本，stdout 原样贴进 report。
4. 填 report 五区 + 失败处置记录。
5. 唤起 critic 做报告产出前审查；critic 死锁超上限则把分歧原样呈人。
