import {
  SPACE_URL,
  buildUpstreamHeaders,
  passthroughResponseHeaders,
  upstreamUrl,
} from "./shared/safe-seed-proxy.mjs";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

export const config = {
  timeout: 26,
};

export default async function handler(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }

  const hfToken = process.env.HF_TOKEN?.trim();
  if (!hfToken) {
    return new Response(
      JSON.stringify({
        error: "Safe-Seed API proxy is not configured (missing HF_TOKEN).",
      }),
      { status: 503, headers: JSON_HEADERS },
    );
  }

  const dest = upstreamUrl(request.url, SPACE_URL);
  const headers = buildUpstreamHeaders(request.headers, hfToken);
  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  const res = await fetch(dest, {
    method: request.method,
    headers,
    body,
    redirect: "manual",
  });

  return new Response(res.body, {
    status: res.status,
    headers: passthroughResponseHeaders(res.headers),
  });
}
