import { useEffect, useState } from 'react';
import { Pencil, Trash2, Lock, Plus, RotateCcw, Save, Copy } from 'lucide-react';
import api from '../api.js';
import Modal from '../components/Modal.jsx';
import Toast from '../components/Toast.jsx';
import { fmtDate } from '../utils/format.js';
import { RULE_GROUPS, DEFAULT_RULES } from '../state/defaultRules.js';

export default function RuleProfilesPage() {
  const [profiles, setProfiles] = useState([]);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', rules: { ...DEFAULT_RULES } });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ name: '', description: '', rules: { ...DEFAULT_RULES } });
  const [toast, setToast] = useState(null);

  const load = () => api.get('/rule-profiles').then((r) => setProfiles(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const openEdit = (p) => {
    setEditTarget(p);
    setEditForm({ name: p.name, description: p.description || '', rules: { ...p.rules } });
  };

  const submitEdit = async () => {
    if (!editForm.name.trim()) {
      setToast({ message: 'Name required.', kind: 'error' });
      return;
    }
    try {
      await api.put(`/rule-profiles/${editTarget.id}`, editForm);
      setEditTarget(null);
      load();
      setToast({ message: 'Profile updated.', kind: 'info' });
    } catch (e) {
      setToast({ message: e.message || 'Update failed.', kind: 'error' });
    }
  };

  const submitDelete = async () => {
    try {
      await api.delete(`/rule-profiles/${confirmDelete.id}`);
      setConfirmDelete(null);
      load();
      setToast({ message: 'Profile deleted.', kind: 'info' });
    } catch (e) {
      setToast({ message: e.message || 'Delete failed.', kind: 'error' });
    }
  };

  const submitNew = async () => {
    if (!newForm.name.trim()) {
      setToast({ message: 'Name required.', kind: 'error' });
      return;
    }
    try {
      await api.post('/rule-profiles', newForm);
      setShowNew(false);
      setNewForm({ name: '', description: '', rules: { ...DEFAULT_RULES } });
      load();
      setToast({ message: 'Profile created.', kind: 'info' });
    } catch (e) {
      setToast({ message: e.message || 'Create failed.', kind: 'error' });
    }
  };

  const duplicateProfile = (p) => {
    setNewForm({
      name: `${p.name} (copy)`,
      description: p.description || '',
      rules: { ...p.rules },
    });
    setShowNew(true);
  };

  const renderRulesFields = (rulesObj, onChangeRule, readOnly = false) => (
    <div>
      {RULE_GROUPS.map((group) => (
        <div key={group.key} style={{ marginBottom: 18 }}>
          <div className="rules-subgroup-title" style={{ color: 'var(--octave-text-muted)' }}>
            {group.title}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {group.fields.map((field) => (
              <div className="field" key={field.key}>
                <label className="field-label" title={field.hint}>
                  {field.label}
                </label>
                <input
                  type="number"
                  className="field-input"
                  step={field.step}
                  value={rulesObj[field.key] ?? ''}
                  readOnly={readOnly}
                  onChange={(e) =>
                    onChangeRule(field.key, e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Rule Profiles</h1>
          <div className="page-subtitle">
            Reusable model-rules presets. System profiles (locked) ship with the product; create your
            own profiles to capture custom calibrations for different operations.
          </div>
        </div>
        <button type="button" className="btn btn-accent" onClick={() => setShowNew(true)}>
          <Plus size={14} /> New profile
        </button>
      </div>

      <div className="card-grid">
        {profiles.map((p) => (
          <div className="card" key={p.id}>
            {p.is_system && <Lock size={14} className="card-system-lock" />}
            <div className="card-pill">{p.is_system ? 'System' : 'Custom'}</div>
            <div className="card-title">{p.name}</div>
            {p.description && <div className="card-description">{p.description}</div>}
            <div className="card-meta" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span>Tank: {(p.rules.tank_threshold * 100).toFixed(0)}%</span>
              <span>Iters: {p.rules.max_iterations}</span>
              <span>Evac: {p.rules.evac_severity}</span>
            </div>
            <div className="card-actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>
                <Pencil size={12} /> {p.is_system ? 'View' : 'Edit'}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => duplicateProfile(p)}>
                <Copy size={12} /> Duplicate
              </button>
              {!p.is_system && (
                <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => setConfirmDelete(p)}>
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {editTarget && (
        <Modal
          title={editTarget.is_system ? `${editTarget.name} (system, read-only)` : `Edit "${editTarget.name}"`}
          subtitle={editTarget.is_system ? 'System profiles can be renamed but rule values are read-only.' : null}
          onClose={() => setEditTarget(null)}
          actions={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setEditTarget(null)}>
                {editTarget.is_system ? 'Close' : 'Cancel'}
              </button>
              <button type="button" className="btn btn-accent" onClick={submitEdit}>
                <Save size={12} /> Save
              </button>
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
              />
            </div>
            <div className="field">
              <label className="field-label">Description</label>
              <textarea
                className="field-input"
                rows={2}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>
            {!editTarget.is_system && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => setEditForm({ ...editForm, rules: { ...DEFAULT_RULES } })}
              >
                <RotateCcw size={12} /> Reset to defaults
              </button>
            )}
          </div>
          {renderRulesFields(
            editForm.rules,
            (key, value) => setEditForm({ ...editForm, rules: { ...editForm.rules, [key]: value } }),
            editTarget.is_system
          )}
        </Modal>
      )}

      {confirmDelete && (
        <Modal
          title="Delete Profile?"
          subtitle={`This will permanently delete "${confirmDelete.name}".`}
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
          <p style={{ color: 'var(--octave-text-muted)', fontSize: 13 }}>Are you sure?</p>
        </Modal>
      )}

      {showNew && (
        <Modal
          title="New Rule Profile"
          subtitle="Create a custom rules preset. You can apply it to scenarios on the Optimizer page."
          onClose={() => setShowNew(false)}
          actions={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setShowNew(false)}>Cancel</button>
              <button type="button" className="btn btn-accent" onClick={submitNew}>
                <Save size={12} /> Create
              </button>
            </>
          }
        >
          <div className="modal-fields">
            <div className="field">
              <label className="field-label">Name</label>
              <input
                type="text"
                className="field-input"
                value={newForm.name}
                onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                autoFocus
              />
            </div>
            <div className="field">
              <label className="field-label">Description</label>
              <textarea
                className="field-input"
                rows={2}
                value={newForm.description}
                onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
              />
            </div>
          </div>
          {renderRulesFields(newForm.rules, (key, value) =>
            setNewForm({ ...newForm, rules: { ...newForm.rules, [key]: value } })
          )}
        </Modal>
      )}

      <Toast message={toast?.message} kind={toast?.kind} onDismiss={() => setToast(null)} />
    </div>
  );
}
