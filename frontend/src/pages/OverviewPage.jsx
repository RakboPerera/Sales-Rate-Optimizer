import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Compass, BookOpen, DollarSign, TrendingUp, AlertTriangle, Layers,
  Sliders, Save, GitCompare, FileSpreadsheet, Lock, Cpu, Activity,
  ArrowRight, Play, ChevronRight, Database, Calendar,
  Box, Droplet, Calculator, Sigma, Target, Zap, Pause, Gauge,
} from 'lucide-react';

// ─── Page ────────────────────────────────────────────────────────────────
export default function OverviewPage() {
  const [section, setSection] = useState('product');
  return (
    <div className="overview-page">
      <Hero />
      <SectionToggle section={section} onChange={setSection} />
      <div className="overview-content">
        {section === 'product' ? <ProductOverview /> : <TechnicalDeepDive />}
      </div>
      <CTA />
    </div>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="ov-hero">
      <div className="ov-hero-grid" aria-hidden="true" />
      <div className="ov-hero-glow" aria-hidden="true" />
      <div className="ov-hero-inner">
        <div className="ov-hero-left">
          <div className="ov-hero-eyebrow">
            <span className="ov-hero-eyebrow-dot" /> Octave · Sales Rate Optimizer
          </div>
          <h1 className="ov-hero-title">
            Decide what to&nbsp;sell,<br />
            <span className="ov-hero-title-accent">every day</span>,<br />
            with&nbsp;confidence.
          </h1>
          <p className="ov-hero-sub">
            A dynamic-programming engine that turns daily fuel-bunker
            decisions into a defensible plan — balancing cost arbitrage,
            market share, tank pressure, and contractual obligations across
            a 20-working-day horizon.
          </p>
          <div className="ov-hero-actions">
            <Link to="/optimizer" className="btn btn-accent">
              <Play size={14} /> Open Optimizer
            </Link>
            <a href="#deep-dive" className="ov-hero-link"
               onClick={(e) => { e.preventDefault(); document.querySelector('.ov-toggle')?.scrollIntoView({ behavior: 'smooth' }); }}>
              See how it works <ArrowRight size={14} />
            </a>
          </div>
        </div>
        <div className="ov-hero-right" aria-hidden="true">
          <HeroVisual />
        </div>
      </div>
      <div className="ov-hero-stats">
        <Stat n="20" lbl="Working-day horizon" />
        <Stat n="6" lbl="Reward components" />
        <Stat n="17" lbl="Tunable rule constants" />
        <Stat n="~10ms" lbl="Per optimization run" />
      </div>
    </section>
  );
}

function Stat({ n, lbl }) {
  return (
    <div className="ov-stat">
      <div className="ov-stat-num">{n}</div>
      <div className="ov-stat-lbl">{lbl}</div>
    </div>
  );
}

// Decorative right-side panel — a stylized "daily plan" preview
function HeroVisual() {
  // Pre-canned bar heights for a stylized daily plan preview
  const bars = [85, 95, 70, 25, 0, 80, 35, 15, 10, 5, 30, 40, 20, 0, 0, 5, 8, 0, 0, 0];
  const line = bars.map((_, i) => 30 + Math.sin(i * 0.4) * 8 + i * 1.6);
  return (
    <div className="ov-hero-card">
      <div className="ov-hero-card-head">
        <div className="ov-hero-card-eyebrow">Daily Plan · 20-day horizon</div>
        <div className="ov-hero-card-pill">FAST</div>
      </div>
      <svg viewBox="0 0 320 160" className="ov-hero-svg">
        {/* Gridlines */}
        {[0, 1, 2, 3, 4].map((g) => (
          <line key={g} x1="0" y1={20 + g * 30} x2="320" y2={20 + g * 30}
                stroke="#2a2a2a" strokeWidth="1" strokeDasharray="2 4" />
        ))}
        {/* Bars */}
        {bars.map((h, i) => {
          const x = 6 + i * 15.5;
          const barH = (h / 100) * 110;
          return (
            <rect key={i} x={x} y={140 - barH} width="11" height={barH}
                  fill={h > 60 ? '#26EA9F' : h > 20 ? 'rgba(38,234,159,0.55)' : '#3A3A3A'}
                  rx="1" />
          );
        })}
        {/* Cum-share line */}
        <polyline
          fill="none"
          stroke="#26EA9F"
          strokeWidth="2"
          points={line.map((y, i) => `${6 + i * 15.5 + 5.5},${140 - y}`).join(' ')}
        />
        {line.map((y, i) => (
          <circle key={i} cx={6 + i * 15.5 + 5.5} cy={140 - y} r="2" fill="#26EA9F" />
        ))}
      </svg>
      <div className="ov-hero-card-legend">
        <span><i className="ov-legend-swatch ov-legend-swatch--bar" />Operator sells</span>
        <span><i className="ov-legend-swatch ov-legend-swatch--line" />Cum. share</span>
      </div>
      <div className="ov-hero-card-stats">
        <div><strong>22,507</strong><span>MT sold</span></div>
        <div><strong>40.6%</strong><span>Final share</span></div>
        <div><strong>0</strong><span>Evacuated</span></div>
      </div>
    </div>
  );
}

