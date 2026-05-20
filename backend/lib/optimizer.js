// Sales Rate Optimizer — Dynamic Programming solver
// Ported from the HTML prototype with all magic-number constants exposed as `rules`.
// Behavior with DEFAULT_RULES is identical to the original prototype.

import { mergeRules } from './defaultRules.js';

// Index aligned with Date.getDay(): 0=Sunday … 6=Saturday.
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Spec §6.1: WARN is triggered at fill ≥ 75% — fixed, not user-tunable. The
// `tank_threshold` rule governs reward-side urgency only; status semantics are
// stable so downstream consumers can rely on the badge meaning the same thing
// regardless of the active rules profile.
const WARN_FILL_THRESHOLD = 0.75;

// Maximum redistribution passes inside ensureFloorActual. Each pass calls
// trace() and may move MT between days; in practice convergence is reached in
// 1–3 passes. The bound is just a safety net so a degenerate scenario can't
// hang the request thread.
const FLOOR_REDISTRIBUTE_MAX_PASSES = 20;

const isWE = (d) => d.getDay() === 0 || d.getDay() === 6;

function subWorkingDays(d, n) {
  const c = new Date(d);
  let s = 0;
  while (s < n) {
    c.setDate(c.getDate() - 1);
    if (!isWE(c)) s++;
  }
  return c;
}

function buildDates(start, n) {
  const c = new Date(start);
  while (isWE(c)) c.setDate(c.getDate() + 1);
  const r = [];
  for (let i = 0; i < n; i++) {
    r.push(new Date(c));
    c.setDate(c.getDate() + 1);
    while (isWE(c)) c.setDate(c.getDate() + 1);
  }
  return r;
}

// Roll a date forward to the next working day if it falls on a weekend.
// Used so that imports/pipelines scheduled on Sat/Sun don't vanish — they
// take effect on the next planning day.
function nextWorkingDay(d) {
  const c = new Date(d);
  while (isWE(c)) c.setDate(c.getDate() + 1);
  return c;
}

