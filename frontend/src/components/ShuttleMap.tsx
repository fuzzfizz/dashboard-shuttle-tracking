import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { LocateFixed } from 'lucide-react';
import { FleetMap, TelemetryPayload } from '../types/telemetry';
import { computeVehicleStatus, OFFLINE_THRESHOLD_MS } from '../services/fleetStatus';
import { isJumpTooLarge } from '../services/markerInterpolation';
import { AnimatedVehicleMarker } from './AnimatedVehicleMarker';
import { MAP_PROVIDERS } from '../services/mapProviders';
import { VehicleTrip, TripLocation, MapPinMode } from '../types/trip';
import { TripRouteOverlay } from './TripRouteOverlay';
import { TripTestPanel } from './TripTestPanel';

// Primary map provider: Longdo Map (Thai localized high-detail cartography)
export const LONGDO_MAP_CONFIG = MAP_PROVIDERS.longdomap;

const customTileUrl = import.meta.env.VITE_TILE_URL;
const customAttribution = import.meta.env.VITE_TILE_ATTRIBUTION;

export const tileUrl = customTileUrl || LONGDO_MAP_CONFIG.tileUrl;
export const tileAttribution = customAttribution || LONGDO_MAP_CONFIG.attribution;
export const tileMaxZoom = LONGDO_MAP_CONFIG.maxZoom || 20;

export const DEFAULT_CENTER: [number, number] = [18.7883, 98.9853];

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface ShuttleMapProps {
  vehicles?: FleetMap;
  lastSeenMap?: Record<string, number>;
  now?: number;
  selectedVehicleId?: string | null;
  onSelectVehicle?: (vehicleId: string) => void;
  telemetry?: TelemetryPayload | null;
  defaultCenter?: [number, number];
  zoom?: number;
  isFullscreen?: boolean;
  activeTrip?: VehicleTrip;
  actualPath?: Array<[number, number]>;
  pinMode?: MapPinMode;
  onSetPinMode?: (mode: MapPinMode) => void;
  onStartTrip?: (vehicleId: string, pickup: TripLocation, dropoff: TripLocation) => void;
  onClearTrip?: (vehicleId: string) => void;
  pendingPoint?: { lat: number; lng: number } | null;
  onMapClick?: (lat: number, lng: number) => void;
  isCalculatingRoute?: boolean;
  routeError?: string | null;
  vehicleIds?: string[];
}

