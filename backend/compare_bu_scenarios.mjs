// Compare the model's daily output against BU's reference CSV for the
// 12 scenarios described in BU_12_scenarios_inputs_and_parameters.md.
// Usage: node compare_bu_scenarios.mjs <path-to-csv>
//
// Outputs:
//   1. Per-scenario header line (cost mode match, expectation, alignment)
//   2. Field-level summary of matched / divergent days
//   3. Detailed diff lines for any day with mismatches

import fs from 'node:fs';
import http from 'node:http';

const PORT = 9876;
const CSV_PATH = process.argv[2]
  || 'C:/Users/rakbop/Downloads/test_12_scenarios_full_output.csv';

// ── Shared inputs (BU md "Shared Parameters") ───────────────────────────
const BASE = {
  plan_start_date: '2025-02-02', // Sunday — backend will skip to Monday
  num_planning_days: 20,
  operator_daily_demand: 650,
  comp_daily_demand: 650,
  operator_tank_limit: 40000,
  comp_tank_limit: 31000,
  comp_physical_stock: 9000,
  monthly_min_share_pct: 36,
  weekly_max_share_pct: 60,
  evac_cost_per_mt: 0.1,
  daily_max_sell_mt: 0,
  locked_sell_day1_mt: 0,
  hist_operator_month_mt: 0,
  hist_comp_month_mt: 0,
  hist_operator_week_mt: 0,
  hist_comp_week_mt: 0,
  lambda_cost: 0.5,
  gamma_discount: 0.92,
  imports: [],
  pipeline: [],
};

// ── 12 scenarios (from the .md) ─────────────────────────────────────────
const SCENARIOS = [
  { id:1,  label:'Low-1',  level:'Low',  mode:'FAST', ops:3500, p_s:500,  p_c:470, u_s:3000, u_c:475, cp_s:4000,  cp_c:480, cu_s:5000,  cu_c:475, note:'Sell both 500 MT priced AND 3000 MT unpriced before Comp starts selling their unpriced' },
  { id:2,  label:'Low-2',  level:'Low',  mode:'HOLD', ops:3500, p_s:500,  p_c:470, u_s:3000, u_c:480, cp_s:4000,  cp_c:475, cu_s:5000,  cu_c:480, note:'Sell 500 MT priced and HOLD until Comp finishes selling their priced' },
  { id:3,  label:'Low-3',  level:'Low',  mode:'HOLD', ops:3500, p_s:500,  p_c:475, u_s:3000, u_c:480, cp_s:4000,  cp_c:470, cu_s:5000,  cu_c:480, note:'Sell 500 MT priced and HOLD until Comp finishes selling their priced' },
  { id:4,  label:'Low-4',  level:'Low',  mode:'FAST', ops:3500, p_s:500,  p_c:475, u_s:3000, u_c:470, cp_s:4000,  cp_c:480, cu_s:5000,  cu_c:470, note:'Sell both 500 MT priced AND 3000 MT unpriced before Comp starts selling their unpriced' },
  { id:5,  label:'Low-5',  level:'Low',  mode:'FAST', ops:3500, p_s:500,  p_c:480, u_s:3000, u_c:470, cp_s:4000,  cp_c:475, cu_s:5000,  cu_c:470, note:'Sell both 500 MT priced AND 3000 MT unpriced before Comp starts selling their unpriced' },
  { id:6,  label:'Low-6',  level:'Low',  mode:'HOLD', ops:3500, p_s:500,  p_c:480, u_s:3000, u_c:475, cp_s:4000,  cp_c:470, cu_s:5000,  cu_c:475, note:'HOLD until Comp finishes selling their priced' },
  { id:7,  label:'High-7', level:'High', mode:'FAST', ops:14000,p_s:2000, p_c:470, u_s:8000, u_c:475, cp_s:16000, cp_c:480, cu_s:15000, cu_c:475, note:'Sell a lot before Comp starts selling their unpriced' },
  { id:8,  label:'High-8', level:'High', mode:'HOLD', ops:14000,p_s:2000, p_c:470, u_s:8000, u_c:480, cp_s:16000, cp_c:475, cu_s:15000, cu_c:480, note:'Sell sparingly — margin is better once Comp starts selling their unpriced' },
  { id:9,  label:'High-9', level:'High', mode:'HOLD', ops:14000,p_s:2000, p_c:475, u_s:8000, u_c:480, cp_s:16000, cp_c:470, cu_s:15000, cu_c:480, note:'Sell sparingly (pick & choose orders) to minimise losses' },
  { id:10, label:'High-10',level:'High', mode:'FAST', ops:14000,p_s:2000, p_c:475, u_s:8000, u_c:470, cp_s:16000, cp_c:480, cu_s:15000, cu_c:470, note:'Sell and finish 2000 MT priced before Comp starts selling their unpriced' },
  { id:11, label:'High-11',level:'High', mode:'FAST', ops:14000,p_s:2000, p_c:480, u_s:8000, u_c:470, cp_s:16000, cp_c:475, cu_s:15000, cu_c:470, note:'Sell fast' },
  { id:12, label:'High-12',level:'High', mode:'HOLD', ops:14000,p_s:2000, p_c:480, u_s:8000, u_c:475, cp_s:16000, cp_c:470, cu_s:15000, cu_c:475, note:'Sell sparingly (pick & choose orders) to minimise losses' },
];

function inputsFor(sc) {
  return {
    ...BASE,
    operator_physical_stock: sc.ops,
    operator_priced_sfs: sc.p_s,
    operator_priced_cost: sc.p_c,
    operator_unpriced_sfs: sc.u_s,
    operator_unpriced_cost: sc.u_c,
    comp_priced_sfs: sc.cp_s,
    comp_priced_cost: sc.cp_c,
    comp_unpriced_sfs: sc.cu_s,
    comp_unpriced_cost: sc.cu_c,
  };
}

