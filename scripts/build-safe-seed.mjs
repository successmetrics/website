import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const APP_DIR = join(ROOT, "apps", "safe-seed");
const DIST_DIR = join(APP_DIR, "dist");
const TARGET_DIR = join(ROOT, "site", "demo");

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    env: {
      ...process.env,
      VITE_API_BASE: "/demo/api",
    },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(join(APP_DIR, "package.json"))) {
  throw new Error("Missing apps/safe-seed. Copy the Safe-Seed web app before building.");
}

const installArgs = existsSync(join(APP_DIR, "package-lock.json"))
  ? ["ci"]
  : ["install"];
if (process.env.CI || !existsSync(join(APP_DIR, "node_modules", "vite"))) {
  run("npm", installArgs, APP_DIR);
}
run("npm", ["run", "build"], APP_DIR);

if (!existsSync(join(DIST_DIR, "index.html"))) {
  throw new Error("Safe-Seed build did not produce apps/safe-seed/dist/index.html.");
}

rmSync(TARGET_DIR, { recursive: true, force: true });
mkdirSync(TARGET_DIR, { recursive: true });
cpSync(DIST_DIR, TARGET_DIR, { recursive: true });

const assetDir = join(DIST_DIR, "assets");
const jsFiles = existsSync(assetDir)
  ? readdirSync(assetDir).filter((name) => name.endsWith(".js"))
  : [];

for (const name of jsFiles) {
  const source = readFileSync(join(assetDir, name));
  if (source.includes("hf_")) {
    throw new Error(
      `Safe-Seed bundle ${name} contains an hf_ token string. Do not set VITE_HF_TOKEN for production builds.`,
    );
  }
}

console.log("Built Safe-Seed demo into site/demo/");
