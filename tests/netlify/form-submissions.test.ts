import { beforeAll, describe, expect, it } from "vitest";
import {
  NETLIFY_FORMS,
  assertNetlifySiteReady,
  buildContactPayload,
  buildJobApplicationFormData,
  getNetlifySiteUrl,
  isNetlifySuccessResponse,
  netlifyFormEndpoint,
  netlifyFormNotRegisteredHelp,
} from "../helpers/netlify";

const siteUrl = getNetlifySiteUrl();

describe.skipIf(!siteUrl)("Netlify live form submissions", () => {
  const runId = `ci-${Date.now()}`;
  let endpoint = "";

  beforeAll(async () => {
    await assertNetlifySiteReady(siteUrl!);
    endpoint = netlifyFormEndpoint(siteUrl!);
  });

  it("accepts a contact form POST on the deployed site", async () => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: buildContactPayload(runId).toString(),
      redirect: "manual",
    });

    const body = await response.text();

    expect(
      isNetlifySuccessResponse(response.status, body),
      response.status === 404
        ? netlifyFormNotRegisteredHelp(siteUrl!)
        : `Contact form failed (${response.status}): ${body.slice(0, 300)}`,
    ).toBe(true);
  });

  it("accepts a careers application POST with resume upload", async () => {
    const response = await fetch(endpoint, {
      method: "POST",
      body: buildJobApplicationFormData(runId),
      redirect: "manual",
    });

    const body = await response.text();

    expect(
      isNetlifySuccessResponse(response.status, body),
      response.status === 404
        ? netlifyFormNotRegisteredHelp(siteUrl!)
        : `Careers form failed (${response.status}): ${body.slice(0, 300)}`,
    ).toBe(true);
  });

  it("silently discards honeypot spam without a client error", async () => {
    const payload = buildContactPayload(`${runId}-spam`);
    payload.set("bot-field", "definitely-a-bot");

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload.toString(),
      redirect: "manual",
    });

    const body = await response.text();

    // Netlify honeypot drops spam server-side but still returns 200 to bots.
    expect(response.status).not.toBe(404);
    expect(response.status).toBeLessThan(500);
    expect(body.toLowerCase()).not.toContain("form not found");
  });
});
