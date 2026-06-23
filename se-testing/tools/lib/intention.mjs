// 意图层与执行层的共享读取/解析逻辑。validate-intention 与 check-binding 都复用这里，
// 保证「意图 schema」是单一来源，不在多个脚本里各写一份。
import fs from "node:fs";
import path from "node:path";
import { parseYaml } from "./yaml.mjs";

export const VALID_STATUS = ["draft", "reviewed", "active", "needs_update"];
export const INTENTIONS_DIR = "intentions";
export const SPECS_DIR = "specs";
export const FIXTURES_DIR = path.join("support", "fixtures");
export const JOURNEYS_DIR = path.join(INTENTIONS_DIR, "journeys");

export function readUtf8(abs) {
  const text = fs.readFileSync(abs, "utf8");
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

// 列出目录下的文件（非递归 / 递归），返回绝对路径。目录不存在时返回 []。
export function listFiles(dir, { recursive = false, ext } = {}) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (recursive) out.push(...listFiles(full, { recursive, ext }));
    } else if (!ext || entry.name.endsWith(ext)) {
      out.push(full);
    }
  }
  return out.sort();
}

export function pathExists(projectDir, rel) {
  return fs.existsSync(path.join(projectDir, rel));
}

export function assetRoot(projectDir) {
  if (pathExists(projectDir, INTENTIONS_DIR)) return projectDir;
  const testsDir = path.join(projectDir, "tests");
  if (fs.existsSync(path.join(testsDir, INTENTIONS_DIR))) return testsDir;
  return projectDir;
}

export function kebabCase(value) {
  return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function relFile(baseDir, abs) {
  return path.relative(baseDir, abs).split(path.sep).join("/");
}

// 读取并解析所有意图文件。每项：{ file, abs, data, parseError }。
export function loadIntentions(projectDir) {
  const root = assetRoot(projectDir);
  const dir = path.join(root, INTENTIONS_DIR);
  const journeysDir = path.join(root, JOURNEYS_DIR);
  return listFiles(dir, { recursive: true, ext: ".yaml" })
    .filter((abs) => !abs.startsWith(journeysDir + path.sep))
    .map((abs) => {
      const file = relFile(dir, abs);
      try {
        const data = parseYaml(readUtf8(abs));
        return { file, abs, data, parseError: null };
      } catch (err) {
        return { file, abs, data: null, parseError: err.message };
      }
    });
}

// 读取并解析所有 journey 文件。每项：{ file, abs, data, parseError }。
export function loadJourneys(projectDir) {
  const root = assetRoot(projectDir);
  const dir = path.join(root, JOURNEYS_DIR);
  return listFiles(dir, { ext: ".yaml" }).map((abs) => {
    const file = path.basename(abs);
    try {
      const data = parseYaml(readUtf8(abs));
      return { file, abs, data, parseError: null };
    } catch (err) {
      return { file, abs, data: null, parseError: err.message };
    }
  });
}

// 解析 spec 头部约定：首个非空行形如 `// intention: <file>.yaml (v<N>)`。
export function parseSpecHeader(text) {
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    const m = line.match(/^\s*\/\/\s*intention:\s*(\S+\.yaml)\s*\(v(\d+)\)\s*$/);
    return m ? { intentionFile: m[1], version: Number(m[2]) } : null;
  }
  return null;
}

// 读取所有 spec。每项：{ file, abs, text, header }。
export function loadSpecs(projectDir) {
  const root = assetRoot(projectDir);
  const dir = path.join(root, SPECS_DIR);
  return listFiles(dir, { recursive: true, ext: ".spec.ts" }).map((abs) => {
    const text = readUtf8(abs);
    return {
      file: path.relative(dir, abs).split(path.sep).join("/"),
      abs,
      text,
      header: parseSpecHeader(text),
    };
  });
}

// 提取文本中的 {{ a.b.c }} 占位符，返回去重后的内部表达式列表。
export function extractPlaceholders(text) {
  const out = new Set();
  const re = /\{\{\s*([^}]+?)\s*\}\}/g;
  let m;
  while ((m = re.exec(text)) !== null) out.add(m[1].trim());
  return [...out];
}

// 校验占位符 `users.validUser.name`：首段 → support/fixtures/users.json，其余为 JSON 路径。
// 返回 { ok, reason } —— reason 仅在失败时给出。
export function resolveFixturePlaceholder(projectDir, expr) {
  const root = assetRoot(projectDir);
  const parts = expr.split(".");
  if (parts.length < 2) {
    return { ok: false, reason: `占位符至少需 file.key 两段: {{${expr}}}` };
  }
  const [fileKey, ...keyPath] = parts;
  const fixturePath = path.join(root, FIXTURES_DIR, `${fileKey}.json`);
  if (!fs.existsSync(fixturePath)) {
    return { ok: false, reason: `fixture 文件不存在: ${FIXTURES_DIR}/${fileKey}.json` };
  }
  let data;
  try {
    data = JSON.parse(readUtf8(fixturePath));
  } catch (err) {
    return { ok: false, reason: `fixture 不是合法 JSON: ${fileKey}.json (${err.message})` };
  }
  let cur = data;
  for (const key of keyPath) {
    if (cur === null || typeof cur !== "object" || !(key in cur)) {
      return { ok: false, reason: `fixture 内路径不存在: ${fileKey}.json -> ${keyPath.join(".")}` };
    }
    cur = cur[key];
  }
  return { ok: true };
}

export function fixturePath(projectDir, fixtureFile) {
  return path.join(assetRoot(projectDir), FIXTURES_DIR, fixtureFile);
}
