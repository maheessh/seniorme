import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

// Reuses NEXTAUTH_SECRET and the app-user credentials from the root .env (harmless — the
// database these tests run against is `ccc_test`, a completely separate database from the
// `ccc` one used by day-to-day dev/prod, so there's no real-data collision risk). Only
// DATABASE_URL and NEXTAUTH_URL are overridden below, to point at the test DB and the
// dedicated E2E port rather than whatever's already running on 3000.
loadEnv({ path: path.resolve(__dirname, "../../.env") });

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx next dev",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      ...process.env,
      DATABASE_URL: "postgresql://ccc:ccc@localhost:5432/ccc_test?schema=public",
      NEXTAUTH_URL: baseURL,
      PORT: String(PORT),
    },
  },
  projects: [
    { name: "setup", testMatch: /global\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/user.json" },
      dependencies: ["setup"],
    },
  ],
});
