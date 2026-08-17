import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SchemaDiagram } from '../components/SchemaDiagram';
import { PresetPicker } from '../components/PresetPicker';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  autoDetectParentPii,
  emptySchemaConfig,
  type SchemaConfig,
} from '../lib/schemaConfig';

type Source = {
  id: string;
  name: string;
  kind: string;
  meta: Record<string, unknown>;
  tables_summary?: Record<string, { n_rows: number; columns: string[] }>;
  tables?: Record<string, { n_rows?: number; columns?: string[]; records?: unknown[] }>;
  updated_at: number;
};

export function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [err, setErr] = useState('');
  const { can } = useAuth();

  useEffect(() => {
    api<{ sources: Source[] }>('/v1/sources')
      .then((r) => setSources(r.sources))
      .catch((e) => setErr(e.message));
  }, []);

  return (
    <div>
      <h1 className="page-title">Sources</h1>
      <p className="page-sub">Upload CSVs, load presets, or connect databases / Salesforce</p>
      {err && <div className="err">{err}</div>}
      {can('edit_sources') && (
        <div className="row" style={{ marginBottom: 14 }}>
          <Link data-tour="add-source-btn" className="btn" to="/sources/new">
            Add source
          </Link>
        </div>
      )}
      <div data-tour="sources-list" className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Kind</th>
                <th>Tables</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.kind}</td>
                  <td>{Object.keys(s.tables_summary || {}).length || '—'}</td>
                  <td>
                    <Link to={`/sources/${s.id}`}>Open</Link>
                  </td>
                </tr>
              ))}
              {!sources.length && (
                <tr>
                  <td colSpan={4} className="muted">
                    No sources yet.
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

export function SourceNewPage() {
  const nav = useNavigate();
  const [name, setName] = useState('My dataset');
  const [csv, setCsv] = useState('');
  const [preset, setPreset] = useState('T64');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // Postgres
  const [dbName, setDbName] = useState('Postgres source');
  const [connStr, setConnStr] = useState('');
  const [useFields, setUseFields] = useState(false);
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState(5432);
  const [database, setDatabase] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [schema, setSchema] = useState('public');
  const [limit, setLimit] = useState(5000);
  const [dbTables, setDbTables] = useState<Array<{ name: string; row_count: number | null }>>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [dbStatus, setDbStatus] = useState('');

  function dbPayload() {
    if (!useFields && connStr.trim()) {
      return {
        connection_string: connStr.trim(),
        schema,
      };
    }
    return {
      host,
      port,
      database,
      username,
      password,
      schema,
    };
  }

  async function createFromCsv(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const src = await api<Source>('/v1/sources/from-csv', {
        method: 'POST',
        json: { name, csv },
      });
      nav(`/sources/${src.id}`);
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function createFromPreset() {
    setBusy(true);
    setErr('');
    try {
      const src = await api<Source>('/v1/sources/from-preset', {
        method: 'POST',
        json: { test_id: preset },
      });
      nav(`/sources/${src.id}`);
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function connectDb() {
    setBusy(true);
    setErr('');
    setDbStatus('Connecting…');
    try {
      const r = await api<{ tables: Array<{ name: string; row_count: number | null }>; schema: string }>(
        '/v1/sources/db/tables',
        { method: 'POST', json: dbPayload() },
      );
      setDbTables(r.tables);
      const sel: Record<string, boolean> = {};
      r.tables.forEach((t) => {
        sel[t.name] = false;
      });
      setSelected(sel);
      setDbStatus(`Connected · ${r.tables.length} table(s) in schema “${r.schema}”`);
    } catch (ex: unknown) {
      setDbTables([]);
      setDbStatus('');
      setErr(ex instanceof Error ? ex.message : 'Connection failed');
    } finally {
      setBusy(false);
    }
  }

  async function createFromDb() {
    const tables = Object.entries(selected)
      .filter(([, on]) => on)
      .map(([n]) => n);
    if (!tables.length) {
      setErr('Select at least one table');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const src = await api<Source>('/v1/sources/from-database', {
        method: 'POST',
        json: {
          ...dbPayload(),
          name: dbName,
          tables,
          limit: limit || null,
        },
      });
      nav(`/sources/${src.id}`);
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Failed to load tables');
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File) {
    const text = await file.text();
    setCsv(text);
    if (!name || name === 'My dataset') setName(file.name.replace(/\.csv$/i, ''));
  }

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <div>
      <h1 className="page-title">Add source</h1>
      <p className="page-sub">Upload CSV, connect PostgreSQL, or load a preset</p>
      {err && <div className="err">{err}</div>}
      <div className="grid-2">
        <form className="card" onSubmit={createFromCsv}>
          <h3>CSV upload</h3>
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
          <label>File</label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          <label>Or paste CSV</label>
          <textarea value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="col1,col2…" />
          <button className="btn" disabled={busy || !csv} style={{ marginTop: 12 }}>
            Create source
          </button>
        </form>
        <div className="card">
          <h3>Preset</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Built-in single-table and multi-table test cases. No API key needed.
          </p>
          <PresetPicker value={preset} onChange={(id) => setPreset(id)} disabled={busy} />
          <button className="btn sec" disabled={busy || !preset} style={{ marginTop: 12 }} onClick={createFromPreset}>
            Load preset
          </button>
        </div>
      </div>

      <div className="card">
        <h3>PostgreSQL</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Use a connection string or discrete host fields, then pick tables to import.
        </p>
        <label>Source name</label>
        <input value={dbName} onChange={(e) => setDbName(e.target.value)} />

        <label className="row" style={{ marginTop: 10 }}>
          <input
            type="checkbox"
            checked={useFields}
            onChange={(e) => setUseFields(e.target.checked)}
            style={{ width: 'auto' }}
          />
          Use host / port / user fields instead of connection string
        </label>

        {!useFields ? (
          <>
            <label>Connection string</label>
            <input
              value={connStr}
              onChange={(e) => setConnStr(e.target.value)}
              placeholder="postgresql://user:password@host:5432/dbname"
              style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12 }}
            />
          </>
        ) : (
          <>
            <div className="grid-2">
              <div>
                <label>Host</label>
                <input value={host} onChange={(e) => setHost(e.target.value)} />
              </div>
              <div>
                <label>Port</label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value))}
                />
              </div>
            </div>
            <label>Database</label>
            <input value={database} onChange={(e) => setDatabase(e.target.value)} />
            <div className="grid-2">
              <div>
                <label>Username</label>
                <input value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div>
                <label>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        <div className="grid-2">
          <div>
            <label>Schema</label>
            <input value={schema} onChange={(e) => setSchema(e.target.value)} />
          </div>
          <div>
            <label>Row limit per table</label>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              min={1}
            />
          </div>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <button
            className="btn sec"
            type="button"
            disabled={busy || (!useFields && !connStr.trim()) || (useFields && !database)}
            onClick={connectDb}
          >
            Connect &amp; list tables
          </button>
          {dbStatus && <span className="muted">{dbStatus}</span>}
        </div>

        {!!dbTables.length && (
          <div style={{ marginTop: 14 }}>
            <div className="row" style={{ marginBottom: 8 }}>
              <button
                className="btn sm sec"
                type="button"
                onClick={() => {
                  const all: Record<string, boolean> = {};
                  dbTables.forEach((t) => {
                    all[t.name] = true;
                  });
                  setSelected(all);
                }}
              >
                Select all
              </button>
              <button
                className="btn sm sec"
                type="button"
                onClick={() => {
                  const none: Record<string, boolean> = {};
                  dbTables.forEach((t) => {
                    none[t.name] = false;
                  });
                  setSelected(none);
                }}
              >
                Clear
              </button>
              <span className="muted">{selectedCount} selected</span>
            </div>
            <div
              className="table-wrap"
              style={{ maxHeight: 260 }}
            >
              <table>
                <thead>
                  <tr>
                    <th></th>
                    <th>Table</th>
                    <th>Rows</th>
                  </tr>
                </thead>
                <tbody>
                  {dbTables.map((t) => (
                    <tr key={t.name}>
                      <td>
                        <input
                          type="checkbox"
                          checked={!!selected[t.name]}
                          onChange={(e) =>
                            setSelected((s) => ({ ...s, [t.name]: e.target.checked }))
                          }
                          style={{ width: 'auto' }}
                        />
                      </td>
                      <td>
                        <code>{t.name}</code>
                      </td>
                      <td className="muted">
                        {t.row_count != null ? t.row_count.toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              className="btn"
              type="button"
              disabled={busy || !selectedCount}
              style={{ marginTop: 12 }}
              onClick={createFromDb}
            >
              Import {selectedCount || ''} table{selectedCount === 1 ? '' : 's'} as source
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function SourceDetailPage() {
  const { id } = useParams();
  const [src, setSrc] = useState<Source | null>(null);
  const [schema, setSchema] = useState<{
    tables: Record<string, { columns: string[]; n_rows: number; records?: Record<string, unknown>[] }>;
    links: Array<{ fromTable: string; fromCol: string; toTable: string; toCol: string }>;
    parent_table?: string | null;
    schema_config?: SchemaConfig;
  } | null>(null);
  const [schemaConfig, setSchemaConfig] = useState<SchemaConfig>(emptySchemaConfig());
  const [saveMsg, setSaveMsg] = useState('');
  const [err, setErr] = useState('');
  const nav = useNavigate();
  const { can } = useAuth();

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api<Source>(`/v1/sources/${id}`),
      api<NonNullable<typeof schema>>(`/v1/sources/${id}/schema`),
    ])
      .then(([s, sch]) => {
        setSrc(s);
        setSchema(sch);
        const cfg = sch.schema_config || emptySchemaConfig();
        if (!cfg.pii_columns?.length && sch.parent_table) {
          cfg.pii_columns = autoDetectParentPii(sch.parent_table, sch.tables);
        }
        if (!cfg.parent_table) cfg.parent_table = sch.parent_table;
        if (!cfg.links?.length) cfg.links = sch.links;
        setSchemaConfig(cfg);
      })
      .catch((e) => setErr(e.message));
  }, [id]);

  async function suggestPolicy() {
    if (!id) return;
    const pol = await api<{ id: string }>(`/v1/policies/suggest-from-source/${id}`, {
      method: 'POST',
    });
    nav(`/policies/${pol.id}`);
  }

  async function saveSchemaConfig(next: SchemaConfig) {
    setSchemaConfig(next);
    if (!id || !can('edit_sources')) return;
    try {
      await api(`/v1/sources/${id}/schema-config`, { method: 'PUT', json: next });
      setSaveMsg('Schema settings saved');
      setTimeout(() => setSaveMsg(''), 1500);
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Save failed');
    }
  }

  if (!src && !err) return <p className="muted">Loading…</p>;

  const tables = src?.tables || {};

  return (
    <div>
      <h1 className="page-title">{src?.name || 'Source'}</h1>
      <p className="page-sub">
        {src?.kind} · {Object.keys(tables).length} table(s)
        {src?.kind === 'database' && src.meta?.host
          ? ` · ${String(src.meta.host)}/${String(src.meta.database || '')}`
          : ''}
        {src?.kind === 'database' && src.meta?.connection_string_redacted
          ? ` · ${String(src.meta.connection_string_redacted)}`
          : ''}
      </p>
      {err && <div className="err">{err}</div>}
      <div className="row" style={{ marginBottom: 14 }}>
        <Link className="btn" to={`/jobs/new?source=${id}`}>
          New job from source
        </Link>
        {can('edit_policies') && (
          <button className="btn sec" onClick={suggestPolicy}>
            Suggest field policy
          </button>
        )}
        {saveMsg && <span className="muted">{saveMsg}</span>}
      </div>

      {schema && Object.keys(schema.tables).length > 0 && (
        <div className="card">
          <h3>
            Schema{' '}
            <span className="muted" style={{ fontWeight: 400 }}>
              {(schemaConfig.links || schema.links).length} FK ·{' '}
              {schemaConfig.locked_tables.length} locked · {schemaConfig.pii_columns.length} PII ·{' '}
              {schemaConfig.nan_columns.length} NaN policy
            </span>
          </h3>
          <SchemaDiagram
            tables={schema.tables}
            links={schema.links}
            parentTable={schema.parent_table}
            config={schemaConfig}
            onChange={saveSchemaConfig}
            readOnly={!can('edit_sources')}
          />
        </div>
      )}

      {Object.entries(tables).map(([tname, tdata]) => (
        <div className="card" key={tname}>
          <h3>
            {tname}{' '}
            <span className="muted">
              {tdata.n_rows ?? tdata.records?.length ?? 0} rows · {(tdata.columns || []).length} cols
              {schemaConfig.locked_tables.includes(tname) ? ' · 🔒 locked' : ''}
            </span>
          </h3>
          <div className="muted">{(tdata.columns || []).join(', ')}</div>
        </div>
      ))}
    </div>
  );
}
