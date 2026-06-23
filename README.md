# se-testing

面向 Codex Agent 自主执行的测试工程能力包，用于把业务需求转成可审计的端到端测试闭环：意图生成、journey 分支索引、Playwright spec 实现、执行、失败分析与审计报告。

本仓库当前包含插件实现、设计文档、架构基线和一个可运行的登录 fixture 项目。插件主体在 [`se-testing/`](se-testing/) 目录，详细使用说明见 [`se-testing/README.md`](se-testing/README.md)。

## 仓库结构

```text
.
├── se-testing/             # Codex plugin：skills、agents、tools、template、examples
├── e2e-fixture-project/    # 从模板接出的示例业务测试项目
├── docs/                   # 开发计划与过程文档
├── _se/                    # 项目架构基线
└── STANDALONE_DESIGN.md    # 独立测试工程设计蓝图
```

## 快速验证

```powershell
cd se-testing
npm install
npm test
npm run validate
npm run dogfood
```

`npm test` 运行校验工具的单元测试；`npm run validate` 校验插件模板；`npm run dogfood` 使用内置登录 fixture 跑真实 Playwright 测试并生成审计报告。

## 使用入口

- 插件说明：[se-testing/README.md](se-testing/README.md)
- 设计蓝图：[STANDALONE_DESIGN.md](STANDALONE_DESIGN.md)
- 架构基线：[_se/project/architecture/ARCHITECTURE.md](_se/project/architecture/ARCHITECTURE.md)

## 当前定位

当前插件主体为 v0.2.0：核心目标是让 Agent 可以按“意图 -> journey -> spec -> 执行 -> 报告”的流程自主完成测试工程闭环，并通过四个机器校验脚本与 git diff 保留审计面。
