import { TrendingUp, Shield, AlertTriangle, Sliders } from 'lucide-react';
import { STRATEGIES } from '../state/strategyPresets.js';

const ICONS = {
  growth: TrendingUp,
  guard: Shield,
  pressure: AlertTriangle,
  custom: Sliders,
};

export default function StrategyTabs({ activeId, onChange }) {
  return (
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
  );
}
