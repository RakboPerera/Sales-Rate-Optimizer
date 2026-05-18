// Input + rules validation. Single source of truth — returns first violation.
// Per spec §7.

import { DEFAULT_RULES } from './defaultRules.js';

function err(field, message) {
  return { field, message };
}

const RULE_RANGES = {
  max_iterations: [1, 100],
  convergence_mt: [0.01, 50],
  candidates_per_day: [3, 50],
  sale_tank_delay_days: [1, 20],
  sfs_lead_time_days: [0, 20],
  tank_threshold: [0.1, 1.0],
  evac_severity: [1, 5000],
  fill_penalty_exp: [1, 50],
  tank_urgency_exp: [1, 50],
  tank_urgency_mult: [0, 1],
  forward_look_days: [0, 20],
  forward_urgency_exp: [1, 50],
  forward_urgency_mult: [0, 1],
  weekly_cap_penalty: [1, 10000],
  weekly_cap_relax_under_pressure: [0, 1],
  floor_boost: [1.0, 5.0],
  floor_scale_cap: [1.0, 20.0],
  sfs_bonus_weight: [0, 200],
  kappa_base: [0, 50],
  kappa_lambda_slope: [0, 50],
  hold_capacity_base: [0, 10],
  hold_capacity_slope: [0, 10],
};

const RULE_LABELS = {
  max_iterations: 'Max DP iterations',
  convergence_mt: 'Convergence threshold (MT)',
  candidates_per_day: 'Candidates per day',
  sale_tank_delay_days: 'Sale-to-tank delay (days)',
  sfs_lead_time_days: 'SFS unlock lead time (days)',
  tank_threshold: 'Tank pressure threshold',
  evac_severity: 'Evacuation severity multiplier',
  fill_penalty_exp: 'Fill penalty curve exponent',
  tank_urgency_exp: 'Tank urgency exponent',
  tank_urgency_mult: 'Tank urgency multiplier',
  forward_look_days: 'Forward-look horizon (days)',
  forward_urgency_exp: 'Forward urgency exponent',
  forward_urgency_mult: 'Forward urgency multiplier',
  weekly_cap_penalty: 'Weekly cap penalty weight',
  weekly_cap_relax_under_pressure: 'Weekly cap relaxation under pressure',
  floor_boost: 'Floor enforcement boost',
  floor_scale_cap: 'Floor scaling cap',
  sfs_bonus_weight: 'SFS position bonus weight',
  kappa_base: 'κ base',
  kappa_lambda_slope: 'κ λ-slope',
  hold_capacity_base: 'HOLD capacity base',
  hold_capacity_slope: 'HOLD capacity slope',
};

