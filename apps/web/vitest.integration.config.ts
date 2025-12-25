import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.integration.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      "@types": path.resolve(__dirname, "../../packages/types/src"),
      "@config": path.resolve(__dirname, "../../packages/config/src"),
    },
  },
});
