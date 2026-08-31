import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./src/test-setup.ts"],
    // Integration tests share one real Postgres test database — run them serially so
    // truncate-between-tests doesn't race with another file's in-flight queries.
    fileParallelism: false,
    // Scoped to src/ so a stray `dist/*.test.js` from `pnpm build` (tsc compiles the whole
    // src/ tree, though tsconfig now excludes test files from that output) is never picked up
    // alongside the real tests — verified live: without this, vitest ran both copies, and the
    // compiled dist ones failed on Node's stricter ESM module resolution.
    include: ["src/**/*.test.ts"],
  },
});
