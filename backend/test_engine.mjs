// Comprehensive engine test — explores boundary scenarios and checks invariants.
// Run with: node test_engine.mjs
import http from 'node:http';

const PORT = 9876;
function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      { hostname: 'localhost', port: PORT, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); } catch { resolve({ status: res.statusCode, body: buf }); } });
      });
    req.on('error', reject); req.write(data); req.end();
  });
}

// ── Baseline scenario (varied per test by spreading) ─────────────────────
const BASE = {
  plan_start_date: '2026-05-06', num_planning_days: 20,
  operator_physical_stock: 5000, operator_priced_sfs: 5000, operator_unpriced_sfs: 5000,
  operator_priced_cost: 470, operator_unpriced_cost: 475,
  comp_physical_stock: 10000, comp_priced_sfs: 4000, comp_unpriced_sfs: 8000,
  comp_priced_cost: 480, comp_unpriced_cost: 475,
  operator_tank_limit: 20000, comp_tank_limit: 30000,
  operator_daily_demand: 600, comp_daily_demand: 800,
  monthly_min_share_pct: 36, weekly_max_share_pct: 60,
  hist_operator_month_mt: 0, hist_comp_month_mt: 0,
  hist_operator_week_mt: 0, hist_comp_week_mt: 0,
  daily_max_sell_mt: 0, locked_sell_day1_mt: 0, evac_cost_per_mt: 0.1,
  lambda_cost: 0.5, gamma_discount: 0.92,
  imports: [], pipeline: [],
};

const findings = [];

function flag(scenario, kind, message, extra = {}) {
  findings.push({ scenario, kind, message, ...extra });
}

