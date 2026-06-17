# 测试执行报告（可审计产物）

> 由 `test-runner` 在收工前产出。每个「绿色」声明 **MUST** 附机器证据，使人类 / critic 能用证据反验。
> 模板共五区，**MUST** 全部填满；留空的区块本身就是「没跑」的证据，一眼可见。

- 任务：<一句话描述本次测试任务，如「为 PRD-登录 生成并运行测试」>
- 运行时间：<ISO8601>
- 运行环境：`E2E_BASE_URL=<...>`、commit `<sha>`

---

## 1. 意图 → spec → pass/fail 链

每条意图逐行列出，附 Playwright 结果证据（取自 `playwright-report/results.json`）。

| 意图 (version) | spec | assertion | 结果 | 证据 |
|---|---|---|---|---|
| login-success (v1) | specs/login-success.spec.ts | redirect-dashboard | ✅/❌ | `results.json` 中该用例 status |
| login-success (v1) | specs/login-success.spec.ts | greet-user | ✅/❌ | |
| login-success (v1) | specs/login-success.spec.ts | session-persisted | ✅/❌ | |

---

## 2. validate-intention 输出（原样粘贴，含退出码）

> 命令：`node ../se-testing/tools/validate-intention.mjs .`
> 退出码：`<0|1>`

```json
<把 stdout 原样粘到这里>
```

---

## 3. check-binding 输出（原样粘贴，含退出码）

> 命令：`node ../se-testing/tools/check-binding.mjs .`
> 退出码：`<0|1>`

```json
<把 stdout 原样粘到这里；projectErrors / version 漂移 / 缺 spec / assertionCoverage / skip 逐条可见>
```

---

## 4. 本次 git diff 摘要

- 改动的意图文件：<list 或「无」>
- 新增/删除的断言：<逐条；断言被删除是高风险信号，critic 必查>
- 改动的 spec / fixtures / page object：<list>

```diff
<git diff --stat 或关键片段>
```

---

## 5. Playwright 原始报告与 trace

- HTML 报告：`playwright-report/html/index.html`
- JSON 结果：`playwright-report/results.json`
- 失败用例 trace：`<trace.zip 路径列表，或「本次无失败」>`

---

## 失败处置记录（如有，依失败决策树）

| 失败用例 | 分类 | 处置 | 结果 |
|---|---|---|---|
| <test> | 选择器失效 / 数据问题 / 环境抖动 / 疑似意图层 | runner 自主修 Page Object / 修 fixtures / 记 flaky / **升级 critic + 产出提案停下** | 重跑通过 / 等人确认 |

> 提醒：runner **MUST NOT** 直接修改 `active` 意图。疑似意图层问题只能产出带 git diff 的「提案」并停下等人。
