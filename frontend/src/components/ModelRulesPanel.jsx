import { useState } from 'react';
import { RotateCcw, Save, FolderOpen } from 'lucide-react';
import { RULE_GROUPS, DEFAULT_RULES } from '../state/defaultRules.js';
import InfoButton from './InfoButton.jsx';

export default function ModelRulesPanel({
  rules,
  ruleProfileId,
  ruleProfiles,
  onChangeRule,
  onReset,
  onSaveAs,
  onApplyProfile,
}) {
  const [hint, setHint] = useState(null);

  const activeProfile = ruleProfiles.find((p) => p.id === ruleProfileId);

  return (
    <div>
      <div className="section-help" style={{ marginBottom: 12 }}>
        Tune the optimizer's internal calibration. Defaults reproduce the baseline behavior.
        Settings persist in the current scenario only — save them as a Rule Profile to reuse.
      </div>

      {ruleProfiles.length > 0 && (
        <div className="field" style={{ marginBottom: 12 }}>
          <label className="field-label">Active rule profile</label>
          <select
            className="field-select"
            value={ruleProfileId || ''}
            onChange={(e) => {
              const id = e.target.value ? parseInt(e.target.value, 10) : null;
              const profile = ruleProfiles.find((p) => p.id === id);
              onApplyProfile(id, profile?.rules);
            }}
          >
            <option value="">(custom — not linked)</option>
            {ruleProfiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.is_system ? ' (system)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {RULE_GROUPS.map((group) => (
        <div className="rules-subgroup" key={group.key}>
          <div className="rules-subgroup-title">{group.title}</div>
          {group.fields.map((field) => {
            const isDefault = rules[field.key] === DEFAULT_RULES[field.key];
            return (
              <div className="field" key={field.key} style={{ marginBottom: 8 }}>
                <div className="field-label-row">
                  <label className="field-label" style={{ flex: 1 }}>
                    {field.label}
                    {!isDefault && (
                      <span style={{ color: 'var(--octave-accent)', marginLeft: 6 }}>•</span>
                    )}
                  </label>
                  <InfoButton
                    title={field.label}
                    body={
                      <>
                        <p>{field.hint}</p>
                        <p style={{ marginTop: 6, color: 'var(--octave-text-muted)' }}>
                          Default: <code>{DEFAULT_RULES[field.key]}</code>
                        </p>
                      </>
                    }
                    variant="on-dark"
                    size={12}
                  />
                </div>
                <input
                  type="number"
                  className="field-input"
                  step={field.step}
                  value={rules[field.key] ?? ''}
                  onChange={(e) =>
                    onChangeRule(field.key, e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
                />
              </div>
            );
          })}
        </div>
      ))}

      <div className="rules-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onReset}>
          <RotateCcw size={12} /> Reset
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onSaveAs}>
          <Save size={12} /> Save as profile
        </button>
      </div>

      {activeProfile && (
        <div className="section-help" style={{ marginTop: 10 }}>
          Linked to profile: <strong>{activeProfile.name}</strong>
          {activeProfile.is_system && ' (system, read-only)'}
        </div>
      )}
    </div>
  );
}
