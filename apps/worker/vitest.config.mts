import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./src/test-setup.ts"],
    // Integration tests share one real Postgres test database — run them serially so
    // truncate-between-tests doesn't race with another file's in-flight queries.
    fileParallelism: false,
  },
});
