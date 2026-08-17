import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { NAV_ITEMS, PLATFORM_ADMIN_NAV_ITEMS } from '../product/ia';
import { useAuth } from '../lib/auth';
import { useTour } from './Tour';

const API_BASE = import.meta.env.VITE_API_BASE || '/demo/api';
const HF_TOKEN = import.meta.env.VITE_HF_TOKEN || '';
const DIRECT_HF =
  Boolean(HF_TOKEN) &&
  /^https?:\/\//.test(API_BASE) &&
  API_BASE.includes('hf.space');

type ApiStatus = 'checking' | 'connected' | 'no-key' | 'unreachable';

function useApiStatus(): ApiStatus {
  const [status, setStatus] = useState<ApiStatus>('checking');

  const check = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (DIRECT_HF) headers['Authorization'] = `Bearer ${HF_TOKEN}`;
      const ctrl = new AbortController();
      const timer = window.setTimeout(() => ctrl.abort(), 60_000);
      const r = await fetch(`${API_BASE}/health`, { headers, signal: ctrl.signal });
      window.clearTimeout(timer);
      if (!r.ok) { setStatus('unreachable'); return; }
    } catch {
      setStatus('unreachable');
      return;
    }
    try {
      const { keys } = await api<{ keys: unknown[] }>('/v1/settings/api-keys');
      setStatus(keys.length > 0 ? 'connected' : 'no-key');
    } catch {
      setStatus('no-key');
    }
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [check]);

  return status;
}

function WifiOnIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <circle cx="12" cy="20" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function WifiOffIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <path d="M5 12.55a11 11 0 0 1 5.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <circle cx="12" cy="20" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

type StatusCfg = { icon: 'on' | 'off' | 'none'; color: string; bg: string; title: string; pulse: boolean };

const STATUS_CONFIG: Record<ApiStatus, StatusCfg> = {
  checking:    { icon: 'none', color: '#7c87a0', bg: 'transparent',           title: 'Checking API status…',                                  pulse: false },
  connected:   { icon: 'on',   color: '#4ade80', bg: 'rgba(34,197,94,0.08)',  title: 'Backend reachable · API key active',                    pulse: true  },
  'no-key':    { icon: 'off',  color: '#f87171', bg: 'rgba(239,68,68,0.08)', title: 'Backend reachable · No API key — click to request one', pulse: false },
  unreachable: { icon: 'off',  color: '#f87171', bg: 'rgba(239,68,68,0.08)', title: 'Backend unreachable — click for settings',              pulse: false },
};

export function AppLayout() {
  const { user, role, workspaces, workspaceId, selectWorkspace, logout, platformAdmin } = useAuth();
  const { startTour } = useTour();
  const nav = useNavigate();
  const apiStatus = useApiStatus();
  const { icon, color, bg, title, pulse } = STATUS_CONFIG[apiStatus];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          Safe-Seed
          <span>Success Metrics</span>
        </div>
        {NAV_ITEMS.filter((item) => item.path !== '/help').map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}
        {platformAdmin && PLATFORM_ADMIN_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}
        {NAV_ITEMS.filter((item) => item.path === '/help').map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}

        <div className="sidebar-foot">
          <div style={{ marginBottom: 8 }}>
            <label style={{ marginTop: 0 }}>Workspace</label>
            <select
              value={workspaceId || ''}
              onChange={(e) => selectWorkspace(e.target.value)}
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div>{user?.name} · {role}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
            <button className="btn sec sm" onClick={logout}>Sign out</button>
            <button
              className="btn sec sm"
              onClick={startTour}
              title="Start guided tour"
              style={{ fontWeight: 700 }}
            >?</button>
            {/* API status */}
            <button
              onClick={() => nav('/settings')}
              title={title}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 9px',
                borderRadius: 7,
                border: `1px solid ${color}44`,
                background: bg,
                color,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.04em',
                cursor: 'pointer',
                animation: pulse ? 'status-pulse 2.5s ease-in-out infinite' : 'none',
                marginLeft: 'auto',
              }}
            >
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: color, flexShrink: 0,
                boxShadow: pulse ? `0 0 6px ${color}` : 'none',
              }} />
              API
              {icon === 'on'  && <WifiOnIcon  size={13} />}
              {icon === 'off' && <WifiOffIcon size={13} />}
              {icon === 'none' && <span style={{ fontSize: 10 }}>…</span>}
            </button>
          </div>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
