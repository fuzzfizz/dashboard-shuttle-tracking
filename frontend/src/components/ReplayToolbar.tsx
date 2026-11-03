import React from 'react';
import { Calendar, Bus, RefreshCw, Route, MapPin } from 'lucide-react';
import { HistoricalTripSummary } from '../types/historical';
import { getBangkokDate } from '../hooks/useDailyMetrics';

interface ReplayToolbarProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  selectedVehicleId: string;
  onVehicleChange: (id: string) => void;
  vehicleList: Array<{ id: string; name: string }>;
  summary: HistoricalTripSummary;
  isLoading: boolean;
  onRefresh: () => void;
}

export const ReplayToolbar: React.FC<ReplayToolbarProps> = ({
  selectedDate,
  onDateChange,
  selectedVehicleId,
  onVehicleChange,
  vehicleList,
  summary,
  isLoading,
  onRefresh,
}) => {
  const maxDate = getBangkokDate();

  return (
    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3 py-2.5 sm:px-4 sm:py-3 z-10 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3">
        {/* Left: Selectors (Date & Vehicle) & Refresh Button */}
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {/* Date Picker */}
          <div className="flex-1 sm:flex-none flex items-center gap-2 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl px-2.5 sm:px-3 py-2 sm:py-1.5 shadow-sm min-h-[42px] sm:min-h-0">
            <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              max={maxDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="bg-transparent text-sm font-medium text-slate-800 dark:text-slate-100 outline-none cursor-pointer w-full"
              aria-label="Select Date"
            />
          </div>

          {/* Vehicle Dropdown */}
          <div className="flex-1 sm:flex-none flex items-center gap-2 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl px-2.5 sm:px-3 py-2 sm:py-1.5 shadow-sm min-h-[42px] sm:min-h-0">
            <Bus className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <select
              value={selectedVehicleId}
              onChange={(e) => onVehicleChange(e.target.value)}
              className="bg-transparent text-sm font-medium text-slate-800 dark:text-slate-100 outline-none cursor-pointer pr-2 w-full"
              aria-label="Select Vehicle"
            >
              {vehicleList.map((v) => (
                <option
                  key={v.id}
                  value={v.id}
                  className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                >
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh Button on Mobile / Desktop */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            aria-label="รีเฟรชข้อมูล"
            title="รีเฟรชข้อมูล"
            className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-medium transition-all shadow-sm disabled:opacity-50 min-h-[42px] min-w-[42px] shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-500' : ''}`} />
            <span className="hidden sm:inline">รีเฟรช</span>
          </button>
        </div>

        {/* Right: Summary Badge */}
        <div className="flex items-center justify-between sm:justify-start gap-2 px-3 py-2 sm:py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-xs text-emerald-700 dark:text-emerald-300 font-medium w-full sm:w-auto shadow-xs">
          <div className="flex items-center gap-1.5">
            <Route className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              ระยะทาง: <strong className="font-semibold font-mono">{(summary?.total_distance_km ?? 0).toFixed(1)} กม.</strong>
            </span>
          </div>
          <span className="text-emerald-300 dark:text-emerald-700">|</span>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-mono">{(summary?.total_points ?? 0).toLocaleString()} จุด</span>
          </div>
        </div>
      </div>
    </div>
  );
};
