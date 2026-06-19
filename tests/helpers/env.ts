import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function loadDotEnv(path = join(process.cwd(), ".env")) {
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function hasNotionCareersConfig(): boolean {
  return Boolean(
    process.env.NOTION_TOKEN?.trim() &&
      process.env.NOTION_JOBS_DATABASE_ID?.trim() &&
      process.env.NOTION_APPLICATIONS_DATABASE_ID?.trim(),
  );
}

export function hasResendConfig(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}
