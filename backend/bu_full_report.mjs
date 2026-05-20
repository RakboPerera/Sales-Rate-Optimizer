// Comprehensive alignment report: model output vs colleague's CSV for all 12 BU scenarios.
// For each scenario, emits:
//   - Headline (cost mode, total MT, final share, day-by-day match count)
//   - Per-field alignment counts across all 20 days (9 numeric fields)
//   - For divergent fields, the specific days that disagree
import fs from 'node:fs';
import http from 'node:http';

const PORT = 9876;
const CSV_PATH = process.argv[2] || 'C:/Users/rakbop/Downloads/test_12_scenarios_full_output.csv';

const BASE = {
  plan_start_date: '2025-02-02', num_planning_days: 20,
  operator_daily_demand: 650, comp_daily_demand: 650,
  operator_tank_limit: 40000, comp_tank_limit: 31000,
  comp_physical_stock: 9000,
  monthly_min_share_pct: 36, weekly_max_share_pct: 60,
  evac_cost_per_mt: 0.1, daily_max_sell_mt: 0, locked_sell_day1_mt: 0,
  hist_operator_month_mt: 0, hist_comp_month_mt: 0,
  hist_operator_week_mt: 0, hist_comp_week_mt: 0,
  lambda_cost: 0.5, gamma_discount: 0.92,
  imports: [], pipeline: [],
};

const SCENARIOS = [
  { id:1,  label:'Low-1',  mode:'FAST', note:'Sell both 500 MT priced AND 3000 MT unpriced before Comp starts selling their unpriced', ops:3500, p_s:500,  p_c:470, u_s:3000, u_c:475, cp_s:4000,  cp_c:480, cu_s:5000,  cu_c:475 },
  { id:2,  label:'Low-2',  mode:'HOLD', note:'Sell 500 MT priced and HOLD until Comp finishes selling their priced', ops:3500, p_s:500,  p_c:470, u_s:3000, u_c:480, cp_s:4000,  cp_c:475, cu_s:5000,  cu_c:480 },
  { id:3,  label:'Low-3',  mode:'HOLD', note:'Sell 500 MT priced and HOLD until Comp finishes selling their priced', ops:3500, p_s:500,  p_c:475, u_s:3000, u_c:480, cp_s:4000,  cp_c:470, cu_s:5000,  cu_c:480 },
  { id:4,  label:'Low-4',  mode:'FAST', note:'Sell both 500 MT priced AND 3000 MT unpriced before Comp starts selling their unpriced', ops:3500, p_s:500,  p_c:475, u_s:3000, u_c:470, cp_s:4000,  cp_c:480, cu_s:5000,  cu_c:470 },
  { id:5,  label:'Low-5',  mode:'FAST', note:'Sell both 500 MT priced AND 3000 MT unpriced before Comp starts selling their unpriced', ops:3500, p_s:500,  p_c:480, u_s:3000, u_c:470, cp_s:4000,  cp_c:475, cu_s:5000,  cu_c:470 },
  { id:6,  label:'Low-6',  mode:'HOLD', note:'HOLD until Comp finishes selling their priced', ops:3500, p_s:500,  p_c:480, u_s:3000, u_c:475, cp_s:4000,  cp_c:470, cu_s:5000,  cu_c:475 },
  { id:7,  label:'High-7', mode:'FAST', note:'Sell a lot before Comp starts selling their unpriced', ops:14000,p_s:2000, p_c:470, u_s:8000, u_c:475, cp_s:16000, cp_c:480, cu_s:15000, cu_c:475 },
  { id:8,  label:'High-8', mode:'HOLD', note:'Sell sparingly — margin is better once Comp starts selling their unpriced', ops:14000,p_s:2000, p_c:470, u_s:8000, u_c:480, cp_s:16000, cp_c:475, cu_s:15000, cu_c:480 },
  { id:9,  label:'High-9', mode:'HOLD', note:'Sell sparingly (pick & choose orders) to minimise losses', ops:14000,p_s:2000, p_c:475, u_s:8000, u_c:480, cp_s:16000, cp_c:470, cu_s:15000, cu_c:480 },
  { id:10, label:'High-10',mode:'FAST', note:'Sell and finish 2000 MT priced before Comp starts selling their unpriced', ops:14000,p_s:2000, p_c:475, u_s:8000, u_c:470, cp_s:16000, cp_c:480, cu_s:15000, cu_c:470 },
  { id:11, label:'High-11',mode:'FAST', note:'Sell fast', ops:14000,p_s:2000, p_c:480, u_s:8000, u_c:470, cp_s:16000, cp_c:475, cu_s:15000, cu_c:470 },
  { id:12, label:'High-12',mode:'HOLD', note:'Sell sparingly (pick & choose orders) to minimise losses', ops:14000,p_s:2000, p_c:480, u_s:8000, u_c:475, cp_s:16000, cp_c:470, cu_s:15000, cu_c:475 },
];

