import { Router } from 'express';
import ExcelJS from 'exceljs';
import { runOptimizer } from '../lib/optimizer.js';
import { validateOptimizerRequest } from '../lib/validation.js';

const TURQUOISE = 'FF26EA9F';
const BLACK = 'FF0A0A0A';
const WHITE = 'FFFFFFFF';
const NEUTRAL_100 = 'FFF4F4F4';

function setHeader(cell) {
  cell.font = { bold: true, color: { argb: WHITE }, name: 'Arial' };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLACK } };
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
  cell.border = {
    bottom: { style: 'thin', color: { argb: TURQUOISE } },
  };
}

function setKpiLabel(cell) {
  cell.font = { bold: false, color: { argb: WHITE }, size: 9, name: 'Arial' };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLACK } };
}

function setKpiValue(cell) {
  cell.font = { bold: true, color: { argb: TURQUOISE }, size: 14, name: 'Arial' };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLACK } };
}

function setSubHeader(cell) {
  cell.font = { bold: true, name: 'Arial' };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NEUTRAL_100 } };
}

export function createExportsRouter() {
  const router = Router();

  router.post('/xlsx', async (req, res) => {
    try {
      const payload = req.body || {};
      const violation = validateOptimizerRequest(payload);
      if (violation) return res.status(400).json(violation);

      const result = runOptimizer(payload);
      const inputs = payload.inputs || payload;
      const operatorLabel = result.operator_label || 'Operator';

      const wb = new ExcelJS.Workbook();
      wb.creator = 'Octave Sales Rate Optimizer';
      wb.created = new Date();

      // ── Summary sheet ────────────────────────────────────────────────
      const summary = wb.addWorksheet('Summary');
      summary.columns = [{ width: 38 }, { width: 22 }, { width: 38 }, { width: 22 }];

      summary.mergeCells('A1:D1');
      const titleCell = summary.getCell('A1');
      titleCell.value = `Octave Sales Rate Optimizer — ${operatorLabel}`;
      titleCell.font = { bold: true, size: 16, color: { argb: WHITE }, name: 'Arial' };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLACK } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      summary.getRow(1).height = 28;

      summary.getCell('A2').value = 'Generated';
      summary.getCell('B2').value = new Date().toISOString();
      summary.getCell('C2').value = 'Cost Mode';
      summary.getCell('D2').value = result.cost_mode;
      [summary.getCell('A2'), summary.getCell('C2')].forEach(setSubHeader);

      const kpis = [
        ['Total Sold (MT)', result.summary.total_sold_mt.toFixed(0)],
        ['Final Market Share (%)', result.summary.final_market_share_pct.toFixed(1)],
        ['Peak Tank Fill (%)', result.summary.peak_tank_fill_pct.toFixed(1)],
        ['Total Evacuated (MT)', result.summary.total_evacuated_mt.toFixed(0)],
        ['Total Evacuation Cost (USD)', result.summary.total_evacuation_cost_usd.toFixed(2)],
        ['Priced Sold (MT)', result.summary.priced_sold_mt.toFixed(0)],
        ['Unpriced Sold (MT)', result.summary.unpriced_sold_mt.toFixed(0)],
        ['Avg SFS Share (%)', result.summary.avg_sfs_share_pct.toFixed(1)],
        ['Cost Edge Opening ($/MT)', (result.cost_advantage_opening ?? 0).toFixed(1)],
        ['Cost Edge Avg ($/MT)', (result.cost_advantage_avg ?? 0).toFixed(1)],
        ['FAST Days', result.fast_days ?? '—'],
        ['HOLD Days', result.hold_days ?? '—'],
        ['DP Iterations', result.dp_iterations],
      ];

      let r = 4;
      summary.mergeCells(`A${r}:D${r}`);
      const kpiHead = summary.getCell(`A${r}`);
      kpiHead.value = 'Summary KPIs';
      setHeader(kpiHead);
      r++;
      for (const [label, value] of kpis) {
        setKpiLabel(summary.getCell(`A${r}`));
        summary.getCell(`A${r}`).value = label;
        setKpiValue(summary.getCell(`B${r}`));
        summary.getCell(`B${r}`).value = value;
        r++;
      }

      r += 1;
      summary.mergeCells(`A${r}:D${r}`);
      const inHead = summary.getCell(`A${r}`);
      inHead.value = 'Input Parameters';
      setHeader(inHead);
      r++;
      const inputRows = [
        ['Plan Start Date', inputs.plan_start_date],
        ['Working Days', inputs.num_planning_days],
        [`${operatorLabel} Physical Stock (MT)`, inputs.operator_physical_stock],
        [`${operatorLabel} Tank Limit (MT)`, inputs.operator_tank_limit],
        [`${operatorLabel} Priced SFS (MT)`, inputs.operator_priced_sfs],
        [`${operatorLabel} Unpriced SFS (MT)`, inputs.operator_unpriced_sfs],
        [`${operatorLabel} Priced Cost ($/MT)`, inputs.operator_priced_cost],
        [`${operatorLabel} Unpriced Cost ($/MT)`, inputs.operator_unpriced_cost],
        ['Competitor Physical Stock (MT)', inputs.comp_physical_stock],
        ['Competitor Tank Limit (MT)', inputs.comp_tank_limit],
        ['Competitor Priced SFS (MT)', inputs.comp_priced_sfs],
        ['Competitor Unpriced SFS (MT)', inputs.comp_unpriced_sfs],
        ['Competitor Priced Cost ($/MT)', inputs.comp_priced_cost],
        ['Competitor Unpriced Cost ($/MT)', inputs.comp_unpriced_cost],
        [`${operatorLabel} Demand/day (MT)`, inputs.operator_daily_demand],
        ['Competitor Demand/day (MT)', inputs.comp_daily_demand],
        ['Monthly Min Share (%)', inputs.monthly_min_share_pct],
        ['Weekly Max Share (%)', inputs.weekly_max_share_pct],
        ['Daily Max Sell (MT)', inputs.daily_max_sell_mt],
        ['Locked Day-1 Sell (MT)', inputs.locked_sell_day1_mt],
        ['Evacuation Cost ($/MT)', inputs.evac_cost_per_mt],
        ['λ (Cost Sensitivity)', inputs.lambda_cost],
        ['γ (Future Discount)', inputs.gamma_discount],
      ];
      for (const [label, value] of inputRows) {
        summary.getCell(`A${r}`).value = label;
        summary.getCell(`B${r}`).value = value;
        r++;
      }

      r += 1;
      summary.mergeCells(`A${r}:D${r}`);
      const ruleHead = summary.getCell(`A${r}`);
      ruleHead.value = 'Model Rules Applied';
      setHeader(ruleHead);
      r++;
      for (const [key, value] of Object.entries(result.rules_applied)) {
        summary.getCell(`A${r}`).value = key;
        summary.getCell(`B${r}`).value = value;
        r++;
      }

      // ── Daily Plan sheet ─────────────────────────────────────────────
      const daily = wb.addWorksheet('Daily Plan');
      const dailyCols = [
        { header: 'Day', key: 'day_number', width: 6 },
        { header: 'Date', key: 'date', width: 12 },
        { header: 'Week', key: 'week_label', width: 6 },
        { header: 'Weekday', key: 'weekday', width: 8 },
        { header: 'Mode', key: 'mode', width: 8 },
        { header: 'Sell MT', key: 'sell_quantity', width: 10 },
        { header: 'Priced MT', key: 'sold_priced', width: 10 },
        { header: 'Unpriced MT', key: 'sold_unpriced', width: 12 },
        { header: 'SFS Priced Rem', key: 'sfs_priced_remaining', width: 14 },
        { header: 'SFS Unpriced Rem', key: 'sfs_unpriced_remaining', width: 16 },
        { header: 'SFS Total Rem', key: 'sfs_remaining', width: 14 },
        { header: 'SFS Share %', key: 'sfs_share', width: 12 },
        { header: `${operatorLabel} Phys MT`, key: 'operator_physical_stock', width: 14 },
        { header: 'Comp Phys MT', key: 'comp_physical_stock', width: 14 },
        { header: 'Fill %', key: 'fill_percentage', width: 10 },
        { header: 'Borrowed MT', key: 'borrowed_quantity', width: 12 },
        { header: 'Evacuated MT', key: 'evacuated_quantity', width: 12 },
        { header: 'Evac Cost $', key: 'evacuation_cost', width: 12 },
        { header: 'Daily Share %', key: 'daily_market_share', width: 12 },
        { header: 'Cum Share %', key: 'cumulative_market_share', width: 12 },
        { header: 'Comp Sell MT', key: 'comp_sell_quantity', width: 12 },
        { header: 'Cost Adv $/MT', key: 'cost_advantage', width: 12 },
        { header: 'Status', key: 'status', width: 10 },
      ];
      daily.columns = dailyCols;
      daily.getRow(1).eachCell((cell) => setHeader(cell));
      for (const row of result.daily) {
        daily.addRow({
          ...row,
          sfs_share: +(row.sfs_share * 100).toFixed(2),
          fill_percentage: +(row.fill_percentage * 100).toFixed(2),
          daily_market_share: +(row.daily_market_share * 100).toFixed(2),
          cumulative_market_share: +(row.cumulative_market_share * 100).toFixed(2),
        });
      }

      // ── Weekly sheet ─────────────────────────────────────────────────
      const weekly = wb.addWorksheet('Weekly');
      weekly.columns = [
        { header: 'Week', key: 'week_label', width: 8 },
        { header: 'Days', key: 'day_range', width: 10 },
        { header: 'Sales MT', key: 'sales_mt', width: 12 },
        { header: 'Priced MT', key: 'priced_mt', width: 12 },
        { header: 'Unpriced MT', key: 'unpriced_mt', width: 12 },
        { header: 'Comp Sales MT', key: 'comp_sales_mt', width: 14 },
        { header: 'Week Share %', key: 'week_share_pct', width: 14 },
        { header: 'Avg Fill %', key: 'avg_fill_pct', width: 12 },
        { header: 'Evacuated MT', key: 'evacuated_mt', width: 14 },
      ];
      weekly.getRow(1).eachCell((cell) => setHeader(cell));
      for (const row of result.weekly) weekly.addRow(row);

      // ── Warnings sheet (only if any) ─────────────────────────────────
      if (result.warnings && result.warnings.length > 0) {
        const warns = wb.addWorksheet('Warnings');
        warns.columns = [
          { header: '#', key: 'idx', width: 6 },
          { header: 'Warning', key: 'msg', width: 110 },
        ];
        warns.getRow(1).eachCell((cell) => setHeader(cell));
        result.warnings.forEach((msg, i) => warns.addRow({ idx: i + 1, msg }));
      }

      const buf = await wb.xlsx.writeBuffer();
      const stamp = new Date().toISOString().slice(0, 10);
      res
        .setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        .setHeader('Content-Disposition', `attachment; filename=sales_rate_plan_${stamp}.xlsx`)
        .send(Buffer.from(buf));
    } catch (e) {
      console.error('XLSX export error:', e);
      res.status(500).json({ field: 'server', message: e.message || 'Export failed.' });
    }
  });

  return router;
}
