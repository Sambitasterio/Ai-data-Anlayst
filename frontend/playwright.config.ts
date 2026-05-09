import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

const ci = process.env.CI === "true";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer:
    process.env.PLAYWRIGHT_SKIP_WEBSERVER === "1"
      ? undefined
      : {
          command:
            process.env.PLAYWRIGHT_WEBSERVER_COMMAND ??
            (ci
              ? "npm run build && npm run start -- -p 3000"
              : "npm run start -- -p 3000"),
          url: baseURL,
          timeout: ci ? 240_000 : 120_000,
          reuseExistingServer: !ci,
        },
});
