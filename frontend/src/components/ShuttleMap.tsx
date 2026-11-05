import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { LocateFixed } from 'lucide-react';
import { FleetMap, TelemetryPayload } from '../types/telemetry';
import { computeVehicleStatus, OFFLINE_THRESHOLD_MS } from '../services/fleetStatus';
import { isJumpTooLarge } from '../services/markerInterpolation';
import { AnimatedVehicleMarker } from './AnimatedVehicleMarker';
import { MAP_PROVIDERS } from '../services/mapProviders';

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

// SVG top-down shuttle van marker with headlight beam, van body, and fixed vehicle badge
export function createVehicleIcon(
  heading: number = 0,
  isSelected: boolean = false,
  vehicleId: string = '',
  isOnline: boolean = true
) {
  const safeVehicleId = escapeHtml(vehicleId);
  const primaryColor = !isOnline ? '#64748b' : isSelected ? '#34d399' : '#10b981';
  const borderColor = !isOnline ? '#94a3b8' : isSelected ? '#6ee7b7' : '#ffffff';
  const overallOpacity = !isOnline ? '0.6' : '1';
  const pulseHtml = isOnline
    ? `<div style="position: absolute; width: 44px; height: 44px; background: rgba(16, 185, 129, ${isSelected ? '0.35' : '0.15'}); border-radius: 9999px; animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></div>`
    : '';

  const cleanId = vehicleId ? vehicleId.replace(/[^a-zA-Z0-9_-]/g, '_') : 'default';
  const gradientId = `headlight-glow-${cleanId}`;

  const headlightGradient = isOnline
    ? `<defs>
        <linearGradient id="${gradientId}" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stop-color="${primaryColor}" stop-opacity="0.6"/>
          <stop offset="100%" stop-color="${primaryColor}" stop-opacity="0"/>
        </linearGradient>
       </defs>`
    : '';

  const headlightBeam = isOnline
    ? `<path class="headlight-beam" d="M 9 10 L 3 0 L 23 0 L 17 10 Z" fill="url(#${gradientId})" pointer-events="none" />`
    : '';

  const html = `
    <div style="position: relative; width: 52px; height: 52px; display: flex; align-items: center; justify-content: center; opacity: ${overallOpacity};">
      <!-- Vehicle ID Pill Badge (Fixed horizontal orientation) -->
      <div style="position: absolute; top: -14px; background: rgba(15, 23, 42, 0.95); color: #ffffff; font-size: 9px; font-weight: bold; font-family: monospace; padding: 1px 6px; border-radius: 4px; border: 1px solid ${borderColor}; white-space: nowrap; box-shadow: 0 2px 5px rgba(0,0,0,0.3); pointer-events: none; z-index: 10;">
        ${safeVehicleId}
      </div>
      <!-- Pulse Ring -->
      ${pulseHtml}
      <!-- Rotational Top-Down Van Body -->
      <div class="shuttle-van-body" style="position: relative; width: 26px; height: 42px; display: flex; align-items: center; justify-content: center; transform: rotate(${heading}deg); transition: transform 0.4s cubic-bezier(0.2, 0, 0, 1);">
        <svg width="26" height="42" viewBox="0 0 26 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          ${headlightGradient}
          <!-- Forward Headlight Beam Cone -->
          ${headlightBeam}
          <!-- Side Mirrors -->
          <rect x="1" y="14" width="2" height="4" rx="1" fill="${borderColor}" />
          <rect x="23" y="14" width="2" height="4" rx="1" fill="${borderColor}" />
          <!-- Wheels -->
          <rect x="1.5" y="10" width="1.5" height="5" rx="0.75" fill="#0f172a" />
          <rect x="23" y="10" width="1.5" height="5" rx="0.75" fill="#0f172a" />
          <rect x="1.5" y="28" width="1.5" height="5" rx="0.75" fill="#0f172a" />
          <rect x="23" y="28" width="1.5" height="5" rx="0.75" fill="#0f172a" />
          <!-- Van Chassis Shell -->
          <rect x="3" y="9" width="20" height="28" rx="4" fill="#0f172a" stroke="${borderColor}" stroke-width="1.8" />
          <!-- Front Hood Curve -->
          <path d="M 4 12 C 4 9.5 7 8 13 8 C 19 8 22 9.5 22 12 Z" fill="#1e293b" />
          <!-- Windshield Glass -->
          <path d="M 5 14 C 5 12.5 8 11.5 13 11.5 C 18 11.5 21 12.5 21 14 L 20 18 L 6 18 Z" fill="#38bdf8" fill-opacity="0.85" />
          <!-- Front Headlight Lamps -->
          <circle cx="6" cy="9.5" r="1.5" fill="${primaryColor}" />
          <circle cx="20" cy="9.5" r="1.5" fill="${primaryColor}" />
          <!-- Side Passenger Windows -->
          <rect x="4.5" y="19.5" width="2" height="12" rx="0.8" fill="#38bdf8" fill-opacity="0.65" />
          <rect x="19.5" y="19.5" width="2" height="12" rx="0.8" fill="#38bdf8" fill-opacity="0.65" />
          <!-- Shuttle Passenger Cabin Roof Ridge -->
          <line x1="8.5" y1="20" x2="8.5" y2="31" stroke="${primaryColor}" stroke-width="1" stroke-opacity="0.4" />
          <line x1="17.5" y1="20" x2="17.5" y2="31" stroke="${primaryColor}" stroke-width="1" stroke-opacity="0.4" />
          <rect x="10" y="22" width="6" height="8" rx="1.5" fill="#1e293b" stroke="${primaryColor}" stroke-width="1" stroke-opacity="0.5" />
          <!-- Rear Window Glass -->
          <rect x="6" y="33.5" width="14" height="2" rx="0.8" fill="#38bdf8" fill-opacity="0.7" />
          <!-- Rear Taillights -->
          <rect x="4.5" y="36" width="2.5" height="1" rx="0.5" fill="#ef4444" />
          <rect x="19" y="36" width="2.5" height="1" rx="0.5" fill="#ef4444" />
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