function dk(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function num(v, fallback = 0) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

// ─── Build planning days ──────────────────────────────────────────────────
function buildPlanningDays(inputs, rules) {
  const start = new Date(inputs.plan_start_date);
  const n = Math.max(1, Math.min(60, parseInt(inputs.num_planning_days, 10) || 20));
  const dates = buildDates(start, n);
  const dateSet = new Set(dates.map(dk));

  const imports = (inputs.imports || []).filter((r) => num(r.quantity_mt) > 0);
  const pipeline = (inputs.pipeline || []).filter((r) => num(r.quantity_mt) > 0);
  const overrides = inputs.day_overrides || {};

  const iPhys = {};
  const iSfs = {};
  let extraOperatorSfs = 0;
  let extraCompSfs = 0;

  for (const imp of imports) {
    const arrival = new Date(imp.arrival_date);
    const qty = num(imp.quantity_mt);
    const sfsDate = subWorkingDays(arrival, rules.sfs_lead_time_days);
    // Physical arrival on a weekend isn't simulated until the next working day.
    const physDate = nextWorkingDay(arrival);
    const pk = dk(physDate);
    const sk = dk(sfsDate);
    const kk = imp.party === 'OPERATOR' || imp.party === 'LMS' ? 'op' : 'co';
    if (!iPhys[pk]) iPhys[pk] = { op: 0, co: 0 };
    if (!iSfs[sk]) iSfs[sk] = { op: 0, co: 0 };
    iPhys[pk][kk] += qty;
    iSfs[sk][kk] += qty;
    if (sfsDate < dates[0] && !dateSet.has(sk)) {
      if (kk === 'op') extraOperatorSfs += qty;
      else extraCompSfs += qty;
    }
  }

  const pipeMap = {};
  for (const p of pipeline) {
    // Clearance scheduled for a weekend takes effect on the next working day.
    const key = dk(nextWorkingDay(new Date(p.clearance_date)));
    const kk = p.party === 'OPERATOR' || p.party === 'LMS' ? 'op' : 'co';
    if (!pipeMap[key]) pipeMap[key] = { op: 0, co: 0 };
    pipeMap[key][kk] += num(p.quantity_mt);
  }

  const opDemand = num(inputs.operator_daily_demand, 650);
  const coDemand = num(inputs.comp_daily_demand, 650);
  const opLimit = num(inputs.operator_tank_limit, 40000);
  const coLimit = num(inputs.comp_tank_limit, 31000);

  // Calendar Mon–Fri week labelling: each day is grouped by the Monday of its
  // calendar week, so W1 = the calendar week containing D1 (possibly a partial
  // week if D1 is mid-week), W2 = the next Mon–Fri, etc. The WTD historical
  // seed then aligns with W1 even when D1 is not a Monday.
  const mondayKey = (d) => {
    const c = new Date(d);
    const shift = (c.getDay() + 6) % 7; // Mon→0, …, Sun→6
    c.setDate(c.getDate() - shift);
    return dk(c);
  };
  const weekIds = new Map();
  const labelFor = (d) => {
    const k = mondayKey(d);
    if (!weekIds.has(k)) weekIds.set(k, `W${weekIds.size + 1}`);
    return weekIds.get(k);
  };

  return dates.map((d, i) => {
    const key = dk(d);
    const ph = iPhys[key] || { op: 0, co: 0 };
    const sf = iSfs[key] || { op: 0, co: 0 };
    const pp = pipeMap[key] || { op: 0, co: 0 };
    const ov = overrides[String(i + 1)] || {};

    const sfsOpExtra = sf.op + (i === 0 ? extraOperatorSfs : 0) + num(ov.operator_sfs, 0);
    const sfsCoExtra = sf.co + (i === 0 ? extraCompSfs : 0) + num(ov.comp_sfs, 0);

    return {
      index: i,
      dayNumber: i + 1,
      date: d,
      weekLabel: labelFor(d),
      operatorDemand: ov.operator_demand != null ? num(ov.operator_demand) : opDemand,
      compDemand: ov.comp_demand != null ? num(ov.comp_demand) : coDemand,
      operatorLimit: ov.operator_limit != null ? num(ov.operator_limit) : opLimit,
      compLimit: ov.comp_limit != null ? num(ov.comp_limit) : coLimit,
      operatorImport: ph.op + num(ov.operator_import, 0),
      compImport: ph.co + num(ov.comp_import, 0),
      operatorSfsExtra: sfsOpExtra,
      compSfsExtra: sfsCoExtra,
      pipelineOperator: pp.op,
      pipelineComp: pp.co,
      operatorPricedCost: ov.operator_priced_cost != null ? num(ov.operator_priced_cost) : null,
      operatorUnpricedCost: ov.operator_unpriced_cost != null ? num(ov.operator_unpriced_cost) : null,
      compPricedCost: ov.comp_priced_cost != null ? num(ov.comp_priced_cost) : null,
      compUnpricedCost: ov.comp_unpriced_cost != null ? num(ov.comp_unpriced_cost) : null,
      operatorPhysOverride: i === 0 ? num(inputs.operator_physical_stock, 0) : null,
      compPhysOverride: i === 0 ? num(inputs.comp_physical_stock, 0) : null,
    };
  });
}

// ─── Build config ─────────────────────────────────────────────────────────
function buildConfig(inputs) {
  const lP = num(inputs.operator_priced_sfs);
  const lU = num(inputs.operator_unpriced_sfs);
  const tot = lP + lU;
  const dm = num(inputs.daily_max_sell_mt, 0);
  return {
    operatorSfsStart: tot,
    operatorPricedSfs: lP,
    operatorUnpricedSfs: lU,
    compSfsStart: num(inputs.comp_priced_sfs) + num(inputs.comp_unpriced_sfs),
    compPricedSfs: num(inputs.comp_priced_sfs),
    compUnpricedSfs: num(inputs.comp_unpriced_sfs),
    operatorPhysStart: num(inputs.operator_physical_stock),
    compPhysStart: num(inputs.comp_physical_stock),
    operatorPricedCost: num(inputs.operator_priced_cost, 0),
    operatorUnpricedCost: num(inputs.operator_unpriced_cost, 0),
    compPricedCost: num(inputs.comp_priced_cost, 0),
    compUnpricedCost: num(inputs.comp_unpriced_cost, 0),
    // Defensive fallbacks if validation is bypassed: monthly floor defaults to
    // 0 (no constraint) so we never silently invent a 36% target; weekly cap
    // matches the UI default (60%). Validation enforces presence on the normal
    // API path, so these only fire on direct internal calls.
    monthlyMin: num(inputs.monthly_min_share_pct, 0) / 100,
    weeklyMax: num(inputs.weekly_max_share_pct, 60) / 100,
    evacCost: num(inputs.evac_cost_per_mt, 0.1),
    dailyMax: dm > 0 ? dm : Infinity,
    histOperatorMonth: num(inputs.hist_operator_month_mt),
    histCompMonth: num(inputs.hist_comp_month_mt),
    histOperatorWeek: num(inputs.hist_operator_week_mt),
    histCompWeek: num(inputs.hist_comp_week_mt),
    lockedDay1: num(inputs.locked_sell_day1_mt),
    lambda: num(inputs.lambda_cost, 0.5),
    gamma: num(inputs.gamma_discount, 0.92),
    pricedFrac: tot > 0 ? lP / tot : 0.15,
  };
}

// Effective per-day costs (honor day-override if present).
function effCosts(day, cfg) {
  return {
    operatorPriced: day.operatorPricedCost != null ? day.operatorPricedCost : cfg.operatorPricedCost,
    operatorUnpriced: day.operatorUnpricedCost != null ? day.operatorUnpricedCost : cfg.operatorUnpricedCost,
    compPriced: day.compPricedCost != null ? day.compPricedCost : cfg.compPricedCost,
    compUnpriced: day.compUnpricedCost != null ? day.compUnpricedCost : cfg.compUnpricedCost,
  };
}

// ─── Reward function (HTML lines 388-415, parametrized) ───────────────────
// wkAcc carries cumulative weekly volumes so cap penalty can be computed as
// `new_weekly_share = (op_so_far + q) / (total_so_far + tm)`. The original
// HTML form `wkShare[week] += dailyShare` was a *sum of daily ratios* and
// didn't correspond to the actual weekly market share — it produced absurd
// values once multiple days had any sale (e.g. 5 days × 50% daily share gave
// wkShare = 2.5, treated as "250%" against the 0.6 cap).
function reward(t, q, lP, cP, lSfP, lSfU, cSfP, cSfU, wkAcc, days, cfg, rules) {
  const day = days[t];
  const c = effCosts(day, cfg);
  const WT = rules.tank_threshold;

  const fr = day.operatorLimit > 0 ? lP / day.operatorLimit : 0;
  const overflow = Math.max(0, lP - day.operatorLimit);
  const evac = Math.max(0, overflow - Math.max(0, day.compLimit - cP));
  const evacPenalty =
    evac * rules.evac_severity * cfg.evacCost +
    (fr > WT ? Math.exp((fr - WT) * rules.fill_penalty_exp) * 0.5 : 0);

  const lT = lSfP + lSfU;
  const cT = cSfP + cSfU;
  const totSfs = lT + cT;
  const sfsBonus = (totSfs > 0 ? lT / totSfs : 0) * rules.sfs_bonus_weight;

  const refCost =
    (c.operatorPriced + c.operatorUnpriced + c.compPriced + c.compUnpriced) / 4 || 1;
  const kappa = rules.kappa_base + cfg.lambda * rules.kappa_lambda_slope;
  const unpricedAdvantage = (c.compPriced - c.operatorUnpriced) / refCost;
  const compPricedFrac = cT > 0 ? cSfP / cT : 0;

  const soldPriced = Math.min(q, lSfP);
  const soldUnpriced = Math.max(0, q - soldPriced);

  // Spec §4.4: FAST when unpriced_advantage > 0; HOLD on equality (≤ 0).
  // Both branches multiply by `unpricedAdvantage`, so the equality case is
  // value-zero either way; using `>` matches the `mode` label in simulate().
  let unpricedTerm;
  if (unpricedAdvantage > 0) {
    unpricedTerm = soldUnpriced * unpricedAdvantage * cfg.lambda * kappa;
  } else {
    unpricedTerm =
      soldUnpriced * unpricedAdvantage * cfg.lambda * kappa * (0.15 + compPricedFrac * 0.85);
  }

  let pricedTerm = 0;
  if (unpricedAdvantage <= 0) {
    // HOLD priced term — matches colleague's Python (fuel_optimizer.py lines
    // 311-326). The pricedExcess penalty IS present in their code despite the
    // tech-doc only showing the positive term.
    const bench = Math.min(c.compUnpriced, c.operatorUnpriced);
    const pricedAdvantage = (bench - c.operatorPriced) / refCost;
    const pricedGate = Math.max(0.05, 1 - compPricedFrac);
    const pricedRewarded = Math.min(soldPriced, day.operatorDemand);
    const pricedExcess = Math.max(0, soldPriced - day.operatorDemand);
    pricedTerm =
      pricedRewarded * pricedAdvantage * cfg.lambda * kappa * pricedGate -
      pricedExcess * Math.abs(unpricedAdvantage) * cfg.lambda * kappa * 0.5;
  }

  // Spec §4.5 Component 4: immediate tank urgency (always evaluated)
  const urgencyImmediate = fr > WT
    ? Math.exp((fr - WT) * rules.tank_urgency_exp) * q * rules.tank_urgency_mult
    : 0;

  // Spec §4.5 Component 4: forward-looking urgency — projects fill `forward_look_days`
  // working days ahead (after subtracting q today, plus imports, minus pipeline) and
  // applies a milder urgency if the projection crosses WT while today's fill hasn't.
  let urgencyForward = 0;
  if (rules.forward_look_days > 0 && fr <= WT) {
    let projPhys = lP - q;
    const horizon = Math.min(rules.forward_look_days, days.length - 1 - t);
    for (let k = 1; k <= horizon; k++) {
      projPhys += (days[t + k].operatorImport || 0) - (days[t + k].pipelineOperator || 0);
    }
    const frProj = day.operatorLimit > 0 ? projPhys / day.operatorLimit : 0;
    if (frProj > WT) {
      urgencyForward = Math.exp((frProj - WT) * rules.forward_urgency_exp) * q * rules.forward_urgency_mult;
    }
  }

  const urgency = urgencyImmediate + urgencyForward;

  // Weekly cap penalty using the proper weekly share calculation:
  //   new_weekly_share = (op_so_far + q) / (total_so_far + tm)
  // where tm = q + compSell. The colleague's Python uses a buggy
  // sum-of-daily-shares formula instead, but empirically my BU alignment
  // is better with the correct math (10/12 vs 8/12 day-exact).
  const compSell = Math.max(0, day.operatorDemand + day.compDemand - q);
  const tm = q + compSell;
  const wkOpSoFar = (wkAcc.op[day.weekLabel] || 0);
  const wkTotalSoFar = (wkAcc.total[day.weekLabel] || 0);
  const newOp = wkOpSoFar + q;
  const newTotal = wkTotalSoFar + tm;
  const newWeekShare = newTotal > 0 ? newOp / newTotal : 0;
  let capPenalty = 0;
  if (newWeekShare > cfg.weeklyMax) {
    const excess = newWeekShare - cfg.weeklyMax;
    const relax = fr > WT ? rules.weekly_cap_relax_under_pressure : 1;
    capPenalty = excess * excess * rules.weekly_cap_penalty * relax;
  }

  return sfsBonus + unpricedTerm + pricedTerm + urgency - evacPenalty - capPenalty;
}

// ─── Shared state evolution ───────────────────────────────────────────────
// Three call sites (getStates, forwardSim, simulate) all walk the same physical
// stock / SFS / sale-delay queue dynamics. Differences are purely in side
// effects (snapshot vs. reward + wkAcc vs. daily output). Centralizing the
// state-update logic keeps them locked in step so future spec changes don't
// have to be applied three times.

function initState(days, cfg) {
  return {
    lP: days[0].operatorPhysOverride != null ? days[0].operatorPhysOverride : cfg.operatorPhysStart,
    cP: days[0].compPhysOverride != null ? days[0].compPhysOverride : cfg.compPhysStart,
    lSfP: cfg.operatorPricedSfs,
    lSfU: cfg.operatorUnpricedSfs,
    cSfP: cfg.compPricedSfs,
    cSfU: cfg.compUnpricedSfs,
    opQueue: [],
    coQueue: [],
  };
}

// Apply the day's pre-sale events (in spec order): SFS unlocks, pipeline drain,
// queued-out sales from `delay` working days ago, import-in, then clamp.
function advanceToPreSale(s, day, delay) {
  s.lSfU += day.operatorSfsExtra;
  s.cSfU += day.compSfsExtra;
  s.lP -= day.pipelineOperator;
  s.cP -= day.pipelineComp;
  if (s.opQueue.length >= delay) s.lP -= s.opQueue.shift();
  if (s.coQueue.length >= delay) s.cP -= s.coQueue.shift();
  s.lP += day.operatorImport;
  s.cP += day.compImport;
  s.lP = Math.max(0, s.lP);
  s.cP = Math.max(0, s.cP);
}

// Commit a chosen operator sale for the day: push both sides into the 5-day
// queue and drain SFS priced-first. Returns the SFS portions actually sold so
// callers can report priced vs. unpriced splits.
function commitSale(s, day, operatorSell) {
  const dTotal = day.operatorDemand + day.compDemand;
  const compSell = Math.max(0, dTotal - operatorSell);
  s.opQueue.push(operatorSell);
  s.coQueue.push(compSell);

  const sp = Math.min(operatorSell, s.lSfP);
  const su = Math.min(operatorSell - sp, s.lSfU);
  s.lSfP = Math.max(0, s.lSfP - sp);
  s.lSfU = Math.max(0, s.lSfU - su);

  const cp = Math.min(compSell, s.cSfP);
  const cu = Math.min(compSell - cp, s.cSfU);
  s.cSfP = Math.max(0, s.cSfP - cp);
  s.cSfU = Math.max(0, s.cSfU - cu);

  return { compSell, sp, su, cp, cu };
}

// ─── Per-day state trace ──────────────────────────────────────────────────
function getStates(sales, days, cfg, rules) {
  const s = initState(days, cfg);
  const delay = rules.sale_tank_delay_days;
  const states = [];
  for (let t = 0; t < days.length; t++) {
    advanceToPreSale(s, days[t], delay);
    states.push({
      lP: s.lP, cP: s.cP,
      lSfP: s.lSfP, lSfU: s.lSfU, lSf: s.lSfP + s.lSfU,
      cSfP: s.cSfP, cSfU: s.cSfU, cSf: s.cSfP + s.cSfU,
    });
    commitSale(s, days[t], sales[t]);
  }
  return states;
}

// Seed week accumulator with the WTD historical totals (MT, not fractions).
// Centralized so forwardSim and optimizeQuantities can't drift in how they
// apply the seed. The cap penalty uses these as denominators in the proper
// weekly-share calculation.
function seedWeeklyAccumulator(wkAcc, days, cfg) {
  if (days.length === 0) return;
  const firstWk = days[0].weekLabel;
  wkAcc.op[firstWk] = cfg.histOperatorWeek;
  wkAcc.total[firstWk] = cfg.histOperatorWeek + cfg.histCompWeek;
}

// ─── Forward sim with backward gamma propagation ──────────────────────────
function forwardSim(sales, days, cfg, rules) {
  const n = days.length;
  const stateValues = new Array(n).fill(0);
  const s = initState(days, cfg);
  const delay = rules.sale_tank_delay_days;
  // wkAcc tracks cumulative operator + total market volume per week (in MT).
  // Used by the cap-penalty formula as proper share = (wkOp + q) / (wkTotal + tm).
  const wkAcc = { op: {}, total: {} };
  seedWeeklyAccumulator(wkAcc, days, cfg);

  for (let t = 0; t < n; t++) {
    const day = days[t];
    advanceToPreSale(s, day, delay);

    stateValues[t] = reward(t, sales[t], s.lP, s.cP, s.lSfP, s.lSfU, s.cSfP, s.cSfU, wkAcc, days, cfg, rules);

    const dTotal = day.operatorDemand + day.compDemand;
    const compSell = Math.max(0, dTotal - sales[t]);
    wkAcc.op[day.weekLabel] = (wkAcc.op[day.weekLabel] || 0) + sales[t];
    wkAcc.total[day.weekLabel] = (wkAcc.total[day.weekLabel] || 0) + (sales[t] + compSell);

    commitSale(s, day, sales[t]);
  }

  for (let t = n - 2; t >= 0; t--) stateValues[t] += cfg.gamma * stateValues[t + 1];
  return stateValues;
}

// ─── Optimize sell quantity per day ───────────────────────────────────────
function optimizeQuantities(sales, days, stateValues, cfg, rules) {
  const n = days.length;
  const newSales = sales.slice();
  const states = getStates(sales, days, cfg, rules);
  const wkAcc = { op: {}, total: {} };
  const WT = rules.tank_threshold;
  seedWeeklyAccumulator(wkAcc, days, cfg);

  for (let t = 0; t < n; t++) {
    const day = days[t];
    const c = effCosts(day, cfg);

    if (t === 0 && cfg.lockedDay1 > 0) {
      newSales[0] = cfg.lockedDay1;
      const compSell0 = Math.max(0, day.operatorDemand + day.compDemand - newSales[0]);
      wkAcc.op[day.weekLabel] = (wkAcc.op[day.weekLabel] || 0) + newSales[0];
      wkAcc.total[day.weekLabel] = (wkAcc.total[day.weekLabel] || 0) + (newSales[0] + compSell0);
      continue;
    }

    const maxSfs = states[t].lSf;
    if (maxSfs <= 0) {
      newSales[t] = 0;
      continue;
    }

    // Matches colleague's Python (fuel_optimizer.py line 622-630):
    //   is_hold_mode = (lambda >= 0.3) AND (lms_unpriced >= comp_priced)
    //   hold_factor = max(0.1, 2.5 - 3.0 * lambda)
    //   effective_capacity = max(max_sfs * priced_fraction * hold_factor, demand * 0.3)
    // The `lambda >= 0.3` gate means at low λ, HOLD-mode capacity narrowing
    // is BYPASSED — the model can sell up to total SFS freely.
    const isHold = cfg.lambda >= 0.3 && c.operatorUnpriced >= c.compPriced;
    const h = Math.max(0.1, rules.hold_capacity_base - rules.hold_capacity_slope * cfg.lambda);
    let effCap = isHold
      ? Math.max(states[t].lSf * cfg.pricedFrac * h, day.operatorDemand * 0.3)
      : maxSfs;

    const fr = day.operatorLimit > 0 ? states[t].lP / day.operatorLimit : 0;
    if (fr > WT) effCap = maxSfs;
    effCap = Math.max(effCap, day.operatorDemand);
    if (cfg.dailyMax !== Infinity) effCap = Math.min(effCap, cfg.dailyMax);

    // Weekly cap enforcement is purely the soft quadratic penalty inside
    // reward() (spec §4.5 Component 6). No hard search-space clamp — that
    // matches the HTML prototype / BU reference model, which front-loads
    // aggressively on FAST days when the cost edge outweighs the cap penalty.

    let bestValue = -Infinity;
    let bestQty = 0;
    const s = states[t];
    // Spec §4.6: K evenly-spaced candidates between 0 and effective_capacity.
    // K points covering [0, effCap] inclusive → divisor is K-1.
    const K = Math.max(2, parseInt(rules.candidates_per_day, 10) || 12);
    for (let i = 0; i < K; i++) {
      const cand = Math.round((i / (K - 1)) * effCap);
      const r = reward(t, cand, s.lP, s.cP, s.lSfP, s.lSf - s.lSfP, s.cSfP, s.cSf - s.cSfP, wkAcc, days, cfg, rules);
      const fv = t < n - 1 ? cfg.gamma * stateValues[t + 1] : 0;
      if (r + fv > bestValue) {
        bestValue = r + fv;
        bestQty = cand;
      }
    }

    newSales[t] = bestQty;
    const compSellCommit = Math.max(0, day.operatorDemand + day.compDemand - bestQty);
    wkAcc.op[day.weekLabel] = (wkAcc.op[day.weekLabel] || 0) + bestQty;
    wkAcc.total[day.weekLabel] = (wkAcc.total[day.weekLabel] || 0) + (bestQty + compSellCommit);
  }
  return newSales;
}

// ─── Monthly minimum floor enforcement ────────────────────────────────────
function enforceMonthlyMin(sales, days, cfg, rules) {
  // Growing-market target (spec §4.7 + HTML prototype): assumes comp sells
  // exactly Σ D_t^COMP, then required op = mm × totalComp / (1 − mm) so the
  // share lands at mm. ensureFloorActual re-checks the actual share later.
  const totalComp = cfg.histCompMonth + days.reduce((s, d) => s + d.compDemand, 0);
  let target = 0;
  if (cfg.monthlyMin > 0) {
    target = Math.min(
      Math.max(0, Math.ceil((cfg.monthlyMin * totalComp) / (1 - cfg.monthlyMin)) + 1 - cfg.histOperatorMonth),
      cfg.operatorSfsStart + days.reduce((s, d) => s + d.operatorSfsExtra, 0)
    );
  }
  const currentSum = sales.reduce((a, b) => a + b, 0);
  if (currentSum >= target) return sales;

  const sf = Math.min((target / Math.max(1, currentSum)) * rules.floor_boost, rules.floor_scale_cap);
  // Track running priced / unpriced separately (spec §4.3: imports unlock unpriced).
  // This lets the HOLD-mode cap reflect the *current* priced fraction, not the
  // opening one — important once priced has been mostly depleted.
  let availP = cfg.operatorPricedSfs;
  let availU = cfg.operatorUnpricedSfs;
  for (let i = 0; i < days.length; i++) {
    if (i === 0 && cfg.lockedDay1 > 0) {
      const sp0 = Math.min(cfg.lockedDay1, availP);
      availP = Math.max(0, availP - sp0);
      availU = Math.max(0, availU - (cfg.lockedDay1 - sp0));
      continue;
    }
    availU += days[i].operatorSfsExtra;
    const totalAvail = availP + availU;
    const c = effCosts(days[i], cfg);
    // λ ≥ 0.3 gate matches colleague's Python (line 822-823).
    const isHold = cfg.lambda >= 0.3 && c.operatorUnpriced >= c.compPriced;
    const cap = isHold
      ? Math.max(totalAvail * cfg.pricedFrac, days[i].operatorDemand)
      : totalAvail;
    const boosted = Math.round(sales[i] * sf);
    sales[i] = Math.min(boosted, Math.floor(cap), Math.floor(totalAvail));
    const sp = Math.min(sales[i], availP);
    availP = Math.max(0, availP - sp);
    availU = Math.max(0, availU - (sales[i] - sp));
  }

  let shortfall = target - sales.reduce((a, b) => a + b, 0);
  const order = days.map((_, i) => i);

  // Pre-compute per-day total availability. HOLD-mode cap uses opening
  // pricedFrac (cfg.pricedFrac) — see note in the proportional-scale loop
  // above — so we no longer need a per-day priced fraction array.
  const availPerDay = [];
  let pAvail = cfg.operatorSfsStart;
  for (let i = 0; i < days.length; i++) {
    pAvail += days[i].operatorSfsExtra;
    availPerDay.push(pAvail);
    pAvail = Math.max(0, pAvail - sales[i]);
  }

  for (const idx of order) {
    if (shortfall <= 0) break;
    if (idx === 0 && cfg.lockedDay1 > 0) continue;
    const av = availPerDay[idx];
    const c = effCosts(days[idx], cfg);
    // λ ≥ 0.3 gate matches colleague's Python (line 861-862).
    const isHold = cfg.lambda >= 0.3 && c.operatorUnpriced >= c.compPriced;
    let cap = isHold
      ? Math.max(Math.min(av, av * cfg.pricedFrac), days[idx].operatorDemand)
      : av;
    cap = Math.min(cap, av);
    if (cfg.dailyMax !== Infinity) cap = Math.min(cap, cfg.dailyMax);
    const room = Math.max(0, Math.floor(cap) - sales[idx]);
    if (room > 0) {
      const add = Math.min(room, shortfall);
      sales[idx] += add;
      shortfall -= add;
    }
  }

  // Final fallback greedy without demand cap (matches Python lines 880-898).
  // If demand-capped greedy didn't reach target, try again with only the SFS
  // and daily-max caps. Catches edge cases where target is unreachable under
  // the HOLD/demand cap but reachable with raw SFS.
  if (shortfall > 0) {
    for (const idx of order) {
      if (shortfall <= 0) break;
      if (idx === 0 && cfg.lockedDay1 > 0) continue;
      const cap = Math.min(availPerDay[idx], cfg.dailyMax !== Infinity ? cfg.dailyMax : availPerDay[idx]);
      const room = Math.max(0, Math.floor(cap) - sales[idx]);
      if (room > 0) {
        const add = Math.min(room, shortfall);
        sales[idx] += add;
        shortfall -= add;
      }
    }
  }
  return sales;
}

// ─── Reconcile against SFS availability ───────────────────────────────────
function reconcileSfs(sales, days, cfg) {
  const dailyLimit = cfg.dailyMax; // Infinity when unset; Math.min handles it.
  let rem = cfg.operatorSfsStart;
  let trimmed = 0;
  for (let i = 0; i < days.length; i++) {
    rem += days[i].operatorSfsExtra;
    const mx = Math.min(sales[i], rem, dailyLimit);
    trimmed += sales[i] - mx;
    sales[i] = mx;
    rem = Math.max(0, rem - mx);
  }
  if (trimmed > 1) {
    rem = cfg.operatorSfsStart;
    const ceils = [];
    for (let i = 0; i < days.length; i++) {
      rem += days[i].operatorSfsExtra;
      ceils.push(Math.min(rem, dailyLimit));
      rem = Math.max(0, rem - sales[i]);
    }
    for (let i = days.length - 1; i >= 0; i--) {
      if (trimmed <= 0) break;
      const room = Math.max(0, ceils[i] - sales[i]);
      if (room > 0) {
        const add = Math.min(room, trimmed);
        sales[i] += add;
        trimmed -= add;
      }
    }
  }
  return sales;
}

// ─── Final floor verification ─────────────────────────────────────────────
// Re-checks the actual share after enforceMonthlyMin + reconcileSfs and tops
// up if the floor isn't met. Under growing-market semantics:
//   • cumOp grows by actualSell, cumTotal grows by actualSell + comp_sell.
//   • Strategy 1: ADD to under-demand days (sale + add ≤ D_total) so we don't
//     inflate cumTotal more than we grow cumOp.
//   • Strategy 2: REDISTRIBUTE from over-demand donors to under-demand
//     recipients — keeps cumOp constant but shrinks cumTotal, pulling the
//     share up. Two phases: non-inflating placements first, then permit
//     inflation if necessary.
function ensureFloorActual(sales, days, cfg) {
  if (cfg.monthlyMin <= 0) return sales;

  const dailyCap = cfg.dailyMax === Infinity ? Infinity : cfg.dailyMax;

  const trace = () => {
    let lSfP = cfg.operatorPricedSfs;
    let lSfU = cfg.operatorUnpricedSfs;
    let cumOp = cfg.histOperatorMonth;
    let cumTotal = cfg.histOperatorMonth + cfg.histCompMonth;
    const sfsAvail = new Array(days.length);
    const actualSold = new Array(days.length);
    for (let t = 0; t < days.length; t++) {
      lSfU += days[t].operatorSfsExtra;
      const lT = lSfP + lSfU;
      sfsAvail[t] = lT;
      const actualSell = Math.min(sales[t], Math.max(0, lT), dailyCap);
      actualSold[t] = actualSell;
      const compSell = Math.max(0, days[t].operatorDemand + days[t].compDemand - actualSell);
      cumOp += actualSell;
      cumTotal += actualSell + compSell;
      const sp = Math.min(actualSell, lSfP);
      lSfP = Math.max(0, lSfP - sp);
      lSfU = Math.max(0, lSfU - (actualSell - sp));
    }
    return { cumOp, cumTotal, sfsAvail, actualSold };
  };

  const shareOk = (tr) => tr.cumTotal > 0 && tr.cumOp / tr.cumTotal >= cfg.monthlyMin - 1e-9;

  for (let pass = 0; pass < FLOOR_REDISTRIBUTE_MAX_PASSES; pass++) {
    let tr = trace();
    if (shareOk(tr)) return sales;
    let progressedThisPass = false;

    // ── Strategy 1: ADD to under-demand days (doesn't inflate cumTotal). ──
    {
      const gap = Math.ceil(cfg.monthlyMin * tr.cumTotal - tr.cumOp);
      if (gap > 0) {
        const order = days.map((_, i) => i).sort((a, b) => tr.actualSold[a] - tr.actualSold[b]);
        let remaining = gap;
        for (const i of order) {
          if (remaining <= 0) break;
          if (i === 0 && cfg.lockedDay1 > 0) continue;
          const dTotal = days[i].operatorDemand + days[i].compDemand;
          const room = Math.min(
            Math.max(0, dTotal - tr.actualSold[i]),
            Math.max(0, tr.sfsAvail[i] - tr.actualSold[i]),
            Math.max(0, dailyCap - tr.actualSold[i])
          );
          const add = Math.min(room, remaining);
          if (add > 0) {
            sales[i] = tr.actualSold[i] + add;
            remaining -= add;
            progressedThisPass = true;
          }
        }
        if (progressedThisPass) tr = trace();
        if (shareOk(tr)) return sales;
      }
    }

    // ── Strategy 2: REDISTRIBUTE from over-demand to under-demand. Each MT
    // moved keeps cumOp constant but shrinks cumTotal by 1 (donor's day stops
    // contributing above D_total; recipient stays at D_total).
    {
      const targetCumTotal = tr.cumOp / cfg.monthlyMin;
      let reductionNeeded = Math.ceil(tr.cumTotal - targetCumTotal);
      if (reductionNeeded <= 0) return sales;

      const donors = [];
      for (let i = 0; i < days.length; i++) {
        if (i === 0 && cfg.lockedDay1 > 0) continue;
        const dTotal = days[i].operatorDemand + days[i].compDemand;
        const excess = tr.actualSold[i] - dTotal;
        if (excess > 0) donors.push({ i, excess });
      }
      if (donors.length === 0) {
        if (!progressedThisPass) break;
        continue;
      }
      donors.sort((a, b) => b.excess - a.excess);

      for (const d of donors) {
        if (reductionNeeded <= 0) break;
        const moveIntent = Math.min(d.excess, reductionNeeded);
        const donorBefore = sales[d.i];
        sales[d.i] = Math.max(0, donorBefore - moveIntent);
        let remaining = moveIntent;

        const recOrder = () => {
          const t = trace();
          return {
            tr: t,
            order: days.map((_, i) => i).sort((a, b) => t.actualSold[a] - t.actualSold[b]),
          };
        };

        // Phase A: non-inflating placements (sale + add ≤ D_total).
        {
          let safetyCounter = 0;
          while (remaining > 0 && safetyCounter++ < days.length * 2) {
            const { tr: trX, order } = recOrder();
            let placedThisPass = 0;
            for (const j of order) {
              if (remaining <= 0) break;
              if (j === d.i) continue;
              if (j === 0 && cfg.lockedDay1 > 0) continue;
              const dTotalRecip = days[j].operatorDemand + days[j].compDemand;
              const room = Math.min(
                Math.max(0, dTotalRecip - trX.actualSold[j]),
                Math.max(0, trX.sfsAvail[j] - trX.actualSold[j]),
                Math.max(0, dailyCap - trX.actualSold[j])
              );
              const add = Math.min(room, remaining);
              if (add > 0) {
                sales[j] = trX.actualSold[j] + add;
                remaining -= add;
                placedThisPass += add;
              }
            }
            if (placedThisPass === 0) break;
          }
        }

        // Phase B: allow inflation (still better than leaving on donor).
        {
          let safetyCounter = 0;
          while (remaining > 0 && safetyCounter++ < days.length * 2) {
            const { tr: trX, order } = recOrder();
            let placedThisPass = 0;
            for (const j of order) {
              if (remaining <= 0) break;
              if (j === d.i) continue;
              if (j === 0 && cfg.lockedDay1 > 0) continue;
              const room = Math.min(
                Math.max(0, trX.sfsAvail[j] - trX.actualSold[j]),
                Math.max(0, dailyCap - trX.actualSold[j])
              );
              const add = Math.min(room, remaining);
              if (add > 0) {
                sales[j] = trX.actualSold[j] + add;
                remaining -= add;
                placedThisPass += add;
              }
            }
            if (placedThisPass === 0) break;
          }
        }

        if (remaining > 0) sales[d.i] += remaining;
        const moved = moveIntent - remaining;
        reductionNeeded -= moved;
        if (moved > 0) progressedThisPass = true;
      }
    }

    if (!progressedThisPass) break; // saturated
  }
  return sales;
}

// ─── DP solver ────────────────────────────────────────────────────────────
function dpSolve(days, cfg, rules) {
  const n = days.length;
  let sales = days.map((d) => Math.min(d.operatorDemand * 0.5, 200));
  if (cfg.lockedDay1 > 0) sales[0] = cfg.lockedDay1;

  let stateValues = new Array(n).fill(0);
  let iterations = 0;
  const maxIt = Math.max(1, Math.min(100, parseInt(rules.max_iterations, 10) || 25));
  const conv = Math.max(0.01, num(rules.convergence_mt, 1));

  for (let it = 0; it < maxIt; it++) {
    iterations++;
    stateValues = forwardSim(sales, days, cfg, rules);
    const next = optimizeQuantities(sales, days, stateValues, cfg, rules);
    const maxChange = next.reduce((mx, v, i) => Math.max(mx, Math.abs(v - sales[i])), 0);
    sales = next;
    if (maxChange < conv) break;
  }
  sales = enforceMonthlyMin(sales, days, cfg, rules);
  sales = reconcileSfs(sales, days, cfg);
  // Note: ensureFloorActual() exists but is intentionally NOT called — it
  // would redistribute D1 front-loads to push share up, conflicting with
  // BU "sell aggressively" expectations. The volume-based target in
  // enforceMonthlyMin (spec §4.7) is the floor mechanism. When SFS is
  // insufficient to meet the share floor, the result is reported under-floor
  // and surfaced via the floor-alert in the UI.
  return { sales, iterations };
}

// ─── Final simulation → DailyResult[] ─────────────────────────────────────
function simulate(sales, days, cfg, rules) {
  const s = initState(days, cfg);
  const delay = rules.sale_tank_delay_days;
  let cumOperator = cfg.histOperatorMonth;
  let cumTotal = cfg.histOperatorMonth + cfg.histCompMonth;
  const out = [];

  for (let t = 0; t < days.length; t++) {
    const day = days[t];
    advanceToPreSale(s, day, delay);

    const spareComp = Math.max(0, day.compLimit - s.cP);
    const overflow = Math.max(0, s.lP - day.operatorLimit);
    const borrowed = Math.min(overflow, spareComp);
    const evacuated = Math.max(0, overflow - spareComp);
    const fillPct = day.operatorLimit > 0 ? s.lP / day.operatorLimit : 0;
    const lT = s.lSfP + s.lSfU;
    const cT = s.cSfP + s.cSfU;
    const sfsShare = lT + cT > 0 ? lT / (lT + cT) : 0;

    const actualSell = Math.min(sales[t], Math.max(0, lT), cfg.dailyMax);
    const dTotal = day.operatorDemand + day.compDemand;

    let status = 'OK';
    if (evacuated > 0) status = 'EVAC';
    else if (borrowed > 0) status = 'BORROW';
    else if (fillPct >= WARN_FILL_THRESHOLD) status = 'WARN'; // spec §6.1 fixed

    const { compSell, sp, su } = commitSale(s, day, actualSell);

    // Growing-market share semantics (matches the HTML prototype + BU reference
    // model): cumulative market = sum of actual sales by both parties. When the
    // operator over-sells beyond D_total, comp_sell drops to 0 and tm equals
    // the operator's sale, giving 100% share on that day. Over-sell IS
    // rewarded — it captures that day's market by displacing the competitor.
    const tm = actualSell + compSell;
    const dailyShare = tm > 0 ? actualSell / tm : 0;
    cumOperator += actualSell;
    cumTotal += tm;
    const cumShare = cumTotal > 0 ? cumOperator / cumTotal : 0;
    // Diagnostic fields preserved on the output for the frontend; under
    // growing-market they equal sell_quantity and tm respectively.
    const opCaptured = actualSell;

    const c = effCosts(day, cfg);
    const costAdv = c.compPriced - c.operatorUnpriced;
    const mode = costAdv > 0 ? 'FAST' : 'HOLD';

    out.push({
      day_number: day.dayNumber,
      date: dk(day.date),
      week_label: day.weekLabel,
      weekday: WD[day.date.getDay()],
      sell_quantity: actualSell,
      sold_priced: sp,
      sold_unpriced: su,
      sfs_priced_remaining: s.lSfP,
      sfs_unpriced_remaining: s.lSfU,
      sfs_remaining: s.lSfP + s.lSfU,
      comp_sfs_remaining: s.cSfP + s.cSfU,
      operator_physical_stock: s.lP,
      comp_physical_stock: s.cP,
      operator_tank_limit: day.operatorLimit,
      comp_tank_limit: day.compLimit,
      fill_percentage: Math.max(0, fillPct),
      sfs_share: sfsShare,
      borrowed_quantity: borrowed,
      evacuated_quantity: evacuated,
      evacuation_cost: evacuated * cfg.evacCost,
      daily_market_share: dailyShare,
      cumulative_market_share: cumShare,
      comp_sell_quantity: compSell,
      status,
      is_locked: t === 0 && cfg.lockedDay1 > 0,
      mode,
      cost_advantage: costAdv,
      operator_demand: day.operatorDemand,
      d_total: dTotal,
      op_captured: opCaptured,
    });
  }
  return out;
}

// ─── Roll-ups ─────────────────────────────────────────────────────────────
function buildSummary(daily, cfg) {
  const totalSold = daily.reduce((s, r) => s + r.sell_quantity, 0);
  const priced = daily.reduce((s, r) => s + r.sold_priced, 0);
  const unpriced = daily.reduce((s, r) => s + r.sold_unpriced, 0);
  const evac = daily.reduce((s, r) => s + r.evacuated_quantity, 0);
  const evacCost = daily.reduce((s, r) => s + r.evacuation_cost, 0);
  const final = daily.length > 0 ? daily[daily.length - 1].cumulative_market_share : 0;
  const peak = daily.length > 0 ? Math.max(...daily.map((r) => r.fill_percentage)) : 0;
  const avgSfs =
    daily.length > 0 ? daily.reduce((s, r) => s + r.sfs_share, 0) / daily.length : 0;
  const openingSfs = cfg.operatorSfsStart;
  return {
    total_sold_mt: totalSold,
    priced_sold_mt: priced,
    unpriced_sold_mt: unpriced,
    pct_of_opening_sfs: openingSfs > 0 ? (totalSold / openingSfs) * 100 : 0,
    final_market_share_pct: final * 100,
    avg_sfs_share_pct: avgSfs * 100,
    peak_tank_fill_pct: peak * 100,
    total_evacuated_mt: evac,
    total_evacuation_cost_usd: evacCost,
  };
}

function buildWeekly(daily) {
  const wks = {};
  for (const r of daily) {
    if (!wks[r.week_label]) wks[r.week_label] = [];
    wks[r.week_label].push(r);
  }
  return Object.entries(wks)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([wk, rows]) => {
      const sales = rows.reduce((s, r) => s + r.sell_quantity, 0);
      const priced = rows.reduce((s, r) => s + r.sold_priced, 0);
      const unpriced = rows.reduce((s, r) => s + r.sold_unpriced, 0);
      const comp = rows.reduce((s, r) => s + r.comp_sell_quantity, 0);
      const evac = rows.reduce((s, r) => s + r.evacuated_quantity, 0);
      // Growing-market share: sales / (sales + comp_sales) — consistent with
      // simulate()'s per-day share.
      const share = sales + comp > 0 ? (sales / (sales + comp)) * 100 : 0;
      const avgFill = (rows.reduce((s, r) => s + r.fill_percentage, 0) / rows.length) * 100;
      return {
        week_label: wk,
        day_range: `D${rows[0].day_number}-D${rows[rows.length - 1].day_number}`,
        sales_mt: sales,
        priced_mt: priced,
        unpriced_mt: unpriced,
        comp_sales_mt: comp,
        week_share_pct: share,
        avg_fill_pct: avgFill,
        evacuated_mt: evac,
      };
    });
}

