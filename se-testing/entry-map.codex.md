# 入口映射：Codex

> 这是 se-testing 在 **Codex** 上的入口映射。核心规则仍以 `skills/` 为准；本文件只说明如何在 Codex 中编排 skill、subagent、shell 与文件产物。

## 四个运行时原语 → Codex 能力

| 原语 | 资产 | 在 Codex 怎么接 |
|---|---|---|
| 规范加载 | `skills/*/SKILL.md` | 通过 Codex skill 触发并完整读取对应 `SKILL.md` |
| subagent | `agents/*.md` | 用 Codex subagent 工具派发独立上下文任务 |
| shell 调用 | `tools/*.mjs` | 用 shell 跑 `node <se-testing>/tools/<script>.mjs <project-dir>` |
| 文件读写 | `template/` | 复制进业务项目后维护 `intentions/`、`intentions/journeys/`、`specs/`、`support/`、`report.md` |

业务项目也可以把测试资产放在 `tests/` 下，此时同样维护 `tests/intentions/`、`tests/intentions/journeys/`、`tests/specs/`、`tests/support/`。工具命令可传项目根或 `tests`，会自动识别资产根。

## 编排流

主上下文是编排者与最终集成者：

```text
测试任务 ──▶ 主上下文
   1. test-author：需求 → 路径/分支索引（testing-journey，可选但推荐用于多分支路径）
   2. test-author：需求/分支 → draft 意图（testing-intent）
   3. 主上下文：跑 check-journeys.mjs，回应 warning 或回炉拆分
   4. critic：journey 与意图定稿前对抗审查
   5. 人类介入点：确认 draft → reviewed
   6. test-author：reviewed/active 意图 → spec（testing-spec）
   7. test-runner：执行 + 失败分类（testing-run）
   8. critic：报告产出前对抗审查
   9. 主上下文：最终校验、汇总 artifacts、产出 report.md
```

定稿和执行期间，主上下文必须特别检查语义边界：同名字段、同终态、同错误消息、枚举与自由文本输入不能被合并成同一条业务约束。

## 并发加速编排

当任务可拆分时，主上下文 **SHOULD** 尽早并发派发 subagent，并给每个 subagent 明确文件所有权。

推荐切分：

1. journey 阶段按业务路径切分：`intentions/journeys/<path>.yaml`。
2. intent 阶段按业务域或 journey 分支切分：`intentions/<domain>-*.yaml`、`support/fixtures/<domain>.json`。
3. spec 阶段按 reviewed/active 意图切分：`specs/<id>.spec.ts`。
4. runner 阶段按 spec 文件或目录分片运行：输出写入 `test-artifacts/<shard>/`。
5. critic 只读并发：分别审查不同 journey、业务域、spec 集合或报告分片。

硬规则：

- 主上下文唯一负责最终集成、全量 `validate-intention.mjs`、全量 `check-intentions.mjs`、全量 `check-journeys.mjs`、全量 `check-binding.mjs`、必要的全量 Playwright 与最终 `report.md`。
- worker prompt **MUST** 写明可修改文件；worker **MUST NOT** 修改未分配文件。
- 多个 worker **MUST NOT** 同时写同一个 fixture、Page Object、helper 或 `report.md`。
- 共享文件先拆分到域级文件；无法拆分时交主上下文串行合并。
- 并发数量取 `min(独立意图数量, 独立 spec 数量, 可用测试环境容量, 不冲突文件集合数量)`，再加 1-2 个只读 critic。

## Codex Worker Prompt 模板

```text
Use se-testing for this task.
You are one of multiple concurrent workers. Do not modify files outside your ownership.

Role: <test-author | test-runner | critic>
Ownership:
- <file-or-directory>
- <file-or-directory>

Task:
<具体意图/spec/runner/critic任务>

Return:
- changed files, if any
- commands run
- validation result or blockers
```
