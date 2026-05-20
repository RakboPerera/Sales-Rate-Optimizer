// Mirror of backend/lib/defaultRules.js. Source of truth is the backend;
// this is for client-side defaults and the rules editor UI.

export const DEFAULT_RULES = {
  // Search
  max_iterations: 25,
  convergence_mt: 1,
  candidates_per_day: 13,
  sale_tank_delay_days: 5,
  sfs_lead_time_days: 5,

  // Tank
  tank_threshold: 0.75,
  evac_severity: 600,
  fill_penalty_exp: 15,
  tank_urgency_exp: 12,
  tank_urgency_mult: 0.01,
  forward_look_days: 5,
  forward_urgency_exp: 8,
  forward_urgency_mult: 0.008,

  // Floor / Cap
  weekly_cap_penalty: 500,
  weekly_cap_relax_under_pressure: 0.02,
  floor_boost: 1.02,
  floor_scale_cap: 4.0,

  // Reward shape
  sfs_bonus_weight: 20,
  kappa_base: 4,
  kappa_lambda_slope: 8,
  hold_capacity_base: 2.5,
  hold_capacity_slope: 3,
};

export const RULE_GROUPS = [
  {
    key: 'search',
    title: 'Search',
    fields: [
      { key: 'max_iterations', label: 'Max DP iterations', step: 1, hint: 'Higher = more convergence, slower.' },
      { key: 'convergence_mt', label: 'Convergence threshold (MT)', step: 0.1, hint: 'Stop iterating when max day-to-day change is below this.' },
      { key: 'candidates_per_day', label: 'Candidates per day', step: 1, hint: 'Search granularity per day. More = finer plan but slower.' },
      { key: 'sale_tank_delay_days', label: 'Sale-to-tank delay (days)', step: 1, hint: 'How many working days between booking a sale and the fuel physically leaving the tank.' },
      { key: 'sfs_lead_time_days', label: 'SFS unlock lead time (days)', step: 1, hint: 'Working days before cargo arrival when SFS becomes sellable.' },
    ],
  },
  {
    key: 'tank',
    title: 'Tank',
    fields: [
      { key: 'tank_threshold', label: 'Tank pressure threshold', step: 0.01, hint: 'Fill ratio above which tank-urgency penalties activate. 0.75 = 75%.' },
      { key: 'evac_severity', label: 'Evacuation severity multiplier', step: 10, hint: 'How harshly to penalize evacuated stock. Higher = avoid evac at all costs.' },
      { key: 'fill_penalty_exp', label: 'Fill penalty curve exponent', step: 1, hint: 'Steepness of the fill warning curve. Higher = sharper spike near limit.' },
      { key: 'tank_urgency_exp', label: 'Tank urgency exponent', step: 1, hint: 'Steepness of the immediate tank-urgency reward when fill > threshold. Spec default: 12.' },
      { key: 'tank_urgency_mult', label: 'Tank urgency multiplier', step: 0.001, hint: 'Linear weight on the immediate tank-urgency reward. Spec default: 0.01.' },
      { key: 'forward_look_days', label: 'Forward-look horizon (days)', step: 1, hint: 'Project tank fill this many working days ahead and apply a softer urgency if it crosses the threshold. Spec default: 5. Set 0 to disable.' },
      { key: 'forward_urgency_exp', label: 'Forward urgency exponent', step: 1, hint: 'Steepness of the forward-looking urgency reward when projected fill > threshold. Spec default: 8.' },
      { key: 'forward_urgency_mult', label: 'Forward urgency multiplier', step: 0.001, hint: 'Linear weight on the forward-looking urgency reward. Spec default: 0.008.' },
    ],
  },
  {
    key: 'floorcap',
    title: 'Floor & Cap',
    fields: [
      { key: 'weekly_cap_penalty', label: 'Weekly cap penalty weight', step: 50, hint: 'How hard to enforce the weekly share cap.' },
      { key: 'weekly_cap_relax_under_pressure', label: 'Weekly cap relaxation under tank pressure', step: 0.01, hint: 'Multiplier applied to the cap penalty when tank is full. 0.02 = essentially ignore the cap.' },
      { key: 'floor_boost', label: 'Floor enforcement boost', step: 0.01, hint: 'Initial proportional scaling factor when below monthly floor. 1.02 = boost by 2%.' },
      { key: 'floor_scale_cap', label: 'Floor scaling cap', step: 0.1, hint: 'Maximum proportional boost allowed. 4.0 = up to 4× original.' },
    ],
  },
  {
    key: 'reward',
    title: 'Reward shape',
    fields: [
      { key: 'sfs_bonus_weight', label: 'SFS position bonus weight', step: 1, hint: 'How much to value a high share of total market SFS.' },
      { key: 'kappa_base', label: 'κ base (cost-term scale)', step: 0.5, hint: 'Constant part of cost-sensitivity multiplier.' },
      { key: 'kappa_lambda_slope', label: 'κ λ-slope', step: 0.5, hint: 'How much λ amplifies the cost-sensitivity multiplier.' },
      { key: 'hold_capacity_base', label: 'HOLD capacity base', step: 0.1, hint: 'Base factor for HOLD-mode capacity narrowing. h(λ) = base − slope·λ.' },
      { key: 'hold_capacity_slope', label: 'HOLD capacity slope', step: 0.1, hint: 'How much λ tightens HOLD capacity.' },
    ],
  },
];
