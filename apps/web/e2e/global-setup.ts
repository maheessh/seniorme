import { execSync } from "node:child_process";
import path from "node:path";

// Seeds ccc_test with deterministic fixture data and mints a signed session for the fixture
// user (written to e2e/.auth/user.json — see playwright.config.ts's storageState) before any
// spec file runs.
export default function globalSetup(): void {
  execSync("npx tsx e2e/seed.ts", {
    cwd: path.resolve(__dirname, ".."),
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: "postgresql://ccc:ccc@localhost:5432/ccc_test?schema=public",
    },
  });
}
