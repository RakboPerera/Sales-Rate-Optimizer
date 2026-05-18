# Octave Sales Rate Optimizer

A dynamic-programming-based sales-rate optimizer for fuel bunkering businesses.
Decides daily sell quantities over a 20-working-day horizon, balancing cost
arbitrage, monthly market-share floor, weekly cap, tank pressure, and evacuation
risk.

White-labeled — the **Operator Label** field in the sidebar drives all "Operator/Our"
labels throughout the UI, so the same product can be demo'd to any client without
code changes.

---

## Stack

- **Backend**: Node.js + Express (ES modules), [sql.js](https://github.com/sql-js/sql.js) for persistence (pure JS / WASM), [ExcelJS](https://github.com/exceljs/exceljs) for XLSX export.
- **Frontend**: React 18 + Vite, Chart.js, jsPDF + html2canvas (client-side PDF), axios.
- **Styling**: Octave light-mode brand — white canvas, black panels, turquoise `#26EA9F` accent.
- **Deploy**: Single Render.com web service (serves API and built SPA).

All packages are pure JavaScript — no native compilation required.

---

## Run locally

### One-time setup

```powershell
# from project root
npm install --prefix backend
npm install --prefix frontend
```

CMD equivalent:

```cmd
npm install --prefix backend
npm install --prefix frontend
```

### Development (hot reload)

Open two terminals.

**Terminal 1 — backend** (Express on `:9876`):

```powershell
cd backend
node server.js
```

CMD:
```cmd
cd backend
node server.js
```

**Terminal 2 — frontend** (Vite dev server with `/api` proxy):

```powershell
cd frontend
npm run dev
```

CMD:
```cmd
cd frontend
npm run dev
```

Vite picks the first available port from `5173` upward; open the URL Vite prints
(usually <http://localhost:5173>). API calls are proxied to `localhost:9876`.

### Production-style local run

Build the SPA once, then serve it via Express on a single port:

```powershell
cd frontend
npm run build
cd ../backend
node server.js
```

Open <http://localhost:9876>. Express auto-detects `frontend/dist/` and serves
both the static SPA and the API from the same origin — no Vite proxy needed.

### Setting the port

Backend honors `PORT` env var:

```powershell
$env:PORT = "9876"; node backend/server.js
```

```cmd
set PORT=9876
node backend/server.js
```

---

## Features

### Optimizer page (`/`)

- 13-section sidebar with all inputs: Branding (Operator Label), Planning Period,
  our stock, competitor stock, demand, share constraints, historicals, operational
  constraints, λ/γ sliders with live cost-mode badge (FAST / HOLD), Imports schedule,
  Pipeline clearances, Per-Day Overrides, and Advanced Model Rules.
- **Run optimizer** → KPI strip + sales/share chart + tabbed results (Daily Plan,
  Explainability, Weekly, Stock Chart).
- **Save scenario**, **Export XLSX**, **Export PDF** action buttons.
- One-click **Live preset** loads the spec's reference scenario; **Defaults** resets.

### Model Rules panel

17 operationally meaningful constants are exposed for tuning:

| Group | Rules |
|---|---|
| Search | max iterations, convergence threshold, candidates/day, sale-tank delay, SFS lead time |
| Tank | pressure threshold, evacuation severity, fill-penalty curve exponent |
| Floor / Cap | weekly cap penalty, weekly relaxation under pressure, floor boost, floor scale cap |
| Reward shape | SFS bonus weight, κ base, κ λ-slope, HOLD capacity base, HOLD capacity slope |

Tunable inline on the Optimizer page, or save as a **Rule Profile**. Three system
profiles ship seeded: **Default**, **Conservative**, **Aggressive**.

### Scenarios page (`/scenarios`)

Saved configurations. Each scenario captures inputs + rules (or a linked profile)
+ operator label. Load any scenario into the optimizer with one click; rename or
delete from the card.

### Compare page (`/compare`)

Pick two saved scenarios, run both in parallel, see a side-by-side KPI table with
deltas plus overlaid daily-plan charts. Use this to demo "what if cost goes up?"
or "what if we tighten the tank rule?" to a client.

### Rule Profiles page (`/rules`)

Manage rule profiles. System profiles (Default, Conservative, Aggressive) are
read-only on rules but can be renamed. Custom profiles support full CRUD and a
**Duplicate** action.

### Exports

- **XLSX** (server-side, [ExcelJS](https://github.com/exceljs/exceljs)) — 3-sheet
  workbook: Summary KPIs + Input Parameters + Rules, Daily Plan (23 columns),
  Weekly Breakdown. Octave-styled headers.
- **PDF** (client-side, jsPDF + html2canvas) — captures the entire rendered
  results panel, including charts.

---

## Project structure

```
Sales_Rate_opt/
├── package.json              # root scripts (install:all, build, start)
├── render.yaml               # Render.com deploy config
├── README.md
├── .gitignore
├── .claude/launch.json       # Local launch config for Claude Preview
│
├── backend/
│   ├── package.json
│   ├── server.js             # Express + static SPA serving
│   ├── database.js           # sql.js wrapper (async init, autosave)
│   ├── lib/
│   │   ├── optimizer.js      # Dynamic-programming solver
│   │   ├── defaultRules.js   # Default rule values + system profiles
│   │   └── validation.js     # Input + rules validation
│   ├── routes/
│   │   ├── optimize.js       # POST /api/optimize
│   │   ├── scenarios.js      # CRUD /api/scenarios
│   │   ├── ruleProfiles.js   # CRUD /api/rule-profiles
│   │   └── exports.js        # POST /api/export/xlsx
│   └── storage/
│       └── data.db           # sql.js persistence (gitignored)
│
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── api.js
        ├── styles/
        │   ├── tokens.css    # Octave brand tokens
        │   └── app.css
        ├── components/       # 14 components (Sidebar, charts, modals, etc.)
        ├── pages/            # OptimizerPage, ScenariosPage, ComparePage, RuleProfilesPage
        ├── state/            # useReducer state + defaults
        └── utils/            # format, exportPdf
```

---

## API contract

### `POST /api/optimize`

Request:

```json
{
  "operator_label": "Acme Bunkering",
  "inputs": {
    "plan_start_date": "2026-05-06",
    "num_planning_days": 20,
    "operator_physical_stock": 7859,
    "operator_priced_sfs": 6857,
    "operator_unpriced_sfs": 2150,
    "...": "..."
  },
  "rules": { "tank_threshold": 0.7, "evac_severity": 800 },
  "rule_profile_id": null
}
```

`rules` is optional and supports partial overrides (missing keys fall back to
defaults or the profile's values).

Response (excerpt):

```json
{
  "operator_label": "Acme Bunkering",
  "cost_mode": "HOLD",
  "cost_advantage_opening": -73.2,
  "dp_iterations": 5,
  "compute_ms": 12,
  "rules_applied": { "...": "all 17 effective rule values" },
  "summary": {
    "total_sold_mt": 19007,
    "final_market_share_pct": 35.0,
    "peak_tank_fill_pct": 159.8,
    "total_evacuated_mt": 0
  },
  "weekly": [{ "week_label": "W1", "...": "..." }],
  "daily": [{ "day_number": 1, "date": "2026-05-06", "...": "..." }]
}
```

### `GET /api/scenarios`, `POST /api/scenarios`, `GET|PUT|DELETE /api/scenarios/:id`

### `GET /api/rule-profiles`, `POST /api/rule-profiles`, `GET|PUT|DELETE /api/rule-profiles/:id`

System profiles cannot be deleted; only name/description can be updated.

### `POST /api/export/xlsx`

Same payload shape as `/api/optimize`. Returns an `.xlsx` blob.

---

## Deploy to Render.com

1. `git init && git add . && git commit -m "Initial commit"`
2. Push to a fresh GitHub repo.
3. On Render: New → Web Service → connect repo. `render.yaml` provides the build
   and start commands. Free tier works. No env vars required.

The single web service builds the frontend, installs backend deps, and serves the
SPA from Express on Render's assigned `PORT`. Persistence uses sql.js on Render's
ephemeral disk — scenarios reset on each redeploy. For long-lived persistence, add
a Render Persistent Disk and point `backend/storage/` at it.

---

## Verification (after a fresh clone)

```powershell
npm install --prefix backend
npm install --prefix frontend
cd frontend; npm run build; cd ..
cd backend; node server.js
```

Open <http://localhost:9876> and:

1. Press **Live preset** → **Run optimizer** → confirm KPI strip, charts, daily
   table populate.
2. Click **Save scenario** → name it → confirm toast. Navigate to **Scenarios** →
   it's listed.
3. Open **Advanced — Model Rules** in the sidebar → change `tank_threshold` from
   `0.75` to `0.6` → Run again → confirm WARN/EVAC rows appear earlier.
4. **Save as profile** → name "Tight Tank" → navigate to **Rule Profiles** → it
   appears alongside the three system profiles.
5. Save two scenarios with different rules, go to **Compare**, select both, hit
   Compare → confirm divergent KPIs and overlaid charts.
6. **Export XLSX** → opens in Excel with three sheets.
7. **Export PDF** → opens in Acrobat with the results panel.

---

## Brand checklist (per Octave Brand Guidelines §8)

- ✅ White surface (`#FFFFFF`)
- ✅ Black panels for sidebar, KPI strip, cards (`#0A0A0A`)
- ✅ Turquoise (`#26EA9F`) used sparingly — Run CTA, active tab, cum-share line,
  KPI deltas, focus rings
- ✅ No pink, no gradients, no shadows on the logo
- ✅ Fonts: ITC Avant Garde Gothic Pro display (fallback chain) + Lato body
- ✅ OCTAVE wordmark rendered in CSS (text), not a custom path
