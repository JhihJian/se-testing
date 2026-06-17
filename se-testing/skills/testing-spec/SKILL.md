---
name: testing-spec
description: 把已 reviewed/active 的意图实现成 Playwright spec——怎么测。spec 头部必须写意图绑定行且版本号对齐，禁止 skip/.only，业务数据只能取自 fixture。
---

# testing-spec：意图 → spec

spec 层回答 **「怎么测」**。它 **MUST** 忠实实现意图的每条断言，不增不减、不弱化。

> RFC 2119：MUST / MUST NOT / SHOULD / MAY。

## 何时用

意图已 `reviewed` 或 `active`，需要把它落成可运行的 Playwright 测试。

## 绑定锚点（最重要）

每个 spec 文件的**首个非空行 MUST** 是意图绑定行：

```ts
// intention: login-success.yaml (v1)
```

- `(vN)` **MUST** 等于意图 yaml 的 `version`。`check-binding` 会解析比对，漂移即报错——这是直接消灭原 se.testing 最大技术债的机制。
- 改动意图语义 → 先升意图 `version` → 再同步此处 `(vN)`。两边必须一起动。

## 实现规则

- 每条意图 `assertion` **MUST** 对应至少一处 `expect`，并 **MUST** 用独立注释行 `// assertion: <id>` 标出对应关系。`check-binding` 会把缺失或未知的 assertion 标记报到 `assertionCoverage`。
- 业务数据 **MUST** 取自 `support/fixtures/*.json`，**MUST NOT** 在 spec 里硬编码；占位符 `{{users.validUser.name}}` 对应 fixture 路径。
- 操作步骤 **SHOULD** 收敛到 `support/pages/*.page.ts`（Page Object），spec 只表达意图。
- **MUST NOT** 使用 `test.skip` / `test.only` / `fixme`。`check-binding` 静态扫描会抓出，report 里一眼可见。被跳过的测试等于没覆盖那条意图。

## 步骤

1. 读意图，确认 `status` 是 reviewed/active、记下 `version`。
2. 建 `specs/<id>.spec.ts`，首行写绑定行 `// intention: <id>.yaml (vN)`。
3. 为每条断言写 `expect`，每条 `expect` 前用独立行 `// assertion: <id>` 绑定意图断言；数据走 fixture，操作走 Page Object。
4. 跑 `node <se-testing>/tools/check-binding.mjs .`，确认无 drift / 无 skip / active 意图都有 spec / `assertionCoverage` 为空。

## MUST / MUST NOT

- **MUST NOT** 通过放宽断言（如把精确断言换成 `toBeTruthy`）让测试变绿——那是语义作弊，留在 git diff 里，critic 必查。
- **MUST NOT** 删除意图要求的断言。
- 选择器/数据导致的失败属执行层，交 [testing-run](../testing-run/SKILL.md) 处置；**MUST NOT** 反过来削意图。

下一步：用 [testing-run](../testing-run/SKILL.md) 执行并产出可审计 report。
