import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GitCompare, Loader2 } from 'lucide-react';
import api from '../api.js';
import Toast from '../components/Toast.jsx';
import MainChart from '../components/MainChart.jsx';
import { fmtNum, fmtPct } from '../utils/format.js';

// direction:
//   'higher-is-better' — green when B > A, red when B < A    (e.g., final share)
//   'lower-is-better'  — green when B < A, red when B > A    (e.g., peak fill, evacuation cost)
//   'neutral'          — no colour, just signed delta         (e.g., total sold)
const DIRECTIONS = ['higher-is-better', 'lower-is-better', 'neutral'];

function formatValue(v, fmt) {
  if (typeof v !== 'number') return v;
  if (fmt === 'mt') return fmtNum(v);
  if (fmt === 'usd') return v.toFixed(2);
  if (fmt === 'pct') return v.toFixed(1) + '%';
  if (fmt === 'int') return fmtNum(v);
  return v.toFixed(1);
}

function formatDelta(diff, fmt) {
  if (Math.abs(diff) < 1e-9) return '±0';
  const sign = diff > 0 ? '+' : '';
  if (fmt === 'mt' || fmt === 'int') return `${sign}${fmtNum(diff)}`;
  if (fmt === 'usd') return `${sign}${diff.toFixed(2)}`;
  if (fmt === 'pct') return `${sign}${diff.toFixed(1)}%`;
  return `${sign}${diff.toFixed(1)}`;
}

function KpiCompareRow({ label, a, b, fmt = 'num', direction = 'neutral' }) {
  if (!DIRECTIONS.includes(direction)) direction = 'neutral';
  const diff = (typeof a === 'number' && typeof b === 'number') ? b - a : null;
  let cls = '';
  if (diff !== null && Math.abs(diff) >= 1e-9 && direction !== 'neutral') {
    const better = direction === 'higher-is-better' ? diff > 0 : diff < 0;
    cls = better ? 'good' : 'bad';
  }
  return (
    <tr>
      <td>{label}</td>
      <td className="num">{formatValue(a, fmt)}</td>
      <td className="num">{formatValue(b, fmt)}</td>
      <td
        className="num"
        style={{
          color: cls === 'good' ? 'var(--octave-accent)' : cls === 'bad' ? 'var(--danger)' : 'var(--octave-text)',
          fontWeight: 600,
        }}
      >
        {diff === null ? '—' : formatDelta(diff, fmt)}
      </td>
    </tr>
  );
}