// ── Invariant checks ─────────────────────────────────────────────────────
function checkInvariants(name, inputs, response) {
  if (!response.daily || response.daily.length === 0) {
    flag(name, 'critical', 'No daily array in response');
    return;
  }
  const r = response;
  const s = r.summary;

  // 1. sum(daily.sell) == summary.total_sold_mt
  const sum = r.daily.reduce((a, d) => a + d.sell_quantity, 0);
  if (Math.abs(sum - s.total_sold_mt) > 0.5) {
    flag(name, 'invariant', `sum(daily.sell)=${sum.toFixed(1)} ≠ summary.total_sold=${s.total_sold_mt.toFixed(1)}`);
  }

  // 2. Per day: priced + unpriced == sell_quantity
  for (const d of r.daily) {
    const c = d.sold_priced + d.sold_unpriced;
    if (Math.abs(c - d.sell_quantity) > 0.5) {
      flag(name, 'invariant', `D${d.day_number}: priced+unpriced(${c}) ≠ sell(${d.sell_quantity})`);
      break;
    }
  }

  // 3. Total priced sold <= opening_priced + priced_imports (priced never created)
  const totalPriced = r.daily.reduce((a, d) => a + d.sold_priced, 0);
  // Imports default to unpriced when added during plan, so opening priced is the cap.
  if (totalPriced > inputs.operator_priced_sfs + 0.5) {
    flag(name, 'invariant',
      `total priced sold (${totalPriced.toFixed(1)}) > opening priced SFS (${inputs.operator_priced_sfs})`);
  }

  // 4. fill_percentage == phys / limit
  for (const d of r.daily) {
    if (d.operator_tank_limit > 0) {
      const expected = d.operator_physical_stock / d.operator_tank_limit;
      if (Math.abs(d.fill_percentage - expected) > 0.001) {
        flag(name, 'invariant',
          `D${d.day_number}: fill=${d.fill_percentage.toFixed(3)} ≠ phys/limit=${expected.toFixed(3)}`);
        break;
      }
    }
  }

  // 5. sfs_remaining = priced_rem + unpriced_rem
  for (const d of r.daily) {
    const total = d.sfs_priced_remaining + d.sfs_unpriced_remaining;
    if (Math.abs(total - d.sfs_remaining) > 0.5) {
      flag(name, 'invariant',
        `D${d.day_number}: sfs_remaining(${d.sfs_remaining}) ≠ priced(${d.sfs_priced_remaining})+unpriced(${d.sfs_unpriced_remaining})`);
      break;
    }
  }

  // 6. No negative values
  for (const d of r.daily) {
    if (d.sell_quantity < 0 || d.sold_priced < 0 || d.sold_unpriced < 0 ||
        d.sfs_remaining < 0 || d.operator_physical_stock < 0 ||
        d.borrowed_quantity < 0 || d.evacuated_quantity < 0) {
      flag(name, 'invariant', `D${d.day_number}: negative quantity detected`);
      break;
    }
  }

  // 7. Daily max sell respected
  if (inputs.daily_max_sell_mt > 0) {
    const violator = r.daily.find((d) => d.sell_quantity > inputs.daily_max_sell_mt + 0.5);
    if (violator) {
      flag(name, 'invariant',
        `D${violator.day_number}: sell=${violator.sell_quantity} > daily_max=${inputs.daily_max_sell_mt}`);
    }
  }

  // 8. Status assignment matches data
  for (const d of r.daily) {
    const fill = d.fill_percentage;
    const tank_thr = 0.75; // default
    let expected;
    if (d.evacuated_quantity > 0) expected = 'EVAC';
    else if (d.borrowed_quantity > 0) expected = 'BORROW';
    else if (fill >= tank_thr) expected = 'WARN';
    else expected = 'OK';
    if (d.status !== expected) {
      // Only flag if not using a tunable threshold via rules
      if (!(response.rules_applied && response.rules_applied.tank_threshold !== 0.75)) {
        flag(name, 'invariant',
          `D${d.day_number}: status=${d.status}, expected=${expected} (fill=${fill.toFixed(3)}, borr=${d.borrowed_quantity}, evac=${d.evacuated_quantity})`);
        break;
      }
    }
  }

  // 9. Locked day 1 honored
  if (inputs.locked_sell_day1_mt > 0 && inputs.locked_sell_day1_mt <= inputs.operator_priced_sfs + inputs.operator_unpriced_sfs) {
    if (r.daily[0].sell_quantity !== inputs.locked_sell_day1_mt) {
      flag(name, 'invariant',
        `lock day-1 = ${inputs.locked_sell_day1_mt} but D1 sold ${r.daily[0].sell_quantity}`);
    }
    if (!r.daily[0].is_locked) {
      flag(name, 'invariant', `D1 is_locked should be true`);
    }
  }

  // 10. Floor: if reachable given SFS, must meet floor.
  // Reachability uses cumTotal_min = sum(D_total_t) (no over-selling), so
  // required_op = floor × cumTotal_min (incl. historical) − hist_op.
  const finalShare = s.final_market_share_pct;
  if (finalShare < inputs.monthly_min_share_pct - 1) {
    const totalSfsAvail = inputs.operator_priced_sfs + inputs.operator_unpriced_sfs
      + (inputs.imports || []).filter(i => i.party === 'OPERATOR').reduce((a, i) => a + i.quantity_mt, 0);
    const histOp = inputs.hist_operator_month_mt;
    const histComp = inputs.hist_comp_month_mt;
    // cumTotal_min assumes no over-selling: each day contributes max(D_total, sale) ≥ D_total
    let cumTotalMin = histOp + histComp;
    for (let i = 0; i < inputs.num_planning_days; i++) {
      const ov = (inputs.day_overrides || {})[String(i + 1)] || {};
      const opD = ov.operator_demand != null ? ov.operator_demand : inputs.operator_daily_demand;
      const cpD = ov.comp_demand != null ? ov.comp_demand : inputs.comp_daily_demand;
      cumTotalMin += opD + cpD;
    }
    const requiredOp = inputs.monthly_min_share_pct / 100 * cumTotalMin - histOp;
    if (totalSfsAvail >= requiredOp - 1) {
      flag(name, 'floor', `final_share=${finalShare.toFixed(2)}% < floor=${inputs.monthly_min_share_pct}% (SFS=${totalSfsAvail}, required to hit floor: ${requiredOp.toFixed(0)})`);
    }
  }

  // 11. Mode consistency: FAST when cost_advantage > 0
  for (const d of r.daily) {
    const expectedMode = d.cost_advantage > 0 ? 'FAST' : 'HOLD';
    if (d.mode !== expectedMode) {
      flag(name, 'invariant',
        `D${d.day_number}: mode=${d.mode}, cost_adv=${d.cost_advantage.toFixed(2)} → expected ${expectedMode}`);
      break;
    }
  }

  // 12. cumulative_market_share within [0, 1]
  const badCum = r.daily.find((d) => d.cumulative_market_share < 0 || d.cumulative_market_share > 1);
  if (badCum) {
    flag(name, 'invariant', `D${badCum.day_number}: cum_share=${badCum.cumulative_market_share} out of [0,1]`);
  }

  // 13. SFS never exceeds the total ever available (opening + all op imports).
  const openingSfs = inputs.operator_priced_sfs + inputs.operator_unpriced_sfs;
  const importsTotal = (inputs.imports || [])
    .filter(i => (i.party === 'OPERATOR' || i.party === 'LMS') && i.quantity_mt > 0)
    .reduce((a, i) => a + i.quantity_mt, 0);
  const maxSfsEver = openingSfs + importsTotal;
  for (const d of r.daily) {
    if (d.sfs_remaining > maxSfsEver + 0.5) {
      flag(name, 'invariant',
        `D${d.day_number}: sfs_remaining=${d.sfs_remaining} exceeds opening+imports total ${maxSfsEver}`);
      break;
    }
  }
}

