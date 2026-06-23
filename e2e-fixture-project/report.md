# 测试执行报告

- 任务：虚构「星河协作台」登录业务项目，验证 se-testing 能否完成真实 e2e 行为验证与审计绑定检查
- 运行时间：2026-06-23T02:04:00Z
- 运行环境：`E2E_BASE_URL=http://127.0.0.1:4174`、Chromium、Windows

## 1. 意图 -> spec -> pass/fail 链

| 意图 (version) | spec | assertion | 结果 | 证据 |
|---|---|---|---|---|
| login-success (v1) | specs/login-success.spec.ts | redirect-dashboard | 通过 | `playwright-report/results.json` |
| login-success (v1) | specs/login-success.spec.ts | greet-user | 通过 | `playwright-report/results.json` |
| login-success (v1) | specs/login-success.spec.ts | session-persisted | 通过 | `playwright-report/results.json` |

Playwright 摘要（来自最近一次 fixture e2e 运行记录）：

```json
[
  {
    "file": "login-success.spec.ts",
    "title": "login-success.spec.ts > login-success > 正确凭证登录后进入仪表盘并保持会话",
    "projectName": "chromium",
    "expectedStatus": "passed",
    "status": "passed",
    "duration": 358,
    "retry": 0
  }
]
```

## 2. validate-intention 输出

命令：`npm run se:validate`
退出码：`0`

```json
{
  "ok": true,
  "scanned": 1,
  "errors": [],
  "warnings": []
}
```

## 3. check-intentions 输出

命令：`npm run se:check-intentions`
退出码：`0`

```json
{
  "ok": true,
  "scanned": 1,
  "errors": [],
  "warnings": []
}
```

## 4. check-journeys 输出

命令：`npm run se:check-journeys`
退出码：`0`

```json
{
  "ok": true,
  "scannedJourneys": 1,
  "errors": [],
  "warnings": []
}
```

journey warning 回应：独立夹具显式记录失败登录分支为夹具范围外的已知缺口。

## 5. check-binding 输出

命令：`npm run se:check-binding`
退出码：`0`

```json
{
  "ok": true,
  "scannedIntentions": 1,
  "scannedSpecs": 1,
  "projectErrors": [],
  "driftErrors": [],
  "missingHeader": [],
  "missingSpec": [],
  "assertionCoverage": [],
  "skipFindings": []
}
```

## 6. Playwright 原始报告与 trace

- HTML 报告：`playwright-report/html/index.html`
- JSON 结果：`playwright-report/results.json`
- 失败用例 trace：本次无失败

## 7. 执行命令记录

```text
npm run se:validate
退出码：0

npm run se:check-intentions
退出码：0

npm run se:check-journeys
退出码：0

npm run se:check-binding
退出码：0
```
