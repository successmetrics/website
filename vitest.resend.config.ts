import { defineConfig } from "vitest/config";
import { loadDotEnv } from "./tests/helpers/env";

loadDotEnv();

export default defineConfig({
  test: {
    include: ["tests/resend/**/*.test.ts", "tests/static/email-careers.test.ts"],
    environment: "node",
  },
});
