import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Route, ArrowUpDown, Maximize2, Search, X, Filter, ChevronDown } from 'lucide-react';
import { DailyMetricsMap } from '../types/metrics';
import { FleetMap } from '../types/telemetry';
import { OFFLINE_THRESHOLD_MS } from '../services/fleetStatus';
import { formatLastSeen } from '../services/historicalDateUtils';

export type SortMode = 'distance-desc' | 'id-asc';
export type StatusFilter = 'all' | 'online' | 'offline';
export type DistanceUnit = 'km' | 'mile';

export const KM_TO_MILES = 0.621371192;

export const convertDistance = (distanceKm: number, unit: DistanceUnit): number => {
  return unit === 'mile' ? distanceKm * KM_TO_MILES : distanceKm;
};

export const formatDistance = (distanceKm: number, unit: DistanceUnit): string => {
  const converted = convertDistance(distanceKm, unit);
  return `${converted.toFixed(2)} ${unit}`;
};

export interface DailyDistanceTableProps {
  dailyMetrics: DailyMetricsMap;
  vehicles: FleetMap;
  lastSeenMap: Record<string, number>;
  selectedVehicleId: string | null;
  onOpenVehicleMap: (vehicleId: string) => void;
  now?: number;
  className?: string;
  distanceUnit?: DistanceUnit;
  onDistanceUnitChange?: (unit: DistanceUnit) => void;
}

export interface LicensePlateBadgeProps {
  plateNumber: string;
  isSelected?: boolean;
  className?: string;
}

/**
 * LicensePlateBadge renders an authentic vehicle license plate frame
 * with white enamel surface, 2px stamped metal border, and mounting rivets.
 */
