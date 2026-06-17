# 校验内核

## 职责

校验内核位于 `se-testing/tools/`，是零 Agent 依赖的 Node ESM 脚本集合。它负责把意图层和执行层之间可机检的信任规则转为结构化 JSON 输出和退出码。

## 组件

- `tools/lib/yaml.mjs`：使用 `js-yaml` 解析标准 YAML。
- `tools/lib/intention.mjs`：共享 UTF-8/BOM 读取、文件扫描、意图加载、spec 头解析、占位符提取和 fixture 路径解析。
- `tools/validate-intention.mjs`：校验意图 YAML。
- `tools/check-binding.mjs`：校验意图与 spec 的绑定关系。
- `tools/*.test.mjs`：用 `node:test` 固定核心规则。

## validate-intention

`validate-intention` 读取目标项目的 `intentions/*.yaml`，输出 `{ ok, scanned, errors, warnings }`。当前规则包括：

- 缺少 `intentions/` 或没有任何意图文件时失败，防止空扫假阳性。
- YAML 必须可解析。
- 必填字段包括 `id`、`version`、`status`、`title`、`business_context` 和 `assertions`。
- `status` 只能是 `draft`、`reviewed`、`active`、`needs_update`。
- `version` 必须是正整数，`id` 必须与文件名一致。
- `assertions` 必须非空，且每条有唯一 `id` 和 `description`。
- `fixtures` 如声明，必须是 `.json` 文件列表且文件存在。
- `{{file.key.path}}` 占位符必须对应已声明 fixture 和可达 JSON 路径。
- assertion 描述中的 email、手机号和长数字串作为硬编码启发式 warning，不阻断。

## check-binding

`check-binding` 读取目标项目的 `intentions/*.yaml` 和 `specs/**/*.spec.ts`，输出 `{ ok, scannedIntentions, scannedSpecs, projectErrors, driftErrors, missingHeader, missingSpec, assertionCoverage, skipFindings }`。当前规则包括：

- 缺少 `intentions/`、缺少 `specs/`、空意图集或 YAML 解析失败时进入 `projectErrors`。
- 每个 spec 首个非空行必须是 `// intention: <file>.yaml (vN)`。
- spec 标注版本必须等于对应意图的 `version`。
- `active` 意图必须至少有一个 spec 引用。
- `active` 意图的 assertion 必须被 spec 中的独立 `// assertion: <id>` 标记覆盖，未知标记也会报错。
- spec 代码中出现 `.skip`、`.only` 或 `fixme` 会进入 `skipFindings`；扫描会剥离注释和字符串，降低误报。

## 运行约束

- Node 版本要求为 `>=18`。
- 唯一运行依赖是 `js-yaml`。
- 脚本只读取目标项目文件并报告，不直接修改文件。
- 任一 error 类结果非空时退出码为 1；只有 warning 时 `validate-intention` 仍可退出 0。
