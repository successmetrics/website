import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { SchemaDiagram } from '../components/SchemaDiagram';
import { api, cancelJob, deleteJob, downloadSyntheticCsv, getPatternDelta, getPatternSample, keepTraining, type DeltaPattern } from '../lib/api';
import { useAuth } from '../lib/auth';
import { emptySchemaConfig } from '../lib/schemaConfig';
import { jobStepLabel } from '../lib/jobProgress';
import {
  computePrivacyMetrics,
  computePrivacyScore,
  inferTypes,
  privacyStatusFromReid,
  type PrivacyMetrics,
} from '../lib/privacy';

type Rel = {
  metric?: string;
  columns?: string[];
  col_a?: string;
  col_b?: string;
  value?: number;
  threshold?: number;
  status?: string;
  reason?: string;
  real_value?: number;
  synth_value?: number;
  real_rho?: number;
  synth_rho?: number;
};

type DiscoveredPattern = {
  rank: number | null;
  col_a: string;
  col_b: string;
  metric: string;
  strength: number;
  cross_table?: boolean;
  // delta fields (present when loaded via /pattern-delta)
  delta_status?: 'new' | 'stable' | 'shifted' | 'dropped';
  strength_delta?: number | null;
};

type PrivacyScore = {
  score: number;
  grade: string;
  reid_component: number;
  nndr_component: number;
};

type ReportPayload = {
  job_id: string;
  name: string;
  status: string;
  config_hash: string;
  report: {
    overall_status?: string;
    n_synthetic_rows?: number;
    internal_consistency?: { plausible_pct?: number };
    relations?: Rel[];
    table_sizes_real?: Record<string, number>;
    table_sizes_synth?: Record<string, number>;
    preserve_sizes?: boolean;
    parent_table?: string;
    discovered_patterns?: DiscoveredPattern[];
    privacy_score?: PrivacyScore;
    privacy?: {
      reid_pct?: number | null;
      nndr?: number | null;
      status?: string;
    };
    [k: string]: unknown;
  };
  synthetic_data: Record<string, unknown>[];
  real_data: Record<string, unknown>[];
  parent_data?: Record<string, unknown>[];
  child_tables?: Record<string, Record<string, unknown>[]>;
  table_sizes_real?: Record<string, number>;
  table_sizes_synth?: Record<string, number>;
  links?: Array<{ fromTable: string; fromCol: string; toTable: string; toCol: string }>;
  parent_table?: string;
  n_synthetic: number;
  n_real: number;
  demo?: {
    has_api_key?: boolean;
    max_download_rows?: number;
    download_formats?: string[];
    zip_locked?: boolean;
  };
};

type Job = {
  id: string;
  name: string;
  status: string;
  progress: number;
  message: string;
  error?: string;
  result?: {
    report?: ReportPayload['report'];
    synthetic_data?: Record<string, unknown>[];
    child_tables?: Record<string, Record<string, unknown>[]>;
    table_sizes_synth?: Record<string, number>;
  };
};

function isMultiTableResult(result?: {
  child_tables?: Record<string, unknown>;
  table_sizes_synth?: Record<string, number>;
}) {
  if (!result) return false;
  if (Object.keys(result.child_tables || {}).length > 0) return true;
  return Object.keys(result.table_sizes_synth || {}).length > 1;
}

function downloadButtonLabel(busy: boolean, multi: boolean, maxRows = 150) {
  if (busy) return 'Downloading…';
  return multi
    ? `Download tables (ZIP, max ${maxRows}/table)`
    : `Download CSV (max ${maxRows} rows)`;
}

export function JobDetailRoute() {
  const { id } = useParams();
  return id ? <JobDetailPage jobId={id} /> : null;
}

export function JobReportRoute() {
  const { id } = useParams();
  return id ? <JobReportPage jobId={id} /> : null;
}

