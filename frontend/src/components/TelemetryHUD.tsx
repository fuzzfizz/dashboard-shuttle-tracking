import React from 'react';
import { Gauge, Radio, Clock, Bus, X, Route } from 'lucide-react';
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
    <div className={className ?? "absolute bottom-3 sm:bottom-6 left-2 right-2 sm:left-1/2 sm:-translate-x-1/2 z-[1000] w-auto sm:w-[92vw] sm:max-w-xl pb-[env(safe-area-inset-bottom)]"}>
      <div className="bg-white/95 border-slate-200 text-slate-900 shadow-xl dark:bg-slate-900/95 dark:border-slate-800 dark:text-white dark:shadow-2xl backdrop-blur-md border p-4 sm:px-6 sm:py-4 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-5 transition-colors">
        {/* Status & Vehicle Info Header */}
        <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-3">
            <div className="relative flex h-3 w-3 shrink-0">
              {status === 'connected' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-3 w-3 ${getStatusColor(status).split(' ')[0]}`}></span>
            </div>
            <div>
              {telemetry ? (
                // Consumer-friendly vehicle status without broker jargon
                <div className="text-xs sm:text-sm font-semibold flex items-center gap-1.5 leading-normal">
                  {isOnline === false ? (
                    <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      <span>Signal Lost</span>
                      <span className="text-rose-500/80 font-normal">/ ขาดการเชื่อมต่อ</span>
                    </span>
                  ) : isMoving ? (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Moving / กำลังวิ่ง</span>
                    </span>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-400" />
                      <span>Stopped / จอดพัก</span>
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

              <div className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2 mt-0.5">
                <Bus className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-mono">
                  {telemetry
                    ? telemetry.vehicle_id
                    : `Overview (${fleetStats?.onlineVehicles ?? totalVehicles ?? 0} online)`}
                </span>
              </div>
            </div>
          </div>

          {/* Close button on Mobile */}
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Deselect vehicle and return to all vehicles overview"
              title="ปิดและกลับสู่ภาพรวม (Overview)"
              className="sm:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Telemetry Metrics Grid / Row (Clean 3-metric layout with generous spacing) */}
        <div className="grid grid-cols-3 sm:flex sm:items-center gap-3 sm:gap-6 pt-3 sm:pt-0 border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-800 sm:pl-6 w-full sm:w-auto">
          {/* Speed (Shows '--' when signal is lost) */}
          <div className="flex items-center gap-2.5 bg-slate-50 sm:bg-transparent dark:bg-slate-800/40 sm:dark:bg-transparent p-2 sm:p-0 rounded-xl">
            <div className={`p-2 bg-white dark:bg-slate-800/80 rounded-xl shrink-0 shadow-xs sm:shadow-none ${
              isOnline === false ? 'text-slate-400 dark:text-slate-500' : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              <Gauge className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-normal">ความเร็ว</div>
              <div className="text-base sm:text-lg font-bold font-mono text-slate-900 dark:text-white leading-tight">
                {telemetry
                  ? (isOnline === false ? '--' : telemetry.speed.toFixed(1))
                  : fleetStats?.averageSpeed !== undefined
                    ? fleetStats.averageSpeed.toFixed(1)
                    : '--'}
                {telemetry && isOnline !== false && (
                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1">km/h</span>
                )}
                {!telemetry && (
                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1">km/h</span>
                )}
              </div>
            </div>
          </div>

          {/* Today Distance (if available) */}
          {dailyDistanceKm !== undefined && (
            <div className="flex items-center gap-2.5 bg-slate-50 sm:bg-transparent dark:bg-slate-800/40 sm:dark:bg-transparent p-2 sm:p-0 rounded-xl">
              <div className="p-2 bg-white dark:bg-slate-800/80 rounded-xl text-indigo-600 dark:text-indigo-400 shrink-0 shadow-xs sm:shadow-none">
                <Route className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-normal">ระยะทางวันนี้</div>
                <div className="text-base sm:text-lg font-bold font-mono text-slate-900 dark:text-white leading-tight">
                  {dailyDistanceKm.toFixed(2)}
                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1">km</span>
                </div>
              </div>
            </div>
          )}

          {/* Last Seen / Heartbeat */}
          <div className="flex items-center gap-2.5 bg-slate-50 sm:bg-transparent dark:bg-slate-800/40 sm:dark:bg-transparent p-2 sm:p-0 rounded-xl">
            <div className="p-2 bg-white dark:bg-slate-800/80 rounded-xl text-amber-600 dark:text-amber-400 shrink-0 shadow-xs sm:shadow-none">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-normal">อัปเดตล่าสุด</div>
              <div className="text-xs sm:text-sm font-bold font-mono text-slate-900 dark:text-white leading-tight">
                {formatLastSeen(lastSeen)}
              </div>
            </div>
          </div>

          {/* Close button to return to all vehicles overview on Desktop */}
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Deselect vehicle and return to all vehicles overview"
              title="ปิดและกลับสู่ภาพรวม (Overview)"
              className="hidden sm:flex p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