export const LicensePlateBadge: React.FC<LicensePlateBadgeProps> = ({
  plateNumber,
  isSelected = false,
  className = '',
}) => {
  return (
    <div
      data-testid="license-plate-badge"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-white border-2 transition-all select-none shadow-xs ${
        isSelected
          ? 'border-[#4a7c0b] ring-2 ring-[#5c990e]/35 shadow-sm'
          : 'border-slate-800 dark:border-slate-700 hover:border-slate-900 dark:hover:border-slate-600'
      } ${className}`}
      style={{
        boxShadow: isSelected
          ? '0 0 0 2px rgba(92, 153, 14, 0.3), 0 2px 4px rgba(0,0,0,0.1), inset 0 0 0 1px rgba(0,0,0,0.1)'
          : '0 1px 3px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(0,0,0,0.08)',
      }}
      title={`ป้ายทะเบียน: ${plateNumber}`}
    >
      {/* Left Stamped Rivet Screw */}
      <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-400 border border-slate-500 shrink-0" />
      {/* License Plate String */}
      <span className="font-mono font-black text-slate-900 text-sm tracking-wider uppercase leading-none">
        {plateNumber}
      </span>
      {/* Right Stamped Rivet Screw */}
      <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-400 border border-slate-500 shrink-0" />
    </div>
  );
};

export const DailyDistanceTable: React.FC<DailyDistanceTableProps> = ({
  dailyMetrics,
  vehicles,
  lastSeenMap,
  selectedVehicleId,
  onOpenVehicleMap,
  now,
  className,
  distanceUnit: controlledUnit,
  onDistanceUnitChange,
}) => {
  const [internalUnit, setInternalUnit] = useState<DistanceUnit>(() => {
    try {
      const saved = localStorage.getItem('shuttle_distance_unit');
      if (saved === 'km' || saved === 'mile') return saved;
    } catch {
      // ignore
    }
    return 'km';
  });

  const distanceUnit = controlledUnit ?? internalUnit;

  const handleUnitChange = (unit: DistanceUnit) => {
    if (onDistanceUnitChange) {
      onDistanceUnitChange(unit);
    } else {
      setInternalUnit(unit);
    }
    try {
      localStorage.setItem('shuttle_distance_unit', unit);
    } catch {
      // ignore
    }
  };

  const handleToggleUnit = () => {
    handleUnitChange(distanceUnit === 'km' ? 'mile' : 'km');
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('distance-desc');
  const statusMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setIsStatusMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allVehicleIds = useMemo(() => {
    const ids = new Set<string>();
    Object.keys(dailyMetrics).forEach((id) => ids.add(id));
    Object.keys(vehicles).forEach((id) => ids.add(id));
    return Array.from(ids);
  }, [dailyMetrics, vehicles]);

  const rows = useMemo(() => {
    const currentTime = now ?? Date.now();
    return allVehicleIds.map((id) => {
      const metric = dailyMetrics[id];
      const vehicle = vehicles[id];
      const distanceKm = metric?.total_distance_km ?? 0;
      const parsedLastUpdated = metric?.last_updated_at ? Date.parse(metric.last_updated_at) : 0;
      const lastSeen = lastSeenMap[id] ?? vehicle?.timestamp ?? (Number.isFinite(parsedLastUpdated) ? parsedLastUpdated : 0);
      const isOnline = lastSeen > 0 && currentTime - lastSeen < OFFLINE_THRESHOLD_MS;
      const liveSpeed = vehicle?.speed ?? 0;
      const lastSeenFormatted = formatLastSeen(lastSeen, currentTime);

      return {
        vehicleId: id,
        distanceKm,
        isOnline,
        liveSpeed,
        lastSeen,
        lastSeenFormatted,
      };
    });
  }, [allVehicleIds, dailyMetrics, vehicles, lastSeenMap, now]);

  const onlineCount = useMemo(() => rows.filter((r) => r.isOnline).length, [rows]);
  const offlineCount = useMemo(() => rows.filter((r) => !r.isOnline).length, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (statusFilter === 'online' && !row.isOnline) return false;
      if (statusFilter === 'offline' && row.isOnline) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        if (!row.vehicleId.toLowerCase().includes(q)) return false;
      }

      return true;
    });
  }, [rows, statusFilter, searchQuery]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      if (sortMode === 'distance-desc') {
        if (b.distanceKm !== a.distanceKm) return b.distanceKm - a.distanceKm;
        return a.vehicleId.localeCompare(b.vehicleId);
      }
      if (sortMode === 'id-asc') {
        return a.vehicleId.localeCompare(b.vehicleId);
      }
      return 0;
    });
  }, [filteredRows, sortMode]);

  const handleSortToggle = () => {
    setSortMode((prev) => (prev === 'distance-desc' ? 'id-asc' : 'distance-desc'));
  };

  const getSortLabel = (mode: SortMode) => {
    switch (mode) {
      case 'distance-desc':
        return 'ระยะทางมากสุด';
      case 'id-asc':
        return 'หมายเลขรถ';
    }
  };

  const getStatusFilterLabel = (filter: StatusFilter) => {
    switch (filter) {
      case 'all':
        return `ทั้งหมด (${allVehicleIds.length})`;
      case 'online':
        return `ออนไลน์ (${onlineCount})`;
      case 'offline':
        return `ขาดสัญญาณ (${offlineCount})`;
    }
  };

  const containerClasses =
    className ??
    'bg-white border border-slate-200 text-slate-800 shadow-xl dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100 rounded-2xl p-3.5 sm:p-5 flex flex-col gap-3.5 sm:gap-4 transition-colors max-w-full';

  return (
    <div className={containerClasses}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Route className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200">
              <span>ระยะทางประจำวัน</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">ระยะทางสะสมรายคันวันนี้</p>
          </div>
        </div>

        {/* Right Header Area: Distance Unit Toggle & Vehicle count badge */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Segmented Unit Toggle (km / mile) */}
          <div
            role="group"
            data-testid="distance-unit-toggle"
            aria-label="Toggle distance unit between km and mile"
            className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-xs font-medium"
          >
            <button
              type="button"
              data-testid="unit-km-btn"
              onClick={() => handleUnitChange('km')}
              aria-label="Switch distance unit to km"
              aria-pressed={distanceUnit === 'km'}
              className={`px-2.5 py-1 rounded-md text-xs transition-all font-semibold ${
                distanceUnit === 'km'
                  ? 'bg-white dark:bg-slate-900 text-[#4a7c0b] dark:text-[#5c990e] shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              km
            </button>
            <button
              type="button"
              data-testid="unit-mile-btn"
              onClick={() => handleUnitChange('mile')}
              aria-label="Switch distance unit to mile"
              aria-pressed={distanceUnit === 'mile'}
              className={`px-2.5 py-1 rounded-md text-xs transition-all font-semibold ${
                distanceUnit === 'mile'
                  ? 'bg-white dark:bg-slate-900 text-[#4a7c0b] dark:text-[#5c990e] shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              mile
            </button>
          </div>

          {/* Vehicle count badge */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <span>{allVehicleIds.length} คัน</span>
          </div>
        </div>
      </div>

      {/* Modern & Intuitive Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 p-2.5 sm:p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
        {/* Search Input */}
        <div className="relative w-full sm:flex-1 sm:max-w-xs md:max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาหมายเลขรถ..."
            className="w-full pl-9 pr-8 py-2 sm:py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all min-h-[44px] sm:min-h-0"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 min-h-[36px] min-w-[36px] flex items-center justify-center"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter and Sort row with responsive grid preventing any mobile overflow */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
          {/* Combined Status Filter Dropdown */}
          <div ref={statusMenuRef} className="relative w-full sm:w-auto min-w-0">
            <button
              type="button"
              onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)}
              aria-label="Filter by status"
              aria-expanded={isStatusMenuOpen}
              className="w-full sm:w-auto flex items-center justify-between gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300 dark:hover:text-white dark:border-slate-700/80 text-xs sm:text-sm font-medium transition-all shadow-sm min-h-[44px] sm:min-h-0 min-w-0"
            >
              <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                {statusFilter === 'online' && <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />}
                {statusFilter === 'offline' && <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />}
                <span className="truncate">{getStatusFilterLabel(statusFilter)}</span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${isStatusMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isStatusMenuOpen && (
              <div className="absolute left-0 mt-1.5 w-60 max-w-[calc(100vw-3rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl py-1 z-[60]">
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('all');
                    setIsStatusMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs sm:text-sm font-medium text-left transition-colors min-h-[44px] sm:min-h-0 ${
                    statusFilter === 'all'
                      ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span>รถทั้งหมด</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">{allVehicleIds.length}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('online');
                    setIsStatusMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs sm:text-sm font-medium text-left transition-colors min-h-[44px] sm:min-h-0 ${
                    statusFilter === 'online'
                      ? 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    ออนไลน์
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">{onlineCount}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('offline');
                    setIsStatusMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs sm:text-sm font-medium text-left transition-colors min-h-[44px] sm:min-h-0 ${
                    statusFilter === 'offline'
                      ? 'bg-rose-500/10 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    ขาดสัญญาณ
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">{offlineCount}</span>
                </button>
              </div>
            )}
          </div>

          {/* Sort Toggle Button */}
          <button
            onClick={handleSortToggle}
            aria-label="Toggle sort"
            title={`Sort mode: ${sortMode}`}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300 dark:hover:text-white dark:border-slate-700/80 text-xs sm:text-sm font-medium transition-all shadow-sm min-h-[44px] sm:min-h-0 min-w-0"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">{getSortLabel(sortMode)}</span>
          </button>
        </div>
      </div>

      {allVehicleIds.length === 0 ? (
        <div className="py-8 px-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
          <Route className="w-7 h-7 text-slate-400 dark:text-slate-600 mx-auto mb-2 animate-pulse" />
          <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">ยังไม่มีบันทึกระยะทางวันนี้</p>
          <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">
            ข้อมูลระยะทางจะอัปเดตอัตโนมัติเมื่อรถเริ่มวิ่ง
          </p>
        </div>
      ) : sortedRows.length === 0 ? (
        <div className="py-8 px-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
          <Search className="w-7 h-7 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">ไม่พบรถที่ตรงตามเงื่อนไขการค้นหา</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
            }}
            className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            ล้างตัวกรอง
          </button>
        </div>
      ) : (
        <>
          {/* Desktop View: HTML Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-xs font-semibold tracking-wider">
                  <th className="py-2.5 px-3 font-semibold">หมายเลขรถ</th>
                  <th className="py-2.5 px-3 font-semibold">สถานะ</th>
                  <th
                    onClick={handleToggleUnit}
                    className="py-2.5 px-3 font-semibold cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                    title="คลิกเพื่อสลับหน่วยระหว่าง km และ mile"
                  >
                    <div className="flex items-center gap-1">
                      <span>ระยะทางวันนี้</span>
                      <span className="text-xs lowercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono font-bold">
                        ({distanceUnit})
                      </span>
                    </div>
                  </th>
                  <th className="py-2.5 px-3 font-semibold">อัปเดตล่าสุด</th>
                  <th className="py-2.5 px-3 font-semibold text-right">แผนที่</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {sortedRows.map((row) => {
                  const isSelected = selectedVehicleId === row.vehicleId;

                  return (
                    <tr
                      key={row.vehicleId}
                      data-testid={`vehicle-row-${row.vehicleId}`}
                      className={`transition-colors group ${
                        isSelected
                          ? 'bg-emerald-500/10'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      {/* Vehicle Column */}
                      <td
                        data-testid="vehicle-id-cell"
                        className="py-3 px-3 flex items-center"
                      >
                        <LicensePlateBadge
                          plateNumber={row.vehicleId}
                          isSelected={isSelected}
                        />
                      </td>

                      {/* Status Column */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="relative flex h-2 w-2">
                            {row.isOnline && (
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            )}
                            <span
                              className={`relative inline-flex rounded-full h-2 w-2 ${
                                row.isOnline ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}
                            />
                          </span>
                          <span
                            className={`text-sm font-medium ${
                              row.isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {row.isOnline ? 'ออนไลน์' : 'ขาดสัญญาณ'}
                          </span>
                        </div>
                      </td>

                      {/* Today's Distance Column */}
                      <td className="py-3 px-3 font-mono font-bold text-sm sm:text-base text-slate-800 dark:text-slate-200">
                        {formatDistance(row.distanceKm, distanceUnit)}
                      </td>

                      {/* Last Seen Column */}
                      <td className="py-3 px-3">
                        <div className={`text-xs sm:text-sm font-semibold ${row.lastSeenFormatted.isToday ? 'font-mono text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}`}>
                          {row.lastSeenFormatted.mainText}
                        </div>
                        <div className={`text-xs ${row.isOnline && row.lastSeenFormatted.isToday ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
                          {row.lastSeenFormatted.subText}
                        </div>
                      </td>

                      {/* Action Column */}
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => onOpenVehicleMap(row.vehicleId)}
                          aria-label={`Open map for ${row.vehicleId}`}
                          title={`เปิดแผนที่สำหรับ ${row.vehicleId}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-300 dark:hover:text-white dark:border-slate-700/80 text-xs sm:text-sm font-semibold transition-all group-hover:border-emerald-500/50"
                        >
                          <Maximize2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>เปิดแผนที่</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile View: Stacked Card List with min-h-[44px] Accessible Tap Targets */}
          <div className="sm:hidden space-y-3">
            {sortedRows.map((row) => {
              const isSelected = selectedVehicleId === row.vehicleId;

              return (
                <div
                  key={row.vehicleId}
                  data-testid={`mobile-vehicle-card-${row.vehicleId}`}
                  className={`p-4 rounded-2xl border transition-all min-h-[44px] flex flex-col gap-3 shadow-sm ${
                    isSelected
                      ? 'bg-emerald-500/10 border-emerald-500/80 shadow-md ring-1 ring-emerald-500/30'
                      : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-slate-850 dark:border-slate-800 dark:hover:border-slate-700'
                  }`}
                >
                  {/* Card Header: Vehicle Identity & Live Status Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <LicensePlateBadge
                        plateNumber={row.vehicleId}
                        isSelected={isSelected}
                      />
                    </div>

                    {/* Status Pill Badge */}
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs sm:text-sm font-semibold ${
                        row.isOnline
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
                      }`}
                    >
                      <span className="relative flex h-2 w-2">
                        {row.isOnline && (
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        )}
                        <span
                          className={`relative inline-flex rounded-full h-2 w-2 ${
                            row.isOnline ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
                      </span>
                      <span>{row.isOnline ? 'ออนไลน์' : 'ขาดสัญญาณ'}</span>
                    </span>
                  </div>

                  {/* 2-Metric Grid (Distance & Last Seen) with high-contrast typography */}
                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3 border border-slate-200/80 dark:border-slate-800/80">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">
                        ระยะทางวันนี้ ({distanceUnit})
                      </span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-base sm:text-lg">
                        {formatDistance(row.distanceKm, distanceUnit)}
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3 border border-slate-200/80 dark:border-slate-800/80">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">
                        อัปเดตล่าสุด
                      </span>
                      <div className={`text-xs sm:text-sm font-semibold ${row.lastSeenFormatted.isToday ? 'font-mono text-slate-800 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400'}`}>
                        {row.lastSeenFormatted.mainText}
                      </div>
                      <div className={`text-xs mt-0.5 ${row.isOnline && row.lastSeenFormatted.isToday ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
                        {row.lastSeenFormatted.subText}
                      </div>
                    </div>
                  </div>

                  {/* Mobile Action Button with min-h-[44px] Accessible Target */}
                  <button
                    type="button"
                    onClick={() => onOpenVehicleMap(row.vehicleId)}
                    aria-label={`View map for ${row.vehicleId}`}
                    title={`เปิดแผนที่ ${row.vehicleId}`}
                    className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:active:bg-slate-650 dark:text-slate-200 dark:border-slate-700 text-sm font-semibold transition-all shadow-sm"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>เปิดแผนที่</span>
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