// Camera auto controller: handles overview (fitBounds) or focused tracking (panTo)
export const FleetCameraController: React.FC<{
  vehicles: FleetMap;
  selectedVehicleId: string | null;
  defaultCenter: [number, number];
}> = ({ vehicles, selectedVehicleId, defaultCenter }) => {
  const map = useMap();
  const prevSelectedRef = useRef<string | null>(null);
  const prevVehicleCountRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(false);
  const prevTargetCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const prevTimestampRef = useRef<number>(0);

  useEffect(() => {
    const vehicleList = Object.values(vehicles);
    const vehicleCount = vehicleList.length;
    const isInitialMount = !isMountedRef.current;
    const switchedToOverview = prevSelectedRef.current !== null && selectedVehicleId === null;
    const vehicleCountChanged = prevVehicleCountRef.current !== vehicleCount;
    const selectedChanged = prevSelectedRef.current !== selectedVehicleId;

    if (selectedVehicleId && vehicles[selectedVehicleId]) {
      // Focus Mode: follow single vehicle if target coordinates changed or selection changed
      const target = vehicles[selectedVehicleId];
      const prevCoords = prevTargetCoordsRef.current;
      const coordsChanged =
        selectedChanged ||
        !prevCoords ||
        prevCoords.lat !== target.lat ||
        prevCoords.lng !== target.lng;

      if (coordsChanged) {
        const isInitialFocus = selectedChanged || !prevCoords;
        const isFarJump = prevCoords
          ? isJumpTooLarge([prevCoords.lat, prevCoords.lng], [target.lat, target.lng], 2.0)
          : false;

        if (isInitialFocus || isFarJump) {
          // Initial focus or large jump: snap/quick pan directly to vehicle
          map.panTo([target.lat, target.lng], { animate: true, duration: 1.0 });
        } else {
          // Synchronize camera panning duration with the vehicle telemetry interval
          // Camera glides smoothly in unison with the vehicle marker without rushing ahead
          const timeDeltaSec = prevTimestampRef.current > 0
            ? (target.timestamp - prevTimestampRef.current) / 1000
            : 5.0;
          const duration = Math.max(1.0, Math.min(10.0, timeDeltaSec || 5.0));

          map.panTo([target.lat, target.lng], {
            animate: true,
            duration,
            easeLinearity: 0.1,
          });
        }

        prevTargetCoordsRef.current = { lat: target.lat, lng: target.lng };
        prevTimestampRef.current = target.timestamp;
      }
    } else {
      // Overview Mode / No focus
      prevTargetCoordsRef.current = null;
      prevTimestampRef.current = 0;

      if (vehicleCount > 1) {
        // Fleet Overview Mode: fit all active vehicles with padding
        // Only trigger fitBounds on initial mount, switch to overview, or vehicle count change
        if (isInitialMount || switchedToOverview || vehicleCountChanged) {
          const bounds = L.latLngBounds(vehicleList.map((v) => [v.lat, v.lng]));
          map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16, animate: true });
        }
      } else if (vehicleCount === 1) {
        // Single vehicle active: pan to it if count changed, switched mode, or initial mount
        if (isInitialMount || switchedToOverview || vehicleCountChanged) {
          map.panTo([vehicleList[0].lat, vehicleList[0].lng], { animate: true, duration: 0.8 });
        }
      } else {
        // Empty fleet: reset to default city center
        if (isInitialMount || vehicleCountChanged) {
          map.panTo(defaultCenter, { animate: true });
        }
      }
    }

    prevSelectedRef.current = selectedVehicleId;
    prevVehicleCountRef.current = vehicleCount;
    isMountedRef.current = true;
  }, [vehicles, selectedVehicleId, map, defaultCenter]);

  return null;
};

