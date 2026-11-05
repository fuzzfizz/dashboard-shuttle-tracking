import React from 'react';
import { Bus } from 'lucide-react';
import { VehicleComparisonItem } from '../../services/analyticsCalculator';

export interface VehicleComparisonChartProps {
  items: VehicleComparisonItem[];
  avgDistanceKm: number;
}

export const VehicleComparisonChart: React.FC<VehicleComparisonChartProps> = ({
  items,
  avgDistanceKm,
}) => {
  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs font-sans">
        ยังไม่มีข้อมูลระยะทางของรถในระบบ
      </div>
    );
  }

  const maxKm = Math.max(...items.map((i) => i.distanceKm), avgDistanceKm, 1);
  const avgPercentage = Math.min(100, (avgDistanceKm / maxKm) * 100);

  return (
    <div className="space-y-3.5 py-1">
      {/* Benchmark Legend */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 font-sans">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
          <span>ระยะทางรถแต่ละคัน (กม.)</span>
        </span>
        <span className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
          <span className="w-3 border-b-2 border-dashed border-amber-500 inline-block" />
          <span>ค่าเฉลี่ยฟลีต ({avgDistanceKm.toFixed(1)} km)</span>
        </span>
      </div>

      {/* Horizontal Bar Chart Container */}
      <div className="relative space-y-3 pt-2">
        {/* Fleet Average Vertical Line Overlay */}
        {avgDistanceKm > 0 && (
          <div
            style={{ left: `calc(72px + (100% - 150px) * ${avgPercentage / 100})` }}
            className="absolute top-0 bottom-0 z-10 pointer-events-none hidden xs:block border-l-2 border-dashed border-amber-400/80 dark:border-amber-400/60"
            title={`ค่าเฉลี่ยฟลีต: ${avgDistanceKm.toFixed(1)} km`}
          />
        )}

        {items.map((item) => (
          <div key={item.vehicleId} className="flex items-center gap-3 group">
            {/* Vehicle Badge */}
            <div className="w-20 shrink-0 flex items-center gap-1.5">
              <Bus className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
              <span className="font-mono font-bold text-xs text-slate-700 dark:text-slate-200 truncate">
                {item.vehicleId}
              </span>
            </div>

            {/* Bar Track */}
            <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-4 overflow-hidden relative p-0.5">
              <div
                style={{ width: `${Math.max(item.percentageOfMax, 3)}%` }}
                className={`h-full rounded-full transition-all duration-500 ${
                  item.distanceKm >= avgDistanceKm
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm'
                    : 'bg-gradient-to-r from-slate-400 to-slate-500 dark:from-slate-600 dark:to-slate-500'
                }`}
              />
            </div>

            {/* Value Label */}
            <div className="w-16 shrink-0 text-right font-mono font-bold text-xs text-slate-800 dark:text-slate-100">
              {item.distanceKm.toFixed(1)} km
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
