import { useState } from 'react';
import { Plus, X } from 'lucide-react';

const OVERRIDE_FIELDS = [
  { key: 'operator_demand', label: 'Our demand (MT)' },
  { key: 'comp_demand', label: 'Comp demand (MT)' },
  { key: 'operator_limit', label: 'Our tank limit (MT)' },
  { key: 'comp_limit', label: 'Comp tank limit (MT)' },
  { key: 'operator_import', label: 'Extra our import (MT)' },
  { key: 'comp_import', label: 'Extra comp import (MT)' },
  { key: 'operator_sfs', label: 'Extra our SFS (MT)' },
  { key: 'comp_sfs', label: 'Extra comp SFS (MT)' },
  { key: 'operator_priced_cost', label: 'Our priced cost ($/MT)' },
  { key: 'operator_unpriced_cost', label: 'Our unpriced cost ($/MT)' },
  { key: 'comp_priced_cost', label: 'Comp priced cost ($/MT)' },
  { key: 'comp_unpriced_cost', label: 'Comp unpriced cost ($/MT)' },
];

export default function DayOverridesEditor({ overrides, numDays, onSet, onRemoveDay }) {
  const [newDay, setNewDay] = useState('');
  const [newField, setNewField] = useState(OVERRIDE_FIELDS[0].key);
  const [newValue, setNewValue] = useState('');

  const dayKeys = Object.keys(overrides).sort((a, b) => Number(a) - Number(b));

  const addOverride = () => {
    const d = parseInt(newDay, 10);
    if (!d || d < 1 || d > numDays) return;
    const v = parseFloat(newValue);
    if (!Number.isFinite(v)) return;
    onSet(d, newField, v);
    setNewDay('');
    setNewValue('');
  };

  return (
    <>
      {dayKeys.length === 0 && (
        <div className="section-help" style={{ marginBottom: 12 }}>
          No per-day overrides. Use these to model planned events on specific days.
        </div>
      )}

      {dayKeys.map((dayKey) => (
        <div key={dayKey} style={{ marginBottom: 14, padding: 8, border: '1px solid #1f1f1f', borderRadius: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <strong style={{ fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--octave-accent)' }}>
              Day {dayKey}
            </strong>
            <button
              type="button"
              className="btn-row-del"
              onClick={() => onRemoveDay(parseInt(dayKey, 10))}
              aria-label="Remove day overrides"
            >
              <X size={12} />
            </button>
          </div>
          {Object.entries(overrides[dayKey]).map(([k, v]) => {
            const label = OVERRIDE_FIELDS.find((f) => f.key === k)?.label || k;
            return (
              <div key={k} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 22px', gap: 4, alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--octave-text-muted-on-panel)' }}>{label}</span>
                <input
                  type="number"
                  className="field-input"
                  style={{ fontSize: 11, padding: '4px 6px' }}
                  value={v ?? ''}
                  onChange={(e) =>
                    onSet(parseInt(dayKey, 10), k, e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
                />
                <button
                  type="button"
                  className="btn-row-del"
                  onClick={() => onSet(parseInt(dayKey, 10), k, '')}
                  aria-label="Clear field"
                >
                  <X size={10} />
                </button>
              </div>
            );
          })}
        </div>
      ))}

      <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 70px 28px', gap: 4, alignItems: 'center' }}>
        <input
          type="number"
          className="field-input"
          placeholder="Day"
          value={newDay}
          min={1}
          max={numDays}
          onChange={(e) => setNewDay(e.target.value)}
          style={{ fontSize: 11, padding: '6px 8px' }}
        />
        <select
          className="field-select"
          value={newField}
          onChange={(e) => setNewField(e.target.value)}
          style={{ fontSize: 11, padding: '6px 8px' }}
        >
          {OVERRIDE_FIELDS.map((f) => (
            <option key={f.key} value={f.key}>{f.label}</option>
          ))}
        </select>
        <input
          type="number"
          className="field-input"
          placeholder="Value"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          style={{ fontSize: 11, padding: '6px 8px' }}
        />
        <button
          type="button"
          className="btn-row-del"
          onClick={addOverride}
          aria-label="Add override"
          style={{ color: 'var(--octave-accent)' }}
        >
          <Plus size={14} />
        </button>
      </div>
    </>
  );
}
