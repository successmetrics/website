import { Fragment, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';

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
  workspace_id?: string;
};

type IssuedKey = {
  id: string;
  name: string;
  key_prefix: string;
  created_at: number;
  status: string;
  revoked_at?: number;
  revoked_reason?: string;
  workspace_id?: string;
  workspace_name?: string;
  owner_email?: string;
  owner_name?: string;
  company?: string;
};

type ReqFilter = 'pending' | 'approved' | 'denied' | 'cancelled' | 'all';
type KeyFilter = 'active' | 'inactive' | 'all';

function fmtDate(ts: number) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function ApiManagerPage() {
  const { platformAdmin, loading, user, workspaceId } = useAuth();
  const [err, setErr] = useState('');
  const [reqs, setReqs] = useState<ApiKeyRequest[]>([]);
  const [keys, setKeys] = useState<IssuedKey[]>([]);
  const [reqFilter, setReqFilter] = useState<ReqFilter>('pending');
  const [reqQuery, setReqQuery] = useState('');
  const [keyFilter, setKeyFilter] = useState<KeyFilter>('active');
  const [keyQuery, setKeyQuery] = useState('');
  const [grantingId, setGrantingId] = useState<string | null>(null);
  const [denyingId, setDenyingId] = useState<string | null>(null);
  const [denyNote, setDenyNote] = useState('');
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeConfirm, setRevokeConfirm] = useState('');

  async function loadIssuedKeys(
    listed: { requests?: ApiKeyRequest[]; issued_keys?: IssuedKey[]; keys?: IssuedKey[] },
  ): Promise<IssuedKey[]> {
    const fromListed = [
      ...(Array.isArray(listed.issued_keys) ? listed.issued_keys : []),
      ...(Array.isArray(listed.keys) ? listed.keys : []),
    ].filter((k) => k?.id);
    const byId = new Map<string, IssuedKey>();
    for (const k of fromListed) {
      if (!byId.has(k.id)) byId.set(k.id, { ...k, status: k.status || 'active' });
    }
    if (![...byId.values()].some((k) => k.id.startsWith('key_'))) {
      try {
        const issued = await api<{ keys?: IssuedKey[]; issued_keys?: IssuedKey[] }>(
          '/v1/admin/api-keys?status=all',
        );
        for (const k of issued.issued_keys || issued.keys || []) {
          if (k?.id && !byId.has(k.id)) byId.set(k.id, { ...k, status: k.status || 'active' });
        }
      } catch (ex: unknown) {
        if (!(ex instanceof ApiError) || (ex.status !== 404 && ex.status !== 405)) throw ex;
      }
    }
    const real = [...byId.values()];
    if (real.some((k) => k.id.startsWith('key_'))) return real;
    let approved = (listed.requests || []).filter((r) => r.status === 'approved');
    if (!approved.length) {
      const all = await api<{ requests: ApiKeyRequest[] }>('/v1/admin/api-key-requests?status=approved');
      approved = all.requests || [];
    }
    let local: IssuedKey[] = [];
    try {
      const s = await api<{ keys: IssuedKey[] }>('/v1/settings/api-keys');
      local = (s.keys || []).map((k) => ({
        ...k,
        status: k.status || 'active',
        workspace_id: k.workspace_id || workspaceId || '',
        owner_email: k.owner_email || user?.email || '',
        owner_name: k.owner_name || user?.name || '',
      }));
    } catch {
      local = [];
    }
    const fromReqs: IssuedKey[] = approved.map((r) => ({
      id: r.id,
      name: r.name,
      key_prefix: '',
      created_at: r.approved_at || r.created_at,
      status: 'active',
      workspace_id: r.workspace_id,
      owner_email: r.email,
      owner_name: r.name,
      company: r.company,
    }));
    const localIds = new Set(local.map((k) => k.id));
    const localWs = new Set(local.map((k) => k.workspace_id).filter(Boolean));
    const extra = fromReqs.filter((r) => {
      if (localIds.has(r.id)) return false;
      if (r.workspace_id && localWs.has(r.workspace_id) && local.length) return false;
      return true;
    });
    return [...local, ...extra, ...real.filter((k) => !localIds.has(k.id))];
  }

  async function refresh() {
    const q = reqFilter === 'all' ? '' : `?status=${encodeURIComponent(reqFilter)}`;
    const listed = await api<{
      requests: ApiKeyRequest[];
      issued_keys?: IssuedKey[];
      keys?: IssuedKey[];
    }>(`/v1/admin/api-key-requests${q}`);
    setReqs(listed.requests || []);
    setKeys(await loadIssuedKeys(listed));
  }

  useEffect(() => {
    if (!platformAdmin) return;
    refresh().catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Failed to load'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platformAdmin, reqFilter]);

  const visibleReqs = useMemo(() => {
    const q = reqQuery.trim().toLowerCase();
    if (!q) return reqs;
    return reqs.filter((r) =>
      [r.name, r.email, r.company, r.reason, r.id, r.status]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [reqs, reqQuery]);

  const visibleKeys = useMemo(() => {
    const byStatus = keyFilter === 'all'
      ? keys
      : keyFilter === 'inactive'
        ? keys.filter((k) => (k.status || 'active') !== 'active')
        : keys.filter((k) => (k.status || 'active') === 'active');
    const q = keyQuery.trim().toLowerCase();
    if (!q) return byStatus;
    return byStatus.filter((k) =>
      [k.name, k.owner_name, k.owner_email, k.company, k.workspace_name, k.key_prefix, k.id, k.status]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [keys, keyQuery, keyFilter]);

  async function grantPending(req: ApiKeyRequest) {
    setGrantingId(req.id);
    setErr('');
    try {
      await api('/v1/admin/grant-api-key', {
        method: 'POST',
        json: { request_id: req.id, workspace_id: req.workspace_id || '' },
      });
      setDenyingId(null);
      await refresh();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Approve failed');
    } finally {
      setGrantingId(null);
    }
  }

  async function denyPending(req: ApiKeyRequest) {
    setGrantingId(req.id);
    setErr('');
    const body = {
      request_id: req.id,
      workspace_id: req.workspace_id || '',
      email: req.email || '',
      note: denyNote,
      decision: 'denied',
    };
    try {
      try {
        await api('/v1/admin/deny-api-key', { method: 'POST', json: body });
      } catch (ex: unknown) {
        if (!(ex instanceof ApiError) || (ex.status !== 404 && ex.status !== 405)) throw ex;
        await api('/v1/admin/api-key-requests', { method: 'POST', json: body });
      }
      setDenyingId(null);
      setDenyNote('');
      await refresh();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Deny failed');
    } finally {
      setGrantingId(null);
    }
  }

  async function revokeKey(k: IssuedKey) {
    if (revokeConfirm !== 'I understand') return;
    setErr('');
    let keyId = k.id.startsWith('key_') ? k.id : '';
    let workspace = k.workspace_id || '';
    const requestId = k.id.startsWith('akr_') ? k.id : '';
    const email = k.owner_email || '';
    const prefix = (k.key_prefix || '').replace(/…$/, '');
    if (!keyId) {
      try {
        const issued = await api<{ keys?: IssuedKey[]; issued_keys?: IssuedKey[] }>(
          '/v1/admin/api-keys?status=active',
        );
        const pool = [...(issued.keys || []), ...(issued.issued_keys || [])];
        const match = pool.find((x) => {
          if (!x.id?.startsWith('key_')) return false;
          if (workspace && x.workspace_id === workspace) return true;
          if (email && (x.owner_email || '').toLowerCase() === email.toLowerCase()) return true;
          if (prefix && x.key_prefix === prefix) return true;
          return false;
        });
        if (match) {
          keyId = match.id;
          workspace = match.workspace_id || workspace;
        }
      } catch (ex: unknown) {
        if (!(ex instanceof ApiError) || (ex.status !== 404 && ex.status !== 405)) {
          setErr(ex instanceof Error ? ex.message : 'Revoke failed');
          return;
        }
      }
    }
    if (!keyId && workspace) {
      try {
        const s = await api<{ keys: IssuedKey[] }>('/v1/settings/api-keys', {
          headers: { 'X-Workspace-Id': workspace },
        });
        const match = (s.keys || []).find(
          (x) => x.id.startsWith('key_') && (x.status || 'active') === 'active',
        );
        if (match) {
          keyId = match.id;
          workspace = match.workspace_id || workspace;
        }
      } catch (ex: unknown) {
        if (!(ex instanceof ApiError) || (ex.status !== 403 && ex.status !== 404 && ex.status !== 405)) {
          setErr(ex instanceof Error ? ex.message : 'Revoke failed');
          return;
        }
      }
    }
    const body = {
      key_id: keyId,
      workspace_id: workspace,
      request_id: requestId,
      reason: 'revoked by admin',
      account_email: email,
      key_prefix: prefix,
    };
    try {
      try {
        await api('/v1/admin/api-keys/revoke', { method: 'POST', json: body });
      } catch (ex: unknown) {
        if (!(ex instanceof ApiError) || (ex.status !== 404 && ex.status !== 405 && ex.status !== 422)) {
          throw ex;
        }
        await api('/v1/admin/revoke-api-key', { method: 'POST', json: body });
      }
      setRevokingId(null);
      setRevokeConfirm('');
      await refresh();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Revoke failed');
    }
  }

  if (loading) return <p className="muted">Loading…</p>;
  if (!platformAdmin) return <Navigate to="/" replace />;

  return (
    <div>
      <h1 className="page-title">API Manager</h1>
      <p className="page-sub">
        Pending requests: approve or deny. Live keys: revoke (emails the owner) or review inactive history.
      </p>
      {err && <div className="err">{err}</div>}

      <div className="card">
        <h3>API key requests</h3>
        <p className="muted">
          Approve emails a key to the requester. Deny notifies them and does not issue a key.
          Cancelled requests were withdrawn by the user.
        </p>
        <div className="row" style={{ margin: '12px 0' }}>
          <input
            placeholder="Search name, email, company, reason…"
            value={reqQuery}
            onChange={(e) => setReqQuery(e.target.value)}
            style={{ maxWidth: 320 }}
          />
          <select
            value={reqFilter}
            onChange={(e) => setReqFilter(e.target.value as ReqFilter)}
            style={{ maxWidth: 160 }}
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="denied">Denied</option>
            <option value="cancelled">Cancelled</option>
            <option value="all">All</option>
          </select>
          <span className="muted" style={{ fontSize: 13 }}>
            {visibleReqs.length} of {reqs.length}
          </span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Requested</th>
                <th>Name</th>
                <th>Email</th>
                <th>Company</th>
                <th>Reason</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleReqs.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
                    {reqs.length === 0 ? 'No requests in this view.' : 'No matches for that search.'}
                  </td>
                </tr>
              )}
              {visibleReqs.map((r) => (
                <Fragment key={r.id}>
                  <tr>
                    <td className="muted">{fmtDate(r.created_at)}</td>
                    <td>{r.name}</td>
                    <td>{r.email}</td>
                    <td>{r.company || '—'}</td>
                    <td title={r.reason || ''} style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.reason || '—'}
                    </td>
                    <td>
                      <span className={`pill ${r.status === 'approved' ? 'PASS' : r.status === 'denied' ? 'FAIL' : r.status === 'cancelled' ? 'queued' : 'queued'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td>
                      {r.status === 'pending' && (
                        <div className="row" style={{ gap: 6 }}>
                          <button
                            className="btn sm"
                            type="button"
                            disabled={grantingId === r.id}
                            onClick={() => void grantPending(r)}
                          >
                            {grantingId === r.id && denyingId !== r.id ? 'Sending…' : 'Approve'}
                          </button>
                          <button
                            className="btn sec sm"
                            type="button"
                            disabled={grantingId === r.id}
                            style={{ color: '#f87171', borderColor: '#f8717144' }}
                            onClick={() => {
                              setDenyingId(r.id);
                              setDenyNote('');
                              setErr('');
                            }}
                          >
                            Deny
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {denyingId === r.id && (
                    <tr>
                      <td colSpan={7}>
                        <div style={{
                          background: 'rgba(239,68,68,0.07)',
                          border: '1px solid rgba(239,68,68,0.25)',
                          borderRadius: 8,
                          padding: '12px 14px',
                          margin: '4px 0',
                        }}>
                          <p style={{ fontSize: 13, marginBottom: 8 }}>
                            Deny <strong>{r.name}</strong> ({r.email})? They will be emailed. No key is issued.
                          </p>
                          <textarea
                            placeholder="Optional note included in the email"
                            value={denyNote}
                            onChange={(e) => setDenyNote(e.target.value)}
                            rows={2}
                            style={{ width: '100%', fontFamily: 'inherit', fontSize: 13, resize: 'vertical', marginBottom: 8 }}
                          />
                          <div className="row">
                            <button
                              className="btn sm danger"
                              type="button"
                              disabled={grantingId === r.id}
                              onClick={() => void denyPending(r)}
                            >
                              {grantingId === r.id ? 'Denying…' : 'Confirm deny'}
                            </button>
                            <button
                              className="btn sec sm"
                              type="button"
                              onClick={() => { setDenyingId(null); setDenyNote(''); }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Issued API keys</h3>
        <p className="muted">
          Active keys unlock custom sources and full ML training (150-row download cap still applies).
          Revoke emails the owner and inactivates the key. User-deleted keys also appear here as inactive.
        </p>
        <div className="row" style={{ margin: '12px 0' }}>
          <input
            placeholder="Search name, email, company, workspace, prefix…"
            value={keyQuery}
            onChange={(e) => setKeyQuery(e.target.value)}
            style={{ maxWidth: 320 }}
          />
          <select
            value={keyFilter}
            onChange={(e) => setKeyFilter(e.target.value as KeyFilter)}
            style={{ maxWidth: 160 }}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </select>
          <span className="muted" style={{ fontSize: 13 }}>
            {visibleKeys.length} of {keys.length}
          </span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Issued</th>
                <th>Owner</th>
                <th>Email</th>
                <th>Company</th>
                <th>Workspace</th>
                <th>Prefix</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleKeys.length === 0 && (
                <tr>
                  <td colSpan={8} className="muted">
                    {keys.length === 0 ? 'No keys in this view.' : 'No matches for that search.'}
                  </td>
                </tr>
              )}
              {visibleKeys.map((k) => (
                <Fragment key={k.id}>
                  <tr>
                    <td className="muted">{fmtDate(k.created_at)}</td>
                    <td>{k.owner_name || k.name || '—'}</td>
                    <td>{k.owner_email || '—'}</td>
                    <td>{k.company || '—'}</td>
                    <td>{k.workspace_name || k.workspace_id || '—'}</td>
                    <td><code>{k.key_prefix ? `${k.key_prefix}…` : '—'}</code></td>
                    <td>
                      <span className={`pill ${(k.status || 'active') === 'active' ? 'PASS' : 'FAIL'}`}>
                        {(k.status || 'active') === 'active' ? 'active' : (k.status === 'deleted' ? 'deleted' : 'revoked')}
                      </span>
                    </td>
                    <td>
                      {(k.status || 'active') === 'active' && (
                        <button
                          className="btn sec sm"
                          type="button"
                          style={{ color: '#f87171', borderColor: '#f8717144' }}
                          onClick={() => {
                            setRevokingId(k.id);
                            setRevokeConfirm('');
                            setErr('');
                          }}
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                  {revokingId === k.id && (
                    <tr>
                      <td colSpan={8}>
                        <div style={{
                          background: 'rgba(239,68,68,0.07)',
                          border: '1px solid rgba(239,68,68,0.25)',
                          borderRadius: 8,
                          padding: '12px 14px',
                          margin: '4px 0',
                        }}>
                          <p style={{ fontSize: 13, color: '#f87171', marginBottom: 8 }}>
                            Revoke the active API key{k.key_prefix ? <> <code>{k.key_prefix}…</code></> : ''} for{' '}
                            {k.owner_email || k.workspace_name || 'this workspace'}?
                            They will be emailed, the key becomes inactive, and that workspace loses custom
                            sources and full training until a new key is approved.
                          </p>
                          <div className="row" style={{ alignItems: 'center' }}>
                            <input
                              placeholder='Type "I understand" to confirm'
                              value={revokeConfirm}
                              onChange={(e) => setRevokeConfirm(e.target.value)}
                              style={{ maxWidth: 260, fontSize: 13 }}
                            />
                            <button
                              className="btn sm danger"
                              type="button"
                              disabled={revokeConfirm !== 'I understand'}
                              onClick={() => void revokeKey(k)}
                            >
                              Confirm revoke
                            </button>
                            <button
                              className="btn sec sm"
                              type="button"
                              onClick={() => { setRevokingId(null); setRevokeConfirm(''); }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
