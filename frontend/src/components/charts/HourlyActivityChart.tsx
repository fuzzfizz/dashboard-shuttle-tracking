import React from 'react';
import { HourlyActivityPoint } from '../../services/analyticsCalculator';

export interface HourlyActivityChartProps {
  hours: HourlyActivityPoint[];
  selectedVehicleId?: string;
  vehicleLabel?: string;
}

export const HourlyActivityChart: React.FC<HourlyActivityChartProps> = ({
  hours,
  selectedVehicleId,
  vehicleLabel,
}) => {
  if (hours.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs font-sans">
        ไม่มีข้อมูลความหนาแน่นรายชั่วโมง
      </div>
    );
  }

  const maxDist = Math.max(...hours.map((h) => h.distanceKm), 1);
  const chartWidth = 500;
  const chartHeight = 180;
  const paddingX = 40;
  const paddingTop = 25;
  const paddingBottom = 30;

  const innerWidth = chartWidth - paddingX * 2;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  const coords = hours.map((h, idx) => {
    const x = paddingX + (idx / Math.max(hours.length - 1, 1)) * innerWidth;
    const y = paddingTop + innerHeight - (h.distanceKm / maxDist) * innerHeight;
    return { x, y, h };
  });

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

  const isVehicleSpecific = Boolean(selectedVehicleId && selectedVehicleId !== 'all');
  const subtitleLabel = isVehicleSpecific
    ? `แสดงความหนาแน่นการวิ่งของ ${vehicleLabel || selectedVehicleId}`
    : 'แสดงความหนาแน่นการวิ่งตลอดวัน';

  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);
  const svgRef = React.useRef<SVGSVGElement | null>(null);

  const handlePointerMove = (
    e: React.PointerEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>
  ) => {
    if (!svgRef.current || coords.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX =
      typeof (e as any).clientX === 'number'
        ? (e as any).clientX
        : (e as any).touches?.[0]?.clientX ?? 0;
    const width = rect.width > 0 ? rect.width : chartWidth;
    const left = rect.width > 0 ? rect.left : 0;
    const svgX = ((clientX - left) / width) * chartWidth;

    let closest = 0;
    let minDist = Infinity;
    coords.forEach((c, idx) => {
      const d = Math.abs(c.x - svgX);
      if (d < minDist) {
        minDist = d;
        closest = idx;
      }
    });
    setHoveredIdx(closest);
  };

  const handlePointerLeave = () => {
    setHoveredIdx(null);
  };

  const activeCoord =
    hoveredIdx !== null && hoveredIdx >= 0 && hoveredIdx < coords.length
      ? coords[hoveredIdx]
      : null;

  return (
    <div className="w-full overflow-hidden py-1">
      {/* Header Info */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 mb-2 font-sans">
        <span>{subtitleLabel}</span>
        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
          สูงสุด: {maxDist.toFixed(1)} km
        </span>
      </div>

      <div className="w-full relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto overflow-visible select-none cursor-crosshair touch-none"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerLeave}
          onTouchCancel={handlePointerLeave}
        >
          <defs>
            <linearGradient id="hourlyAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.38" />
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
                  {(maxDist * pct).toFixed(1)}k
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          <path d={areaPath} fill="url(#hourlyAreaGradient)" />

          {/* Line stroke */}
          <path
            d={linePath}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points and Labels */}
          {coords.map(({ x, y, h }, idx) => {
            // Show hour labels for every other hour or key points to avoid overlap
            const shouldShowLabel = hours.length <= 8 || idx % 2 === 0 || idx === coords.length - 1;

            return (
              <g key={h.hour}>
                <circle
                  cx={x}
                  cy={y}
                  r={3}
                  aria-label={`${h.hourLabel}: ${h.distanceKm.toFixed(1)} km`}
                  className="fill-white dark:fill-slate-900 stroke-emerald-500 stroke-2"
                />
                {shouldShowLabel && (
                  <text
                    x={x}
                    y={chartHeight - 8}
                    textAnchor="middle"
                    className="text-[9px] font-mono fill-slate-400 dark:fill-slate-500"
                  >
                    {h.hourLabel}
                  </text>
                )}
              </g>
            );
          })}

          {/* Guideline when hovering */}
          {activeCoord && (
            <line
              data-testid="hourly-guideline"
              x1={activeCoord.x}
              y1={paddingTop - 4}
              x2={activeCoord.x}
              y2={paddingTop + innerHeight}
              stroke="currentColor"
              strokeDasharray="3 3"
              className="text-slate-400 dark:text-slate-500 pointer-events-none"
              strokeWidth="1.5"
              aria-hidden="true"
            />
          )}

          {/* Active Point Halo */}
          {activeCoord && (
            <g className="pointer-events-none" aria-hidden="true">
              <circle
                cx={activeCoord.x}
                cy={activeCoord.y}
                r={9}
                className="fill-emerald-500/20 stroke-emerald-500/40"
                strokeWidth="1.5"
              />
              <circle
                cx={activeCoord.x}
                cy={activeCoord.y}
                r={5.5}
                className="fill-emerald-500 stroke-white dark:stroke-slate-900 stroke-2"
              />
            </g>
          )}
        </svg>

        {/* Floating Tooltip Card */}
        {activeCoord && (
          <div
            data-testid="hourly-tooltip"
            role="tooltip"
            style={{
              left: `${(activeCoord.x / chartWidth) * 100}%`,
              top: `${Math.max(10, (activeCoord.y / chartHeight) * 100 - 18)}%`,
              transform: 'translate(-50%, -100%)',
            }}
            className="absolute pointer-events-none z-30 flex flex-col items-center bg-slate-900/95 dark:bg-slate-950/95 text-white border border-slate-700/60 rounded-xl px-3 py-1.5 shadow-xl transition-transform duration-75 backdrop-blur-xs min-w-[95px]"
          >
            <div className="flex items-center gap-1.5 text-[10px] text-slate-300 font-sans">
              <span>⏰</span>
              <span>{activeCoord.h.hourLabel} น.</span>
            </div>
            <div className="text-sm font-bold font-mono text-emerald-400 mt-0.5">
              {activeCoord.h.distanceKm.toFixed(1)} <span className="text-[10px] font-normal text-slate-300">km</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