function inputsFor(sc) {
  return {
    ...BASE,
    operator_physical_stock: sc.ops,
    operator_priced_sfs: sc.p_s, operator_priced_cost: sc.p_c,
    operator_unpriced_sfs: sc.u_s, operator_unpriced_cost: sc.u_c,
    comp_priced_sfs: sc.cp_s, comp_priced_cost: sc.cp_c,
    comp_unpriced_sfs: sc.cu_s, comp_unpriced_cost: sc.cu_c,
  };
}

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      { hostname: 'localhost', port: PORT, path, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
      (res) => { let buf=''; res.on('data',c=>buf+=c); res.on('end',()=>{try{resolve({status:res.statusCode,body:JSON.parse(buf)});}catch{resolve({status:res.statusCode,body:buf});}}); });
    req.on('error', reject); req.write(data); req.end();
  });
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/);
  const header = lines[0].split(',');
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    if (!c[0] || /^,+$/.test(lines[i].trim())) continue;
    const row = {};
    header.forEach((h, j) => { row[h] = c[j]; });
    rows.push(row);
  }
  return rows;
}

const csvText = fs.readFileSync(CSV_PATH, 'utf8');
const groups = new Map();
for (const r of parseCsv(csvText)) {
  const id = Number(r.scenario_id);
  if (!groups.has(id)) groups.set(id, []);
  groups.get(id).push(r);
}

// Wait for backend
for (let i = 0; i < 30; i++) {
  try { await new Promise((res, rej) => { const r = http.get(`http://localhost:${PORT}/api/health`, x => { x.on('data',()=>{}); x.on('end',res); }); r.on('error', rej); }); break; }
  catch { await new Promise(r => setTimeout(r, 500)); }
}

const FIELDS = [
  ['sell_quantity',          'sell_quantity'],
  ['sold_priced',            'sold_priced'],
  ['sold_unpriced',          'sold_unpriced'],
  ['sfs_priced_remaining',   'sfs_priced_remaining'],
  ['sfs_unpriced_remaining', 'sfs_unpriced_remaining'],
  ['sfs_remaining',          'sfs_remaining'],
  ['comp_sfs_remaining',     'comp_sfs_remaining'],
  ['lms_physical_stock',     'operator_physical_stock'],
  ['comp_physical_stock',    'comp_physical_stock'],
];

console.log('# Final Alignment Report — Our Model vs Colleague\'s CSV');
console.log('');
let allDaysTotal = 0, allDaysMatched = 0;
let allFieldChecksTotal = 0, allFieldChecksMatched = 0;
const scenarioRows = [];

for (const sc of SCENARIOS) {
  const r = await post('/api/optimize', { inputs: inputsFor(sc) });
  if (r.status !== 200) { console.log(`${sc.id} ERROR`); continue; }
  const result = r.body;
  const csvRows = groups.get(sc.id) || [];
  const csvTotal = csvRows.reduce((s, x) => s + Number(x.sell_quantity || 0), 0);
  const modelTotal = result.summary.total_sold_mt;

  // Per-day, per-field comparison
  const fieldCounts = {};
  for (const [csvKey, ] of FIELDS) fieldCounts[csvKey] = { matched: 0, total: 0, days: [] };
  let perDayMatched = 0;
  const dayDetail = [];
  for (let i = 0; i < Math.min(csvRows.length, result.daily.length); i++) {
    const e = csvRows[i], m = result.daily[i];
    let dayAllMatch = true;
    const dayDiffs = [];
    for (const [csvKey, modelKey] of FIELDS) {
      const ev = Number(e[csvKey]);
      const mv = Number(m[modelKey]);
      fieldCounts[csvKey].total++;
      if (Math.abs(ev - mv) <= 1) {
        fieldCounts[csvKey].matched++;
      } else {
        dayAllMatch = false;
        dayDiffs.push(`${csvKey}: ${mv.toFixed(0)} vs ${ev.toFixed(0)}`);
        fieldCounts[csvKey].days.push(i + 1);
      }
    }
    if (dayAllMatch) perDayMatched++;
    if (dayDiffs.length) dayDetail.push({ day: i + 1, diffs: dayDiffs });
  }

  const totalDays = csvRows.length;
  allDaysTotal += totalDays;
  allDaysMatched += perDayMatched;
  for (const [csvKey, ] of FIELDS) {
    allFieldChecksTotal += fieldCounts[csvKey].total;
    allFieldChecksMatched += fieldCounts[csvKey].matched;
  }

  scenarioRows.push({
    id: sc.id, label: sc.label,
    mode_match: result.cost_mode === sc.mode,
    expected_mode: sc.mode, actual_mode: result.cost_mode,
    csv_total: csvTotal, model_total: modelTotal,
    total_match: Math.abs(csvTotal - modelTotal) <= 5,
    final_share: result.summary.final_market_share_pct,
    days_matched: perDayMatched, days_total: totalDays,
    fieldCounts, dayDetail,
    note: sc.note,
  });
}

