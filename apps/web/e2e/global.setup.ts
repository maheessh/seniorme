import { execSync } from "node:child_process";
import path from "node:path";
import { expect, test as setup } from "@playwright/test";

const authFile = path.resolve(__dirname, ".auth/user.json");

setup("seed the test database and sign in", async ({ page }) => {
  execSync("npx tsx e2e/seed.ts", {
    cwd: path.resolve(__dirname, ".."),
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: "postgresql://ccc:ccc@localhost:5432/ccc_test?schema=public",
    },
  });

  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.APP_USER_EMAIL!);
  await page.getByLabel("Password").fill(process.env.APP_USER_PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Here's where things stand." })).toBeVisible();

  await page.context().storageState({ path: authFile });
});
