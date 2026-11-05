import React from 'react';
import { TrendDayPoint } from '../../services/analyticsCalculator';

export interface Trend7DayChartProps {
  points: TrendDayPoint[];
}

export const Trend7DayChart: React.FC<Trend7DayChartProps> = ({ points }) => {
  if (points.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs font-sans">
        ไม่มีข้อมูลประวัติ 7 วันย้อนหลัง
      </div>
    );
  }

  const maxVal = Math.max(...points.map((p) => p.totalDistanceKm), 10);
  const chartWidth = 500;
  const chartHeight = 180;
  const paddingX = 40;
  const paddingTop = 25;
  const paddingBottom = 30;

  const innerWidth = chartWidth - paddingX * 2;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  const coords = points.map((p, idx) => {
    const x = paddingX + (idx / Math.max(points.length - 1, 1)) * innerWidth;
    const y = paddingTop + innerHeight - (p.totalDistanceKm / maxVal) * innerHeight;
    return { x, y, p };
  });

  // Construct SVG Area and Line path
  const linePath = coords.reduce(
    (acc, curr, idx) => (idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`),
    ''
  );

  const areaPath = `
    ${linePath}
    L ${coords[coords.length - 1].x} ${paddingTop + innerHeight}
    L ${coords[0].x} ${paddingTop + innerHeight}
    Z
  `;

  return (
    <div className="w-full overflow-hidden py-1">
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 mb-2 font-sans">
        <span>ปริมาณระยะทางสะสมของกองรถ (กม./วัน)</span>
        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
          สูงสุด: {maxVal.toFixed(1)} km
        </span>
      </div>

      <div className="w-full">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto overflow-visible select-none"
        >
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Gridlines */}
          {[0, 0.5, 1].map((pct, idx) => {
            const y = paddingTop + innerHeight * (1 - pct);
            return (
              <g key={idx}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={chartWidth - paddingX}
                  y2={y}
                  stroke="currentColor"
                  strokeDasharray="4 4"
                  className="text-slate-200 dark:text-slate-800"
                  strokeWidth="1"
                />
                <text
                  x={paddingX - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="text-[9px] font-mono fill-slate-400 dark:fill-slate-500"
                >
                  {Math.round(maxVal * pct)}k
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          <path d={areaPath} fill="url(#areaGradient)" />

          {/* Line stroke */}
          <path
            d={linePath}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points */}
          {coords.map(({ x, y, p }, idx) => (
            <g key={idx} className="group">
              <circle
                cx={x}
                cy={y}
                r={p.isToday ? 5 : 3.5}
                className={
                  p.isToday
                    ? 'fill-emerald-500 stroke-white dark:stroke-slate-900 stroke-2'
                    : 'fill-white dark:fill-slate-900 stroke-emerald-500 stroke-2'
                }
              />
              <text
                x={x}
                y={y - 8}
                textAnchor="middle"
                className="text-[9px] font-mono font-bold fill-slate-700 dark:fill-slate-200"
              >
                {p.totalDistanceKm > 0 ? p.totalDistanceKm.toFixed(0) : ''}
              </text>
              <text
                x={x}
                y={chartHeight - 8}
                textAnchor="middle"
                className={`text-[10px] font-sans ${
                  p.isToday
                    ? 'font-bold fill-emerald-600 dark:fill-emerald-400'
                    : 'fill-slate-500 dark:fill-slate-400'
                }`}
              >
                {p.dayLabel}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
};
