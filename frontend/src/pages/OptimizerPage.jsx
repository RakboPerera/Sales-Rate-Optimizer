import { useReducer, useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Play, Save, RotateCcw, Database, FileSpreadsheet, FileDown, X } from 'lucide-react';

import Sidebar from '../components/Sidebar.jsx';
import KpiCards from '../components/KpiCards.jsx';
import MainChart from '../components/MainChart.jsx';
import StockChart from '../components/StockChart.jsx';
import DailyPlanTable from '../components/DailyPlanTable.jsx';
import ExplainabilityTable from '../components/ExplainabilityTable.jsx';
import WeeklyCards from '../components/WeeklyCards.jsx';
import Modal from '../components/Modal.jsx';
import Toast from '../components/Toast.jsx';
import { FieldRow, NumberField, TextField, DateField, Slider } from '../components/Field.jsx';

import { inputsReducer, initialState } from '../state/inputsReducer.js';
import { DEFAULT_INPUTS } from '../state/defaultInputs.js';
import { DEFAULT_RULES } from '../state/defaultRules.js';
import api from '../api.js';
import { exportResultsToPdf } from '../utils/exportPdf.js';

const TABS = [
  { key: 'daily', label: 'Daily Plan' },
  { key: 'explain', label: 'Explainability' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'stock', label: 'Stock Chart' },
];

