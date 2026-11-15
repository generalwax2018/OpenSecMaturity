import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// Unit tests for the pure logic in src/lib and src/data. Browser flows are
// covered separately by tests/app.test.mjs against the built file.
export default defineConfig({
  resolve: {
    alias: {
      "@catalog": here("../catalog"),
      "@": here("./src"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
