import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCheckIntentions } from "./check-intentions.mjs";

function makeProject({ testsRoot = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "se-check-intentions-"));
  const assetRoot = testsRoot ? path.join(root, "tests") : root;
  fs.mkdirSync(path.join(assetRoot, "intentions"), { recursive: true });
  return { root, assetRoot };
}

function writeIntention(assetRoot, file, body = VALID_INTENTION) {
  const abs = path.join(assetRoot, "intentions", file);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body, "utf8");
}

const VALID_INTENTION = `id: login-success
version: 1
priority: P0
status: active
title: 用户用正确凭证登录成功
business_context: |
  注册用户用有效凭证登录应进入仪表盘，是发布前必过路径。
precondition: 已存在可登录用户。
fixtures:
  - users.json
assertions:
  - id: redirect-dashboard
    description: 提交后跳转到 /dashboard
edge_cases:
  - id: invalid-password
    description: 密码错误时登录被拒绝，并返回认证失败错误
tags: [auth, login]
`;

test("严格意图 schema 通过", () => {
  const { root, assetRoot } = makeProject();
  writeIntention(assetRoot, "login-success.yaml");
  const r = runCheckIntentions(root);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.scanned, 1);
});

test("支持 tests/intentions 资产根", () => {
  const { root, assetRoot } = makeProject({ testsRoot: true });
  writeIntention(assetRoot, "login-success.yaml");
  const r = runCheckIntentions(root);
  assert.equal(r.ok, true, JSON.stringify(r));
});

test("支持业务域子目录并按文件名校验 id", () => {
  const { root, assetRoot } = makeProject();
  writeIntention(assetRoot, path.join("auth", "login-success.yaml"));
  const r = runCheckIntentions(root);
  assert.equal(r.ok, true, JSON.stringify(r));
});

test("缺少新必填字段会报错", () => {
  const { root, assetRoot } = makeProject();
  writeIntention(assetRoot, "login-success.yaml", VALID_INTENTION.replace("priority: P0\n", ""));
  const r = runCheckIntentions(root);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /缺少必填字段: priority/.test(e.msg)));
});

test("id 和 assertion id 必须是 kebab-case", () => {
  const { root, assetRoot } = makeProject();
  writeIntention(
    assetRoot,
    "login-success.yaml",
    VALID_INTENTION.replace("id: login-success", "id: LoginSuccess").replace("id: redirect-dashboard", "id: redirect_dashboard")
  );
  const r = runCheckIntentions(root);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /id 必须是 kebab-case/.test(e.msg)));
  assert.ok(r.errors.some((e) => /assertions\[0\]\.id 必须是 kebab-case/.test(e.msg)));
});

test("空泛 description 产生 warning 但不阻断", () => {
  const { root, assetRoot } = makeProject();
  writeIntention(assetRoot, "login-success.yaml", VALID_INTENTION.replace("提交后跳转到 /dashboard", "功能正常"));
  const r = runCheckIntentions(root);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.ok(r.warnings.some((w) => /表述过于空泛/.test(w.msg)));
});
