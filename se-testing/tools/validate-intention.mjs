#!/usr/bin/env node
// validate-intention.mjs —— 意图层自检脚本（信任锚点之一，零 agent 依赖）。
//
// 检查项：
//   1. YAML 可解析；
//   2. schema：必填字段齐全（id/version/status/title/business_context/assertions）；
//   3. status 取值合法、version 为正整数、id 与文件名一致、assertions 非空且各带 id/description；
//   4. {{file.key}} 占位符指向真实存在的 fixture 文件与可解析的 JSON 路径；
//   5. 硬编码启发式：assertion 文本里出现 email / 长数字串 / 手机号等可疑字面量 → warning。
//
// 只报告、不阻断：输出结构化 JSON 到 stdout；errors 非空时以退出码 1 结束。

import {
  VALID_STATUS,
  INTENTIONS_DIR,
  assetRoot,
  loadIntentions,
  extractPlaceholders,
  fixturePath,
  pathExists,
  resolveFixturePlaceholder,
} from "./lib/intention.mjs";
import fs from "node:fs";

const REQUIRED_FIELDS = ["id", "version", "status", "title", "business_context", "assertions"];

// 可疑硬编码字面量（启发式，宁可多报）。
const HARDCODE_PATTERNS = [
  { name: "email", re: /[\w.+-]+@[\w-]+\.[\w.-]+/ },
  { name: "手机号", re: /\b1[3-9]\d{9}\b/ },
  { name: "长数字串", re: /\b\d{6,}\b/ },
];

function validateIntention(projectDir, item, errors, warnings) {
  const where = item.file;
  if (item.parseError) {
    errors.push({ file: where, msg: `YAML 解析失败: ${item.parseError}` });
    return;
  }
  const d = item.data || {};

  for (const field of REQUIRED_FIELDS) {
    if (d[field] === undefined || d[field] === null || d[field] === "") {
      errors.push({ file: where, msg: `缺少必填字段: ${field}` });
    }
  }

  if (d.status !== undefined && !VALID_STATUS.includes(d.status)) {
    errors.push({ file: where, msg: `status 非法: ${d.status}（合法值: ${VALID_STATUS.join("/")}）` });
  }
  if (d.version !== undefined && !(Number.isInteger(d.version) && d.version > 0)) {
    errors.push({ file: where, msg: `version 必须是正整数, 实际: ${d.version}` });
  }
  const expectedId = where.split("/").pop().replace(/\.yaml$/, "");
  if (d.id !== undefined && d.id !== expectedId) {
    errors.push({ file: where, msg: `id (${d.id}) 必须与文件名一致 (${expectedId})` });
  }

  if (d.assertions !== undefined) {
    if (!Array.isArray(d.assertions) || d.assertions.length === 0) {
      errors.push({ file: where, msg: "assertions 必须是非空列表" });
    } else {
      const seenAssertionIds = new Set();
      d.assertions.forEach((a, idx) => {
        if (!a || typeof a !== "object" || !a.id || !a.description) {
          errors.push({ file: where, msg: `assertions[${idx}] 必须含 id 与 description` });
          return;
        }
        if (seenAssertionIds.has(a.id)) {
          errors.push({ file: where, msg: `assertions[${idx}] id 重复: ${a.id}` });
        }
        seenAssertionIds.add(a.id);
      });
    }
  }

  const declaredFixtures = new Set();
  if (d.fixtures !== undefined) {
    if (!Array.isArray(d.fixtures)) {
      errors.push({ file: where, msg: "fixtures 必须是字符串列表" });
    } else {
      d.fixtures.forEach((fixture, idx) => {
        if (typeof fixture !== "string" || fixture.length === 0) {
          errors.push({ file: where, msg: `fixtures[${idx}] 必须是非空字符串` });
          return;
        }
        declaredFixtures.add(fixture);
        if (!fixture.endsWith(".json")) {
          errors.push({ file: where, msg: `fixtures[${idx}] 必须引用 .json 文件: ${fixture}` });
          return;
        }
        if (!fs.existsSync(fixturePath(projectDir, fixture))) {
          errors.push({ file: where, msg: `fixtures[${idx}] 文件不存在: support/fixtures/${fixture}` });
        }
      });
    }
  }

  // 占位符与硬编码扫描（基于整份文件文本，覆盖所有 assertion）。
  const text = JSON.stringify(d);
  const placeholders = extractPlaceholders(text);
  if (placeholders.length > 0 && d.fixtures === undefined) {
    errors.push({ file: where, msg: "使用占位符时必须声明 fixtures 列表" });
  }
  for (const expr of placeholders) {
    const res = resolveFixturePlaceholder(projectDir, expr);
    if (!res.ok) errors.push({ file: where, msg: `占位符无效 {{${expr}}}: ${res.reason}` });
    const fileKey = expr.split(".")[0];
    const fixtureFile = `${fileKey}.json`;
    if (d.fixtures !== undefined && Array.isArray(d.fixtures) && !declaredFixtures.has(fixtureFile)) {
      errors.push({ file: where, msg: `占位符 {{${expr}}} 使用了未在 fixtures 声明的文件: ${fixtureFile}` });
    }
  }

  if (Array.isArray(d.assertions)) {
    for (const a of d.assertions) {
      const desc = a && typeof a === "object" ? String(a.description ?? "") : "";
      const withoutPlaceholders = desc.replace(/\{\{[^}]*\}\}/g, "");
      for (const { name, re } of HARDCODE_PATTERNS) {
        if (re.test(withoutPlaceholders)) {
          warnings.push({
            file: where,
            msg: `assertion "${a.id}" 疑似硬编码${name}，应改用 {{fixture}} 占位符`,
          });
        }
      }
    }
  }
}

export function runValidate(projectDir) {
  const errors = [];
  const warnings = [];
  const root = assetRoot(projectDir);
  if (!pathExists(root, INTENTIONS_DIR)) {
    return {
      ok: false,
      scanned: 0,
      errors: [{ file: INTENTIONS_DIR, msg: `缺少目录: ${INTENTIONS_DIR}` }],
      warnings,
    };
  }
  const intentions = loadIntentions(projectDir);
  if (intentions.length === 0) {
    errors.push({ file: INTENTIONS_DIR, msg: "未找到任何意图文件: intentions/*.yaml" });
  }
  for (const item of intentions) validateIntention(projectDir, item, errors, warnings);
  return { ok: errors.length === 0, scanned: intentions.length, errors, warnings };
}

function main() {
  const projectDir = process.argv[2] || ".";
  const result = runValidate(projectDir);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(result.ok ? 0 : 1);
}

// 仅在被直接执行（而非 import）时运行 main。
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("validate-intention.mjs")) {
  main();
}