// ─── Section toggle ─────────────────────────────────────────────────────
function SectionToggle({ section, onChange }) {
  return (
    <div className="ov-toggle-wrap">
      <div className="ov-toggle" role="tablist" id="ov-toggle">
        <button
          type="button"
          role="tab"
          aria-selected={section === 'product'}
          className={`ov-toggle-card${section === 'product' ? ' active' : ''}`}
          onClick={() => onChange('product')}
        >
          <div className="ov-toggle-icon"><Compass size={22} /></div>
          <div className="ov-toggle-text">
            <div className="ov-toggle-title">Product Overview</div>
            <div className="ov-toggle-sub">What it does, who it's for, how to use it</div>
          </div>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={section === 'technical'}
          className={`ov-toggle-card${section === 'technical' ? ' active' : ''}`}
          onClick={() => onChange('technical')}
        >
          <div className="ov-toggle-icon"><BookOpen size={22} /></div>
          <div className="ov-toggle-text">
            <div className="ov-toggle-title">Technical Deep Dive</div>
            <div className="ov-toggle-sub">The math, the algorithm, the trade-offs</div>
          </div>
        </button>
      </div>
    </div>
  );
}

// ─── Product Overview ────────────────────────────────────────────────────
function ProductOverview() {
  return (
    <>
      <Section eyebrow="The challenge" title="Four tensions, one daily decision">
        <p className="ov-lead">
          Every day, a fuel-bunker operator must answer one deceptively simple question:{' '}
          <em>how much should we sell today?</em> The answer is pulled in four directions at once,
          and getting it wrong costs real money.
        </p>
        <div className="problem-grid">
          <ProblemCard
            n="01"
            icon={<DollarSign size={22} />}
            title="Cost arbitrage"
            keyMetric="$/MT"
            desc="Sell aggressively when your unpriced stock undercuts the competitor's priced. Hold when they can undercut you. Time it wrong and margin evaporates."
          />
          <ProblemCard
            n="02"
            icon={<TrendingUp size={22} />}
            title="Market share"
            keyMetric="% share"
            desc="Hit the monthly floor (typ. 36%). Never breach the weekly cap (typ. 60%). Both at once, every week, every month."
          />
          <ProblemCard
            n="03"
            icon={<AlertTriangle size={22} />}
            title="Tank pressure"
            keyMetric="% fill"
            desc="Overflow means evacuation cost. Over-selling to relieve pressure dilutes share. The optimizer threads the needle."
          />
          <ProblemCard
            n="04"
            icon={<Layers size={22} />}
            title="Stock priority"
            keyMetric="priced ▸ unpriced"
            desc="Deplete priced (cost-locked) stock first. Time unpriced sales for windows where their cost advantage is real."
          />
        </div>
      </Section>

      <Section eyebrow="The solution" title="A plan you can defend">
        <div className="solution-grid">
          <div className="solution-pitch">
            <p>
              The optimizer takes everything that goes into the decision — opening stock, daily
              demand, competitor positions, arriving cargoes, pipeline commitments, costs both
              yours and theirs — and produces a <strong>day-by-day sales plan</strong> for the
              next 20 working days.
            </p>
            <p>
              Every quantity in the plan is the answer to a dynamic-programming search over twelve
              candidate values per day, evaluated against six reward components, propagated
              backward through future days, iterated until stable.
            </p>
            <div className="ov-quote">
              <div className="ov-quote-mark">"</div>
              <div className="ov-quote-body">
                It doesn't just pick what's good for today. It picks what's good for today
                <em> given what's coming.</em>
              </div>
            </div>
          </div>
          <div className="ov-output-panel">
            <div className="ov-output-head">
              <div className="ov-output-eyebrow">What you get</div>
            </div>
            <ul className="ov-output-list">
              <li><span className="ov-output-icon"><Activity size={14} /></span><div><strong>20 daily quantities</strong><span>What to sell each day</span></div></li>
              <li><span className="ov-output-icon"><Layers size={14} /></span><div><strong>Priced / unpriced split</strong><span>Which inventory to deplete first</span></div></li>
              <li><span className="ov-output-icon"><Gauge size={14} /></span><div><strong>Tank trajectory</strong><span>Fill %, borrow, evacuation events</span></div></li>
              <li><span className="ov-output-icon"><TrendingUp size={14} /></span><div><strong>Cumulative share</strong><span>Tracking vs. the monthly floor</span></div></li>
              <li><span className="ov-output-icon"><BookOpen size={14} /></span><div><strong>Plain-English driver</strong><span>Why each day's number, in one sentence</span></div></li>
            </ul>
          </div>
        </div>
      </Section>

      <Section eyebrow="How to use it" title="Five steps from input to plan">
        <ol className="ov-steps">
          <Step
            n="1"
            icon={<Sliders size={18} />}
            title="Configure your inputs"
            desc="Stock, costs, demand, market-share targets, imports & pipeline schedule — all in the left sidebar. Click the ? next to any field for context."
          />
          <Step
            n="2"
            icon={<Cpu size={18} />}
            title="Pick a rule profile (or tune manually)"
            desc="Three system profiles ship with the product: Default, Conservative, Aggressive. Or open Advanced — Model Rules to dial in 17 calibration constants."
          />
          <Step
            n="3"
            icon={<Play size={18} />}
            title="Run the optimizer"
            desc="One click. ~10 ms compute. Results render in five panels: KPI strip, sales chart, daily plan, explainability, weekly breakdown."
          />
          <Step
            n="4"
            icon={<Activity size={18} />}
            title="Inspect & interrogate"
            desc="The Daily Plan shows the recommended sale. The Explainability tab tells you why. The Weekly view validates the floor and cap are both respected."
          />
          <Step
            n="5"
            icon={<Save size={18} />}
            title="Save, compare, export"
            desc="Save scenarios for reuse. Side-by-side compare two configurations. Export to XLSX for ops handoff or PDF for the deck."
          />
        </ol>
      </Section>

      <Section eyebrow="What's included" title="Beyond the core engine">
        <div className="feature-grid">
          <FeatureCard icon={<Database size={20} />} title="Scenario library"
            desc="Persist named configurations. Load any back into the optimizer in one click." />
          <FeatureCard icon={<GitCompare size={20} />} title="Side-by-side compare"
            desc="Run two scenarios in parallel. Inspect KPI deltas — what does a 10% cost rise actually do?" />
          <FeatureCard icon={<Lock size={20} />} title="Rule profiles"
            desc="System-locked Conservative / Default / Aggressive presets plus unlimited custom profiles." />
          <FeatureCard icon={<Calendar size={20} />} title="Per-day overrides"
            desc="Demand spike on day 5? Cost change on day 10? Override any input on any day." />
          <FeatureCard icon={<FileSpreadsheet size={20} />} title="Excel & PDF export"
            desc="Three-sheet Excel workbook (summary, daily, weekly) or a one-click PDF of the rendered plan." />
          <FeatureCard icon={<Target size={20} />} title="White-labeled"
            desc="The Operator Label drives every reference in the UI. Demo it to any operator with their own name on the screen." />
        </div>
      </Section>
    </>
  );
}

