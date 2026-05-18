import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { Bar } from 'react-chartjs-2';

Chart.register(...registerables);

const TURQUOISE = '#26EA9F';
const NEUTRAL_700 = '#3A3A3A';
const NEUTRAL_500 = '#7A7A7A';
const NEUTRAL_300 = '#CFCFCF';
const NEUTRAL_100 = '#F4F4F4';

export default function MainChart({ result, operatorLabel = 'Operator' }) {
  const ref = useRef(null);
  const daily = result.daily;

  const labels = daily.map((r) => `D${r.day_number}`);

  const data = {
    labels,
    datasets: [
      {
        type: 'bar',
        label: `${operatorLabel} Sell (MT)`,
        data: daily.map((r) => r.sell_quantity),
        backgroundColor: TURQUOISE,
        borderRadius: 2,
        yAxisID: 'y',
        order: 2,
      },
      {
        type: 'bar',
        label: 'Competitor Sell (MT)',
        data: daily.map((r) => r.comp_sell_quantity),
        backgroundColor: NEUTRAL_700,
        borderRadius: 2,
        yAxisID: 'y',
        order: 3,
      },
      {
        type: 'line',
        label: 'Cum Share %',
        data: daily.map((r) => +(r.cumulative_market_share * 100).toFixed(2)),
        borderColor: TURQUOISE,
        borderWidth: 2,
        pointRadius: 2,
        pointBackgroundColor: TURQUOISE,
        fill: false,
        yAxisID: 'y2',
        order: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        labels: {
          color: NEUTRAL_500,
          font: { family: 'Lato, sans-serif', size: 11 },
          boxWidth: 14,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: NEUTRAL_500, font: { size: 10 } },
        grid: { color: NEUTRAL_100 },
      },
      y: {
        position: 'left',
        ticks: { color: NEUTRAL_500, font: { size: 10 } },
        grid: { color: NEUTRAL_100 },
        title: { display: true, text: 'MT', color: NEUTRAL_500, font: { size: 10 } },
      },
      y2: {
        position: 'right',
        min: 0,
        max: 100,
        ticks: { color: NEUTRAL_500, font: { size: 10 } },
        grid: { display: false },
        title: { display: true, text: 'Share %', color: NEUTRAL_500, font: { size: 10 } },
      },
    },
  };

  return (
    <div className="chart-container">
      <Bar ref={ref} data={data} options={options} />
    </div>
  );
}
