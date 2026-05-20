// Sweep hold_capacity_base and hold_capacity_slope for High-8/High-9 alignment.
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
  { id:1,  ops:3500, p_s:500,  p_c:470, u_s:3000, u_c:475, cp_s:4000,  cp_c:480, cu_s:5000,  cu_c:475 },
  { id:2,  ops:3500, p_s:500,  p_c:470, u_s:3000, u_c:480, cp_s:4000,  cp_c:475, cu_s:5000,  cu_c:480 },
  { id:3,  ops:3500, p_s:500,  p_c:475, u_s:3000, u_c:480, cp_s:4000,  cp_c:470, cu_s:5000,  cu_c:480 },
  { id:4,  ops:3500, p_s:500,  p_c:475, u_s:3000, u_c:470, cp_s:4000,  cp_c:480, cu_s:5000,  cu_c:470 },
  { id:5,  ops:3500, p_s:500,  p_c:480, u_s:3000, u_c:470, cp_s:4000,  cp_c:475, cu_s:5000,  cu_c:470 },
  { id:6,  ops:3500, p_s:500,  p_c:480, u_s:3000, u_c:475, cp_s:4000,  cp_c:470, cu_s:5000,  cu_c:475 },
  { id:7,  ops:14000,p_s:2000, p_c:470, u_s:8000, u_c:475, cp_s:16000, cp_c:480, cu_s:15000, cu_c:475 },
  { id:8,  ops:14000,p_s:2000, p_c:470, u_s:8000, u_c:480, cp_s:16000, cp_c:475, cu_s:15000, cu_c:480 },
  { id:9,  ops:14000,p_s:2000, p_c:475, u_s:8000, u_c:480, cp_s:16000, cp_c:470, cu_s:15000, cu_c:480 },
  { id:10, ops:14000,p_s:2000, p_c:475, u_s:8000, u_c:470, cp_s:16000, cp_c:480, cu_s:15000, cu_c:470 },
  { id:11, ops:14000,p_s:2000, p_c:480, u_s:8000, u_c:470, cp_s:16000, cp_c:475, cu_s:15000, cu_c:470 },
  { id:12, ops:14000,p_s:2000, p_c:480, u_s:8000, u_c:475, cp_s:16000, cp_c:470, cu_s:15000, cu_c:475 },
];

function inputsFor(sc) {
  return { ...BASE, operator_physical_stock: sc.ops, operator_priced_sfs: sc.p_s, operator_priced_cost: sc.p_c, operator_unpriced_sfs: sc.u_s, operator_unpriced_cost: sc.u_c, comp_priced_sfs: sc.cp_s, comp_priced_cost: sc.cp_c, comp_unpriced_sfs: sc.cu_s, comp_unpriced_cost: sc.cu_c };
}

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({ hostname: 'localhost', port: PORT, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (res) => { let buf=''; res.on('data',c=>buf+=c); res.on('end',()=>{try{resolve({status:res.statusCode,body:JSON.parse(buf)});}catch{resolve({status:res.statusCode,body:buf});}}); });
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

for (let i = 0; i < 30; i++) {
  try { await new Promise((res, rej) => { const r = http.get(`http://localhost:${PORT}/api/health`, x => { x.on('data',()=>{}); x.on('end',res); }); r.on('error', rej); }); break; }
  catch { await new Promise(r => setTimeout(r, 500)); }
}

const COMBOS = [
  { base: 2.5, slope: 3.0 }, // current default
  { base: 1.5, slope: 1.0 },
  { base: 1.0, slope: 0.0 },
  { base: 0.5, slope: 0.0 },
  { base: 0.2, slope: 0.0 },
  { base: 1.143, slope: 0.0 }, // 1170/1024 ratio
];

console.log(`combo                     ${SCENARIOS.map(s => `s${s.id}`.padStart(5)).join(' ')}  total`);
for (const combo of COMBOS) {
  const cols = [];
  let total = 0;
  for (const sc of SCENARIOS) {
    const r = await post('/api/optimize', { inputs: inputsFor(sc), rules: { hold_capacity_base: combo.base, hold_capacity_slope: combo.slope } });
    if (r.status !== 200) { cols.push('  ERR'); continue; }
    const csvRows = groups.get(sc.id) || [];
    let m = 0;
    for (let i = 0; i < Math.min(csvRows.length, r.body.daily.length); i++) {
      if (Math.abs(Number(csvRows[i].sell_quantity) - r.body.daily[i].sell_quantity) <= 1) m++;
    }
    cols.push(`${m}/${csvRows.length}`.padStart(5));
    total += m;
  }
  console.log(`base=${String(combo.base).padEnd(5)} slope=${String(combo.slope).padEnd(5)}   ${cols.join(' ')}  ${total}/240`);
}
