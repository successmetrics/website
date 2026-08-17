const API_BASE = import.meta.env.VITE_API_BASE || '/demo/api';
const HF_TOKEN = import.meta.env.VITE_HF_TOKEN || '';
/** Direct browser→HF calls (CORS). Prefer /api + Vite proxy instead. */
const DIRECT_HF =
  Boolean(HF_TOKEN) &&
  /^https?:\/\//.test(API_BASE) &&
  API_BASE.includes('hf.space');

const DEFAULT_TIMEOUT_MS = 120_000;

function buildUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export type Role = 'admin' | 'operator' | 'privacy_reviewer';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getToken() {
  return localStorage.getItem('ss_token');
}

function getWorkspaceId() {
  return localStorage.getItem('ss_workspace_id');
}

export function setSession(token: string, workspaceId?: string) {
  localStorage.setItem('ss_token', token);
  if (workspaceId) localStorage.setItem('ss_workspace_id', workspaceId);
}

export function clearSession() {
  localStorage.removeItem('ss_token');
  localStorage.removeItem('ss_workspace_id');
}

function applyAuthHeaders(headers: Headers) {
  const token = getToken();
  if (DIRECT_HF) {
    // Private HF Space: Authorization = HF token; app JWT in X-Safe-Seed-Token.
    headers.set('Authorization', `Bearer ${HF_TOKEN}`);
    if (token) headers.set('X-Safe-Seed-Token', token);
  } else if (token) {
    // Same-origin /api proxy injects the HF token server-side.
    headers.set('Authorization', `Bearer ${token}`);
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new ApiError(
        408,
        'Request timed out — the HF Space may be cold-starting. Wait a minute and try again.',
      );
    }
    throw e;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function api<T = unknown>(
  path: string,
  opts: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const headers = new Headers(opts.headers || {});
  applyAuthHeaders(headers);
  const wid = getWorkspaceId();
  if (wid && !headers.has('X-Workspace-Id')) headers.set('X-Workspace-Id', wid);
  let body = opts.body;
  if (opts.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(opts.json);
  }
  const { json: _json, ...rest } = opts;
  const res = await fetchWithTimeout(buildUrl(path), { ...rest, headers, body });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const err = await res.json();
      detail = err.detail || JSON.stringify(err);
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res as unknown as T;
}

export async function downloadEvidence(jobId: string) {
  // Demo: evidence ZIP is locked — use capped CSV instead.
  return downloadSyntheticCsv(jobId);
}

/** Demo-safe download: single CSV, or a ZIP of one CSV per relational table. */
export async function downloadSyntheticCsv(jobId: string) {
  const headers = new Headers({ 'X-Workspace-Id': getWorkspaceId() || '' });
  applyAuthHeaders(headers);
  const res = await fetchWithTimeout(buildUrl(`/v1/jobs/${jobId}/download.csv`), { headers });
  if (!res.ok) {
    let detail = 'CSV download failed';
    try {
      const j = await res.json();
      detail = typeof j?.detail === 'string' ? j.detail : detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail);
  }
  const blob = await res.blob();
  const cd = res.headers.get('content-disposition') || '';
  const match = /filename\*?=(?:UTF-8''|"?)([^";]+)/i.exec(cd);
  const fallback = (res.headers.get('content-type') || '').includes('zip')
    ? `synthetic-${jobId}-tables.zip`
    : `synthetic-${jobId}-demo.csv`;
  const filename = decodeURIComponent(match?.[1] || fallback).replace(/["']/g, '');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Fetch representative real rows for a discovered pattern (with PII masked). */
export async function getPatternSample(jobId: string, patternIdx: number) {
  return api<{
    rows: Record<string, unknown>[];
    pattern: { rank: number; col_a: string; col_b: string; metric: string; strength: number } | null;
    pii_masked_columns: string[];
    n_real_rows_available: number;
    note?: string;
  }>(`/v1/jobs/${jobId}/pattern-sample?pattern_idx=${patternIdx}`);
}

/** Warm-start a new job from a finished job's learned config (Keep Training). */
export async function keepTraining(jobId: string, opts?: { adapt_budget?: number; name?: string }) {
  return api<{ id: string; name: string; status: string }>(`/v1/jobs/${jobId}/keep-training`, {
    method: 'POST',
    json: {
      adapt_budget: opts?.adapt_budget ?? 250,
      ...(opts?.name ? { name: opts.name } : {}),
    },
  });
}

// ---------------------------------------------------------------------------
// Projects (cross-application referential integrity)
// ---------------------------------------------------------------------------

export type ProjectSource = {
  project_id: string;
  source_id: string;
  source_name: string;
  source_kind: string;
  app_name: string;
  ordinal: number;
};

export type Project = {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  entity_type: string;
  id_column: string;
  created_at: number;
  updated_at: number;
  sources: ProjectSource[];
  registry_size: number;
};

export async function listProjects() {
  return api<{ projects: Project[] }>('/v1/projects');
}

export async function getProject(projectId: string) {
  return api<Project>(`/v1/projects/${projectId}`);
}

export async function createProject(body: {
  name: string;
  description?: string;
  entity_type?: string;
  id_column?: string;
}) {
  return api<Project>('/v1/projects', { method: 'POST', json: body });
}

export async function deleteJob(jobId: string) {
  const listed = await api<{ capabilities?: { job_delete?: boolean } }>('/v1/jobs');
  if (listed.capabilities?.job_delete) {
    // Prefer the retry path: the live Space already routes POST /v1/jobs/{id}/retry.
    try {
      return await api(`/v1/jobs/${jobId}/retry`, {
        method: 'POST',
        json: { action: 'delete' },
      });
    } catch (e: unknown) {
      if (!(e instanceof ApiError) || (e.status !== 404 && e.status !== 405)) throw e;
    }
    return api(`/v1/jobs/${jobId}/delete`, { method: 'POST' });
  }
  try {
    return await api(`/v1/jobs/${jobId}/delete`, { method: 'POST' });
  } catch (e: unknown) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
      throw new ApiError(
        404,
        'This API version cannot delete jobs yet. Push the test branch so the Space updates, then try again.',
      );
    }
    throw e;
  }
}

export async function cancelJob(jobId: string) {
  const listed = await api<{ capabilities?: { job_cancel?: boolean } }>('/v1/jobs');
  if (listed.capabilities?.job_cancel) {
    try {
      return await api<{ status: string }>(`/v1/jobs/${jobId}/cancel`, { method: 'POST' });
    } catch (e: unknown) {
      if (!(e instanceof ApiError) || (e.status !== 404 && e.status !== 405)) throw e;
      return api<{ status: string }>(`/v1/jobs/${jobId}/retry`, {
        method: 'POST',
        json: { action: 'cancel' },
      });
    }
  }
  try {
    return await api<{ status: string }>(`/v1/jobs/${jobId}/cancel`, { method: 'POST' });
  } catch (e: unknown) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
      throw new ApiError(
        404,
        'This API version cannot cancel jobs yet. Push the test branch so the Space updates, then try again.',
      );
    }
    throw e;
  }
}

