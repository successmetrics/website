/**
 * Projects — cross-application referential integrity.
 *
 * A project groups sources that share an entity type (e.g. "patient").
 * After each synthesis job, the identity registry maps real_id → synthetic_id
 * so the same entity keeps the same synthetic identity across applications.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  addProjectSource,
  createProject,
  deleteProject,
  getIdentityRegistry,
  listProjects,
  removeProjectSource,
  type Project,
} from '../lib/api';
import { useAuth } from '../lib/auth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(ts: number | undefined) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Create project modal
// ---------------------------------------------------------------------------

function CreateProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: (p: Project) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [entityType, setEntityType] = useState('patient');
  const [idColumn, setIdColumn] = useState('id');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErr('Name is required'); return; }
    setSaving(true);
    setErr('');
    try {
      const p = await createProject({ name, description, entity_type: entityType, id_column: idColumn });
      onCreated(p);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to create project');
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: 420, maxWidth: '95vw' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0 }}>New Project</h3>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Name *</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. McKesson Patient Registry"
              autoFocus
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Description</label>
            <input
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Entity type</label>
              <input
                className="input"
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                placeholder="patient"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>ID column</label>
              <input
                className="input"
                value={idColumn}
                onChange={(e) => setIdColumn(e.target.value)}
                placeholder="id"
              />
            </div>
          </div>
          {err && <p style={{ color: 'var(--red)', fontSize: 12, margin: 0 }}>{err}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn sec" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn pri" disabled={saving}>
              {saving ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add source to project panel
// ---------------------------------------------------------------------------

function AddSourcePanel({
  projectId,
  existingSourceIds,
  onAdded,
}: {
  projectId: string;
  existingSourceIds: Set<string>;
  onAdded: () => void;
}) {
  const [sourceId, setSourceId] = useState('');
  const [appName, setAppName] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sourceId.trim()) { setErr('Source ID is required'); return; }
    if (existingSourceIds.has(sourceId.trim())) { setErr('Source already in this project'); return; }
    setSaving(true);
    setErr('');
    try {
      await addProjectSource(projectId, { source_id: sourceId.trim(), app_name: appName.trim() });
      setSourceId('');
      setAppName('');
      onAdded();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to add source');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 10 }}>
      <div>
        <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>Source ID</label>
        <input
          className="input"
          style={{ width: 220, fontSize: 12 }}
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          placeholder="src_abc123"
        />
      </div>
      <div>
        <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>App name (optional)</label>
        <input
          className="input"
          style={{ width: 160, fontSize: 12 }}
          value={appName}
          onChange={(e) => setAppName(e.target.value)}
          placeholder="App A"
        />
      </div>
      <button type="submit" className="btn pri sm" disabled={saving}>{saving ? 'Adding…' : 'Add source'}</button>
      {err && <span style={{ color: 'var(--red)', fontSize: 11 }}>{err}</span>}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Registry viewer
// ---------------------------------------------------------------------------

function RegistryPanel({ projectId }: { projectId: string }) {
  const [entries, setEntries] = useState<{ real_id: string; synthetic_id: string; entity_type: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    setLoading(true);
    getIdentityRegistry(projectId)
      .then((res) => { setEntries(res.entries); setLoading(false); })
      .catch((e) => { setErr(e.message); setLoading(false); });
  }, [projectId]);

  if (loading) return <p className="muted" style={{ fontSize: 12 }}>Loading registry…</p>;
  if (err) return <p style={{ color: 'var(--red)', fontSize: 12 }}>{err}</p>;
  if (!entries.length) return <p className="muted" style={{ fontSize: 12 }}>No identity mappings yet. Run a synthesis job on a source in this project to populate the registry.</p>;

  return (
    <div className="table-wrap" style={{ maxHeight: 240, marginTop: 8 }}>
      <table>
        <thead>
          <tr>
            <th>Entity type</th>
            <th>Real ID</th>
            <th>Synthetic ID</th>
          </tr>
        </thead>
        <tbody>
          {entries.slice(0, 200).map((e, i) => (
            <tr key={i}>
              <td><code style={{ fontSize: 11 }}>{e.entity_type}</code></td>
              <td><code style={{ fontSize: 11 }}>{e.real_id}</code></td>
              <td><code style={{ fontSize: 11 }}>{e.synthetic_id}</code></td>
            </tr>
          ))}
        </tbody>
      </table>
      {entries.length > 200 && (
        <p className="muted" style={{ fontSize: 11, padding: '4px 8px' }}>Showing 200 of {entries.length} entries</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Project detail row (expandable)
// ---------------------------------------------------------------------------

function ProjectRow({
  project,
  onDeleted,
  onRefresh,
}: {
  project: Project;
  onDeleted: () => void;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showRegistry, setShowRegistry] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete project "${project.name}"? This will remove all identity mappings.`)) return;
    setDeleting(true);
    try {
      await deleteProject(project.id);
      onDeleted();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Delete failed');
      setDeleting(false);
    }
  }

  async function handleRemoveSource(sourceId: string) {
    if (!confirm('Remove this source from the project?')) return;
    await removeProjectSource(project.id, sourceId);
    onRefresh();
  }

  return (
    <div className="card" style={{ marginBottom: 10 }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn sec sm"
              style={{ fontSize: 11, padding: '2px 6px' }}
              onClick={() => setExpanded((x) => !x)}
            >
              {expanded ? '▼' : '▶'}
            </button>
            <h3 style={{ margin: 0, fontSize: 15 }}>{project.name}</h3>
            <span
              style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 10,
                background: 'var(--bg-2, rgba(128,128,128,0.12))',
                color: 'var(--fg-2)',
              }}
            >
              {project.entity_type}
            </span>
          </div>
          {project.description && (
            <p className="muted" style={{ fontSize: 12, margin: '4px 0 0 28px' }}>{project.description}</p>
          )}
          <p className="muted" style={{ fontSize: 11, margin: '3px 0 0 28px' }}>
            {project.sources.length} source{project.sources.length !== 1 ? 's' : ''} ·{' '}
            {project.registry_size.toLocaleString()} identity mapping{project.registry_size !== 1 ? 's' : ''} ·{' '}
            ID column: <code style={{ fontSize: 10 }}>{project.id_column}</code> ·{' '}
            Created {fmtDate(project.created_at)}
          </p>
        </div>
        <button
          className="btn sec sm"
          style={{ fontSize: 11, color: 'var(--red)', marginLeft: 8 }}
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          {/* Sources */}
          <h4 style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600 }}>Sources in this project</h4>
          {project.sources.length === 0 ? (
            <p className="muted" style={{ fontSize: 12, margin: '0 0 8px' }}>No sources yet.</p>
          ) : (
            <div className="table-wrap" style={{ marginBottom: 8 }}>
              <table>
                <thead>
                  <tr>
                    <th>Ordinal</th>
                    <th>App name</th>
                    <th>Source</th>
                    <th>Kind</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {project.sources.map((s) => (
                    <tr key={s.source_id}>
                      <td className="muted" style={{ fontSize: 12 }}>{s.ordinal}</td>
                      <td style={{ fontSize: 12 }}>{s.app_name || <span className="muted">—</span>}</td>
                      <td>
                        <Link to={`/sources/${s.source_id}`} style={{ fontSize: 12 }}>
                          {s.source_name}
                        </Link>
                      </td>
                      <td>
                        <code style={{ fontSize: 11 }}>{s.source_kind}</code>
                      </td>
                      <td>
                        <button
                          className="btn sec sm"
                          style={{ fontSize: 11, color: 'var(--red)' }}
                          onClick={() => handleRemoveSource(s.source_id)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <AddSourcePanel
            projectId={project.id}
            existingSourceIds={new Set(project.sources.map((s) => s.source_id))}
            onAdded={onRefresh}
          />

          {/* Identity registry */}
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h4 style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>Identity Registry</h4>
              <button
                className="btn sec sm"
                style={{ fontSize: 11, padding: '1px 6px' }}
                onClick={() => setShowRegistry((x) => !x)}
              >
                {showRegistry ? 'Hide' : `Show (${project.registry_size.toLocaleString()})`}
              </button>
            </div>
            {showRegistry && <RegistryPanel projectId={project.id} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const res = await listProjects();
      setProjects(res.projects);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function handleCreated(p: Project) {
    setProjects((prev) => [p, ...prev]);
    setShowCreate(false);
  }

  if (!user) return null;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>Projects</h2>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Group sources that share an entity type to maintain cross-application referential integrity.
            After each synthesis job, a real_id → synthetic_id registry ensures the same entity gets
            the same synthetic identity in every application.
          </p>
        </div>
        <button className="btn pri" style={{ marginLeft: 16, whiteSpace: 'nowrap' }} onClick={() => setShowCreate(true)}>
          + New project
        </button>
      </div>

      {/* Info callout */}
      <div
        className="card"
        style={{ background: 'rgba(76,110,245,0.06)', border: '1px solid rgba(76,110,245,0.2)', marginBottom: 18, padding: '10px 14px' }}
      >
        <p style={{ margin: 0, fontSize: 12 }}>
          <strong>How it works:</strong> Add sources from different applications to a project (e.g. EHR Postgres + Claims MongoDB).
          When you run a synthesis job on any source in the project, the <code>id_column</code> values are registered in the
          identity registry so the same patient/member gets the same synthetic ID across all apps.
          This preserves referential integrity without exposing real identifiers.
        </p>
      </div>

      {/* Content */}
      {loading && <p className="muted">Loading projects…</p>}
      {err && <p style={{ color: 'var(--red)' }}>{err}</p>}

      {!loading && !err && projects.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ fontSize: 28, margin: '0 0 8px' }}>🔗</p>
          <p style={{ fontWeight: 600, margin: '0 0 4px' }}>No projects yet</p>
          <p className="muted" style={{ fontSize: 13, margin: '0 0 16px' }}>
            Create a project to link sources across applications and maintain consistent synthetic identities.
          </p>
          <button className="btn pri" onClick={() => setShowCreate(true)}>Create your first project</button>
        </div>
      )}

      {projects.map((p) => (
        <ProjectRow
          key={p.id}
          project={p}
          onDeleted={() => setProjects((prev) => prev.filter((x) => x.id !== p.id))}
          onRefresh={load}
        />
      ))}

      {showCreate && (
        <CreateProjectModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}
    </div>
  );
}
