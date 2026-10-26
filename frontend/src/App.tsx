import { useState, useEffect } from 'react';
import { useShuttleTelemetry } from './hooks/useShuttleTelemetry';
import { useDailyMetrics } from './hooks/useDailyMetrics';
import { ShuttleMap, DEFAULT_CENTER } from './components/ShuttleMap';
import { TelemetryHUD } from './components/TelemetryHUD';
import { FleetPanel } from './components/FleetPanel';
import { DailyMetricsModal } from './components/DailyMetricsModal';
import { DailyDistanceTable } from './components/DailyDistanceTable';
import { Bus, Maximize2, Minimize2, BarChart3 } from 'lucide-react';
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

  const { dailyMetrics, totalFleetDistanceKm } = useDailyMetrics(vehicles);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMapFullscreen && !isAnalyticsOpen) {
        setIsMapFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMapFullscreen, isAnalyticsOpen]);

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

  const handleOpenVehicleMap = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    setIsMapFullscreen(true);
  };

  const getConnectionDot = (s: string) => {
    switch (s) {
      case 'connected':
        return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]';
      case 'connecting':
        return 'bg-amber-500 animate-pulse';
      case 'disconnected':
      case 'error':
      default:
        return 'bg-rose-500';
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Top Header (compact mode only) */}
      {!isMapFullscreen && (
        <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 md:px-6 flex items-center justify-between z-10 sticky top-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm md:text-base font-bold uppercase tracking-wider text-white">Shuttle Tracker</h1>
              <p className="text-[10px] md:text-xs text-slate-400 font-mono">Multi-Vehicle Fleet Gateway</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Connection status badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs font-medium text-slate-300">
              <span className={`w-2 h-2 rounded-full ${getConnectionDot(status)}`} />
              <span className="capitalize">{status}</span>
            </div>
            {/* Analytics shortcut button */}
            <button
              onClick={() => setIsAnalyticsOpen(true)}
              aria-label="Analytics"
              title="Daily Fleet Analytics"
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/80 transition-all text-xs font-medium shadow-sm hover:border-slate-600"
            >
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Analytics</span>
            </button>
          </div>
        </header>
      )}

      {/* Main Grid */}
      <main className="flex-1 p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 max-w-7xl mx-auto w-full">
        {/* Left Column: Map Card & Telemetry HUD & Daily Distance Table */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className={isMapFullscreen ? '' : 'bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col gap-3'}>
            {!isMapFullscreen && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-sm font-semibold text-slate-200">Fleet Live Map</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {fleetStats.onlineVehicles} online
                  </span>
                </div>
                <button
                  onClick={() => setIsMapFullscreen(true)}
                  aria-label="Expand map to full screen"
                  title="Expand map to full screen"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/70 text-xs font-medium transition-colors"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Expand</span>
                </button>
              </div>
            )}

            {/* Map Container: transitions between compact card frame and z-[1500] fullscreen viewport */}
            <div
              className={
                isMapFullscreen
                  ? 'fixed inset-0 z-[1500] w-screen h-screen bg-slate-950 flex flex-col select-none overflow-hidden'
                  : 'h-[440px] md:h-[480px] w-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-xl relative'
              }
            >
              {/* Single Persistent Map Instance */}
              <div className="w-full h-full relative">
                <ShuttleMap
                  vehicles={vehicles}
                  lastSeenMap={lastSeenMap}
                  now={now}
                  selectedVehicleId={selectedVehicleId}
                  onSelectVehicle={setSelectedVehicleId}
                  defaultCenter={DEFAULT_CENTER}
                  zoom={14}
                  isFullscreen={isMapFullscreen}
                />
              </div>

              {/* Fullscreen Overlays */}
              {isMapFullscreen && (
                <>
                  {/* Floating Top Controls */}
                  <div className="absolute top-4 left-4 right-4 z-[1000] flex items-center justify-between pointer-events-none">
                    <div className="flex items-center gap-2.5 bg-slate-900/90 backdrop-blur-md border border-slate-800 px-3.5 py-2 rounded-xl shadow-lg pointer-events-auto">
                      <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
                        <Bus className="w-4 h-4" />
                      </div>
                      <div>
                        <h1 className="text-xs font-bold uppercase tracking-wider text-white">Shuttle Tracker</h1>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {selectedVehicleId ? `Tracking ${selectedVehicleId}` : `${fleetStats.onlineVehicles} / ${fleetStats.totalVehicles} online`}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setIsMapFullscreen(false)}
                      aria-label="Exit full screen"
                      title="Exit full screen (Esc)"
                      className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-800 shadow-xl backdrop-blur-md transition-colors text-xs font-semibold pointer-events-auto"
                    >
                      <Minimize2 className="w-4 h-4 text-emerald-400" />
                      <span>Exit full screen</span>
                      <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 border border-slate-700 rounded text-slate-400">Esc</kbd>
                    </button>
                  </div>

                  {/* Floating TelemetryHUD */}
                  <TelemetryHUD
                    className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-[92vw] max-w-xl"
                    telemetry={selectedVehicle}
                    status={status}
                    lastSeen={activeLastSeen}
                    totalVehicles={fleetStats.totalVehicles}
                    fleetStats={fleetStats}
                    isOnline={isOnline}
                    now={now}
                  />

                  {/* Floating FleetPanel */}
                  <FleetPanel
                    className="absolute top-16 right-4 z-[1000] w-72 max-w-[calc(100vw-2rem)] flex flex-col gap-2"
                    vehicles={vehicles}
                    lastSeenMap={lastSeenMap}
                    selectedVehicleId={selectedVehicleId}
                    onSelectVehicle={setSelectedVehicleId}
                    now={now}
                    dailyMetrics={dailyMetrics}
                    onOpenAnalytics={() => setIsAnalyticsOpen(true)}
                  />
                </>
              )}
            </div>
          </div>

          {/* Compact TelemetryHUD */}
          {!isMapFullscreen && (
            <TelemetryHUD
              className="w-full relative"
              telemetry={selectedVehicle}
              status={status}
              lastSeen={activeLastSeen}
              totalVehicles={fleetStats.totalVehicles}
              fleetStats={fleetStats}
              isOnline={isOnline}
              now={now}
            />
          )}

          {/* Daily Distance Table (compact mode only) */}
          {!isMapFullscreen && (
            <DailyDistanceTable
              dailyMetrics={dailyMetrics}
              vehicles={vehicles}
              lastSeenMap={lastSeenMap}
              selectedVehicleId={selectedVehicleId}
              onOpenVehicleMap={handleOpenVehicleMap}
              now={now}
            />
          )}
        </div>

        {/* Right Column: FleetPanel (compact mode only) */}
        {!isMapFullscreen && (
          <div className="lg:col-span-4 flex flex-col gap-4">
            <FleetPanel
              className="w-full flex flex-col gap-2"
              vehicles={vehicles}
              lastSeenMap={lastSeenMap}
              selectedVehicleId={selectedVehicleId}
              onSelectVehicle={setSelectedVehicleId}
              now={now}
              dailyMetrics={dailyMetrics}
              onOpenAnalytics={() => setIsAnalyticsOpen(true)}
            />
          </div>
        )}
      </main>

      {/* Daily Metrics Analytics Modal */}
      <DailyMetricsModal
        isOpen={isAnalyticsOpen}
        onClose={() => setIsAnalyticsOpen(false)}
        dailyMetrics={dailyMetrics}
        totalFleetDistanceKm={totalFleetDistanceKm}
      />
    </div>
  );
}

export default App;