// ── HTTP ────────────────────────────────────────────────────────────────
function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      { hostname: 'localhost', port: PORT, path, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
          catch { resolve({ status: res.statusCode, body: buf }); }
        });
      });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ── CSV parsing ─────────────────────────────────────────────────────────
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

function groupByScenario(rows) {
  const groups = new Map();
  for (const r of rows) {
    const id = Number(r.scenario_id);
    if (!Number.isFinite(id)) continue;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(r);
  }
  return groups;
}

// ── Comparison ─────────────────────────────────────────────────────────
function close(a, b, eps = 1) {
  return Math.abs(Number(a) - Number(b)) <= eps;
}

const FIELD_MAP = [
  // [csv key, model key, label]
  ['sell_quantity',           'sell_quantity',          'sell'],
  ['sold_priced',             'sold_priced',            'priced'],
  ['sold_unpriced',           'sold_unpriced',          'unpriced'],
  ['sfs_priced_remaining',    'sfs_priced_remaining',   'sfsP'],
  ['sfs_unpriced_remaining',  'sfs_unpriced_remaining', 'sfsU'],
  ['sfs_remaining',           'sfs_remaining',          'sfs'],
  ['comp_sfs_remaining',      'comp_sfs_remaining',     'cSfs'],
  ['lms_physical_stock',      'operator_physical_stock','opPhys'],
  ['comp_physical_stock',     'comp_physical_stock',    'cPhys'],
];

async function runOne(sc, expectedRows) {
  const r = await post('/api/optimize', { inputs: inputsFor(sc) });
  if (r.status !== 200) {
    return { sc, error: `${r.status} ${JSON.stringify(r.body).slice(0, 200)}` };
  }
  const result = r.body;
  const days = result.daily;
  const out = {
    sc,
    cost_mode: result.cost_mode,
    cost_mode_match: result.cost_mode === sc.mode,
    iterations: result.dp_iterations,
    total_sold: result.summary.total_sold_mt,
    final_share: result.summary.final_market_share_pct,
    peak_fill: result.summary.peak_tank_fill_pct,
    days: [],
  };
  const n = Math.min(days.length, expectedRows.length);
  for (let i = 0; i < n; i++) {
    const m = days[i];
    const e = expectedRows[i];
    const diffs = [];
    for (const [csvKey, modelKey, label] of FIELD_MAP) {
      const ev = Number(e[csvKey]);
      const mv = Number(m[modelKey]);
      if (!close(mv, ev, 1)) {
        diffs.push(`${label}=${mv.toFixed(0)} (exp ${ev.toFixed(0)})`);
      }
    }
    out.days.push({ day: m.day_number, date: m.date, diffs });
  }
  return out;
}

function summarize(out) {
  if (out.error) {
    console.log(`\n── ${out.sc.id} ${out.sc.label} (${out.sc.level}) — ERROR: ${out.error}`);
    return { id: out.sc.id, aligned: false };
  }
  const dayMismatches = out.days.filter((d) => d.diffs.length > 0);
  const aligned = out.cost_mode_match && dayMismatches.length === 0;
  console.log(`\n── ${out.sc.id} ${out.sc.label} (${out.sc.level})`);
  console.log(`   Expected: ${out.sc.mode} — "${out.sc.note}"`);
  console.log(`   Got:      ${out.cost_mode}${out.cost_mode_match ? ' ✓' : ' ✗ MODE MISMATCH'}, iters=${out.iterations}, total=${out.total_sold.toFixed(0)} MT, finalShare=${out.final_share.toFixed(1)}%, peakFill=${out.peak_fill.toFixed(0)}%`);
  if (dayMismatches.length === 0) {
    console.log(`   Days:     all 20 days match CSV ✓`);
  } else {
    console.log(`   Days:     ${dayMismatches.length}/${out.days.length} days diverge:`);
    for (const d of dayMismatches.slice(0, 8)) {
      console.log(`     D${d.day} ${d.date}: ${d.diffs.join(', ')}`);
    }
    if (dayMismatches.length > 8) console.log(`     ... +${dayMismatches.length - 8} more`);
  }
  return { id: out.sc.id, label: out.sc.label, aligned, mode_match: out.cost_mode_match, day_mismatches: dayMismatches.length };
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV not found at ${CSV_PATH}`);
    process.exit(1);
  }
  const csvText = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCsv(csvText);
  const groups = groupByScenario(rows);
  console.log(`Parsed ${rows.length} CSV rows across ${groups.size} scenarios.`);

  // Wait for backend
  for (let i = 0; i < 20; i++) {
    try {
      await new Promise((res, rej) => {
        const r = http.get(`http://localhost:${PORT}/api/health`, (resp) => { resp.on('data',()=>{}); resp.on('end',res); });
        r.on('error', rej);
      });
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  const results = [];
  for (const sc of SCENARIOS) {
    const expected = groups.get(sc.id) || [];
    const out = await runOne(sc, expected);
    results.push(summarize(out));
  }

  console.log('\n══════════════════════════════════════════════════════════');
  const fullyAligned = results.filter((r) => r.aligned).length;
  const modeMatched = results.filter((r) => r.mode_match).length;
  console.log(`Cost mode matches: ${modeMatched}/${SCENARIOS.length}`);
  console.log(`Fully aligned (mode + every day): ${fullyAligned}/${SCENARIOS.length}`);
  if (fullyAligned < SCENARIOS.length) {
    console.log(`\nDivergent scenarios:`);
    for (const r of results) {
      if (!r.aligned) console.log(`  ${r.id} ${r.label}: mode_match=${r.mode_match}, day_mismatches=${r.day_mismatches}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
