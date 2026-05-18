import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FolderOpen, Trash2, Pencil, Plus, Search } from 'lucide-react';
import api from '../api.js';
import Modal from '../components/Modal.jsx';
import Toast from '../components/Toast.jsx';
import { fmtDate } from '../utils/format.js';

export default function ScenariosPage() {
  const navigate = useNavigate();
  const [scenarios, setScenarios] = useState([]);
  const [filter, setFilter] = useState('');
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [toast, setToast] = useState(null);

  const load = () => api.get('/scenarios').then((r) => setScenarios(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const loadIntoOptimizer = async (id) => {
    try {
      const r = await api.get(`/scenarios/${id}`);
      navigate('/optimizer', { state: { scenario: r.data } });
    } catch (e) {
      setToast({ message: e.message || 'Failed to load.', kind: 'error' });
    }
  };

  const openEdit = (s) => {
    setEditTarget(s);
    setEditForm({ name: s.name, description: s.description || '' });
  };

  const submitEdit = async () => {
    if (!editForm.name.trim()) {
      setToast({ message: 'Name required.', kind: 'error' });
      return;
    }
    try {
      const fresh = await api.get(`/scenarios/${editTarget.id}`);
      await api.put(`/scenarios/${editTarget.id}`, {
        ...fresh.data,
        name: editForm.name,
        description: editForm.description,
      });
      setEditTarget(null);
      load();
      setToast({ message: 'Scenario updated.', kind: 'info' });
    } catch (e) {
      setToast({ message: e.message || 'Update failed.', kind: 'error' });
    }
  };

  const submitDelete = async () => {
    try {
      await api.delete(`/scenarios/${confirmDelete.id}`);
      setConfirmDelete(null);
      load();
      setToast({ message: 'Scenario deleted.', kind: 'info' });
    } catch (e) {
      setToast({ message: e.message || 'Delete failed.', kind: 'error' });
    }
  };

  const filtered = scenarios.filter(
    (s) =>
      !filter ||
      s.name.toLowerCase().includes(filter.toLowerCase()) ||
      (s.operator_label || '').toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Scenarios</h1>
          <div className="page-subtitle">
            Saved configurations. Load any of them into the optimizer to re-run, edit, or compare.
          </div>
        </div>
        <div className="flex-row">
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--octave-text-muted)' }} />
            <input
              type="text"
              className="field-input"
              style={{ paddingLeft: 32, background: 'var(--octave-bg)', color: 'var(--octave-text)', border: '1px solid var(--octave-n300)' }}
              placeholder="Filter scenarios…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>
      </div>

      {scenarios.length === 0 && (
        <div className="empty-state" style={{ minHeight: 240 }}>
          <p>
            No scenarios yet. Go to the <Link to="/optimizer">Optimizer</Link>, configure a plan, then{' '}
            <strong>Save scenario</strong>.
          </p>
        </div>
      )}

      <div className="card-grid">
        <Link to="/optimizer" className="card-empty">
          <span>
            <Plus size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} /> New scenario
          </span>
        </Link>

        {filtered.map((s) => (
          <div className="card" key={s.id}>
            <div className="card-pill">{s.operator_label || 'Operator'}</div>
            <div className="card-title">{s.name}</div>
            {s.description && <div className="card-description">{s.description}</div>}
            <div className="card-meta">
              {s.rule_profile_name ? `Profile: ${s.rule_profile_name}` : 'Custom rules'} · Updated {fmtDate(s.updated_at)}
            </div>
            <div className="card-actions">
              <button type="button" className="btn btn-accent btn-sm" onClick={() => loadIntoOptimizer(s.id)}>
                <FolderOpen size={12} /> Load
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(s)}>
                <Pencil size={12} /> Rename
              </button>
              <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => setConfirmDelete(s)}>
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {editTarget && (
        <Modal
          title="Rename Scenario"
          onClose={() => setEditTarget(null)}
          actions={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setEditTarget(null)}>Cancel</button>
              <button type="button" className="btn btn-accent" onClick={submitEdit}>Save</button>
            </>
          }
        >
          <div className="modal-fields">
            <div className="field">
              <label className="field-label">Name</label>
              <input
                type="text"
                className="field-input"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                autoFocus
              />
            </div>
            <div className="field">
              <label className="field-label">Description</label>
              <textarea
                className="field-input"
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal
          title="Delete Scenario?"
          subtitle={`This will permanently delete "${confirmDelete.name}". This cannot be undone.`}
          onClose={() => setConfirmDelete(null)}
          actions={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={submitDelete} style={{ background: 'var(--danger)' }}>
                <Trash2 size={12} /> Delete
              </button>
            </>
          }
        >
          <p style={{ color: 'var(--octave-text-muted)', fontSize: 13 }}>
            Are you sure?
          </p>
        </Modal>
      )}

      <Toast message={toast?.message} kind={toast?.kind} onDismiss={() => setToast(null)} />
    </div>
  );
}
