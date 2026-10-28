import React from 'react';
import { Gauge, Radio, Clock, Compass, Bus, X, Route } from 'lucide-react';
import { ConnectionStatus, FleetStats, TelemetryPayload } from '../types/telemetry';

export interface TelemetryHUDProps {
  telemetry: TelemetryPayload | null;
  status: ConnectionStatus;
  lastSeen: number | null;
  totalVehicles?: number;
  fleetStats?: FleetStats;
  isOnline?: boolean;
  now?: number;
  className?: string;
  dailyDistanceKm?: number;
  onClose?: () => void;
}

export const TelemetryHUD: React.FC<TelemetryHUDProps> = ({
  telemetry,
  status,
  lastSeen,
  totalVehicles = 0,
  fleetStats,
  isOnline,
  now,
  className,
  dailyDistanceKm,
  onClose,
}) => {
  const getStatusColor = (s: ConnectionStatus) => {
    switch (s) {
      case 'connected':
        return 'bg-emerald-500 text-emerald-700 border-emerald-200';
      case 'connecting':
        return 'bg-amber-500 text-amber-700 border-amber-200 animate-pulse';
      case 'disconnected':
      case 'error':
      default:
        return 'bg-rose-500 text-rose-700 border-rose-200';
    }
  };

  const formatLastSeen = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const currentTime = now ?? Date.now();
    const seconds = Math.max(0, Math.floor((currentTime - timestamp) / 1000));
    if (seconds < 2) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const isMoving = telemetry && (telemetry.speed ?? 0) > 2;

  return (
    <div className={className ?? "absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-[92vw] max-w-xl"}>
      <div className="bg-white/95 border-slate-200 text-slate-900 shadow-xl dark:bg-slate-900/90 dark:border-slate-800 dark:text-white dark:shadow-2xl backdrop-blur-md border px-5 py-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 transition-colors">
        {/* Status & Vehicle Info */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-3 w-3">
            {status === 'connected' && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span className={`relative inline-flex rounded-full h-3 w-3 ${getStatusColor(status).split(' ')[0]}`}></span>
          </div>
          <div>
            {telemetry ? (
              // Consumer-friendly vehicle status without broker jargon
              <div className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                {isOnline === false ? (
                  <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    Signal Lost
                  </span>
                ) : isMoving ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Moving / กำลังวิ่ง
                  </span>
                ) : (
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    Stopped / จอดพัก
                  </span>
                )}
              </div>
            ) : (
              // Overview mode status
              <div className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5" />
                <span>Broker: {status}</span>
              </div>
            )}

            <div className="text-sm font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5 mt-0.5">
              <Bus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>
                {telemetry
                  ? telemetry.vehicle_id
                  : `Overview (${fleetStats?.onlineVehicles ?? totalVehicles ?? 0} online)`}
              </span>
            </div>
          </div>
        </div>

        {/* Telemetry Metrics */}
        <div className="flex items-center gap-5 sm:gap-6 border-l border-slate-200 dark:border-slate-800 pl-4 sm:pl-6">
          {/* Speed */}
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-emerald-600 dark:text-emerald-400">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500 dark:text-slate-400">Speed</div>
              <div className="text-lg font-bold font-mono text-slate-900 dark:text-white leading-none">
                {telemetry
                  ? telemetry.speed.toFixed(1)
                  : fleetStats?.averageSpeed !== undefined
                    ? fleetStats.averageSpeed.toFixed(1)
                    : '--'}
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1">km/h</span>
              </div>
            </div>
          </div>

          {/* Today Distance (if available) */}
          {dailyDistanceKm !== undefined && (
            <div className="hidden md:flex items-center gap-2.5">
              <div className="p-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-indigo-600 dark:text-indigo-400">
                <Route className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500 dark:text-slate-400">Today</div>
                <div className="text-lg font-bold font-mono text-slate-900 dark:text-white leading-none">
                  {dailyDistanceKm.toFixed(2)}
                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1">km</span>
                </div>
              </div>
            </div>
          )}

          {/* Heading */}
          <div className="hidden sm:flex items-center gap-2.5">
            <div className="p-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-sky-600 dark:text-sky-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500 dark:text-slate-400">Heading</div>
              <div className="text-lg font-bold font-mono text-slate-900 dark:text-white leading-none">
                {telemetry?.heading !== undefined ? `${telemetry.heading}°` : '--'}
              </div>
            </div>
          </div>

          {/* Last Seen / Heartbeat */}
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-amber-600 dark:text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500 dark:text-slate-400">Updated</div>
              <div className="text-xs font-bold font-mono text-slate-900 dark:text-white leading-none">
                {formatLastSeen(lastSeen)}
              </div>
            </div>
          </div>

          {/* Close button to return to all vehicles overview */}
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Deselect vehicle and return to all vehicles overview"
              title="Deselect vehicle (Overview)"
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
