import SectionGroup from './SectionGroup.jsx';
import { FieldRow, NumberField, TextField, DateField, Slider } from './Field.jsx';
import ImportsEditor from './ImportsEditor.jsx';
import PipelineEditor from './PipelineEditor.jsx';
import DayOverridesEditor from './DayOverridesEditor.jsx';
import ModelRulesPanel from './ModelRulesPanel.jsx';

export default function Sidebar({ state, dispatch, ruleProfiles, onSaveAsProfile, fieldErrors = {} }) {
  const { inputs, rules, rule_profile_id } = state;
  const set = (k, v) => dispatch({ type: 'SET_FIELD', key: k, value: v });
  const setRule = (k, v) => dispatch({ type: 'SET_RULE', key: k, value: v });

  // Helper: read an error for a given field key from the parent's API-error map.
  // Field keys come straight from validation.js' `field` property in 400 responses.
  const err = (key) => fieldErrors?.[key] || undefined;

  const opLabel = inputs.operator_label || 'Operator';
  const opUnpriced = Number(inputs.operator_unpriced_cost) || 0;
  const compPriced = Number(inputs.comp_priced_cost) || 0;
  const costMode = compPriced > opUnpriced ? 'FAST' : 'HOLD';
  const costEdge = Math.abs(compPriced - opUnpriced).toFixed(1);

  return (
    <aside className="sidebar on-panel">
      <SectionGroup title="Branding" infoKey="sec_branding">
        <FieldRow full>
          <TextField
            label="Operator label (used in UI)"
            value={inputs.operator_label}
            onChange={(v) => set('operator_label', v)}
            placeholder="e.g., Acme Bunkering"
            infoKey="operator_label"
          />
        </FieldRow>
      </SectionGroup>

      <SectionGroup title="Planning Period" infoKey="sec_planning">
        <FieldRow full>
          <DateField label="Start Date" value={inputs.plan_start_date} onChange={(v) => set('plan_start_date', v)} infoKey="plan_start_date" error={err('plan_start_date')} />
        </FieldRow>
        <FieldRow full>
          <NumberField
            label="Working Days"
            value={inputs.num_planning_days}
            min={1}
            max={60}
            onChange={(v) => set('num_planning_days', v)}
            infoKey="num_planning_days"
            error={err('num_planning_days')}
          />
        </FieldRow>
      </SectionGroup>

      <SectionGroup title={`${opLabel} Opening Stock`} infoKey="sec_operator_stock">
        <FieldRow>
          <NumberField label="Physical" suffix="MT" value={inputs.operator_physical_stock} onChange={(v) => set('operator_physical_stock', v)} infoKey="operator_physical_stock" error={err('operator_physical_stock')} />
          <NumberField label="Tank Limit" suffix="MT" value={inputs.operator_tank_limit} onChange={(v) => set('operator_tank_limit', v)} infoKey="operator_tank_limit" error={err('operator_tank_limit')} />
        </FieldRow>
        <FieldRow>
          <NumberField label="Priced SFS" suffix="MT" value={inputs.operator_priced_sfs} onChange={(v) => set('operator_priced_sfs', v)} infoKey="operator_priced_sfs" error={err('operator_priced_sfs')} />
          <NumberField label="Unpriced SFS" suffix="MT" value={inputs.operator_unpriced_sfs} onChange={(v) => set('operator_unpriced_sfs', v)} infoKey="operator_unpriced_sfs" error={err('operator_unpriced_sfs')} />
        </FieldRow>
        <FieldRow>
          <NumberField label="Priced Cost" suffix="$/MT" step={0.5} value={inputs.operator_priced_cost} onChange={(v) => set('operator_priced_cost', v)} infoKey="operator_priced_cost" />
          <NumberField label="Unpriced Cost" suffix="$/MT" step={0.5} value={inputs.operator_unpriced_cost} onChange={(v) => set('operator_unpriced_cost', v)} infoKey="operator_unpriced_cost" />
        </FieldRow>
      </SectionGroup>

      <SectionGroup title="Competitor Opening Stock" infoKey="sec_comp_stock">
        <FieldRow>
          <NumberField label="Physical" suffix="MT" value={inputs.comp_physical_stock} onChange={(v) => set('comp_physical_stock', v)} infoKey="comp_physical_stock" />
          <NumberField label="Tank Limit" suffix="MT" value={inputs.comp_tank_limit} onChange={(v) => set('comp_tank_limit', v)} infoKey="comp_tank_limit" />
        </FieldRow>
        <FieldRow>
          <NumberField label="Priced SFS" suffix="MT" value={inputs.comp_priced_sfs} onChange={(v) => set('comp_priced_sfs', v)} infoKey="comp_priced_sfs" />
          <NumberField label="Unpriced SFS" suffix="MT" value={inputs.comp_unpriced_sfs} onChange={(v) => set('comp_unpriced_sfs', v)} infoKey="comp_unpriced_sfs" />
        </FieldRow>
        <FieldRow>
          <NumberField label="Priced Cost" suffix="$/MT" step={0.5} value={inputs.comp_priced_cost} onChange={(v) => set('comp_priced_cost', v)} infoKey="comp_priced_cost" />
          <NumberField label="Unpriced Cost" suffix="$/MT" step={0.5} value={inputs.comp_unpriced_cost} onChange={(v) => set('comp_unpriced_cost', v)} infoKey="comp_unpriced_cost" />
        </FieldRow>
      </SectionGroup>

      <SectionGroup title="Demand & Constraints" infoKey="sec_demand">
        <FieldRow>
          <NumberField label={`${opLabel} Demand/day`} suffix="MT" value={inputs.operator_daily_demand} onChange={(v) => set('operator_daily_demand', v)} infoKey="operator_daily_demand" />
          <NumberField label="Comp Demand/day" suffix="MT" value={inputs.comp_daily_demand} onChange={(v) => set('comp_daily_demand', v)} infoKey="comp_daily_demand" />
        </FieldRow>
        <FieldRow>
          <NumberField label="Monthly Min Share" suffix="%" step={0.5} min={0} max={100} value={inputs.monthly_min_share_pct} onChange={(v) => set('monthly_min_share_pct', v)} infoKey="monthly_min_share_pct" error={err('monthly_min_share_pct')} />
          <NumberField label="Weekly Max Share" suffix="%" step={0.5} min={0} max={100} value={inputs.weekly_max_share_pct} onChange={(v) => set('weekly_max_share_pct', v)} infoKey="weekly_max_share_pct" error={err('weekly_max_share_pct')} />
        </FieldRow>
        <FieldRow>
          <NumberField label="Daily Max Sell" suffix="MT (0=none)" value={inputs.daily_max_sell_mt} onChange={(v) => set('daily_max_sell_mt', v)} infoKey="daily_max_sell_mt" />
          <NumberField label="Evac Cost" suffix="$/MT" step={0.01} value={inputs.evac_cost_per_mt} onChange={(v) => set('evac_cost_per_mt', v)} infoKey="evac_cost_per_mt" />
        </FieldRow>
      </SectionGroup>

      <SectionGroup title="Historical (this period)" defaultOpen={false} infoKey="sec_historical">
        <FieldRow>
          <NumberField label={`${opLabel} MTD`} suffix="MT" value={inputs.hist_operator_month_mt} onChange={(v) => set('hist_operator_month_mt', v)} infoKey="hist_operator_month_mt" />
          <NumberField label="Comp MTD" suffix="MT" value={inputs.hist_comp_month_mt} onChange={(v) => set('hist_comp_month_mt', v)} infoKey="hist_comp_month_mt" />
        </FieldRow>
        <FieldRow>
          <NumberField label={`${opLabel} WTD`} suffix="MT" value={inputs.hist_operator_week_mt} onChange={(v) => set('hist_operator_week_mt', v)} infoKey="hist_operator_week_mt" />
          <NumberField label="Comp WTD" suffix="MT" value={inputs.hist_comp_week_mt} onChange={(v) => set('hist_comp_week_mt', v)} infoKey="hist_comp_week_mt" />
        </FieldRow>
        <FieldRow full>
          <NumberField label="Lock Day-1 Sell" suffix="MT (0=auto)" value={inputs.locked_sell_day1_mt} onChange={(v) => set('locked_sell_day1_mt', v)} infoKey="locked_sell_day1_mt" error={err('locked_sell_day1_mt')} />
        </FieldRow>
      </SectionGroup>

      <SectionGroup title="Algorithm Tuning" infoKey="sec_tuning">
        <Slider
          label="λ — Cost Sensitivity"
          hint="λ — Cost Sensitivity (0=ignore cost, 1=cost dominates). Spec range [0, 1]."
          value={inputs.lambda_cost}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => set('lambda_cost', v)}
          infoKey="lambda_cost"
        />
        <Slider
          label="γ — Future Discount"
          hint="γ — Future Discount (0=short-sighted, 1=no discount). Spec range [0, 1]."
          value={inputs.gamma_discount}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => set('gamma_discount', v)}
          infoKey="gamma_discount"
        />
        <div className={`cm-badge cm-${costMode.toLowerCase()}`} style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ flex: 1 }}>
            {costMode} mode — {costMode === 'FAST' ? 'unpriced edge' : 'unpriced penalty'}: ${costEdge}/MT
          </span>
          {/* Inline info button for cost mode */}
          <InfoMode mode={costMode} />
        </div>
      </SectionGroup>

      <SectionGroup title="Imports Schedule" defaultOpen={false} infoKey="sec_imports">
        <ImportsEditor
          rows={inputs.imports}
          operatorLabel={opLabel}
          onAdd={() => dispatch({ type: 'ADD_IMPORT' })}
          onUpdate={(index, key, value) => dispatch({ type: 'UPDATE_IMPORT', index, key, value })}
          onRemove={(index) => dispatch({ type: 'REMOVE_IMPORT', index })}
        />
      </SectionGroup>

      <SectionGroup title="Pipeline Clearances" defaultOpen={false} infoKey="sec_pipeline">
        <PipelineEditor
          rows={inputs.pipeline}
          operatorLabel={opLabel}
          onAdd={() => dispatch({ type: 'ADD_PIPELINE' })}
          onUpdate={(index, key, value) => dispatch({ type: 'UPDATE_PIPELINE', index, key, value })}
          onRemove={(index) => dispatch({ type: 'REMOVE_PIPELINE', index })}
        />
      </SectionGroup>

      <SectionGroup title="Per-Day Overrides" defaultOpen={false} infoKey="sec_overrides">
        <DayOverridesEditor
          overrides={inputs.day_overrides}
          numDays={Number(inputs.num_planning_days) || 20}
          onSet={(day, field, value) => dispatch({ type: 'SET_DAY_OVERRIDE', day, field, value })}
          onRemoveDay={(day) => dispatch({ type: 'REMOVE_DAY_OVERRIDE', day })}
        />
      </SectionGroup>

      <SectionGroup title="Advanced — Model Rules" defaultOpen={false} infoKey="sec_rules">
        <ModelRulesPanel
          rules={rules}
          ruleProfileId={rule_profile_id}
          ruleProfiles={ruleProfiles}
          onChangeRule={setRule}
          onReset={() => dispatch({ type: 'RESET_RULES' })}
          onSaveAs={onSaveAsProfile}
          onApplyProfile={(id, profileRules) =>
            dispatch({ type: 'APPLY_RULE_PROFILE', profileId: id, rules: profileRules })
          }
        />
      </SectionGroup>
    </aside>
  );
}

// Inline import for the cost-mode info button only — kept here to avoid
// re-arranging the import block for a single-use case.
import InfoButton from './InfoButton.jsx';
import { getHelp } from '../utils/explanations.jsx';

function InfoMode({ mode }) {
  const help = getHelp('kpi_cost_mode');
  return <InfoButton title={help.title} body={help.body} variant="on-dark" size={12} />;
}
