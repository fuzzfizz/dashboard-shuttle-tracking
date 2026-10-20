import React, { useEffect, useState } from 'react';
import { ConnectionStatus, TelemetryPayload } from '../types/telemetry';
import { Radio, Navigation, Gauge, Clock } from 'lucide-react';

interface TelemetryHUDProps {
  telemetry: TelemetryPayload | null;
  status: ConnectionStatus;
  lastSeen: number | null;
}

export const TelemetryHUD: React.FC<TelemetryHUDProps> = ({ telemetry, status, lastSeen }) => {
  const [secondsAgo, setSecondsAgo] = useState<number | null>(null);

  useEffect(() => {
    if (!lastSeen) {
      setSecondsAgo(null);
      return;
    }
    const updateTime = () => {
      setSecondsAgo(Math.floor((Date.now() - lastSeen) / 1000));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [lastSeen]);

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return { dot: 'bg-emerald-500 animate-pulse', text: 'text-emerald-700', label: 'Online' };
      case 'connecting':
        return { dot: 'bg-amber-500 animate-ping', text: 'text-amber-700', label: 'Connecting' };
      case 'disconnected':
      case 'error':
      default:
        return { dot: 'bg-rose-500', text: 'text-rose-700', label: 'Disconnected' };
    }
  };

  const statusConfig = getStatusColor();

  return (
    <div className="absolute top-4 right-4 z-[1000] w-80 bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-xl shadow-lg p-4 text-slate-800 transition-all duration-300">
      {/* Header & Status */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-slate-100 rounded-lg text-slate-600">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Telemetry Feed</h2>
            <p className="text-sm font-bold text-slate-900 tracking-tight">
              {telemetry ? telemetry.vehicle_id.toUpperCase() : 'NO VEHICLE'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/60 rounded-full px-2.5 py-1">
          <span className={`w-2 h-2 rounded-full ${statusConfig.dot}`} />
          <span className={`text-xs font-medium ${statusConfig.text}`}>{statusConfig.label}</span>
        </div>
      </div>

      {telemetry ? (
        <div className="space-y-3">
          {/* Speed Display */}
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-500">
              <Gauge className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-medium">Speed</span>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold font-mono text-slate-900">{telemetry.speed.toFixed(1)}</span>
              <span className="text-xs font-medium text-slate-500 ml-1">km/h</span>
            </div>
          </div>

          {/* Coordinates & Heading */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
              <span className="text-slate-400 block mb-0.5 font-medium">Coordinates</span>
              <span className="font-mono font-medium text-slate-700 block truncate">
                {telemetry.lat.toFixed(4)}, {telemetry.lng.toFixed(4)}
              </span>
            </div>
            <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
              <span className="text-slate-400 block mb-0.5 font-medium">Heading</span>
              <div className="flex items-center gap-1 font-mono font-medium text-slate-700">
                <Navigation
                  className="w-3.5 h-3.5 text-slate-500 transition-transform duration-300"
                  style={{ transform: `rotate(${telemetry.heading || 0}deg)` }}
                />
                <span>{Math.round(telemetry.heading || 0)}°</span>
              </div>
            </div>
          </div>

          {/* Last Seen Footer */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> Last packet
            </span>
            <span className="font-medium text-slate-600">
              {secondsAgo === null || secondsAgo === 0 ? 'Just now' : `${secondsAgo}s ago`}
            </span>
          </div>
        </div>
      ) : (
        <div className="py-6 text-center text-slate-400">
          <p className="text-xs">Waiting for device telemetry...</p>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">Topic: shuttle/fleet/v1/+/telemetry</p>
        </div>
      )}
    </div>
  );
};