export function validateOptimizerRequest(payload) {
  if (!payload || typeof payload !== 'object') {
    return err('payload', 'Request body must be a JSON object.');
  }
  const inputs = payload.inputs || payload;
  if (!inputs || typeof inputs !== 'object') {
    return err('inputs', 'Missing inputs object.');
  }

  if (!inputs.plan_start_date) return err('plan_start_date', 'Start date is required.');
  if (Number.isNaN(new Date(inputs.plan_start_date).getTime()))
    return err('plan_start_date', 'Start date is not a valid date.');

  const days = Number(inputs.num_planning_days);
  if (!Number.isFinite(days) || days < 1 || days > 60)
    return err('num_planning_days', 'Planning days must be between 1 and 60.');

  const opP = Number(inputs.operator_priced_sfs) || 0;
  const opU = Number(inputs.operator_unpriced_sfs) || 0;
  if (opP + opU <= 0)
    return err('operator_priced_sfs', 'Operator priced + unpriced SFS must be > 0.');
  if (Number(inputs.operator_physical_stock) < 0)
    return err('operator_physical_stock', 'Physical stock cannot be negative.');
  if (!(Number(inputs.operator_tank_limit) > 0))
    return err('operator_tank_limit', 'Tank limit must be positive.');

  const mm = Number(inputs.monthly_min_share_pct);
  if (!Number.isFinite(mm) || mm < 0 || mm >= 100)
    return err('monthly_min_share_pct', 'Monthly minimum share must be in [0, 100).');

  const wm = Number(inputs.weekly_max_share_pct);
  if (!Number.isFinite(wm) || wm <= 0 || wm > 100)
    return err('weekly_max_share_pct', 'Weekly maximum share must be in (0, 100].');

  if (wm < mm)
    return err('weekly_max_share_pct', 'Weekly cap must be greater than or equal to monthly floor.');

  const lambda = Number(inputs.lambda_cost);
  if (!Number.isFinite(lambda) || lambda < 0 || lambda > 1)
    return err('lambda_cost', 'λ (cost sensitivity) must be in [0, 1].');

  const gamma = Number(inputs.gamma_discount);
  if (!Number.isFinite(gamma) || gamma < 0 || gamma > 1)
    return err('gamma_discount', 'γ (future discount) must be in [0, 1].');

  const lock = Number(inputs.locked_sell_day1_mt) || 0;
  if (lock > opP + opU)
    return err('locked_sell_day1_mt', 'Locked day-1 sell cannot exceed available SFS.');

  // Spec §2.8: daily_max_sell_mt is a hard cap; 0 = no limit. Negative values
  // would silently become "no limit" via the `dm > 0 ? dm : Infinity` rule, so
  // reject them up-front.
  if (inputs.daily_max_sell_mt !== undefined && inputs.daily_max_sell_mt !== null
      && inputs.daily_max_sell_mt !== '') {
    const dms = Number(inputs.daily_max_sell_mt);
    if (!Number.isFinite(dms) || dms < 0)
      return err('daily_max_sell_mt', 'Daily max sell must be ≥ 0 (0 = no limit).');
  }

  if (Array.isArray(inputs.imports)) {
    for (let i = 0; i < inputs.imports.length; i++) {
      const r = inputs.imports[i];
      const qty = Number(r.quantity_mt);
      // Spec §7: "Zero-quantity imports are ignored". Skip without erroring.
      if (qty === 0) continue;
      if (!r.arrival_date)
        return err(`imports[${i}].arrival_date`, 'Import arrival date is required.');
      if (Number.isNaN(new Date(r.arrival_date).getTime()))
        return err(`imports[${i}].arrival_date`, 'Invalid arrival date.');
      if (!(qty > 0))
        return err(`imports[${i}].quantity_mt`, 'Import quantity must be > 0.');
      if (!['OPERATOR', 'LMS', 'COMP'].includes(r.party))
        return err(`imports[${i}].party`, 'Party must be OPERATOR or COMP.');
    }
  }

  if (Array.isArray(inputs.pipeline)) {
    for (let i = 0; i < inputs.pipeline.length; i++) {
      const r = inputs.pipeline[i];
      const qty = Number(r.quantity_mt);
      // Spec §7: "Pipeline quantities > 0" (zero-quantity clearances ignored).
      if (qty === 0) continue;
      if (!r.clearance_date)
        return err(`pipeline[${i}].clearance_date`, 'Pipeline clearance date is required.');
      if (Number.isNaN(new Date(r.clearance_date).getTime()))
        return err(`pipeline[${i}].clearance_date`, 'Invalid clearance date.');
      if (!(qty > 0))
        return err(`pipeline[${i}].quantity_mt`, 'Pipeline quantity must be > 0.');
      if (!['OPERATOR', 'LMS', 'COMP'].includes(r.party))
        return err(`pipeline[${i}].party`, 'Party must be OPERATOR or COMP.');
    }
  }

  const rules = payload.rules;
  if (rules && typeof rules === 'object') {
    for (const key of Object.keys(RULE_RANGES)) {
      if (rules[key] === undefined || rules[key] === null || rules[key] === '') continue;
      const v = Number(rules[key]);
      const [lo, hi] = RULE_RANGES[key];
      if (!Number.isFinite(v) || v < lo || v > hi) {
        return err(
          `rules.${key}`,
          `${RULE_LABELS[key]} must be between ${lo} and ${hi}.`
        );
      }
    }
  }

  return null;
}

export function validateRuleProfile(profile) {
  if (!profile || typeof profile !== 'object') return err('profile', 'Invalid profile.');
  if (!profile.name || typeof profile.name !== 'string' || profile.name.trim().length === 0)
    return err('name', 'Profile name is required.');
  if (profile.name.length > 80) return err('name', 'Profile name too long (max 80).');
  const rules = profile.rules || {};
  for (const key of Object.keys(RULE_RANGES)) {
    if (rules[key] === undefined || rules[key] === null || rules[key] === '') continue;
    const v = Number(rules[key]);
    const [lo, hi] = RULE_RANGES[key];
    if (!Number.isFinite(v) || v < lo || v > hi) {
      return err(`rules.${key}`, `${RULE_LABELS[key]} must be between ${lo} and ${hi}.`);
    }
  }
  return null;
}

export function validateScenario(scenario) {
  if (!scenario || typeof scenario !== 'object') return err('scenario', 'Invalid scenario.');
  if (!scenario.name || typeof scenario.name !== 'string' || scenario.name.trim().length === 0)
    return err('name', 'Scenario name is required.');
  if (scenario.name.length > 120) return err('name', 'Scenario name too long (max 120).');
  if (!scenario.inputs || typeof scenario.inputs !== 'object')
    return err('inputs', 'Scenario must include inputs.');
  // Also run the full optimizer-input validation so we don't persist a scenario
  // that would error on the next run. The scenario stores inputs + optional
  // rules; pass them to the same validator the /optimize route uses.
  const inputViolation = validateOptimizerRequest({
    inputs: scenario.inputs,
    rules: scenario.rules,
  });
  if (inputViolation) return inputViolation;
  return null;
}

export { RULE_RANGES, RULE_LABELS, DEFAULT_RULES };
