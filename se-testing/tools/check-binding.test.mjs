import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCheckBinding } from "./check-binding.mjs";

function makeProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "se-binding-"));
  fs.mkdirSync(path.join(root, "intentions"), { recursive: true });
  fs.mkdirSync(path.join(root, "specs"), { recursive: true });
  return root;
}
function writeIntention(root, file, { version = 1, status = "active" } = {}) {
  fs.writeFileSync(
    path.join(root, "intentions", file),
    `id: ${file.replace(/\.yaml$/, "")}\nversion: ${version}\nstatus: ${status}\ntitle: t\nbusiness_context: |\n  c\nassertions:\n  - id: a\n    description: d\n`
  );
}
function writeSpec(root, file, body) {
  fs.writeFileSync(path.join(root, "specs", file), body);
}

const SPEC_OK = `// intention: login-success.yaml (v1)
import { test, expect } from "@playwright/test";
test("login", async ({ page }) => {
  // assertion: a
  await expect(page).toHaveURL(/dashboard/);
});
`;

test("version 对齐时通过", () => {
  const root = makeProject();
  writeIntention(root, "login-success.yaml", { version: 1 });
  writeSpec(root, "login-success.spec.ts", SPEC_OK);
  const r = runCheckBinding(root);
  assert.equal(r.ok, true, JSON.stringify(r));
});

test("缺 intentions/specs 目录时报错，避免空扫假阳性", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "se-binding-empty-"));
  const r = runCheckBinding(root);
  assert.equal(r.ok, false);
  assert.ok(r.projectErrors.some((e) => /缺少目录: intentions/.test(e.msg)));
  assert.ok(r.projectErrors.some((e) => /缺少目录: specs/.test(e.msg)));
});

test("intentions 目录为空时报错", () => {
  const root = makeProject();
  const r = runCheckBinding(root);
  assert.equal(r.ok, false);
  assert.ok(r.projectErrors.some((e) => /未找到任何意图文件/.test(e.msg)));
});

test("version 漂移被抓出", () => {
  const root = makeProject();
  writeIntention(root, "login-success.yaml", { version: 2 });
  writeSpec(root, "login-success.spec.ts", SPEC_OK); // 标注 v1
  const r = runCheckBinding(root);
  assert.equal(r.ok, false);
  assert.ok(r.driftErrors.some((e) => /version 漂移/.test(e.msg)));
});

test("引用不存在的意图被报错", () => {
  const root = makeProject();
  writeSpec(root, "login-success.spec.ts", SPEC_OK);
  const r = runCheckBinding(root);
  assert.ok(r.driftErrors.some((e) => /意图不存在/.test(e.msg)));
});

test("active 意图缺 spec 被报错", () => {
  const root = makeProject();
  writeIntention(root, "login-success.yaml", { version: 1, status: "active" });
  // 不写 spec
  const r = runCheckBinding(root);
  assert.ok(r.missingSpec.some((e) => /缺少对应 spec/.test(e.msg)));
});

test("draft 意图缺 spec 不报错", () => {
  const root = makeProject();
  writeIntention(root, "draft-feature.yaml", { version: 1, status: "draft" });
  const r = runCheckBinding(root);
  assert.equal(r.missingSpec.length, 0);
});

test("spec 内 skip/.only/fixme 被扫出", () => {
  const root = makeProject();
  writeIntention(root, "login-success.yaml", { version: 1 });
  writeSpec(
    root,
    "login-success.spec.ts",
    SPEC_OK.replace('test("login"', 'test.skip("login"') + "\ntest.fixme('flaky', () => {});\ntest.only('x', () => {});\n"
  );
  const r = runCheckBinding(root);
  assert.equal(r.ok, false);
  const kinds = new Set(r.skipFindings.map((f) => f.kind));
  assert.ok(kinds.has("skip"));
  assert.ok(kinds.has("only"));
  assert.ok(kinds.has("fixme"));
});

test("注释里的 skip/.only/fixme 不误报", () => {
  const root = makeProject();
  writeIntention(root, "login-success.yaml", { version: 1 });
  writeSpec(
    root,
    "login-success.spec.ts",
    SPEC_OK + "\n// test.skip('doc only', () => {});\n/* test.only('doc only', () => {}); fixme */\n"
  );
  const r = runCheckBinding(root);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.skipFindings.length, 0);
});

test("字符串里的 skip/.only/fixme 不误报", () => {
  const root = makeProject();
  writeIntention(root, "login-success.yaml", { version: 1 });
  writeSpec(
    root,
    "login-success.spec.ts",
    SPEC_OK + "\nconst note = \"test.skip and fixme are plain text\";\n"
  );
  const r = runCheckBinding(root);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.skipFindings.length, 0);
});

test("active 意图缺 assertion 标记被报错", () => {
  const root = makeProject();
  writeIntention(root, "login-success.yaml", { version: 1 });
  writeSpec(
    root,
    "login-success.spec.ts",
    SPEC_OK.replace("  // assertion: a\n", "")
  );
  const r = runCheckBinding(root);
  assert.equal(r.ok, false);
  assert.ok(r.assertionCoverage.some((e) => e.missingAssertions.includes("a")));
});

test("spec 标记未知 assertion 被报错", () => {
  const root = makeProject();
  writeIntention(root, "login-success.yaml", { version: 1 });
  writeSpec(
    root,
    "login-success.spec.ts",
    SPEC_OK.replace("  // assertion: a", "  // assertion: unknown")
  );
  const r = runCheckBinding(root);
  assert.equal(r.ok, false);
  assert.ok(r.assertionCoverage.some((e) => e.unknownAssertions.includes("unknown")));
  assert.ok(r.assertionCoverage.some((e) => e.missingAssertions.includes("a")));
});

test("缺 spec 头部被报错", () => {
  const root = makeProject();
  writeIntention(root, "login-success.yaml", { version: 1 });
  writeSpec(root, "login-success.spec.ts", `import { test } from "@playwright/test";\n`);
  const r = runCheckBinding(root);
  assert.ok(r.missingHeader.some((e) => /缺少/.test(e.msg)));
});
