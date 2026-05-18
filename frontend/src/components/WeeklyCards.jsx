import { fmtNum, fmtPct } from '../utils/format.js';

export default function WeeklyCards({ result, operatorLabel }) {
  const opLabel = operatorLabel || 'Operator';
  return (
    <div className="weekly-grid">
      {result.weekly.map((w) => {
        const shareCls = w.week_share_pct > 85 ? 'bad' : w.week_share_pct > 65 ? 'warn' : 'good';
        return (
          <div className="weekly-card" key={w.week_label}>
            <div className="weekly-header">
              <strong>{w.week_label}</strong>
              {w.day_range}
            </div>
            <div className="weekly-stat">
              <span className="lbl">{opLabel} Sold</span>
              <span className="val">{fmtNum(w.sales_mt)} MT</span>
            </div>
            <div className="weekly-stat">
              <span className="lbl">Priced / Unpriced</span>
              <span className="val">{fmtNum(w.priced_mt)} / {fmtNum(w.unpriced_mt)}</span>
            </div>
            <div className="weekly-stat">
              <span className="lbl">Comp Sold</span>
              <span className="val">{fmtNum(w.comp_sales_mt)} MT</span>
            </div>
            <div className="weekly-stat">
              <span className="lbl">Week Share</span>
              <span className="val" style={shareCls === 'good' ? { color: 'var(--octave-accent)' } : shareCls === 'warn' ? { color: 'var(--warn)' } : { color: 'var(--danger)' }}>
                {fmtPct(w.week_share_pct)}
              </span>
            </div>
            <div className="weekly-stat">
              <span className="lbl">Avg Fill</span>
              <span className="val">{fmtPct(w.avg_fill_pct)}</span>
            </div>
            <div className="weekly-stat">
              <span className="lbl">Evacuated</span>
              <span className="val" style={w.evacuated_mt > 0 ? { color: 'var(--danger)' } : {}}>
                {fmtNum(w.evacuated_mt)} MT
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
