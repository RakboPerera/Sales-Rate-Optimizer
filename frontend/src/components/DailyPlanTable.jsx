import { fmtNum, fmtPct, fmtDate } from '../utils/format.js';
import InfoButton from './InfoButton.jsx';
import { getHelp } from '../utils/explanations.jsx';

const STATUS_CLS = { OK: 'badge-ok', WARN: 'badge-warn', BORROW: 'badge-borrow', EVAC: 'badge-evac' };
const STATUS_INFO = { OK: 'status_ok', WARN: 'status_warn', BORROW: 'status_borrow', EVAC: 'status_evac' };

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

function StatusCell({ status }) {
  const cls = STATUS_CLS[status];
  const help = getHelp(STATUS_INFO[status]);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span className={`badge ${cls}`}>{status}</span>
      {help && <InfoButton title={help.title} body={help.body} variant="on-light" size={11} align="right" />}
    </span>
  );
}

export default function DailyPlanTable({ result, monthlyFloor, operatorLabel }) {
  const opLabel = operatorLabel || 'Operator';
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <Th align="left">Day</Th>
            <Th align="left">Date</Th>
            <Th align="left">Wk</Th>
            <Th infoKey="col_sell">Sell MT</Th>
            <Th infoKey="col_priced">Priced</Th>
            <Th infoKey="col_unpriced">Unpriced</Th>
            <Th infoKey="col_sfs_rem">SFS Rem</Th>
            <Th infoKey="col_sfs_share">SFS%</Th>
            <Th infoKey="col_phys">{opLabel} Phys</Th>
            <Th infoKey="col_fill">Fill%</Th>
            <Th infoKey="col_cum">Cum%</Th>
            <Th align="left">Status</Th>
          </tr>
        </thead>
        <tbody>
          {result.daily.map((r) => {
            const fillPctNum = r.fill_percentage * 100;
            const fillCls = fillPctNum > 85 ? 'bad' : fillPctNum > 75 ? 'warn' : '';
            const shareCls = r.cumulative_market_share * 100 < monthlyFloor - 1 ? 'bad' : '';
            return (
              <tr key={r.day_number}>
                <td>{r.day_number}</td>
                <td>{fmtDate(r.date)}</td>
                <td>{r.week_label}</td>
                <td className="num"><strong>{fmtNum(r.sell_quantity)}</strong></td>
                <td className="num">{fmtNum(r.sold_priced)}</td>
                <td className="num">{fmtNum(r.sold_unpriced)}</td>
                <td className="num">{fmtNum(r.sfs_remaining)}</td>
                <td className="num">{fmtPct(r.sfs_share * 100)}</td>
                <td className="num">{fmtNum(r.operator_physical_stock)}</td>
                <td className="num"
                    style={fillCls === 'bad' ? { color: 'var(--danger)' } : fillCls === 'warn' ? { color: 'var(--warn)' } : {}}>
                  {fmtPct(fillPctNum)}
                </td>
                <td className="num" style={shareCls === 'bad' ? { color: 'var(--danger)' } : {}}>
                  {fmtPct(r.cumulative_market_share * 100)}
                </td>
                <td><StatusCell status={r.status} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
