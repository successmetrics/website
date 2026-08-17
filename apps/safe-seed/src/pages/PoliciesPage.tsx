import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

type FieldSpec = {
  strategy: string;
  pii?: boolean;
  nan_rate?: number;
  nan_policy?: string;
  table?: string;
  column?: string;
};

type Policy = {
  id: string;
  name: string;
  compliance_tier: string;
  version: number;
  fields: Record<string, FieldSpec>;
};

export function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [err, setErr] = useState('');
  const { can } = useAuth();

  useEffect(() => {
    api<{ policies: Policy[] }>('/v1/policies')
      .then((r) => setPolicies(r.policies))
      .catch((e) => setErr(e.message));
  }, []);

  return (
    <div>
      <h1 className="page-title">Field policies</h1>
      <p className="page-sub">PII/PHI strategies, NaN handling, compliance tier</p>
      {err && <div className="err">{err}</div>}
      {can('edit_policies') && (
        <div className="row" style={{ marginBottom: 14 }}>
          <Link data-tour="new-policy-btn" className="btn" to="/policies/new">
            New policy
          </Link>
        </div>
      )}
      <div data-tour="policies-list" className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Tier</th>
                <th>Version</th>
                <th>Fields</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.compliance_tier}</td>
                  <td>v{p.version}</td>
                  <td>{Object.keys(p.fields || {}).length}</td>
                  <td>
                    <Link to={`/policies/${p.id}`}>Open</Link>
                  </td>
                </tr>
              ))}
              {!policies.length && (
                <tr>
                  <td colSpan={5} className="muted">
                    No policies yet — suggest one from a source.
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

export function PolicyNewPage() {
  const nav = useNavigate();
  const [name, setName] = useState('Default Safe Harbor');
  const [tier, setTier] = useState('safe_harbor');
  const [err, setErr] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      const pol = await api<Policy>('/v1/policies', {
        method: 'POST',
        json: { name, compliance_tier: tier, fields: {} },
      });
      nav(`/policies/${pol.id}`);
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Failed');
    }
  }

  return (
    <div>
      <h1 className="page-title">New policy</h1>
      {err && <div className="err">{err}</div>}
      <form className="card" onSubmit={onSubmit} style={{ maxWidth: 480 }}>
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
        <label>Compliance tier</label>
        <select value={tier} onChange={(e) => setTier(e.target.value)}>
          <option value="safe_harbor">HIPAA Safe Harbor</option>
          <option value="expert_determination">Expert Determination (later)</option>
        </select>
        <button className="btn" style={{ marginTop: 14 }} type="submit">
          Create
        </button>
      </form>
    </div>
  );
}

export function PolicyDetailPage() {
  const { id } = useParams();
  const [pol, setPol] = useState<Policy | null>(null);
  const [err, setErr] = useState('');
  const { can } = useAuth();

  useEffect(() => {
    if (!id) return;
    api<Policy>(`/v1/policies/${id}`)
      .then(setPol)
      .catch((e) => setErr(e.message));
  }, [id]);

  async function updateField(key: string, patch: Partial<FieldSpec>) {
    if (!pol || !can('edit_policies')) return;
    const fields = {
      ...pol.fields,
      [key]: { ...pol.fields[key], ...patch },
    };
    const updated = await api<Policy>(`/v1/policies/${pol.id}`, {
      method: 'PATCH',
      json: { fields },
    });
    setPol(updated);
  }

  if (!pol && !err) return <p className="muted">Loading…</p>;

  return (
    <div>
      <h1 className="page-title">{pol?.name}</h1>
      <p className="page-sub">
        {pol?.compliance_tier} · v{pol?.version}
      </p>
      {err && <div className="err">{err}</div>}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Field</th>
                <th>PII</th>
                <th>Strategy</th>
                <th>NaN policy</th>
                <th>NaN rate</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(pol?.fields || {}).map(([key, spec]) => (
                <tr key={key}>
                  <td>
                    <code>{key}</code>
                  </td>
                  <td>{spec.pii ? 'yes' : '—'}</td>
                  <td>
                    <select
                      disabled={!can('edit_policies')}
                      value={spec.strategy}
                      onChange={(e) => updateField(key, { strategy: e.target.value })}
                    >
                      <option value="synthesize">synthesize</option>
                      <option value="mask">mask</option>
                      <option value="generalize">generalize</option>
                      <option value="drop">drop</option>
                      <option value="fill">fill</option>
                    </select>
                  </td>
                  <td>
                    <select
                      disabled={!can('edit_policies')}
                      value={spec.nan_policy || 'impute'}
                      onChange={(e) => updateField(key, { nan_policy: e.target.value })}
                    >
                      <option value="impute">impute / synthesize</option>
                      <option value="preserve">preserve NaN rate</option>
                    </select>
                  </td>
                  <td>{spec.nan_rate != null ? `${(spec.nan_rate * 100).toFixed(1)}%` : '—'}</td>
                </tr>
              ))}
              {!Object.keys(pol?.fields || {}).length && (
                <tr>
                  <td colSpan={5} className="muted">
                    Empty policy — use “Suggest field policy” on a source.
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
