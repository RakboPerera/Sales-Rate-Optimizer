// Export the 12 BU scenarios as a single self-contained HTML file.
//
// For each scenario, posts to /api/optimize and captures the full result.
// Emits bu_scenarios.html at repo root with all inputs + outputs baked in.
// No external CSS/JS — opens offline, no server, no editing.
//
// Prerequisites: backend running on http://localhost:9876.
// Usage: node backend/bu_html_export.mjs

import http from 'node:http';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { BU_SCENARIOS } from './lib/buScenarios.js';
import { DEFAULT_RULES } from './lib/defaultRules.js';

const PORT = 9876;
const OUT_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'bu_scenarios.html');

// ─── HTTP helper ─────────────────────────────────────────────────────────
function postJson(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        host: 'localhost',
        port: PORT,
        path,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(buf) });
          } catch {
            resolve({ status: res.statusCode, body: buf });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ─── HTML escaping ───────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Main ────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Running optimizer for ${BU_SCENARIOS.length} BU scenarios…`);
  const scenarios = [];
  for (let i = 0; i < BU_SCENARIOS.length; i++) {
    const sc = BU_SCENARIOS[i];
    process.stdout.write(`  [${i + 1}/${BU_SCENARIOS.length}] ${sc.name} … `);
    const { status, body } = await postJson('/api/optimize', { inputs: sc.inputs });
    if (status !== 200 || !body?.daily) {
      console.error(`FAIL (status=${status})`);
      console.error(body);
      process.exit(1);
    }
    console.log(`ok (${body.cost_mode}, ${body.summary.total_sold_mt} MT)`);
    scenarios.push({
      name: sc.name,
      description: sc.description,
      inputs: sc.inputs,
      result: body,
    });
  }

  const html = renderHtml(scenarios);
  await writeFile(OUT_FILE, html, 'utf8');
  const sizeKb = Math.round(Buffer.byteLength(html) / 1024);
  console.log(`\n✓ Generated ${OUT_FILE} (${scenarios.length} scenarios, ${sizeKb} KB)`);
}

// ─── HTML renderer ───────────────────────────────────────────────────────
function renderHtml(scenarios) {
  const generatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const dataJson = JSON.stringify(scenarios);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sales Rate Optimizer — 12 BU Scenarios</title>
<style>
${CSS}
</style>
</head>
<body>
<header class="topbar">
  <div class="brand">Sales Rate Optimizer</div>
  <div class="subtitle">12 BU test scenarios · model output snapshot · generated ${esc(generatedAt)}</div>
</header>

<div class="layout">
  <aside class="sidebar">
    <div class="sidebar-section">
      <div class="sidebar-heading">Low stock (6)</div>
      ${scenarios
        .filter((s) => s.name.includes('Low'))
        .map((s, i) => sidebarItem(s, scenarios.indexOf(s)))
        .join('')}
    </div>
    <div class="sidebar-section">
      <div class="sidebar-heading">High stock (6)</div>
      ${scenarios
        .filter((s) => s.name.includes('High'))
        .map((s, i) => sidebarItem(s, scenarios.indexOf(s)))
        .join('')}
    </div>
    <div class="sidebar-footer">
      <div>Profile: <strong>Default</strong></div>
      <div>λ ${DEFAULT_RULES.kappa_base ? '0.5' : '—'} · γ 0.92</div>
      <div class="muted">Generated ${esc(generatedAt)}</div>
    </div>
  </aside>

  <main class="content" id="content"></main>
</div>

<script>
const SCENARIOS = ${dataJson};

// ── Formatters ───────────────────────────────────────────────────────
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtNum(n, dec=0) {
  if (n == null || Number.isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtPct(n, dec=1) {
  if (n == null || Number.isNaN(n)) return '—';
  return Number(n).toFixed(dec) + '%';
}
function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  return String(d.getDate()).padStart(2,'0') + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear();
}
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── Render the active scenario ───────────────────────────────────────
function renderScenario(idx) {
  const sc = SCENARIOS[idx];
  const { inputs, result } = sc;
  const monthlyFloor = Number(inputs.monthly_min_share_pct) || 36;
  const weeklyCap = Number(inputs.weekly_max_share_pct) || 60;
  const opLabel = inputs.operator_label || 'Operator';

  // KPI colour classes
  const shareCls = result.summary.final_market_share_pct >= monthlyFloor ? 'good' : 'bad';
  const peakCls = result.summary.peak_tank_fill_pct > 85 ? 'bad' : result.summary.peak_tank_fill_pct > 75 ? 'warn' : 'good';
  const evacCls = result.summary.total_evacuated_mt > 0 ? 'bad' : 'good';
  const modeCls = result.cost_mode === 'FAST' ? 'good' : 'warn';

  // Inputs grid
  const inputsHtml = \`
    <section class="card">
      <h2>Scenario inputs <span class="badge-mode \${result.cost_mode === 'FAST' ? 'mode-fast' : 'mode-hold'}">\${result.cost_mode}</span></h2>
      <p class="card-desc">\${esc(sc.description)}</p>
      <div class="inputs-grid">
        <div class="input-col">
          <div class="input-col-title">Operator</div>
          <div class="kv"><span>Physical stock</span><b>\${fmtNum(inputs.operator_physical_stock)} MT</b></div>
          <div class="kv"><span>Tank limit</span><b>\${fmtNum(inputs.operator_tank_limit)} MT</b></div>
          <div class="kv"><span>Priced SFS</span><b>\${fmtNum(inputs.operator_priced_sfs)} MT @ \$\${inputs.operator_priced_cost}/MT</b></div>
          <div class="kv"><span>Unpriced SFS</span><b>\${fmtNum(inputs.operator_unpriced_sfs)} MT @ \$\${inputs.operator_unpriced_cost}/MT</b></div>
          <div class="kv"><span>Daily demand</span><b>\${fmtNum(inputs.operator_daily_demand)} MT</b></div>
        </div>
        <div class="input-col">
          <div class="input-col-title">Competitor</div>
          <div class="kv"><span>Physical stock</span><b>\${fmtNum(inputs.comp_physical_stock)} MT</b></div>
          <div class="kv"><span>Tank limit</span><b>\${fmtNum(inputs.comp_tank_limit)} MT</b></div>
          <div class="kv"><span>Priced SFS</span><b>\${fmtNum(inputs.comp_priced_sfs)} MT @ \$\${inputs.comp_priced_cost}/MT</b></div>
          <div class="kv"><span>Unpriced SFS</span><b>\${fmtNum(inputs.comp_unpriced_sfs)} MT @ \$\${inputs.comp_unpriced_cost}/MT</b></div>
          <div class="kv"><span>Daily demand</span><b>\${fmtNum(inputs.comp_daily_demand)} MT</b></div>
        </div>
        <div class="input-col">
          <div class="input-col-title">Plan parameters</div>
          <div class="kv"><span>Planning days</span><b>\${inputs.num_planning_days}</b></div>
          <div class="kv"><span>Start date</span><b>\${esc(inputs.plan_start_date)}</b></div>
          <div class="kv"><span>Monthly floor</span><b>\${monthlyFloor}%</b></div>
          <div class="kv"><span>Weekly cap</span><b>\${weeklyCap}%</b></div>
          <div class="kv"><span>λ (cost sensitivity)</span><b>\${inputs.lambda_cost}</b></div>
          <div class="kv"><span>γ (DP discount)</span><b>\${inputs.gamma_discount}</b></div>
        </div>
      </div>
    </section>
  \`;

  // KPI strip
  const kpisHtml = \`
    <div class="kpi-strip">
      <div class="kpi-card">
        <div class="kpi-label">Total Sold</div>
        <div class="kpi-value">\${fmtNum(result.summary.total_sold_mt)}</div>
        <div class="kpi-sub">MT · \${result.summary.pct_of_opening_sfs.toFixed(1)}% of SFS</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Final Market Share</div>
        <div class="kpi-value \${shareCls}">\${fmtPct(result.summary.final_market_share_pct)}</div>
        <div class="kpi-sub">Floor: \${monthlyFloor}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Peak Tank Fill</div>
        <div class="kpi-value \${peakCls}">\${fmtPct(result.summary.peak_tank_fill_pct)}</div>
        <div class="kpi-sub">DP iterations: \${result.dp_iterations}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Evacuated</div>
        <div class="kpi-value \${evacCls}">\${fmtNum(result.summary.total_evacuated_mt)}</div>
        <div class="kpi-sub">Cost: \$\${result.summary.total_evacuation_cost_usd.toFixed(2)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Cost Mode</div>
        <div class="kpi-value \${modeCls}">\${result.cost_mode}</div>
        <div class="kpi-sub">Edge: \$\${(result.cost_advantage_avg ?? result.cost_advantage_opening).toFixed(1)}/MT · cap \${weeklyCap}%</div>
      </div>
    </div>
  \`;

  // Warnings
  const warningsHtml = (result.warnings && result.warnings.length)
    ? \`<div class="alert alert-warn"><strong>⚠ Configuration warnings</strong><ul>\${result.warnings.map(w => '<li>' + esc(w) + '</li>').join('')}</ul></div>\`
    : '';

  // Daily sales bar chart (inline SVG)
  const chartHtml = renderBarChart(result.daily);

  // Daily plan table
  const dailyHtml = \`
    <section class="card">
      <h2>Daily plan</h2>
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th style="text-align:left">Day</th>
              <th style="text-align:left">Date</th>
              <th style="text-align:left">Wk</th>
              <th>Sell MT</th>
              <th>Priced</th>
              <th>Unpriced</th>
              <th>SFS Rem</th>
              <th>SFS%</th>
              <th>\${esc(opLabel)} Phys</th>
              <th>Fill%</th>
              <th>Cum%</th>
              <th style="text-align:left">Status</th>
            </tr>
          </thead>
          <tbody>
            \${result.daily.map(r => {
              const fillPct = r.fill_percentage * 100;
              const fillCls = fillPct > 85 ? 'bad' : fillPct > 75 ? 'warn' : '';
              const cumCls = r.cumulative_market_share * 100 < monthlyFloor - 1 ? 'bad' : '';
              const badgeCls = { OK: 'badge-ok', WARN: 'badge-warn', BORROW: 'badge-borrow', EVAC: 'badge-evac' }[r.status] || '';
              return \`
                <tr>
                  <td>\${r.day_number}</td>
                  <td>\${fmtDate(r.date)}</td>
                  <td>\${r.week_label}</td>
                  <td class="num"><strong>\${fmtNum(r.sell_quantity)}</strong></td>
                  <td class="num">\${fmtNum(r.sold_priced)}</td>
                  <td class="num">\${fmtNum(r.sold_unpriced)}</td>
                  <td class="num">\${fmtNum(r.sfs_remaining)}</td>
                  <td class="num">\${fmtPct(r.sfs_share * 100)}</td>
                  <td class="num">\${fmtNum(r.operator_physical_stock)}</td>
                  <td class="num \${fillCls}">\${fmtPct(fillPct)}</td>
                  <td class="num \${cumCls}">\${fmtPct(r.cumulative_market_share * 100)}</td>
                  <td><span class="badge \${badgeCls}">\${r.status}</span></td>
                </tr>
              \`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </section>
  \`;

  // Weekly cards
  const weeklyHtml = \`
    <section class="card">
      <h2>Weekly summary</h2>
      <div class="weekly-grid">
        \${result.weekly.map(w => {
          const wcls = w.week_share_pct > 85 ? 'bad' : w.week_share_pct > 65 ? 'warn' : 'good';
          return \`
            <div class="weekly-card">
              <div class="weekly-header"><strong>\${w.week_label}</strong><span>\${w.day_range}</span></div>
              <div class="weekly-stat"><span class="lbl">\${esc(opLabel)} Sold</span><span class="val">\${fmtNum(w.sales_mt)} MT</span></div>
              <div class="weekly-stat"><span class="lbl">Priced / Unpriced</span><span class="val">\${fmtNum(w.priced_mt)} / \${fmtNum(w.unpriced_mt)}</span></div>
              <div class="weekly-stat"><span class="lbl">Comp Sold</span><span class="val">\${fmtNum(w.comp_sales_mt)} MT</span></div>
              <div class="weekly-stat"><span class="lbl">Week Share</span><span class="val \${wcls}">\${fmtPct(w.week_share_pct)}</span></div>
              <div class="weekly-stat"><span class="lbl">Avg Fill</span><span class="val">\${fmtPct(w.avg_fill_pct)}</span></div>
              <div class="weekly-stat"><span class="lbl">Evacuated</span><span class="val \${w.evacuated_mt > 0 ? 'bad' : ''}">\${fmtNum(w.evacuated_mt)} MT</span></div>
            </div>
          \`;
        }).join('')}
      </div>
    </section>
  \`;

  // Explainability table
  const rwk = {}; const rtk = {};
  const explainHtml = \`
    <section class="card">
      <h2>Explainability — why the model picked each day's sell</h2>
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th style="text-align:left">Day</th>
              <th style="text-align:left">Date</th>
              <th style="text-align:left">Mode</th>
              <th>Sell</th>
              <th>vs Dem%</th>
              <th>CostAdv</th>
              <th>Fill%</th>
              <th>SFS%</th>
              <th>Wk%</th>
              <th>Cum%</th>
              <th style="text-align:left">Driver</th>
            </tr>
          </thead>
          <tbody>
            \${result.daily.map(r => {
              const vd = r.operator_demand > 0 ? (r.sell_quantity / r.operator_demand) * 100 : 0;
              rwk[r.week_label] = (rwk[r.week_label] || 0) + r.sell_quantity;
              rtk[r.week_label] = (rtk[r.week_label] || 0) + r.sell_quantity + r.comp_sell_quantity;
              const wp = rtk[r.week_label] > 0 ? (rwk[r.week_label] / rtk[r.week_label]) * 100 : 0;
              const mode = r.mode;
              let driver = '';
              if (r.is_locked) driver = 'LOCKED (day-1 override)';
              else if (r.sell_quantity === 0 && r.sfs_remaining === 0) driver = 'No SFS remaining';
              else if (r.fill_percentage > 0.75) driver = 'Tank pressure (' + fmtPct(r.fill_percentage * 100, 0) + ' full)';
              else if (r.evacuated_quantity > 0) driver = 'Evacuation (' + fmtNum(r.evacuated_quantity) + ' MT)';
              else if (r.borrowed_quantity > 0) driver = 'Borrow (' + fmtNum(r.borrowed_quantity) + ' MT)';
              else if (mode === 'FAST') {
                const edge = '\$' + r.cost_advantage.toFixed(0) + '/MT edge';
                driver = r.sell_quantity > r.operator_demand * 1.1 ? 'FAST sell above demand — ' + edge
                       : r.sell_quantity >= r.operator_demand * 0.9 ? 'FAST at demand — ' + edge
                       : 'FAST but cap limiting — ' + edge;
              } else {
                const penalty = '\$' + (-r.cost_advantage).toFixed(0) + '/MT penalty';
                driver = (r.sold_priced > 0 && r.sold_unpriced === 0) ? 'HOLD — priced only (' + penalty + ')'
                       : r.sell_quantity < r.operator_demand * 0.9 ? 'HOLD — below demand (' + penalty + ')'
                       : 'HOLD — at demand (' + penalty + ')';
              }
              if (r.cumulative_market_share * 100 < monthlyFloor + 1) driver += ' | floor boost';
              const fillCls = r.fill_percentage > 0.85 ? 'bad' : r.fill_percentage > 0.75 ? 'warn' : '';
              const adv = r.cost_advantage;
              return \`
                <tr>
                  <td>\${r.day_number}</td>
                  <td>\${fmtDate(r.date)}</td>
                  <td class="\${mode === 'FAST' ? 'mode-fast' : 'mode-hold'}">\${mode}</td>
                  <td class="num"><strong>\${fmtNum(r.sell_quantity)}</strong></td>
                  <td class="num">\${fmtPct(vd, 0)}</td>
                  <td class="num" style="color:\${adv >= 0 ? '#119464' : '#c25700'}">\${adv >= 0 ? '+' : ''}\${adv.toFixed(1)}</td>
                  <td class="num \${fillCls}">\${fmtPct(r.fill_percentage * 100)}</td>
                  <td class="num">\${fmtPct(r.sfs_share * 100, 0)}</td>
                  <td class="num">\${fmtPct(wp)}</td>
                  <td class="num">\${fmtPct(r.cumulative_market_share * 100)}</td>
                  <td class="muted" style="text-align:left">\${esc(driver)}</td>
                </tr>
              \`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </section>
  \`;

  return inputsHtml + kpisHtml + warningsHtml + chartHtml + dailyHtml + weeklyHtml + explainHtml;
}

// Inline SVG bar chart for daily sales
function renderBarChart(daily) {
  const W = 900, H = 180, padL = 40, padB = 30, padT = 16, padR = 16;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const maxV = Math.max(1, ...daily.map(d => d.sell_quantity));
  const bw = innerW / daily.length;
  const bars = daily.map((d, i) => {
    const h = (d.sell_quantity / maxV) * innerH;
    const x = padL + i * bw + 2;
    const y = padT + (innerH - h);
    const fill = d.status === 'EVAC' ? '#c25700' : d.status === 'WARN' || d.status === 'BORROW' ? '#d97706' : '#26EA9F';
    return \`<rect x="\${x.toFixed(1)}" y="\${y.toFixed(1)}" width="\${(bw - 4).toFixed(1)}" height="\${h.toFixed(1)}" fill="\${fill}" opacity="0.85"><title>D\${d.day_number} (\${d.weekday}): \${fmtNum(d.sell_quantity)} MT [\${d.status}]</title></rect>\`;
  }).join('');
  // Axes labels
  const ticks = 4;
  const yLabels = [];
  for (let i = 0; i <= ticks; i++) {
    const v = (maxV * i / ticks);
    const y = padT + innerH - (i / ticks) * innerH;
    yLabels.push(\`<line x1="\${padL}" y1="\${y.toFixed(1)}" x2="\${W - padR}" y2="\${y.toFixed(1)}" stroke="#e5e7eb" stroke-width="0.5"/><text x="\${padL - 6}" y="\${(y + 3).toFixed(1)}" font-size="10" text-anchor="end" fill="#7a7a7a">\${fmtNum(Math.round(v))}</text>\`);
  }
  const xLabels = daily.map((d, i) => {
    if (i % 2 !== 0 && i !== daily.length - 1) return '';
    const x = padL + i * bw + bw / 2;
    return \`<text x="\${x.toFixed(1)}" y="\${(H - padB + 14).toFixed(1)}" font-size="10" text-anchor="middle" fill="#7a7a7a">\${d.day_number}</text>\`;
  }).join('');
  return \`
    <section class="card">
      <h2>Daily sales chart</h2>
      <svg viewBox="0 0 \${W} \${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;display:block">
        \${yLabels.join('')}
        \${bars}
        \${xLabels}
        <text x="\${padL}" y="\${H - 4}" font-size="10" fill="#7a7a7a">Day number (D1 → D20)</text>
      </svg>
    </section>
  \`;
}

// ── Sidebar click handler ────────────────────────────────────────────
function setActive(idx) {
  document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
  const btn = document.querySelector('.sidebar-item[data-idx="' + idx + '"]');
  if (btn) btn.classList.add('active');
  document.getElementById('content').innerHTML = renderScenario(idx);
  document.getElementById('content').scrollTop = 0;
  window.scrollTo({ top: 0, behavior: 'instant' });
}

document.querySelectorAll('.sidebar-item').forEach(el => {
  el.addEventListener('click', () => setActive(Number(el.dataset.idx)));
});
setActive(0);
</script>
</body>
</html>`;
}

