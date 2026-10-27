import React, { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { getAllMapProviders, getMapProvider, MapProviderConfig } from '../services/mapProviders';
import { AnimatedVehicleMarker } from './AnimatedVehicleMarker';
import { TelemetryPayload } from '../types/telemetry';
import { MapLibreLayer } from './MapLibreLayer';

export interface MapProviderTestLabProps {
  onBack?: () => void;
  initialProviderId?: string;
  initialTheme?: 'light' | 'dark';
}

const DEFAULT_CENTER: [number, number] = [13.7563, 100.5018];
const DEFAULT_ZOOM = 15;

const SAMPLE_VEHICLE: TelemetryPayload = {
  vehicle_id: 'LAB-01',
  lat: 13.7563,
  lng: 100.5018,
  speed: 28.5,
  heading: 45,
  timestamp: Date.now(),
};

// Camera synchronizer for Grid Compare mode
export const CameraSyncController: React.FC<{
  center: [number, number];
  zoom: number;
  onCameraChange: (center: [number, number], zoom: number) => void;
}> = ({ center, zoom, onCameraChange }) => {
  const map = useMap();
  const isProgrammaticRef = useRef(false);

  useMapEvents({
    moveend: () => {
      if (isProgrammaticRef.current) {
        isProgrammaticRef.current = false;
        return;
      }
      const c = map.getCenter();
      const z = map.getZoom();
      onCameraChange([c.lat, c.lng], z);
    },
  });

  useEffect(() => {
    const cur = map.getCenter();
    const curZoom = map.getZoom();
    if (
      Math.abs(cur.lat - center[0]) > 0.0001 ||
      Math.abs(cur.lng - center[1]) > 0.0001 ||
      curZoom !== zoom
    ) {
      isProgrammaticRef.current = true;
      map.setView(center, zoom, { animate: false });
    }
  }, [center, zoom, map]);

  return null;
};

// Helper to render layer according to vector vs raster
function ProviderMapLayer({ provider }: { provider: MapProviderConfig }) {
  if (provider.isVector) {
    return <MapLibreLayer style={provider.tileUrl} attribution={provider.attribution} />;
  }
  return (
    <TileLayer
      key={provider.id}
      attribution={provider.attribution}
      url={provider.tileUrl}
      maxZoom={provider.maxZoom}
      subdomains={provider.subdomains || 'abc'}
    />
  );
}

export const MapProviderTestLab: React.FC<MapProviderTestLabProps> = ({
  onBack,
  initialProviderId = 'osm',
  initialTheme = 'light',
}) => {
  // Website UI theme toggle with 'light' as the default
  const [uiTheme, setUiTheme] = useState<'light' | 'dark'>(initialTheme);
  const [viewMode, setViewMode] = useState<'single' | 'grid'>('single');
  const [activeProviderId, setActiveProviderId] = useState<string>(initialProviderId);
  const [showShuttle, setShowShuttle] = useState<boolean>(true);

  // Synchronized camera state for Grid Compare mode
  const [syncCenter, setSyncCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [syncZoom, setSyncZoom] = useState<number>(DEFAULT_ZOOM);

  const providers = getAllMapProviders();
  const activeProvider = getMapProvider(activeProviderId);

  const isLight = uiTheme === 'light';

  // Theme-aware styles
  const containerClass = isLight
    ? 'bg-slate-100 text-slate-900'
    : 'bg-slate-950 text-slate-100';

  const cardClass = isLight
    ? 'bg-white border-slate-200 text-slate-900 shadow-sm'
    : 'bg-slate-900 border-slate-800 text-slate-100 shadow-md';

  const headerClass = isLight
    ? 'bg-white/95 border-slate-200 text-slate-900'
    : 'bg-slate-900/95 border-slate-800 text-slate-100';

  const secondaryTextClass = isLight ? 'text-slate-500' : 'text-slate-400';
  const badgeClass = isLight
    ? 'bg-slate-100 text-slate-700 border-slate-200'
    : 'bg-slate-800 text-slate-300 border-slate-700';

  return (
    <div className={`min-h-screen flex flex-col ${containerClass} transition-colors duration-200`}>
      {/* Top Navigation Header */}
      <header className={`sticky top-0 z-[1000] border-b px-4 py-3 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 ${headerClass}`}>
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                isLight
                  ? 'hover:bg-slate-100 border-slate-300 text-slate-700'
                  : 'hover:bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              ← Back
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🗺️</span>
              <h1 className="text-base font-bold tracking-tight">Map Provider Lab</h1>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
              }`}>
                5 Providers (Light Styles)
              </span>
            </div>
            <p className={`text-xs ${secondaryTextClass}`}>
              Benchmarking OpenStreetMap, OpenFreeMap, MapTiler, Stadia Maps, and Longdo Map
            </p>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* UI Theme Toggle */}
          <div className={`flex items-center rounded-lg border p-0.5 text-xs font-medium ${
            isLight ? 'bg-slate-200/80 border-slate-300' : 'bg-slate-800 border-slate-700'
          }`}>
            <button
              onClick={() => setUiTheme('light')}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                isLight
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>☀️</span>
              <span>Light (Default)</span>
            </button>
            <button
              onClick={() => setUiTheme('dark')}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                !isLight
                  ? 'bg-slate-900 text-white shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🌙</span>
              <span>Dark</span>
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className={`flex items-center rounded-lg border p-0.5 text-xs font-medium ${
            isLight ? 'bg-slate-200/80 border-slate-300' : 'bg-slate-800 border-slate-700'
          }`}>
            <button
              onClick={() => setViewMode('single')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                viewMode === 'single'
                  ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                  : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Single View
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                viewMode === 'grid'
                  ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                  : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Grid Compare
            </button>
          </div>

          {/* Shuttle Marker Preview Toggle */}
          <button
            onClick={() => setShowShuttle(!showShuttle)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5 ${
              showShuttle
                ? isLight
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-emerald-950/60 text-emerald-300 border-emerald-700'
                : isLight
                  ? 'bg-white text-slate-500 border-slate-300'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <span>🚐</span>
            <span>Shuttle Icon: {showShuttle ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 flex flex-col gap-4">
        {viewMode === 'single' ? (
          /* Single Provider View */
          <div className="flex-1 flex flex-col gap-3">
            {/* Provider Switcher Bar */}
            <div className={`p-2 rounded-xl border flex flex-wrap items-center gap-2 ${cardClass}`}>
              <span className={`text-xs font-semibold px-2 ${secondaryTextClass}`}>Provider:</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {providers.map((p) => {
                  const isSelected = p.id === activeProviderId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setActiveProviderId(p.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : isLight
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                      }`}
                    >
                      <span>{p.name}</span>
                      <span className={`text-[10px] px-1 rounded ${
                        isSelected
                          ? 'bg-emerald-700/60 text-white'
                          : isLight
                            ? 'bg-slate-200 text-slate-600'
                            : 'bg-slate-900 text-slate-400'
                      }`}>
                        {p.category}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Provider Metadata Banner */}
            <div className={`px-4 py-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs ${cardClass}`}>
              <div className="flex items-center gap-3">
                <span className="font-bold text-sm">{activeProvider.name}</span>
                <span className={`px-2 py-0.5 rounded-md border text-[11px] ${badgeClass}`}>
                  {activeProvider.description}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-mono">
                <span>Max Zoom: {activeProvider.maxZoom}</span>
                <span>•</span>
                <span className={activeProvider.keyRequired
                  ? isLight ? 'text-amber-700 font-semibold' : 'text-amber-400 font-semibold'
                  : isLight ? 'text-emerald-700 font-semibold' : 'text-emerald-400 font-semibold'
                }>
                  {activeProvider.keyRequired ? '🔑 Key Authenticated' : '🔓 Public Free'}
                </span>
              </div>
            </div>

            {/* Interactive Map View (Preserves Center & Zoom across provider switches) */}
            <div className={`flex-1 min-h-[500px] h-[calc(100vh-230px)] rounded-xl overflow-hidden border shadow-inner relative ${cardClass}`}>
              <MapContainer
                center={DEFAULT_CENTER}
                zoom={DEFAULT_ZOOM}
                className="w-full h-full"
                zoomControl={true}
              >
                <ProviderMapLayer key={activeProvider.id} provider={activeProvider} />
                {showShuttle && (
                  <AnimatedVehicleMarker
                    vehicle={SAMPLE_VEHICLE}
                    isSelected={true}
                    isOnline={true}
                  />
                )}
              </MapContainer>
            </div>
          </div>
        ) : (
          /* Grid Comparison View with Synchronized Camera */
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold flex items-center gap-2">
                  <span>📊</span>
                  <span>Comparing 5 Providers</span>
                </h2>
                <p className={`text-xs ${secondaryTextClass}`}>
                  Synchronized benchmark rendering Light map tiles for each provider with top-down shuttle icon
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {providers.map((provider) => (
                <div
                  key={provider.id}
                  className={`rounded-xl border overflow-hidden flex flex-col ${cardClass}`}
                >
                  {/* Grid Card Header */}
                  <div className={`px-3 py-2.5 border-b flex items-center justify-between ${headerClass}`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs">{provider.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${badgeClass}`}>
                          {provider.category}
                        </span>
                      </div>
                      <p className={`text-[11px] truncate max-w-[260px] ${secondaryTextClass}`}>
                        {provider.description}
                      </p>
                    </div>
                    {provider.keyRequired ? (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono border ${
                        isLight
                          ? 'bg-amber-100 text-amber-700 border-amber-300'
                          : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      }`}>
                        Keyed
                      </span>
                    ) : (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono border ${
                        isLight
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                          : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      }`}>
                        Free
                      </span>
                    )}
                  </div>

                  {/* Mini Map */}
                  <div className="h-64 relative">
                    <MapContainer
                      center={syncCenter}
                      zoom={syncZoom}
                      className="w-full h-full"
                      zoomControl={false}
                    >
                      <CameraSyncController
                        center={syncCenter}
                        zoom={syncZoom}
                        onCameraChange={(c, z) => {
                          setSyncCenter(c);
                          setSyncZoom(z);
                        }}
                      />
                      <ProviderMapLayer provider={provider} />
                      {showShuttle && (
                        <AnimatedVehicleMarker
                          vehicle={SAMPLE_VEHICLE}
                          isSelected={true}
                          isOnline={true}
                        />
                      )}
                    </MapContainer>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
