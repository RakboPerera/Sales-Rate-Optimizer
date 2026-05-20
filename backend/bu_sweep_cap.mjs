// Sweep weekly_cap_penalty values, run all 12 BU scenarios at each,
// and print a compact table: penalty → matched-days per scenario + total.
import fs from 'node:fs';
import http from 'node:http';

const PORT = 9876;
const CSV_PATH = process.argv[2] || 'C:/Users/rakbop/Downloads/test_12_scenarios_full_output.csv';
const PENALTIES = [50, 100, 150, 200, 300, 500, 800];

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
  { id:1,  label:'Low-1',  ops:3500, p_s:500,  p_c:470, u_s:3000, u_c:475, cp_s:4000,  cp_c:480, cu_s:5000,  cu_c:475 },
  { id:2,  label:'Low-2',  ops:3500, p_s:500,  p_c:470, u_s:3000, u_c:480, cp_s:4000,  cp_c:475, cu_s:5000,  cu_c:480 },
  { id:3,  label:'Low-3',  ops:3500, p_s:500,  p_c:475, u_s:3000, u_c:480, cp_s:4000,  cp_c:470, cu_s:5000,  cu_c:480 },
  { id:4,  label:'Low-4',  ops:3500, p_s:500,  p_c:475, u_s:3000, u_c:470, cp_s:4000,  cp_c:480, cu_s:5000,  cu_c:470 },
  { id:5,  label:'Low-5',  ops:3500, p_s:500,  p_c:480, u_s:3000, u_c:470, cp_s:4000,  cp_c:475, cu_s:5000,  cu_c:470 },
  { id:6,  label:'Low-6',  ops:3500, p_s:500,  p_c:480, u_s:3000, u_c:475, cp_s:4000,  cp_c:470, cu_s:5000,  cu_c:475 },
  { id:7,  label:'High-7', ops:14000,p_s:2000, p_c:470, u_s:8000, u_c:475, cp_s:16000, cp_c:480, cu_s:15000, cu_c:475 },
  { id:8,  label:'High-8', ops:14000,p_s:2000, p_c:470, u_s:8000, u_c:480, cp_s:16000, cp_c:475, cu_s:15000, cu_c:480 },
  { id:9,  label:'High-9', ops:14000,p_s:2000, p_c:475, u_s:8000, u_c:480, cp_s:16000, cp_c:470, cu_s:15000, cu_c:480 },
  { id:10, label:'High-10',ops:14000,p_s:2000, p_c:475, u_s:8000, u_c:470, cp_s:16000, cp_c:480, cu_s:15000, cu_c:470 },
  { id:11, label:'High-11',ops:14000,p_s:2000, p_c:480, u_s:8000, u_c:470, cp_s:16000, cp_c:475, cu_s:15000, cu_c:470 },
  { id:12, label:'High-12',ops:14000,p_s:2000, p_c:480, u_s:8000, u_c:475, cp_s:16000, cp_c:470, cu_s:15000, cu_c:475 },
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

console.log('penalty', SCENARIOS.map(s => s.label.padStart(7)).join(' '), '  total');
for (const penalty of PENALTIES) {
  const cols = [];
  let totalMatched = 0;
  for (const sc of SCENARIOS) {
    const r = await post('/api/optimize', { inputs: inputsFor(sc), rules: { weekly_cap_penalty: penalty } });
    if (r.status !== 200) { cols.push('  ERR'); continue; }
    const csvRows = groups.get(sc.id) || [];
    let matched = 0;
    for (let i = 0; i < Math.min(csvRows.length, r.body.daily.length); i++) {
      if (Math.abs(Number(csvRows[i].sell_quantity) - r.body.daily[i].sell_quantity) <= 1) matched++;
    }
    cols.push(`${matched}/${csvRows.length}`.padStart(7));
    totalMatched += matched;
  }
  console.log(String(penalty).padStart(7), cols.join(' '), `  ${totalMatched}/240`);
}
