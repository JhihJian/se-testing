import { defineConfig, devices } from "@playwright/test";

const port = process.env.E2E_PORT ?? "4174";
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./specs",
  fullyParallel: true,
  retries: 0,
  reporter: [
    ["list"],
    ["json", { outputFile: "playwright-report/results.json" }],
    ["html", { outputFolder: "playwright-report/html", open: "never" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run start",
    url: `${baseURL}/health`,
    reuseExistingServer: false,
    timeout: 15_000,
    env: {
      PORT: port,
      E2E_VALID_PASSWORD: process.env.E2E_VALID_PASSWORD ?? "correct-horse",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