// Headline scorecard
console.log('## Headline Alignment Scorecard\n');
console.log('| Metric | Score |');
console.log('|---|---|');
const modeMatched = scenarioRows.filter(s => s.mode_match).length;
const totalMatched = scenarioRows.filter(s => s.total_match).length;
const fullAlign = scenarioRows.filter(s => s.days_matched === s.days_total).length;
console.log(`| Cost mode (FAST/HOLD) | **${modeMatched}/12** |`);
console.log(`| Total MT sold | **${totalMatched}/12** |`);
console.log(`| Scenarios with every day matching | **${fullAlign}/12** |`);
console.log(`| Total individual days matched (across all 12 scenarios) | **${allDaysMatched}/${allDaysTotal}** (${(allDaysMatched/allDaysTotal*100).toFixed(1)}%) |`);
console.log(`| Total field-level checks matched (9 fields × ${allDaysTotal} days) | **${allFieldChecksMatched}/${allFieldChecksTotal}** (${(allFieldChecksMatched/allFieldChecksTotal*100).toFixed(1)}%) |`);
console.log('');

// Per-scenario summary table
console.log('## Per-scenario Summary\n');
console.log('| # | Scenario | Mode | Total MT (CSV/Mine) | Final Share | Days exact | Status |');
console.log('|---|---|---|---|---|---|---|');
for (const r of scenarioRows) {
  const status = r.days_matched === r.days_total ? '✅ exact' : `⚠️ ${r.days_total - r.days_matched} day(s) differ`;
  console.log(`| ${r.id} | ${r.label} | ${r.expected_mode}/${r.actual_mode}${r.mode_match ? ' ✓' : ' ✗'} | ${r.csv_total}/${r.model_total.toFixed(0)}${r.total_match ? ' ✓' : ' ✗'} | ${r.final_share.toFixed(1)}% | ${r.days_matched}/${r.days_total} | ${status} |`);
}
console.log('');

// Per-field alignment breakdown
console.log('## Per-field Alignment Across All Scenarios\n');
console.log('| Field | Matched | Total | % |');
console.log('|---|---|---|---|');
const fieldTotals = {};
for (const [csvKey, ] of FIELDS) fieldTotals[csvKey] = { matched: 0, total: 0 };
for (const r of scenarioRows) {
  for (const [csvKey, ] of FIELDS) {
    fieldTotals[csvKey].matched += r.fieldCounts[csvKey].matched;
    fieldTotals[csvKey].total += r.fieldCounts[csvKey].total;
  }
}
for (const [csvKey, ] of FIELDS) {
  const t = fieldTotals[csvKey];
  const pct = t.total ? (t.matched / t.total * 100).toFixed(1) : '–';
  console.log(`| ${csvKey} | ${t.matched} | ${t.total} | ${pct}% |`);
}
console.log('');

// Detail on divergent scenarios
console.log('## Detail on Divergent Scenarios\n');
for (const r of scenarioRows) {
  if (r.days_matched === r.days_total) continue;
  console.log(`### ${r.id}. ${r.label} (${r.expected_mode}) — ${r.days_total - r.days_matched} day(s) differ\n`);
  console.log(`BU expectation: *${r.note}*\n`);
  for (const d of r.dayDetail) {
    console.log(`- **D${d.day}**: ${d.diffs.join('; ')}`);
  }
  console.log('');
}
