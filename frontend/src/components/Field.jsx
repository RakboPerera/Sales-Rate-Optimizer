import InfoButton from './InfoButton.jsx';
import { getHelp } from '../utils/explanations.jsx';

function LabelWithInfo({ label, suffix, infoKey, variant = 'on-dark' }) {
  const help = infoKey ? getHelp(infoKey) : null;
  return (
    <div className="field-label-row">
      <label className="field-label" style={{ flex: 1 }}>
        {label}{suffix ? ` (${suffix})` : ''}
      </label>
      {help && <InfoButton title={help.title} body={help.body} variant={variant} size={12} />}
    </div>
  );
}

export function FieldRow({ children, full }) {
  return <div className={`field-row${full ? ' full' : ''}`}>{children}</div>;
}

export function NumberField({ label, value, onChange, step = 1, min, max, error, suffix, infoKey, variant }) {
  return (
    <div className="field">
      <LabelWithInfo label={label} suffix={suffix} infoKey={infoKey} variant={variant} />
      <input
        type="number"
        className={`field-input${error ? ' invalid' : ''}`}
        value={value ?? ''}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}
      />
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}

export function TextField({ label, value, onChange, placeholder, error, infoKey, variant }) {
  return (
    <div className="field">
      <LabelWithInfo label={label} infoKey={infoKey} variant={variant} />
      <input
        type="text"
        className={`field-input${error ? ' invalid' : ''}`}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}

export function DateField({ label, value, onChange, error, infoKey, variant }) {
  return (
    <div className="field">
      <LabelWithInfo label={label} infoKey={infoKey} variant={variant} />
      <input
        type="date"
        className={`field-input${error ? ' invalid' : ''}`}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}

export function SelectField({ label, value, onChange, options, infoKey, variant }) {
  return (
    <div className="field">
      <LabelWithInfo label={label} infoKey={infoKey} variant={variant} />
      <select
        className="field-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

export function Slider({ label, hint, value, onChange, min, max, step, infoKey, variant }) {
  const help = infoKey ? getHelp(infoKey) : null;
  return (
    <>
      {hint && (
        <div className="slider-hint" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ flex: 1 }}>{hint}</span>
          {help && <InfoButton title={help.title} body={help.body} variant={variant || 'on-dark'} size={12} />}
        </div>
      )}
      <div className="slider-row">
        <input
          type="range"
          className="field-input"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          aria-label={label}
        />
        <div className="slider-value">{Number(value).toFixed(step >= 1 ? 0 : 2)}</div>
      </div>
    </>
  );
}
