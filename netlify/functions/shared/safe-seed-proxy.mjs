const SPACE_URL =
  process.env.SAFE_SEED_API_URL?.trim() ||
  "https://adityamurthy-safe-seed-api.hf.space";

const API_PREFIXES = ["/demo/api", "/.netlify/functions/safe-seed-api"];

export function stripApiPrefix(pathname) {
  let path = pathname || "/";
  for (const prefix of API_PREFIXES) {
    if (path === prefix) return "/";
    if (path.startsWith(`${prefix}/`)) {
      path = path.slice(prefix.length);
      break;
    }
  }
  if (!path.startsWith("/")) path = `/${path}`;
  return path;
}

export function upstreamUrl(requestUrl, spaceUrl = SPACE_URL) {
  const url = new URL(requestUrl);
  return `${spaceUrl.replace(/\/$/, "")}${stripApiPrefix(url.pathname)}${url.search}`;
}

export function buildUpstreamHeaders(incoming, hfToken) {
  const headers = new Headers();
  const contentType = incoming.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  const workspaceId = incoming.get("x-workspace-id");
  if (workspaceId) headers.set("X-Workspace-Id", workspaceId);

  const auth = incoming.get("authorization");
  const ss = incoming.get("x-safe-seed-token");
  if (ss) {
    headers.set("X-Safe-Seed-Token", ss);
  } else if (auth && !auth.includes("hf_")) {
    headers.set("X-Safe-Seed-Token", auth);
  }
  headers.set("Authorization", `Bearer ${hfToken}`);

  const origin = incoming.get("origin");
  if (origin && !origin.toLowerCase().includes("hf.space")) {
    headers.set("Origin", origin);
  }

  return headers;
}

export function passthroughResponseHeaders(upstream) {
  const headers = new Headers(upstream);
  for (const name of [
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
  ]) {
    headers.delete(name);
  }
  return headers;
}

export { SPACE_URL };
