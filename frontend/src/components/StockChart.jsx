import { Chart, registerables } from 'chart.js';
import { Line } from 'react-chartjs-2';

Chart.register(...registerables);

const TURQUOISE = '#26EA9F';
const NEUTRAL_700 = '#3A3A3A';
const NEUTRAL_500 = '#7A7A7A';
const NEUTRAL_100 = '#F4F4F4';
const WARN = '#C77800';

export default function StockChart({ result, operatorLabel = 'Operator' }) {
  const daily = result.daily;
  const labels = daily.map((r) => `D${r.day_number}`);

  const data = {
    labels,
    datasets: [
      {
        label: `${operatorLabel} Physical (MT)`,
        data: daily.map((r) => r.operator_physical_stock),
        borderColor: NEUTRAL_700,
        backgroundColor: NEUTRAL_700,
        borderWidth: 2,
        pointRadius: 2,
        fill: false,
        yAxisID: 'y',
      },
      {
        label: `${operatorLabel} SFS Rem (MT)`,
        data: daily.map((r) => r.sfs_remaining),
        borderColor: TURQUOISE,
        backgroundColor: TURQUOISE,
        borderWidth: 2,
        pointRadius: 2,
        fill: false,
        yAxisID: 'y',
      },
      {
        label: 'Fill %',
        data: daily.map((r) => +(r.fill_percentage * 100).toFixed(2)),
        borderColor: WARN,
        backgroundColor: WARN,
        borderWidth: 1.5,
        pointRadius: 2,
        borderDash: [4, 4],
        fill: false,
        yAxisID: 'y2',
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
        title: { display: true, text: 'Fill %', color: NEUTRAL_500, font: { size: 10 } },
      },
    },
  };

  return (
    <div className="chart-container">
      <Line data={data} options={options} />
    </div>
  );
}