// ── Test cases ───────────────────────────────────────────────────────────
async function runScenario(name, mutate, opts = {}) {
  const inputs = { ...BASE, ...mutate };
  const payload = { inputs };
  if (opts.rules) payload.rules = opts.rules;
  if (opts.rule_profile_id) payload.rule_profile_id = opts.rule_profile_id;

  const r = await post('/api/optimize', payload);
  if (r.status !== 200) {
    if (opts.expectFail) {
      console.log(`  ${name}: rejected (${r.status}) as expected — ${r.body.field}: ${r.body.message}`);
      return null;
    }
    flag(name, 'critical', `request failed: ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
    return null;
  }
  if (opts.expectFail) {
    flag(name, 'critical', `expected rejection but got 200`);
    return r.body;
  }

  checkInvariants(name, inputs, r.body);
  return r.body;
}

function summarize(r, label = '') {
  if (!r) return '';
  const s = r.summary;
  return `[${label}] iter=${r.dp_iterations} sold=${s.total_sold_mt.toFixed(0)} share=${s.final_market_share_pct.toFixed(1)}% peakFill=${s.peak_tank_fill_pct.toFixed(0)}% evac=${s.total_evacuated_mt.toFixed(0)} mode=${r.cost_mode}`;
}

async function main() {
  console.log('═══ A: Cost regimes ═══');
  let r;

  r = await runScenario('A1 FAST default', { operator_unpriced_cost: 460, comp_priced_cost: 480 });
  console.log(' A1 ' + summarize(r, 'FAST'));

  r = await runScenario('A2 HOLD default', { operator_unpriced_cost: 490, comp_priced_cost: 480 });
  console.log(' A2 ' + summarize(r, 'HOLD'));

  r = await runScenario('A3 Boundary (equal)', { operator_unpriced_cost: 480, comp_priced_cost: 480 });
  console.log(' A3 ' + summarize(r, 'EQ'));

  r = await runScenario('A4 Extreme FAST', { operator_unpriced_cost: 300, comp_priced_cost: 600 });
  console.log(' A4 ' + summarize(r, 'XFAST'));

  r = await runScenario('A5 Extreme HOLD', { operator_unpriced_cost: 600, comp_priced_cost: 300 });
  console.log(' A5 ' + summarize(r, 'XHOLD'));

  console.log('\n═══ B: SFS supply ═══');
  r = await runScenario('B1 SFS = demand', {
    operator_priced_sfs: 6000, operator_unpriced_sfs: 6000, // 12k total for 20*600=12k demand
  });
  console.log(' B1 ' + summarize(r, 'BAL'));

  r = await runScenario('B2 SFS-rich', {
    operator_priced_sfs: 30000, operator_unpriced_sfs: 30000,
  });
  console.log(' B2 ' + summarize(r, 'RICH'));

  r = await runScenario('B3 SFS-starved', {
    operator_priced_sfs: 500, operator_unpriced_sfs: 500,
  });
  console.log(' B3 ' + summarize(r, 'STARVE'));

  r = await runScenario('B4 All priced', {
    operator_priced_sfs: 10000, operator_unpriced_sfs: 0,
  });
  console.log(' B4 ' + summarize(r, 'P-only'));

  r = await runScenario('B5 All unpriced', {
    operator_priced_sfs: 0, operator_unpriced_sfs: 10000,
  });
  console.log(' B5 ' + summarize(r, 'U-only'));

  r = await runScenario('B6 Multi-import', {
    operator_priced_sfs: 1000, operator_unpriced_sfs: 1000,
    imports: [
      { party: 'OPERATOR', arrival_date: '2026-05-13', quantity_mt: 4000 },
      { party: 'OPERATOR', arrival_date: '2026-05-20', quantity_mt: 5000 },
      { party: 'COMP', arrival_date: '2026-05-15', quantity_mt: 3000 },
    ],
  });
  console.log(' B6 ' + summarize(r, 'multi-imp'));

  console.log('\n═══ C: Tank pressure ═══');
  r = await runScenario('C1 Over-limit Day 1', {
    operator_physical_stock: 25000, operator_tank_limit: 20000,
    operator_priced_sfs: 1000, operator_unpriced_sfs: 1000,
  });
  console.log(' C1 ' + summarize(r, 'overD1'));
  if (r && r.daily[0].status !== 'BORROW' && r.daily[0].status !== 'EVAC') {
    flag('C1', 'logic', `D1 with phys 25k > limit 20k should be BORROW/EVAC, got ${r.daily[0].status}`);
  }

  r = await runScenario('C2 Tight tank + big import', {
    operator_physical_stock: 10000, operator_tank_limit: 12000,
    operator_priced_sfs: 2000, operator_unpriced_sfs: 2000,
    imports: [{ party: 'OPERATOR', arrival_date: '2026-05-13', quantity_mt: 8000 }],
  });
  console.log(' C2 ' + summarize(r, 'tight+imp'));

  r = await runScenario('C3 Forced EVAC (no comp space)', {
    operator_physical_stock: 50000, operator_tank_limit: 5000,
    comp_physical_stock: 25000, comp_tank_limit: 25000, // comp full
  });
  console.log(' C3 ' + summarize(r, 'EVAC'));
  if (r && r.summary.total_evacuated_mt === 0) {
    flag('C3', 'logic', `forced overflow with no comp spare should produce EVAC, got 0 evacuated`);
  }

  r = await runScenario('C4 Comfortable', {
    operator_physical_stock: 1000, operator_tank_limit: 50000,
  });
  console.log(' C4 ' + summarize(r, 'comfort'));

  console.log('\n═══ D: Market share constraints ═══');
  r = await runScenario('D1 Tight floor + tight cap', {
    monthly_min_share_pct: 50, weekly_max_share_pct: 55,
    operator_priced_sfs: 10000, operator_unpriced_sfs: 5000,
  });
  console.log(' D1 ' + summarize(r, 'tightFC'));

  r = await runScenario('D2 Aggressive floor 60%', {
    monthly_min_share_pct: 60, weekly_max_share_pct: 95,
    operator_priced_sfs: 20000, operator_unpriced_sfs: 10000,
  });
  console.log(' D2 ' + summarize(r, 'high-floor'));

  r = await runScenario('D3 Loose (5% / 99%)', {
    monthly_min_share_pct: 5, weekly_max_share_pct: 99,
  });
  console.log(' D3 ' + summarize(r, 'loose'));

  r = await runScenario('D4 Heavy hist past floor', {
    hist_operator_month_mt: 10000, hist_comp_month_mt: 2000,
    monthly_min_share_pct: 36,
  });
  console.log(' D4 ' + summarize(r, 'past-floor'));

  await runScenario('D5 weekly<monthly (should reject)', {
    monthly_min_share_pct: 60, weekly_max_share_pct: 30,
  }, { expectFail: true });

  console.log('\n═══ E: Lambda/Gamma sweep ═══');
  for (const lam of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    r = await runScenario(`E λ=${lam}`, { lambda_cost: lam,
      operator_unpriced_cost: 490, comp_priced_cost: 480 });  // HOLD setup
    console.log(`  λ=${lam}: ` + summarize(r));
  }

  for (const gam of [0.80, 0.92, 0.99]) {
    r = await runScenario(`E γ=${gam}`, { gamma_discount: gam });
    console.log(`  γ=${gam}: ` + summarize(r));
  }

  console.log('\n═══ F: Day-1 lock ═══');
  r = await runScenario('F1 lock=0 (auto)', { locked_sell_day1_mt: 0 });
  console.log(' F1 ' + summarize(r));

  r = await runScenario('F2 lock=500', { locked_sell_day1_mt: 500 });
  console.log(' F2 ' + summarize(r) + ` D1_sell=${r?.daily[0].sell_quantity}`);

  await runScenario('F3 lock too high', { locked_sell_day1_mt: 99999 }, { expectFail: true });

  console.log('\n═══ G: Per-day overrides ═══');
  r = await runScenario('G1 demand spike D5', {
    day_overrides: { '5': { operator_demand: 3000, comp_demand: 100 } },
  });
  console.log(' G1 ' + summarize(r) + ` D5_sell=${r?.daily[4].sell_quantity} (override op=3000)`);
  if (r && r.daily[4].operator_demand !== 3000) {
    flag('G1', 'invariant', `D5 operator_demand=${r.daily[4].operator_demand}, expected 3000`);
  }

  r = await runScenario('G2 cost change D10', {
    day_overrides: { '10': { operator_priced_cost: 200, operator_unpriced_cost: 200 } },
  });
  console.log(' G2 ' + summarize(r) + ` D10_cost_adv=${r?.daily[9].cost_advantage.toFixed(1)}`);
  // After override, D10 should have stronger FAST (low op_unpriced=200 vs comp_priced)
  if (r && r.daily[9].mode !== 'FAST') {
    flag('G2', 'logic', `D10 should be FAST after cost cut, got ${r.daily[9].mode}`);
  }

  r = await runScenario('G3 multi overrides', {
    day_overrides: {
      '5': { operator_demand: 1500 },
      '10': { comp_demand: 2000 },
      '15': { operator_limit: 5000 },
    },
  });
  console.log(' G3 ' + summarize(r));

  console.log('\n═══ H: Rule profiles ═══');
  // Fetch rule-profile IDs
  const profilesRes = await new Promise((resolve) => {
    http.get(`http://localhost:${PORT}/api/rule-profiles`, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => resolve(JSON.parse(buf)));
    });
  });
  for (const p of profilesRes) {
    r = await runScenario(`H ${p.name}`, {}, { rule_profile_id: p.id });
    console.log(` ${p.name.padEnd(13)}: ` + summarize(r));
  }

  console.log('\n═══ I: Edge cases ═══');
  r = await runScenario('I1 1-day plan', { num_planning_days: 1 });
  console.log(' I1 ' + summarize(r));

  r = await runScenario('I2 60-day plan', { num_planning_days: 60,
    operator_priced_sfs: 20000, operator_unpriced_sfs: 20000 });
  console.log(' I2 ' + summarize(r));

  r = await runScenario('I3 Zero hist', {});
  console.log(' I3 ' + summarize(r));

  r = await runScenario('I4 Negative-adv high-λ', {
    operator_unpriced_cost: 600, comp_priced_cost: 400, lambda_cost: 0.9,
  });
  console.log(' I4 ' + summarize(r));

  r = await runScenario('I5 Mid-period tank shrink', {
    day_overrides: { '10': { operator_limit: 3000 } },
  });
  console.log(' I5 ' + summarize(r));

  // I6: very high evac cost — model should avoid overflow at all costs
  r = await runScenario('I6 High evac cost', {
    operator_physical_stock: 18000, operator_tank_limit: 20000,
    evac_cost_per_mt: 10000,
    imports: [{ party: 'OPERATOR', arrival_date: '2026-05-13', quantity_mt: 15000 }],
  });
  console.log(' I6 ' + summarize(r));
  if (r && r.summary.total_evacuated_mt > 0) {
    flag('I6', 'logic',
      `With evac_cost=$10000/MT and forward-looking pressure, optimizer should sell aggressively to avoid evac. Got ${r.summary.total_evacuated_mt.toFixed(0)} MT evacuated.`);
  }

  // I7: Forward-look feature: with imports incoming and tight tank, with forward_look enabled
  r = await runScenario('I7 Forward-look enabled', {
    operator_physical_stock: 5000, operator_tank_limit: 8000,
    operator_priced_sfs: 1000, operator_unpriced_sfs: 1000,
    imports: [{ party: 'OPERATOR', arrival_date: '2026-05-12', quantity_mt: 6000 }],
    monthly_min_share_pct: 0,
  }, { rules: { forward_look_days: 5 } });
  console.log(' I7 ' + summarize(r));

  // I8: Spec-strict urgency coefficients
  r = await runScenario('I8 Spec-strict urgency', {}, {
    rules: { tank_urgency_exp: 12, tank_urgency_mult: 0.01, forward_look_days: 5 },
  });
  console.log(' I8 ' + summarize(r));

  // I9: Pure pipeline (no imports, big pipeline clearances)
  r = await runScenario('I9 Big pipeline clearance', {
    operator_physical_stock: 10000, operator_tank_limit: 12000,
    pipeline: [
      { party: 'OPERATOR', clearance_date: '2026-05-11', quantity_mt: 3000 },
      { party: 'OPERATOR', clearance_date: '2026-05-18', quantity_mt: 2000 },
    ],
  });
  console.log(' I9 ' + summarize(r));

  // I10: Locked Day-1 = ALL SFS (sell everything Day 1, nothing left after)
  r = await runScenario('I10 Lock all-SFS on D1', {
    operator_priced_sfs: 500, operator_unpriced_sfs: 500,
    locked_sell_day1_mt: 1000,
  });
  console.log(' I10 ' + summarize(r));

  // I11: Operator has zero opening physical but SFS exists
  r = await runScenario('I11 Zero phys, big SFS', {
    operator_physical_stock: 0, operator_priced_sfs: 5000, operator_unpriced_sfs: 5000,
  });
  console.log(' I11 ' + summarize(r));

  // I12: Imports landing on weekends (should still work)
  r = await runScenario('I12 Weekend import', {
    imports: [{ party: 'OPERATOR', arrival_date: '2026-05-09', quantity_mt: 5000 }],
  });
  console.log(' I12 ' + summarize(r));

  // I13: Cap exceeded check — tight cap and aggressive λ might breach
  r = await runScenario('I13 Tight weekly cap', {
    monthly_min_share_pct: 0, weekly_max_share_pct: 30,
    operator_priced_sfs: 20000, operator_unpriced_sfs: 20000,
  });
  if (r) {
    // Find max weekly share in the result
    const wkShares = r.weekly.map(w => w.week_share_pct);
    const maxWk = Math.max(...wkShares);
    console.log(` I13 ` + summarize(r) + ` maxWkShare=${maxWk.toFixed(1)}% (cap=30%)`);
    if (maxWk > 30 + 5) {
      flag('I13', 'cap', `weekly share ${maxWk.toFixed(1)}% > cap 30% by >5pp without tank pressure`);
    }
  }

  console.log('\n══════════════════════════════════════════════════════════');
  console.log(`Total findings: ${findings.length}`);
  const byKind = findings.reduce((m, f) => { m[f.kind] = (m[f.kind] || 0) + 1; return m; }, {});
  console.log('By kind:', JSON.stringify(byKind));

  if (findings.length > 0) {
    console.log('\nFindings:');
    for (const f of findings) {
      console.log(`  [${f.kind.padEnd(9)}] ${f.scenario}: ${f.message}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
