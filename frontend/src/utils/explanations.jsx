// All in-app help content for the Sales Rate Optimizer.
// Each entry is JSX so we can use <strong>, <ul>, <code> for clarity.
// Keep entries short and plain-English — readers may be non-technical operators.

import React from 'react';

const HELP = {
  // ── Sections ─────────────────────────────────────────────────────────
  sec_branding: {
    title: 'Branding',
    body: (
      <>
        <p>Type your company's name here (e.g., "Acme Bunkering"). It replaces
        the word <em>Operator</em> everywhere in the UI — sidebar labels, chart
        legends, table headers — so the demo looks like it was built for you.</p>
        <p>This setting is saved with each scenario, so different clients can
        coexist in your scenario library.</p>
      </>
    ),
  },
  sec_planning: {
    title: 'Planning Period',
    body: (
      <>
        <p>How long the optimizer plans for. The model schedules <strong>working
        days only</strong> — weekends are automatically skipped.</p>
        <p>Typical use: 20 days (one month of working days).</p>
      </>
    ),
  },
  sec_operator_stock: {
    title: 'Your Opening Stock',
    body: (
      <>
        <p>The state of your tanks on Day 1.</p>
        <p><strong>Physical stock</strong> is total fuel in the tank. <strong>SFS</strong> (Sellable Fuel Stock) is the portion cleared for sale.</p>
        <p>SFS is split into <strong>Priced</strong> (purchased at a fixed
        known cost) and <strong>Unpriced</strong> (floating market cost). The
        optimizer always sells priced stock first.</p>
      </>
    ),
  },
  sec_comp_stock: {
    title: 'Competitor Opening Stock',
    body: (
      <>
        <p>The competitor's tank state on Day 1, mirroring your own fields.</p>
        <p>The optimizer uses competitor priced stock as a benchmark — if their
        priced cost is below your unpriced cost, you're in HOLD mode (their
        cheap stock undercuts you).</p>
      </>
    ),
  },
  sec_demand: {
    title: 'Demand & Constraints',
    body: (
      <>
        <p>Daily baseline demand for both parties, plus the regulatory /
        commercial limits the optimizer must respect.</p>
        <p>The <strong>monthly floor</strong> protects your long-term market
        share; the <strong>weekly cap</strong> prevents you from over-extracting
        in any one week.</p>
      </>
    ),
  },
  sec_historical: {
    title: 'Historical (this period)',
    body: (
      <>
        <p>Sales already booked in the current month/week, before the planning
        period begins.</p>
        <p>These pre-fill the rolling-share calculation so Day 1 of the plan
        starts from where you actually are, not from zero.</p>
        <p>Set the locked Day-1 sell to <code>0</code> to let the optimizer
        decide, or to a positive number to force a fixed quantity.</p>
      </>
    ),
  },
  sec_tuning: {
    title: 'Algorithm Tuning',
    body: (
      <>
        <p>Two high-level knobs that shape the optimizer's behavior:</p>
        <ul>
          <li><strong>λ (Cost Sensitivity)</strong> — how much to weight cost vs. share. Low = sell freely; high = strict cost discipline.</li>
          <li><strong>γ (Future Discount)</strong> — how much to value future days. Low = focus on today; high = plan for later in the period.</li>
        </ul>
        <p>The badge below shows whether you're in FAST or HOLD mode given the current costs.</p>
      </>
    ),
  },
  sec_imports: {
    title: 'Imports Schedule',
    body: (
      <>
        <p>Cargoes arriving during the planning period. Physical stock
        increases on arrival date; SFS becomes available <strong>5 working days
        before</strong> (paperwork lead time, tunable in Model Rules).</p>
        <p>Add one row per cargo. Set both your imports and any expected
        competitor imports — they affect competitive dynamics.</p>
      </>
    ),
  },
  sec_pipeline: {
    title: 'Pipeline Clearances',
    body: (
      <>
        <p>Fuel committed to customers that physically leaves the tank on a
        specific date.</p>
        <p>Clearances reduce <strong>physical</strong> stock but <strong>not</strong>
        SFS — the fuel is already sold; it's just being delivered.</p>
      </>
    ),
  },
  sec_overrides: {
    title: 'Per-Day Overrides',
    body: (
      <>
        <p>Override the global defaults for a specific day. Useful when you
        know a particular day is unusual — e.g., demand spike, ad-hoc cargo
        arrival, or a one-off cost change.</p>
        <p>Pick the day number, the field to override, then the value. Anything
        you don't override falls back to the global defaults.</p>
      </>
    ),
  },
  sec_rules: {
    title: 'Advanced — Model Rules',
    body: (
      <>
        <p>The internal calibration constants of the optimizer. <strong>You
        normally don't need to touch these</strong> — the defaults reproduce
        the baseline behavior calibrated by Octave.</p>
        <p>Open it when you want to tune for a specific operational style — e.g.,
        a tighter tank threshold for a high-risk season. Save your tuning as a
        named <strong>Rule Profile</strong> to reuse it across scenarios.</p>
        <p>A turquoise dot next to a label means the rule has been changed from
        its default.</p>
      </>
    ),
  },

  // ── Operator-side fields ─────────────────────────────────────────────
  operator_label: {
    title: 'Operator Label',
    body: (
      <p>Your company name as it should appear in this app. Drives all "Operator"
      labels in the UI, including chart legends and table headers.</p>
    ),
  },
  plan_start_date: {
    title: 'Start Date',
    body: (
      <p>The first <strong>working day</strong> of the plan. If you pick a
      weekend, the optimizer rolls forward to the next Monday.</p>
    ),
  },
  num_planning_days: {
    title: 'Working Days',
    body: (
      <p>How many working days the optimizer schedules. Range 1–60. Most use
      cases are 20 (≈ one calendar month of working days).</p>
    ),
  },
  operator_physical_stock: {
    title: 'Your Physical Stock',
    body: (
      <p>Total fuel sitting in your tanks on Day 1, including stock not yet
      sellable. Includes pipeline-committed stock that hasn't physically left
      yet.</p>
    ),
  },
  operator_tank_limit: {
    title: 'Your Tank Limit',
    body: (
      <p>Maximum physical capacity of your tanks. Going above this triggers
      <strong> BORROW</strong> (excess stored in competitor tank) or <strong>EVAC</strong>
      (paid evacuation) status.</p>
    ),
  },
  operator_priced_sfs: {
    title: 'Your Priced SFS',
    body: (
      <p>Sellable fuel <strong>purchased at a fixed/known price</strong>. The
      optimizer prefers to sell this first because the cost is locked in.</p>
    ),
  },
  operator_unpriced_sfs: {
    title: 'Your Unpriced SFS',
    body: (
      <p>Sellable fuel purchased at a <strong>floating/market price</strong>,
      typically more expensive. The optimizer is more cautious about selling
      this in HOLD mode.</p>
    ),
  },
  operator_priced_cost: {
    title: 'Your Priced Cost',
    body: (
      <p>Purchase cost ($/MT) of your priced inventory. Compared against the
      competitor's costs to decide FAST vs HOLD mode.</p>
    ),
  },
  operator_unpriced_cost: {
    title: 'Your Unpriced Cost',
    body: (
      <p>Purchase cost ($/MT) of your unpriced inventory. This is the
      <strong> critical number</strong> for FAST/HOLD: if it's lower than the
      competitor's priced cost, you have an unpriced cost edge → FAST mode.</p>
    ),
  },

  // ── Competitor-side ─────────────────────────────────────────────────
  comp_physical_stock: { title: 'Competitor Physical Stock', body: <p>Best estimate of the competitor's total tank stock on Day 1.</p> },
  comp_tank_limit: { title: 'Competitor Tank Limit', body: <p>Max competitor tank capacity. When your tank overflows but theirs has spare room, the excess can be <strong>borrowed</strong> there without evacuation cost.</p> },
  comp_priced_sfs: { title: 'Competitor Priced SFS', body: <p>The competitor's cheap, locked-in sellable inventory. A large priced share means stronger competitive pressure.</p> },
  comp_unpriced_sfs: { title: 'Competitor Unpriced SFS', body: <p>The competitor's floating-cost inventory.</p> },
  comp_priced_cost: { title: 'Competitor Priced Cost', body: <p>Best estimate of the competitor's priced-stock cost. Their priced cost vs. your unpriced cost decides FAST vs HOLD.</p> },
  comp_unpriced_cost: { title: 'Competitor Unpriced Cost', body: <p>Best estimate of competitor's unpriced cost. Used inside the reward function as a benchmark.</p> },

  // ── Demand ──────────────────────────────────────────────────────────
  operator_daily_demand: { title: 'Your Daily Demand', body: <p>Baseline daily demand served by you (MT/day). The optimizer can sell above or below this depending on cost mode and tank pressure.</p> },
  comp_daily_demand: { title: 'Competitor Daily Demand', body: <p>Baseline daily demand served by the competitor. <strong>Total market</strong> = your demand + competitor demand.</p> },
  monthly_min_share_pct: { title: 'Monthly Minimum Share', body: <>
    <p>The minimum share of total monthly volume you must hold. Range 0–100%.</p>
    <p>If the DP solution falls short of this, a post-processing step adds extra
    sales on cost-favorable days to top up.</p>
  </> },
  weekly_max_share_pct: { title: 'Weekly Maximum Share', body: <>
    <p>The maximum share you can take in any single week. Caps you from
    over-extracting and provoking the competitor.</p>
    <p>If your tank is under pressure, this cap is relaxed (see Model Rules).</p>
  </> },
  daily_max_sell_mt: { title: 'Daily Max Sell', body: <p>Hard ceiling on how much you can sell in a single day. Set to <code>0</code> for no limit.</p> },
  evac_cost_per_mt: { title: 'Evacuation Cost', body: <p>Cost per MT for emergency stock evacuation (when both your and competitor tanks are full). Higher = the optimizer works harder to avoid overflow.</p> },

  // ── Historical ──────────────────────────────────────────────────────
  hist_operator_month_mt: { title: 'Your MTD', body: <p>Your sales already booked this month, before the plan starts. Lets the rolling-share calculation start from the right place.</p> },
  hist_comp_month_mt: { title: 'Competitor MTD', body: <p>Competitor's sales already booked this month.</p> },
  hist_operator_week_mt: { title: 'Your WTD', body: <p>Your sales already booked this week. Affects the weekly-cap calculation for Day 1.</p> },
  hist_comp_week_mt: { title: 'Competitor WTD', body: <p>Competitor's sales already booked this week.</p> },
  locked_sell_day1_mt: { title: 'Lock Day-1 Sell', body: <p>Force a fixed sell quantity on Day 1, overriding the optimizer's choice. Useful if you've already committed a Day 1 sale. <code>0</code> = let the optimizer decide.</p> },

  // ── Tuning ──────────────────────────────────────────────────────────
  lambda_cost: { title: 'λ — Cost Sensitivity', body: <>
    <p>Range 0.1–0.9. Controls how much cost matters relative to market-share.</p>
    <ul>
      <li><strong>0.1</strong> — ignore cost, prioritize share.</li>
      <li><strong>0.5</strong> — balanced.</li>
      <li><strong>0.9</strong> — cost dominates, even at the expense of share.</li>
    </ul>
  </> },
  gamma_discount: { title: 'γ — Future Discount', body: <>
    <p>Range 0.80–0.99. How much future days are valued relative to today.</p>
    <ul>
      <li><strong>0.80</strong> — short-sighted; takes immediate gains.</li>
      <li><strong>0.92</strong> — balanced (default).</li>
      <li><strong>0.99</strong> — far-sighted; spreads sales evenly across the period.</li>
    </ul>
  </> },

  // ── KPIs ────────────────────────────────────────────────────────────
  kpi_total_sold: { title: 'Total Sold', body: <p>Total MT sold over the planning period. The <em>% of SFS</em> sub-line shows how much of your starting sellable stock you've used.</p> },
  kpi_final_share: { title: 'Final Market Share', body: <p>Your cumulative share at the end of the period, including historical month-to-date sales. Compared against the <strong>monthly floor</strong>: red if below, green if at or above.</p> },
  kpi_peak_fill: { title: 'Peak Tank Fill', body: <>
    <p>Highest tank fill ratio reached during the period.</p>
    <ul>
      <li>&lt; 75% — green, comfortable.</li>
      <li>75–85% — amber, warning.</li>
      <li>&gt; 85% — red, risk of overflow.</li>
    </ul>
  </> },
  kpi_evacuated: { title: 'Total Evacuated', body: <p>Total MT that had to be evacuated (both your tank and the competitor tank were full). Multiplied by your evacuation cost to give the USD figure below. Should ideally be zero.</p> },
  kpi_cost_mode: { title: 'Cost Mode', body: <>
    <p>The cost picture across the whole plan — majority of FAST vs HOLD days. Ties go to HOLD.</p>
    <ul>
      <li><strong>FAST</strong> — your unpriced cost is below competitor's priced cost. You have a cost edge; sell aggressively.</li>
      <li><strong>HOLD</strong> — your unpriced cost is at or above competitor's priced cost. They can undercut you; conserve unpriced stock, sell priced only.</li>
    </ul>
    <p>The "Edge" line below shows the average per-day cost advantage across the plan. Per-day overrides can flip individual days; see the Explainability tab for the per-day mode.</p>
  </> },

  // ── Status badges ───────────────────────────────────────────────────
  status_ok: { title: 'OK status', body: <p>Tank fill is below the warning threshold (default 75%). Normal operation.</p> },
  status_warn: { title: 'WARN status', body: <p>Tank fill is at or above the warning threshold but no overflow yet. Tank-urgency penalties are active — the optimizer is pushing harder to sell.</p> },
  status_borrow: { title: 'BORROW status', body: <p>Physical stock exceeds your tank limit, but the competitor's tank has spare room — the excess is "borrowed" there at no cost.</p> },
  status_evac: { title: 'EVAC status', body: <p>Both your and the competitor's tanks are full. Excess stock had to be evacuated at the per-MT evacuation cost. Avoid this — it's expensive and indicates upstream planning failure.</p> },

  // ── Daily plan columns ──────────────────────────────────────────────
  col_sell: { title: 'Sell MT', body: <p>How many MT the optimizer recommends you sell on this day.</p> },
  col_priced: { title: 'Priced', body: <p>Portion of the day's sale coming from priced (cheap, locked-in) SFS. Sold first.</p> },
  col_unpriced: { title: 'Unpriced', body: <p>Portion coming from unpriced (floating-cost) SFS. Sold once priced is depleted.</p> },
  col_sfs_rem: { title: 'SFS Remaining', body: <p>Your total sellable stock left at end of day.</p> },
  col_sfs_share: { title: 'SFS Share %', body: <p>Your share of total market SFS (you + competitor). A higher share means you hold a stronger strategic position.</p> },
  col_phys: { title: 'Physical Stock', body: <p>Your physical tank stock at start of day, after imports and clearances.</p> },
  col_fill: { title: 'Fill %', body: <p>Physical stock ÷ tank limit. Color-coded: amber &gt;75%, red &gt;85%.</p> },
  col_cum: { title: 'Cumulative Share %', body: <p>Your rolling market share from month start (includes MTD). Red if below the monthly floor.</p> },
  col_mode: { title: 'Mode', body: <p>Per-day FAST/HOLD signal. Can differ from the opening cost mode if you've configured per-day cost overrides.</p> },
  col_vs_dem: { title: 'vs Demand %', body: <p>Day's sale as a percentage of your baseline daily demand. Above 100% means you sold more than expected.</p> },
  col_cost_adv: { title: 'Cost Advantage', body: <p>$/MT edge that day. Positive (turquoise) = FAST favorable. Negative (orange) = HOLD penalty.</p> },
  col_wk: { title: 'Week Share %', body: <p>Your rolling weekly share through this day. Should stay below the weekly cap.</p> },
  col_driver: { title: 'Driver', body: <p>Plain-English reason the optimizer landed on this quantity for this day. Useful when explaining the plan to a non-technical stakeholder.</p> },
};

export function getHelp(key) {
  return HELP[key] || null;
}

export default HELP;
