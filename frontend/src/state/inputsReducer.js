import { DEFAULT_INPUTS, LIVE_PRESET } from './defaultInputs.js';
import { DEFAULT_RULES } from './defaultRules.js';

export const initialState = {
  inputs: { ...DEFAULT_INPUTS },
  rules: { ...DEFAULT_RULES },
  rule_profile_id: null,
};

export function inputsReducer(state, action) {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, inputs: { ...state.inputs, [action.key]: action.value } };

    case 'SET_RULE':
      return { ...state, rules: { ...state.rules, [action.key]: action.value } };

    case 'RESET_RULES':
      return { ...state, rules: { ...DEFAULT_RULES } };

    case 'APPLY_RULE_PROFILE':
      return {
        ...state,
        rules: { ...DEFAULT_RULES, ...(action.rules || {}) },
        rule_profile_id: action.profileId || null,
      };

    case 'ADD_IMPORT':
      return {
        ...state,
        inputs: {
          ...state.inputs,
          imports: [
            ...state.inputs.imports,
            { party: 'OPERATOR', arrival_date: state.inputs.plan_start_date, quantity_mt: 5000 },
          ],
        },
      };

    case 'UPDATE_IMPORT': {
      const imports = state.inputs.imports.slice();
      imports[action.index] = { ...imports[action.index], [action.key]: action.value };
      return { ...state, inputs: { ...state.inputs, imports } };
    }

    case 'REMOVE_IMPORT': {
      const imports = state.inputs.imports.filter((_, i) => i !== action.index);
      return { ...state, inputs: { ...state.inputs, imports } };
    }

    case 'ADD_PIPELINE':
      return {
        ...state,
        inputs: {
          ...state.inputs,
          pipeline: [
            ...state.inputs.pipeline,
            { party: 'OPERATOR', clearance_date: state.inputs.plan_start_date, quantity_mt: 1000 },
          ],
        },
      };

    case 'UPDATE_PIPELINE': {
      const pipeline = state.inputs.pipeline.slice();
      pipeline[action.index] = { ...pipeline[action.index], [action.key]: action.value };
      return { ...state, inputs: { ...state.inputs, pipeline } };
    }

    case 'REMOVE_PIPELINE': {
      const pipeline = state.inputs.pipeline.filter((_, i) => i !== action.index);
      return { ...state, inputs: { ...state.inputs, pipeline } };
    }

    case 'SET_DAY_OVERRIDE': {
      const day_overrides = { ...state.inputs.day_overrides };
      const key = String(action.day);
      day_overrides[key] = { ...(day_overrides[key] || {}), [action.field]: action.value };
      // Clean up empty values
      if (action.value === '' || action.value === null || action.value === undefined) {
        delete day_overrides[key][action.field];
        if (Object.keys(day_overrides[key]).length === 0) delete day_overrides[key];
      }
      return { ...state, inputs: { ...state.inputs, day_overrides } };
    }

    case 'REMOVE_DAY_OVERRIDE': {
      const day_overrides = { ...state.inputs.day_overrides };
      delete day_overrides[String(action.day)];
      return { ...state, inputs: { ...state.inputs, day_overrides } };
    }

    case 'LOAD_DEFAULTS':
      return {
        inputs: { ...DEFAULT_INPUTS },
        rules: { ...DEFAULT_RULES },
        rule_profile_id: null,
      };

    case 'LOAD_PRESET':
      return {
        inputs: { ...LIVE_PRESET },
        rules: { ...DEFAULT_RULES },
        rule_profile_id: null,
      };

    case 'LOAD_SCENARIO':
      return {
        inputs: { ...DEFAULT_INPUTS, ...(action.inputs || {}) },
        rules: { ...DEFAULT_RULES, ...(action.rules || {}) },
        rule_profile_id: action.rule_profile_id || null,
      };

    default:
      return state;
  }
}
