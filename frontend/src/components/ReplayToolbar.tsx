import React from 'react';
import {
  Calendar,
  Bus,
  RefreshCw,
  Route,
  MapPin,
  Gauge,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { HistoricalTripSummary } from '../types/historical';
import {
  getBangkokDate,
  getBangkokMinRetentionDate,
  shiftBangkokDate,
} from '../services/historicalDateUtils';

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
  const minDate = getBangkokMinRetentionDate(14);
  const maxDate = getBangkokDate();

  return (
    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3 py-2.5 sm:px-4 sm:py-3 md:px-6 lg:px-8 z-10 transition-colors">
      <div className="w-full flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5 sm:gap-3">
        {/* Left: Selectors (Date & Vehicle) & Refresh Button */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto">
          {/* Date Picker with Prev/Next Steppers */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-1 sm:flex-none">
            <button
              type="button"
              aria-label="วันก่อนหน้า"
              title="วันก่อนหน้า"
              disabled={selectedDate <= minDate}
              onClick={() => onDateChange(shiftBangkokDate(selectedDate, -1, minDate, maxDate))}
              className="p-2 sm:p-1.5 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-800/90 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700/80 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-all shrink-0 min-h-[42px] min-w-[36px] flex items-center justify-center cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex-1 sm:flex-none flex items-center gap-2 bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 rounded-xl px-2.5 sm:px-3 py-2 sm:py-1.5 shadow-xs min-h-[42px] sm:min-h-0 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
              <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <input
                type="date"
                value={selectedDate}
                min={minDate}
                max={maxDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="bg-transparent text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 outline-none cursor-pointer w-full"
                aria-label="Select Date"
              />
            </div>

            <button
              type="button"
              aria-label="วันถัดไป"
              title="วันถัดไป"
              disabled={selectedDate >= maxDate}
              onClick={() => onDateChange(shiftBangkokDate(selectedDate, 1, minDate, maxDate))}
              className="p-2 sm:p-1.5 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-800/90 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700/80 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-all shrink-0 min-h-[42px] min-w-[36px] flex items-center justify-center cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <span className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap hidden sm:inline">
            บันทึกย้อนหลัง 14 วัน
          </span>

          {/* Vehicle Dropdown */}
          <div className="relative flex-1 sm:flex-none flex items-center bg-white dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 rounded-xl px-3 py-2 sm:py-1.5 shadow-xs transition-colors min-h-[42px] sm:min-h-0 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500">
            <Bus className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mr-2 pointer-events-none" />
            <select
              value={selectedVehicleId}
              onChange={(e) => onVehicleChange(e.target.value)}
              className="appearance-none bg-transparent text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 outline-none cursor-pointer pr-6 w-full"
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
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-3 shrink-0" />
          </div>

          {/* Refresh Button on Mobile / Desktop */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            aria-label="รีเฟรชข้อมูล"
            title="รีเฟรชข้อมูล"
            className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-800/90 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700/80 text-xs font-semibold transition-all shadow-xs disabled:opacity-50 min-h-[42px] min-w-[42px] shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-500' : ''}`} />
            <span className="hidden sm:inline">รีเฟรช</span>
          </button>
        </div>

        {/* Right: Summary Badge */}
        <div className="flex items-center justify-between sm:justify-start gap-2.5 px-3 py-2 sm:py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-xs text-emerald-700 dark:text-emerald-300 font-medium w-full lg:w-auto shadow-xs flex-wrap">
          <div className="flex items-center gap-1.5">
            <Route className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              ระยะทาง: <strong className="font-semibold font-mono">{(summary?.total_distance_km ?? 0).toFixed(1)} กม.</strong>
            </span>
          </div>
          <span className="text-emerald-300 dark:text-emerald-700 hidden sm:inline">|</span>
          <div className="flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              ความเร็วสูงสุด: <strong className="font-semibold font-mono">{(summary?.max_speed_kmh ?? 0).toFixed(1)} กม./ชม.</strong>
            </span>
          </div>
          <span className="text-emerald-300 dark:text-emerald-700 hidden sm:inline">|</span>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-mono">{(summary?.total_points ?? 0).toLocaleString()} จุด</span>
          </div>
        </div>
      </div>
    </div>
  );
};
