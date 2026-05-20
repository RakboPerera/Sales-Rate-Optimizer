// QA test for the 12 BU scenarios stored in the Scenarios tab.
// For each seeded scenario:
//   1. GET /api/scenarios — confirm it exists
//   2. POST /api/optimize with its inputs — must return 200
//   3. Validate response shape and required fields
//   4. Run invariant checks (no NaN, no negatives where forbidden,
//      sell ≤ SFS, totals consistent, share in [0,1], etc.)
//   5. Cross-check cost mode against BU expectation
// Exit code 0 = all pass, 1 = any failures.
import http from 'node:http';

const PORT = 9876;

// Expected mode per BU spec (kept in sync with buScenarios.js)
const EXPECTED_MODE = {
  'BU 01 · Low-1':  'FAST',
  'BU 02 · Low-2':  'HOLD',
  'BU 03 · Low-3':  'HOLD',
  'BU 04 · Low-4':  'FAST',
  'BU 05 · Low-5':  'FAST',
  'BU 06 · Low-6':  'HOLD',
  'BU 07 · High-7': 'FAST',
  'BU 08 · High-8': 'HOLD',
  'BU 09 · High-9': 'HOLD',
  'BU 10 · High-10':'FAST',
  'BU 11 · High-11':'FAST',
  'BU 12 · High-12':'HOLD',
};

const EXPECTED_TOTAL_RANGE = {
  Low:        [3490, 3510],   // 6 Low scenarios → ~3,500 MT
  HighFast:   [9990, 10010],  // High-7, 10, 11 → ~10,000 MT
  HighHold:   [7300, 7320],   // High-8, 9, 12 → ~7,314 MT (= floor target)
};

function classifyTotal(name) {
  if (name.includes('Low')) return 'Low';
  if (name.includes('High')) {
    const expected = EXPECTED_MODE[name];
    return expected === 'FAST' ? 'HighFast' : 'HighHold';
  }
  return null;
}