// Surface non-blocking issues the model can't fix by itself (e.g. locked-Day-1
// configurations that breach the weekly cap or daily max, or imports/pipelines
// whose dates fall outside the plan window and are silently dropped). The UI
// renders these as warning chips alongside the floor alert.
function buildWarnings(cfg, days, daily, inputs, rules) {
  const warnings = [];

  // Imports/pipelines outside the plan window. An import has no effect iff its
  // physical arrival doesn't land on a plan day AND its SFS unlock falls after
  // the last plan day (unlocks before plan start are bundled to D1 — useful).
  if (days.length > 0) {
    const planDateSet = new Set(days.map((d) => dk(d.date)));
    const planEnd = days[days.length - 1].date;

    for (const imp of (inputs.imports || [])) {
      const qty = Number(imp.quantity_mt);
      if (!(qty > 0)) continue;
      const arrival = new Date(imp.arrival_date);
      if (Number.isNaN(arrival.getTime())) continue;
      const physDate = nextWorkingDay(arrival);
      const sfsDate = subWorkingDays(arrival, rules.sfs_lead_time_days);
      const physInPlan = planDateSet.has(dk(physDate));
      const sfsInPlanOrBefore = sfsDate.getTime() <= planEnd.getTime();
      if (!physInPlan && !sfsInPlanOrBefore) {
        warnings.push(
          `Import (${imp.party}, ${qty.toFixed(0)} MT, ${imp.arrival_date}) falls outside the plan window — no SFS unlock or physical arrival will be simulated.`
        );
      }
    }

    for (const p of (inputs.pipeline || [])) {
      const qty = Number(p.quantity_mt);
      if (!(qty > 0)) continue;
      const clr = new Date(p.clearance_date);
      if (Number.isNaN(clr.getTime())) continue;
      const rolled = nextWorkingDay(clr);
      if (!planDateSet.has(dk(rolled))) {
        warnings.push(
          `Pipeline clearance (${p.party}, ${qty.toFixed(0)} MT, ${p.clearance_date}) doesn't land on a plan day — it will have no effect.`
        );
      }
    }
  }

  if (cfg.lockedDay1 > 0 && days.length > 0) {
    const d0 = days[0];
    // Growing-market share for the week-1 projection: matches simulate().
    const compSell0 = Math.max(0, d0.operatorDemand + d0.compDemand - cfg.lockedDay1);
    const w1Op = cfg.histOperatorWeek + cfg.lockedDay1;
    const w1Total = cfg.histOperatorWeek + cfg.histCompWeek + cfg.lockedDay1 + compSell0;
    const w1Share = w1Total > 0 ? w1Op / w1Total : 0;
    if (cfg.weeklyMax < 1 && w1Share > cfg.weeklyMax + 0.01) {
      warnings.push(
        `Day-1 lock of ${cfg.lockedDay1.toFixed(0)} MT pushes week-1 share to ${(w1Share * 100).toFixed(1)}%, above the ${(cfg.weeklyMax * 100).toFixed(0)}% cap.`
      );
    }
    if (cfg.dailyMax !== Infinity && cfg.lockedDay1 > cfg.dailyMax) {
      warnings.push(
        `Day-1 lock of ${cfg.lockedDay1.toFixed(0)} MT exceeds the daily max of ${cfg.dailyMax.toFixed(0)} MT (sale will be capped in simulation).`
      );
    }
    if (daily[0] && daily[0].sell_quantity + 0.5 < cfg.lockedDay1) {
      warnings.push(
        `Day-1 lock requested ${cfg.lockedDay1.toFixed(0)} MT but only ${daily[0].sell_quantity.toFixed(0)} MT was sellable (SFS or daily-max constraint).`
      );
    }
  }
  return warnings;
}

