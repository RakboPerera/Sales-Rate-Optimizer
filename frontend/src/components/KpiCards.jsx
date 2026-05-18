import { fmtNum, fmtPct } from '../utils/format.js';
import InfoButton from './InfoButton.jsx';
import { getHelp } from '../utils/explanations.jsx';

function KpiLabel({ infoKey, children }) {
  const help = getHelp(infoKey);
  return (
    <div className="kpi-label-row">
      <span className="kpi-label" style={{ marginBottom: 0 }}>{children}</span>
      {help && <InfoButton title={help.title} body={help.body} variant="on-dark" size={12} />}
    </div>
  );
}

export default function KpiCards({ result, monthlyFloor, weeklyCap }) {
  const { summary, cost_mode, dp_iterations } = result;
  const shareClass = summary.final_market_share_pct >= monthlyFloor ? 'good' : 'bad';
  const peakClass = summary.peak_tank_fill_pct > 85 ? 'bad' : summary.peak_tank_fill_pct > 75 ? 'warn' : 'good';
  const evacClass = summary.total_evacuated_mt > 0 ? 'bad' : 'good';
  // FAST = green (favorable cost edge), HOLD = amber (we're at a cost disadvantage)
  const modeClass = cost_mode === 'FAST' ? 'good' : 'warn';

  return (
    <div className="kpi-strip on-panel">
      <div className="kpi-card">
        <KpiLabel infoKey="kpi_total_sold">Total Sold</KpiLabel>
        <div className="kpi-value" style={{ marginTop: 6 }}>{fmtNum(summary.total_sold_mt)}</div>
        <div className="kpi-sub">MT · {summary.pct_of_opening_sfs.toFixed(1)}% of SFS</div>
      </div>
      <div className="kpi-card">
        <KpiLabel infoKey="kpi_final_share">Final Market Share</KpiLabel>
        <div className={`kpi-value ${shareClass}`} style={{ marginTop: 6 }}>{fmtPct(summary.final_market_share_pct)}</div>
        <div className="kpi-sub">Floor: {fmtPct(monthlyFloor, 0)}</div>
      </div>
      <div className="kpi-card">
        <KpiLabel infoKey="kpi_peak_fill">Peak Tank Fill</KpiLabel>
        <div className={`kpi-value ${peakClass}`} style={{ marginTop: 6 }}>{fmtPct(summary.peak_tank_fill_pct)}</div>
        <div className="kpi-sub">DP iterations: {dp_iterations}</div>
      </div>
      <div className="kpi-card">
        <KpiLabel infoKey="kpi_evacuated">Total Evacuated</KpiLabel>
        <div className={`kpi-value ${evacClass}`} style={{ marginTop: 6 }}>{fmtNum(summary.total_evacuated_mt)}</div>
        <div className="kpi-sub">Cost: ${summary.total_evacuation_cost_usd.toFixed(2)}</div>
      </div>
      <div className="kpi-card">
        <KpiLabel infoKey="kpi_cost_mode">Cost Mode</KpiLabel>
        <div className={`kpi-value ${modeClass}`} style={{ marginTop: 6 }}>{cost_mode}</div>
        <div className="kpi-sub">
          {`Edge: $${(result.cost_advantage_avg ?? result.cost_advantage_opening).toFixed(1)}/MT avg · cap ${fmtPct(weeklyCap, 0)}`}
        </div>
      </div>
    </div>
  );
}
