import React, { useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { getAllMapProviders, getMapProvider } from '../services/mapProviders';
import { AnimatedVehicleMarker } from './AnimatedVehicleMarker';
import { TelemetryPayload } from '../types/telemetry';

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

export const MapProviderTestLab: React.FC<MapProviderTestLabProps> = ({
  onBack,
  initialProviderId = 'osm',
  initialTheme = 'light',
}) => {
  const [uiTheme, setUiTheme] = useState<'light' | 'dark'>(initialTheme);
  const [viewMode, setViewMode] = useState<'single' | 'grid'>('single');
  const [activeProviderId, setActiveProviderId] = useState<string>(initialProviderId);
  const [showShuttle, setShowShuttle] = useState<boolean>(true);

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
      <header className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-4 sticky top-0 z-50 backdrop-blur-md ${headerClass}`}>
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
              }`}
            >
              ← Back
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🗺️</span>
              <h1 className="text-base sm:text-lg font-bold tracking-tight">Map Provider Lab</h1>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">
                Light Tiles Only
              </span>
            </div>
            <p className={`text-xs ${secondaryTextClass}`}>
              Benchmark and compare 5 map providers with the top-down shuttle van icon
            </p>
          </div>
        </div>

        {/* Global Controls: Theme, View Mode, Shuttle Icon */}
        <div className="flex flex-wrap items-center gap-2">
          {/* UI Theme Toggle */}
          <div className={`flex rounded-lg p-0.5 border ${isLight ? 'bg-slate-200/70 border-slate-300' : 'bg-slate-800/80 border-slate-700'}`}>
            <button
              onClick={() => setUiTheme('light')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                isLight
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Switch to Light Theme"
            >
              ☀️ Light
            </button>
            <button
              onClick={() => setUiTheme('dark')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                !isLight
                  ? 'bg-slate-900 text-white shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Switch to Dark Theme"
            >
              🌙 Dark
            </button>
          </div>

          {/* View Mode Toggle: Single vs Grid */}
          <div className={`flex rounded-lg p-0.5 border ${isLight ? 'bg-slate-200/70 border-slate-300' : 'bg-slate-800/80 border-slate-700'}`}>
            <button
              onClick={() => setViewMode('single')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === 'single'
                  ? isLight
                    ? 'bg-white text-slate-900 shadow-sm font-semibold'
                    : 'bg-slate-900 text-white shadow-sm font-semibold'
                  : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Single View
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === 'grid'
                  ? isLight
                    ? 'bg-white text-slate-900 shadow-sm font-semibold'
                    : 'bg-slate-900 text-white shadow-sm font-semibold'
                  : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Grid Compare
            </button>
          </div>

          {/* Shuttle Icon Toggle */}
          <button
            onClick={() => setShowShuttle(!showShuttle)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
              showShuttle
                ? isLight
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-emerald-950/60 text-emerald-300 border-emerald-600 hover:bg-emerald-900/60'
                : isLight
                  ? 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
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
            {/* Provider Selection Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-xs font-bold uppercase tracking-wider ${secondaryTextClass}`}>
                Providers:
              </span>
              {providers.map((p) => {
                const isActive = p.id === activeProviderId;
                return (
                  <button
                    key={p.id}
                    onClick={() => setActiveProviderId(p.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-2 ${
                      isActive
                        ? isLight
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-blue-500 text-white border-blue-500 shadow-sm'
                        : isLight
                          ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                          : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                    }`}
                  >
                    <span>{p.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-normal ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : isLight
                            ? 'bg-slate-100 text-slate-500'
                            : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {p.category}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Provider Details Bar */}
            <div className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${cardClass}`}>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{activeProvider.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${badgeClass}`}>
                    {activeProvider.category}
                  </span>
                  {activeProvider.keyRequired ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      API Key Required
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      No Key Required (Public)
                    </span>
                  )}
                  <span className={`text-xs ${secondaryTextClass}`}>
                    Max Zoom: {activeProvider.maxZoom}
                  </span>
                </div>
                <p className={`text-xs ${secondaryTextClass}`}>
                  {activeProvider.description}
                </p>
              </div>

              <div className={`text-[11px] font-mono px-2 py-1 rounded border max-w-md truncate ${badgeClass}`}>
                {activeProvider.tileUrl}
              </div>
            </div>

            {/* Interactive Map View */}
            <div className={`flex-1 min-h-[500px] h-[calc(100vh-230px)] rounded-xl overflow-hidden border shadow-inner relative ${cardClass}`}>
              <MapContainer
                key={activeProvider.id}
                center={DEFAULT_CENTER}
                zoom={DEFAULT_ZOOM}
                className="w-full h-full"
                zoomControl={true}
              >
                <TileLayer
                  attribution={activeProvider.attribution}
                  url={activeProvider.tileUrl}
                  maxZoom={activeProvider.maxZoom}
                  subdomains={activeProvider.subdomains || 'abc'}
                />
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
          /* Grid Comparison View */
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold flex items-center gap-2">
                  <span>📊</span>
                  <span>Comparing 5 Providers</span>
                </h2>
                <p className={`text-xs ${secondaryTextClass}`}>
                  Side-by-side benchmark rendering Light map tiles for each provider with top-down shuttle icon
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
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                        Keyed
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        Free
                      </span>
                    )}
                  </div>

                  {/* Mini Map */}
                  <div className="h-64 relative">
                    <MapContainer
                      center={DEFAULT_CENTER}
                      zoom={DEFAULT_ZOOM}
                      className="w-full h-full"
                      zoomControl={false}
                    >
                      <TileLayer
                        attribution={provider.attribution}
                        url={provider.tileUrl}
                        maxZoom={provider.maxZoom}
                        subdomains={provider.subdomains || 'abc'}
                      />
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
