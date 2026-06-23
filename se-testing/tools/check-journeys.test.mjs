import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCheckJourneys } from "./check-journeys.mjs";

function makeProject({ testsRoot = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "se-check-journeys-"));
  const assetRoot = testsRoot ? path.join(root, "tests") : root;
  fs.mkdirSync(path.join(assetRoot, "intentions", "journeys"), { recursive: true });
  fs.mkdirSync(path.join(assetRoot, "specs"), { recursive: true });
  return { root, assetRoot };
}

function writeFile(assetRoot, rel, body) {
  const abs = path.join(assetRoot, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body, "utf8");
}

function writeIntention(assetRoot, file = "auth-login-success.yaml") {
  writeFile(
    assetRoot,
    path.join("intentions", file),
    `id: ${path.basename(file).replace(/\.yaml$/, "")}
version: 1
priority: P0
status: active
title: 登录成功
business_context: |
  用户使用正确凭证登录后进入仪表盘。
precondition: 已存在可登录用户。
assertions:
  - id: redirect-dashboard
    description: 提交后跳转到 /dashboard
edge_cases: []
tags: [auth, login]
`
  );
}

const VALID_JOURNEY = `id: auth-login
version: 1
status: active
title: 登录路径
business_context: |
  用户从登录页提交凭证后，系统根据凭证和账号状态进入不同业务分支。
shared_precondition: 用户访问登录页。
tags: [auth, login]
branches:
  - id: success
    intent: auth-login-success
    condition: 凭证正确且账号可用
    result: 进入仪表盘
    priority: P0
edge_branches:
  - id: disabled-account
    condition: 账号已禁用
    expected_result: 登录被拒绝，并提示账号不可用
    reason: 当前需求未明确错误语义，等待产品确认
`;

test("合法 journey 通过校验", () => {
  const { root, assetRoot } = makeProject();
  writeIntention(assetRoot);
  writeFile(assetRoot, path.join("intentions", "journeys", "auth-login.yaml"), VALID_JOURNEY);
  const r = runCheckJourneys(root);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.scannedJourneys, 1);
});

test("支持 tests/intentions/journeys 资产根", () => {
  const { root, assetRoot } = makeProject({ testsRoot: true });
  writeIntention(assetRoot);
  writeFile(assetRoot, path.join("intentions", "journeys", "auth-login.yaml"), VALID_JOURNEY);
  const r = runCheckJourneys(root);
  assert.equal(r.ok, true, JSON.stringify(r));
});

test("branch 引用不存在的 intent 会报错", () => {
  const { root, assetRoot } = makeProject();
  writeFile(assetRoot, path.join("intentions", "journeys", "auth-login.yaml"), VALID_JOURNEY);
  const r = runCheckJourneys(root);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /引用不存在/.test(e.msg)));
});

test("spec 不允许直接绑定 journey", () => {
  const { root, assetRoot } = makeProject();
  writeIntention(assetRoot);
  writeFile(assetRoot, path.join("intentions", "journeys", "auth-login.yaml"), VALID_JOURNEY);
  writeFile(assetRoot, path.join("specs", "auth-login.spec.ts"), "// intention: auth-login.yaml (v1)\n");
  const r = runCheckJourneys(root);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /不应直接绑定 journey/.test(e.msg)));
});

test("spec 不允许用 journeys/ 前缀绑定 journey", () => {
  const { root, assetRoot } = makeProject();
  writeIntention(assetRoot);
  writeFile(assetRoot, path.join("intentions", "journeys", "auth-login.yaml"), VALID_JOURNEY);
  writeFile(assetRoot, path.join("specs", "auth-login.spec.ts"), "// intention: journeys/auth-login.yaml (v1)\n");
  const r = runCheckJourneys(root);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /不应直接绑定 journey/.test(e.msg)));
});

test("spec 不允许用 intentions/journeys/ 前缀绑定 journey", () => {
  const { root, assetRoot } = makeProject();
  writeIntention(assetRoot);
  writeFile(assetRoot, path.join("intentions", "journeys", "auth-login.yaml"), VALID_JOURNEY);
  writeFile(assetRoot, path.join("specs", "auth-login.spec.ts"), "// intention: intentions/journeys/auth-login.yaml (v1)\n");
  const r = runCheckJourneys(root);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /不应直接绑定 journey/.test(e.msg)));
});

test("空 edge_branches 给 warning 但不阻断", () => {
  const { root, assetRoot } = makeProject();
  writeIntention(assetRoot);
  writeFile(assetRoot, path.join("intentions", "journeys", "auth-login.yaml"), VALID_JOURNEY.replace(/edge_branches:[\s\S]*$/, "edge_branches: []\n"));
  const r = runCheckJourneys(root);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.ok(r.warnings.some((w) => /edge_branches 为空/.test(w.msg)));
});