// ─── Entry point ──────────────────────────────────────────────────────────
export function runOptimizer(payload = {}) {
  const inputs = payload.inputs || payload;
  const rules = mergeRules(payload.rules);
  const operatorLabel = (payload.operator_label || inputs.operator_label || 'Operator').toString();

  const days = buildPlanningDays(inputs, rules);
  const cfg = buildConfig(inputs);
  const { sales, iterations } = dpSolve(days, cfg, rules);
  const daily = simulate(sales, days, cfg, rules);
  const summary = buildSummary(daily, cfg);
  const weekly = buildWeekly(daily);
  const warnings = buildWarnings(cfg, days, daily, inputs, rules);

  const costAdvOpening = cfg.compPricedCost - cfg.operatorUnpricedCost;
  // Cost mode summary reflects the plan as a whole: majority of FAST vs HOLD
  // days, with HOLD winning ties (matches spec §4.4 which treats equality as
  // HOLD). Day overrides that flip the cost picture are now visible here,
  // whereas the old "opening costs only" label could mislead.
  let fastDays = 0;
  let totalAdv = 0;
  for (const d of daily) {
    if (d.mode === 'FAST') fastDays++;
    totalAdv += d.cost_advantage;
  }
  const holdDays = daily.length - fastDays;
  const costMode = fastDays > holdDays ? 'FAST' : 'HOLD';
  const costAdvAvg = daily.length > 0 ? totalAdv / daily.length : costAdvOpening;

  return {
    operator_label: operatorLabel,
    cost_mode: costMode,
    cost_advantage_opening: costAdvOpening,
    cost_advantage_avg: costAdvAvg,
    fast_days: fastDays,
    hold_days: holdDays,
    dp_iterations: iterations,
    rules_applied: rules,
    warnings,
    summary,
    weekly,
    daily,
  };
}
