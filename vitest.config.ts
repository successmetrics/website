import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/static/**/*.test.ts"],
    environment: "node",
  },
});
