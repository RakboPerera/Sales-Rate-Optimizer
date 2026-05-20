// Export the 12 BU scenarios as a single self-contained HTML file.
//
// For each scenario, posts to /api/optimize and captures the full result.
// Emits bu_scenarios.html at repo root with all inputs + outputs baked in.
// Designed to look identical to the live tool's Optimizer page:
//   - Same Octave styling (real app.css + tokens.css inlined verbatim)
//   - Real sidebar form with all input fields (disabled, read-only)
//   - Real action bar, KPI strip, chart area, and tab strip
//   - Real Daily Plan / Explainability / Weekly / Stock Chart tabs
// Twelve scenarios are switchable via a top pill bar; nothing else is
// interactive (no editing, no API calls, no exports).
//
// Prerequisites: backend running on http://localhost:9876.
// Usage: node backend/bu_html_export.mjs

import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { BU_SCENARIOS } from './lib/buScenarios.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const PORT = 9876;
const OUT_FILE = join(REPO, 'bu_scenarios.html');
const TOKENS_CSS = join(REPO, 'frontend', 'src', 'styles', 'tokens.css');
const APP_CSS = join(REPO, 'frontend', 'src', 'styles', 'app.css');

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

  const [tokensCss, appCss] = await Promise.all([
    readFile(TOKENS_CSS, 'utf8'),
    readFile(APP_CSS, 'utf8'),
  ]);

  const html = renderHtml(scenarios, tokensCss, appCss);
  await writeFile(OUT_FILE, html, 'utf8');
  const sizeKb = Math.round(Buffer.byteLength(html) / 1024);
  console.log(`\n✓ Generated ${OUT_FILE} (${scenarios.length} scenarios, ${sizeKb} KB)`);
}

