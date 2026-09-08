import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

// Harmless to load — the database these tests run against is `ccc_test`, a completely separate
// database from the `ccc` one used by day-to-day dev/prod, so there's no real-data collision risk.
loadEnv({ path: path.resolve(__dirname, "../../.env") });

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    // Written by e2e/seed.ts (global setup) — a signed session cookie for the fixture user, so
    // every spec starts already authenticated instead of driving a real Google/GitHub OAuth
    // consent flow.
    storageState: "./e2e/.auth/user.json",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "npx next dev",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      ...process.env,
      DATABASE_URL: "postgresql://ccc:ccc@localhost:5432/ccc_test?schema=public",
      // A "Scrape now" click in the companies E2E test enqueues a real BullMQ job — without
      // this, it lands in the same Redis keyspace (db 0) as a real `pnpm dev:worker` instance,
      // which then logs a harmless but noisy "CareerSource no longer exists" warning trying to
      // process a job that only makes sense against ccc_test. DB index 1 keeps E2E's queue
      // activity fully isolated (confirmed live: this warning showed up in the real worker's
      // log before this fix).
      REDIS_URL: "redis://localhost:6379/1",
      PORT: String(PORT),
    },
  },
});
