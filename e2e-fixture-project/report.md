# 测试执行报告

- 任务：虚构「星河协作台」登录业务项目，验证 se-testing 能否完成真实 e2e 行为验证与审计绑定检查
- 运行时间：2026-06-17T15:18:19.0649625+08:00
- 运行环境：`E2E_BASE_URL=http://127.0.0.1:4174`、Chromium、Windows

## 1. 意图 -> spec -> pass/fail 链

| 意图 (version) | spec | assertion | 结果 | 证据 |
|---|---|---|---|---|
| login-success (v1) | specs/login-success.spec.ts | redirect-dashboard | 通过 | `playwright-report/results.json`：用例 status 为 `passed` |
| login-success (v1) | specs/login-success.spec.ts | greet-user | 通过 | `playwright-report/results.json`：用例 status 为 `passed` |
| login-success (v1) | specs/login-success.spec.ts | session-persisted | 通过 | `playwright-report/results.json`：用例 status 为 `passed` |

Playwright 摘要：

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

```json
{
  "ok": true,
  "scanned": 1,
  "errors": [],
  "warnings": []
}
```

## 3. check-binding 输出

命令：`npm run se:check-binding`

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

## 4. Playwright 原始报告与 trace

- HTML 报告：`playwright-report/html/index.html`
- JSON 结果：`playwright-report/results.json`
- 失败用例 trace：本次无失败

## 5. 执行命令记录

```text
npm run test:e2e
结果：1 passed (2.3s)

npm run se:audit
结果：validate-intention ok:true；check-binding ok:true

在 se-testing 插件根执行 npm test
结果：29 项全通过
```
