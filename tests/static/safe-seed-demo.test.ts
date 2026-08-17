import { afterEach, describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadPage } from "../helpers/site";
import { readNetlifyToml } from "../helpers/netlify";
import safeSeedApiHandler from "../../netlify/functions/safe-seed-api.mjs";
import {
  buildUpstreamHeaders,
  stripApiPrefix,
  upstreamUrl,
} from "../../netlify/functions/shared/safe-seed-proxy.mjs";

const netlifyToml = readNetlifyToml();
const demoIndex = join(process.cwd(), "site/demo/index.html");
const demoAssets = join(process.cwd(), "site/demo/assets");

describe("Safe-Seed live demo", () => {
  it("links Try live demo from accelerators and the Safe Seed article", () => {
    const accelerators = loadPage("accelerators.html");
    const article = loadPage("safe-seed.html");

    expect(accelerators('#safe-seed a.btn[href="/demo/login"]').text()).toMatch(
      /Try live demo/i,
    );
    expect(article('a.btn[href="/demo/login"]').length).toBeGreaterThanOrEqual(2);
    expect(article('header a.btn[href="/demo/login"]').text()).toMatch(/Try live demo/i);
  });

  it("builds the React app into site/demo", () => {
    expect(existsSync(demoIndex)).toBe(true);
    const html = readFileSync(demoIndex, "utf8");
    expect(html).toContain('id="root"');
    expect(html).toMatch(/Safe-Seed/);
    expect(html).toMatch(/\/demo\/assets\//);
    expect(html).not.toContain("src=\"/src/main.tsx\"");
  });

  it("does not bake an hf_ token into the demo JavaScript", () => {
    expect(existsSync(demoAssets)).toBe(true);
    const jsFiles = readdirSync(demoAssets).filter((name) => name.endsWith(".js"));
    expect(jsFiles.length).toBeGreaterThan(0);
    for (const name of jsFiles) {
      const source = readFileSync(join(demoAssets, name), "utf8");
      expect(source, name).not.toMatch(/hf_[A-Za-z0-9]+/);
    }
  });
});

describe("Safe-Seed API proxy helpers", () => {
  it("strips /demo/api and keeps /v1 and /health", () => {
    expect(stripApiPrefix("/demo/api/health")).toBe("/health");
    expect(stripApiPrefix("/demo/api/v1/auth/login")).toBe("/v1/auth/login");
    expect(stripApiPrefix("/demo/api")).toBe("/");
    expect(stripApiPrefix("/.netlify/functions/safe-seed-api/v1/jobs")).toBe("/v1/jobs");
  });

  it("builds the Hugging Face upstream URL", () => {
    expect(upstreamUrl("https://www.successmetrics.io/demo/api/health")).toBe(
      "https://adityamurthy-safe-seed-api.hf.space/health",
    );
    expect(
      upstreamUrl("https://www.successmetrics.io/demo/api/v1/jobs/abc/download.csv"),
    ).toBe("https://adityamurthy-safe-seed-api.hf.space/v1/jobs/abc/download.csv");
  });

  it("moves the app JWT to X-Safe-Seed-Token and sets the Space token", () => {
    const incoming = new Headers({
      authorization: "Bearer app-jwt",
      "x-workspace-id": "ws-1",
      origin: "https://www.successmetrics.io",
      "content-type": "application/json",
    });
    const headers = buildUpstreamHeaders(incoming, "space-token");

    expect(headers.get("Authorization")).toBe("Bearer space-token");
    expect(headers.get("X-Safe-Seed-Token")).toBe("Bearer app-jwt");
    expect(headers.get("X-Workspace-Id")).toBe("ws-1");
    expect(headers.get("Origin")).toBe("https://www.successmetrics.io");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("does not copy an hf_ Authorization header onto X-Safe-Seed-Token", () => {
    const incoming = new Headers({
      authorization: "Bearer hf_should_not_leak",
    });
    const headers = buildUpstreamHeaders(incoming, "space-token");
    expect(headers.get("X-Safe-Seed-Token")).toBeNull();
    expect(headers.get("Authorization")).toBe("Bearer space-token");
  });
});

describe("Safe-Seed Netlify routes", () => {
  it.skipIf(netlifyToml === null)("proxies /demo/api before the SPA fallback", () => {
    const apiIndex = netlifyToml!.indexOf('from = "/demo/api/*"');
    const spaIndex = netlifyToml!.indexOf('from = "/demo/*"');
    expect(apiIndex).toBeGreaterThan(-1);
    expect(spaIndex).toBeGreaterThan(-1);
    expect(apiIndex).toBeLessThan(spaIndex);
    expect(netlifyToml).toContain('to = "/.netlify/functions/safe-seed-api/:splat"');
    expect(netlifyToml).toContain('from = "/admin/approve/:reqId"');
    expect(netlifyToml).toContain('to = "/demo/admin/approve/:reqId"');
  });
});

describe("Safe-Seed API handler", () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  it("returns 503 JSON when HF_TOKEN is missing", async () => {
    delete process.env.HF_TOKEN;
    const response = await safeSeedApiHandler(
      new Request("http://localhost/demo/api/health"),
    );
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toMatch(/HF_TOKEN/);
  });
});
