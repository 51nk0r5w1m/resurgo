import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    include: ["packages/**/*.integration.test.ts"],
    testTimeout: 15_000,
  },
});
