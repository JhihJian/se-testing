#!/usr/bin/env node
// check-journeys.mjs —— journey 路径/分支索引检查。
//
// journey 是 intent 集合的上层索引：校验路径 schema、intent 引用和覆盖 warning，
// 并确保 spec 不直接绑定 journey。

import {
  INTENTIONS_DIR,
  JOURNEYS_DIR,
  VALID_STATUS,
  assetRoot,
  kebabCase,
  loadIntentions,
  loadJourneys,
  loadSpecs,
  pathExists,
} from "./lib/intention.mjs";

const REQUIRED_FIELDS = [
  "id",
  "version",
  "status",
  "title",
  "business_context",
  "shared_precondition",
  "tags",
  "branches",
  "edge_branches",
];
const VALID_PRIORITY = ["P0", "P1", "P2"];
const MATRIX_TAGS = ["coverage", "matrix", "contract", "cross-module"];

function isBlank(value) {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

function validateTextField(where, field, value, errors) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push({ file: where, msg: `${field} 必须是非空字符串` });
  }
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

function journeyIdFromFile(file) {
  return file.replace(/\.yaml$/, "");
}

function validateBranches(where, branches, intentIds, errors, warnings) {
  if (!Array.isArray(branches) || branches.length === 0) {
    errors.push({ file: where, msg: "branches 必须是非空列表" });
    return;
  }
  const seenBranchIds = new Set();
  const seenIntentIds = new Set();
  branches.forEach((branch, idx) => {
    if (!branch || typeof branch !== "object") {
      errors.push({ file: where, msg: `branches[${idx}] 必须是对象` });
      return;
    }
    if (!kebabCase(branch.id)) {
      errors.push({ file: where, msg: `branches[${idx}].id 必须是 kebab-case: ${branch.id ?? ""}` });
    } else if (seenBranchIds.has(branch.id)) {
      errors.push({ file: where, msg: `branches[${idx}].id 重复: ${branch.id}` });
    }
    seenBranchIds.add(branch.id);

    if (!kebabCase(branch.intent)) {
      errors.push({ file: where, msg: `branches[${idx}].intent 必须引用 intent id: ${branch.intent ?? ""}` });
    } else if (!intentIds.has(branch.intent)) {
      errors.push({ file: where, msg: `branches[${idx}].intent 引用不存在: ${branch.intent}` });
    } else if (seenIntentIds.has(branch.intent)) {
      warnings.push({ file: where, msg: `intent 被多个 branch 复用，请确认摘要足够清楚: ${branch.intent}` });
    }
    seenIntentIds.add(branch.intent);

    validateTextField(where, `branches[${idx}].condition`, branch.condition, errors);
    validateTextField(where, `branches[${idx}].result`, branch.result, errors);
    if (branch.priority !== undefined && !VALID_PRIORITY.includes(branch.priority)) {
      errors.push({ file: where, msg: `branches[${idx}].priority 非法: ${branch.priority}` });
    }
  });
}

function validateEdgeBranches(where, edgeBranches, errors, warnings) {
  if (!Array.isArray(edgeBranches)) {
    errors.push({ file: where, msg: "edge_branches 必须是列表，可为空" });
    return;
  }
  if (edgeBranches.length === 0) {
    warnings.push({ file: where, msg: "edge_branches 为空，请确认没有已知但未覆盖的分支" });
  }
  const seen = new Set();
  edgeBranches.forEach((branch, idx) => {
    if (!branch || typeof branch !== "object") {
      errors.push({ file: where, msg: `edge_branches[${idx}] 必须是对象` });
      return;
    }
    if (!kebabCase(branch.id)) {
      errors.push({ file: where, msg: `edge_branches[${idx}].id 必须是 kebab-case: ${branch.id ?? ""}` });
    } else if (seen.has(branch.id)) {
      errors.push({ file: where, msg: `edge_branches[${idx}].id 重复: ${branch.id}` });
    }
    seen.add(branch.id);
    validateTextField(where, `edge_branches[${idx}].condition`, branch.condition, errors);
    validateTextField(where, `edge_branches[${idx}].expected_result`, branch.expected_result, errors);
    validateTextField(where, `edge_branches[${idx}].reason`, branch.reason, errors);
  });
}

function validateJourney(item, intentIds, errors, warnings) {
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
  const expectedId = journeyIdFromFile(where);
  if (d.id !== undefined && d.id !== expectedId) {
    errors.push({ file: where, msg: `id (${d.id}) 必须与文件名一致 (${expectedId})` });
  }
  if (!(Number.isInteger(d.version) && d.version > 0)) {
    errors.push({ file: where, msg: `version 必须是正整数, 实际: ${d.version}` });
  }
  if (!VALID_STATUS.includes(d.status)) {
    errors.push({ file: where, msg: `status 非法: ${d.status}（合法值: ${VALID_STATUS.join("/")}）` });
  }

  validateTextField(where, "title", d.title, errors);
  validateTextField(where, "business_context", d.business_context, errors);
  validateTextField(where, "shared_precondition", d.shared_precondition, errors);
  validateTags(where, d.tags, errors);
  validateBranches(where, d.branches, intentIds, errors, warnings);
  validateEdgeBranches(where, d.edge_branches, errors, warnings);

  const tags = Array.isArray(d.tags) ? d.tags : [];
  if (Array.isArray(d.branches) && d.branches.length > 8 && !tags.some((tag) => MATRIX_TAGS.includes(tag))) {
    warnings.push({ file: where, msg: "branches 超过 8 个且未标记 coverage/matrix/contract/cross-module，请确认 journey 粒度没有过宽" });
  }
}

function directJourneyBindings(specs, journeyFiles) {
  const findings = [];
  for (const spec of specs) {
    const intentionFile = spec.header?.intentionFile;
    if (
      intentionFile &&
      (journeyFiles.has(intentionFile) ||
        [...journeyFiles].some((file) => intentionFile === `journeys/${file}` || intentionFile.endsWith(`/journeys/${file}`)))
    ) {
      findings.push({
        spec: spec.file,
        msg: `spec 不应直接绑定 journey: ${intentionFile}`,
      });
    }
  }
  return findings;
}

export function runCheckJourneys(projectDir) {
  const root = assetRoot(projectDir);
  const errors = [];
  const warnings = [];

  if (!pathExists(root, INTENTIONS_DIR)) {
    return {
      ok: false,
      scannedJourneys: 0,
      errors: [{ file: INTENTIONS_DIR, msg: `缺少目录: ${INTENTIONS_DIR}` }],
      warnings,
    };
  }

  const intentions = loadIntentions(projectDir);
  const intentIds = new Set(intentions.filter((it) => it.data && !it.parseError).map((it) => it.data.id));
  const journeys = loadJourneys(projectDir);
  const journeyFiles = new Set(journeys.map((journey) => journey.file));

  if (!pathExists(root, JOURNEYS_DIR)) {
    warnings.push({ file: JOURNEYS_DIR, msg: `未维护 journey 目录: ${JOURNEYS_DIR}` });
  }

  for (const journey of journeys) validateJourney(journey, intentIds, errors, warnings);
  const specJourneyBindings = directJourneyBindings(loadSpecs(projectDir), journeyFiles);
  errors.push(...specJourneyBindings);

  return {
    ok: errors.length === 0,
    scannedJourneys: journeys.length,
    errors,
    warnings,
  };
}

function main() {
  const projectDir = process.argv[2] || ".";
  const result = runCheckJourneys(projectDir);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(result.ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("check-journeys.mjs")) {
  main();
}
