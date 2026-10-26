import React, { useState, useMemo } from 'react';
import { Bus, Route, ArrowUpDown, Maximize2, Gauge } from 'lucide-react';
import { DailyMetricsMap } from '../types/metrics';
import { FleetMap } from '../types/telemetry';
import { OFFLINE_THRESHOLD_MS } from '../services/fleetStatus';

export type SortMode = 'distance-desc' | 'speed-desc' | 'id-asc';

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
  const [sortMode, setSortMode] = useState<SortMode>('distance-desc');

  const allVehicleIds = useMemo(() => {
    const ids = new Set<string>();
    Object.keys(dailyMetrics).forEach((id) => ids.add(id));
    Object.keys(vehicles).forEach((id) => ids.add(id));
    return Array.from(ids);
  }, [dailyMetrics, vehicles]);

  const totalFleetDistanceKm = useMemo(() => {
    return Object.values(dailyMetrics).reduce(
      (sum, m) => sum + (m.total_distance_km || 0),
      0
    );
  }, [dailyMetrics]);

  const maxSpeedOverall = useMemo(() => {
    return Object.values(dailyMetrics).reduce(
      (max, m) => Math.max(max, m.max_speed_kmh || 0),
      0
    );
  }, [dailyMetrics]);

  const trackedUnitsCount = useMemo(() => {
    return allVehicleIds.length;
  }, [allVehicleIds]);

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
      const maxSpeedKmH = metric?.max_speed_kmh ?? 0;
      const activeMinutes = metric?.active_minutes ?? 0;
      const lastSeen = lastSeenMap[id] ?? vehicle?.timestamp ?? 0;
      const isOnline = lastSeen > 0 && currentTime - lastSeen < OFFLINE_THRESHOLD_MS;
      const liveSpeed = vehicle?.speed ?? 0;

      return {
        vehicleId: id,
        distanceKm,
        maxSpeedKmH,
        activeMinutes,
        isOnline,
        liveSpeed,
      };
    });
  }, [allVehicleIds, dailyMetrics, vehicles, lastSeenMap, now]);

  const maxDistance = useMemo(() => {
    const max = Math.max(...rows.map((r) => r.distanceKm), 0);
    return max > 0 ? max : 1;
  }, [rows]);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (sortMode === 'distance-desc') {
        if (b.distanceKm !== a.distanceKm) return b.distanceKm - a.distanceKm;
        return a.vehicleId.localeCompare(b.vehicleId);
      }
      if (sortMode === 'speed-desc') {
        if (b.maxSpeedKmH !== a.maxSpeedKmH) return b.maxSpeedKmH - a.maxSpeedKmH;
        return a.vehicleId.localeCompare(b.vehicleId);
      }
      if (sortMode === 'id-asc') {
        return a.vehicleId.localeCompare(b.vehicleId);
      }
      return 0;
    });
  }, [rows, sortMode]);

  const handleSortToggle = () => {
    setSortMode((prev) => {
      if (prev === 'distance-desc') return 'speed-desc';
      if (prev === 'speed-desc') return 'id-asc';
      return 'distance-desc';
    });
  };

  const getSortLabel = (mode: SortMode) => {
    switch (mode) {
      case 'distance-desc':
        return 'Highest Distance';
      case 'speed-desc':
        return 'Highest Speed';
      case 'id-asc':
        return 'Vehicle ID';
    }
  };

  const containerClasses =
    className ??
    'bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col gap-4 text-slate-100';

  if (allVehicleIds.length === 0) {
    return (
      <div className={containerClasses}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <Route className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-200">Daily Distance Overview</h2>
              <p className="text-[11px] text-slate-400">Total distance traveled by vehicles today</p>
            </div>
          </div>
        </div>
        <div className="py-8 px-4 text-center border border-dashed border-slate-800 rounded-xl">
          <Route className="w-7 h-7 text-slate-600 mx-auto mb-2 animate-pulse" />
          <p className="text-xs sm:text-sm font-medium text-slate-400">No distance recorded today</p>
          <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">
            Distance metrics will update automatically as vehicles move
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <Route className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Daily Distance Overview</h2>
            <p className="text-[11px] text-slate-400">Total distance traveled by vehicles today</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Fleet Distance Pill */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span>Total: {totalFleetDistanceKm.toFixed(2)} km</span>
          </div>

          {/* Sort Button */}
          <button
            onClick={handleSortToggle}
            aria-label="Toggle sort"
            title={`Sort mode: ${sortMode}`}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 min-h-[44px] sm:min-h-0 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-medium transition-colors"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Sort: {getSortLabel(sortMode)}</span>
          </button>
        </div>
      </div>

      {/* 3 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-1">
        {/* Total Distance */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
            <Route className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider">
              Total Distance
            </span>
            <span className="text-base sm:text-lg font-bold font-mono text-emerald-400">
              {totalFleetDistanceKm.toFixed(2)} km
            </span>
          </div>
        </div>

        {/* Max Speed */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 flex items-center gap-3">
          <div className="p-2.5 bg-sky-500/10 text-sky-400 rounded-lg border border-sky-500/20">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider">
              Max Speed
            </span>
            <span className="text-base sm:text-lg font-bold font-mono text-sky-400">
              {maxSpeedOverall.toFixed(1)} km/h
            </span>
          </div>
        </div>

        {/* Tracked Shuttles */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
            <Bus className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider">
              Tracked Shuttles
            </span>
            <span className="text-base sm:text-lg font-bold font-mono text-amber-400">
              {trackedUnitsCount} shuttles
            </span>
          </div>
        </div>
      </div>

      {/* Desktop View: HTML Table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
              <th className="py-2.5 px-3 font-semibold">Vehicle</th>
              <th className="py-2.5 px-3 font-semibold">Status</th>
              <th className="py-2.5 px-3 font-semibold">Today's Distance</th>
              <th className="py-2.5 px-3 font-semibold">Max Speed</th>
              <th className="py-2.5 px-3 font-semibold">Active Time</th>
              <th className="py-2.5 px-3 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
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
                      : 'hover:bg-slate-800/50'
                  }`}
                >
                  {/* Vehicle Column */}
                  <td
                    data-testid="vehicle-id-cell"
                    className="py-3 px-3 flex items-center gap-2.5"
                  >
                    <div className="p-1 bg-slate-800 rounded-lg text-emerald-400">
                      <Bus className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-mono font-bold text-slate-100">
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
                          row.isOnline ? 'text-emerald-400' : 'text-slate-400'
                        }`}
                      >
                        {row.isOnline ? 'Live' : 'Signal Lost'}
                      </span>
                    </div>
                  </td>

                  {/* Today's Distance Column with Progress Bar */}
                  <td className="py-3 px-3 min-w-[160px]">
                    <div className="flex items-center justify-between font-mono font-semibold text-slate-200">
                      <span>{row.distanceKm.toFixed(2)} km</span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        {progressPercent}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden mt-1">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </td>

                  {/* Max Speed Column */}
                  <td className="py-3 px-3 font-mono text-slate-300">
                    {row.maxSpeedKmH.toFixed(1)} km/h
                  </td>

                  {/* Active Time Column */}
                  <td className="py-3 px-3 font-mono text-slate-300">
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
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-medium transition-all group-hover:border-emerald-500/50"
                    >
                      <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
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
                  : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800 hover:border-slate-600'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-slate-800 rounded-lg text-emerald-400">
                    <Bus className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white font-mono tracking-tight">
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
                      <span className="text-[10px] text-slate-400">
                        {row.isOnline ? 'Live' : 'Signal Lost'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3-Metric Grid */}
              <div className="grid grid-cols-3 gap-2 py-1 text-xs">
                <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-800/80">
                  <span className="text-[10px] text-slate-400 block">Distance</span>
                  <span className="font-mono font-bold text-white text-xs">{row.distanceKm.toFixed(2)} km</span>
                </div>
                <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-800/80">
                  <span className="text-[10px] text-slate-400 block">Max Speed</span>
                  <span className="font-mono font-bold text-sky-400 text-xs">{row.maxSpeedKmH.toFixed(1)} km/h</span>
                </div>
                <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-800/80">
                  <span className="text-[10px] text-slate-400 block">Active Time</span>
                  <span className="font-mono font-bold text-amber-400 text-xs">{formatActiveTime(row.activeMinutes)}</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
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
                className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-all"
              >
                <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>View on Map</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