export const MapResizeHandler: React.FC<{ isFullscreen?: boolean }> = ({ isFullscreen }) => {
  const map = useMap();

  useEffect(() => {
    // Invalidate Leaflet canvas dimensions after transition/state update
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);

    const handleWindowResize = () => {
      map.invalidateSize();
    };

    window.addEventListener('resize', handleWindowResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [isFullscreen, map]);

  return null;
};

// SVG top-down minimalist shuttle marker with headlight beam, unibody, and vehicle license plate frame
// Styled in Faculty of Pharmacy, Chiang Mai University theme (สีเขียวมะกอก #5c990e & สีม่วงดอกรัก มช. #9e76b4)
export function createVehicleIcon(
  heading: number = 0,
  isSelected: boolean = false,
  vehicleId: string = '',
  isOnline: boolean = true
) {
  const safeVehicleId = escapeHtml(vehicleId);

  // Pharmacy CMU Theme:
  // Primary Faculty Color: Olive Green (สีเขียวมะกอก #5c990e / #4a7c0b)
  // CMU Dok Rak Purple Accent: #9e76b4
  const primaryColor = !isOnline ? '#64748b' : isSelected ? '#7bc818' : '#5c990e';
  const borderColor = !isOnline ? '#94a3b8' : isSelected ? '#bef264' : '#ffffff';
  const bodyColor = !isOnline ? '#334155' : isSelected ? '#43700b' : '#4a7c0b';
  const overallOpacity = !isOnline ? '0.6' : '1';
  const pulseHtml = isOnline
    ? `<div style="position: absolute; width: 44px; height: 44px; background: rgba(92, 153, 14, ${isSelected ? '0.4' : '0.18'}); border-radius: 9999px; animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></div>`
    : '';

  const cleanId = vehicleId ? vehicleId.replace(/[^a-zA-Z0-9_-]/g, '_') : 'default';
  const gradientId = `headlight-glow-${cleanId}`;

  const headlightGradient = isOnline
    ? `<defs>
        <linearGradient id="${gradientId}" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stop-color="${primaryColor}" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="${primaryColor}" stop-opacity="0"/>
        </linearGradient>
       </defs>`
    : '';

  const headlightBeam = isOnline
    ? `<path class="headlight-beam" d="M 9 10 L 3 0 L 23 0 L 17 10 Z" fill="url(#${gradientId})" pointer-events="none" />`
    : '';

  // License plate frame styling (กรอบป้ายทะเบียนรถ - ขอบหนาเสมือนป้ายจริง)
  const plateBg = isOnline ? '#ffffff' : '#f1f5f9';
  const plateTextColor = isOnline ? '#0f172a' : '#64748b';
  const plateBorderColor = !isOnline
    ? '#94a3b8'
    : isSelected
      ? '#4a7c0b'
      : '#1e293b';
  const plateBorder = `2px solid ${plateBorderColor}`;
  const plateShadow = !isOnline
    ? '0 1px 3px rgba(0,0,0,0.2), inset 0 0 0 1px rgba(0,0,0,0.1)'
    : isSelected
      ? '0 0 0 2px #5c990e, 0 3px 8px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(0,0,0,0.15)'
      : '0 2px 6px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(0,0,0,0.15)';
  const screwColor = !isOnline ? '#cbd5e1' : '#94a3b8';
  const screwBorder = !isOnline ? '#94a3b8' : '#475569';

  const html = `
    <div class="vehicle-marker-inner" style="position: relative; width: 52px; height: 52px; display: flex; align-items: center; justify-content: center; opacity: ${overallOpacity}; cursor: pointer; transform-origin: center center; transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.22s ease;">
      <!-- Vehicle License Plate Frame with Thick Border & Downward Pointer Arrow (กรอบป้ายทะเบียนรถขอบหนาพร้อมลูกศรชี้ลง - Fixed horizontal orientation) -->
      <div class="vehicle-license-plate" style="position: absolute; top: -14px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 4.5px; background: ${plateBg}; color: ${plateTextColor}; font-size: 9.5px; font-weight: 800; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; letter-spacing: 0.6px; padding: 2px 6.5px; border-radius: 4px; border: ${plateBorder}; box-shadow: ${plateShadow}; white-space: nowrap; pointer-events: none; z-index: 10; text-transform: uppercase; transition: box-shadow 0.22s ease;">
        <span style="display: inline-block; width: 3.5px; height: 3.5px; border-radius: 50%; background: ${screwColor}; border: 0.8px solid ${screwBorder}; flex-shrink: 0;"></span>
        <span style="line-height: 1.1;">${safeVehicleId}</span>
        <span style="display: inline-block; width: 3.5px; height: 3.5px; border-radius: 50%; background: ${screwColor}; border: 0.8px solid ${screwBorder}; flex-shrink: 0;"></span>
        <!-- Downward Arrow Pointer towards Vehicle (ลูกศรชี้ลงไปที่ตัวรถ ขอบหนาเข้ากับกรอบป้าย) -->
        <svg class="plate-pointer" width="8" height="5" viewBox="0 0 8 5" fill="none" xmlns="http://www.w3.org/2000/svg" style="position: absolute; bottom: -4.5px; left: 50%; transform: translateX(-50%); pointer-events: none; overflow: visible;">
          <path d="M 0 0 L 4 4.5 L 8 0 Z" fill="${plateBg}" />
          <path d="M 0.5 0 L 4 4 L 7.5 0" stroke="${plateBorderColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <!-- Pulse Ring -->
      ${pulseHtml}
      <!-- Rotational Top-Down Minimalist Shuttle Bus Body -->
      <div class="shuttle-van-body" style="position: relative; width: 26px; height: 42px; display: flex; align-items: center; justify-content: center; transform: rotate(${heading}deg); transition: transform 0.4s cubic-bezier(0.2, 0, 0, 1);">
        <svg width="26" height="42" viewBox="0 0 26 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          ${headlightGradient}
          <!-- Forward Headlight Beam Cone -->
          ${headlightBeam}
          <!-- Subtle Bus Drop Shadow -->
          <rect x="4.5" y="9.5" width="17" height="30" rx="3.5" fill="rgba(0,0,0,0.22)" />
          <!-- Pharmacy CMU Olive Green Shuttle Bus Chassis -->
          <rect x="4.5" y="8.5" width="17" height="30" rx="3.5" fill="${bodyColor}" stroke="${borderColor}" stroke-width="1.5" />
          <!-- Wide Front Bus Windshield (Span across front with short nose) -->
          <path d="M 5.8 12.5 C 6.5 10 9 9 13 9 C 17 9 19.5 10 20.2 12.5 L 19.8 15 L 6.2 15 Z" fill="#38bdf8" fill-opacity="0.9" />
          <!-- Passenger Cabin Side Windows (Continuous tinted glass strips) -->
          <rect x="5.5" y="16.5" width="1.8" height="17.5" rx="0.9" fill="#38bdf8" fill-opacity="0.65" />
          <rect x="18.7" y="16.5" width="1.8" height="17.5" rx="0.9" fill="#38bdf8" fill-opacity="0.65" />
          <!-- Shuttle Passenger Cabin Roof Panel with CMU Brand Accent -->
          <rect x="8" y="16" width="10" height="19" rx="1.5" fill="#2d4b06" fill-opacity="0.9" />
          <!-- CMU Dok Rak Purple Accent Stripe on Roof (มหาวิทยาลัยเชียงใหม่) -->
          <rect x="9.5" y="17" width="7" height="2" rx="0.5" fill="#9e76b4" fill-opacity="0.9" />
          <!-- Rooftop AC / Ventilation Unit (Distinctive Shuttle Bus / Van signature) -->
          <rect x="9.5" y="21" width="7" height="9" rx="1.5" fill="#1e3204" stroke="${primaryColor}" stroke-width="0.8" stroke-opacity="0.8" />
          <line x1="11" y1="23.5" x2="15" y2="23.5" stroke="${primaryColor}" stroke-width="0.8" stroke-opacity="0.7" />
          <line x1="11" y1="25.5" x2="15" y2="25.5" stroke="${primaryColor}" stroke-width="0.8" stroke-opacity="0.7" />
          <line x1="11" y1="27.5" x2="15" y2="27.5" stroke="${primaryColor}" stroke-width="0.8" stroke-opacity="0.7" />
          <!-- Rear Window Glass -->
          <rect x="7" y="36" width="12" height="1.8" rx="0.8" fill="#38bdf8" fill-opacity="0.75" />
          <!-- Front Headlight LED Lamps -->
          <circle cx="6.5" cy="9.5" r="1.2" fill="${primaryColor}" />
          <circle cx="19.5" cy="9.5" r="1.2" fill="${primaryColor}" />
          <!-- Rear Taillights -->
          <rect x="5.5" y="37.2" width="2.5" height="1" rx="0.5" fill="#ef4444" />
          <rect x="18" y="37.2" width="2.5" height="1" rx="0.5" fill="#ef4444" />
        </svg>
      </div>
    </div>
  `;
  return L.divIcon({
    html,
    className: 'custom-vehicle-marker',
    iconSize: [52, 52],
    iconAnchor: [26, 26],
  });
}

export const MapRecenterButton: React.FC<{
  vehicles: FleetMap;
  lastSeenMap?: Record<string, number>;
  now?: number;
  selectedVehicleId: string | null;
  defaultCenter: [number, number];
  isFullscreen?: boolean;
}> = ({ vehicles, lastSeenMap, now, selectedVehicleId, defaultCenter, isFullscreen }) => {
  const map = useMap();
  const vehicleList = Object.values(vehicles);
  const currentTime = now ?? Date.now();

  // 1. Filter only vehicles with valid numeric GPS coordinates (guard against 0,0 or NaN)
  const validVehicles = vehicleList.filter(
    (v) =>
      typeof v.lat === 'number' &&
      typeof v.lng === 'number' &&
      !isNaN(v.lat) &&
      !isNaN(v.lng) &&
      (Math.abs(v.lat) > 0.001 || Math.abs(v.lng) > 0.001)
  );

  // 2. Identify active online vehicles
  const onlineVehicles = validVehicles.filter((v) => {
    const lastSeen = lastSeenMap?.[v.vehicle_id] ?? v.timestamp ?? 0;
    return lastSeen > 0 && currentTime - lastSeen < OFFLINE_THRESHOLD_MS;
  });

  const isFocusingVehicle = Boolean(selectedVehicleId && vehicles[selectedVehicleId]);

  const handleRecenter = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (selectedVehicleId && vehicles[selectedVehicleId]) {
      // Single Vehicle Focus Mode: smoothly fly directly to the vehicle's live coordinates
      const target = vehicles[selectedVehicleId];
      if (
        typeof target.lat === 'number' &&
        typeof target.lng === 'number' &&
        !isNaN(target.lat) &&
        !isNaN(target.lng)
      ) {
        const currentZoom = map.getZoom();
        const targetZoom = Math.max(currentZoom, 15);
        map.flyTo([target.lat, target.lng], targetZoom, { duration: 0.8 });
      }
    } else {
      // Overview Mode: calculate bounding box to fit all active fleet vehicles on screen
      const targetFleet = onlineVehicles.length > 0 ? onlineVehicles : validVehicles;

      if (targetFleet.length > 1) {
        const bounds = L.latLngBounds(targetFleet.map((v) => [v.lat, v.lng]));
        if (bounds.isValid()) {
          const sw = bounds.getSouthWest();
          const ne = bounds.getNorthEast();
          // If all vehicles are clustered at the exact same location (e.g. terminal / garage)
          if (Math.abs(sw.lat - ne.lat) < 0.0001 && Math.abs(sw.lng - ne.lng) < 0.0001) {
            map.flyTo([sw.lat, sw.lng], 15, { duration: 0.8 });
          } else {
            map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16, animate: true });
          }
        }
      } else if (targetFleet.length === 1) {
        map.flyTo([targetFleet[0].lat, targetFleet[0].lng], 15, { duration: 0.8 });
      } else {
        map.flyTo(defaultCenter, 14, { duration: 0.8 });
      }
    }
  };

  const labelText = isFocusingVehicle
    ? 'กลับสู่ตำแหน่งรถ'
    : onlineVehicles.length > 1
      ? `จัดมุมมองรถทั้งหมด (${onlineVehicles.length} คัน)`
      : validVehicles.length > 1
        ? `จัดมุมมองรถทั้งหมด (${validVehicles.length} คัน)`
        : 'รีเซ็ตมุมมอง';

  const titleText = isFocusingVehicle
    ? `เลื่อนแผนที่กลับไปที่ตำแหน่งของ ${selectedVehicleId}`
    : `จัดมุมมองแผนที่ให้เห็นรถที่ให้บริการทั้งหมด (${onlineVehicles.length || validVehicles.length} คัน)`;

  // Avoid overlap with TelemetryHUD:
  // When in fullscreen mode and focusing a vehicle, TelemetryHUD is rendered at the bottom (height ~140-160px on mobile).
  // Position the button safely above TelemetryHUD (bottom-[180px] on mobile, sm:bottom-32 on desktop).
  // When in overview mode or non-fullscreen mode, TelemetryHUD is not present at the bottom, so position at bottom-4 / sm:bottom-6.
  const positionClass =
    isFullscreen && isFocusingVehicle
      ? 'bottom-[180px] right-3 sm:bottom-32 sm:right-6'
      : 'bottom-4 right-3 sm:bottom-6 sm:right-4';

  return (
    <div
      className={`absolute ${positionClass} z-[1001] pointer-events-auto transition-all duration-200`}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={handleRecenter}
        type="button"
        title={titleText}
        aria-label={titleText}
        data-testid="map-recenter-button"
        className="flex items-center gap-2 px-3.5 py-2.5 sm:px-4 sm:py-2.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/90 dark:border-slate-700/80 shadow-2xl backdrop-blur-md text-xs sm:text-sm font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer group min-h-[42px]"
      >
        <LocateFixed className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:rotate-45 transition-transform shrink-0" />
        <span className="font-sans leading-none">{labelText}</span>
      </button>
    </div>
  );
};

