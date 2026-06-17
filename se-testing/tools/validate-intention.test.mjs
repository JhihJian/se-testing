import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runValidate } from "./validate-intention.mjs";

// 在临时目录里搭一个最小项目骨架，避免依赖仓库内的 template。
function makeProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "se-validate-"));
  fs.mkdirSync(path.join(root, "intentions"), { recursive: true });
  fs.mkdirSync(path.join(root, "support", "fixtures"), { recursive: true });
  return root;
}
function writeIntention(root, file, body) {
  fs.writeFileSync(path.join(root, "intentions", file), body);
}
function writeFixture(root, file, obj) {
  fs.writeFileSync(path.join(root, "support", "fixtures", file), JSON.stringify(obj, null, 2));
}
function writeUtf8Bom(root, rel, text) {
  fs.writeFileSync(path.join(root, rel), "\ufeff" + text, "utf8");
}

const VALID = `id: login-success
version: 1
status: active
title: 用户用正确凭证登录成功
business_context: |
  注册用户用有效凭证登录应进入仪表盘。
fixtures:
  - users.json
assertions:
  - id: redirect-dashboard
    description: 登录后跳转到 /dashboard
  - id: greet-user
    description: 顶栏显示欢迎语, 含 {{users.validUser.name}}
`;

test("合法意图集通过校验", () => {
  const root = makeProject();
  writeFixture(root, "users.json", { validUser: { name: "Alice" } });
  writeIntention(root, "login-success.yaml", VALID);
  const r = runValidate(root);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.errors.length, 0);
});

test("缺 intentions 目录时报错，避免空扫假阳性", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "se-validate-empty-"));
  const r = runValidate(root);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /缺少目录: intentions/.test(e.msg)));
});

test("intentions 目录为空时报错，避免空扫假阳性", () => {
  const root = makeProject();
  const r = runValidate(root);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /未找到任何意图文件/.test(e.msg)));
});

test("UTF-8 BOM 的意图与 fixture 可正常解析", () => {
  const root = makeProject();
  writeUtf8Bom(root, path.join("support", "fixtures", "users.json"), JSON.stringify({ validUser: { name: "Alice" } }));
  writeUtf8Bom(root, path.join("intentions", "login-success.yaml"), VALID);
  const r = runValidate(root);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
});

test("标准 YAML 流式列表可正常解析", () => {
  const root = makeProject();
  writeFixture(root, "users.json", { validUser: { name: "Alice" } });
  writeIntention(root, "login-success.yaml", VALID.replace("fixtures:\n  - users.json", "fixtures: [users.json]"));
  const r = runValidate(root);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
});

test("缺必填字段与非法 status 被报错", () => {
  const root = makeProject();
  writeIntention(root, "broken.yaml", `id: broken\nversion: 1\nstatus: bogus\n`);
  const r = runValidate(root);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /status 非法/.test(e.msg)));
  assert.ok(r.errors.some((e) => /缺少必填字段: title/.test(e.msg)));
  assert.ok(r.errors.some((e) => /缺少必填字段: assertions/.test(e.msg)));
});

test("id 与文件名不一致被报错", () => {
  const root = makeProject();
  writeFixture(root, "users.json", { validUser: { name: "Alice" } });
  writeIntention(root, "login-success.yaml", VALID.replace("id: login-success", "id: wrong-id"));
  const r = runValidate(root);
  assert.ok(r.errors.some((e) => /id .* 必须与文件名一致/.test(e.msg)));
});

test("assertion id 重复时报错", () => {
  const root = makeProject();
  writeFixture(root, "users.json", { validUser: { name: "Alice" } });
  writeIntention(root, "login-success.yaml", VALID.replace("id: greet-user", "id: redirect-dashboard"));
  const r = runValidate(root);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /id 重复: redirect-dashboard/.test(e.msg)));
});

test("占位符指向不存在的 fixture 文件被报错", () => {
  const root = makeProject();
  // 不写 users.json
  writeIntention(root, "login-success.yaml", VALID);
  const r = runValidate(root);
  assert.ok(r.errors.some((e) => /fixture 文件不存在/.test(e.msg)));
});

test("fixtures 声明的文件不存在时报错", () => {
  const root = makeProject();
  const body = VALID.replace("{{users.validUser.name}}", "用户名").replace("fixtures:\n  - users.json", "fixtures:\n  - missing.json");
  writeIntention(root, "login-success.yaml", body);
  const r = runValidate(root);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /fixtures\[0\] 文件不存在/.test(e.msg)));
});

test("fixtures 只能声明 JSON 文件", () => {
  const root = makeProject();
  const body = VALID.replace("{{users.validUser.name}}", "用户名").replace("fixtures:\n  - users.json", "fixtures:\n  - users.yml");
  writeIntention(root, "login-success.yaml", body);
  const r = runValidate(root);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /必须引用 \.json 文件/.test(e.msg)));
});

test("占位符使用未声明 fixture 时被报错", () => {
  const root = makeProject();
  writeFixture(root, "users.json", { validUser: { name: "Alice" } });
  writeIntention(root, "login-success.yaml", VALID.replace("fixtures:\n  - users.json", "fixtures: []"));
  const r = runValidate(root);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /未在 fixtures 声明/.test(e.msg)));
});

test("使用占位符但缺 fixtures 声明时报错", () => {
  const root = makeProject();
  writeFixture(root, "users.json", { validUser: { name: "Alice" } });
  writeIntention(root, "login-success.yaml", VALID.replace("fixtures:\n  - users.json\n", ""));
  const r = runValidate(root);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /必须声明 fixtures 列表/.test(e.msg)));
});

test("占位符 JSON 路径不存在被报错", () => {
  const root = makeProject();
  writeFixture(root, "users.json", { validUser: {} }); // 缺 name
  writeIntention(root, "login-success.yaml", VALID);
  const r = runValidate(root);
  assert.ok(r.errors.some((e) => /fixture 内路径不存在/.test(e.msg)));
});

test("assertion 含硬编码 email 产生 warning 但不阻断", () => {
  const root = makeProject();
  writeFixture(root, "users.json", { validUser: { name: "Alice" } });
  const body = VALID.replace(
    "含 {{users.validUser.name}}",
    "含 admin@example.com"
  );
  writeIntention(root, "login-success.yaml", body);
  const r = runValidate(root);
  assert.equal(r.ok, true);
  assert.ok(r.warnings.some((w) => /硬编码email/.test(w.msg)));
});

test("version 非正整数被报错", () => {
  const root = makeProject();
  writeFixture(root, "users.json", { validUser: { name: "Alice" } });
  writeIntention(root, "login-success.yaml", VALID.replace("version: 1", "version: 0"));
  const r = runValidate(root);
  assert.ok(r.errors.some((e) => /version 必须是正整数/.test(e.msg)));
});
