# 入口映射：Claude Code

> 这是 se-testing 在 **Claude Code** 上的入口映射——统一运行时抽象（设计第 5 节）落到具体工具的**几行声明**。
> 映射之外 **MUST NOT** 存在任何按工具分叉的逻辑；`skills/`、`agents/`、`tools/`、`template/` 四类资产**逐字节通用**。

## 四个运行时原语 → Claude Code 能力

| 原语 | 资产 | 在 Claude Code 怎么接 |
|---|---|---|
| 规范加载 | `skills/*/SKILL.md` | 放进 `.claude/skills/`（或 plugin），用 Skill 工具按需懒加载 |
| subagent | `agents/*.md` | 放进 `.claude/agents/`，用 Task 工具以独立上下文派发 |
| shell 调用 | `tools/*.mjs` | 用 Bash 工具跑 `node tools/<script>.mjs <project-dir>` |
| 文件读写 | `template/` | 复制进业务项目后用 Read/Write/Edit 维护 `intentions/`、`specs/` |

## 安装（把壳暴露给 Claude Code）

在业务项目根：

```bash
mkdir -p .claude/skills .claude/agents
cp -r <se-testing>/skills/*        .claude/skills/
cp <se-testing>/agents/*.md        .claude/agents/
cp -r <se-testing>/template/.      .            # 仅首次接入时铺骨架
```

`<se-testing>` 是本能力包所在路径。`tools/` **不必**复制——用绝对/相对路径直接 `node <se-testing>/tools/...` 调用即可（核可独立运行）。

## 编排流：`/test <PRD>`

主上下文（编排者）按设计第 4 节调度：

```text
/test <PRD>  ──▶  编排者（主上下文）
   1. Task → test-author：需求 → draft 意图（testing-intent skill）
   2. Task → critic：意图定稿前对抗审查（节点一）
   3. ⏸ 人类介入点：人确认 draft → reviewed
   4. Task → test-author：reviewed 意图 → spec（testing-spec skill）
   5. Task → test-runner：执行 + 失败分类（testing-run skill）
        · 执行层失败自主修复重跑
        · 疑似意图层问题 → 升级 critic → 产出提案 → ⏸ 等人
   6. Task → critic：报告产出前对抗审查（节点二）
   7. 产出 report.md（validate + check-binding 原文 + Playwright 证据）
```

三个人类介入点（设计第 7 节）：意图定稿确认、业务真相裁决、critic 死锁。其余全自主。

## opt-in 硬强制（可选，不进默认）

要强制的接入方自行加 `Stop` hook，复用同一套 `tools/`：

```jsonc
// .claude/settings.json （示例，opt-in）
{
  "hooks": {
    "Stop": [
      { "matcher": "", "hooks": [
        { "type": "command", "command": "node <se-testing>/tools/validate-intention.mjs . && node <se-testing>/tools/check-binding.mjs ." }
      ]}
    ]
  }
}
```

非零退出即阻止收工。不要的人零负担。
