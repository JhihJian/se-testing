#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = path.join(pluginRoot, "examples", "login-fixture");
const portStart = Number(process.env.E2E_PORT ?? 4174);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? fixtureDir,
    env: options.env ?? process.env,
    encoding: "utf8",
    shell: options.shell ?? false,
  });
  return {
    command: [command, ...args].join(" "),
    code: result.status ?? (result.error ? 1 : 0),
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error?.message ?? "",
  };
}

function runNpm(args, options = {}) {
  if (process.platform !== "win32") return run("npm", args, options);
  const command = ["npm", ...args].join(" ");
  return run(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", command], options);
}

function printStep(title, result) {
  process.stdout.write(`\n## ${title}\n`);
  process.stdout.write(`$ ${result.command}\n`);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) process.stderr.write(`${result.error}\n`);
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function findFreePort(start) {
  for (let port = start; port < start + 50; port += 1) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`未找到可用端口: ${start}-${start + 49}`);
}

function ensureFixtureDependencies() {
  if (fs.existsSync(path.join(fixtureDir, "node_modules", "@playwright", "test"))) return null;
  return runNpm(["install"], { cwd: fixtureDir });
}

function loadPlaywrightSummary() {
  const resultsPath = path.join(fixtureDir, "playwright-report", "results.json");
  if (!fs.existsSync(resultsPath)) return [];
  const data = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
  const found = [];
  function walkSuite(suite, parents = []) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        for (const result of test.results ?? []) {
          found.push({
            file: spec.file,
            title: [...parents, spec.title].filter(Boolean).join(" > "),
            projectName: test.projectName,
            expectedStatus: test.expectedStatus,
            status: result.status,
            duration: result.duration,
            retry: result.retry,
          });
        }
      }
    }
    for (const child of suite.suites ?? []) walkSuite(child, [...parents, child.title]);
  }
  for (const suite of data.suites ?? []) walkSuite(suite, [suite.title]);
  return found;
}

function writeReport({ port, e2e, validate, binding }) {
  const summary = loadPlaywrightSummary();
  const passed = summary.every((item) => item.status === "passed") && summary.length > 0;
  const assertionResult = passed ? "通过" : "失败";
  const report = `# 测试执行报告

- 任务：虚构「星河协作台」登录业务项目，验证 se-testing 能否完成真实 e2e 行为验证与审计绑定检查
- 运行时间：${new Date().toISOString()}
- 运行环境：\`E2E_BASE_URL=http://127.0.0.1:${port}\`、Chromium、Windows

## 1. 意图 -> spec -> pass/fail 链

| 意图 (version) | spec | assertion | 结果 | 证据 |
|---|---|---|---|---|
| login-success (v1) | specs/login-success.spec.ts | redirect-dashboard | ${assertionResult} | \`playwright-report/results.json\` |
| login-success (v1) | specs/login-success.spec.ts | greet-user | ${assertionResult} | \`playwright-report/results.json\` |
| login-success (v1) | specs/login-success.spec.ts | session-persisted | ${assertionResult} | \`playwright-report/results.json\` |

Playwright 摘要：

\`\`\`json
${JSON.stringify(summary, null, 2)}
\`\`\`

## 2. validate-intention 输出

命令：\`${validate.command}\`
退出码：\`${validate.code}\`

\`\`\`json
${validate.stdout.trim()}
\`\`\`

## 3. check-binding 输出

命令：\`${binding.command}\`
退出码：\`${binding.code}\`

\`\`\`json
${binding.stdout.trim()}
\`\`\`

## 4. Playwright 原始报告与 trace

- HTML 报告：\`playwright-report/html/index.html\`
- JSON 结果：\`playwright-report/results.json\`
- 失败用例 trace：${passed ? "本次无失败" : "见 `test-results/`"}

## 5. 执行命令记录

\`\`\`text
${e2e.command}
退出码：${e2e.code}

${validate.command}
退出码：${validate.code}

${binding.command}
退出码：${binding.code}
\`\`\`
`;
  fs.writeFileSync(path.join(fixtureDir, "report.md"), report, "utf8");
}

async function main() {
  const dependencyInstall = ensureFixtureDependencies();
  if (dependencyInstall) {
    printStep("安装 fixture 依赖", dependencyInstall);
    if (dependencyInstall.code !== 0) process.exit(dependencyInstall.code);
  }

  const port = await findFreePort(portStart);
  const env = {
    ...process.env,
    E2E_PORT: String(port),
    E2E_BASE_URL: `http://127.0.0.1:${port}`,
    E2E_VALID_PASSWORD: process.env.E2E_VALID_PASSWORD ?? "correct-horse",
  };

  const e2e = runNpm(["run", "test:e2e"], { cwd: fixtureDir, env });
  printStep("Playwright e2e", e2e);

  const validate = run(process.execPath, [path.join(pluginRoot, "tools", "validate-intention.mjs"), "."], {
    cwd: fixtureDir,
    env,
  });
  printStep("validate-intention", validate);

  const binding = run(process.execPath, [path.join(pluginRoot, "tools", "check-binding.mjs"), "."], {
    cwd: fixtureDir,
    env,
  });
  printStep("check-binding", binding);

  writeReport({ port, e2e, validate, binding });

  if (e2e.code !== 0 || validate.code !== 0 || binding.code !== 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(`${err.stack ?? err.message}\n`);
  process.exit(1);
});
