import { useState, useEffect, Suspense, lazy } from 'react';
import { useShuttleTelemetry } from './hooks/useShuttleTelemetry';
import { useDailyMetrics } from './hooks/useDailyMetrics';
import { ShuttleMap, DEFAULT_CENTER } from './components/ShuttleMap';
import { TelemetryHUD } from './components/TelemetryHUD';
import { DailyDistanceTable } from './components/DailyDistanceTable';
import { Bus, Maximize2, Minimize2, BarChart3, Sun, Moon } from 'lucide-react';
import { calculateFleetStats, computeVehicleStatus } from './services/fleetStatus';
import { ThemeProvider, useTheme } from './context/ThemeContext';
const MapProviderTestLab = lazy(() =>
  import('./components/MapProviderTestLab').then((m) => ({ default: m.MapProviderTestLab }))
);

function OperationalDashboard() {
  const { theme, toggleTheme } = useTheme();
  const {
    status,
    vehicles,
    lastSeenMap,
    selectedVehicleId,
    setSelectedVehicleId,
    now,
  } = useShuttleTelemetry();

  const { dailyMetrics } = useDailyMetrics(vehicles);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMapFullscreen) {
        setIsMapFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMapFullscreen]);

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

  const handleScrollToAnalytics = () => {
    if (isMapFullscreen) {
      setIsMapFullscreen(false);
      setTimeout(() => {
        const el = document.getElementById('fleet-analytics');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }, 50);
      return;
    }
    const el = document.getElementById('fleet-analytics');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
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
    <div className={`min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex flex-col ${isMapFullscreen ? 'overflow-hidden h-screen' : ''}`}>
      {/* Top Header (compact mode only) */}
      {!isMapFullscreen && (
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 md:px-6 flex items-center justify-between z-[1100] sticky top-0 shadow-sm dark:shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-xl">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm md:text-base font-bold uppercase tracking-wider text-slate-900 dark:text-white">Shuttle Tracker</h1>
              <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-mono">Multi-Vehicle Fleet Gateway</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Connection status badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs font-medium text-slate-700 dark:text-slate-300">
              <span className={`w-2 h-2 rounded-full ${getConnectionDot(status)}`} />
              <span className="capitalize">{status === 'connected' ? 'Live' : status}</span>
            </div>
            {/* Analytics shortcut button */}
            <button
              onClick={handleScrollToAnalytics}
              aria-label="View Daily Analytics"
              title="View Daily Analytics"
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:hover:text-white dark:border-slate-700/80 transition-all text-xs font-medium shadow-sm hover:border-slate-300 dark:hover:border-slate-600"
            >
              <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">Analytics</span>
            </button>
            {/* Theme toggle button */}
            <button
              onClick={toggleTheme}
              aria-label={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              className="flex items-center justify-center p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700/80 transition-colors shadow-sm"
            >
              {theme === 'light' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-300" />}
            </button>
          </div>
        </header>
      )}

      {/* Main Container: Clean Full-Width Layout */}
      <main className="flex-1 p-4 md:p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full">
        {/* Full-Width Map Card */}
        <div className={isMapFullscreen ? '' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm dark:shadow-xl flex flex-col gap-3'}>
          {!isMapFullscreen && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Fleet Live Map</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {fleetStats.onlineVehicles} online
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700/60 hidden sm:inline-block">
                  Longdo Map
                </span>
              </div>
              <button
                onClick={() => setIsMapFullscreen(true)}
                aria-label="Expand map to full screen"
                title="Expand map to full screen"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:hover:text-white dark:border-slate-700/70 text-xs font-medium transition-colors"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Expand</span>
              </button>
            </div>
          )}

          {/* Map Container */}
          <div
            className={
              isMapFullscreen
                ? 'fixed inset-0 z-[1500] w-screen h-screen bg-slate-950 flex flex-col select-none overflow-hidden'
                : 'h-[500px] md:h-[540px] w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 shadow-xl relative'
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

                  <div className="flex items-center gap-2 pointer-events-auto">
                    {selectedVehicleId && (
                      <button
                        onClick={() => setSelectedVehicleId(null)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-800 shadow-xl backdrop-blur-md text-xs font-medium transition-colors"
                        title="View all vehicles"
                      >
                        <span>ดูรถทั้งหมด</span>
                      </button>
                    )}
                    <button
                      onClick={toggleTheme}
                      aria-label={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
                      title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
                      className="flex items-center justify-center p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-800 shadow-xl backdrop-blur-md transition-colors"
                    >
                      {theme === 'light' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-300" />}
                    </button>

                    <button
                      onClick={() => setIsMapFullscreen(false)}
                      aria-label="Exit full screen"
                      title="Exit full screen (Esc)"
                      className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-800 shadow-xl backdrop-blur-md transition-colors text-xs font-semibold"
                    >
                      <Minimize2 className="w-4 h-4 text-emerald-400" />
                      <span>Exit full screen</span>
                      <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 border border-slate-700 rounded text-slate-400">Esc</kbd>
                    </button>
                  </div>
                </div>

                {/* Only display consumer-friendly Vehicle Card when focused on a specific vehicle */}
                {selectedVehicle && (
                  <TelemetryHUD
                    className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-[92vw] max-w-xl"
                    telemetry={selectedVehicle}
                    status={status}
                    lastSeen={activeLastSeen}
                    totalVehicles={fleetStats.totalVehicles}
                    fleetStats={fleetStats}
                    isOnline={isOnline}
                    now={now}
                    dailyDistanceKm={selectedVehicleId ? dailyMetrics[selectedVehicleId]?.total_distance_km : undefined}
                    onClose={() => setSelectedVehicleId(null)}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* Full-Width Bottom Analytics Table */}
        {!isMapFullscreen && (
          <section id="fleet-analytics" className="w-full">
            <DailyDistanceTable
              dailyMetrics={dailyMetrics}
              vehicles={vehicles}
              lastSeenMap={lastSeenMap}
              selectedVehicleId={selectedVehicleId}
              onOpenVehicleMap={handleOpenVehicleMap}
              now={now}
            />
          </section>
        )}
      </main>
    </div>
  );
}

export function App() {
  const [currentPath, setCurrentPath] = useState(() =>
    typeof window !== 'undefined' ? window.location.pathname + window.location.hash : '/'
  );

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname + window.location.hash);
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const isMapTestRoute =
    currentPath.startsWith('/map-test') ||
    currentPath === '#map-test' ||
    currentPath.endsWith('#map-test');

  if (isMapTestRoute) {
    return (
      <ThemeProvider>
        <Suspense fallback={<div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-700">Loading Map Provider Lab...</div>}>
          <MapProviderTestLab
            onBack={() => {
              window.history.pushState({}, '', '/');
              setCurrentPath('/');
            }}
          />
        </Suspense>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <OperationalDashboard />
    </ThemeProvider>
  );
}

export default App;
