import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';

type SfConn = {
  id: string;
  label: string;
  login_url: string;
  org_kind: string;
  status: string;
  authorize_url?: string;
  instance_url?: string;
};

type Target = {
  id: string;
  label: string;
  connection_id?: string;
  object_map: Record<string, string>;
  last_load_status?: string;
};

export function TargetsPage() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [conns, setConns] = useState<SfConn[]>([]);
  const [label, setLabel] = useState('Sandbox seed target');
  const [connectionId, setConnectionId] = useState('');
  const [err, setErr] = useState('');
  const { can } = useAuth();

  async function refresh() {
    const [t, c] = await Promise.all([
      api<{ targets: Target[] }>('/v1/targets'),
      api<{ connections: SfConn[] }>('/v1/integrations/salesforce'),
    ]);
    setTargets(t.targets);
    setConns(c.connections);
  }

  useEffect(() => {
    refresh().catch((e) => setErr(e.message));
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/v1/targets', {
        method: 'POST',
        json: {
          label,
          connection_id: connectionId || null,
          object_map: { Contact: 'Contact' },
        },
      });
      await refresh();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Failed');
    }
  }

  return (
    <div data-tour="targets-page">
      <h1 className="page-title">Targets</h1>
      <p className="page-sub">Salesforce sandboxes to seed with synthetic data</p>
      {err && <div className="err">{err}</div>}
      <div className="row" style={{ marginBottom: 12 }}>
        <Link className="btn sec" to="/settings/integrations">
          Manage Salesforce connections
        </Link>
      </div>
      {can('manage_targets') && (
        <form className="card" onSubmit={create}>
          <h3>New target</h3>
          <label>Label</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} />
          <label>Connection</label>
          <select value={connectionId} onChange={(e) => setConnectionId(e.target.value)}>
            <option value="">None yet</option>
            {conns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} ({c.status})
              </option>
            ))}
          </select>
          <button className="btn" style={{ marginTop: 12 }} type="submit">
            Create target
          </button>
        </form>
      )}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Label</th>
                <th>Connection</th>
                <th>Last load</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {targets.map((t) => (
                <tr key={t.id}>
                  <td>{t.label}</td>
                  <td className="muted">{t.connection_id || '—'}</td>
                  <td>{t.last_load_status || '—'}</td>
                  <td>
                    <Link to={`/targets/${t.id}`}>Open</Link>
                  </td>
                </tr>
              ))}
              {!targets.length && (
                <tr>
                  <td colSpan={4} className="muted">
                    No targets yet.
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

export function TargetDetailPage() {
  const { orgId } = useParams();
  const [tgt, setTgt] = useState<Target | null>(null);
  const [dry, setDry] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState('');
  const { can } = useAuth();

  useEffect(() => {
    if (!orgId) return;
    api<Target>(`/v1/targets/${orgId}`)
      .then(setTgt)
      .catch((e) => setErr(e.message));
  }, [orgId]);

  async function runDry() {
    if (!orgId) return;
    const r = await api<Record<string, unknown>>(`/v1/targets/${orgId}/dry-run`, {
      method: 'POST',
    });
    setDry(r);
  }

  return (
    <div>
      <h1 className="page-title">{tgt?.label || 'Target'}</h1>
      <p className="page-sub">Object map and Bulk load dry-run</p>
      {err && <div className="err">{err}</div>}
      <div className="card">
        <h3>Object map</h3>
        <pre className="muted" style={{ fontSize: 12 }}>
          {JSON.stringify(tgt?.object_map || {}, null, 2)}
        </pre>
        {can('manage_targets') && (
          <button className="btn" onClick={runDry}>
            Dry-run load plan
          </button>
        )}
      </div>
      {dry && (
        <div className="card">
          <h3>Dry-run result</h3>
          <pre className="muted" style={{ fontSize: 12 }}>
            {JSON.stringify(dry, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

type ApiKeyRequest = {
  id: string;
  name: string;
  email: string;
  company: string;
  reason: string;
  status: string;
  created_at: number;
  approved_at?: number;
  denied_at?: number;
  deny_note?: string;
};
type ApiKeyStatus = { has_key: boolean; keys: Array<{ id: string; name: string; key_prefix: string; created_at: number }>; pending_request: ApiKeyRequest | null };

function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function SettingsPage() {
  const [members, setMembers] = useState<Array<{ id: string; email: string; name: string; role: string }>>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('operator');
  const [keyStatus, setKeyStatus] = useState<ApiKeyStatus | null>(null);
  // Request API key form state
  const [reqName, setReqName] = useState('');
  const [reqEmail, setReqEmail] = useState('');
  const [reqCompany, setReqCompany] = useState('');
  const [reqReason, setReqReason] = useState('');
  const [reqSent, setReqSent] = useState(false);
  // Enter API key manually
  const [showKeyEntry, setShowKeyEntry] = useState(false);
  const [rawKey, setRawKey] = useState('');
  const [keySaved, setKeySaved] = useState(false);
  // Delete confirmation
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [cancellingReq, setCancellingReq] = useState(false);
  const [err, setErr] = useState('');
  const { can, user, platformAdmin } = useAuth();

  async function refresh() {
    const cur = await api<{ members: typeof members }>('/v1/workspaces/current');
    setMembers(cur.members);
    if (can('manage_integrations')) {
      const s = await api<ApiKeyStatus>('/v1/settings/api-key-request-status');
      setKeyStatus(s);
    }
  }

  useEffect(() => {
    if (user) {
      setReqName((n) => n || user.name || '');
      setReqEmail((e) => e || user.email || '');
    }
  }, [user]);

  useEffect(() => { refresh().catch((e) => setErr(e.message)); }, []);

  async function invite(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/v1/workspaces/members', { method: 'POST', json: { email, role } });
      setEmail('');
      await refresh();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Invite failed');
    }
  }

  async function deleteKey(keyId: string) {
    if (deleteConfirm !== 'I understand') return;
    try {
      try {
        await api(`/v1/settings/api-keys/${keyId}/delete`, { method: 'POST' });
      } catch (ex: unknown) {
        if (!(ex instanceof ApiError) || (ex.status !== 404 && ex.status !== 405)) throw ex;
        await api(`/v1/settings/api-keys/${keyId}`, { method: 'DELETE' });
      }
      setDeletingKeyId(null);
      setDeleteConfirm('');
      setReqSent(false);
      await refresh();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Delete failed');
    }
  }

  async function cancelPendingRequest() {
    setCancellingReq(true);
    setErr('');
    try {
      await api('/v1/settings/api-key-requests/cancel', { method: 'POST' });
      setReqSent(false);
      await refresh();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Cancel failed');
    } finally {
      setCancellingReq(false);
    }
  }

  async function saveKey(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/v1/settings/api-keys/register', { method: 'POST', json: { key: rawKey } });
      setKeySaved(true);
      setRawKey('');
      setShowKeyEntry(false);
      await refresh();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Failed to save key');
    }
  }

  async function requestKey(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/v1/auth/request-api-key', {
        method: 'POST',
        json: { name: reqName, email: reqEmail, company: reqCompany, reason: reqReason },
      });
      setReqSent(true);
      await refresh();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Request failed');
    }
  }

  return (
    <div>
      <h1 className="page-title">Settings</h1>
      <p className="page-sub">Members, API keys, integrations</p>
      {err && <div className="err">{err}</div>}
      {platformAdmin && (
        <div className="row" style={{ marginBottom: 12 }}>
          <Link className="btn sec" to="/api-manager">API Manager</Link>
        </div>
      )}
      <div className="row" style={{ marginBottom: 12 }}>
        <Link className="btn sec" to="/settings/integrations">Salesforce integrations</Link>
      </div>

      <div className="card">
        <h3>Members</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}><td>{m.name}</td><td>{m.email}</td><td>{m.role}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {can('manage_members') && (
          <form className="row" style={{ marginTop: 12 }} onSubmit={invite}>
            <input placeholder="colleague@company.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ maxWidth: 260 }} />
            <select value={role} onChange={(e) => setRole(e.target.value)} style={{ maxWidth: 180 }}>
              <option value="admin">Admin</option>
              <option value="operator">Operator</option>
              <option value="privacy_reviewer">Privacy Reviewer</option>
            </select>
            <button className="btn sm" type="submit">Add member</button>
          </form>
        )}
        <p className="muted">Members share the workspace API key and can use all features their role permits.</p>
      </div>

      <div data-tour="settings-api-key" className="card">
        <h3>API key</h3>
        <p className="muted" style={{ marginBottom: 12 }}>
          An active key unlocks custom sources and full ML training. Downloads stay capped at 150 rows.
          You can delete your key at any time; it then leaves this page and becomes inactive.
        </p>

        {/* Active key table — always shown when keys exist */}
        {keyStatus?.has_key && (
          <>
            <p className="muted" style={{ marginBottom: 8 }}>
              Your workspace has an active API key. Share it via a secret manager — never commit it.
            </p>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Prefix</th><th>Sent</th><th></th></tr></thead>
                <tbody>
                  {keyStatus.keys.map((k) => (
                    <>
                      <tr key={k.id}>
                        <td>{k.name}</td>
                        <td><code>{k.key_prefix}…</code></td>
                        <td className="muted">{fmtDate(k.created_at)}</td>
                        <td>
                          {can('manage_integrations') && (
                            <button
                              className="btn sec sm"
                              style={{ color: '#f87171', borderColor: '#f8717144' }}
                              onClick={() => { setDeletingKeyId(k.id); setDeleteConfirm(''); setErr(''); }}
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                      {deletingKeyId === k.id && (
                        <tr key={`${k.id}-confirm`}>
                          <td colSpan={4}>
                            <div style={{
                              background: 'rgba(239,68,68,0.07)',
                              border: '1px solid rgba(239,68,68,0.25)',
                              borderRadius: 8,
                              padding: '12px 14px',
                              margin: '4px 0',
                            }}>
                              <p style={{ fontSize: 13, color: '#f87171', marginBottom: 8 }}>
                                Delete <code>{k.key_prefix}…</code> from this workspace? It becomes inactive
                                and will no longer unlock custom sources or ML training. You can request a new key after.
                              </p>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <input
                                  placeholder='Type "I understand" to confirm'
                                  value={deleteConfirm}
                                  onChange={(e) => setDeleteConfirm(e.target.value)}
                                  style={{ maxWidth: 260, fontSize: 13 }}
                                />
                                <button
                                  className="btn sm"
                                  style={{ background: '#dc2626', border: 'none' }}
                                  disabled={deleteConfirm !== 'I understand'}
                                  onClick={() => deleteKey(k.id)}
                                >
                                  Confirm delete
                                </button>
                                <button
                                  className="btn sec sm"
                                  onClick={() => { setDeletingKeyId(null); setDeleteConfirm(''); }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Pending / approved / denied request banner */}
        {keyStatus?.pending_request && (
          <div style={{
            margin: keyStatus.has_key ? '14px 0 0' : '0 0 14px',
            padding: '10px 14px',
            borderRadius: 8,
            background: keyStatus.pending_request.status === 'approved'
              ? 'rgba(34,197,94,0.08)'
              : keyStatus.pending_request.status === 'denied'
                ? 'rgba(239,68,68,0.08)'
                : 'rgba(99,102,241,0.08)',
            border: `1px solid ${
              keyStatus.pending_request.status === 'approved'
                ? 'rgba(34,197,94,0.3)'
                : keyStatus.pending_request.status === 'denied'
                  ? 'rgba(239,68,68,0.3)'
                  : 'rgba(99,102,241,0.3)'
            }`,
            fontSize: 13,
            color: keyStatus.pending_request.status === 'approved'
              ? '#4ade80'
              : keyStatus.pending_request.status === 'denied'
                ? '#fca5a5'
                : '#a5b4fc',
          }}>
            {keyStatus.pending_request.status === 'denied' ? (
              <>Request denied {fmtDate(keyStatus.pending_request.denied_at ?? keyStatus.pending_request.created_at)}. You can submit a new request below.</>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <span>
                  Request sent {fmtDate(keyStatus.pending_request.created_at)} · We'll email you within 1–2 business days
                </span>
                <button
                  className="btn sec sm"
                  type="button"
                  disabled={cancellingReq}
                  onClick={() => void cancelPendingRequest()}
                >
                  {cancellingReq ? 'Cancelling…' : 'Cancel request'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Enter key manually — always available, hidden until toggled */}
        {keySaved && (
          <p style={{ fontSize: 13, color: '#4ade80', margin: '12px 0 0' }}>API key saved successfully.</p>
        )}
        <div style={{ marginTop: 14 }}>
          <button
            className="btn sec sm"
            type="button"
            onClick={() => { setShowKeyEntry((v) => !v); setErr(''); }}
          >
            {showKeyEntry ? 'Cancel' : 'Enter API key'}
          </button>
          {showKeyEntry && (
            <form onSubmit={saveKey} style={{ marginTop: 10 }}>
              <div style={{ display: 'grid', gap: 8 }}>
                <input
                  placeholder="sk_live_…"
                  value={rawKey}
                  onChange={(e) => setRawKey(e.target.value)}
                  required
                  style={{ fontFamily: 'monospace', fontSize: 13, letterSpacing: '0.03em' }}
                />
                <div><button className="btn sm" type="submit">Save key</button></div>
              </div>
            </form>
          )}
        </div>

        {/* Request form — hide while a request is still pending */}
        {!keyStatus?.has_key && !reqSent && keyStatus?.pending_request?.status !== 'pending' && (
          <>
            <p className="muted" style={{ marginBottom: 12 }}>
              An API key unlocks ML synthesis jobs. Fast (AI-less) search is always available without one.
              Fill in the form below to request your key — we'll email it to you within 1–2 business days.
            </p>
            <form onSubmit={requestKey}>
              <div style={{ display: 'grid', gap: 8 }}>
                <input placeholder="Your name" value={reqName} onChange={(e) => setReqName(e.target.value)} required />
                <input placeholder="Your email" type="email" value={reqEmail} onChange={(e) => setReqEmail(e.target.value)} required />
                <input placeholder="Company / organization" value={reqCompany} onChange={(e) => setReqCompany(e.target.value)} />
                <textarea placeholder="How will you use Safe-Seed? (optional)" value={reqReason} onChange={(e) => setReqReason(e.target.value)} rows={3} style={{ fontFamily: 'inherit', fontSize: 14, resize: 'vertical' }} />
                <div><button className="btn sm" type="submit">Request API key</button></div>
              </div>
            </form>
          </>
        )}

        {/* Request another key — shown when key exists and no pending request */}
        {keyStatus?.has_key && !keyStatus?.pending_request && (
          <details style={{ marginTop: 14 }}>
            <summary style={{ fontSize: 13, color: 'var(--muted)', cursor: 'pointer' }}>
              Request a new key
            </summary>
            <form onSubmit={requestKey} style={{ marginTop: 10 }}>
              <div style={{ display: 'grid', gap: 8 }}>
                <input placeholder="Company / organization" value={reqCompany} onChange={(e) => setReqCompany(e.target.value)} />
                <textarea placeholder="Reason for new key (optional)" value={reqReason} onChange={(e) => setReqReason(e.target.value)} rows={2} style={{ fontFamily: 'inherit', fontSize: 14, resize: 'vertical' }} />
                <div><button className="btn sec sm" type="submit">Send request</button></div>
              </div>
            </form>
          </details>
        )}
      </div>
    </div>
  );
}

export function IntegrationsPage() {
  const [conns, setConns] = useState<SfConn[]>([]);
  const [label, setLabel] = useState('Sandbox');
  const [loginUrl, setLoginUrl] = useState('https://test.salesforce.com');
  const [authorizeUrl, setAuthorizeUrl] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const { can } = useAuth();

  async function refresh() {
    const r = await api<{ connections: SfConn[] }>('/v1/integrations/salesforce');
    setConns(r.connections);
  }

  useEffect(() => {
    refresh().catch((e) => setErr(e.message));
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    try {
      const c = await api<SfConn>('/v1/integrations/salesforce', {
        method: 'POST',
        json: { label, login_url: loginUrl, org_kind: 'sandbox' },
      });
      setAuthorizeUrl(c.authorize_url || null);
      await refresh();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Failed');
    }
  }

  async function markConnected(id: string) {
    await api(`/v1/integrations/salesforce/${id}/complete-oauth`, {
      method: 'POST',
      json: { code: 'dev-stub-code', instance_url: 'https://example.my.salesforce.com' },
    });
    await refresh();
  }

  return (
    <div>
      <h1 className="page-title">Salesforce integrations</h1>
      <p className="page-sub">OAuth Connected App flow (authorize URL + stub token exchange)</p>
      {err && <div className="err">{err}</div>}
      {can('manage_integrations') && (
        <form className="card" onSubmit={create}>
          <h3>Add connection</h3>
          <label>Label</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} />
          <label>Login URL</label>
          <select value={loginUrl} onChange={(e) => setLoginUrl(e.target.value)}>
            <option value="https://test.salesforce.com">Sandbox (test.salesforce.com)</option>
            <option value="https://login.salesforce.com">Production</option>
          </select>
          <button className="btn" style={{ marginTop: 12 }} type="submit">
            Create & get authorize URL
          </button>
          {authorizeUrl && (
            <p className="muted" style={{ marginTop: 10, wordBreak: 'break-all' }}>
              Authorize URL: <a href={authorizeUrl}>{authorizeUrl}</a>
            </p>
          )}
        </form>
      )}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Label</th>
                <th>Kind</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {conns.map((c) => (
                <tr key={c.id}>
                  <td>{c.label}</td>
                  <td>{c.org_kind}</td>
                  <td>
                    <span className={`pill ${c.status === 'connected' ? 'PASS' : 'WARN'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td>
                    {can('manage_integrations') && c.status !== 'connected' && (
                      <button className="btn sm sec" onClick={() => markConnected(c.id)}>
                        Mark connected (dev)
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function HelpPage() {
  const [steps, setSteps] = useState<Array<{ id: string; label: string; done: boolean }>>([]);

  useEffect(() => {
    api<{ steps: typeof steps }>('/v1/help/checklist')
      .then((r) => setSteps(r.steps))
      .catch(() => undefined);
  }, []);

  return (
    <div>
      <h1 className="page-title">Help</h1>
      <p className="page-sub">First-run checklist and docs pointers</p>
      <div data-tour="help-checklist" className="card">
        <h3>Getting started</h3>
        {steps.map((s) => (
          <div key={s.id} className={`check${s.done ? ' done' : ''}`}>
            <div className="mark">{s.done ? '✓' : ''}</div>
            <div>{s.label}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <h3>Docs</h3>
        <ul className="muted">
          <li>
            <Link to="/sources/new">Add a source</Link> → confirm{' '}
            <Link to="/policies">PII policies</Link> →{' '}
            <Link to="/jobs/new">run a seed</Link> → download evidence
          </li>
          <li>
            Salesforce: <Link to="/settings/integrations">Integrations</Link> then{' '}
            <Link to="/targets">Targets</Link>
          </li>
          <li>Engine API (legacy demo): still available at `/synthesize` without auth</li>
        </ul>
      </div>
    </div>
  );
}
