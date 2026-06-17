# Agent 运行时壳

## 职责

Agent 运行时壳负责把测试工程流程暴露给具备文件读写、shell 调用和子代理能力的 Agent 工具。它提供阶段化 skill、角色化 agent 说明和具体运行时入口映射，但不实现校验算法。

当前已实现两类入口：

- Codex plugin：`.codex-plugin/plugin.json` 声明插件元信息、skills 目录和界面提示。
- Claude Code 参考映射：`entry-map.claude-code.md` 描述如何把相同的 `skills/`、`agents/`、`tools/` 和 `template/` 接到 Claude Code。

## 子模块

- `skills/testing-intent/SKILL.md`：需求到意图，定义意图 schema、状态流转和定稿前 critic 审查。
- `skills/testing-spec/SKILL.md`：意图到 Playwright spec，定义 spec 头部绑定、assertion 标记和禁止 skip/only。
- `skills/testing-run/SKILL.md`：执行、失败分类和报告，定义收工前必须运行两个校验脚本并原样贴出结果。
- `agents/test-author.md`：负责写意图和 spec。
- `agents/test-runner.md`：负责执行 Playwright、修执行层问题和产出报告。
- `agents/critic.md`：负责对抗审查意图覆盖、断言弱化、skip、校验证据和未经批准的 active 意图修改。

## 依赖关系

Agent 运行时壳依赖：

- `tools/validate-intention.mjs` 和 `tools/check-binding.mjs` 作为机器证据来源。
- `template/` 作为业务项目接入骨架。
- 业务项目中的 Playwright 环境作为执行目标。

Agent 运行时壳不能被 `tools/` 反向依赖。所有运行时特化都必须停留在入口映射或插件 manifest，不能分叉校验规则。

## 关键规则

- skill 是流程约束，不是硬强制；默认可信度来自证据可审计。
- critic 是放弃默认硬强制后的结构性防作弊角色，只在意图定稿前和报告产出前介入。
- `draft -> reviewed` 和业务真相裁决必须由人确认。
- opt-in hook 或 CI 可以复用 `tools/`，但不能成为默认核心路径。

## 待确认

- `agents/` 当前是角色说明资产；不同 Agent 运行时是否自动识别这些 agent，需要由具体入口映射或插件安装方式确认。
