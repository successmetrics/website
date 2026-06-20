import { defineConfig } from "vitest/config";
import { loadDotEnv } from "./tests/helpers/env";

loadDotEnv();

export default defineConfig({
  test: {
    include: ["tests/notion/**/*.test.ts", "tests/static/notion-careers.test.ts"],
    environment: "node",
  },
});
