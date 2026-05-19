import { useState, useEffect } from 'react';
import { TrendingUp, Shield, AlertTriangle, Sliders, ChevronUp, ChevronDown } from 'lucide-react';
import { STRATEGIES } from '../state/strategyPresets.js';

const ICONS = {
  growth: TrendingUp,
  guard: Shield,
  pressure: AlertTriangle,
  custom: Sliders,
};

// Persist the collapsed state per-browser so it survives reloads without
// needing a server round-trip. Keyed under the project namespace.
const STORAGE_KEY = 'sro:strategyTabsCollapsed';

export default function StrategyTabs({ activeId, onChange }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; }
    catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0'); }
    catch { /* ignore storage errors (private mode, quota) */ }
  }, [collapsed]);

  if (collapsed) {
    const active = STRATEGIES.find((s) => s.id === activeId);
    return (
      <div className="strategy-tabs-collapsed">
        <button
          type="button"
          className="strategy-tabs-toggle"
          onClick={() => setCollapsed(false)}
          aria-label="Show strategy presets"
          title="Show strategy presets"
        >
          <ChevronDown size={14} />
          <span>Strategy presets{active ? ` — ${active.name}` : ''}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="strategy-tabs-wrap">
      <div className="strategy-tabs" role="tablist" aria-label="Strategy presets">
        {STRATEGIES.map((s) => {
          const Icon = ICONS[s.id] || Sliders;
          const isActive = activeId === s.id;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`strategy-tab strategy-tab--${s.accentMode}${isActive ? ' active' : ''}`}
              onClick={() => onChange(s.id)}
              title={s.description}
            >
              <span className="strategy-tab-icon"><Icon size={18} /></span>
              <span className="strategy-tab-body">
                <span className="strategy-tab-name">{s.name}</span>
                <span className="strategy-tab-tag">{s.tagline}</span>
              </span>
              {s.autoRun && isActive && (
                <span className="strategy-tab-pill">Auto-run</span>
              )}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="strategy-tabs-toggle strategy-tabs-toggle--inline"
        onClick={() => setCollapsed(true)}
        aria-label="Hide strategy presets"
        title="Hide strategy presets"
      >
        <ChevronUp size={14} />
        <span>Hide</span>
      </button>
    </div>
  );
}