export default function OptimizerPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialFromNav = location.state?.scenario;

  const [state, dispatch] = useReducer(
    inputsReducer,
    initialState,
    (s) =>
      initialFromNav
        ? {
            inputs: { ...s.inputs, ...(initialFromNav.inputs || {}) },
            rules: { ...s.rules, ...(initialFromNav.rules || {}) },
            rule_profile_id: initialFromNav.rule_profile_id || null,
          }
        : s
  );

  const [ruleProfiles, setRuleProfiles] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({}); // { field_name: 'message', ... }
  const [toast, setToast] = useState(null);
  const [tab, setTab] = useState('daily');
  const [showSave, setShowSave] = useState(false);
  const [showSaveProfile, setShowSaveProfile] = useState(false);
  const [scenarioForm, setScenarioForm] = useState({ name: '', description: '', editingId: null });
  const [profileForm, setProfileForm] = useState({ name: '', description: '' });
  // Track the currently loaded scenario so the user can see what's active in
  // the sidebar (especially useful when scenario values overlap with defaults,
  // making the Load action otherwise invisible).
  const [loadedScenarioName, setLoadedScenarioName] = useState(
    initialFromNav?.name || null
  );

  const resultsRef = useRef(null);
  const opLabel = state.inputs.operator_label || 'Operator';
  const monthlyFloor = Number(state.inputs.monthly_min_share_pct) || 36;
  const weeklyCap = Number(state.inputs.weekly_max_share_pct) || 90;

  // Load rule profiles
  useEffect(() => {
    api.get('/rule-profiles').then((r) => setRuleProfiles(r.data)).catch(() => {});
  }, []);

  // Clear nav state after consumed
  useEffect(() => {
    if (location.state?.scenario) {
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buildPayload = () => ({
    inputs: state.inputs,
    rules: state.rules,
    rule_profile_id: state.rule_profile_id,
    operator_label: opLabel,
  });

  const runOptimizer = async () => {
    setLoading(true);
    setError(null);
    setFieldErrors({});
    try {
      const r = await api.post('/optimize', buildPayload());
      setResult(r.data);
      setTab('daily');
    } catch (e) {
      setError(e.message || 'Optimizer failed.');
      // Capture field-specific error so the sidebar can highlight it.
      if (e.field) {
        setFieldErrors({ [e.field]: e.message || 'Invalid value' });
      }
    } finally {
      setLoading(false);
    }
  };

  // Revert the sidebar to the project defaults, clearing any user edits.
  const resetToDefaults = () => {
    dispatch({
      type: 'LOAD_SCENARIO',
      inputs: DEFAULT_INPUTS,
      rules: DEFAULT_RULES,
      rule_profile_id: null,
    });
    setResult(null);
    setError(null);
    setFieldErrors({});
    setLoadedScenarioName(null);
    setToast({ message: 'Reset to defaults.', kind: 'info' });
  };

  // Clear the loaded-scenario banner without touching sidebar values. The user
  // keeps whatever they've edited so far; we just stop claiming it represents
  // the named scenario (which would be misleading after edits anyway).
  const clearLoadedScenario = () => {
    setLoadedScenarioName(null);
  };

  const openSaveScenario = () => {
    setScenarioForm({ name: '', description: '', editingId: null });
    setShowSave(true);
  };

  const saveScenario = async () => {
    if (!scenarioForm.name.trim()) {
      setToast({ message: 'Scenario name is required.', kind: 'error' });
      return;
    }
    try {
      await api.post('/scenarios', {
        name: scenarioForm.name,
        description: scenarioForm.description,
        operator_label: opLabel,
        inputs: state.inputs,
        rules: state.rules,
        rule_profile_id: state.rule_profile_id,
      });
      setShowSave(false);
      setToast({ message: `Scenario "${scenarioForm.name}" saved.`, kind: 'info' });
    } catch (e) {
      setToast({ message: e.message || 'Save failed.', kind: 'error' });
    }
  };

  const openSaveProfile = () => {
    setProfileForm({ name: '', description: '' });
    setShowSaveProfile(true);
  };

  const saveRuleProfile = async () => {
    if (!profileForm.name.trim()) {
      setToast({ message: 'Profile name is required.', kind: 'error' });
      return;
    }
    try {
      const r = await api.post('/rule-profiles', {
        name: profileForm.name,
        description: profileForm.description,
        rules: state.rules,
      });
      setShowSaveProfile(false);
      setRuleProfiles((prev) => [...prev, r.data]);
      dispatch({ type: 'APPLY_RULE_PROFILE', profileId: r.data.id, rules: r.data.rules });
      setToast({ message: `Profile "${r.data.name}" saved.`, kind: 'info' });
    } catch (e) {
      setToast({ message: e.message || 'Save failed.', kind: 'error' });
    }
  };

  const exportXlsx = async () => {
    try {
      const r = await api.post('/export/xlsx', buildPayload(), {
        responseType: 'blob',
      });
      const blob = new Blob([r.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `sales_rate_plan_${stamp}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setToast({ message: e.message || 'XLSX export failed.', kind: 'error' });
    }
  };

  const exportPdf = async () => {
    if (!resultsRef.current) return;
    try {
      await exportResultsToPdf(resultsRef.current, `${opLabel.toLowerCase().replace(/\s+/g, '_')}_plan`);
    } catch (e) {
      setToast({ message: e.message || 'PDF export failed.', kind: 'error' });
    }
  };

  const showFloorAlert = useMemo(() => {
    if (!result) return false;
    return result.summary.final_market_share_pct < monthlyFloor - 0.5;
  }, [result, monthlyFloor]);

  // Diagnose WHY the floor wasn't met, to give the user an actionable hint
  // instead of the bare "below floor" message.
  const floorHint = useMemo(() => {
    if (!result || !showFloorAlert) return null;
    const totalSfs = (Number(state.inputs.operator_priced_sfs) || 0)
      + (Number(state.inputs.operator_unpriced_sfs) || 0)
      + (state.inputs.imports || [])
        .filter((i) => (i.party === 'OPERATOR' || i.party === 'LMS') && i.quantity_mt > 0)
        .reduce((s, i) => s + Number(i.quantity_mt), 0);
    let cumTotalMin = (Number(state.inputs.hist_operator_month_mt) || 0)
      + (Number(state.inputs.hist_comp_month_mt) || 0);
    const overrides = state.inputs.day_overrides || {};
    const opD = Number(state.inputs.operator_daily_demand) || 0;
    const coD = Number(state.inputs.comp_daily_demand) || 0;
    const n = Number(state.inputs.num_planning_days) || 20;
    for (let i = 0; i < n; i++) {
      const ov = overrides[String(i + 1)] || {};
      cumTotalMin += (ov.operator_demand != null ? ov.operator_demand : opD)
        + (ov.comp_demand != null ? ov.comp_demand : coD);
    }
    const required = (monthlyFloor / 100) * cumTotalMin - (Number(state.inputs.hist_operator_month_mt) || 0);

    if (totalSfs < required - 1) {
      const gapMt = Math.ceil(required - totalSfs);
      return `Floor is unreachable with current SFS supply — you'd need at least ${gapMt.toLocaleString()} MT more SFS (add an import or raise priced/unpriced opening stock).`;
    }
    if (result.summary.peak_tank_fill_pct > 100) {
      return `Tank overflow forced over-selling on busy days, inflating the market denominator. Consider a larger tank limit, scheduled pipeline clearances, or fewer imports.`;
    }
    if (result.summary.peak_tank_fill_pct > 75) {
      return `Tank pressure (peak ${result.summary.peak_tank_fill_pct.toFixed(0)}%) triggered urgency selling that diluted market share. Try a larger tank limit or earlier imports.`;
    }
    if (result.cost_mode === 'HOLD') {
      return `In HOLD mode the model conserves unpriced stock. Try lowering λ (less cost-sensitive) to let it lean into share, or raise the weekly cap.`;
    }
    return `Try raising λ to push the model harder on share, or relax the weekly cap.`;
  }, [result, showFloorAlert, state.inputs, monthlyFloor]);

  return (
    <div className="optimizer-page">
      <div className="optimizer-layout">
        <Sidebar
          state={state}
          dispatch={dispatch}
          ruleProfiles={ruleProfiles}
          onSaveAsProfile={openSaveProfile}
          fieldErrors={fieldErrors}
        />

      <div className="results-area">
        {loadedScenarioName && (
          <div className="loaded-scenario-banner">
            <span className="loaded-scenario-label">Loaded scenario:</span>
            <span className="loaded-scenario-name">{loadedScenarioName}</span>
            <span className="loaded-scenario-hint">
              Sidebar reflects this scenario's inputs &amp; rules.
            </span>
            <button
              type="button"
              className="loaded-scenario-clear"
              onClick={clearLoadedScenario}
              title="Dismiss this banner (sidebar values are unchanged)"
            >
              <X size={12} /> Clear
            </button>
          </div>
        )}

        <div className="action-bar">
          <button
            type="button"
            className="btn btn-accent"
            onClick={runOptimizer}
            disabled={loading}
          >
            <Play size={14} /> {loading ? 'Running…' : 'Run optimizer'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={openSaveScenario} disabled={!result && false}>
            <Save size={14} /> Save scenario
          </button>
          <button type="button" className="btn btn-secondary" onClick={exportXlsx} disabled={!result}>
            <FileSpreadsheet size={14} /> Export XLSX
          </button>
          <button type="button" className="btn btn-secondary" onClick={exportPdf} disabled={!result}>
            <FileDown size={14} /> Export PDF
          </button>
          <div className="action-bar-spacer" />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={resetToDefaults}
            title="Revert sidebar inputs to the project defaults"
          >
            <RotateCcw size={12} /> Reset to defaults
          </button>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: 0 }}>{error}</div>}

        {!result && !loading && (
          <div className="empty-state">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p>
              Configure your parameters in the sidebar and press <strong>Run optimizer</strong> to
              generate the {state.inputs.num_planning_days}-day plan.
            </p>

            <div className="intro-callout">
              <div className="intro-callout-title">First time here?</div>
              <div className="intro-callout-body">
                <p>
                  Click the small <strong style={{ color: 'var(--octave-accent)' }}>?</strong> icon
                  next to any field, section, or KPI to see what it means and how to set it.
                </p>
                <p style={{ marginTop: 6 }}>Quick start:</p>
                <ol>
                  <li>Open <strong>Scenarios</strong> in the top nav to load one of the pre-seeded BU test scenarios.</li>
                  <li>Press <strong>Run optimizer</strong> and explore the results tabs.</li>
                  <li>Open <strong>Advanced — Model Rules</strong> to see how to tune the engine.</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="loading-state">
            <div className="spinner" />
            <div className="muted">Running DP optimization…</div>
          </div>
        )}

        {result && !loading && (
          <div ref={resultsRef}>
            <KpiCards result={result} monthlyFloor={monthlyFloor} weeklyCap={weeklyCap} />

            {showFloorAlert && (
              <div className="alert alert-warn">
                <strong>⚠ Final share {result.summary.final_market_share_pct.toFixed(1)}% is below the {monthlyFloor.toFixed(0)}% floor.</strong>
                {floorHint && <div style={{ marginTop: 6, fontWeight: 400 }}>{floorHint}</div>}
              </div>
            )}

            {result.warnings && result.warnings.length > 0 && (
              <div className="alert alert-warn">
                <strong>⚠ Configuration warnings</strong>
                <ul style={{ margin: '6px 0 0 18px', padding: 0, fontWeight: 400 }}>
                  {result.warnings.map((w, i) => (
                    <li key={i} style={{ marginBottom: 2 }}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="chart-area">
              <div className="chart-title">Daily Sales &amp; Cumulative Market Share</div>
              <MainChart result={result} operatorLabel={opLabel} />
            </div>

            <div className="tabs">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={`tab${tab === t.key ? ' active' : ''}`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'daily' && (
              <DailyPlanTable result={result} monthlyFloor={monthlyFloor} operatorLabel={opLabel} />
            )}
            {tab === 'explain' && (
              <ExplainabilityTable result={result} monthlyFloor={monthlyFloor} />
            )}
            {tab === 'weekly' && <WeeklyCards result={result} operatorLabel={opLabel} />}
            {tab === 'stock' && (
              <div className="chart-area" style={{ borderBottom: 'none' }}>
                <div className="chart-title">Physical Stock &amp; SFS Levels</div>
                <StockChart result={result} operatorLabel={opLabel} />
              </div>
            )}
          </div>
        )}
      </div>

      {showSave && (
        <Modal
          title="Save Scenario"
          subtitle="Save the current inputs and rules so you can re-run them later."
          onClose={() => setShowSave(false)}
          actions={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setShowSave(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-accent" onClick={saveScenario}>
                <Save size={12} /> Save
              </button>
            </>
          }
        >
          <div className="modal-fields">
            <div className="field">
              <label className="field-label">Name</label>
              <input
                type="text"
                className="field-input"
                value={scenarioForm.name}
                onChange={(e) => setScenarioForm({ ...scenarioForm, name: e.target.value })}
                placeholder="e.g., May FY26 baseline"
                autoFocus
              />
            </div>
            <div className="field">
              <label className="field-label">Description (optional)</label>
              <textarea
                className="field-input"
                rows={3}
                value={scenarioForm.description}
                onChange={(e) => setScenarioForm({ ...scenarioForm, description: e.target.value })}
                placeholder="What's special about this scenario?"
              />
            </div>
          </div>
        </Modal>
      )}

      {showSaveProfile && (
        <Modal
          title="Save Rule Profile"
          subtitle="Save the current model rules as a reusable profile."
          onClose={() => setShowSaveProfile(false)}
          actions={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setShowSaveProfile(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-accent" onClick={saveRuleProfile}>
                <Save size={12} /> Save profile
              </button>
            </>
          }
        >
          <div className="modal-fields">
            <div className="field">
              <label className="field-label">Profile name</label>
              <input
                type="text"
                className="field-input"
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                placeholder="e.g., Tight Tank"
                autoFocus
              />
            </div>
            <div className="field">
              <label className="field-label">Description (optional)</label>
              <textarea
                className="field-input"
                rows={3}
                value={profileForm.description}
                onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })}
                placeholder="When to use this profile?"
              />
            </div>
          </div>
        </Modal>
      )}

      <Toast
        message={toast?.message}
        kind={toast?.kind}
        onDismiss={() => setToast(null)}
      />
      </div>
    </div>
  );
}