function JobDetailPage({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<Job | null>(null);
  const [err, setErr] = useState('');
  const [keepBusy, setKeepBusy] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [dlBusy, setDlBusy] = useState(false);
  const [pollNonce, setPollNonce] = useState(0);
  const nav = useNavigate();
  const { can } = useAuth();

  useEffect(() => {
    api<{ counts: { has_api_key?: boolean }; demo?: { has_api_key?: boolean } }>('/v1/dashboard')
      .then((d) => setHasApiKey(Boolean(d.demo?.has_api_key ?? d.counts?.has_api_key)))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let alive = true;
    let timer: number | undefined;
    async function poll() {
      try {
        const j = await api<Job>(`/v1/jobs/${jobId}`);
        if (!alive) return;
        setJob(j);
        if (j.status === 'running' || j.status === 'queued') {
          timer = window.setTimeout(poll, 800);
        }
      } catch (e: unknown) {
        if (alive) setErr(e instanceof Error ? e.message : 'Failed');
      }
    }
    poll();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, pollNonce]);

  async function retry() {
    const j = await api<Job>(`/v1/jobs/${jobId}/retry`, { method: 'POST' });
    setJob(j);
    setPollNonce((n) => n + 1);
  }

  async function onCancel() {
    const msg = job?.status === 'running'
      ? 'Stop search and keep the best result so far?'
      : 'Cancel this queued job?';
    if (!window.confirm(msg)) return;
    setErr('');
    try {
      await cancelJob(jobId);
      const j = await api<Job>(`/v1/jobs/${jobId}`);
      setJob(j);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Cancel failed');
    }
  }

  async function onDelete() {
    if (!window.confirm('Delete this job? This cannot be undone.')) return;
    setErr('');
    try {
      await deleteJob(jobId);
      nav('/jobs');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  async function onKeepTraining() {
    setErr('');
    setKeepBusy(true);
    try {
      const j = await keepTraining(jobId);
      nav(`/jobs/${j.id}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Keep Training failed');
    } finally {
      setKeepBusy(false);
    }
  }

  async function onDownloadCsv() {
    setErr('');
    setDlBusy(true);
    try {
      await downloadSyntheticCsv(jobId);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setDlBusy(false);
    }
  }

  if (!job && !err) return <p className="muted">Loading…</p>;

  return (
    <div>
      <h1 className="page-title">{job?.name || 'Job'}</h1>
      <p className="page-sub">
        <span className={`pill ${job?.status}`}>{job?.status}</span>{' '}
        <span className="muted">{jobStepLabel(job?.status, job?.progress, job?.message)}</span>
      </p>
      {err && <div className="err">{err}</div>}
      {job?.error && <div className="err">{job.error}</div>}
      <div className="card">
        <div className="progress">
          <div style={{ width: `${Math.round((job?.progress || 0) * 100)}%` }} />
        </div>
        <div className="muted">{Math.round((job?.progress || 0) * 100)}%</div>
        <div className="row" style={{ marginTop: 12 }}>
          {job?.status === 'done' && (
            <>
              <Link className="btn" to={`/jobs/${jobId}/report`}>
                Open report
              </Link>
              {can('download_evidence') && (
                <button className="btn sec" disabled={dlBusy} onClick={onDownloadCsv}>
                  {downloadButtonLabel(dlBusy, isMultiTableResult(job?.result))}
                </button>
              )}
              {can('download_evidence') && (
                <button
                  className="btn sec"
                  disabled
                  title="ZIP evidence pack is locked in the demo"
                  style={{ opacity: 0.4 }}
                >
                  Evidence ZIP (locked)
                </button>
              )}
              {can('run_jobs') && hasApiKey && (
                <button
                  className="btn sec"
                  disabled={keepBusy}
                  onClick={onKeepTraining}
                  title="Continue from this config with a longer train plus 250 more search trials. Stop anytime to keep the best so far."
                >
                  {keepBusy ? 'Starting…' : 'Keep Training'}
                </button>
              )}
            </>
          )}
          {(job?.status === 'queued' || job?.status === 'running') && can('run_jobs') && (
            <button className="btn sec" onClick={() => void onCancel()}>
              {job?.status === 'running' ? 'Stop search' : 'Cancel'}
            </button>
          )}
          {(job?.status === 'error' || job?.status === 'done' || job?.status === 'cancelled') && can('run_jobs') && (
            <button className="btn sec" onClick={retry}>
              Retry
            </button>
          )}
          {job && can('run_jobs') && (
            <button
              className="btn sec"
              onClick={() => void onDelete()}
              style={{ color: '#f87171', borderColor: '#f8717144' }}
            >
              Delete
            </button>
          )}
        </div>
      </div>
      {job?.status === 'done' && (
        <p className="muted">
          Full fidelity / privacy / EDA report matches the POC layout on the report page.
        </p>
      )}
    </div>
  );
}

function fmt3(v: number | null | undefined) {
  return v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toFixed(3);
}
function fmt4(v: number | null | undefined) {
  return v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toFixed(4);
}

function relColumns(r: Rel): string[] {
  if (r.columns?.length) return r.columns;
  return [r.col_a, r.col_b].filter(Boolean) as string[];
}

function StatusBadge({ label, status }: { label: string; status?: string | null }) {
  return (
    <div className={`status-badge${status ? ` ${status}` : ''}`} title={label}>
      <span className="badge-label">{label}</span>
      {status || '—'}
    </div>
  );
}

function PrivacyScoreBadge({ score, grade }: { score: number; grade: string }) {
  const color =
    grade === 'A' || grade === 'B' ? 'var(--green)' : grade === 'C' ? 'var(--orange)' : 'var(--red)';
  return (
    <div
      className="status-badge"
      title={`Privacy Score: ${score}/100 — composite of re-identification risk and NNDR distance`}
      style={{ borderColor: color }}
    >
      <span className="badge-label">Privacy Score</span>
      <span style={{ color, fontWeight: 700 }}>
        {grade} <span style={{ fontWeight: 400, fontSize: 11 }}>{score}/100</span>
      </span>
    </div>
  );
}

// ---- Pattern Library --------------------------------------------------------

const METRIC_LABELS: Record<string, string> = {
  spearman: 'Spearman ρ',
  chi2: 'Chi² (Cramér V)',
  conditional_ks: 'Cond. KS',
  conditional_spearman: 'Cond. Spearman',
  partial_spearman: 'Partial Spearman',
  conditional_ks_2cat: 'Cond. KS 2-cat',
  conditional_chi2_2cat: 'Chi² 2-cat',
};

type PatternSampleState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; rows: Record<string, unknown>[]; pattern: DiscoveredPattern; maskedCols: string[] }
  | { kind: 'error'; message: string };

const DELTA_BADGE: Record<string, { label: string; color: string; title: string }> = {
  new: { label: '🆕 NEW', color: 'var(--blue, #4c6ef5)', title: 'Pattern not seen in previous run' },
  shifted: { label: '⬆ SHIFTED', color: 'var(--orange)', title: 'Pattern strength changed significantly vs last run' },
  stable: { label: '✓ STABLE', color: 'var(--green)', title: 'Pattern unchanged from last run' },
  dropped: { label: '⚠ DROPPED', color: 'var(--red)', title: 'Pattern present in last run but not this one' },
};

function PatternLibraryCard({
  patterns,
  jobId,
  hasRealData,
}: {
  patterns: DiscoveredPattern[];
  jobId: string;
  hasRealData: boolean;
}) {
  const [sample, setSample] = useState<PatternSampleState>({ kind: 'idle' });
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [deltaMap, setDeltaMap] = useState<Map<string, DeltaPattern> | null>(null);
  const [hasPrior, setHasPrior] = useState(false);

  // Load delta data lazily on mount
  useEffect(() => {
    let cancelled = false;
    getPatternDelta(jobId).then((res) => {
      if (cancelled) return;
      if (!res.has_prior) return;
      setHasPrior(true);
      const m = new Map<string, DeltaPattern>();
      for (const d of res.delta) {
        const key = [d.col_a, d.col_b, d.metric].sort().join('|');
        m.set(key, d);
      }
      setDeltaMap(m);
    }).catch(() => { /* delta is optional — silently ignore */ });
    return () => { cancelled = true; };
  }, [jobId]);

  async function viewSample(idx: number) {
    setSample({ kind: 'loading' });
    setSelectedIdx(idx);
    try {
      const res = await getPatternSample(jobId, idx);
      if (res.pattern) {
        setSample({ kind: 'loaded', rows: res.rows, pattern: res.pattern, maskedCols: res.pii_masked_columns });
      } else {
        setSample({ kind: 'error', message: res.note || 'No pattern data available.' });
      }
    } catch (e: unknown) {
      setSample({ kind: 'error', message: e instanceof Error ? e.message : 'Failed to load sample' });
    }
  }

  function closeSample() {
    setSample({ kind: 'idle' });
    setSelectedIdx(null);
  }

  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Pattern Library</h3>
          <span className="muted" style={{ fontSize: 12 }}>
            {patterns.length} patterns · ranked by strength
            {patterns[0]?.cross_table && (
              <span
                style={{ marginLeft: 6, color: 'var(--blue, #4c6ef5)', fontSize: 11 }}
                title="Patterns discovered across the aggregated multi-table view"
              >
                · cross-table
              </span>
            )}
          </span>
        </div>
        <div className="table-wrap" style={{ maxHeight: 380 }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 32 }}>#</th>
                <th>Columns</th>
                <th>Type</th>
                <th style={{ width: 140 }}>Strength</th>
                {hasPrior && <th style={{ width: 100 }}>Change</th>}
                {hasRealData && <th style={{ width: 90 }}></th>}
              </tr>
            </thead>
            <tbody>
              {patterns.map((p, i) => {
                const barPct = Math.round(p.strength * 100);
                const isSelected = selectedIdx === i;
                const deltaKey = [p.col_a, p.col_b, p.metric].sort().join('|');
                const delta = deltaMap?.get(deltaKey);
                const badge = delta ? DELTA_BADGE[delta.delta_status] : null;
                return (
                  <tr
                    key={i}
                    style={isSelected ? { background: 'rgba(76,110,245,0.08)' } : undefined}
                  >
                    <td className="muted" style={{ fontSize: 12 }}>{p.rank}</td>
                    <td>
                      <code style={{ fontSize: 12 }}>{p.col_a}</code>
                      <span className="muted"> × </span>
                      <code style={{ fontSize: 12 }}>{p.col_b}</code>
                    </td>
                    <td>
                      <span className="muted" style={{ fontSize: 11 }}>
                        {METRIC_LABELS[p.metric] || p.metric}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div
                          style={{
                            flex: 1,
                            height: 6,
                            background: 'var(--border)',
                            borderRadius: 3,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${barPct}%`,
                              height: '100%',
                              background:
                                barPct >= 70
                                  ? 'var(--green)'
                                  : barPct >= 40
                                    ? 'var(--orange)'
                                    : 'var(--blue, #4c6ef5)',
                              borderRadius: 3,
                            }}
                          />
                        </div>
                        <span className="muted" style={{ fontSize: 11, minWidth: 34, textAlign: 'right' }}>
                          {(p.strength * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    {hasPrior && (
                      <td>
                        {badge ? (
                          <span
                            title={badge.title + (delta?.strength_delta != null ? ` (Δ ${delta.strength_delta > 0 ? '+' : ''}${(delta.strength_delta * 100).toFixed(0)}%)` : '')}
                            style={{ fontSize: 10, color: badge.color, fontWeight: 600, whiteSpace: 'nowrap' }}
                          >
                            {badge.label}
                          </span>
                        ) : (
                          <span className="muted" style={{ fontSize: 10 }}>—</span>
                        )}
                      </td>
                    )}
                    {hasRealData && (
                      <td>
                        <button
                          className="btn sec sm"
                          style={{ fontSize: 11, padding: '2px 8px' }}
                          onClick={() => (isSelected ? closeSample() : viewSample(i))}
                        >
                          {isSelected ? 'Close' : 'View sample'}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dropped patterns (were in prior run, absent now) */}
      {deltaMap && (() => {
        const currentKeys = new Set(patterns.map(p => [p.col_a, p.col_b, p.metric].sort().join('|')));
        const dropped = [...deltaMap.values()].filter(d => d.delta_status === 'dropped' && !currentKeys.has([d.col_a, d.col_b, d.metric].sort().join('|')));
        if (!dropped.length) return null;
        return (
          <div className="card" style={{ borderLeft: '3px solid var(--red)', marginTop: 0, paddingTop: 8, paddingBottom: 8 }}>
            <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--red)' }}>
              ⚠ {dropped.length} pattern{dropped.length > 1 ? 's' : ''} dropped since last run
            </p>
            {dropped.map((d, i) => (
              <p key={i} className="muted" style={{ margin: '2px 0', fontSize: 11 }}>
                <code>{d.col_a}</code> × <code>{d.col_b}</code>{' '}
                <span style={{ opacity: 0.7 }}>({METRIC_LABELS[d.metric] || d.metric}, was {(d.strength * 100).toFixed(0)}%)</span>
              </p>
            ))}
          </div>
        );
      })()}

      {/* Sample modal / inline panel */}
      {sample.kind !== 'idle' && (
        <PatternSamplePanel sample={sample} onClose={closeSample} />
      )}
    </>
  );
}

function PatternSamplePanel({
  sample,
  onClose,
}: {
  sample: PatternSampleState;
  onClose: () => void;
}) {
  if (sample.kind === 'loading') {
    return (
      <div className="card" style={{ borderLeft: '3px solid var(--blue, #4c6ef5)' }}>
        <p className="muted">Loading sample rows…</p>
      </div>
    );
  }
  if (sample.kind === 'error') {
    return (
      <div className="card" style={{ borderLeft: '3px solid var(--red)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="err">{sample.message}</span>
          <button className="btn sec sm" onClick={onClose} style={{ fontSize: 11 }}>✕</button>
        </div>
      </div>
    );
  }
  if (sample.kind === 'loaded') {
    const { rows, pattern, maskedCols } = sample;
    const cols = rows.length ? Object.keys(rows[0]!) : [];
    const highlightCols = new Set([pattern.col_a, pattern.col_b]);

    return (
      <div className="card" style={{ borderLeft: '3px solid var(--blue, #4c6ef5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div>
            <span style={{ fontWeight: 600, fontSize: 13 }}>
              Sample — <code>{pattern.col_a}</code> × <code>{pattern.col_b}</code>
            </span>
            <span className="muted" style={{ marginLeft: 8, fontSize: 11 }}>
              {METRIC_LABELS[pattern.metric] || pattern.metric} · strength{' '}
              {(pattern.strength * 100).toFixed(0)}%
            </span>
            {maskedCols.length > 0 && (
              <span
                className="muted"
                style={{ marginLeft: 8, fontSize: 11, color: 'var(--orange)' }}
                title={`PII columns masked: ${maskedCols.join(', ')}`}
              >
                · {maskedCols.length} PII col{maskedCols.length > 1 ? 's' : ''} masked 🔒
              </span>
            )}
          </div>
          <button className="btn sec sm" onClick={onClose} style={{ fontSize: 11 }}>
            ✕ Close
          </button>
        </div>
        {rows.length === 0 ? (
          <p className="muted">No matching rows found.</p>
        ) : (
          <div className="table-wrap" style={{ maxHeight: 320, fontSize: 12 }}>
            <table>
              <thead>
                <tr>
                  {cols.map((c) => (
                    <th
                      key={c}
                      style={
                        highlightCols.has(c)
                          ? { color: 'var(--blue, #4c6ef5)', background: 'rgba(76,110,245,0.08)' }
                          : undefined
                      }
                    >
                      {c}
                      {highlightCols.has(c) && <span style={{ marginLeft: 3 }}>★</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri}>
                    {cols.map((c) => {
                      const v = row[c];
                      const isMasked = v === '[MASKED]';
                      const isPattern = highlightCols.has(c);
                      return (
                        <td
                          key={c}
                          style={{
                            ...(isPattern ? { background: 'rgba(76,110,245,0.06)' } : {}),
                            ...(isMasked ? { color: 'var(--orange)', fontStyle: 'italic' } : {}),
                          }}
                        >
                          {v == null ? <span className="muted">—</span> : String(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>
          ★ Pattern columns highlighted · {rows.length} rows shown from real data ·{' '}
          {maskedCols.length > 0 ? 'PII masked' : 'no PII columns configured'}
        </p>
      </div>
    );
  }
  return null;
}

function JobReportPage({ jobId }: { jobId: string }) {
  const [data, setData] = useState<ReportPayload | null>(null);
  const [err, setErr] = useState('');
  const [vizTab, setVizTab] = useState<'col-dist' | 'inter-col'>('col-dist');
  const [privacy, setPrivacy] = useState<PrivacyMetrics | null>(null);
  const [keepBusy, setKeepBusy] = useState(false);
  const [dlBusy, setDlBusy] = useState(false);
  const nav = useNavigate();
  const { can } = useAuth();

  useEffect(() => {
    api<ReportPayload>(`/v1/jobs/${jobId}/report`)
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [jobId]);

  async function onKeepTraining() {
    setErr('');
    setKeepBusy(true);
    try {
      const j = await keepTraining(jobId);
      nav(`/jobs/${j.id}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Keep Training failed');
    } finally {
      setKeepBusy(false);
    }
  }

  async function onDownloadCsv() {
    setErr('');
    setDlBusy(true);
    try {
      await downloadSyntheticCsv(jobId);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setDlBusy(false);
    }
  }

  const real = data?.real_data || [];
  const synthAll = data?.synthetic_data || [];
  const types = useMemo(() => inferTypes(real.length ? real : synthAll), [real, synthAll]);

  const synth = useMemo(() => {
    if (synthAll.length <= 500) return synthAll;
    const step = Math.ceil(synthAll.length / 500);
    return synthAll.filter((_, i) => i % step === 0).slice(0, 500);
  }, [synthAll]);

  useEffect(() => {
    if (!data) return;
    let synthForPriv = synthAll;
    if (synthForPriv.length > 800) {
      const step = Math.ceil(synthForPriv.length / 800);
      synthForPriv = synthForPriv.filter((_, i) => i % step === 0).slice(0, 800);
    }
    const t = inferTypes(real.length ? real : synthForPriv);
    setPrivacy(computePrivacyMetrics(real, synthForPriv, t));
  }, [data, real, synthAll]);

  const rep = data?.report;
  const fidelity = rep?.overall_status || '—';
  const privacyStatus =
    (rep?.privacy?.status as string | undefined) ||
    privacy?.status ||
    (privacy ? privacyStatusFromReid(privacy.reidPct) : null);
  const relations = rep?.relations || [];
  const discoveredPatterns = rep?.discovered_patterns || [];
  const cols = synth[0] ? Object.keys(synth[0]) : [];
  const hasApiKey = Boolean(data?.demo?.has_api_key);
  const maxDl = data?.demo?.max_download_rows ?? 150;

  // Privacy Score: prefer backend-computed, fall back to client-computed
  const backendScore = rep?.privacy_score;
  const clientScore =
    privacy?.reidPct != null || privacy?.nndr != null
      ? computePrivacyScore(privacy?.reidPct, privacy?.nndr)
      : null;
  const privacyScore = backendScore ?? clientScore;

  const ic = rep?.internal_consistency;
  const consPct =
    ic?.plausible_pct != null ? `${(ic.plausible_pct * 100).toFixed(0)}%` : '—';
  const nRows = rep?.n_synthetic_rows ?? data?.n_synthetic ?? synthAll.length;
  const sizesReal = data?.table_sizes_real || rep?.table_sizes_real || {};
  const sizesSynth = data?.table_sizes_synth || rep?.table_sizes_synth || {};
  const sizeNames = Array.from(new Set([...Object.keys(sizesReal), ...Object.keys(sizesSynth)]));

  const schemaTables =
    sizeNames.length > 0
      ? Object.fromEntries(
          sizeNames.map((n) => [
            n,
            {
              columns:
                n === (data?.parent_table || rep?.parent_table)
                  ? Object.keys((data?.parent_data || data?.synthetic_data || [])[0] || {})
                  : Object.keys((data?.child_tables || {})[n]?.[0] || {}),
              n_rows: sizesReal[n] ?? sizesSynth[n] ?? 0,
            },
          ]),
        )
      : null;

  if (!data && !err) return <p className="muted">Loading report…</p>;

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 2 }}>
            {data?.name || 'Report'}
          </h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Config <code>{data?.config_hash}</code>
            {rep?.preserve_sizes !== false && sizeNames.length > 0
              ? ' · reconstructed to original row counts'
              : ''}
          </p>
        </div>
        <div className="row">
          <Link className="btn sec sm" to={`/jobs/${jobId}`}>
            Job detail
          </Link>
          {data?.status === 'done' && can('run_jobs') && hasApiKey && (
            <button
              className="btn sm"
              disabled={keepBusy}
              onClick={onKeepTraining}
              title="Continue from this config with a longer train plus 250 more search trials. Stop anytime to keep the best so far."
            >
              {keepBusy ? 'Starting…' : 'Keep Training'}
            </button>
          )}
          {can('download_evidence') && (
            <button className="btn sec sm" disabled={dlBusy} onClick={onDownloadCsv}>
              {downloadButtonLabel(
                dlBusy,
                isMultiTableResult({
                  child_tables: data?.child_tables,
                  table_sizes_synth: sizesSynth,
                }),
                maxDl,
              )}
            </button>
          )}
          {can('download_evidence') && (
            <button
              className="btn sec sm"
              disabled
              title="ZIP evidence pack is locked in the demo"
              style={{ opacity: 0.4 }}
            >
              Evidence ZIP
            </button>
          )}
        </div>
      </div>
      {err && <div className="err">{err}</div>}

      {sizeNames.length > 0 && (
        <div className="card">
          <h3>Table reconstruction (real → synth)</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Table</th>
                  <th>Real rows</th>
                  <th>Synth rows</th>
                  <th>Match</th>
                </tr>
              </thead>
              <tbody>
                {sizeNames.map((n) => {
                  const r = sizesReal[n];
                  const s = sizesSynth[n];
                  const ok = r != null && s != null && r === s;
                  return (
                    <tr key={n}>
                      <td>
                        <code>{n}</code>
                        {n === (data?.parent_table || rep?.parent_table) ? (
                          <span className="muted"> · parent</span>
                        ) : null}
                      </td>
                      <td>{r?.toLocaleString() ?? '—'}</td>
                      <td>{s?.toLocaleString() ?? '—'}</td>
                      <td>
                        <span className={`pill ${ok ? 'PASS' : 'WARN'}`}>
                          {ok ? 'same' : r == null || s == null ? '—' : `${s - r >= 0 ? '+' : ''}${s - r}`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {schemaTables && Object.keys(schemaTables).length > 0 && (
            <div style={{ marginTop: 12 }}>
              <SchemaDiagram
                tables={schemaTables}
                links={data?.links || []}
                parentTable={data?.parent_table || rep?.parent_table}
                config={{
                  ...emptySchemaConfig(),
                  locked_tables: (rep?.locked_tables as string[]) || [],
                  links: data?.links || [],
                  parent_table: data?.parent_table || rep?.parent_table,
                }}
                onChange={() => undefined}
                readOnly
                height={260}
              />
            </div>
          )}
        </div>
      )}

      <div className="results-grid">
        {/* LEFT — summary + KPIs + relations (POC layout) */}
        <div>
          <div className="card">
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Synthesis report</div>
                <div className="muted">
                  {real.length} real · {nRows} synth · {relations.length} relations
                </div>
              </div>
              <div className="badge-stack">
                <StatusBadge label="Fidelity" status={fidelity === '—' ? null : fidelity} />
                <StatusBadge label="Privacy" status={privacyStatus} />
                {privacyScore && (
                  <PrivacyScoreBadge score={privacyScore.score} grade={privacyScore.grade} />
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="kpi-stack">
              <div className="kpi-divider">Fidelity</div>
              <div className="kpi">
                <span className="kpi-label">plausible rows</span>
                <span className="kpi-val">{consPct}</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">synth rows</span>
                <span className="kpi-val">{nRows}</span>
              </div>

              <div className="kpi-divider">Privacy</div>
              {privacyScore && (
                <div
                  className="kpi"
                  title="Composite privacy score (0–100). Weighted blend of re-identification risk and NNDR distance. Higher is better."
                >
                  <span className="kpi-label">privacy score</span>
                  <span
                    className="kpi-val"
                    style={{
                      color:
                        privacyScore.grade === 'A' || privacyScore.grade === 'B'
                          ? 'var(--green)'
                          : privacyScore.grade === 'C'
                            ? 'var(--orange)'
                            : 'var(--red)',
                      fontWeight: 700,
                    }}
                  >
                    {privacyScore.grade} &nbsp;
                    <span style={{ fontWeight: 400, fontSize: 12 }}>({privacyScore.score}/100)</span>
                  </span>
                </div>
              )}
              <div className="kpi" title="Re-ID risk: synthetic rows near any real row. Lower is better.">
                <span className="kpi-label">re-id risk</span>
                <span className="kpi-val">
                  {privacy?.reidPct != null ? `${privacy.reidPct}%` : privacy?.reason === 'no_numeric_qi' ? 'n/a' : '…'}
                </span>
              </div>
              <div className="kpi" title="Plausible rows in the ε–δ band. Higher is better.">
                <span className="kpi-label">plausible rows</span>
                <span className="kpi-val">
                  {privacy?.plausiblePct != null ? `${privacy.plausiblePct}%` : '—'}
                </span>
              </div>
              <div className="kpi" title="NNDR: median synth→real / median real→real. >1 suggests good privacy.">
                <span className="kpi-label">privacy distance (NNDR)</span>
                <span className="kpi-val">{privacy?.nndr ?? '—'}</span>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <button
                className="btn"
                style={{ width: '100%' }}
                disabled={dlBusy || !synthAll.length}
                onClick={onDownloadCsv}
              >
                {dlBusy ? 'Downloading…' : isMultiTableResult({
                  child_tables: data?.child_tables,
                  table_sizes_synth: sizesSynth,
                })
                  ? `↓ Download tables (ZIP, max ${maxDl}/table)`
                  : `↓ Download CSV (max ${maxDl} rows)`}
              </button>
              <button
                className="btn sec"
                style={{ width: '100%', marginTop: 8, opacity: 0.4 }}
                disabled
                title="ZIP and other formats are locked in the demo"
              >
                Evidence ZIP (locked)
              </button>
              <p className="muted" style={{ fontSize: 11, marginTop: 8, marginBottom: 0 }}>
                Demo downloads are capped at {maxDl} synthetic rows per table. Relational jobs
                come as a ZIP with one CSV per table.
              </p>
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Relations Preserved</h3>
              <span className={`pill ${fidelity}`}>{fidelity}</span>
            </div>
            <div className="table-wrap" style={{ maxHeight: 420 }}>
              <table>
                <thead>
                  <tr>
                    <th>Relation</th>
                    <th title="Real value">Real</th>
                    <th title="Synthetic value">Synth</th>
                    <th title="Delta / distance">Δ</th>
                    <th>Scale</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {relations.map((r, i) => {
                    const realV = r.real_value ?? r.real_rho ?? null;
                    const synthV = r.synth_value ?? r.synth_rho ?? null;
                    const val = r.value;
                    const thr = r.threshold || 0.1;
                    const scale = val != null ? val / thr : null;
                    const barPct = scale == null ? 0 : Math.min(scale, 1) * 100;
                    const barCol = scale != null && scale > 1 ? 'var(--red)' : 'var(--green)';
                    const colsLabel = relColumns(r).join(' · ');
                    return (
                      <tr key={i}>
                        <td>
                          <code>{r.metric}</code>
                          <br />
                          <span className="muted">{colsLabel}</span>
                          {r.status === 'SKIP' && r.reason && (
                            <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>
                              {String(r.reason).replace(/_/g, ' ')}
                            </div>
                          )}
                        </td>
                        <td>{realV != null ? fmt3(realV) : <span className="muted">—</span>}</td>
                        <td>{synthV != null ? fmt3(synthV) : <span className="muted">—</span>}</td>
                        <td>{val != null ? fmt4(val) : <span className="muted">—</span>}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <span className="scale-bar">
                            <span style={{ width: `${barPct}%`, background: barCol }} />
                          </span>
                          <span className="muted"> {scale != null ? `${scale.toFixed(2)}×` : ''}</span>
                        </td>
                        <td>
                          <span className={`pill ${r.status || 'SKIP'}`}>{r.status || '—'}</span>
                          {r.status === 'WARN' && (
                            <span style={{ color: 'var(--orange)', fontSize: 10, marginLeft: 4 }}>⚠</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!relations.length && (
                    <tr>
                      <td colSpan={6} className="muted">
                        No relations in report.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {discoveredPatterns.length > 0 && (
            <PatternLibraryCard
              patterns={discoveredPatterns}
              jobId={jobId}
              hasRealData={real.length > 0}
            />
          )}
        </div>

        {/* RIGHT — visualizations (POC tabs) */}
        <div>
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>
              Data Visualizations{' '}
              <span className="muted" style={{ fontWeight: 400, marginLeft: 8 }}>
                real <span style={{ color: '#4c6ef5' }}>■</span> synthetic{' '}
                <span style={{ color: '#1f9d55' }}>■</span>
              </span>
            </h3>
            <div className="viz-tabs">
              <button
                type="button"
                className={`viz-tab${vizTab === 'col-dist' ? ' active' : ''}`}
                onClick={() => setVizTab('col-dist')}
              >
                Column Distributions
              </button>
              <button
                type="button"
                className={`viz-tab${vizTab === 'inter-col' ? ' active' : ''}`}
                onClick={() => setVizTab('inter-col')}
              >
                Relation Visualizations
              </button>
            </div>

            {vizTab === 'col-dist' && (
              <ColDistPanel real={real} synth={synth} cols={cols} types={types} />
            )}
            {vizTab === 'inter-col' && (
              <InterColPanel real={real} synth={synth} relations={relations} types={types} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ColDistPanel({
  real,
  synth,
  cols,
  types,
}: {
  real: Record<string, unknown>[];
  synth: Record<string, unknown>[];
  cols: string[];
  types: Record<string, 'num' | 'cat'>;
}) {
  const nReal = real.length || 1;
  if (!synth.length) return <p className="muted">No synthetic data.</p>;

  return (
    <div>
      <div className="eda-section">
        <h4>Fill rate — real vs synthetic</h4>
        <div className="eda-cols">
          {cols.map((col) => {
            const rF = real.length
              ? real.filter((r) => r[col] != null && r[col] !== '').length / nReal
              : 0;
            const sF = synth.filter((r) => r[col] != null && r[col] !== '').length / synth.length;
            return (
              <div className="col-card" key={col}>
                <div className="col-title">
                  {col}
                  {rF < 1 && (
                    <span style={{ color: 'var(--orange)', fontSize: 10 }}>
                      {' '}
                      ·{Math.round((1 - rF) * 100)}% NaN
                    </span>
                  )}
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 10 }}>
                  Real <span style={{ color: '#4c6ef5' }}>{(rF * 100).toFixed(0)}%</span>
                </div>
                <div className="fill-bar">
                  <div className="fill-real" style={{ width: `${(rF * 100).toFixed(0)}%` }} />
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 10 }}>
                  Synth <span style={{ color: '#1f9d55' }}>{(sF * 100).toFixed(0)}%</span>
                </div>
                <div className="fill-bar">
                  <div className="fill-synth" style={{ width: `${(sF * 100).toFixed(0)}%` }} />
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 10, marginTop: 3 }}>
                  {types[col] === 'num' ? 'numeric' : 'categorical'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="eda-section">
        <h4>Column distributions</h4>
        <div className="chart-grid">
          {cols.map((col) => (
            <ColChart key={col} col={col} real={real} synth={synth} type={types[col] || 'cat'} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ColChart({
  col,
  real,
  synth,
  type,
}: {
  col: string;
  real: Record<string, unknown>[];
  synth: Record<string, unknown>[];
  type: 'num' | 'cat';
}) {
  const data = useMemo(() => {
    const rVals = real.map((r) => r[col]).filter((v) => v != null && v !== '');
    const sVals = synth.map((r) => r[col]).filter((v) => v != null && v !== '');
    if (!rVals.length && !sVals.length) return [];
    if (type === 'num') {
      const all = [...rVals, ...sVals].map(Number).filter((v) => !Number.isNaN(v));
      if (!all.length) return [];
      const mn = Math.min(...all);
      const mx = Math.max(...all);
      const nB = 15;
      const step = (mx - mn) / nB || 1;
      const hist = (arr: number[]) => {
        const h = Array(nB).fill(0) as number[];
        arr.forEach((v) => {
          let i = Math.floor((v - mn) / step);
          if (i >= nB) i = nB - 1;
          if (i >= 0) h[i]!++;
        });
        return h.map((c) => c / (arr.length || 1));
      };
      const rH = hist(rVals.map(Number).filter((v) => !Number.isNaN(v)));
      const sH = hist(sVals.map(Number).filter((v) => !Number.isNaN(v)));
      return Array.from({ length: nB }, (_, i) => ({
        label: (mn + i * step).toFixed(1),
        real: rH[i],
        synth: sH[i],
      }));
    }
    const cnt = (arr: unknown[]) => {
      const m: Record<string, number> = {};
      arr.forEach((v) => {
        const k = String(v);
        m[k] = (m[k] || 0) + 1;
      });
      return m;
    };
    const rC = cnt(rVals);
    const sC = cnt(sVals);
    const labels = Object.keys({ ...rC, ...sC }).slice(0, 12);
    return labels.map((l) => ({
      label: l.slice(0, 14),
      real: (rC[l] || 0) / (rVals.length || 1),
      synth: (sC[l] || 0) / (sVals.length || 1),
    }));
  }, [col, real, synth, type]);

  return (
    <div className="chart-wrap">
      <h5>
        {col}{' '}
        <span style={{ color: 'var(--muted)', fontWeight: 400 }}>
          {type === 'num' ? 'numeric' : 'categorical'}
        </span>
      </h5>
      {!data.length ? (
        <div className="muted" style={{ padding: 6 }}>
          No values
        </div>
      ) : (
        <div style={{ width: '100%', height: 160 }}>
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3a" />
              <XAxis dataKey="label" tick={{ fill: '#8a93a3', fontSize: 9 }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#8a93a3', fontSize: 9 }} />
              <Tooltip contentStyle={{ background: '#171a21', border: '1px solid #2a2f3a' }} />
              <Bar dataKey="real" fill="rgba(76,110,245,0.65)" name="Real" />
              <Bar dataKey="synth" fill="rgba(31,157,85,0.65)" name="Synth" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

const KS_MAX_GROUPS = 6;
const KS_BINS = 12;

function toNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function ksGroupKey(row: Record<string, unknown>, grpCols: string[]): string | null {
  const parts: string[] = [];
  for (const c of grpCols) {
    const v = row[c];
    if (v == null || v === '') return null;
    parts.push(String(v));
  }
  return parts.join(' · ');
}

function resolveKsAxes(
  cols: string[],
  types: Record<string, 'num' | 'cat'>,
): { numCol: string; grpCols: string[] } | null {
  if (cols.length < 2) return null;
  const numCol = cols.find((c) => types[c] === 'num') ?? cols[0];
  const grpCols = cols.filter((c) => c !== numCol);
  if (!numCol || !grpCols.length) return null;
  return { numCol, grpCols };
}

function histDensity(vals: number[], mn: number, step: number, nB: number): number[] {
  const h = Array(nB).fill(0) as number[];
  if (!vals.length) return h;
  vals.forEach((v) => {
    let i = Math.floor((v - mn) / step);
    if (i >= nB) i = nB - 1;
    if (i < 0) i = 0;
    h[i]! += 1;
  });
  return h.map((c) => c / vals.length);
}

function meanOf(vals: number[]): number | null {
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function RelMetricCaption({ r }: { r: Rel }) {
  return (
    <div className="muted" style={{ fontSize: 12, padding: '8px 0 0' }}>
      Real {fmt3(r.real_value ?? r.real_rho)} → Synth {fmt3(r.synth_value ?? r.synth_rho)} · Δ{' '}
      {fmt4(r.value)} (threshold {r.threshold ?? '—'})
    </div>
  );
}

/** Per-group histograms of the numeric column — the distributions conditional KS compares. */
function ConditionalKsViz({
  real,
  synth,
  cols,
  types,
  relation,
}: {
  real: Record<string, unknown>[];
  synth: Record<string, unknown>[];
  cols: string[];
  types: Record<string, 'num' | 'cat'>;
  relation: Rel;
}) {
  const viz = useMemo(() => {
    const axes = resolveKsAxes(cols, types);
    if (!axes) return null;
    const { numCol, grpCols } = axes;

    const counts = new Map<string, number>();
    real.forEach((row) => {
      const k = ksGroupKey(row, grpCols);
      if (k == null) return;
      counts.set(k, (counts.get(k) || 0) + 1);
    });
    const groups = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, KS_MAX_GROUPS)
      .map(([k]) => k);
    if (!groups.length) return null;

    const allNums: number[] = [];
    const valsFor = (rows: Record<string, unknown>[], group: string) => {
      const out: number[] = [];
      rows.forEach((row) => {
        if (ksGroupKey(row, grpCols) !== group) return;
        const n = toNum(row[numCol]);
        if (n != null) out.push(n);
      });
      return out;
    };
    groups.forEach((g) => {
      allNums.push(...valsFor(real, g), ...valsFor(synth, g));
    });
    if (!allNums.length) return null;

    const mn = Math.min(...allNums);
    const mx = Math.max(...allNums);
    const nB = KS_BINS;
    const step = (mx - mn) / nB || 1;
    const labels = Array.from({ length: nB }, (_, i) => (mn + i * step).toFixed(1));

    const facets = groups.map((g) => {
      const rVals = valsFor(real, g);
      const sVals = valsFor(synth, g);
      const rH = histDensity(rVals, mn, step, nB);
      const sH = histDensity(sVals, mn, step, nB);
      return {
        key: g,
        nReal: rVals.length,
        nSynth: sVals.length,
        meanReal: meanOf(rVals),
        meanSynth: meanOf(sVals),
        data: labels.map((label, i) => ({ label, real: rH[i], synth: sH[i] })),
      };
    });

    return { numCol, grpCols, facets };
  }, [real, synth, cols, types]);

  if (!viz) {
    return <RelMetricCaption r={relation} />;
  }

  return (
    <>
      <p className="muted" style={{ fontSize: 11, margin: '0 0 8px' }}>
        {viz.numCol} distribution within each {viz.grpCols.join(' × ')}
      </p>
      <div className="ks-facet-grid">
        {viz.facets.map((f) => (
          <div className="ks-facet" key={f.key}>
            <h6>
              {f.key}
              <span className="muted" style={{ fontWeight: 400 }}>
                {' '}
                · n {f.nReal}/{f.nSynth}
                {f.meanReal != null && f.meanSynth != null
                  ? ` · μ ${f.meanReal.toFixed(1)} / ${f.meanSynth.toFixed(1)}`
                  : ''}
              </span>
            </h6>
            <div style={{ width: '100%', height: 130 }}>
              <ResponsiveContainer>
                <BarChart data={f.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3a" />
                  <XAxis dataKey="label" tick={{ fill: '#8a93a3', fontSize: 8 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: '#8a93a3', fontSize: 8 }} />
                  <Tooltip contentStyle={{ background: '#171a21', border: '1px solid #2a2f3a' }} />
                  <Bar dataKey="real" fill="rgba(76,110,245,0.65)" name="Real" />
                  <Bar dataKey="synth" fill="rgba(31,157,85,0.65)" name="Synth" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
      <RelMetricCaption r={relation} />
    </>
  );
}

function InterColPanel({
  real,
  synth,
  relations,
  types,
}: {
  real: Record<string, unknown>[];
  synth: Record<string, unknown>[];
  relations: Rel[];
  types: Record<string, 'num' | 'cat'>;
}) {
  if (!relations.length) {
    return <p className="muted" style={{ padding: 10 }}>No relations to visualize.</p>;
  }

  function samp<T>(arr: T[], n: number): T[] {
    if (arr.length <= n) return arr;
    const s: T[] = [];
    const step = arr.length / n;
    for (let i = 0; i < n; i++) s.push(arr[Math.floor(i * step)]!);
    return s;
  }

  return (
    <div className="chart-grid">
      {relations.map((r, idx) => {
        const metric = r.metric || '';
        const colsR = relColumns(r);
        const statusColor =
          ({ PASS: '#1f9d55', WARN: '#a8aa28', FAIL: '#cc1f36' } as Record<string, string>)[
            r.status || ''
          ] || '#8a8f98';

        if (metric === 'spearman' || metric === 'partial_spearman') {
          const ca = colsR[0];
          const cb = colsR[1];
          if (!ca || !cb) return null;
          const rPts = samp(
            real.filter((row) => row[ca] != null && row[cb] != null),
            120,
          ).map((row) => ({ x: Number(row[ca]), y: Number(row[cb]) }));
          const sPts = samp(
            synth.filter((row) => row[ca] != null && row[cb] != null),
            120,
          ).map((row) => ({ x: Number(row[ca]), y: Number(row[cb]) }));
          return (
            <div className="chart-wrap" key={idx}>
              <h5>
                {colsR.join(' · ')}{' '}
                <span style={{ color: statusColor }}>{r.status || ''}</span>{' '}
                <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· {metric}</span>
              </h5>
              <div style={{ width: '100%', height: 180 }}>
                <ResponsiveContainer>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3a" />
                    <XAxis type="number" dataKey="x" name={ca} tick={{ fill: '#8a93a3', fontSize: 9 }} />
                    <YAxis type="number" dataKey="y" name={cb} tick={{ fill: '#8a93a3', fontSize: 9 }} />
                    <ZAxis range={[40, 40]} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ background: '#171a21', border: '1px solid #2a2f3a' }} />
                    <Scatter name="Real" data={rPts} fill="rgba(76,110,245,0.4)" />
                    <Scatter name="Synth" data={sPts} fill="rgba(31,157,85,0.4)" />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        }

        if (metric === 'conditional_ks' || metric === 'conditional_ks_2cat') {
          return (
            <div className="chart-wrap relation-ks" key={idx}>
              <h5>
                {colsR.join(' · ')}{' '}
                <span style={{ color: statusColor }}>{r.status || ''}</span>{' '}
                <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· {metric}</span>
              </h5>
              <ConditionalKsViz
                real={real}
                synth={synth}
                cols={colsR}
                types={types}
                relation={r}
              />
            </div>
          );
        }

        if (metric === 'chi2' || metric === 'conditional_chi2_2cat') {
          const ca = colsR[0];
          const cb = colsR[1];
          if (!ca || !cb) return null;
          const cnt = (arr: Record<string, unknown>[], a: string, b: string) => {
            const m: Record<string, number> = {};
            arr.forEach((row) => {
              const k = `${row[a]}|${row[b]}`;
              m[k] = (m[k] || 0) + 1;
            });
            return m;
          };
          const rC = cnt(real, ca, cb);
          const sC = cnt(synth, ca, cb);
          const labels = Object.keys({ ...rC, ...sC }).slice(0, 10);
          const data = labels.map((l) => ({
            label: l.slice(0, 16),
            real: (rC[l] || 0) / (real.length || 1),
            synth: (sC[l] || 0) / (synth.length || 1),
          }));
          return (
            <div className="chart-wrap" key={idx}>
              <h5>
                {colsR.join(' · ')}{' '}
                <span style={{ color: statusColor }}>{r.status || ''}</span>{' '}
                <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· {metric}</span>
              </h5>
              <div style={{ width: '100%', height: 180 }}>
                <ResponsiveContainer>
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3a" />
                    <XAxis dataKey="label" tick={{ fill: '#8a93a3', fontSize: 9 }} />
                    <YAxis tick={{ fill: '#8a93a3', fontSize: 9 }} />
                    <Tooltip contentStyle={{ background: '#171a21', border: '1px solid #2a2f3a' }} />
                    <Bar dataKey="real" fill="rgba(76,110,245,0.65)" />
                    <Bar dataKey="synth" fill="rgba(31,157,85,0.65)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        }

        // Fallback: show metric summary for other relation types
        return (
          <div className="chart-wrap" key={idx}>
            <h5>
              {colsR.join(' · ') || r.metric}{' '}
              <span style={{ color: statusColor }}>{r.status || ''}</span>{' '}
              <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· {metric}</span>
            </h5>
            <RelMetricCaption r={r} />
          </div>
        );
      })}
    </div>
  );
}
