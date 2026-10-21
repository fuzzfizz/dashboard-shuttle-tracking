import React from 'react';
import { Gauge, Radio, Clock, Compass, Bus } from 'lucide-react';
import { ConnectionStatus, TelemetryPayload } from '../types/telemetry';

interface TelemetryHUDProps {
  telemetry: TelemetryPayload | null;
  status: ConnectionStatus;
  lastSeen: number | null;
  totalVehicles?: number;
}

export const TelemetryHUD: React.FC<TelemetryHUDProps> = ({
  telemetry,
  status,
  lastSeen,
  totalVehicles = 0,
}) => {
  const getStatusColor = (s: ConnectionStatus) => {
    switch (s) {
      case 'connected':
        return 'bg-emerald-500 text-emerald-700 border-emerald-200';
      case 'connecting':
        return 'bg-amber-500 text-amber-700 border-amber-200 animate-pulse';
      case 'disconnected':
      case 'error':
        return 'bg-rose-500 text-rose-700 border-rose-200';
    }
  };

  const formatLastSeen = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 2) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-[92vw] max-w-xl">
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 text-white px-5 py-4 rounded-2xl shadow-2xl flex flex-wrap items-center justify-between gap-4">
        {/* Status & Vehicle Info */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-3 w-3">
            {status === 'connected' && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span className={`relative inline-flex rounded-full h-3 w-3 ${getStatusColor(status).split(' ')[0]}`}></span>
          </div>
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5" />
              <span>Broker: {status}</span>
            </div>
            <div className="text-sm font-bold tracking-tight text-white flex items-center gap-1 mt-0.5">
              <Bus className="w-4 h-4 text-emerald-400" />
              <span>{telemetry ? telemetry.vehicle_id : `Overview (${totalVehicles} online)`}</span>
            </div>
          </div>
        </div>

        {/* Telemetry Metrics */}
        <div className="flex items-center gap-6 border-l border-slate-800 pl-6">
          {/* Speed */}
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-800/80 rounded-xl text-emerald-400">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Speed</div>
              <div className="text-lg font-bold font-mono text-white leading-none">
                {telemetry ? telemetry.speed.toFixed(1) : '--'}
                <span className="text-xs font-normal text-slate-400 ml-1">km/h</span>
              </div>
            </div>
          </div>

          {/* Heading */}
          <div className="hidden sm:flex items-center gap-2.5">
            <div className="p-2 bg-slate-800/80 rounded-xl text-sky-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Heading</div>
              <div className="text-lg font-bold font-mono text-white leading-none">
                {telemetry?.heading !== undefined ? `${telemetry.heading}°` : '--'}
              </div>
            </div>
          </div>

          {/* Last Seen */}
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-800/80 rounded-xl text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Heartbeat</div>
              <div className="text-xs font-bold font-mono text-white leading-none">
                {formatLastSeen(lastSeen)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
