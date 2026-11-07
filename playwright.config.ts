import { defineConfig, devices } from "@playwright/test";

// Runs the two core workflows (same ones you give Wren) against a local build.
// Against a deployed app instead:  BASE_URL=https://your-app.vercel.app npm run test:e2e
const baseURL = process.env.BASE_URL || "http://localhost:3100";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL, trace: "off", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "npm run build && npx next start -p 3100",
        url: "http://localhost:3100/api/health",
        reuseExistingServer: true,
        timeout: 240_000,
        env: { DATABASE_URL: "file:./data/e2e.db", ENABLE_TEST_PAYMENTS: "true" },
      },
});
