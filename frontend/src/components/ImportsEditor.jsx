import { Plus, X } from 'lucide-react';

export default function ImportsEditor({ rows, operatorLabel, onAdd, onUpdate, onRemove }) {
  return (
    <>
      <div className="dyn-rows">
        {rows.map((row, i) => (
          <div className="dyn-row" key={i}>
            <select
              className="field-select"
              value={row.party}
              onChange={(e) => onUpdate(i, 'party', e.target.value)}
            >
              <option value="OPERATOR">{operatorLabel || 'Operator'}</option>
              <option value="COMP">Competitor</option>
            </select>
            <input
              type="date"
              className="field-input"
              value={row.arrival_date}
              onChange={(e) => onUpdate(i, 'arrival_date', e.target.value)}
            />
            <input
              type="number"
              className="field-input"
              placeholder="MT"
              value={row.quantity_mt ?? ''}
              onChange={(e) =>
                onUpdate(i, 'quantity_mt', e.target.value === '' ? '' : parseFloat(e.target.value))
              }
            />
            <button
              type="button"
              className="btn-row-del"
              onClick={() => onRemove(i)}
              aria-label="Remove import"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="btn-row-add" onClick={onAdd}>
        <Plus size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Add import
      </button>
    </>
  );
}
