#!/usr/bin/env node
// check-binding.mjs —— 意图层↔执行层绑定检查（信任锚点之一，零 agent 依赖）。
//
// 核心检查：
//   1. version 漂移：每个 spec 头 `// intention: x.yaml (vN)` 的 N 必须等于意图 yaml 的 version；
//      —— 直接消灭原 se.testing 最大技术债。
//   2. active 意图缺 spec：每条 status:active 的意图，必须至少有一个 spec 头引用它。
//   3. assertion 覆盖：active 意图里的每条 assertion 都必须在对应 spec 中用 `// assertion: <id>` 标出。
//   4. skip 扫描：spec 代码里出现 .skip / .only / fixme 即记下（绿色测试不该藏 skip）。
//
// 只报告、不阻断：输出结构化 JSON；任一类问题非空时以退出码 1 结束。

import { INTENTIONS_DIR, SPECS_DIR, loadIntentions, loadSpecs, pathExists } from "./lib/intention.mjs";

const SKIP_PATTERNS = [
  { name: "skip", re: /\.skip\b/ },
  { name: "only", re: /\.only\b/ },
  { name: "fixme", re: /\bfixme\b/i },
];

const ASSERTION_MARK_RE = /^\s*\/\/\s*assertion:\s*([A-Za-z0-9][A-Za-z0-9_.:-]*)\s*$/;

function stripCommentsAndStringsForSkipScan(text) {
  let out = "";
  let i = 0;
  let state = "code";
  let quote = "";
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1] ?? "";

    if (state === "lineComment") {
      if (ch === "\n" || ch === "\r") {
        state = "code";
        out += ch;
      } else {
        out += " ";
      }
      i++;
      continue;
    }
    if (state === "blockComment") {
      if (ch === "*" && next === "/") {
        out += "  ";
        i += 2;
        state = "code";
      } else {
        out += ch === "\n" || ch === "\r" ? ch : " ";
        i++;
      }
      continue;
    }
    if (state === "string") {
      if (ch === "\\") {
        out += " ";
        if (i + 1 < text.length) out += text[i + 1] === "\n" || text[i + 1] === "\r" ? text[i + 1] : " ";
        i += 2;
        continue;
      }
      if (ch === quote) {
        state = "code";
        out += " ";
      } else {
        out += ch === "\n" || ch === "\r" ? ch : " ";
      }
      i++;
      continue;
    }

    if (ch === "/" && next === "/") {
      out += "  ";
      i += 2;
      state = "lineComment";
      continue;
    }
    if (ch === "/" && next === "*") {
      out += "  ";
      i += 2;
      state = "blockComment";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      state = "string";
    }
    out += ch;
    i++;
  }
  return out;
}

function assertionIds(intent) {
  if (!Array.isArray(intent.assertions)) return [];
  return intent.assertions
    .map((a) => (a && typeof a === "object" ? a.id : null))
    .filter((id) => typeof id === "string" && id.length > 0);
}

function markedAssertionIds(specText) {
  const ids = new Set();
  for (const line of specText.split(/\r?\n/)) {
    const m = line.match(ASSERTION_MARK_RE);
    if (m) ids.add(m[1]);
  }
  return ids;
}

export function runCheckBinding(projectDir) {
  const intentions = loadIntentions(projectDir);
  const specs = loadSpecs(projectDir);

  const byFile = new Map(); // file -> intention data
  for (const it of intentions) {
    if (it.data) byFile.set(it.file, it.data);
  }

  const driftErrors = [];
  const missingHeader = [];
  const projectErrors = [];
  const referencedActive = new Set();
  const specsByIntention = new Map();

  if (!pathExists(projectDir, INTENTIONS_DIR)) {
    projectErrors.push({ file: INTENTIONS_DIR, msg: `缺少目录: ${INTENTIONS_DIR}` });
  } else if (intentions.length === 0) {
    projectErrors.push({ file: INTENTIONS_DIR, msg: "未找到任何意图文件: intentions/*.yaml" });
  }
  if (!pathExists(projectDir, SPECS_DIR)) {
    projectErrors.push({ file: SPECS_DIR, msg: `缺少目录: ${SPECS_DIR}` });
  }
  for (const it of intentions) {
    if (it.parseError) {
      projectErrors.push({ file: it.file, msg: `YAML 解析失败: ${it.parseError}` });
    }
  }

  for (const spec of specs) {
    if (!spec.header) {
      missingHeader.push({ spec: spec.file, msg: "缺少 `// intention: x.yaml (vN)` 头部" });
      continue;
    }
    const { intentionFile, version } = spec.header;
    const intent = byFile.get(intentionFile);
    if (!intent) {
      driftErrors.push({
        spec: spec.file,
        msg: `引用的意图不存在: ${intentionFile}`,
      });
      continue;
    }
    if (intent.version !== version) {
      driftErrors.push({
        spec: spec.file,
        msg: `version 漂移: spec 标注 v${version}, 意图 ${intentionFile} 实为 v${intent.version}`,
      });
    }
    if (!specsByIntention.has(intentionFile)) specsByIntention.set(intentionFile, []);
    specsByIntention.get(intentionFile).push(spec);
    referencedActive.add(intentionFile);
  }

  const missingSpec = [];
  const assertionCoverage = [];
  for (const it of intentions) {
    if (it.data && it.data.status === "active" && !referencedActive.has(it.file)) {
      missingSpec.push({ intention: it.file, msg: "active 意图缺少对应 spec" });
    }
    if (it.data && it.data.status === "active") {
      const expected = assertionIds(it.data);
      const marked = new Set();
      for (const spec of specsByIntention.get(it.file) ?? []) {
        for (const id of markedAssertionIds(spec.text)) marked.add(id);
      }
      const missingAssertions = expected.filter((id) => !marked.has(id));
      const unknownAssertions = [...marked].filter((id) => !expected.includes(id));
      if (missingAssertions.length > 0 || unknownAssertions.length > 0) {
        assertionCoverage.push({
          intention: it.file,
          missingAssertions,
          unknownAssertions,
          msg: "assertion 标记与意图不一致",
        });
      }
    }
  }

  const skipFindings = [];
  for (const spec of specs) {
    stripCommentsAndStringsForSkipScan(spec.text).split(/\r?\n/).forEach((line, idx) => {
      for (const { name, re } of SKIP_PATTERNS) {
        if (re.test(line)) {
          skipFindings.push({ spec: spec.file, line: idx + 1, kind: name, text: line.trim() });
        }
      }
    });
  }

  const ok =
    projectErrors.length === 0 &&
    driftErrors.length === 0 &&
    missingHeader.length === 0 &&
    missingSpec.length === 0 &&
    assertionCoverage.length === 0 &&
    skipFindings.length === 0;

  return {
    ok,
    scannedIntentions: intentions.length,
    scannedSpecs: specs.length,
    projectErrors,
    driftErrors,
    missingHeader,
    missingSpec,
    assertionCoverage,
    skipFindings,
  };
}

function main() {
  const projectDir = process.argv[2] || ".";
  const result = runCheckBinding(projectDir);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(result.ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("check-binding.mjs")) {
  main();
}