function ProblemCard({ n, icon, title, keyMetric, desc }) {
  return (
    <div className="problem-card">
      <div className="problem-card-top">
        <div className="problem-card-icon">{icon}</div>
        <div className="problem-card-num">{n}</div>
      </div>
      <div className="problem-card-title">{title}</div>
      <div className="problem-card-desc">{desc}</div>
      <div className="problem-card-foot">{keyMetric}</div>
    </div>
  );
}

function FeatureCard({ icon, title, desc }) {
  return (
    <div className="feature-card">
      <div className="feature-card-icon">{icon}</div>
      <div className="feature-card-title">{title}</div>
      <div className="feature-card-desc">{desc}</div>
    </div>
  );
}

function Step({ n, icon, title, desc }) {
  return (
    <li className="step-item">
      <div className="step-rail">
        <div className="step-num">{n}</div>
      </div>
      <div className="step-body">
        <div className="step-title">{icon}<span>{title}</span></div>
        <div className="step-desc">{desc}</div>
      </div>
    </li>
  );
}

// ─── Technical Deep Dive ─────────────────────────────────────────────────
function TechnicalDeepDive() {
  return (
    <>
      <Section eyebrow="The problem, formally" title="A finite-horizon DP">
        <p className="ov-lead">
          The engine solves a constrained, finite-horizon dynamic-programming problem: choose a
          sequence of daily sell quantities that maximizes cumulative discounted reward subject to
          physical, contractual, and competitive constraints.
        </p>
        <div className="formula-block">
          <div className="formula-display large">
            <span className="formula-lhs">max<sub>x</sub></span>{' '}
            <Sigma size={20} style={{ verticalAlign: 'middle' }} />
            <sub>t=1</sub><sup>T</sup>{' '}
            γ<sup>t−1</sup> · R<sub>t</sub>(x<sub>t</sub>, s<sub>t</sub>)
          </div>
          <div className="formula-where">
            <strong>γ</strong> ∈ [0.80, 0.99] — future discount &nbsp;·&nbsp;
            <strong>R<sub>t</sub></strong> — per-day reward (6 components) &nbsp;·&nbsp;
            <strong>s<sub>t</sub></strong> — system state at day <em>t</em>
          </div>
        </div>
      </Section>

      <Section eyebrow="State" title="What the model tracks each day">
        <div className="vars-grid">
          <VarRow sym="P_t^op" desc="Operator physical stock at start of day t (MT)" />
          <VarRow sym="P_t^c"  desc="Competitor physical stock (MT)" />
          <VarRow sym="S_t^p"  desc="Operator priced SFS (cost-locked, sold first)" />
          <VarRow sym="S_t^u"  desc="Operator unpriced SFS (floating cost)" />
          <VarRow sym="Ŝ_t^p"  desc="Competitor priced SFS" />
          <VarRow sym="Ŝ_t^u"  desc="Competitor unpriced SFS" />
          <VarRow sym="x_t"    desc="Decision: operator sells x_t MT on day t" decision />
        </div>
        <p className="muted small">
          <strong>SFS</strong> — Sellable Fuel Stock — is the portion of inventory cleared for
          sale. Physical stock can include cargoes en route. SFS becomes available 5 working days
          before a cargo's arrival.
        </p>
      </Section>

      <Section eyebrow="Stock dynamics" title="How state evolves between days">
        <div className="dynamics-grid">
          <div className="dynamics-block">
            <div className="dynamics-block-title"><Droplet size={16} /> Physical stock</div>
            <div className="formula-display tight">
              P<sub>t+1</sub> = max(0, P<sub>t</sub> + I<sub>t</sub> − PIPE<sub>t</sub> − Q<sub>t−5</sub>)
            </div>
            <div className="dynamics-legend">
              <span><strong>I_t</strong> imports arriving</span>
              <span><strong>PIPE_t</strong> pipeline clearances</span>
              <span><strong>Q_t−5</strong> sales physically leaving tank (5-day lock)</span>
            </div>
            <div className="dynamics-overflow">
              <div className="dynamics-legend-row">
                <span className="badge badge-warn">overflow</span>
                = max(0, P<sub>t</sub> − L<sub>t</sub><sup>op</sup>)
              </div>
              <div className="dynamics-legend-row">
                <span className="badge badge-borrow">borrowed</span>
                = min(overflow, L<sub>t</sub><sup>c</sup> − P<sub>t</sub><sup>c</sup>)
              </div>
              <div className="dynamics-legend-row">
                <span className="badge badge-evac">evacuated</span>
                = max(0, overflow − comp spare)
              </div>
            </div>
          </div>

          <div className="dynamics-block">
            <div className="dynamics-block-title"><Layers size={16} /> SFS — priced first</div>
            <div className="formula-display tight">
              sold<sub>priced</sub> = min(x<sub>t</sub>, S<sub>t</sub><sup>p</sup>)
            </div>
            <div className="formula-display tight">
              sold<sub>unpriced</sub> = max(0, x<sub>t</sub> − sold<sub>priced</sub>)
            </div>
            <div className="formula-display tight">
              S<sub>t+1</sub><sup>p</sup> = max(0, S<sub>t</sub><sup>p</sup> − sold<sub>priced</sub>)
            </div>
            <div className="formula-display tight">
              S<sub>t+1</sub><sup>u</sup> = max(0, S<sub>t</sub><sup>u</sup> − sold<sub>unpriced</sub>) + ΔSFS<sub>t+1</sub>
            </div>
            <div className="dynamics-legend">
              Priced always sells before unpriced. New SFS (ΔSFS) unlocks 5 working days before
              its cargo arrival.
            </div>
          </div>
        </div>
      </Section>

      <Section eyebrow="The core signal" title="FAST or HOLD?">
        <p>
          The single most consequential calculation. It compares your cheapest unpriced barrel
          against the competitor's cheapest priced barrel:
        </p>
        <div className="formula-block">
          <div className="formula-display large">
            unpriced_advantage<sub>t</sub> ={' '}
            <span className="frac">
              <span className="frac-num">C<sup>c,p</sup> − C<sup>op,u</sup></span>
              <span className="frac-den">C<sub>ref</sub></span>
            </span>
          </div>
          <div className="formula-where">
            <strong>C_ref</strong> = mean of all four costs (op-priced, op-unpriced, comp-priced, comp-unpriced)
          </div>
        </div>
        <div className="mode-cards">
          <div className="mode-card mode-card-fast">
            <div className="mode-badge"><Zap size={14} /> FAST</div>
            <div className="mode-card-title">advantage &gt; 0</div>
            <p>Your unpriced undercuts competitor priced. Sell aggressively to win share while the window is open.</p>
          </div>
          <div className="mode-card mode-card-hold">
            <div className="mode-badge"><Pause size={14} /> HOLD</div>
            <div className="mode-card-title">advantage ≤ 0</div>
            <p>Competitor's priced stock can undercut you. Conserve unpriced; sell priced only, scale capacity down.</p>
          </div>
        </div>
      </Section>

      <Section eyebrow="The reward function" title="Six components, one number">
        <div className="formula-block large">
          <div className="formula-display large">
            R<sub>t</sub>(x<sub>t</sub>) =
            <span className="reward-eq-token plus">B<sub>SFS</sub></span> +
            <span className="reward-eq-token plus">T<sub>unpriced</sub></span> +
            <span className="reward-eq-token plus">T<sub>priced</sub></span> +
            <span className="reward-eq-token plus">U<sub>t</sub></span> −
            <span className="reward-eq-token minus">E<sub>t</sub></span> −
            <span className="reward-eq-token minus">K<sub>t</sub></span>
          </div>
        </div>
        <div className="reward-grid">
          <RewardCard sign="+" name="B_SFS" title="SFS position bonus"
            formula={<>20 · S<sup>op</sup> / (S<sup>op</sup> + S<sup>c</sup>)</>}
            desc="Rewards holding a larger share of total market sellable stock — strategic optionality." />
          <RewardCard sign="+" name="T_unpriced" title="Unpriced cost term"
            formula={<>x<sub>t</sub><sup>u</sup> · advantage · λ · κ</>}
            desc="In FAST mode rewards selling unpriced; in HOLD mode scales the penalty by competitor's priced fraction." />
          <RewardCard sign="+" name="T_priced" title="Priced cost term (HOLD only)"
            formula={<>x<sub>t</sub><sup>p,rew</sup> · adv<sub>priced</sub> · λ · κ · g</>}
            desc="Rewards selling priced stock up to demand. Beyond demand, penalises over-selling." />
          <RewardCard sign="+" name="U_t" title="Tank urgency"
            formula={<>e<sup>(f − WT)·exp</sup> · x · mult</>}
            desc="Pressure-release valve. As fill ratio crosses the warning threshold, urgency grows exponentially." />
          <RewardCard sign="−" name="E_t" title="Evacuation penalty"
            formula={<>evac · 600 · C<sub>evac</sub> + spike</>}
            desc="When both your and competitor's tanks are full, overflow must be evacuated at $/MT cost." />
          <RewardCard sign="−" name="K_t" title="Weekly cap penalty"
            formula={<>(share<sub>wk</sub> − cap)² · 800 · relax</>}
            desc="Squared penalty when the weekly share would exceed the cap. Relaxed under tank pressure." />
        </div>
        <div className="reward-tuning">
          <div className="ov-mini-eyebrow">Tuning knobs that shape the reward</div>
          <div className="tuning-row">
            <Knob name="λ" range="0.1 — 0.9" desc="Cost sensitivity. Low = ignore cost; high = cost dominates" />
            <Knob name="κ" range="4 + λ·8" desc="Cost-term scale. Amplifies cost importance" />
            <Knob name="WT" range="0.75" desc="Tank pressure threshold (fill ratio)" />
            <Knob name="γ" range="0.80 — 0.99" desc="Future discount. High = far-sighted" />
          </div>
        </div>
      </Section>

      <Section eyebrow="The solver" title="Iterative value iteration">
        <p>
          The DP doesn't enumerate every possible plan — that would be combinatorial. It iterates
          a fixed point: forward-simulate to compute the value of each state, optimize per day
          using discounted future value, repeat until daily quantities stabilize.
        </p>
        <DpFlowDiagram />
        <div className="solver-detail">
          <SolverStat label="Initial guess" val={<>min(D<sub>t</sub>/2, 200)</>} />
          <SolverStat label="Candidates per day" val="12 evenly spaced in [0, effCap]" />
          <SolverStat label="Max iterations" val="25" />
          <SolverStat label="Convergence" val="max Δ &lt; 1 MT" />
          <SolverStat label="Post-process #1" val="Monthly floor top-up + redistribute" />
          <SolverStat label="Post-process #2" val="SFS availability reconcile" />
        </div>
      </Section>

      <Section eyebrow="Outputs" title="What you get back">
        <div className="outputs-grid">
          <OutputBlock title="Daily plan" items={['Sell qty', 'Priced/unpriced split', 'Stock remaining', 'Fill %', 'Borrowed / evacuated', 'Status (OK/WARN/BORROW/EVAC)', 'Cum. market share']} />
          <OutputBlock title="Weekly roll-up" items={['Total sold', 'Comp sold', 'Week share %', 'Avg fill', 'Evacuated MT']} />
          <OutputBlock title="Summary KPIs" items={['Total sold MT', 'Final share %', 'Peak fill %', 'Total evacuated', 'Cost mode (FAST/HOLD)']} />
          <OutputBlock title="Explainability" items={['Mode per day', 'Cost advantage $/MT', 'Driver text in plain English', '% vs. demand', 'Cap status']} />
        </div>
      </Section>
    </>
  );
}