function sidebarItem(sc, idx) {
  const mode = sc.description.includes('FAST') ? 'FAST' : 'HOLD';
  return `<button class="sidebar-item" data-idx="${idx}">
    <span class="sidebar-item-name">${esc(sc.name)}</span>
    <span class="badge-mode ${mode === 'FAST' ? 'mode-fast' : 'mode-hold'}">${mode}</span>
  </button>`;
}

// ─── Inline CSS (Octave aesthetic) ───────────────────────────────────────
const CSS = `
:root {
  --bg: #fafafa;
  --panel: #ffffff;
  --border: #e5e7eb;
  --text: #0a0a0a;
  --muted: #7a7a7a;
  --accent: #26EA9F;
  --accent-dark: #119464;
  --accent-soft: rgba(38, 234, 159, 0.15);
  --danger: #c25700;
  --danger-bg: #fff4ec;
  --warn: #d97706;
  --warn-bg: #fff8e1;
  --info: #2563eb;
  --radius: 8px;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, system-ui, sans-serif; color: var(--text); background: var(--bg); font-size: 13.5px; line-height: 1.45; }

/* Top bar */
.topbar { background: #fff; border-bottom: 1px solid var(--border); padding: 14px 28px; display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap; }
.brand { font-weight: 700; font-size: 18px; color: var(--text); letter-spacing: -0.01em; }
.subtitle { font-size: 12.5px; color: var(--muted); }

/* Two-pane layout */
.layout { display: grid; grid-template-columns: 240px 1fr; min-height: calc(100vh - 56px); }
.sidebar { position: sticky; top: 0; align-self: start; max-height: 100vh; overflow-y: auto; border-right: 1px solid var(--border); background: #fff; padding: 16px 12px; }
.sidebar-section { margin-bottom: 18px; }
.sidebar-heading { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); font-weight: 600; padding: 0 8px 8px; }
.sidebar-item {
  display: flex; justify-content: space-between; align-items: center; gap: 8px;
  width: 100%; text-align: left; padding: 9px 10px; margin-bottom: 4px;
  background: transparent; border: 1px solid transparent; border-radius: 6px;
  cursor: pointer; font: inherit; color: var(--text); font-size: 13px;
  transition: background 0.12s, border-color 0.12s;
}
.sidebar-item:hover { background: #f4f4f5; }
.sidebar-item.active { background: var(--accent-soft); border-color: var(--accent); }
.sidebar-item.active .sidebar-item-name { color: var(--accent-dark); font-weight: 600; }
.sidebar-item-name { flex: 1; }
.sidebar-footer { margin-top: auto; padding: 12px 8px; border-top: 1px solid var(--border); font-size: 11.5px; color: var(--muted); display: flex; flex-direction: column; gap: 3px; }
.sidebar-footer strong { color: var(--text); }

/* Content panel */
.content { padding: 20px 28px 60px; max-width: 1400px; }

.card { background: #fff; border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 18px; margin-bottom: 16px; }
.card h2 { margin: 0 0 8px; font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 10px; }
.card-desc { margin: 0 0 14px; color: var(--muted); font-size: 12.5px; }

/* Inputs grid */
.inputs-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
.input-col-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); font-weight: 600; margin-bottom: 8px; }
.kv { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dotted var(--border); font-size: 12.5px; }
.kv span { color: var(--muted); }
.kv b { font-weight: 600; }

/* KPI strip */
.kpi-strip { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 16px; }
.kpi-card { background: #fff; border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 14px 12px; }
.kpi-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
.kpi-value { font-size: 22px; font-weight: 700; margin-top: 4px; }
.kpi-value.good { color: var(--accent-dark); }
.kpi-value.warn { color: var(--warn); }
.kpi-value.bad  { color: var(--danger); }
.kpi-sub { font-size: 11.5px; color: var(--muted); margin-top: 2px; }

/* Mode badge */
.badge-mode { font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.03em; }
.mode-fast { background: var(--accent-soft); color: var(--accent-dark); }
.mode-hold { background: var(--warn-bg); color: var(--warn); }

/* Tables */
.table-wrap { overflow-x: auto; }
.data { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.data th { text-align: right; padding: 8px 10px; background: #f9fafb; border-bottom: 1px solid var(--border); font-weight: 600; color: var(--muted); text-transform: uppercase; font-size: 10.5px; letter-spacing: 0.04em; position: sticky; top: 0; }
.data td { padding: 7px 10px; border-bottom: 1px solid #f4f4f5; }
.data tr:hover { background: #fafafa; }
.data .num { text-align: right; font-variant-numeric: tabular-nums; }
.data .bad { color: var(--danger); }
.data .warn { color: var(--warn); }
.data .good { color: var(--accent-dark); }
.muted { color: var(--muted); }

/* Status badges */
.badge { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 10.5px; font-weight: 600; letter-spacing: 0.02em; }
.badge-ok { background: var(--accent-soft); color: var(--accent-dark); }
.badge-warn { background: var(--warn-bg); color: var(--warn); }
.badge-borrow { background: #eef2ff; color: var(--info); }
.badge-evac { background: var(--danger-bg); color: var(--danger); }

/* Weekly cards */
.weekly-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.weekly-card { background: #fafbfc; border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 14px; }
.weekly-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid var(--border); }
.weekly-header strong { font-size: 14px; }
.weekly-header span { font-size: 11.5px; color: var(--muted); }
.weekly-stat { display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; }
.weekly-stat .lbl { color: var(--muted); }
.weekly-stat .val { font-weight: 600; font-variant-numeric: tabular-nums; }
.weekly-stat .val.good { color: var(--accent-dark); }
.weekly-stat .val.warn { color: var(--warn); }
.weekly-stat .val.bad  { color: var(--danger); }

/* Alerts */
.alert { padding: 10px 12px; border-radius: var(--radius); margin-bottom: 14px; font-size: 12.5px; border-left: 3px solid; }
.alert ul { margin: 6px 0 0 18px; padding: 0; }
.alert li { margin-bottom: 2px; }
.alert-warn { background: var(--warn-bg); border-color: var(--warn); color: var(--warn); }
.alert-warn strong { color: var(--warn); }

/* Responsive */
@media (max-width: 900px) {
  .layout { grid-template-columns: 1fr; }
  .sidebar { position: static; max-height: none; border-right: 0; border-bottom: 1px solid var(--border); }
  .inputs-grid { grid-template-columns: 1fr; }
  .kpi-strip { grid-template-columns: 1fr 1fr; }
  .weekly-grid { grid-template-columns: 1fr 1fr; }
  .content { padding: 16px; }
}
`;

main().catch((e) => {
  console.error('Generator failed:', e);
  process.exit(1);
});