export async function deleteProject(projectId: string) {
  return api<void>(`/v1/projects/${projectId}`, { method: 'DELETE' });
}

export async function addProjectSource(
  projectId: string,
  body: { source_id: string; app_name?: string; ordinal?: number },
) {
  return api<ProjectSource>(`/v1/projects/${projectId}/sources`, { method: 'POST', json: body });
}

export async function removeProjectSource(projectId: string, sourceId: string) {
  return api<void>(`/v1/projects/${projectId}/sources/${sourceId}`, { method: 'DELETE' });
}

export async function getIdentityRegistry(projectId: string, entityType?: string) {
  const q = entityType ? `?entity_type=${encodeURIComponent(entityType)}` : '';
  return api<{ entries: { real_id: string; synthetic_id: string; entity_type: string; created_at: number }[]; total: number }>(
    `/v1/projects/${projectId}/registry${q}`,
  );
}

// ---------------------------------------------------------------------------
// MongoDB sources
// ---------------------------------------------------------------------------

export async function listMongoCollections(uri: string, database: string) {
  return api<{ collections: { name: string; count: number }[] }>(
    '/v1/sources/mongo/collections',
    { method: 'POST', json: { uri, database } },
  );
}

export async function createSourceFromMongoDB(body: {
  uri: string;
  database: string;
  collection: string;
  name?: string;
  id_column?: string;
  pii_columns?: string[];
}) {
  return api<{ id: string; name: string; kind: string }>('/v1/sources/from-mongodb', {
    method: 'POST',
    json: body,
  });
}

// ---------------------------------------------------------------------------
// Delta pattern detection
// ---------------------------------------------------------------------------

export type DeltaPattern = {
  rank: number | null;
  col_a: string;
  col_b: string;
  metric: string;
  strength: number;
  cross_table?: boolean;
  delta_status: 'new' | 'stable' | 'shifted' | 'dropped';
  strength_delta: number | null;
};

export async function getPatternDelta(jobId: string) {
  return api<{
    delta: DeltaPattern[];
    has_prior: boolean;
    prior_job_id: string | null;
    prior_created_at: number | null;
  }>(`/v1/jobs/${jobId}/pattern-delta`);
}
