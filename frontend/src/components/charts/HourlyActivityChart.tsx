import React from 'react';
import { HourlyActivityPoint } from '../../services/analyticsCalculator';

export interface HourlyActivityChartProps {
  hours: HourlyActivityPoint[];
}

export const HourlyActivityChart: React.FC<HourlyActivityChartProps> = ({ hours }) => {
  if (hours.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs font-sans">
        ไม่มีข้อมูลความหนาแน่นรายชั่วโมง
      </div>
    );
  }

  const maxDist = Math.max(...hours.map((h) => h.distanceKm), 1);

  return (
    <div className="space-y-3 py-1">
      {/* Peak Info Header */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 gap-2 font-sans">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span>ช่วงเร่งด่วนเช้า (07:00–09:00) และเย็น (16:00–18:00)</span>
        </span>
        <span className="text-[11px] font-medium text-slate-400">
          แสดงความหนาแน่นการวิ่งตลอดวัน
        </span>
      </div>

      {/* Hourly Vertical Bars */}
      <div className="grid grid-cols-8 xs:grid-cols-15 gap-1.5 items-end h-36 pt-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        {hours.map((h) => {
          const heightPct = Math.max(12, Math.round((h.distanceKm / maxDist) * 100));

          return (
            <div
              key={h.hour}
              className="flex flex-col items-center justify-end h-full group relative"
              title={`${h.hourLabel}: ~${h.distanceKm.toFixed(1)} km`}
            >
              {/* Tooltip on Hover */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-7 z-20 pointer-events-none bg-slate-900 text-white text-[9px] font-mono px-1.5 py-0.5 rounded shadow whitespace-nowrap">
                {h.distanceKm.toFixed(1)} km
              </div>

              {/* Bar Column */}
              <div
                style={{ height: `${heightPct}%` }}
                className={`w-full max-w-[20px] rounded-t-md transition-all duration-300 ${
                  h.isPeak
                    ? 'bg-gradient-to-t from-amber-500 to-amber-400 shadow-sm'
                    : 'bg-emerald-500/80 hover:bg-emerald-500 dark:bg-emerald-600/70'
                }`}
              />

              {/* Hour X Label */}
              <span
                className={`text-[9px] font-mono mt-1 ${
                  h.isPeak
                    ? 'font-bold text-amber-600 dark:text-amber-400'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {h.hourLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
