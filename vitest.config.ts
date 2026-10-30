import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      enabled: false,
    },
    environment: "node",
    exclude: [
      "**/.next/**",
      "**/dist/**",
      "**/node_modules/**",
      "**/*.integration.test.ts",
    ],
    include: ["apps/**/*.test.ts", "packages/**/*.test.ts"],
  },
});
