import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DemoNotice, shouldShowDemoNotice } from '../components/DemoNotice';
import { api, keepTraining } from '../lib/api';
import { useAuth } from '../lib/auth';

type Dash = {
  recent_jobs: Array<{
    id: string;
    name: string;
    status: string;
    progress: number;
    created_at: number;
  }>;
  counts: Record<string, number> & { has_api_key?: boolean };
  demo?: {
    max_download_rows?: number;
    has_api_key?: boolean;
    csv_only?: boolean;
    presets_only_without_key?: boolean;
  };
  usage: { jobs_this_month: number; note: string };
};

export function HomePage() {
  const [data, setData] = useState<Dash | null>(null);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showDemo, setShowDemo] = useState(false);
  const nav = useNavigate();
  const { can, user } = useAuth();

  useEffect(() => {
    api<Dash>('/v1/dashboard')
      .then(setData)
      .catch((e) => setErr(e.message));
  }, []);

  useEffect(() => {
    if (!user) return;
    setShowDemo(shouldShowDemoNotice(user.id));
  }, [user]);

  async function onKeepTraining(jobId: string) {
    setErr('');
    setBusyId(jobId);
    try {
      const job = await keepTraining(jobId);
      nav(`/jobs/${job.id}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Keep Training failed');
    } finally {
      setBusyId(null);
    }
  }

  const hasApiKey = Boolean(data?.demo?.has_api_key ?? data?.counts?.has_api_key);
  const maxRows = data?.demo?.max_download_rows ?? 150;

  return (
    <div>
      {showDemo && (
        <DemoNotice
          maxDownloadRows={maxRows}
          hasApiKey={hasApiKey}
          onDismiss={() => setShowDemo(false)}
        />
      )}
      <h1 className="page-title">Home</h1>
      <p className="page-sub">Seed jobs, sources, and evidence at a glance</p>
      {err && <div className="err">{err}</div>}
      <div className="row" style={{ marginBottom: 16 }}>
        <Link className="btn" to="/jobs/new">New seed job</Link>
        <Link className="btn sec" to="/settings/integrations">Connect Salesforce</Link>
        <Link className="btn sec" to="/sources/new">Add source</Link>
      </div>

      {data && !hasApiKey && (
        <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--accent, #4f46e5)' }}>
          <h3 style={{ marginTop: 0 }}>Demo mode</h3>
          <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 2 }}>
            <li>
              <strong>Run a preset job</strong> — open <Link to="/jobs/new">New seed job</Link> and
              pick a built-in preset source (no API key needed).
            </li>
            <li>
              <strong>Review the report</strong> — fidelity, privacy, and relation checks without
              internal model details.
            </li>
            <li>
              <strong>Download</strong> — up to {maxRows} synthetic rows per table (ZIP of CSVs when
              the source is relational).
            </li>
            <li>
              <strong>Request an API key</strong> — go to <Link to="/settings">Settings</Link> for
              custom sources and ML / adapt training.
            </li>
          </ol>
        </div>
      )}
      {data && (
        <>
          <div data-tour="home-stats" className="grid-3" style={{ marginBottom: 16 }}>
            <div className="kpi">
              <div className="label">Sources</div>
              <div className="val">{data.counts.sources}</div>
            </div>
            <div className="kpi">
              <div className="label">Policies</div>
              <div className="val">{data.counts.policies}</div>
            </div>
            <div className="kpi">
              <div className="label">Jobs</div>
              <div className="val">{data.counts.jobs}</div>
            </div>
          </div>
          <div className="card">
            <h3>Recent jobs</h3>
            {!data.recent_jobs.length && <p className="muted">No jobs yet.</p>}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Progress</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_jobs.map((j) => (
                    <tr key={j.id}>
                      <td>{j.name}</td>
                      <td>
                        <span className={`pill ${j.status}`}>{j.status}</span>
                      </td>
                      <td>{Math.round((j.progress || 0) * 100)}%</td>
                      <td>
                        <Link to={`/jobs/${j.id}`}>Open</Link>
                        {j.status === 'done' && (
                          <>
                            {' · '}
                            <Link to={`/jobs/${j.id}/report`}>Evidence</Link>
                            {can('run_jobs') && hasApiKey && (
                              <>
                                {' · '}
                                <button
                                  type="button"
                                  className="linkish"
                                  disabled={busyId === j.id}
                                  onClick={() => onKeepTraining(j.id)}
                                  title="Continue from this config with a longer train plus 250 more search trials. Stop anytime to keep the best so far."
                                >
                                  {busyId === j.id ? 'Starting…' : 'Keep Training'}
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted" style={{ marginTop: 10 }}>
              {data.usage.note}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