function VarRow({ sym, desc, decision }) {
  return (
    <div className={`var-row${decision ? ' var-row--decision' : ''}`}>
      <span className="var-sym">{sym}</span>
      <span className="var-desc">{desc}</span>
    </div>
  );
}

function RewardCard({ sign, name, title, formula, desc }) {
  return (
    <div className={`reward-card reward-card-${sign === '+' ? 'plus' : 'minus'}`}>
      <div className="reward-card-head">
        <span className={`reward-sign reward-sign-${sign === '+' ? 'plus' : 'minus'}`}>{sign}</span>
        <span className="reward-name">{name}</span>
      </div>
      <div className="reward-title">{title}</div>
      <div className="reward-formula">{formula}</div>
      <div className="reward-desc">{desc}</div>
    </div>
  );
}

function Knob({ name, range, desc }) {
  return (
    <div className="knob-pill">
      <div className="knob-head"><strong>{name}</strong> <span className="knob-range">{range}</span></div>
      <div className="knob-desc">{desc}</div>
    </div>
  );
}

function SolverStat({ label, val }) {
  return (
    <div className="solver-stat">
      <div className="solver-stat-lbl">{label}</div>
      <div className="solver-stat-val">{val}</div>
    </div>
  );
}

function OutputBlock({ title, items }) {
  return (
    <div className="output-block">
      <div className="output-block-title">{title}</div>
      <ul>
        {items.map((it) => <li key={it}><ChevronRight size={11} />{it}</li>)}
      </ul>
    </div>
  );
}

