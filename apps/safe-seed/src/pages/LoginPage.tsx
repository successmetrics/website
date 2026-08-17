import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await login(email, password);
      nav('/');
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1 className="page-title">Sign in</h1>
        <p className="page-sub">Safe-Seed workspace access</p>
        {err && <div className="err">{err}</div>}
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        <label>Password</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          required
        />
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn" disabled={busy} type="submit">
            {busy ? 'Signing in… (HF may take a minute to wake)' : 'Sign in'}
          </button>
          <Link to="/signup">Create account</Link>
        </div>
      </form>
    </div>
  );
}

export function SignupPage() {
  const { signup } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await signup(email, name, password, workspaceName || `${name}'s workspace`);
      nav('/');
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Signup failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1 className="page-title">Create account</h1>
        <p className="page-sub">Get started with Safe-Seed</p>
        {err && <div className="err">{err}</div>}
        <label>Full name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required />
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        <label>Password (min 8 characters)</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          minLength={8}
          required
        />
        <label>Workspace name</label>
        <input
          value={workspaceName}
          onChange={(e) => setWorkspaceName(e.target.value)}
          placeholder={name ? `${name}'s workspace` : 'My workspace'}
        />
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn" disabled={busy} type="submit">
            {busy ? 'Creating…' : 'Create account'}
          </button>
          <Link to="/login">Sign in instead</Link>
        </div>
      </form>
    </div>
  );
}
