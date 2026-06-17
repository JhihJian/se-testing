# 0001 将 se-testing 定位为 Agent 能力包

- 状态：已采纳
- 日期：2026-06-17

## 背景

项目目标是让 Agent 能围绕需求自主完成测试意图生成、Playwright spec 实现、执行、失败分析和审计报告。Agent skill、subagent 和 prompt 本身不能提供硬强制，因此需要把可机检规则放到 Agent 绕不过的文件与命令证据上。

## 决策

`se-testing` 定位为“Agent 能力包 + 可移植校验内核”，而不是业务测试项目：

- 通过 Codex plugin manifest 和 skills 暴露 Agent 流程。
- 保留 agents 作为可被支持 subagent 的运行时使用的角色说明。
- 使用 Node ESM 脚本实现意图校验和意图/spec 绑定检查。
- 使用 `template/` 提供业务项目接入骨架。
- 默认不引入 hook 或 CI 硬强制；需要硬强制的接入方复用同一套 `tools/` 自行安装。

## 后果

- 业务测试资产归业务项目所有，能力包只提供流程、模板和校验工具。
- 可审计性来自 `report.md`、Playwright 结果、校验脚本 JSON 和 git diff，而不是默认阻断机制。
- 任何新运行时适配都应只增加入口映射，不能复制或分叉校验逻辑。
- 语义层作弊仍需要 critic 和人类确认补足，机器脚本只覆盖可静态检查的边界。

## 来源

- `STANDALONE_DESIGN.md`
- `docs/plans/2026-06-17-se-testing-mvp.md`
- `se-testing/README.md`
- `se-testing/.codex-plugin/plugin.json`
