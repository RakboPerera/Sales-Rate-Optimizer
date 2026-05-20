// Compact per-scenario summary: total_sold (model vs CSV), final_share,
// day-by-day alignment count, and the first divergent day if any.
// Reads the same shared BASE + SCENARIOS as compare_bu_scenarios.mjs.

import fs from 'node:fs';
import http from 'node:http';

const PORT = 9876;
const CSV_PATH = process.argv[2] || 'C:/Users/rakbop/Downloads/test_12_scenarios_full_output.csv';

const BASE = {
  plan_start_date: '2025-02-02',
  num_planning_days: 20,
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
  { id:1,  label:'Low-1',  mode:'FAST', ops:3500, p_s:500,  p_c:470, u_s:3000, u_c:475, cp_s:4000,  cp_c:480, cu_s:5000,  cu_c:475 },
  { id:2,  label:'Low-2',  mode:'HOLD', ops:3500, p_s:500,  p_c:470, u_s:3000, u_c:480, cp_s:4000,  cp_c:475, cu_s:5000,  cu_c:480 },
  { id:3,  label:'Low-3',  mode:'HOLD', ops:3500, p_s:500,  p_c:475, u_s:3000, u_c:480, cp_s:4000,  cp_c:470, cu_s:5000,  cu_c:480 },
  { id:4,  label:'Low-4',  mode:'FAST', ops:3500, p_s:500,  p_c:475, u_s:3000, u_c:470, cp_s:4000,  cp_c:480, cu_s:5000,  cu_c:470 },
  { id:5,  label:'Low-5',  mode:'FAST', ops:3500, p_s:500,  p_c:480, u_s:3000, u_c:470, cp_s:4000,  cp_c:475, cu_s:5000,  cu_c:470 },
  { id:6,  label:'Low-6',  mode:'HOLD', ops:3500, p_s:500,  p_c:480, u_s:3000, u_c:475, cp_s:4000,  cp_c:470, cu_s:5000,  cu_c:475 },
  { id:7,  label:'High-7', mode:'FAST', ops:14000,p_s:2000, p_c:470, u_s:8000, u_c:475, cp_s:16000, cp_c:480, cu_s:15000, cu_c:475 },
  { id:8,  label:'High-8', mode:'HOLD', ops:14000,p_s:2000, p_c:470, u_s:8000, u_c:480, cp_s:16000, cp_c:475, cu_s:15000, cu_c:480 },
  { id:9,  label:'High-9', mode:'HOLD', ops:14000,p_s:2000, p_c:475, u_s:8000, u_c:480, cp_s:16000, cp_c:470, cu_s:15000, cu_c:480 },
  { id:10, label:'High-10',mode:'FAST', ops:14000,p_s:2000, p_c:475, u_s:8000, u_c:470, cp_s:16000, cp_c:480, cu_s:15000, cu_c:470 },
  { id:11, label:'High-11',mode:'FAST', ops:14000,p_s:2000, p_c:480, u_s:8000, u_c:470, cp_s:16000, cp_c:475, cu_s:15000, cu_c:470 },
  { id:12, label:'High-12',mode:'HOLD', ops:14000,p_s:2000, p_c:480, u_s:8000, u_c:475, cp_s:16000, cp_c:470, cu_s:15000, cu_c:475 },
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
    const line = lines[i];
    if (!line || /^,+$/.test(line.trim())) continue;
    const cells = line.split(',');
    if (!cells[0]) continue;
    const row = {};
    header.forEach((h, j) => { row[h] = cells[j]; });
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

const lines = [];
lines.push('ID | Scenario | Mode (exp/got) | Total MT (CSV/Mine) | Final Share | Day-Match | Notes');
lines.push('---|---|---|---|---|---|---');

for (const sc of SCENARIOS) {
  const r = await post('/api/optimize', { inputs: inputsFor(sc) });
  if (r.status !== 200) {
    lines.push(`${sc.id} | ${sc.label} | ERR | — | — | — | ${JSON.stringify(r.body).slice(0,80)}`);
    continue;
  }
  const model = r.body;
  const csvRows = groups.get(sc.id) || [];
  const csvTotal = csvRows.reduce((s, x) => s + Number(x.sell_quantity || 0), 0);
  const modelTotal = model.summary.total_sold_mt;
  const dayMatch = csvRows.slice(0, model.daily.length).reduce((acc, e, i) => {
    const m = model.daily[i];
    if (!m) return acc;
    if (Math.abs(Number(e.sell_quantity) - m.sell_quantity) <= 1) acc.matched++;
    acc.total++;
    return acc;
  }, { matched: 0, total: 0 });
  const matchStr = `${dayMatch.matched}/${dayMatch.total}`;
  const note = dayMatch.matched === dayMatch.total ? '✓ exact' : `divergent ${dayMatch.total - dayMatch.matched} day(s)`;
  lines.push(`${sc.id} | ${sc.label} | ${sc.mode}/${model.cost_mode}${sc.mode === model.cost_mode ? ' ✓' : ' ✗'} | ${csvTotal.toFixed(0)}/${modelTotal.toFixed(0)}${Math.abs(csvTotal-modelTotal)<5?' ✓':' ✗'} | ${model.summary.final_market_share_pct.toFixed(1)}% | ${matchStr} | ${note}`);
}

console.log(lines.join('\n'));
