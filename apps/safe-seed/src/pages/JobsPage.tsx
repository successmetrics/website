import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { SchemaDiagram } from '../components/SchemaDiagram';
import { PresetPicker, type PresetInfo } from '../components/PresetPicker';
import { api, ApiError, cancelJob, deleteJob } from '../lib/api';
import { jobStepLabel } from '../lib/jobProgress';
import { useAuth } from '../lib/auth';
import {
  autoDetectParentPii,
  emptySchemaConfig,
  nanPolicyFromConfig,
  type SchemaConfig,
} from '../lib/schemaConfig';

type Job = {
  id: string;
  name: string;
  status: string;
  progress: number;
  message: string;
  created_at: number;
};

type Source = { id: string; name: string; kind?: string; tables_summary?: Record<string, { n_rows: number }> };
type Policy = { id: string; name: string };
type Target = { id: string; label: string };

type SchemaPayload = {
  tables: Record<string, { columns: string[]; n_rows: number; records?: Record<string, unknown>[] }>;
  links: Array<{ fromTable: string; fromCol: string; toTable: string; toCol: string }>;
  parent_table?: string | null;
  schema_config?: SchemaConfig;
};

export function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const { can } = useAuth();

  async function refresh() {
    const r = await api<{ jobs: Job[] }>('/v1/jobs');
    setJobs(r.jobs);
    return r.jobs;
  }

  useEffect(() => {
    let alive = true;
    let timer: number | undefined;
    async function tick() {
      try {
        const r = await api<{ jobs: Job[] }>('/v1/jobs');
        if (!alive) return;
        setJobs(r.jobs);
        if (r.jobs.some((j) => j.status === 'queued' || j.status === 'running')) {
          timer = window.setTimeout(tick, 2000);
        }
      } catch (e: unknown) {
        if (alive) setErr(e instanceof Error ? e.message : 'Failed');
      }
    }
    tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  async function onDelete(id: string) {
    if (!can('run_jobs')) return;
    if (!window.confirm('Delete this job? This cannot be undone.')) return;
    setBusyId(id);
    setErr('');
    try {
      await deleteJob(id);
      await refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusyId(null);
    }
  }

  async function onCancel(id: string, status?: string) {
    if (!can('run_jobs')) return;
    const msg = status === 'running'
      ? 'Stop search and keep the best result so far?'
      : 'Cancel this queued job?';
    if (!window.confirm(msg)) return;
    setBusyId(id);
    setErr('');
    try {
      await cancelJob(id);
      await refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1 className="page-title">Seed jobs</h1>
      <p className="page-sub">History of synthesis runs (server-persisted)</p>
      {err && <div className="err">{err}</div>}
      <div className="row" style={{ marginBottom: 14 }}>
        <Link data-tour="new-job-btn" className="btn" to="/jobs/new">
          New job
        </Link>
      </div>
      <div data-tour="jobs-list" className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Step</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td>{j.name}</td>
                  <td>
                    <span className={`pill ${j.status}`}>{j.status}</span>
                  </td>
                  <td>{Math.round((j.progress || 0) * 100)}%</td>
                  <td className="muted">{jobStepLabel(j.status, j.progress, j.message)}</td>
                  <td>
                    <Link to={`/jobs/${j.id}`}>Open</Link>
                    {j.status === 'done' && (
                      <>
                        {' · '}
                        <Link to={`/jobs/${j.id}/report`}>Report</Link>
                      </>
                    )}
                    {can('run_jobs') && (j.status === 'queued' || j.status === 'running') && (
                      <>
                        {' · '}
                        <button
                          className="btn sec sm"
                          type="button"
                          disabled={busyId === j.id}
                          onClick={() => void onCancel(j.id, j.status)}
                        >
                          {j.status === 'running' ? 'Stop search' : 'Cancel'}
                        </button>
                      </>
                    )}
                    {can('run_jobs') && (
                      <>
                        {' · '}
                        <button
                          className="btn sec sm"
                          type="button"
                          disabled={busyId === j.id}
                          onClick={() => void onDelete(j.id)}
                          style={{ color: '#f87171', borderColor: '#f8717144' }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {!jobs.length && (
                <tr>
                  <td colSpan={5} className="muted">
                    No jobs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

type DiscRel = {
  col_a: string;
  col_b: string;
  metric: string;
  strength: number;
  table?: string;
  table_rows?: number;
};

function relKey(r: DiscRel): string {
  return `${r.table || ''}::${r.col_a}::${r.col_b}::${r.metric}`;
}

function isJunkRelationColumn(name: string): boolean {
  const cl = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (/_mode$/.test(cl)) return true;
  if (/(description|desc|free_?text|notes?|comment)$/.test(cl)) return true;
  if (
    ['code', 'codes', 'snomed', 'icd', 'icd9', 'icd10', 'icd_10', 'loinc', 'rxnorm', 'ndc', 'cpt', 'hcpcs'].includes(
      cl,
    )
  ) {
    return true;
  }
  if (/_codes?$/.test(cl)) return true;
  return false;
}

function isUsableDiscRel(r: DiscRel): boolean {
  return !isJunkRelationColumn(r.col_a) && !isJunkRelationColumn(r.col_b);
}

function toJobRelation(d: DiscRel) {
  if (d.metric === 'conditional_ks') {
    return {
      groupby: d.col_b,
      col: d.col_a,
      metric: d.metric,
      threshold: 0.15,
    };
  }
  return {
    col_a: d.col_a,
    col_b: d.col_b,
    metric: d.metric,
    threshold: 0.1,
  };
}

const STEPS = ['Source', 'Policy', 'Relations', 'Volume', 'Target', 'Review'];
/** Demo no-train path is reliable at or below this auto-discover count. */
const DEMO_SUGGESTED_MAX_RELATIONS = 12;

export function JobNewPage() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { can } = useAuth();
  const [step, setStep] = useState(0);
  const [sources, setSources] = useState<Source[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [sourceId, setSourceId] = useState(params.get('source') || '');
  const [schema, setSchema] = useState<SchemaPayload | null>(null);
  const [schemaConfig, setSchemaConfig] = useState<SchemaConfig>(emptySchemaConfig());
  const [policyId, setPolicyId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [csv, setCsv] = useState('');
  const [name, setName] = useState('Seed run');
  const [matchSourceRows, setMatchSourceRows] = useState(true);
  const [nRows, setNRows] = useState(500);
  const [adapt, setAdapt] = useState(true);
  /** Keep as string so clearing/editing the number input doesn't coerce to 0/NaN mid-type. */
  const [nDiscoverInput, setNDiscoverInput] = useState('8');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(true);
  const [discBusy, setDiscBusy] = useState(false);
  const [presetBusy, setPresetBusy] = useState(false);
  const [presetId, setPresetId] = useState('');
  const [selectedRelKeys, setSelectedRelKeys] = useState<string[]>([]);
  const [discPreview, setDiscPreview] = useState<{
    discovered: DiscRel[];
    pool?: DiscRel[];
    numeric_columns: string[];
    categorical_columns: string[];
    excluded_columns: string[];
    n_rows: number;
    frame: string;
    top_k?: number;
    table_sizes?: Record<string, number>;
    eligible_tables?: string[];
    hint?: string | null;
  } | null>(null);

  function parseDiscoverCount(): number {
    const n = parseInt(nDiscoverInput.trim(), 10);
    if (!Number.isFinite(n) || n < 1) return 8;
    return Math.min(50, n);
  }

  const typedDiscoverCount = parseInt(nDiscoverInput.trim(), 10);
  const showDemoDiscoverWarn =
    Number.isFinite(typedDiscoverCount) && typedDiscoverCount > DEMO_SUGGESTED_MAX_RELATIONS;

  useEffect(() => {
    Promise.all([
      api<{ sources: Source[] }>('/v1/sources'),
      api<{ policies: Policy[] }>('/v1/policies'),
      api<{ targets: Target[] }>('/v1/targets'),
      api<{ counts: { has_api_key?: boolean }; demo?: { has_api_key?: boolean } }>('/v1/dashboard'),
    ])
      .then(([s, p, t, d]) => {
        setSources(s.sources);
        setPolicies(p.policies);
        setTargets(t.targets);
        const key = Boolean(d.demo?.has_api_key ?? d.counts?.has_api_key);
        setHasApiKey(key);
        if (!key) setAdapt(false);
      })
      .catch((e) => setErr(e.message));
  }, []);

  useEffect(() => {
    if (!sourceId) {
      setSchema(null);
      setSchemaConfig(emptySchemaConfig());
      setDiscPreview(null);
      setSelectedRelKeys([]);
      return;
    }
    setDiscPreview(null);
    setSelectedRelKeys([]);
    api<SchemaPayload>(`/v1/sources/${sourceId}/schema`)
      .then((sch) => {
        setSchema(sch);
        const cfg = { ...emptySchemaConfig(), ...(sch.schema_config || {}) };
        if (!cfg.pii_columns?.length && sch.parent_table) {
          cfg.pii_columns = autoDetectParentPii(sch.parent_table, sch.tables);
        }
        if (!cfg.parent_table) cfg.parent_table = sch.parent_table;
        if (!cfg.links?.length) cfg.links = sch.links;
        setSchemaConfig(cfg);
      })
      .catch(() => setSchema(null));
  }, [sourceId]);

  async function loadBuiltInPreset(testId: string, preset?: PresetInfo) {
    if (!testId || !can('edit_sources')) return;
    setPresetBusy(true);
    setErr('');
    try {
      const src = await api<Source>('/v1/sources/from-preset', {
        method: 'POST',
        json: { test_id: testId },
      });
      setSources((prev) => [src, ...prev.filter((s) => s.id !== src.id)]);
      setSourceId(src.id);
      setCsv('');
      if (preset?.label) setName(preset.label);
      else if (src.name) setName(src.name);
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Failed to load preset');
    } finally {
      setPresetBusy(false);
    }
  }

  async function onSchemaChange(next: SchemaConfig) {
    setSchemaConfig(next);
    if (!sourceId) return;
    try {
      await api(`/v1/sources/${sourceId}/schema-config`, { method: 'PUT', json: next });
    } catch {
      /* keep local */
    }
  }

  const sourceRowHint = schema
    ? Object.entries(schema.tables)
        .map(([n, t]) => `${n}: ${t.n_rows.toLocaleString()}`)
        .join(' · ')
    : '';

  async function previewDiscover(topK = parseDiscoverCount()) {
    if (!sourceId) {
      setDiscPreview(null);
      setSelectedRelKeys([]);
      return;
    }
    setDiscBusy(true);
    setErr('');
    try {
      const res = await api<NonNullable<typeof discPreview>>(`/v1/sources/${sourceId}/discover-relations`, {
        method: 'POST',
        json: { top_k: topK, n_discover: topK },
      });
      const pool = res.pool?.length ? res.pool : res.discovered || [];
      const usable = pool.filter(isUsableDiscRel);
      setDiscPreview({ ...res, pool: usable, discovered: usable });
      const initial = usable.slice(0, topK);
      setSelectedRelKeys(initial.map(relKey));
    } catch (ex: unknown) {
      setDiscPreview(null);
      setSelectedRelKeys([]);
      if (ex instanceof ApiError && ex.status === 404) {
        setErr(
          'Discovery endpoint missing on this API (HF Space may be behind). Redeploy the Space, or run a local API with the latest code.',
        );
      } else {
        setErr(ex instanceof Error ? ex.message : 'Discovery failed');
      }
    } finally {
      setDiscBusy(false);
    }
  }

  function discPool(): DiscRel[] {
    if (!discPreview) return [];
    const pool = discPreview.pool?.length ? discPreview.pool : discPreview.discovered;
    return pool.filter(isUsableDiscRel);
  }

  function toggleRel(key: string) {
    setSelectedRelKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  function replaceRel(key: string) {
    const unused = discPool().filter((r) => !selectedRelKeys.includes(relKey(r)));
    const next = unused[0];
    if (!next) {
      setSelectedRelKeys((prev) => prev.filter((k) => k !== key));
      return;
    }
    setSelectedRelKeys((prev) => prev.map((k) => (k === key ? relKey(next) : k)));
  }

  useEffect(() => {
    if (!sourceId) return;
    void previewDiscover();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId]);

  async function run() {
    if (!can('run_jobs')) return;
    setBusy(true);
    setErr('');
    try {
      let relations: ReturnType<typeof toJobRelation>[] | undefined;
      if (sourceId && discPreview) {
        const pool = discPreview.pool?.length ? discPreview.pool : discPreview.discovered;
        const byKey = new Map(pool.map((r) => [relKey(r), r]));
        relations = selectedRelKeys
          .map((k) => byKey.get(k))
          .filter((r): r is DiscRel => Boolean(r) && isUsableDiscRel(r))
          .map(toJobRelation);
      }
      const body: Record<string, unknown> = {
        name,
        adapt: hasApiKey ? adapt : false,
        adapt_budget: hasApiKey && adapt ? 200 : undefined,
        n_discover: parseDiscoverCount(),
        return_data: true,
        match_source_rows: matchSourceRows,
      };
      if (!matchSourceRows) body.n_rows = nRows;
      if (sourceId) body.source_id = sourceId;
      else if (csv) {
        if (!hasApiKey) throw new Error('Without an API key, paste CSV is locked — pick a preset source.');
        body.csv = csv;
      } else throw new Error('Pick a source or paste CSV');
      if (policyId) body.policy_id = policyId;
      if (targetId) body.target_id = targetId;
      if (sourceId && discPreview && relations && relations.length > 0) body.relations = relations;
      if (schemaConfig.locked_tables?.length) body.locked_tables = schemaConfig.locked_tables;
      if (schemaConfig.pii_columns?.length) body.pii_columns = schemaConfig.pii_columns;
      const np = nanPolicyFromConfig(schemaConfig.nan_columns || []);
      if (Object.keys(np).length) body.nan_policy = np;
      const job = await api<Job>('/v1/jobs', { method: 'POST', json: body });
      nav(`/jobs/${job.id}`);
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Failed to start job');
    } finally {
      setBusy(false);
    }
  }

  const visibleSources = hasApiKey ? sources : sources.filter((s) => s.kind === 'preset');
  const selected = sources.find((s) => s.id === sourceId);
  const selectedBlocked = Boolean(sourceId && !hasApiKey && selected && selected.kind !== 'preset');

  return (
    <div>
      <h1 className="page-title">New seed job</h1>
      <p className="page-sub">Guided synthesize → evidence workflow</p>
      {err && <div className="err">{err}</div>}
      {!hasApiKey && (
        <div className="card" style={{ marginBottom: 12, borderLeft: '3px solid var(--accent, #4f46e5)' }}>
          <strong>Demo without API key</strong>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            Only built-in preset sources are available. ML / adapt training is locked.
            Request a key in <Link to="/settings">Settings</Link> for CSV, databases, and training.
          </p>
        </div>
      )}
      <div className="steps">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={`step${i === step ? ' active' : ''}${i < step ? ' done' : ''}`}
            onClick={() => setStep(i)}
            style={{ cursor: 'pointer' }}
          >
            {i + 1}. {s}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="card">
          <h3>Choose source</h3>
          {can('edit_sources') && (
            <>
              <PresetPicker
                value={presetId}
                emptyLabel="— load a built-in preset —"
                onChange={(id, preset) => {
                  setPresetId(id);
                  if (id) void loadBuiltInPreset(id, preset);
                }}
                disabled={busy || presetBusy}
              />
              {presetBusy && <p className="muted">Loading preset into your workspace…</p>}
            </>
          )}
          <label>Saved source</label>
          <select
            value={sourceId}
            onChange={(e) => {
              setSourceId(e.target.value);
              if (e.target.value) setCsv('');
            }}
          >
            <option value="">{hasApiKey ? '— paste CSV instead —' : '— select a preset —'}</option>
            {visibleSources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.kind === 'preset' ? ' (preset)' : ''}
              </option>
            ))}
          </select>
          {selectedBlocked && (
            <p className="err" style={{ marginTop: 8 }}>
              This source requires an API key. Pick a preset or request a key in Settings.
            </p>
          )}
          {!sourceId && hasApiKey && (
            <>
              <label>CSV</label>
              <textarea value={csv} onChange={(e) => setCsv(e.target.value)} />
            </>
          )}
          {!sourceId && !hasApiKey && (
            <p className="muted" style={{ marginTop: 8 }}>
              CSV paste is locked without an API key.
            </p>
          )}
          <label>Job name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />

          {schema && Object.keys(schema.tables).length > 0 && (
            <div style={{ marginTop: 14 }}>
              <h3 style={{ marginBottom: 8 }}>
                Input schema{' '}
                <span className="muted" style={{ fontWeight: 400 }}>
                  {schemaConfig.locked_tables.length} locked · {schemaConfig.pii_columns.length} PII ·{' '}
                  {schemaConfig.nan_columns.length} NaN
                </span>
              </h3>
              <SchemaDiagram
                tables={schema.tables}
                links={schema.links}
                parentTable={schema.parent_table}
                config={schemaConfig}
                onChange={onSchemaChange}
                height={Math.min(480, 140 + Object.keys(schema.tables).length * 90)}
              />
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="card">
          <h3>Confirm policy</h3>
          <label>Field policy (optional)</label>
          <select value={policyId} onChange={(e) => setPolicyId(e.target.value)}>
            <option value="">None</option>
            {policies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <h3>Relations</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Statistical relations preserved during synthesis — separate from schema FK links on
            the Source step. Uncheck to drop a pair; Replace swaps it for the next unused
            candidate. Leave it unchecked if you do not want a replacement.
          </p>
          <label>Max relations (1–50)</label>
          <div className="row" style={{ marginTop: 4 }}>
            <input
              type="number"
              min={1}
              max={50}
              step={1}
              value={nDiscoverInput}
              onChange={(e) => setNDiscoverInput(e.target.value)}
              onBlur={() => setNDiscoverInput(String(parseDiscoverCount()))}
              style={{ maxWidth: 120 }}
            />
            <button
              className="btn sm"
              type="button"
              disabled={!sourceId || discBusy}
              onClick={() => {
                const n = parseDiscoverCount();
                setNDiscoverInput(String(n));
                void previewDiscover(n);
              }}
            >
              {discBusy ? 'Discovering…' : 'Auto-discover'}
            </button>
          </div>
          {showDemoDiscoverWarn && (
            <div className="warn" role="status">
              We suggest 12 or fewer auto-discovered relations for the demo version
              to return successfully without full ML training.
            </div>
          )}
          {discPreview && !discBusy && selectedRelKeys.length < parseDiscoverCount() && (
            <div className="warn" role="status">
              {discPreview.hint
                || `Auto-discovery found ${selectedRelKeys.length} relations, fewer than the ${parseDiscoverCount()} requested. Independent-pair limits skip Spearman triangles, IDs, codes, free-text labels, and child-table columns that are not on the synthesized parent frame. The job will run with the relations that were found.`}
            </div>
          )}
          {!sourceId && (
            <p className="muted" style={{ marginTop: 8 }}>
              Pick a saved source to auto-discover relations. CSV paste discovers at job runtime.
            </p>
          )}
          {sourceId && discBusy && !discPreview && <p className="muted">Discovering relations…</p>}
          {discPreview && (
            <div style={{ marginTop: 14 }}>
              <p className="muted" style={{ marginBottom: 8 }}>
                {selectedRelKeys.length} selected of {discPool().length} candidates · {discPreview.frame}
              </p>
              {discPreview.table_sizes && (
                <p className="muted" style={{ marginBottom: 8 }}>
                  Table sizes:{' '}
                  {Object.entries(discPreview.table_sizes)
                    .sort((a, b) => b[1] - a[1])
                    .map(([n, c]) => `${n}=${c}`)
                    .join(' · ')}
                </p>
              )}
              {discPreview.hint && discPool().length === 0 && (
                <div className="err">{discPreview.hint}</div>
              )}
              {discPool().length > 0 ? (
                <DiscRelTable
                  pool={discPool()}
                  selectedKeys={selectedRelKeys}
                  onToggle={toggleRel}
                  onReplace={replaceRel}
                />
              ) : (
                !discPreview.hint && <p className="muted">No relations found.</p>
              )}
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <h3>Volume & model</h3>
          <label className="row">
            <input
              type="checkbox"
              checked={matchSourceRows}
              onChange={(e) => setMatchSourceRows(e.target.checked)}
              style={{ width: 'auto' }}
            />
            Match original dataset row counts (recommended)
          </label>
          <p className="muted" style={{ marginTop: 4 }}>
            Same as the POC relational path: omit scaling so each reconstructed table keeps its
            source size
            {sourceRowHint ? ` (${sourceRowHint})` : ''}.
          </p>
          {!matchSourceRows && (
            <div className="grid-2" style={{ marginTop: 8 }}>
              <div>
                <label>Target parent rows</label>
                <input
                  type="number"
                  value={nRows}
                  onChange={(e) => setNRows(Number(e.target.value))}
                />
              </div>
            </div>
          )}
          <label
            className="row"
            style={{
              marginTop: 10,
              opacity: hasApiKey ? 1 : 0.45,
              pointerEvents: hasApiKey ? 'auto' : 'none',
            }}
            title={hasApiKey ? undefined : 'Requires an API key'}
          >
            <input
              type="checkbox"
              checked={hasApiKey && adapt}
              disabled={!hasApiKey}
              onChange={(e) => setAdapt(e.target.checked)}
              style={{ width: 'auto' }}
            />
            Adapt / hyperparam search
            {!hasApiKey && <span className="muted" style={{ marginLeft: 8 }}>(API key required)</span>}
          </label>
          {hasApiKey && adapt && (
            <p className="muted" style={{ marginTop: 4 }}>
              This first job runs up to 200 architecture + hyperparameter trials
              (stops early after two pass+pass results once 40 trials have run).
              Ranking prefers more passing relations. Click Stop search anytime
              to keep the best so far. Keep Training is optional extra search
              from this result, not required.
            </p>
          )}
        </div>
      )}

      {step === 4 && (
        <div className="card">
          <h3>Target</h3>
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
            <option value="">Download only</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {step === 5 && (
        <div className="card">
          <h3>Review</h3>
          <ul className="muted">
            <li>Source: {sourceId || (csv ? 'inline CSV' : '—')}</li>
            <li>Policy: {policyId || 'none'}</li>
            <li>
              Rows:{' '}
              {matchSourceRows
                ? 'match source (per-table reconstruction)'
                : `scale parent to ${nRows}`}
            </li>
            <li>Target: {targetId || 'download only'}</li>
            <li>
              Relations:{' '}
              {sourceId && discPreview
                ? `${selectedRelKeys.length} selected`
                : 'auto-discover at runtime'}
            </li>
            <li>
              Search:{' '}
              {hasApiKey && adapt
                ? 'focused hyperparam search on this first job (20–40 min on hard cases)'
                : 'single template run'}
            </li>
          </ul>
          <button className="btn" disabled={busy} onClick={run}>
            {busy ? 'Starting…' : 'Run seed job'}
          </button>
        </div>
      )}

      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn sec" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          Back
        </button>
        {step < STEPS.length - 1 && (
          <button className="btn" onClick={() => setStep((s) => s + 1)}>
            Next
          </button>
        )}
      </div>
    </div>
  );
}

function DiscRelTable({
  pool,
  selectedKeys,
  onToggle,
  onReplace,
}: {
  pool: DiscRel[];
  selectedKeys: string[];
  onToggle: (key: string) => void;
  onReplace: (key: string) => void;
}) {
  const selectedSet = new Set(selectedKeys);
  const selected = pool.filter((r) => selectedSet.has(relKey(r)));
  const unused = pool.filter((r) => !selectedSet.has(relKey(r)));
  const rows = [...selected, ...unused];

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th style={{ width: 36 }}></th>
            <th>Table</th>
            <th>Columns</th>
            <th>Metric</th>
            <th>Strength</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const key = relKey(r);
            const on = selectedSet.has(key);
            return (
              <tr key={`${key}-${i}`} style={on ? undefined : { opacity: 0.55 }}>
                <td>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => onToggle(key)}
                    style={{ width: 'auto' }}
                    title={on ? 'Drop this relation (no replacement)' : 'Include this relation'}
                  />
                </td>
                <td>
                  <code>{r.table || '—'}</code>
                  {r.table_rows != null ? (
                    <span className="muted"> · {r.table_rows}</span>
                  ) : null}
                </td>
                <td>
                  <code>{r.col_a}</code> × <code>{r.col_b}</code>
                </td>
                <td>{r.metric}</td>
                <td>{r.strength.toFixed(3)}</td>
                <td>
                  {on && (
                    <button
                      type="button"
                      className="btn sec sm"
                      onClick={() => onReplace(key)}
                      title={
                        unused.length
                          ? 'Swap for the next unused candidate'
                          : 'No unused candidate — removes this relation'
                      }
                    >
                      {unused.length ? 'Replace' : 'Remove'}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