function DpFlowDiagram() {
  return (
    <div className="dp-flow">
      <div className="dp-flow-step">
        <div className="dp-step-num">①</div>
        <Calculator size={22} />
        <div className="dp-step-name">Init quantities</div>
        <div className="dp-step-detail">x<sub>t</sub> = min(D<sub>t</sub>/2, 200)</div>
      </div>
      <ArrowRight size={20} className="dp-flow-arrow" />
      <div className="dp-flow-loop">
        <div className="dp-flow-loop-label">repeat up to 25×</div>
        <div className="dp-loop-inner">
          <div className="dp-flow-step">
            <div className="dp-step-num">②</div>
            <Activity size={22} />
            <div className="dp-step-name">Forward simulate</div>
            <div className="dp-step-detail">compute V<sub>t</sub> for all t</div>
          </div>
          <ArrowRight size={20} className="dp-flow-arrow" />
          <div className="dp-flow-step">
            <div className="dp-step-num">③</div>
            <Cpu size={22} />
            <div className="dp-step-name">Optimize per day</div>
            <div className="dp-step-detail">argmax<sub>c</sub> R(c)+γV<sub>t+1</sub></div>
          </div>
          <ArrowRight size={20} className="dp-flow-arrow" />
          <div className="dp-flow-step">
            <div className="dp-step-num">④</div>
            <Target size={22} />
            <div className="dp-step-name">Check convergence</div>
            <div className="dp-step-detail">max |Δx<sub>t</sub>| &lt; 1</div>
          </div>
        </div>
      </div>
      <ArrowRight size={20} className="dp-flow-arrow" />
      <div className="dp-flow-step">
        <div className="dp-step-num">⑤</div>
        <Box size={22} />
        <div className="dp-step-name">Floor enforcement</div>
        <div className="dp-step-detail">redistribute to hit floor</div>
      </div>
      <ArrowRight size={20} className="dp-flow-arrow" />
      <div className="dp-flow-step dp-flow-step-final">
        <div className="dp-step-num">⑥</div>
        <Activity size={22} />
        <div className="dp-step-name">Daily plan</div>
        <div className="dp-step-detail">x*<sub>1</sub> … x*<sub>20</sub></div>
      </div>
    </div>
  );
}

// ─── Shared section + CTA ────────────────────────────────────────────────
function Section({ eyebrow, title, children }) {
  return (
    <section className="overview-section">
      {eyebrow && <div className="overview-section-eyebrow">{eyebrow}</div>}
      <h2 className="overview-section-title">{title}</h2>
      <div className="overview-section-body">{children}</div>
    </section>
  );
}

function CTA() {
  return (
    <section className="overview-cta">
      <div className="overview-cta-inner">
        <div>
          <h3>Ready to run a plan?</h3>
          <p>Jump in with the live preset, or load one of your saved scenarios.</p>
        </div>
        <div className="overview-cta-actions">
          <Link to="/optimizer" className="btn btn-accent">
            <Play size={14} /> Open Optimizer
          </Link>
          <Link to="/scenarios" className="btn btn-secondary">
            <Database size={14} /> Scenarios
          </Link>
        </div>
      </div>
    </section>
  );
}