// ─── HTML renderer ───────────────────────────────────────────────────────
function renderHtml(scenarios, tokensCss, appCss) {
  const generatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const dataJson = JSON.stringify(scenarios);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sales Rate Optimizer — 12 BU Scenarios</title>
<style>
/* === tokens.css === */
${tokensCss}
/* === app.css === */
${appCss}
/* === static-export overrides === */
.bu-pill-bar {
  display: flex;
  gap: 1px;
  background: var(--octave-panel);
  border-bottom: 1px solid #1a1a1a;
  overflow-x: auto;
}
.bu-pill {
  flex: 1 0 auto;
  min-width: 140px;
  padding: 11px 14px;
  background: var(--octave-n700);
  color: var(--octave-text-muted-on-panel);
  border: none;
  border-top: 3px solid transparent;
  cursor: pointer;
  text-align: left;
  font-family: var(--font-display);
  font-size: 11px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  font-weight: 500;
  transition: background 0.12s, color 0.12s;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.bu-pill:hover:not(.active) { background: #4a4a4a; color: var(--octave-text-on-panel); }
.bu-pill.active { background: var(--octave-bg); color: var(--octave-text); border-top-color: var(--octave-accent); }
.bu-pill .bu-pill-name { font-weight: 600; font-size: 11.5px; }
.bu-pill .bu-pill-mode { font-size: 10px; font-weight: 600; letter-spacing: 0.06em; opacity: 0.7; }
.bu-pill.active .bu-pill-mode { opacity: 1; color: var(--octave-text-muted); }
.tab-content { display: none; padding: 0; }
.tab-content.active { display: block; }
.field-input[disabled], .field-input[readonly] {
  background: var(--octave-panel-soft);
  cursor: default;
  opacity: 1;
}
/* SVG chart wrapper */
.chart-svg { width: 100%; height: 100%; display: block; }
.chart-container { height: 320px; padding: 12px 18px 6px; }
.read-only-banner {
  background: var(--octave-accent-soft);
  border-bottom: 1px solid var(--octave-n200);
  padding: 8px 24px;
  font-size: 12px;
  color: var(--octave-text);
}
.read-only-banner b { color: var(--octave-accent); margin-right: 6px; }
.action-bar .btn { pointer-events: none; opacity: 0.55; }
</style>
</head>
<body>
<div class="app-shell">
  <header class="app-header">
    <span class="octave-logo octave-logo--on-dark">SALES RATE OPTIMIZER</span>
    <span class="app-header-product">12 BU scenarios · model output snapshot</span>
    <nav class="app-nav">
      <span class="nav-link active">Optimizer</span>
      <span class="nav-link">Scenarios</span>
    </nav>
  </header>

  <div class="read-only-banner">
    <b>Static snapshot</b> Generated ${esc(generatedAt)} from live optimizer · 12 BU scenarios · read-only (no editing, no API)
  </div>

  <div class="bu-pill-bar" id="bu-pill-bar"></div>

  <div class="app-main">
    <div class="optimizer-page">
      <div class="optimizer-layout" id="layout">
        <!-- sidebar + results-area injected here -->
      </div>
    </div>
  </div>
</div>

<script>
const SCENARIOS = ${dataJson};
let activeIdx = 0;
let activeTab = 'daily';

// ── Formatters (ported from frontend/src/utils/format.js) ─────────────
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

// ── Field renderer (mimics frontend/src/components/Field.jsx) ─────────
function numField(label, value, suffix) {
  const s = suffix ? \` (\${esc(suffix)})\` : '';
  return \`<div class="field">
    <div class="field-label-row"><label class="field-label">\${esc(label)}\${s}</label></div>
    <input type="text" class="field-input" disabled value="\${esc(value ?? '')}">
  </div>\`;
}
function textField(label, value) {
  return \`<div class="field">
    <div class="field-label-row"><label class="field-label">\${esc(label)}</label></div>
    <input type="text" class="field-input" disabled value="\${esc(value ?? '')}">
  </div>\`;
}
function dateField(label, value) {
  return \`<div class="field">
    <div class="field-label-row"><label class="field-label">\${esc(label)}</label></div>
    <input type="text" class="field-input" disabled value="\${esc(value ?? '')}">
  </div>\`;
}
function row(html, full) {
  return \`<div class="field-row\${full ? ' full' : ''}">\${html}</div>\`;
}
function section(title, body, opts = {}) {
  return \`<div class="section-group">
    <div class="section-header">
      <span style="display:flex;align-items:center;gap:10px;flex:1">
        <span class="section-chevron open">▸</span>
        <span class="section-title">\${esc(title)}</span>
      </span>
    </div>
    <div class="section-body">\${body}</div>
  </div>\`;
}

// ── Sidebar renderer (matches frontend/src/components/Sidebar.jsx) ─────
function renderSidebar(inputs) {
  const opLabel = inputs.operator_label || 'Operator';
  const opUnpriced = Number(inputs.operator_unpriced_cost) || 0;
  const compPriced = Number(inputs.comp_priced_cost) || 0;
  const costMode = compPriced > opUnpriced ? 'FAST' : 'HOLD';
  const costEdge = Math.abs(compPriced - opUnpriced).toFixed(1);

  let html = '';
  html += section('Branding',
    row(textField('Operator label (used in UI)', inputs.operator_label), true)
  );
  html += section('Planning Period',
    row(dateField('Start Date', inputs.plan_start_date), true) +
    row(numField('Working Days', inputs.num_planning_days), true)
  );
  html += section(opLabel + ' Opening Stock',
    row(numField('Physical', inputs.operator_physical_stock, 'MT') + numField('Tank Limit', inputs.operator_tank_limit, 'MT')) +
    row(numField('Priced SFS', inputs.operator_priced_sfs, 'MT') + numField('Unpriced SFS', inputs.operator_unpriced_sfs, 'MT')) +
    row(numField('Priced Cost', inputs.operator_priced_cost, '$/MT') + numField('Unpriced Cost', inputs.operator_unpriced_cost, '$/MT'))
  );
  html += section('Competitor Opening Stock',
    row(numField('Physical', inputs.comp_physical_stock, 'MT') + numField('Tank Limit', inputs.comp_tank_limit, 'MT')) +
    row(numField('Priced SFS', inputs.comp_priced_sfs, 'MT') + numField('Unpriced SFS', inputs.comp_unpriced_sfs, 'MT')) +
    row(numField('Priced Cost', inputs.comp_priced_cost, '$/MT') + numField('Unpriced Cost', inputs.comp_unpriced_cost, '$/MT'))
  );
  html += section('Demand & Constraints',
    row(numField(opLabel + ' Demand/day', inputs.operator_daily_demand, 'MT') + numField('Comp Demand/day', inputs.comp_daily_demand, 'MT')) +
    row(numField('Monthly Min Share', inputs.monthly_min_share_pct, '%') + numField('Weekly Max Share', inputs.weekly_max_share_pct, '%')) +
    row(numField('Daily Max Sell', inputs.daily_max_sell_mt, 'MT (0=none)') + numField('Evac Cost', inputs.evac_cost_per_mt, '$/MT'))
  );
  html += section('Algorithm Tuning',
    \`<div class="slider-hint">λ — Cost Sensitivity (0=ignore cost, 1=cost dominates).</div>\` +
    \`<div class="slider-row"><input type="range" disabled class="field-input" value="\${inputs.lambda_cost}" min="0" max="1" step="0.05"><div class="slider-value">\${Number(inputs.lambda_cost).toFixed(2)}</div></div>\` +
    \`<div class="slider-hint">γ — Future Discount (0=short-sighted, 1=no discount).</div>\` +
    \`<div class="slider-row"><input type="range" disabled class="field-input" value="\${inputs.gamma_discount}" min="0" max="1" step="0.01"><div class="slider-value">\${Number(inputs.gamma_discount).toFixed(2)}</div></div>\` +
    \`<div class="cm-badge cm-\${costMode.toLowerCase()}"><span>\${costMode} mode — \${costMode === 'FAST' ? 'unpriced edge' : 'unpriced penalty'}: \$\${costEdge}/MT</span></div>\`
  );
  return \`<aside class="sidebar on-panel">\${html}</aside>\`;
}

// ── KPI cards (matches KpiCards.jsx) ───────────────────────────────────
function renderKpis(result, monthlyFloor, weeklyCap) {
  const s = result.summary;
  const shareCls = s.final_market_share_pct >= monthlyFloor ? 'good' : 'bad';
  const peakCls = s.peak_tank_fill_pct > 85 ? 'bad' : s.peak_tank_fill_pct > 75 ? 'warn' : 'good';
  const evacCls = s.total_evacuated_mt > 0 ? 'bad' : 'good';
  const modeCls = result.cost_mode === 'FAST' ? 'good' : 'warn';
  return \`<div class="kpi-strip on-panel">
    <div class="kpi-card">
      <div class="kpi-label-row"><span class="kpi-label">Total Sold</span></div>
      <div class="kpi-value" style="margin-top:6px">\${fmtNum(s.total_sold_mt)}</div>
      <div class="kpi-sub">MT · \${s.pct_of_opening_sfs.toFixed(1)}% of SFS</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label-row"><span class="kpi-label">Final Market Share</span></div>
      <div class="kpi-value \${shareCls}" style="margin-top:6px">\${fmtPct(s.final_market_share_pct)}</div>
      <div class="kpi-sub">Floor: \${fmtPct(monthlyFloor, 0)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label-row"><span class="kpi-label">Peak Tank Fill</span></div>
      <div class="kpi-value \${peakCls}" style="margin-top:6px">\${fmtPct(s.peak_tank_fill_pct)}</div>
      <div class="kpi-sub">DP iterations: \${result.dp_iterations}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label-row"><span class="kpi-label">Total Evacuated</span></div>
      <div class="kpi-value \${evacCls}" style="margin-top:6px">\${fmtNum(s.total_evacuated_mt)}</div>
      <div class="kpi-sub">Cost: \$\${s.total_evacuation_cost_usd.toFixed(2)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label-row"><span class="kpi-label">Cost Mode</span></div>
      <div class="kpi-value \${modeCls}" style="margin-top:6px">\${result.cost_mode}</div>
      <div class="kpi-sub">Edge: \$\${(result.cost_advantage_avg ?? result.cost_advantage_opening).toFixed(1)}/MT avg · cap \${fmtPct(weeklyCap, 0)}</div>
    </div>
  </div>\`;
}

// ── Main chart (mimics MainChart.jsx — operator/comp bars + cum share line) ──
function renderMainChart(result, opLabel) {
  const daily = result.daily;
  const W = 1000, H = 280, padL = 50, padR = 50, padT = 30, padB = 40;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const groupW = innerW / daily.length;
  const barGap = 2;
  const barW = (groupW - barGap * 3) / 2;
  const maxBar = Math.max(1, ...daily.flatMap(d => [d.sell_quantity, d.comp_sell_quantity]));
  const TURQ = '#26EA9F';
  const DARK = '#3A3A3A';
  const MUTED = '#7A7A7A';
  const N100 = '#F4F4F4';

  // Y-axis (left, MT) gridlines + labels
  const ticks = 5;
  const grid = [];
  for (let i = 0; i <= ticks; i++) {
    const v = (maxBar * i / ticks);
    const y = padT + innerH - (i / ticks) * innerH;
    grid.push(\`<line x1="\${padL}" y1="\${y.toFixed(1)}" x2="\${W - padR}" y2="\${y.toFixed(1)}" stroke="\${N100}" stroke-width="1"/>\`);
    grid.push(\`<text x="\${padL - 6}" y="\${(y + 4).toFixed(1)}" font-size="10" fill="\${MUTED}" text-anchor="end">\${fmtNum(Math.round(v))}</text>\`);
  }
  // Right axis (share %) labels
  for (let i = 0; i <= ticks; i++) {
    const y = padT + innerH - (i / ticks) * innerH;
    grid.push(\`<text x="\${W - padR + 6}" y="\${(y + 4).toFixed(1)}" font-size="10" fill="\${MUTED}" text-anchor="start">\${(i * 20)}%</text>\`);
  }

  // Bars
  const bars = daily.map((d, i) => {
    const baseX = padL + i * groupW + barGap;
    const hOp = (d.sell_quantity / maxBar) * innerH;
    const hCo = (d.comp_sell_quantity / maxBar) * innerH;
    return \`<rect x="\${baseX.toFixed(1)}" y="\${(padT + innerH - hOp).toFixed(1)}" width="\${barW.toFixed(1)}" height="\${hOp.toFixed(1)}" fill="\${TURQ}" rx="1"><title>D\${d.day_number} \${opLabel}: \${fmtNum(d.sell_quantity)} MT</title></rect>
            <rect x="\${(baseX + barW + barGap).toFixed(1)}" y="\${(padT + innerH - hCo).toFixed(1)}" width="\${barW.toFixed(1)}" height="\${hCo.toFixed(1)}" fill="\${DARK}" rx="1"><title>D\${d.day_number} Comp: \${fmtNum(d.comp_sell_quantity)} MT</title></rect>\`;
  }).join('');

  // Cumulative share line (right axis, 0-100%)
  const linePts = daily.map((d, i) => {
    const x = padL + i * groupW + groupW / 2;
    const pct = Math.min(100, Math.max(0, d.cumulative_market_share * 100));
    const y = padT + innerH - (pct / 100) * innerH;
    return \`\${x.toFixed(1)},\${y.toFixed(1)}\`;
  }).join(' ');
  const linePoints = daily.map((d, i) => {
    const x = padL + i * groupW + groupW / 2;
    const pct = Math.min(100, Math.max(0, d.cumulative_market_share * 100));
    const y = padT + innerH - (pct / 100) * innerH;
    return \`<circle cx="\${x.toFixed(1)}" cy="\${y.toFixed(1)}" r="2.5" fill="\${TURQ}"><title>D\${d.day_number}: \${fmtPct(d.cumulative_market_share * 100)}</title></circle>\`;
  }).join('');

  // X-axis labels (day numbers)
  const xLabels = daily.map((d, i) => {
    if (i % 2 !== 0 && i !== daily.length - 1) return '';
    const x = padL + i * groupW + groupW / 2;
    return \`<text x="\${x.toFixed(1)}" y="\${(H - padB + 16).toFixed(1)}" font-size="10" fill="\${MUTED}" text-anchor="middle">D\${d.day_number}</text>\`;
  }).join('');

  // Legend
  const legend = \`
    <g transform="translate(\${padL}, 10)">
      <rect x="0" y="0" width="12" height="10" fill="\${TURQ}"/>
      <text x="16" y="9" font-size="11" fill="\${MUTED}">\${esc(opLabel)} Sell (MT)</text>
      <rect x="170" y="0" width="12" height="10" fill="\${DARK}"/>
      <text x="186" y="9" font-size="11" fill="\${MUTED}">Competitor Sell (MT)</text>
      <line x1="350" y1="5" x2="370" y2="5" stroke="\${TURQ}" stroke-width="2"/>
      <circle cx="360" cy="5" r="2.5" fill="\${TURQ}"/>
      <text x="376" y="9" font-size="11" fill="\${MUTED}">Cum Share %</text>
    </g>
  \`;

  // Axis titles
  const yTitle = \`<text x="\${padL - 38}" y="\${(padT + innerH / 2).toFixed(1)}" font-size="10" fill="\${MUTED}" text-anchor="middle" transform="rotate(-90, \${padL - 38}, \${(padT + innerH / 2).toFixed(1)})">MT</text>\`;
  const y2Title = \`<text x="\${W - padR + 38}" y="\${(padT + innerH / 2).toFixed(1)}" font-size="10" fill="\${MUTED}" text-anchor="middle" transform="rotate(90, \${W - padR + 38}, \${(padT + innerH / 2).toFixed(1)})">Share %</text>\`;

  return \`
    <div class="chart-area">
      <div class="chart-title">Daily Sales &amp; Cumulative Market Share</div>
      <div class="chart-container">
        <svg viewBox="0 0 \${W} \${H}" preserveAspectRatio="xMidYMid meet" class="chart-svg">
          \${grid.join('')}
          \${bars}
          <polyline points="\${linePts}" fill="none" stroke="\${TURQ}" stroke-width="2"/>
          \${linePoints}
          \${xLabels}
          \${legend}
          \${yTitle}
          \${y2Title}
        </svg>
      </div>
    </div>
  \`;
}

// ── Stock chart (mimics StockChart.jsx — physical + sfs + fill%) ──────
function renderStockChart(result, opLabel) {
  const daily = result.daily;
  const W = 1000, H = 280, padL = 50, padR = 50, padT = 30, padB = 40;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const xStep = innerW / (daily.length - 1);
  const maxMT = Math.max(1, ...daily.map(d => Math.max(d.operator_physical_stock, d.sfs_remaining)));
  const TURQ = '#26EA9F';
  const DARK = '#3A3A3A';
  const WARN = '#C77800';
  const MUTED = '#7A7A7A';
  const N100 = '#F4F4F4';
  const ticks = 5;
  const grid = [];
  for (let i = 0; i <= ticks; i++) {
    const v = (maxMT * i / ticks);
    const y = padT + innerH - (i / ticks) * innerH;
    grid.push(\`<line x1="\${padL}" y1="\${y.toFixed(1)}" x2="\${W - padR}" y2="\${y.toFixed(1)}" stroke="\${N100}" stroke-width="1"/>\`);
    grid.push(\`<text x="\${padL - 6}" y="\${(y + 4).toFixed(1)}" font-size="10" fill="\${MUTED}" text-anchor="end">\${fmtNum(Math.round(v))}</text>\`);
  }
  for (let i = 0; i <= ticks; i++) {
    const y = padT + innerH - (i / ticks) * innerH;
    grid.push(\`<text x="\${W - padR + 6}" y="\${(y + 4).toFixed(1)}" font-size="10" fill="\${MUTED}" text-anchor="start">\${(i * 20)}%</text>\`);
  }
  function line(color, points, dash) {
    const pts = points.map((p, i) => (padL + i * xStep).toFixed(1) + ',' + p.toFixed(1)).join(' ');
    const da = dash ? \`stroke-dasharray="\${dash}"\` : '';
    return \`<polyline points="\${pts}" fill="none" stroke="\${color}" stroke-width="\${dash ? 1.5 : 2}" \${da}/>\`;
  }
  const physY = daily.map(d => padT + innerH - (d.operator_physical_stock / maxMT) * innerH);
  const sfsY = daily.map(d => padT + innerH - (d.sfs_remaining / maxMT) * innerH);
  const fillY = daily.map(d => padT + innerH - ((d.fill_percentage * 100) / 100) * innerH);
  const phys = line(DARK, physY);
  const sfs = line(TURQ, sfsY);
  const fill = line(WARN, fillY, '4 4');
  const physDots = physY.map((y, i) => \`<circle cx="\${(padL + i * xStep).toFixed(1)}" cy="\${y.toFixed(1)}" r="2" fill="\${DARK}"/>\`).join('');
  const sfsDots = sfsY.map((y, i) => \`<circle cx="\${(padL + i * xStep).toFixed(1)}" cy="\${y.toFixed(1)}" r="2" fill="\${TURQ}"/>\`).join('');
  const fillDots = fillY.map((y, i) => \`<circle cx="\${(padL + i * xStep).toFixed(1)}" cy="\${y.toFixed(1)}" r="2" fill="\${WARN}"/>\`).join('');
  const xLabels = daily.map((d, i) => {
    if (i % 2 !== 0 && i !== daily.length - 1) return '';
    const x = padL + i * xStep;
    return \`<text x="\${x.toFixed(1)}" y="\${(H - padB + 16).toFixed(1)}" font-size="10" fill="\${MUTED}" text-anchor="middle">D\${d.day_number}</text>\`;
  }).join('');
  const legend = \`
    <g transform="translate(\${padL}, 10)">
      <line x1="0" y1="5" x2="14" y2="5" stroke="\${DARK}" stroke-width="2"/>
      <text x="18" y="9" font-size="11" fill="\${MUTED}">\${esc(opLabel)} Physical (MT)</text>
      <line x1="200" y1="5" x2="214" y2="5" stroke="\${TURQ}" stroke-width="2"/>
      <text x="218" y="9" font-size="11" fill="\${MUTED}">\${esc(opLabel)} SFS Rem (MT)</text>
      <line x1="400" y1="5" x2="414" y2="5" stroke="\${WARN}" stroke-width="1.5" stroke-dasharray="4 4"/>
      <text x="418" y="9" font-size="11" fill="\${MUTED}">Fill %</text>
    </g>
  \`;
  return \`
    <div class="chart-area" style="border-bottom:none">
      <div class="chart-title">Physical Stock &amp; SFS Levels</div>
      <div class="chart-container">
        <svg viewBox="0 0 \${W} \${H}" preserveAspectRatio="xMidYMid meet" class="chart-svg">
          \${grid.join('')}
          \${phys}\${physDots}
          \${sfs}\${sfsDots}
          \${fill}\${fillDots}
          \${xLabels}
          \${legend}
        </svg>
      </div>
    </div>
  \`;
}

// ── Daily Plan tab content (matches DailyPlanTable.jsx) ───────────────
function renderDailyTable(result, monthlyFloor, opLabel) {
  const STATUS_CLS = { OK: 'badge-ok', WARN: 'badge-warn', BORROW: 'badge-borrow', EVAC: 'badge-evac' };
  return \`<div class="table-wrap"><table class="data">
    <thead><tr>
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
    </tr></thead>
    <tbody>
      \${result.daily.map(r => {
        const fp = r.fill_percentage * 100;
        const fillStyle = fp > 85 ? 'color:var(--danger)' : fp > 75 ? 'color:var(--warn)' : '';
        const shareStyle = r.cumulative_market_share * 100 < monthlyFloor - 1 ? 'color:var(--danger)' : '';
        const cls = STATUS_CLS[r.status] || '';
        return \`<tr>
          <td>\${r.day_number}</td>
          <td>\${fmtDate(r.date)}</td>
          <td>\${r.week_label}</td>
          <td class="num"><strong>\${fmtNum(r.sell_quantity)}</strong></td>
          <td class="num">\${fmtNum(r.sold_priced)}</td>
          <td class="num">\${fmtNum(r.sold_unpriced)}</td>
          <td class="num">\${fmtNum(r.sfs_remaining)}</td>
          <td class="num">\${fmtPct(r.sfs_share * 100)}</td>
          <td class="num">\${fmtNum(r.operator_physical_stock)}</td>
          <td class="num" style="\${fillStyle}">\${fmtPct(fp)}</td>
          <td class="num" style="\${shareStyle}">\${fmtPct(r.cumulative_market_share * 100)}</td>
          <td><span class="badge \${cls}">\${r.status}</span></td>
        </tr>\`;
      }).join('')}
    </tbody>
  </table></div>\`;
}

// ── Explainability tab (matches ExplainabilityTable.jsx) ──────────────
function renderExplain(result, monthlyFloor) {
  const rwk = {}, rtk = {};
  return \`<div class="table-wrap"><table class="data">
    <thead><tr>
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
    </tr></thead>
    <tbody>
      \${result.daily.map(r => {
        const mode = r.mode;
        const vd = r.operator_demand > 0 ? (r.sell_quantity / r.operator_demand) * 100 : 0;
        rwk[r.week_label] = (rwk[r.week_label] || 0) + r.sell_quantity;
        rtk[r.week_label] = (rtk[r.week_label] || 0) + r.sell_quantity + r.comp_sell_quantity;
        const wp = rtk[r.week_label] > 0 ? (rwk[r.week_label] / rtk[r.week_label]) * 100 : 0;
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
        const fillStyle = r.fill_percentage > 0.85 ? 'color:var(--danger)' : r.fill_percentage > 0.75 ? 'color:var(--warn)' : '';
        return \`<tr>
          <td>\${r.day_number}</td>
          <td>\${fmtDate(r.date)}</td>
          <td class="\${mode === 'FAST' ? 'mode-fast' : 'mode-hold'}">\${mode}</td>
          <td class="num"><strong>\${fmtNum(r.sell_quantity)}</strong></td>
          <td class="num">\${fmtPct(vd, 0)}</td>
          <td class="num" style="color:\${r.cost_advantage >= 0 ? 'var(--octave-accent)' : '#c25700'}">\${r.cost_advantage >= 0 ? '+' : ''}\${r.cost_advantage.toFixed(1)}</td>
          <td class="num" style="\${fillStyle}">\${fmtPct(r.fill_percentage * 100)}</td>
          <td class="num">\${fmtPct(r.sfs_share * 100, 0)}</td>
          <td class="num">\${fmtPct(wp)}</td>
          <td class="num">\${fmtPct(r.cumulative_market_share * 100)}</td>
          <td style="text-align:left;color:var(--octave-text-muted)">\${esc(driver)}</td>
        </tr>\`;
      }).join('')}
    </tbody>
  </table></div>\`;
}

// ── Weekly cards (matches WeeklyCards.jsx) ────────────────────────────
function renderWeekly(result, opLabel) {
  return \`<div class="weekly-grid">
    \${result.weekly.map(w => {
      const cls = w.week_share_pct > 85 ? 'bad' : w.week_share_pct > 65 ? 'warn' : 'good';
      const color = cls === 'good' ? 'var(--octave-accent)' : cls === 'warn' ? 'var(--warn)' : 'var(--danger)';
      return \`<div class="weekly-card">
        <div class="weekly-header"><strong>\${w.week_label}</strong>\${w.day_range}</div>
        <div class="weekly-stat"><span class="lbl">\${esc(opLabel)} Sold</span><span class="val">\${fmtNum(w.sales_mt)} MT</span></div>
        <div class="weekly-stat"><span class="lbl">Priced / Unpriced</span><span class="val">\${fmtNum(w.priced_mt)} / \${fmtNum(w.unpriced_mt)}</span></div>
        <div class="weekly-stat"><span class="lbl">Comp Sold</span><span class="val">\${fmtNum(w.comp_sales_mt)} MT</span></div>
        <div class="weekly-stat"><span class="lbl">Week Share</span><span class="val" style="color:\${color}">\${fmtPct(w.week_share_pct)}</span></div>
        <div class="weekly-stat"><span class="lbl">Avg Fill</span><span class="val">\${fmtPct(w.avg_fill_pct)}</span></div>
        <div class="weekly-stat"><span class="lbl">Evacuated</span><span class="val" style="\${w.evacuated_mt > 0 ? 'color:var(--danger)' : ''}">\${fmtNum(w.evacuated_mt)} MT</span></div>
      </div>\`;
    }).join('')}
  </div>\`;
}

// ── Action bar (Render-only, buttons disabled visually) ────────────────
function renderActionBar() {
  return \`<div class="action-bar">
    <button class="btn btn-accent" disabled>▶ Run optimizer</button>
    <button class="btn btn-secondary" disabled>💾 Save scenario</button>
    <button class="btn btn-secondary" disabled>📊 Export XLSX</button>
    <button class="btn btn-secondary" disabled>📄 Export PDF</button>
    <div class="action-bar-spacer"></div>
    <button class="btn btn-ghost btn-sm" disabled>↻ Reset to defaults</button>
  </div>\`;
}

// ── Results area ─────────────────────────────────────────────────────
function renderResults(sc) {
  const { inputs, result } = sc;
  const opLabel = inputs.operator_label || 'Operator';
  const monthlyFloor = Number(inputs.monthly_min_share_pct) || 36;
  const weeklyCap = Number(inputs.weekly_max_share_pct) || 90;

  const warnings = (result.warnings && result.warnings.length)
    ? \`<div class="alert alert-warn"><strong>⚠ Configuration warnings</strong><ul style="margin:6px 0 0 18px;padding:0;font-weight:400">\${result.warnings.map(w => '<li style="margin-bottom:2px">' + esc(w) + '</li>').join('')}</ul></div>\`
    : '';

  const showFloorAlert = result.summary.final_market_share_pct < monthlyFloor - 0.5;
  const floorAlert = showFloorAlert
    ? \`<div class="alert alert-warn"><strong>⚠ Final share \${result.summary.final_market_share_pct.toFixed(1)}% is below the \${monthlyFloor.toFixed(0)}% floor.</strong></div>\`
    : '';

  return \`<div class="results-area">
    \${renderActionBar()}
    \${warnings}
    \${floorAlert}
    \${renderKpis(result, monthlyFloor, weeklyCap)}
    \${renderMainChart(result, opLabel)}
    <div class="tabs">
      <button class="tab \${activeTab==='daily'?'active':''}" data-tab="daily">Daily Plan</button>
      <button class="tab \${activeTab==='explain'?'active':''}" data-tab="explain">Explainability</button>
      <button class="tab \${activeTab==='weekly'?'active':''}" data-tab="weekly">Weekly</button>
      <button class="tab \${activeTab==='stock'?'active':''}" data-tab="stock">Stock Chart</button>
    </div>
    <div class="tab-content \${activeTab==='daily'?'active':''}" id="tab-daily">\${renderDailyTable(result, monthlyFloor, opLabel)}</div>
    <div class="tab-content \${activeTab==='explain'?'active':''}" id="tab-explain">\${renderExplain(result, monthlyFloor)}</div>
    <div class="tab-content \${activeTab==='weekly'?'active':''}" id="tab-weekly">\${renderWeekly(result, opLabel)}</div>
    <div class="tab-content \${activeTab==='stock'?'active':''}" id="tab-stock">\${renderStockChart(result, opLabel)}</div>
  </div>\`;
}

// ── Pill bar (top scenario selector) ─────────────────────────────────
function renderPillBar() {
  const bar = document.getElementById('bu-pill-bar');
  bar.innerHTML = SCENARIOS.map((sc, i) => {
    const opU = Number(sc.inputs.operator_unpriced_cost) || 0;
    const cpP = Number(sc.inputs.comp_priced_cost) || 0;
    const mode = cpP > opU ? 'FAST' : 'HOLD';
    return \`<button class="bu-pill \${i === activeIdx ? 'active' : ''}" data-idx="\${i}">
      <span class="bu-pill-name">\${esc(sc.name)}</span>
      <span class="bu-pill-mode">\${mode} · \${sc.result.cost_mode === mode ? '' : 'realized ' + sc.result.cost_mode}</span>
    </button>\`;
  }).join('');
  bar.querySelectorAll('.bu-pill').forEach(el => {
    el.addEventListener('click', () => setActive(Number(el.dataset.idx)));
  });
}

// ── Scenario switcher ────────────────────────────────────────────────
function setActive(idx) {
  activeIdx = idx;
  activeTab = 'daily';
  document.querySelectorAll('.bu-pill').forEach(el => el.classList.toggle('active', Number(el.dataset.idx) === idx));
  const sc = SCENARIOS[idx];
  const layout = document.getElementById('layout');
  layout.innerHTML = renderSidebar(sc.inputs) + renderResults(sc);
  wireTabs();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function wireTabs() {
  document.querySelectorAll('.tab').forEach(el => {
    el.addEventListener('click', () => {
      activeTab = el.dataset.tab;
      document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === activeTab));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === 'tab-' + activeTab));
    });
  });
}

renderPillBar();
setActive(0);
</script>
</body>
</html>`;
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

main().catch((e) => {
  console.error('Generator failed:', e);
  process.exit(1);
});
