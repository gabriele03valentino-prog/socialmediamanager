import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "tests/**/*.test.ts"],
    globals: false,
    coverage: {
      reporter: ["text", "lcov"],
      include: ["lib/**/*.ts"],
      exclude: ["**/*.test.ts", "**/types.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
