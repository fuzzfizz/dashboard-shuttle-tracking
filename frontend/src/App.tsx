import { useShuttleTelemetry } from './hooks/useShuttleTelemetry';
import { ShuttleMap, DEFAULT_CENTER } from './components/ShuttleMap';
import { TelemetryHUD } from './components/TelemetryHUD';
import { FleetPanel } from './components/FleetPanel';
import { Bus } from 'lucide-react';
import { calculateFleetStats, computeVehicleStatus } from './services/fleetStatus';

export function App() {
  const {
    status,
    vehicles,
    lastSeenMap,
    selectedVehicleId,
    setSelectedVehicleId,
    now,
  } = useShuttleTelemetry();

  const fleetStats = calculateFleetStats(vehicles, lastSeenMap, now);
  const lastSeenValues = Object.values(lastSeenMap);
  const latestFleetHeartbeat =
    lastSeenValues.length > 0 ? Math.max(...lastSeenValues) : null;

  const selectedVehicle = selectedVehicleId ? (vehicles[selectedVehicleId] ?? null) : null;
  const isOnline =
    selectedVehicle && selectedVehicleId
      ? computeVehicleStatus(selectedVehicle, lastSeenMap[selectedVehicleId] || 0, now).isOnline
      : undefined;

  const activeLastSeen = selectedVehicleId
    ? (lastSeenMap[selectedVehicleId] ?? null)
    : latestFleetHeartbeat;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-900 select-none">
      {/* Top minimal header brand */}
      <div className="absolute top-4 left-4 z-[1000] flex items-center gap-2.5 bg-white/95 backdrop-blur-sm border border-slate-200/80 px-3.5 py-2 rounded-xl shadow-md">
        <div className="p-1.5 bg-slate-900 text-white rounded-lg">
          <Bus className="w-4 h-4" />
        </div>
        <div>
          <h1 className="text-xs font-bold uppercase tracking-wider text-slate-800">Shuttle Tracker</h1>
          <p className="text-[10px] text-slate-400 font-mono">Multi-Vehicle Fleet Gateway</p>
        </div>
      </div>

      {/* Fleet Overview & Selector Panel */}
      <FleetPanel
        vehicles={vehicles}
        lastSeenMap={lastSeenMap}
        selectedVehicleId={selectedVehicleId}
        onSelectVehicle={setSelectedVehicleId}
        now={now}
      />

      {/* Floating HUD Card */}
      <TelemetryHUD
        telemetry={selectedVehicle}
        status={status}
        lastSeen={activeLastSeen}
        totalVehicles={fleetStats.totalVehicles}
        fleetStats={fleetStats}
        isOnline={isOnline}
        now={now}
      />

      {/* Interactive Map */}
      <ShuttleMap
        vehicles={vehicles}
        lastSeenMap={lastSeenMap}
        now={now}
        selectedVehicleId={selectedVehicleId}
        onSelectVehicle={setSelectedVehicleId}
        defaultCenter={DEFAULT_CENTER}
        zoom={14}
      />
    </div>
  );
}

export default App;