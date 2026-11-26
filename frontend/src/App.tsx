import { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { useShuttleTelemetry } from './hooks/useShuttleTelemetry';
import { useDailyMetrics } from './hooks/useDailyMetrics';
import { useVehicleTripRoute } from './hooks/useVehicleTripRoute';
import { ShuttleMap, DEFAULT_CENTER } from './components/ShuttleMap';
import { TelemetryHUD } from './components/TelemetryHUD';
import { DailyDistanceTable, DistanceUnit } from './components/DailyDistanceTable';
import { FleetDistanceAnalyticsCard } from './components/FleetDistanceAnalyticsCard';
import { HistoricalTripReplay } from './components/HistoricalTripReplay';
import { Bus, Maximize2, Minimize2, Sun, Moon, Route } from 'lucide-react';
import { calculateFleetStats, computeVehicleStatus } from './services/fleetStatus';
import { fetchHistoricalVehicles } from './services/historicalTelemetryService';
import { ThemeProvider, useTheme } from './context/ThemeContext';
const MapProviderTestLab = lazy(() =>
  import('./components/MapProviderTestLab').then((m) => ({ default: m.MapProviderTestLab }))
);
const RouteCompareLab = lazy(() =>
  import('./components/RouteCompareLab').then((m) => ({ default: m.RouteCompareLab }))
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

  const { dailyMetrics, past7DayRecords, hourlyDistanceMap } = useDailyMetrics(vehicles);
  const {
    trips,
    actualPaths,
    roundStages,
    pinMode,
    isCalculating: isCalculatingRoute,
    error: routeError,
    startTrip,
    clearTrip,
    recordVehicleBreadcrumb,
    setPinMode,
  } = useVehicleTripRoute();

  const [pendingPoint, setPendingPoint] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    Object.values(vehicles).forEach((v) => {
      recordVehicleBreadcrumb(v.vehicle_id, v.lat, v.lng);
    });
  }, [vehicles, recordVehicleBreadcrumb]);

  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');
  const [dbVehicles, setDbVehicles] = useState<Array<{ id: string; name: string }>>([]);
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>(() => {
    try {
      const saved = localStorage.getItem('shuttle_distance_unit');
      if (saved === 'km' || saved === 'mile') return saved;
    } catch {
      // ignore
    }
    return 'km';
  });

  const handleDistanceUnitChange = (unit: DistanceUnit) => {
    setDistanceUnit(unit);
    try {
      localStorage.setItem('shuttle_distance_unit', unit);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchHistoricalVehicles().then((list) => {
      if (list && list.length > 0) {
        setDbVehicles(list);
      }
    });
  }, []);

  const telemetryVehicleIds = useMemo(
    () => Object.keys(vehicles).sort().join(','),
    [vehicles]
  );

  const vehicleList = useMemo(() => {
    const listMap = new Map<string, string>();
    // 1. Populate real vehicles queried from database
    dbVehicles.forEach((v) => listMap.set(v.id, v.name));
    // 2. Include live telemetry vehicles currently reporting
    Object.keys(vehicles).forEach((id) => {
      if (!listMap.has(id)) {
        listMap.set(id, id);
      }
    });
    // 3. Include currently selected vehicle if specified
    if (selectedVehicleId && !listMap.has(selectedVehicleId)) {
      listMap.set(selectedVehicleId, selectedVehicleId);
    }
    return Array.from(listMap.entries()).map(([id, name]) => ({ id, name }));
  }, [dbVehicles, telemetryVehicleIds, selectedVehicleId]);

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
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 sm:px-4 md:px-6 lg:px-8 flex items-center justify-between gap-2 z-[1100] sticky top-0 shadow-sm dark:shadow-lg">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-xl">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xs sm:text-sm md:text-base font-bold tracking-tight text-slate-900 dark:text-white leading-tight">ระบบติดตามรถรับส่ง</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-sans hidden sm:block">
                ติดตามตำแหน่งและระยะทางแบบเรียลไทม์
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-xl shrink-0" aria-label="Main Navigation">
            <button
              type="button"
              onClick={() => setActiveTab('today')}
              className={`min-h-[36px] sm:min-h-[38px] px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'today'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              วันนี้
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`min-h-[36px] sm:min-h-[38px] px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'history'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              ประวัติย้อนหลัง
            </button>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Connection status badge */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs font-medium text-slate-700 dark:text-slate-300">
              <span className={`w-2 h-2 rounded-full ${getConnectionDot(status)}`} />
              <span className="capitalize hidden xs:inline sm:inline">{status === 'connected' ? 'Live' : status}</span>
              <span className="capitalize xs:hidden sm:hidden">{status === 'connected' ? 'Live' : status}</span>
            </div>
            {/* Theme toggle button */}
            <button
              onClick={toggleTheme}
              aria-label={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              className="flex items-center justify-center p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700/80 transition-colors shadow-sm min-h-[38px] min-w-[38px]"
            >
              {theme === 'light' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-300" />}
            </button>
          </div>
        </header>
      )}

      {/* Content View */}
      {activeTab === 'today' ? (
        <main className="flex-1 px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 flex flex-col gap-4 sm:gap-6 w-full">
          {/* Full-Width Map Card */}
          <div className={isMapFullscreen ? '' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-sm dark:shadow-xl flex flex-col gap-3'}>
            {!isMapFullscreen && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-2.5">
                  <h2 className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                    <span>แผนที่ตำแหน่งรถสด</span> <span className="text-xs font-normal text-slate-400 dark:text-slate-500 ml-1">Fleet Live Map</span>
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    ออนไลน์ {fleetStats.onlineVehicles}
                  </span>
                  {fleetStats.totalVehicles - fleetStats.onlineVehicles > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                      ขาดสัญญาณ {fleetStats.totalVehicles - fleetStats.onlineVehicles}
                    </span>
                  )}
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700/60 hidden sm:inline-block">
                    Longdo Map
                  </span>
                  {selectedVehicleId && (
                    <button
                      type="button"
                      onClick={() => setSelectedVehicleId(null)}
                      data-testid="inline-overview-button"
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 dark:text-emerald-300 dark:border-emerald-800 text-xs font-medium transition-colors cursor-pointer"
                      title="กลับสู่มุมมองรถทั้งหมด"
                    >
                      <span>กำลังดู: <strong className="font-mono">{selectedVehicleId}</strong></span>
                      <span className="text-[10px] bg-emerald-200/70 dark:bg-emerald-800/80 px-1.5 py-0.5 rounded font-sans">✕ ดูรถทั้งหมด</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="#route-compare"
                    onClick={(e) => {
                      e.preventDefault();
                      window.history.pushState({}, '', '#route-compare');
                      window.dispatchEvent(new Event('hashchange'));
                    }}
                    title="ทดสอบเปรียบเทียบ Longdo Native vs OSRM"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 dark:text-indigo-300 dark:border-indigo-800 text-xs font-medium transition-colors min-h-[36px]"
                  >
                    <Route className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span className="hidden sm:inline">ห้องทดสอบเปรียบเทียบเส้นทาง</span>
                    <span className="sm:hidden">ทดสอบเส้นทาง</span>
                  </a>
                  <button
                    onClick={() => setIsMapFullscreen(true)}
                    aria-label="Expand map to full screen"
                    title="ขยายแผนที่เต็มจอ"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:hover:text-white dark:border-slate-700/70 text-xs font-medium transition-colors min-h-[36px]"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="hidden sm:inline">ขยายเต็มจอ</span>
                  </button>
                </div>
              </div>
            )}

            {/* Map Container */}
            <div
              className={
                isMapFullscreen
                  ? 'fixed inset-0 z-[1500] w-screen h-screen bg-slate-950 flex flex-col select-none overflow-hidden'
                  : 'h-[320px] sm:h-[420px] md:h-[540px] lg:h-[580px] xl:h-[640px] w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 shadow-xl relative'
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
                  activeTrip={selectedVehicleId ? trips[selectedVehicleId] : undefined}
                  actualPath={selectedVehicleId ? actualPaths[selectedVehicleId] : undefined}
                  roundStage={selectedVehicleId ? roundStages[selectedVehicleId] : undefined}
                  pinMode={pinMode}
                  onSetPinMode={setPinMode}
                  onStartTrip={startTrip}
                  onClearTrip={clearTrip}
                  pendingPoint={pendingPoint}
                  onMapClick={(lat, lng) => setPendingPoint({ lat, lng })}
                  isCalculatingRoute={isCalculatingRoute}
                  routeError={routeError}
                  vehicleIds={vehicleList.map((v) => v.id)}
                />
              </div>

              {/* Fullscreen Overlays */}
              {isMapFullscreen && (
                <>
                  {/* Floating Top Controls */}
                  <div className="absolute top-2 left-2 right-2 sm:top-4 sm:left-4 sm:right-4 z-[1000] flex items-center justify-between pointer-events-none gap-2">
                    <div className="flex items-center gap-2 sm:gap-2.5 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl shadow-md dark:shadow-lg pointer-events-auto shrink-0">
                      <div className="p-1 sm:p-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-lg">
                        <Bus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </div>
                      <div>
                        <h1 className="text-xs sm:text-sm font-bold tracking-tight text-slate-900 dark:text-white leading-tight">ระบบติดตามรถรับส่ง</h1>
                        <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-sans leading-tight">
                          {selectedVehicleId ? `กำลังติดตาม ${selectedVehicleId}` : `ออนไลน์ ${fleetStats.onlineVehicles} / ${fleetStats.totalVehicles}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto shrink-0">
                      {selectedVehicleId && (
                        <button
                          onClick={() => setSelectedVehicleId(null)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/95 hover:bg-slate-100 dark:bg-slate-900/90 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-xl backdrop-blur-md text-xs sm:text-sm font-medium transition-colors min-h-[38px]"
                          title="ดูรถทั้งหมด"
                        >
                          <span>ดูรถทั้งหมด</span>
                        </button>
                      )}
                      <button
                        onClick={toggleTheme}
                        aria-label={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
                        title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
                        className="flex items-center justify-center p-2 rounded-xl bg-white/95 hover:bg-slate-100 dark:bg-slate-900/90 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-xl backdrop-blur-md transition-colors min-h-[36px] min-w-[36px]"
                      >
                        {theme === 'light' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-300" />}
                      </button>

                      <button
                        onClick={() => setIsMapFullscreen(false)}
                        aria-label="Exit full screen"
                        title="ออกจากโหมดเต็มจอ (Esc)"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-white/95 hover:bg-slate-100 dark:bg-slate-900/90 dark:hover:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-xl backdrop-blur-md transition-colors text-xs font-semibold min-h-[36px]"
                      >
                        <Minimize2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>ออกจากเต็มจอ</span>
                        <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-500 dark:text-slate-400">Esc</kbd>
                      </button>
                    </div>
                  </div>

                  {/* Only display consumer-friendly Vehicle Card when focused on a specific vehicle */}
                  {selectedVehicle && (
                    <TelemetryHUD
                      className="absolute bottom-3 sm:bottom-6 left-2 right-2 sm:left-1/2 sm:-translate-x-1/2 z-[1000] w-auto sm:w-[92vw] sm:max-w-xl pb-[env(safe-area-inset-bottom)]"
                      telemetry={selectedVehicle}
                      status={status}
                      lastSeen={activeLastSeen}
                      totalVehicles={fleetStats.totalVehicles}
                      fleetStats={fleetStats}
                      isOnline={isOnline}
                      now={now}
                      dailyDistanceKm={selectedVehicleId ? dailyMetrics[selectedVehicleId]?.total_distance_km : undefined}
                      distanceUnit={distanceUnit}
                      onClose={() => setSelectedVehicleId(null)}
                    />
                  )}
                </>
              )}
            </div>
          </div>

          {/* Unified Fleet Distance Analytics Card (Option A) */}
          {!isMapFullscreen && (
            <FleetDistanceAnalyticsCard
              dailyMetrics={dailyMetrics}
              vehicles={vehicles}
              lastSeenMap={lastSeenMap}
              past7DayRecords={past7DayRecords}
              hourlyDistanceMap={hourlyDistanceMap}
              now={now}
            />
          )}

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
                distanceUnit={distanceUnit}
                onDistanceUnitChange={handleDistanceUnitChange}
              />
            </section>
          )}
        </main>
      ) : (
        <main className="flex-1 w-full overflow-hidden">
          <HistoricalTripReplay
            initialVehicleId={selectedVehicleId || undefined}
            vehicleList={vehicleList}
            onVehicleChange={setSelectedVehicleId}
          />
        </main>
      )}
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

  const isRouteCompareRoute =
    currentPath.startsWith('/route-compare') ||
    currentPath === '#route-compare' ||
    currentPath.endsWith('#route-compare') ||
    currentPath.startsWith('/route-test') ||
    currentPath === '#route-test' ||
    currentPath.endsWith('#route-test');

  if (isRouteCompareRoute) {
    return (
      <ThemeProvider>
        <Suspense
          fallback={
            <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-700 dark:text-slate-200">
              Loading Route Compare Lab...
            </div>
          }
        >
          <RouteCompareLab
            onBack={() => {
              window.history.pushState({}, '', '/');
              setCurrentPath('/');
            }}
          />
        </Suspense>
      </ThemeProvider>
    );
  }

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