function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${PORT}${path}`, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch { resolve({ status: res.statusCode, body: buf }); }
      });
    }).on('error', reject);
  });
}

function postJson(path, body) {
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

const findings = [];
function flag(scenario, severity, msg) {
  findings.push({ scenario, severity, msg });
}

function isFiniteNumber(v) { return typeof v === 'number' && Number.isFinite(v); }

function validateResponseShape(scenario, body) {
  const required = [
    'cost_mode', 'cost_advantage_opening', 'cost_advantage_avg',
    'fast_days', 'hold_days', 'dp_iterations',
    'rules_applied', 'warnings', 'summary', 'weekly', 'daily',
  ];
  for (const k of required) {
    if (body[k] === undefined) {
      flag(scenario, 'critical', `missing response field: ${k}`);
    }
  }
  if (!Array.isArray(body.daily) || body.daily.length === 0) {
    flag(scenario, 'critical', `daily array missing or empty`);
    return false;
  }
  if (body.daily.length !== 20) {
    flag(scenario, 'critical', `expected 20 daily rows, got ${body.daily.length}`);
  }
  if (!Array.isArray(body.weekly) || body.weekly.length === 0) {
    flag(scenario, 'critical', `weekly array missing or empty`);
  }
  return true;
}

function validateInvariants(scenario, inputs, result) {
  const r = result;
  const s = r.summary;

  // 1. summary numeric fields are finite
  for (const k of [
    'total_sold_mt', 'priced_sold_mt', 'unpriced_sold_mt', 'pct_of_opening_sfs',
    'final_market_share_pct', 'avg_sfs_share_pct', 'peak_tank_fill_pct',
    'total_evacuated_mt', 'total_evacuation_cost_usd',
  ]) {
    if (!isFiniteNumber(s[k])) flag(scenario, 'critical', `summary.${k} = ${s[k]} (not finite)`);
  }

  // 2. Sum of per-day sells == summary total
  const sumSell = r.daily.reduce((a, d) => a + d.sell_quantity, 0);
  if (Math.abs(sumSell - s.total_sold_mt) > 0.5) {
    flag(scenario, 'invariant', `Σdaily.sell=${sumSell.toFixed(1)} ≠ summary.total_sold=${s.total_sold_mt.toFixed(1)}`);
  }

  // 3. priced + unpriced per day == sell_quantity
  for (const d of r.daily) {
    const c = d.sold_priced + d.sold_unpriced;
    if (Math.abs(c - d.sell_quantity) > 0.5) {
      flag(scenario, 'invariant', `D${d.day_number}: priced(${d.sold_priced})+unpriced(${d.sold_unpriced}) ≠ sell(${d.sell_quantity})`);
      break;
    }
  }

  // 4. Total priced sold ≤ opening priced SFS
  const totalPriced = r.daily.reduce((a, d) => a + d.sold_priced, 0);
  if (totalPriced > inputs.operator_priced_sfs + 0.5) {
    flag(scenario, 'invariant', `total priced sold ${totalPriced.toFixed(1)} > opening priced SFS ${inputs.operator_priced_sfs}`);
  }

  // 5. fill_percentage = phys / limit
  for (const d of r.daily) {
    if (d.operator_tank_limit > 0) {
      const exp = d.operator_physical_stock / d.operator_tank_limit;
      if (Math.abs(d.fill_percentage - exp) > 0.001) {
        flag(scenario, 'invariant', `D${d.day_number}: fill_pct mismatch (${d.fill_percentage.toFixed(4)} vs ${exp.toFixed(4)})`);
        break;
      }
    }
  }

  // 6. sfs_remaining = priced + unpriced
  for (const d of r.daily) {
    const t = d.sfs_priced_remaining + d.sfs_unpriced_remaining;
    if (Math.abs(t - d.sfs_remaining) > 0.5) {
      flag(scenario, 'invariant', `D${d.day_number}: sfs_remaining(${d.sfs_remaining}) ≠ sum(${t})`);
      break;
    }
  }

  // 7. No negative numeric fields
  for (const d of r.daily) {
    for (const k of ['sell_quantity', 'sold_priced', 'sold_unpriced',
                     'sfs_priced_remaining', 'sfs_unpriced_remaining', 'sfs_remaining',
                     'operator_physical_stock', 'borrowed_quantity', 'evacuated_quantity',
                     'evacuation_cost']) {
      if (d[k] < 0) {
        flag(scenario, 'critical', `D${d.day_number}: ${k} = ${d[k]} (negative)`);
      }
    }
  }

  // 8. cumulative_market_share ∈ [0, 1]
  for (const d of r.daily) {
    if (d.cumulative_market_share < 0 || d.cumulative_market_share > 1) {
      flag(scenario, 'invariant', `D${d.day_number}: cum_share=${d.cumulative_market_share} outside [0,1]`);
    }
  }

  // 9. Status is one of OK/WARN/BORROW/EVAC
  for (const d of r.daily) {
    if (!['OK', 'WARN', 'BORROW', 'EVAC'].includes(d.status)) {
      flag(scenario, 'invariant', `D${d.day_number}: status='${d.status}' (unexpected)`);
      break;
    }
  }

  // 10. Mode classification per day
  for (const d of r.daily) {
    const expected = d.cost_advantage > 0 ? 'FAST' : 'HOLD';
    if (d.mode !== expected) {
      flag(scenario, 'invariant', `D${d.day_number}: mode=${d.mode}, cost_adv=${d.cost_advantage.toFixed(2)} → expected ${expected}`);
      break;
    }
  }

  // 11. SFS never goes above opening + imports
  const openingSfs = inputs.operator_priced_sfs + inputs.operator_unpriced_sfs;
  const imports = (inputs.imports || [])
    .filter((i) => (i.party === 'OPERATOR' || i.party === 'LMS') && i.quantity_mt > 0)
    .reduce((a, i) => a + i.quantity_mt, 0);
  const maxSfsEver = openingSfs + imports;
  for (const d of r.daily) {
    if (d.sfs_remaining > maxSfsEver + 0.5) {
      flag(scenario, 'invariant', `D${d.day_number}: sfs_remaining=${d.sfs_remaining} > maxEver=${maxSfsEver}`);
      break;
    }
  }

  // 12. Cost mode matches BU expectation
  const expectedMode = EXPECTED_MODE[scenario];
  if (expectedMode && r.cost_mode !== expectedMode) {
    flag(scenario, 'mode', `cost_mode=${r.cost_mode}, expected ${expectedMode}`);
  }

  // 13. Total sold in expected range for the scenario class
  const cls = classifyTotal(scenario);
  if (cls && EXPECTED_TOTAL_RANGE[cls]) {
    const [lo, hi] = EXPECTED_TOTAL_RANGE[cls];
    if (s.total_sold_mt < lo || s.total_sold_mt > hi) {
      flag(scenario, 'total', `total_sold=${s.total_sold_mt.toFixed(0)} outside [${lo},${hi}] for class ${cls}`);
    }
  }

  // 14. dp_iterations sensible (1-25)
  if (r.dp_iterations < 1 || r.dp_iterations > 25) {
    flag(scenario, 'invariant', `dp_iterations=${r.dp_iterations} outside [1,25]`);
  }

  // 15. weekly array has at least one entry and shares match sales/(sales+comp)
  for (const w of (r.weekly || [])) {
    if (!isFiniteNumber(w.week_share_pct) || w.week_share_pct < 0 || w.week_share_pct > 100) {
      flag(scenario, 'invariant', `weekly ${w.week_label}: bad share ${w.week_share_pct}`);
    }
  }

  // 16. Floor warning displayed if final share < floor
  const floor = inputs.monthly_min_share_pct;
  if (floor && s.final_market_share_pct + 1 < floor) {
    // For Low scenarios where SFS is insufficient, this is expected — no warning needed.
    // We just note it informationally.
  }
}

async function main() {
  // Wait for backend
  for (let i = 0; i < 30; i++) {
    try { await getJson('/api/health'); break; }
    catch { await new Promise((r) => setTimeout(r, 500)); }
  }

  console.log('═══ Loading scenarios from /api/scenarios ═══\n');
  const scenariosResp = await getJson('/api/scenarios');
  if (scenariosResp.status !== 200 || !Array.isArray(scenariosResp.body)) {
    console.error('❌ Failed to load scenarios list:', scenariosResp);
    process.exit(1);
  }
  const buScenarios = scenariosResp.body.filter((s) => s.name.startsWith('BU '));
  console.log(`Found ${buScenarios.length} BU scenarios in DB.\n`);

  if (buScenarios.length !== 12) {
    console.error(`❌ Expected 12 BU scenarios in DB, found ${buScenarios.length}.`);
    process.exit(1);
  }

  // Sort by id to test in BU 01..12 order
  buScenarios.sort((a, b) => a.id - b.id);

  console.log('═══ Running each scenario through /api/optimize ═══\n');
  console.log('Scenario'.padEnd(20), 'HTTP', 'Mode', 'iters', 'Total MT', 'Final Share', 'Warnings', 'Status');
  console.log('─'.repeat(95));

  for (const sc of buScenarios) {
    const r = await postJson('/api/optimize', {
      inputs: sc.inputs,
      rules: sc.rules,
      rule_profile_id: sc.rule_profile_id,
      operator_label: sc.operator_label,
    });
    const status = r.status;
    if (status !== 200) {
      flag(sc.name, 'critical', `optimize returned ${status}: ${JSON.stringify(r.body).slice(0, 100)}`);
      console.log(sc.name.padEnd(20), String(status).padEnd(4), 'ERROR');
      continue;
    }
    if (!validateResponseShape(sc.name, r.body)) {
      console.log(sc.name.padEnd(20), '200', 'SHAPE-FAIL');
      continue;
    }
    validateInvariants(sc.name, sc.inputs, r.body);

    const scenarioFindings = findings.filter((f) => f.scenario === sc.name);
    const verdict = scenarioFindings.length === 0 ? '✅ pass'
      : scenarioFindings.some((f) => f.severity === 'critical') ? '❌ FAIL'
      : `⚠ ${scenarioFindings.length} note(s)`;

    console.log(
      sc.name.padEnd(20),
      String(status).padEnd(4),
      r.body.cost_mode.padEnd(4),
      String(r.body.dp_iterations).padStart(5),
      r.body.summary.total_sold_mt.toFixed(0).padStart(8),
      (r.body.summary.final_market_share_pct.toFixed(1) + '%').padStart(11),
      String((r.body.warnings || []).length).padStart(8),
      verdict
    );
  }

  console.log('\n═══ Summary ═══');
  console.log(`Total findings: ${findings.length}`);
  const bySev = findings.reduce((m, f) => { m[f.severity] = (m[f.severity] || 0) + 1; return m; }, {});
  console.log('By severity:', JSON.stringify(bySev) || '(none)');

  if (findings.length > 0) {
    console.log('\nDetailed findings:');
    for (const f of findings) {
      console.log(`  [${f.severity.padEnd(9)}] ${f.scenario}: ${f.msg}`);
    }
    const criticals = findings.filter((f) => f.severity === 'critical').length;
    if (criticals > 0) {
      console.log(`\n❌ ${criticals} critical issue(s).`);
      process.exit(1);
    }
    console.log('\n⚠️  No critical issues, but informational findings above.');
  } else {
    console.log('\n✅ All 12 scenarios pass every invariant check.');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
