#!/usr/bin/env node
// check-intentions.mjs —— 严格意图质量检查。
//
// validate-intention 负责基础可解析性、fixture 占位符和硬编码启发式；
// 本脚本负责更严格的业务意图 schema 与表达质量，供规范化、审查和交付前验收使用。

import { INTENTIONS_DIR, VALID_STATUS, assetRoot, kebabCase, loadIntentions, pathExists } from "./lib/intention.mjs";

const REQUIRED_FIELDS = [
  "id",
  "version",
  "priority",
  "status",
  "title",
  "business_context",
  "precondition",
  "assertions",
  "edge_cases",
  "tags",
];

const VALID_PRIORITY = ["P0", "P1", "P2"];
const VAGUE_PATTERNS = [
  /功能正常/,
  /返回正确结果/,
  /保持不变/,
  /校验成功/,
  /\bworks?\b/i,
  /\bok\b/i,
  /\bnormal\b/i,
];

function basenameId(file) {
  return file.split("/").pop().replace(/\.yaml$/, "");
}

function isBlank(value) {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

function validateTextField(where, field, value, errors) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push({ file: where, msg: `${field} 必须是非空字符串` });
  }
}

function validateIdList(where, field, list, { allowEmpty }, errors, warnings) {
  if (!Array.isArray(list)) {
    errors.push({ file: where, msg: `${field} 必须是列表` });
    return;
  }
  if (!allowEmpty && list.length === 0) {
    errors.push({ file: where, msg: `${field} 必须至少包含一项` });
  }
  const seen = new Set();
  list.forEach((item, idx) => {
    if (!item || typeof item !== "object") {
      errors.push({ file: where, msg: `${field}[${idx}] 必须是对象` });
      return;
    }
    if (!kebabCase(item.id)) {
      errors.push({ file: where, msg: `${field}[${idx}].id 必须是 kebab-case: ${item.id ?? ""}` });
    } else if (seen.has(item.id)) {
      errors.push({ file: where, msg: `${field}[${idx}].id 重复: ${item.id}` });
    }
    seen.add(item.id);
    validateTextField(where, `${field}[${idx}].description`, item.description, errors);
    const description = String(item.description ?? "");
    for (const re of VAGUE_PATTERNS) {
      if (re.test(description)) {
        warnings.push({ file: where, msg: `${field}[${idx}] 表述过于空泛: ${description}` });
        break;
      }
    }
  });
}

function validateTags(where, tags, errors) {
  if (!Array.isArray(tags) || tags.length === 0) {
    errors.push({ file: where, msg: "tags 必须是非空字符串列表" });
    return;
  }
  tags.forEach((tag, idx) => {
    if (typeof tag !== "string" || tag.trim() === "") {
      errors.push({ file: where, msg: `tags[${idx}] 必须是非空字符串` });
    }
  });
}

function validateIntention(item, errors, warnings) {
  const where = item.file;
  if (item.parseError) {
    errors.push({ file: where, msg: `YAML 解析失败: ${item.parseError}` });
    return;
  }

  const d = item.data || {};
  for (const field of REQUIRED_FIELDS) {
    if (isBlank(d[field])) {
      errors.push({ file: where, msg: `缺少必填字段: ${field}` });
    }
  }

  if (!kebabCase(d.id)) {
    errors.push({ file: where, msg: `id 必须是 kebab-case: ${d.id ?? ""}` });
  }
  const expectedId = basenameId(where);
  if (d.id !== undefined && d.id !== expectedId) {
    errors.push({ file: where, msg: `id (${d.id}) 必须与文件名一致 (${expectedId})` });
  }

  if (!(Number.isInteger(d.version) && d.version > 0)) {
    errors.push({ file: where, msg: `version 必须是正整数, 实际: ${d.version}` });
  }
  if (!VALID_STATUS.includes(d.status)) {
    errors.push({ file: where, msg: `status 非法: ${d.status}（合法值: ${VALID_STATUS.join("/")}）` });
  }
  if (!VALID_PRIORITY.includes(d.priority)) {
    errors.push({ file: where, msg: `priority 非法: ${d.priority}（合法值: ${VALID_PRIORITY.join("/")}）` });
  }

  validateTextField(where, "title", d.title, errors);
  validateTextField(where, "business_context", d.business_context, errors);
  validateTextField(where, "precondition", d.precondition, errors);
  validateIdList(where, "assertions", d.assertions, { allowEmpty: false }, errors, warnings);
  validateIdList(where, "edge_cases", d.edge_cases, { allowEmpty: true }, errors, warnings);
  validateTags(where, d.tags, errors);
}

export function runCheckIntentions(projectDir) {
  const root = assetRoot(projectDir);
  const errors = [];
  const warnings = [];

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
    errors.push({ file: INTENTIONS_DIR, msg: "未找到任何意图文件: intentions/**/*.yaml" });
  }
  for (const item of intentions) validateIntention(item, errors, warnings);

  return { ok: errors.length === 0, scanned: intentions.length, errors, warnings };
}

function main() {
  const projectDir = process.argv[2] || ".";
  const result = runCheckIntentions(projectDir);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(result.ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("check-intentions.mjs")) {
  main();
}
