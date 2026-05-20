// 12 BU test scenarios from the BU specification document
// (BU_12_scenarios_inputs_and_parameters.md). Used to seed the Scenarios
// table on first DB init so users can load any of the reference cases
// from the Scenarios tab without re-entering all the inputs.

const SHARED = {
  plan_start_date: '2025-02-02', // Sunday — backend auto-skips to Mon 2025-02-03
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
  operator_label: 'Operator',
  imports: [],
  pipeline: [],
  day_overrides: {},
};

// Per-scenario costs and SFS. Physical stock is 3,500 MT for Low, 14,000 for High.
const SCENARIOS = [
  { id: 1,  label: 'BU 01 · Low-1',  level: 'Low',  mode: 'FAST', ops: 3500,  pS: 500,  pC: 470, uS: 3000, uC: 475, cpS: 4000,  cpC: 480, cuS: 5000,  cuC: 475, note: 'Sell both 500 MT priced AND 3000 MT unpriced before Comp starts selling their unpriced' },
  { id: 2,  label: 'BU 02 · Low-2',  level: 'Low',  mode: 'HOLD', ops: 3500,  pS: 500,  pC: 470, uS: 3000, uC: 480, cpS: 4000,  cpC: 475, cuS: 5000,  cuC: 480, note: 'Sell 500 MT priced and HOLD until Comp finishes selling their priced' },
  { id: 3,  label: 'BU 03 · Low-3',  level: 'Low',  mode: 'HOLD', ops: 3500,  pS: 500,  pC: 475, uS: 3000, uC: 480, cpS: 4000,  cpC: 470, cuS: 5000,  cuC: 480, note: 'Sell 500 MT priced and HOLD until Comp finishes selling their priced' },
  { id: 4,  label: 'BU 04 · Low-4',  level: 'Low',  mode: 'FAST', ops: 3500,  pS: 500,  pC: 475, uS: 3000, uC: 470, cpS: 4000,  cpC: 480, cuS: 5000,  cuC: 470, note: 'Sell both 500 MT priced AND 3000 MT unpriced before Comp starts selling their unpriced' },
  { id: 5,  label: 'BU 05 · Low-5',  level: 'Low',  mode: 'FAST', ops: 3500,  pS: 500,  pC: 480, uS: 3000, uC: 470, cpS: 4000,  cpC: 475, cuS: 5000,  cuC: 470, note: 'Sell both 500 MT priced AND 3000 MT unpriced before Comp starts selling their unpriced' },
  { id: 6,  label: 'BU 06 · Low-6',  level: 'Low',  mode: 'HOLD', ops: 3500,  pS: 500,  pC: 480, uS: 3000, uC: 475, cpS: 4000,  cpC: 470, cuS: 5000,  cuC: 475, note: 'HOLD until Comp finishes selling their priced' },
  { id: 7,  label: 'BU 07 · High-7', level: 'High', mode: 'FAST', ops: 14000, pS: 2000, pC: 470, uS: 8000, uC: 475, cpS: 16000, cpC: 480, cuS: 15000, cuC: 475, note: 'Sell a lot before Comp starts selling their unpriced' },
  { id: 8,  label: 'BU 08 · High-8', level: 'High', mode: 'HOLD', ops: 14000, pS: 2000, pC: 470, uS: 8000, uC: 480, cpS: 16000, cpC: 475, cuS: 15000, cuC: 480, note: 'Sell sparingly — margin is better once Comp starts selling their unpriced' },
  { id: 9,  label: 'BU 09 · High-9', level: 'High', mode: 'HOLD', ops: 14000, pS: 2000, pC: 475, uS: 8000, uC: 480, cpS: 16000, cpC: 470, cuS: 15000, cuC: 480, note: 'Sell sparingly (pick & choose orders) to minimise losses' },
  { id: 10, label: 'BU 10 · High-10',level: 'High', mode: 'FAST', ops: 14000, pS: 2000, pC: 475, uS: 8000, uC: 470, cpS: 16000, cpC: 480, cuS: 15000, cuC: 470, note: 'Sell and finish 2000 MT priced before Comp starts selling their unpriced' },
  { id: 11, label: 'BU 11 · High-11',level: 'High', mode: 'FAST', ops: 14000, pS: 2000, pC: 480, uS: 8000, uC: 470, cpS: 16000, cpC: 475, cuS: 15000, cuC: 470, note: 'Sell fast' },
  { id: 12, label: 'BU 12 · High-12',level: 'High', mode: 'HOLD', ops: 14000, pS: 2000, pC: 480, uS: 8000, uC: 475, cpS: 16000, cpC: 470, cuS: 15000, cuC: 475, note: 'Sell sparingly (pick & choose orders) to minimise losses' },
];

export const BU_SCENARIOS = SCENARIOS.map((sc) => ({
  name: sc.label,
  description: `${sc.level}-stock ${sc.mode} scenario. BU expectation: ${sc.note}`,
  inputs: {
    ...SHARED,
    operator_physical_stock: sc.ops,
    operator_priced_sfs: sc.pS,
    operator_priced_cost: sc.pC,
    operator_unpriced_sfs: sc.uS,
    operator_unpriced_cost: sc.uC,
    comp_priced_sfs: sc.cpS,
    comp_priced_cost: sc.cpC,
    comp_unpriced_sfs: sc.cuS,
    comp_unpriced_cost: sc.cuC,
  },
}));
