import { defineConfig, devices } from "@playwright/test";

// 业务项目接入骨架：复制 template/ 到目标项目后按需调整 baseURL / webServer。
// trace / report 路径要在 report.md 里被引用，作为可审计证据。
export default defineConfig({
  testDir: "./specs",
  fullyParallel: true,
  // 收工证据：失败必须留 trace，供失败分类与人类审计回看。
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["json", { outputFile: "playwright-report/results.json" }],
    ["html", { outputFolder: "playwright-report/html", open: "never" }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
