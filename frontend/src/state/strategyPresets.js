// Four strategy presets that demonstrate the optimizer's adaptive behaviour
// across contrasting market conditions. The first three are showcase scenarios;
// the fourth is the user's editable workspace.

import { DEFAULT_INPUTS, LIVE_PRESET } from './defaultInputs.js';
import { DEFAULT_RULES } from './defaultRules.js';

// A balanced base where the tank is comfortable enough that cost mode is the
// dominant driver of the optimizer's behaviour (not tank pressure).
function balancedBase() {
  return {
    ...LIVE_PRESET,
    operator_physical_stock: 6000,
    operator_tank_limit: 18000,    // comfortable
    operator_priced_sfs: 5000,
    operator_unpriced_sfs: 5000,
    comp_physical_stock: 12000,
    comp_tank_limit: 28000,
    comp_priced_sfs: 4000,
    comp_unpriced_sfs: 8000,
    pipeline: [],
    imports: [
      { party: 'OPERATOR', arrival_date: '2026-05-15', quantity_mt: 4000 },
      { party: 'COMP',     arrival_date: '2026-05-18', quantity_mt: 3000 },
    ],
  };
}

// ─── Strategy 1: Growth Push ──────────────────────────────────────────────
// Comfortable tank, operator unpriced undercuts competitor priced (FAST). λ
// stays mild and the rule profile is aggressive so the model leans hard into
// share with the cost edge.
const GROWTH_INPUTS = {
  ...balancedBase(),
  operator_priced_cost: 880,
  operator_unpriced_cost: 905,   // < competitor priced 940 → FAST mode
  comp_priced_cost: 940,
  comp_unpriced_cost: 985,
  lambda_cost: 0.2,              // ignore cost, prioritise share
  gamma_discount: 0.95,
  monthly_min_share_pct: 50,     // aggressive share target
  weekly_max_share_pct: 80,      // loose cap
  // Extra import for Growth so the share target is reachable
  imports: [
    { party: 'OPERATOR', arrival_date: '2026-05-15', quantity_mt: 8000 },
    { party: 'COMP',     arrival_date: '2026-05-18', quantity_mt: 3000 },
  ],
};
const GROWTH_RULES = {
  ...DEFAULT_RULES,
  tank_threshold: 0.85,
  evac_severity: 400,
  fill_penalty_exp: 10,
  weekly_cap_penalty: 500,
  max_iterations: 35,
  candidates_per_day: 16,
  floor_boost: 1.05,
  floor_scale_cap: 6.0,
};

// ─── Strategy 2: Risk Guard ───────────────────────────────────────────────
// Competitor's priced stock undercuts operator's unpriced (HOLD mode). λ is
// stronger to lean on cost discipline. Conservative rules keep tanks comfortable
// and tighten the weekly cap.
const GUARD_INPUTS = {
  ...balancedBase(),
  operator_priced_cost: 920,
  operator_unpriced_cost: 1010,    // > competitor priced 900 → HOLD mode
  comp_priced_cost: 900,
  comp_unpriced_cost: 970,
  lambda_cost: 0.7,                // cost dominates the decision
  gamma_discount: 0.95,
  monthly_min_share_pct: 28,       // modest share target — protect margin
  weekly_max_share_pct: 45,        // tight cap — no aggressive bursts
};
const GUARD_RULES = {
  ...DEFAULT_RULES,
  tank_threshold: 0.65,
  evac_severity: 1000,
  fill_penalty_exp: 20,
  weekly_cap_penalty: 1200,
  weekly_cap_relax_under_pressure: 0.05,
  hold_capacity_base: 2.0,
  hold_capacity_slope: 4,
};

// ─── Strategy 3: Tank Pressure ────────────────────────────────────────────
// Tight tank, near-full at Day 1, with a big import landing on D6. The model
// must aggressively sell to avoid evacuation while respecting cost mode.
const PRESSURE_INPUTS = {
  ...LIVE_PRESET,
  operator_physical_stock: 8200,
  operator_tank_limit: 8500,
  operator_priced_sfs: 4000,
  operator_unpriced_sfs: 2500,
  operator_priced_cost: 910,
  operator_unpriced_cost: 970,
  comp_physical_stock: 18000,
  comp_tank_limit: 29000,
  comp_priced_cost: 920,
  comp_unpriced_cost: 980,
  evac_cost_per_mt: 80,
  lambda_cost: 0.4,
  gamma_discount: 0.95,
  monthly_min_share_pct: 36,
  weekly_max_share_pct: 65,
  imports: [
    { party: 'OPERATOR', arrival_date: '2026-05-13', quantity_mt: 6000 },
    { party: 'COMP', arrival_date: '2026-05-20', quantity_mt: 4000 },
  ],
  pipeline: [
    { party: 'OPERATOR', clearance_date: '2026-05-08', quantity_mt: 1200 },
  ],
};
const PRESSURE_RULES = { ...DEFAULT_RULES };

// ─── Strategy 4: Custom ───────────────────────────────────────────────────
// User's editable workspace, seeded with project defaults.
const CUSTOM_INPUTS = { ...DEFAULT_INPUTS };
const CUSTOM_RULES = { ...DEFAULT_RULES };

export const STRATEGIES = [
  {
    id: 'growth',
    name: 'Growth Push',
    tagline: 'Maximize share — cost edge',
    description: 'Operator unpriced undercuts competitor priced. 50% floor, 80% cap, λ=0.2, aggressive rules.',
    accentMode: 'fast',
    inputs: GROWTH_INPUTS,
    rules: GROWTH_RULES,
    autoRun: true,
  },
  {
    id: 'guard',
    name: 'Risk Guard',
    tagline: 'Protect margin — cost penalty',
    description: "Competitor undercuts your unpriced. 28% floor, 45% cap, λ=0.7, conservative rules — sell priced only.",
    accentMode: 'hold',
    inputs: GUARD_INPUTS,
    rules: GUARD_RULES,
    autoRun: true,
  },
  {
    id: 'pressure',
    name: 'Tank Pressure',
    tagline: 'Overflow risk — sell to relieve',
    description: 'Day-1 fill at 96%, 6,000 MT import landing on D6. High evac cost forces aggressive offload.',
    accentMode: 'warn',
    inputs: PRESSURE_INPUTS,
    rules: PRESSURE_RULES,
    autoRun: true,
  },
  {
    id: 'custom',
    name: 'Custom',
    tagline: 'Start from defaults, edit freely',
    description: 'Standard editable workspace. Save your scenarios for later or compare against the strategy presets.',
    accentMode: 'neutral',
    inputs: CUSTOM_INPUTS,
    rules: CUSTOM_RULES,
    autoRun: false,
  },
];

export function getStrategy(id) {
  return STRATEGIES.find((s) => s.id === id) || STRATEGIES[STRATEGIES.length - 1];
}
