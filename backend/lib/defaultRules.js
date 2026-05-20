// Default model rules for the DP optimizer.
// These mirror the calibration of the original HTML prototype.
// All keys here are user-tunable through the Model Rules panel.

export const DEFAULT_RULES = {
  // ── Search ────────────────────────────────────────────────────────────
  max_iterations: 25,
  convergence_mt: 1,
  // Colleague's Python uses CANDIDATE_COUNT=12 (loop runs 0..12 inclusive,
  // producing 13 actual candidate values). Our `K` counts the values (0 and
  // effCap both included), so K=13 produces the same 13 candidates.
  candidates_per_day: 13,
  sale_tank_delay_days: 5,
  sfs_lead_time_days: 5,

  // ── Tank ──────────────────────────────────────────────────────────────
  tank_threshold: 0.75,
  evac_severity: 600,
  fill_penalty_exp: 15,
  // Tank urgency curve: U_imm = e^((fill - threshold) * exp) * q * mult
  // Defaults match spec §4.5 Component 4 (immediate urgency).
  tank_urgency_exp: 12,
  tank_urgency_mult: 0.01,
  // Forward-looking urgency (spec §4.5 Component 4): how many days ahead
  // to project tank fill when computing urgency. Default 5 working days
  // per spec; set 0 to disable the forward term.
  forward_look_days: 5,
  // Forward-looking urgency curve coefficients (spec §4.5 Component 4):
  // U_lookahead = e^((proj_fill - threshold) * forward_urgency_exp) * q * forward_urgency_mult
  forward_urgency_exp: 8,
  forward_urgency_mult: 0.008,

  // ── Floor & Cap ───────────────────────────────────────────────────────
  // Calibrated against BU reference CSV. The colleague's Python uses 800
  // (per their source), but with our weekly-share math (correct, vs. their
  // sum-of-daily-shares formula) 500 produces a better empirical match.
  weekly_cap_penalty: 500,
  weekly_cap_relax_under_pressure: 0.02,
  floor_boost: 1.02,
  floor_scale_cap: 4.0,

  // ── Reward shape ──────────────────────────────────────────────────────
  sfs_bonus_weight: 20,
  kappa_base: 4,
  kappa_lambda_slope: 8,
  hold_capacity_base: 2.5,
  hold_capacity_slope: 3,
};

// Internal reward-curvature parameters intentionally NOT exposed in the UI.
// Documented here so they can be promoted to user-tunable later if needed.
// - priced gate clamp: max(0.05, 1 - cpf)
// - HOLD-mode unpriced scaling: 0.15 + cpf * 0.85
// - priced-excess penalty multiplier: 0.5
// - tank urgency exp coefficient: 20 (in reward function)
// - tank urgency multiplier: 0.001
// - HOLD-mode capacity floor: 0.1

// Mergewith DEFAULT_RULES, accepting only known keys to prevent payload pollution.
export function mergeRules(overrides = {}) {
  const result = { ...DEFAULT_RULES };
  if (!overrides || typeof overrides !== 'object') return result;
  for (const key of Object.keys(DEFAULT_RULES)) {
    if (overrides[key] !== undefined && overrides[key] !== null && overrides[key] !== '') {
      const n = Number(overrides[key]);
      if (!Number.isNaN(n)) result[key] = n;
    }
  }
  return result;
}

// Three system rule profiles seeded on first DB init.
export const SYSTEM_PROFILES = [
  {
    name: 'Default',
    description: 'Balanced calibration. Matches the original optimizer baseline.',
    rules: { ...DEFAULT_RULES },
  },
  {
    name: 'Conservative',
    description: 'Tighter tank threshold, harsher evacuation penalty, lower weekly tolerance. Use when overflow risk is unacceptable.',
    rules: {
      ...DEFAULT_RULES,
      tank_threshold: 0.65,
      evac_severity: 1000,
      fill_penalty_exp: 20,
      weekly_cap_penalty: 1200,
      weekly_cap_relax_under_pressure: 0.05,
      hold_capacity_base: 2.0,
      hold_capacity_slope: 4,
    },
  },
  {
    name: 'Aggressive',
    description: 'Looser tank threshold, lighter penalties, broader search. Use when chasing market share with strong logistics.',
    rules: {
      ...DEFAULT_RULES,
      tank_threshold: 0.85,
      evac_severity: 400,
      fill_penalty_exp: 10,
      weekly_cap_penalty: 500,
      max_iterations: 35,
      candidates_per_day: 16,
      floor_boost: 1.05,
      floor_scale_cap: 6.0,
    },
  },
];
