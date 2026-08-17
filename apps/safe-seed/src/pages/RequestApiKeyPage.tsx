import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

type Stage = 'form' | 'sent';

export function RequestApiKeyPage() {
  const [stage, setStage] = useState<Stage>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await api('/v1/auth/request-api-key', {
        method: 'POST',
        json: { name, email, company, reason },
      });
      setStage('sent');
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Request failed — please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (stage === 'sent') {
    return (
      <div className="auth-wrap">
        <div className="card auth-card">
          <h1 className="page-title">Request received</h1>
          <p className="page-sub">
            We'll review your request and email you an API key within 1–2 business days.
          </p>
          <p style={{ marginTop: 8, fontSize: 14, color: 'var(--muted)' }}>
            Confirmation sent to <strong>{email}</strong>.
          </p>
          <div className="row" style={{ marginTop: 24 }}>
            <Link to="/login" className="btn">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1 className="page-title">Request API access</h1>
        <p className="page-sub">
          API keys grant programmatic access to the Safe-Seed synthesis backend. We'll
          review your request and follow up by email.
        </p>
        {err && <div className="err">{err}</div>}

        <label>Full name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Smith"
          required
        />

        <label>Work email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="jane@company.com"
          required
        />

        <label>Company / organization</label>
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Acme Corp"
        />

        <label>How will you use Safe-Seed?</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder="Brief description of your use case…"
          style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 14 }}
        />

        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn" disabled={busy} type="submit">
            {busy ? 'Sending…' : 'Request access'}
          </button>
          <Link to="/login">Sign in instead</Link>
        </div>
      </form>
    </div>
  );
}
