import React, { useState } from 'react';
import { Bus, Layers, Navigation, ChevronRight, ChevronDown, Radio } from 'lucide-react';
import { FleetMap } from '../types/telemetry';
import { computeVehicleStatus } from '../services/fleetStatus';

interface FleetPanelProps {
  vehicles: FleetMap;
  lastSeenMap: Record<string, number>;
  selectedVehicleId: string | null;
  onSelectVehicle: (vehicleId: string | null) => void;
  now?: number;
}

export const FleetPanel: React.FC<FleetPanelProps> = ({
  vehicles,
  lastSeenMap,
  selectedVehicleId,
  onSelectVehicle,
  now,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const vehicleList = Object.values(vehicles);
  const totalCount = vehicleList.length;

  return (
    <div className="absolute top-4 right-4 z-[1000] w-72 max-w-[calc(100vw-2rem)] flex flex-col gap-2">
      <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xl overflow-hidden transition-all duration-300">
        {/* Panel Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-emerald-500/10 text-emerald-600 rounded-lg">
              <Bus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Fleet Status</h2>
              <p className="text-[10px] text-slate-500 font-medium">
                {totalCount} {totalCount === 1 ? 'vehicle' : 'vehicles'} active
              </p>
            </div>
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
            className="p-1 hover:bg-slate-200/60 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {!collapsed && (
          <div className="p-2 space-y-1.5 max-h-[60vh] overflow-y-auto">
            {/* View All / Overview Button */}
            <button
              onClick={() => onSelectVehicle(null)}
              aria-label="All Vehicles (Overview)"
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                selectedVehicleId === null
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100/80'
              }`}
            >
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>All Vehicles (Overview)</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/20">
                Fit View
              </span>
            </button>

            {/* Vehicle List */}
            {totalCount === 0 ? (
              <div className="py-6 px-4 text-center">
                <Radio className="w-6 h-6 text-slate-300 mx-auto mb-2 animate-pulse" />
                <p className="text-xs text-slate-500 font-medium">Listening for vehicles...</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Publish telemetry to see fleet</p>
              </div>
            ) : (
              vehicleList.map((vehicle) => {
                const status = computeVehicleStatus(vehicle, lastSeenMap[vehicle.vehicle_id] || 0, now);
                const isSelected = selectedVehicleId === vehicle.vehicle_id;

                return (
                  <div
                    key={vehicle.vehicle_id}
                    onClick={() => onSelectVehicle(vehicle.vehicle_id)}
                    className={`group cursor-pointer flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/60 shadow-sm'
                        : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="relative flex h-2.5 w-2.5">
                        {status.isOnline && (
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        )}
                        <span
                          className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                            status.isOnline ? 'bg-emerald-500' : 'bg-amber-400'
                          }`}
                        ></span>
                      </span>
                      <div className="truncate">
                        <div className="text-xs font-bold text-slate-800 truncate">
                          {vehicle.vehicle_id}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                          <Navigation className="w-2.5 h-2.5" />
                          <span>{vehicle.heading ?? 0}°</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-slate-900">
                        {vehicle.speed.toFixed(1)} km/h
                      </div>
                      <div className="text-[9px] text-slate-400">
                        {status.isOnline ? 'Live' : 'Stale'}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