export default function ComparePage() {
  const [scenarios, setScenarios] = useState([]);
  const [aId, setAId] = useState('');
  const [bId, setBId] = useState('');
  const [results, setResults] = useState({ a: null, b: null });
  const [scenarioA, setScenarioA] = useState(null);
  const [scenarioB, setScenarioB] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    api.get('/scenarios').then((r) => setScenarios(r.data)).catch(() => {});
  }, []);

  const runComparison = async () => {
    if (!aId || !bId) {
      setToast({ message: 'Pick two scenarios to compare.', kind: 'error' });
      return;
    }
    if (aId === bId) {
      setToast({ message: 'Pick two different scenarios.', kind: 'error' });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [a, b] = await Promise.all([
        api.get(`/scenarios/${aId}`),
        api.get(`/scenarios/${bId}`),
      ]);
      setScenarioA(a.data);
      setScenarioB(b.data);
      const [ra, rb] = await Promise.all([
        api.post('/optimize', {
          inputs: a.data.inputs,
          rules: a.data.rules,
          rule_profile_id: a.data.rule_profile_id,
          operator_label: a.data.operator_label,
        }),
        api.post('/optimize', {
          inputs: b.data.inputs,
          rules: b.data.rules,
          rule_profile_id: b.data.rule_profile_id,
          operator_label: b.data.operator_label,
        }),
      ]);
      setResults({ a: ra.data, b: rb.data });
    } catch (e) {
      setError(e.message || 'Comparison failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 1440 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Compare Scenarios</h1>
          <div className="page-subtitle">
            Run two saved scenarios side-by-side. Useful for showing the impact of cost changes, rule
            tuning, or different operator strategies.
          </div>
        </div>
      </div>

      {scenarios.length < 2 && (
        <div className="empty-state" style={{ minHeight: 200 }}>
          <p>
            Need at least two saved scenarios to compare. Go to the{' '}
            <Link to="/optimizer">Optimizer</Link> to create some.
          </p>
        </div>
      )}

      {scenarios.length >= 2 && (
        <>
          <div
            className="flex-row gap-lg"
            style={{
              background: 'var(--octave-n100)',
              padding: 16,
              borderRadius: 8,
              marginBottom: 24,
              alignItems: 'flex-end',
            }}
          >
            <div className="field" style={{ flex: 1 }}>
              <label className="field-label" style={{ color: 'var(--octave-text-muted)' }}>
                Scenario A
              </label>
              <select
                className="field-select"
                style={{ background: 'var(--octave-bg)', color: 'var(--octave-text)', border: '1px solid var(--octave-n300)' }}
                value={aId}
                onChange={(e) => setAId(e.target.value)}
              >
                <option value="">— Select scenario —</option>
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label className="field-label" style={{ color: 'var(--octave-text-muted)' }}>
                Scenario B
              </label>
              <select
                className="field-select"
                style={{ background: 'var(--octave-bg)', color: 'var(--octave-text)', border: '1px solid var(--octave-n300)' }}
                value={bId}
                onChange={(e) => setBId(e.target.value)}
              >
                <option value="">— Select scenario —</option>
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="btn btn-accent" onClick={runComparison} disabled={loading}>
              {loading ? <Loader2 size={14} className="spin" /> : <GitCompare size={14} />}
              {loading ? ' Running…' : ' Compare'}
            </button>
          </div>

          {error && <div className="alert alert-danger">{error}</div>}

          {results.a && results.b && (
            <>
              <div style={{ marginBottom: 16 }}>
                <h2 style={{ fontSize: 20, marginBottom: 8 }}>KPI Comparison</h2>
                <table className="data" style={{ background: 'var(--octave-bg)' }}>
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>A: {scenarioA.name}</th>
                      <th>B: {scenarioB.name}</th>
                      <th>Δ (B − A)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Cost Mode</td>
                      <td className="num">{results.a.cost_mode}</td>
                      <td className="num">{results.b.cost_mode}</td>
                      <td className="num">—</td>
                    </tr>
                    <KpiCompareRow label="Total Sold (MT)" a={results.a.summary.total_sold_mt} b={results.b.summary.total_sold_mt} fmt="mt" direction="neutral" />
                    <KpiCompareRow label="Priced Sold (MT)" a={results.a.summary.priced_sold_mt} b={results.b.summary.priced_sold_mt} fmt="mt" direction="neutral" />
                    <KpiCompareRow label="Unpriced Sold (MT)" a={results.a.summary.unpriced_sold_mt} b={results.b.summary.unpriced_sold_mt} fmt="mt" direction="neutral" />
                    <KpiCompareRow label="Final Market Share" a={results.a.summary.final_market_share_pct} b={results.b.summary.final_market_share_pct} fmt="pct" direction="higher-is-better" />
                    <KpiCompareRow label="Peak Tank Fill" a={results.a.summary.peak_tank_fill_pct} b={results.b.summary.peak_tank_fill_pct} fmt="pct" direction="lower-is-better" />
                    <KpiCompareRow label="Total Evacuated (MT)" a={results.a.summary.total_evacuated_mt} b={results.b.summary.total_evacuated_mt} fmt="mt" direction="lower-is-better" />
                    <KpiCompareRow label="Evacuation Cost (USD)" a={results.a.summary.total_evacuation_cost_usd} b={results.b.summary.total_evacuation_cost_usd} fmt="usd" direction="lower-is-better" />
                    <KpiCompareRow label="Avg SFS Share" a={results.a.summary.avg_sfs_share_pct} b={results.b.summary.avg_sfs_share_pct} fmt="pct" direction="higher-is-better" />
                    <KpiCompareRow label="DP Iterations" a={results.a.dp_iterations} b={results.b.dp_iterations} fmt="int" direction="neutral" />
                  </tbody>
                </table>
              </div>

              <div className="compare-grid" style={{ padding: 0 }}>
                <div>
                  <div className="chart-title">{scenarioA.name} — Daily plan</div>
                  <div className="chart-container" style={{ height: 260 }}>
                    <MainChart result={results.a} operatorLabel={scenarioA.operator_label} />
                  </div>
                </div>
                <div>
                  <div className="chart-title">{scenarioB.name} — Daily plan</div>
                  <div className="chart-container" style={{ height: 260 }}>
                    <MainChart result={results.b} operatorLabel={scenarioB.operator_label} />
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      <Toast message={toast?.message} kind={toast?.kind} onDismiss={() => setToast(null)} />
    </div>
  );
}
