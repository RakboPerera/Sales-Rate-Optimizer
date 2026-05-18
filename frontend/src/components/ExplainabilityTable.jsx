import { fmtNum, fmtPct, fmtDate } from '../utils/format.js';
import InfoButton from './InfoButton.jsx';
import { getHelp } from '../utils/explanations.jsx';

function Th({ children, infoKey, align = 'right' }) {
  const help = infoKey ? getHelp(infoKey) : null;
  return (
    <th style={{ textAlign: align === 'left' ? 'left' : 'right' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {children}
        {help && <InfoButton title={help.title} body={help.body} variant="on-light" size={11} align={align === 'left' ? 'left' : 'right'} />}
      </span>
    </th>
  );
}

export default function ExplainabilityTable({ result, monthlyFloor }) {
  const daily = result.daily;
  const rwk = {};
  const rtk = {};

  const rows = daily.map((r) => {
    const mode = r.mode;
    const vd = r.operator_demand > 0 ? (r.sell_quantity / r.operator_demand) * 100 : 0;
    // Match backend buildWeekly: fixed-market share uses capped operator
    // contribution (op_captured) over total market demand (d_total). Falling
    // back to old fields keeps this safe against stale responses.
    const capRow = r.op_captured ?? Math.min(r.sell_quantity, r.sell_quantity + r.comp_sell_quantity);
    const dRow = r.d_total ?? (r.sell_quantity + r.comp_sell_quantity);
    rwk[r.week_label] = (rwk[r.week_label] || 0) + capRow;
    rtk[r.week_label] = (rtk[r.week_label] || 0) + dRow;
    const wp = rtk[r.week_label] > 0 ? (rwk[r.week_label] / rtk[r.week_label]) * 100 : 0;

    let driver = '';
    if (r.is_locked) driver = 'LOCKED (day-1 override)';
    else if (r.sell_quantity === 0 && r.sfs_remaining === 0) driver = 'No SFS remaining';
    else if (r.fill_percentage > 0.75) driver = `Tank pressure (${fmtPct(r.fill_percentage * 100, 0)} full)`;
    else if (r.evacuated_quantity > 0) driver = `Evacuation (${fmtNum(r.evacuated_quantity)} MT)`;
    else if (r.borrowed_quantity > 0) driver = `Borrow (${fmtNum(r.borrowed_quantity)} MT)`;
    else if (mode === 'FAST') {
      const edge = `$${r.cost_advantage.toFixed(0)}/MT edge`;
      driver =
        r.sell_quantity > r.operator_demand * 1.1
          ? `FAST sell above demand — ${edge}`
          : r.sell_quantity >= r.operator_demand * 0.9
          ? `FAST at demand — ${edge}`
          : `FAST but cap limiting — ${edge}`;
    } else {
      const penalty = `$${(-r.cost_advantage).toFixed(0)}/MT penalty`;
      driver =
        r.sold_priced > 0 && r.sold_unpriced === 0
          ? `HOLD — priced only (${penalty})`
          : r.sell_quantity < r.operator_demand * 0.9
          ? `HOLD — below demand (${penalty})`
          : `HOLD — at demand (${penalty})`;
    }
    if (r.cumulative_market_share * 100 < monthlyFloor + 1) driver += ' | floor boost';

    return { r, mode, vd, wp, driver };
  });

  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <Th align="left">Day</Th>
            <Th align="left">Date</Th>
            <Th infoKey="col_mode" align="left">Mode</Th>
            <Th infoKey="col_sell">Sell</Th>
            <Th infoKey="col_vs_dem">vs Dem%</Th>
            <Th infoKey="col_cost_adv">CostAdv</Th>
            <Th infoKey="col_fill">Fill%</Th>
            <Th infoKey="col_sfs_share">SFS%</Th>
            <Th infoKey="col_wk">Wk%</Th>
            <Th infoKey="col_cum">Cum%</Th>
            <Th infoKey="col_driver" align="left">Driver</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ r, mode, vd, wp, driver }) => {
            const fillCls = r.fill_percentage > 0.85 ? 'bad' : r.fill_percentage > 0.75 ? 'warn' : '';
            return (
              <tr key={r.day_number}>
                <td>{r.day_number}</td>
                <td>{fmtDate(r.date)}</td>
                <td className={mode === 'FAST' ? 'mode-fast' : 'mode-hold'}>{mode}</td>
                <td className="num"><strong>{fmtNum(r.sell_quantity)}</strong></td>
                <td className="num">{fmtPct(vd, 0)}</td>
                <td className="num" style={{ color: r.cost_advantage >= 0 ? 'var(--octave-accent)' : '#c25700' }}>
                  {r.cost_advantage >= 0 ? '+' : ''}{r.cost_advantage.toFixed(1)}
                </td>
                <td className="num" style={fillCls === 'bad' ? { color: 'var(--danger)' } : fillCls === 'warn' ? { color: 'var(--warn)' } : {}}>
                  {fmtPct(r.fill_percentage * 100)}
                </td>
                <td className="num">{fmtPct(r.sfs_share * 100, 0)}</td>
                <td className="num">{fmtPct(wp)}</td>
                <td className="num">{fmtPct(r.cumulative_market_share * 100)}</td>
                <td style={{ textAlign: 'left', color: 'var(--octave-text-muted)' }}>{driver}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
