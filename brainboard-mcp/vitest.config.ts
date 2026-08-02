import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only run tests from source. Without this, a stale dist/ build gets picked
    // up too and every test runs twice.
    include: ["src/**/*.test.ts"],
  },
});