export const ShuttleMap: React.FC<ShuttleMapProps> = ({
  vehicles = {},
  lastSeenMap,
  now,
  selectedVehicleId = null,
  onSelectVehicle,
  telemetry,
  defaultCenter = DEFAULT_CENTER,
  zoom = 15,
  isFullscreen = false,
  activeTrip,
  actualPath,
  pinMode = 'idle',
  onSetPinMode,
  onStartTrip,
  onClearTrip,
  pendingPoint,
  onMapClick,
  isCalculatingRoute = false,
  routeError = null,
  vehicleIds,
}) => {
  // Merge backward compatibility prop telemetry if vehicles is empty
  const effectiveVehicles: FleetMap =
    Object.keys(vehicles).length > 0
      ? vehicles
      : telemetry
        ? { [telemetry.vehicle_id]: telemetry }
        : {};

  const vehicleList = Object.values(effectiveVehicles);
  const isSelectedVehicleMissing =
    Boolean(selectedVehicleId) && !effectiveVehicles[selectedVehicleId!];

  return (
    <div className="relative w-full h-full">
      {isSelectedVehicleMissing && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1001] bg-slate-900/95 border border-amber-500/40 text-amber-300 px-4 py-2.5 rounded-xl shadow-xl backdrop-blur-md flex items-center gap-2 text-xs font-medium pointer-events-none">
          <span className="flex h-2 w-2 rounded-full bg-amber-400" />
          <span>
            No GPS coordinates recorded for {selectedVehicleId} yet. Showing map overview.
          </span>
        </div>
      )}

      {/* Floating Route Testing Panel */}
      {(onStartTrip || (vehicleIds && vehicleIds.length > 0)) && (
        <div
          className={`absolute ${isFullscreen ? 'top-14 right-3 sm:top-16 sm:right-4' : 'top-3 right-3 sm:top-4 sm:right-4'} z-[1001] pointer-events-auto`}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <TripTestPanel
            vehicleIds={
              vehicleIds && vehicleIds.length > 0
                ? vehicleIds
                : Object.keys(effectiveVehicles).length > 0
                  ? Object.keys(effectiveVehicles)
                  : ['EV-01']
            }
            selectedVehicleId={selectedVehicleId}
            onSelectVehicle={onSelectVehicle || (() => {})}
            activeTrip={activeTrip}
            pinMode={pinMode || 'idle'}
            onSetPinMode={onSetPinMode || (() => {})}
            onStartTrip={onStartTrip || (() => {})}
            onClearTrip={onClearTrip || (() => {})}
            pendingPoint={pendingPoint}
            isCalculating={isCalculatingRoute}
            error={routeError}
          />
        </div>
      )}

      <MapContainer
        center={defaultCenter}
        zoom={zoom}
        zoomControl={false}
        attributionControl={false}
        className="w-full h-full"
      >
        <TileLayer
          attribution={tileAttribution}
          url={tileUrl}
          maxZoom={tileMaxZoom}
        />

        {/* Camera auto controller */}
        <FleetCameraController
          vehicles={effectiveVehicles}
          selectedVehicleId={selectedVehicleId}
          defaultCenter={defaultCenter}
        />

        {/* Leaflet resize invalidation handler */}
        <MapResizeHandler isFullscreen={isFullscreen} />

        {/* Floating Re-center / Focus map button */}
        <MapRecenterButton
          vehicles={effectiveVehicles}
          lastSeenMap={lastSeenMap}
          now={now}
          selectedVehicleId={selectedVehicleId}
          defaultCenter={defaultCenter}
          isFullscreen={isFullscreen}
        />

        {/* Planned Route & Live Path Overlay */}
        <TripRouteOverlay
          trip={activeTrip}
          actualPath={actualPath}
          pinMode={pinMode}
          onMapClick={onMapClick}
        />

        {/* Render animated vehicle markers with 60 FPS gliding */}
        {vehicleList.map((v) => {
          const isSelected = selectedVehicleId === v.vehicle_id;
          const isOnline = computeVehicleStatus(
            v,
            lastSeenMap?.[v.vehicle_id] || 0,
            now
          ).isOnline;

          return (
            <AnimatedVehicleMarker
              key={v.vehicle_id}
              vehicle={v}
              isSelected={isSelected}
              isOnline={isOnline}
              onSelectVehicle={onSelectVehicle}
            />
          );
        })}
      </MapContainer>
    </div>
  );
};