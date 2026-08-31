import { execSync } from "node:child_process";
import path from "node:path";

// No login/session to establish anymore — the app has no auth. This just seeds ccc_test with
// deterministic fixture data before any spec file runs.
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
