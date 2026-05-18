// Default form values. Mirrors the HTML prototype's defaults (calibrated baseline).

function todayIso() {
  // Roll forward to the next working day if today is a weekend, so the field
  // value matches what the backend will use as D1 (it auto-skips weekends).
  const d = new Date();
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const DEFAULT_INPUTS = {
  operator_label: 'Operator',

  // Planning
  plan_start_date: todayIso(),
  num_planning_days: 20,

  // Operator stock
  operator_physical_stock: 3500,
  operator_tank_limit: 40000,
  operator_priced_sfs: 500,
  operator_unpriced_sfs: 3000,
  operator_priced_cost: 470,
  operator_unpriced_cost: 475,

  // Competitor stock
  comp_physical_stock: 9000,
  comp_tank_limit: 31000,
  comp_priced_sfs: 4000,
  comp_unpriced_sfs: 5000,
  comp_priced_cost: 480,
  comp_unpriced_cost: 475,

  // Demand
  operator_daily_demand: 650,
  comp_daily_demand: 650,

  // Market share constraints
  monthly_min_share_pct: 36,
  weekly_max_share_pct: 60,

  // Historical
  hist_operator_month_mt: 0,
  hist_comp_month_mt: 0,
  hist_operator_week_mt: 0,
  hist_comp_week_mt: 0,

  // Operational
  daily_max_sell_mt: 0,
  locked_sell_day1_mt: 0,
  evac_cost_per_mt: 0.1,

  // Tuning
  lambda_cost: 0.5,
  gamma_discount: 0.92,

  // Dynamic rows
  imports: [],
  pipeline: [],
  day_overrides: {},
};

// A "Live Data Preset" matching the spec §8 example payload.
// Useful for client demos to show realistic behavior with imports.
export const LIVE_PRESET = {
  ...DEFAULT_INPUTS,
  plan_start_date: '2026-05-06',
  num_planning_days: 20,

  operator_physical_stock: 7859,
  operator_tank_limit: 7000,
  operator_priced_sfs: 6857,
  operator_unpriced_sfs: 2150,
  operator_priced_cost: 916,
  operator_unpriced_cost: 984.6,

  comp_physical_stock: 18783,
  comp_tank_limit: 29268,
  comp_priced_sfs: 3576,
  comp_unpriced_sfs: 13500,
  comp_priced_cost: 911.4,
  comp_unpriced_cost: 971.4,

  operator_daily_demand: 937,
  comp_daily_demand: 1388,

  monthly_min_share_pct: 36,
  weekly_max_share_pct: 60,

  hist_operator_month_mt: 975,
  hist_comp_month_mt: 5600,
  hist_operator_week_mt: 975,
  hist_comp_week_mt: 5500,

  daily_max_sell_mt: 3000,
  locked_sell_day1_mt: 0,
  evac_cost_per_mt: 50,

  lambda_cost: 0.3,
  gamma_discount: 0.95,

  imports: [
    { party: 'OPERATOR', arrival_date: '2026-05-07', quantity_mt: 3500 },
    { party: 'COMP', arrival_date: '2026-05-14', quantity_mt: 7000 },
    { party: 'OPERATOR', arrival_date: '2026-05-20', quantity_mt: 10000 },
    { party: 'COMP', arrival_date: '2026-05-21', quantity_mt: 5000 },
  ],

  pipeline: [
    { party: 'OPERATOR', clearance_date: '2026-05-06', quantity_mt: 175 },
    { party: 'OPERATOR', clearance_date: '2026-05-08', quantity_mt: 810 },
  ],
  day_overrides: {},
};
