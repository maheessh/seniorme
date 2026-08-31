import path from "node:path";
import { config } from "dotenv";
import type { NextConfig } from "next";

// This app is one workspace in a pnpm monorepo and deliberately has no .env file of
// its own — DATABASE_URL, REDIS_URL, etc. all live in the single root `.env` (see
// ARCHITECTURE.md) so the web app and worker process never drift out of sync.
config({ path: path.resolve(__dirname, "../../.env") });

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  agentRules: false,
};

export default nextConfig;
