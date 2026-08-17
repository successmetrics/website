import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';

type Stage = 'loading' | 'review' | 'working' | 'ok' | 'err';

type Preview = {
  ok: boolean;
  message: string;
  name?: string;
  email?: string;
  company?: string;
  reason?: string;
  pending?: boolean;
  code?: string;
};

/**
 * Public page for the admin email "Review & approve" button.
 * GET only loads a preview. Confirming POSTs through the /api proxy.
 */
export function ApproveApiKeyPage() {
  const { reqId = '' } = useParams();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [stage, setStage] = useState<Stage>('loading');
  const [message, setMessage] = useState('Loading request…');
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!reqId || !token) {
        setStage('err');
        setMessage('Invalid approval link.');
        return;
      }
      try {
        const r = await api<Preview>(
          `/v1/admin/approve/${encodeURIComponent(reqId)}?token=${encodeURIComponent(token)}&format=json`,
        );
        if (!alive) return;
        setPreview(r);
        if (!r.pending || r.code === 'already_approved') {
          setStage('ok');
          setMessage(r.message || 'Already approved.');
          return;
        }
        setStage('review');
        setMessage(r.message || 'Review this request.');
      } catch (e: unknown) {
        if (!alive) return;
        const status = e instanceof ApiError ? e.status : 0;
        if (status === 404) {
          setStage('err');
          setMessage(
            'This approve link hit the private API host (404). Open it in the Safe-Seed app instead, or approve from Settings.',
          );
          return;
        }
        setStage('err');
        setMessage(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Invalid approval link.');
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [reqId, token]);

  async function confirm() {
    setStage('working');
    setMessage('Sending API key…');
    try {
      const r = await api<Preview>(
        `/v1/admin/approve/${encodeURIComponent(reqId)}?format=json`,
        { method: 'POST', json: { token } },
      );
      setStage(r.ok ? 'ok' : 'err');
      setMessage(r.message || (r.ok ? 'Approved.' : 'Approval failed.'));
    } catch (e: unknown) {
      const status = e instanceof ApiError ? e.status : 0;
      if (status === 404 || status === 405) {
        try {
          const legacy = await api<Preview>(
            `/v1/admin/approve/${encodeURIComponent(reqId)}?token=${encodeURIComponent(token)}&format=json`,
          );
          const granted = Boolean(legacy.ok) && legacy.pending === false;
          setStage(granted || /approv/i.test(legacy.message || '') ? 'ok' : 'err');
          setMessage(legacy.message || 'Approved.');
          return;
        } catch {
          /* fall through */
        }
      }
      setStage('err');
      setMessage(
        status === 404
          ? 'Approve via API Manager. Email links to the private API host cannot be opened in the browser.'
          : e instanceof ApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : 'Approval failed.',
      );
    }
  }

  const ok = stage === 'ok';
  const color = ok ? '#166534' : stage === 'err' ? '#991b1b' : '#374151';
  const bg = ok ? '#f0fdf4' : stage === 'err' ? '#fef2f2' : '#fff';

  return (
    <div className="auth-wrap">
      <div
        className="card auth-card"
        style={{ textAlign: 'center', background: bg, borderColor: `${color}22` }}
      >
        <h1 className="page-title" style={{ color }}>
          {stage === 'loading' || stage === 'working'
            ? 'Working…'
            : stage === 'review'
              ? 'Review API key request'
              : ok
                ? '✓ Approved'
                : '✗ Not approved'}
        </h1>
        <p className="page-sub">{message}</p>
        {stage === 'review' && preview && (
          <div style={{ textAlign: 'left', margin: '16px 0', fontSize: 14 }}>
            <p><strong>Name:</strong> {preview.name || '—'}</p>
            <p><strong>Email:</strong> {preview.email || '—'}</p>
            <p><strong>Company:</strong> {preview.company || '—'}</p>
            <p><strong>Reason:</strong> {preview.reason || '—'}</p>
            <button className="btn" type="button" onClick={() => void confirm()} style={{ marginTop: 12, width: '100%' }}>
              Approve &amp; email API key
            </button>
          </div>
        )}
        {stage === 'err' && (
          <p className="muted" style={{ marginTop: 16 }}>
            Logged in as the admin? Approve from <a href="/api-manager">API Manager</a>.
          </p>
        )}
        {stage !== 'review' && stage !== 'err' && (
          <p style={{ marginTop: 16, fontSize: 13, color: 'var(--muted)' }}>You can close this tab.</p>
        )}
      </div>
    </div>
  );
}
