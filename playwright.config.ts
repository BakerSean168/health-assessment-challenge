import { defineConfig, devices } from "@playwright/test";

const remoteBaseUrl = process.env.E2E_BASE_URL;
const localE2ePort = process.env.E2E_PORT ?? "3100";
const localBaseUrl = `http://127.0.0.1:${localE2ePort}`;

export default defineConfig({
  testDir: "./src/test/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: remoteBaseUrl ?? localBaseUrl,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: remoteBaseUrl
    ? undefined
    : {
        command: `pnpm dev --hostname 127.0.0.1 --port ${localE2ePort}`,
        url: localBaseUrl,
        reuseExistingServer: false,
      },
});
