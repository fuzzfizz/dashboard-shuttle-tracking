import React, { useState, useMemo } from 'react';
import { Bus, Route, ArrowUpDown, Maximize2, Search, X } from 'lucide-react';
import { DailyMetricsMap } from '../types/metrics';
import { FleetMap } from '../types/telemetry';
import { OFFLINE_THRESHOLD_MS } from '../services/fleetStatus';

export type SortMode = 'distance-desc' | 'id-asc';
export type StatusFilter = 'all' | 'online' | 'offline';

export interface DailyDistanceTableProps {
  dailyMetrics: DailyMetricsMap;
  vehicles: FleetMap;
  lastSeenMap: Record<string, number>;
  selectedVehicleId: string | null;
  onOpenVehicleMap: (vehicleId: string) => void;
  now?: number;
  className?: string;
}

export const DailyDistanceTable: React.FC<DailyDistanceTableProps> = ({
  dailyMetrics,
  vehicles,
  lastSeenMap,
  selectedVehicleId,
  onOpenVehicleMap,
  now,
  className,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('distance-desc');

  const allVehicleIds = useMemo(() => {
    const ids = new Set<string>();
    Object.keys(dailyMetrics).forEach((id) => ids.add(id));
    Object.keys(vehicles).forEach((id) => ids.add(id));
    return Array.from(ids);
  }, [dailyMetrics, vehicles]);

  const formatActiveTime = (minutes: number) => {
    if (!minutes || minutes <= 0) return '0m';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const rows = useMemo(() => {
    const currentTime = now ?? Date.now();
    return allVehicleIds.map((id) => {
      const metric = dailyMetrics[id];
      const vehicle = vehicles[id];
      const distanceKm = metric?.total_distance_km ?? 0;
      const activeMinutes = metric?.active_minutes ?? 0;
      const lastSeen = lastSeenMap[id] ?? vehicle?.timestamp ?? 0;
      const isOnline = lastSeen > 0 && currentTime - lastSeen < OFFLINE_THRESHOLD_MS;
      const liveSpeed = vehicle?.speed ?? 0;

      return {
        vehicleId: id,
        distanceKm,
        activeMinutes,
        isOnline,
        liveSpeed,
      };
    });
  }, [allVehicleIds, dailyMetrics, vehicles, lastSeenMap, now]);

  const onlineCount = useMemo(() => rows.filter((r) => r.isOnline).length, [rows]);
  const offlineCount = useMemo(() => rows.filter((r) => !r.isOnline).length, [rows]);

  const maxDistance = useMemo(() => {
    const max = Math.max(...rows.map((r) => r.distanceKm), 0);
    return max > 0 ? max : 1;
  }, [rows]);

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
        return 'Highest Distance';
      case 'id-asc':
        return 'Vehicle ID';
    }
  };

  const containerClasses =
    className ??
    'bg-white border border-slate-200 text-slate-800 shadow-xl dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 transition-colors';

  return (
    <div className={containerClasses}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Route className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Daily Distance Overview</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Distance traveled by vehicles today</p>
          </div>
        </div>

        {/* Vehicle count badge */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          <span>{allVehicleIds.length} vehicles</span>
        </div>
      </div>

      {/* Modern & Intuitive Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search vehicle..."
            className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white dark:bg-emerald-600 shadow-sm'
                : 'bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/70'
            }`}
          >
            All ({allVehicleIds.length})
          </button>
          <button
            onClick={() => setStatusFilter('online')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === 'online'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/70'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Live ({onlineCount})
          </button>
          <button
            onClick={() => setStatusFilter('offline')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === 'offline'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/70'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Signal Lost ({offlineCount})
          </button>
        </div>

        {/* Sort Toggle Button */}
        <button
          onClick={handleSortToggle}
          aria-label="Toggle sort"
          title={`Sort mode: ${sortMode}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300 dark:hover:text-white dark:border-slate-700/80 text-xs font-medium transition-all shadow-sm"
        >
          <ArrowUpDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Sort: {getSortLabel(sortMode)}</span>
        </button>
      </div>

      {allVehicleIds.length === 0 ? (
        <div className="py-8 px-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
          <Route className="w-7 h-7 text-slate-400 dark:text-slate-600 mx-auto mb-2 animate-pulse" />
          <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">No distance recorded today</p>
          <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">
            Distance metrics will update automatically as vehicles move
          </p>
        </div>
      ) : sortedRows.length === 0 ? (
        <div className="py-8 px-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
          <Search className="w-7 h-7 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">No vehicles match your filter</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
            }}
            className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          {/* Desktop View: HTML Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3 font-semibold">Vehicle</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold">Today's Distance</th>
                  <th className="py-2.5 px-3 font-semibold">Active Time</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {sortedRows.map((row) => {
                  const isSelected = selectedVehicleId === row.vehicleId;
                  const progressPercent = Math.min(100, Math.round((row.distanceKm / maxDistance) * 100));

                  return (
                    <tr
                      key={row.vehicleId}
                      data-testid={`vehicle-row-${row.vehicleId}`}
                      onClick={() => onOpenVehicleMap(row.vehicleId)}
                      className={`cursor-pointer transition-colors group ${
                        isSelected
                          ? 'bg-emerald-500/10'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      {/* Vehicle Column */}
                      <td
                        data-testid="vehicle-id-cell"
                        className="py-3 px-3 flex items-center gap-2.5"
                      >
                        <div className="p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-emerald-600 dark:text-emerald-400">
                          <Bus className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                          {row.vehicleId}
                        </span>
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
                            className={`text-xs font-medium ${
                              row.isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {row.isOnline ? 'Live' : 'Signal Lost'}
                          </span>
                        </div>
                      </td>

                      {/* Today's Distance Column with Progress Bar */}
                      <td className="py-3 px-3 min-w-[160px]">
                        <div className="flex items-center justify-between font-mono font-semibold text-slate-800 dark:text-slate-200">
                          <span>{row.distanceKm.toFixed(2)} km</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                            {progressPercent}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden mt-1">
                          <div
                            className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </td>

                      {/* Active Time Column */}
                      <td className="py-3 px-3 font-mono text-slate-700 dark:text-slate-300">
                        {formatActiveTime(row.activeMinutes)}
                      </td>

                      {/* Action Column */}
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenVehicleMap(row.vehicleId);
                          }}
                          aria-label={`Open map for ${row.vehicleId}`}
                          title={`Open map for ${row.vehicleId}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-300 dark:hover:text-white dark:border-slate-700/80 text-xs font-medium transition-all group-hover:border-emerald-500/50"
                        >
                          <Maximize2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Open Map</span>
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
              const progressPercent = Math.min(100, Math.round((row.distanceKm / maxDistance) * 100));

              return (
                <div
                  key={row.vehicleId}
                  data-testid={`mobile-vehicle-card-${row.vehicleId}`}
                  onClick={() => onOpenVehicleMap(row.vehicleId)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer min-h-[44px] flex flex-col gap-2.5 ${
                    isSelected
                      ? 'bg-emerald-500/10 border-emerald-500/80 shadow-md'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100/80 dark:bg-slate-800/60 dark:border-slate-700/60 dark:hover:bg-slate-800 dark:hover:border-slate-600'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-slate-200/80 dark:bg-slate-800 rounded-lg text-emerald-600 dark:text-emerald-400">
                        <Bus className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white font-mono tracking-tight">
                          Shuttle #{row.vehicleId}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
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
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            {row.isOnline ? 'Live' : 'Signal Lost'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2-Metric Grid (Distance & Active Time) */}
                  <div className="grid grid-cols-2 gap-2 py-1 text-xs">
                    <div className="bg-white dark:bg-slate-900/60 rounded-lg p-2 border border-slate-200 dark:border-slate-800/80">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Today's Distance</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">{row.distanceKm.toFixed(2)} km</span>
                    </div>
                    <div className="bg-white dark:bg-slate-900/60 rounded-lg p-2 border border-slate-200 dark:border-slate-800/80">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Active Time</span>
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-xs">{formatActiveTime(row.activeMinutes)}</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200 dark:bg-slate-900 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  {/* Mobile Action Button with min-h-[44px] */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenVehicleMap(row.vehicleId);
                    }}
                    aria-label={`View map for ${row.vehicleId}`}
                    className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700 text-xs font-medium transition-all"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>View on Map</span>
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
