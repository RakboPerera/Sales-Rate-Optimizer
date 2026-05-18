import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import InfoButton from './InfoButton.jsx';
import { getHelp } from '../utils/explanations.jsx';

export default function SectionGroup({ title, defaultOpen = true, children, help, infoKey, infoVariant = 'on-dark' }) {
  const [open, setOpen] = useState(defaultOpen);
  const helpEntry = infoKey ? getHelp(infoKey) : null;
  return (
    <div className="section-group">
      <div className="section-header" style={{ display: 'flex' }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            padding: 0,
            textAlign: 'left',
          }}
        >
          <ChevronRight size={14} className={`section-chevron${open ? ' open' : ''}`} />
          <span className="section-title">{title}</span>
        </button>
        {helpEntry && (
          <InfoButton
            title={helpEntry.title}
            body={helpEntry.body}
            variant={infoVariant}
            size={13}
          />
        )}
      </div>
      {open && (
        <div className="section-body">
          {help && <div className="section-help">{help}</div>}
          {children}
        </div>
      )}
    </div>
  );
}
