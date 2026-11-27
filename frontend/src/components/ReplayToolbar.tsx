import React, { useState, useRef, useEffect } from 'react';
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
  Check,
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
  const [isVehicleMenuOpen, setIsVehicleMenuOpen] = useState(false);
  const vehicleMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (vehicleMenuRef.current && !vehicleMenuRef.current.contains(e.target as Node)) {
        setIsVehicleMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedVehicleObj = vehicleList.find((v) => v.id === selectedVehicleId);
  const selectedVehicleName = selectedVehicleObj?.name || selectedVehicleId || 'เลือกรถ';
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

          {/* Custom Vehicle Dropdown matching DailyDistanceTable */}
          <div ref={vehicleMenuRef} className="relative flex-1 sm:flex-none min-w-0">
            {/* Native select for accessibility & automated tests */}
            <select
              value={selectedVehicleId}
              onChange={(e) => onVehicleChange(e.target.value)}
              className="sr-only"
              tabIndex={-1}
              aria-label="Select Vehicle"
            >
              {vehicleList.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>

            {/* Custom Styled Trigger Button */}
            <button
              type="button"
              onClick={() => setIsVehicleMenuOpen(!isVehicleMenuOpen)}
              aria-expanded={isVehicleMenuOpen}
              className="w-full sm:w-auto flex items-center justify-between gap-2.5 px-3 py-2 sm:py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 hover:text-slate-900 border border-slate-200/90 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-200 dark:hover:text-white dark:border-slate-700/80 text-xs sm:text-sm font-semibold transition-all shadow-xs hover:border-slate-300 dark:hover:border-slate-600 min-h-[42px] sm:min-h-0 min-w-0 cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Bus className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">{selectedVehicleName}</span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
                  isVehicleMenuOpen ? 'rotate-180 text-emerald-500' : ''
                }`}
              />
            </button>

            {/* Custom Dropdown Menu matching DailyDistanceTable */}
            {isVehicleMenuOpen && (
              <div className="absolute right-0 sm:right-auto sm:left-0 mt-2 w-64 max-w-[calc(100vw-3rem)] bg-white/98 dark:bg-slate-900/98 backdrop-blur-xl border border-slate-200/90 dark:border-slate-700/80 rounded-2xl shadow-2xl p-1.5 z-[60] animate-in fade-in zoom-in-95 duration-100 max-h-72 overflow-y-auto">
                <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">
                  เลือกรถ
                </div>
                {vehicleList.map((v) => {
                  const isSelected = selectedVehicleId === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        onVehicleChange(v.id);
                        setIsVehicleMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-left transition-colors min-h-[40px] sm:min-h-0 cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold border border-emerald-200/60 dark:border-emerald-800/50'
                          : 'text-slate-700 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Bus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>{v.name}</span>
                      </div>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
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
