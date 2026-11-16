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

// SVG top-down minimalist shuttle marker with headlight beam, unibody, and vehicle license plate frame
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
          <stop offset="0%" stop-color="${primaryColor}" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="${primaryColor}" stop-opacity="0"/>
        </linearGradient>
       </defs>`
    : '';

  const headlightBeam = isOnline
    ? `<path class="headlight-beam" d="M 9 10 L 3 0 L 23 0 L 17 10 Z" fill="url(#${gradientId})" pointer-events="none" />`
    : '';

  // License plate frame styling (กรอบป้ายทะเบียนรถ)
  const plateBg = isOnline ? '#ffffff' : '#f1f5f9';
  const plateTextColor = isOnline ? '#0f172a' : '#64748b';
  const plateBorder = !isOnline
    ? '1.5px solid #94a3b8'
    : isSelected
      ? '1.5px solid #059669'
      : '1.5px solid #1e293b';
  const plateShadow = !isOnline
    ? '0 1px 3px rgba(0,0,0,0.2), inset 0 0 0 1px rgba(0,0,0,0.08)'
    : isSelected
      ? '0 0 0 2px #10b981, 0 3px 8px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(0,0,0,0.15)'
      : '0 2px 5px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(0,0,0,0.12)';
  const screwColor = !isOnline ? '#cbd5e1' : '#94a3b8';
  const screwBorder = !isOnline ? '#94a3b8' : '#475569';

  const html = `
    <div style="position: relative; width: 52px; height: 52px; display: flex; align-items: center; justify-content: center; opacity: ${overallOpacity};">
      <!-- Vehicle License Plate Frame (กรอบป้ายทะเบียนรถ - Fixed horizontal orientation) -->
      <div class="vehicle-license-plate" style="position: absolute; top: -16px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 4px; background: ${plateBg}; color: ${plateTextColor}; font-size: 9.5px; font-weight: 800; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; letter-spacing: 0.6px; padding: 1.5px 6px; border-radius: 3.5px; border: ${plateBorder}; box-shadow: ${plateShadow}; white-space: nowrap; pointer-events: none; z-index: 10; text-transform: uppercase;">
        <span style="display: inline-block; width: 3px; height: 3px; border-radius: 50%; background: ${screwColor}; border: 0.5px solid ${screwBorder}; flex-shrink: 0;"></span>
        <span style="line-height: 1.1;">${safeVehicleId}</span>
        <span style="display: inline-block; width: 3px; height: 3px; border-radius: 50%; background: ${screwColor}; border: 0.5px solid ${screwBorder}; flex-shrink: 0;"></span>
      </div>
      <!-- Pulse Ring -->
      ${pulseHtml}
      <!-- Rotational Top-Down Minimalist Car Body -->
      <div class="shuttle-van-body" style="position: relative; width: 26px; height: 42px; display: flex; align-items: center; justify-content: center; transform: rotate(${heading}deg); transition: transform 0.4s cubic-bezier(0.2, 0, 0, 1);">
        <svg width="26" height="42" viewBox="0 0 26 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          ${headlightGradient}
          <!-- Forward Headlight Beam Cone -->
          ${headlightBeam}
          <!-- Subtle vehicle drop shadow -->
          <path d="M 6.5 15.5 C 6.5 10.5 9 9 13 9 C 17 9 19.5 10.5 19.5 15.5 L 19.5 33 C 19.5 36.5 17 38 13 38 C 9 38 6.5 36.5 6.5 33 Z" fill="rgba(0,0,0,0.22)" transform="translate(0, 1.5)"/>
          <!-- Minimalist Car Body (Aerodynamic unibody) -->
          <path d="M 6.5 15 C 6.5 10.5 9 9 13 9 C 17 9 19.5 10.5 19.5 15 L 19.5 33 C 19.5 36.5 17 38 13 38 C 9 38 6.5 36.5 6.5 33 Z" fill="#0f172a" stroke="${borderColor}" stroke-width="1.5" stroke-linejoin="round"/>
          <!-- Panoramic Curved Front Windshield -->
          <path d="M 8 15 C 8 12.2 9.8 11.2 13 11.2 C 16.2 11.2 18 12.2 18 15 L 17.5 18 C 17.5 18.6 16.2 19.2 13 19.2 C 9.8 19.2 8.5 18.6 8.5 18 Z" fill="#38bdf8" fill-opacity="0.9"/>
          <!-- Minimalist Roof -->
          <rect x="8.5" y="20.5" width="9" height="9" rx="2" fill="#1e293b" fill-opacity="0.9"/>
          <!-- Rear Glass Strip -->
          <path d="M 8.8 31.8 C 9.8 31.4 11.2 31.2 13 31.2 C 14.8 31.2 16.2 31.4 17.2 31.8 L 17 33 C 16 33.4 14.5 33.6 13 33.6 C 11.5 33.6 10 33.4 9 33 Z" fill="#38bdf8" fill-opacity="0.75"/>
          <!-- Front LED Light Bar (Direction & Status Indicator) -->
          <path d="M 8.5 9.8 C 10 9.2 11.5 9 13 9 C 14.5 9 16 9.2 17.5 9.8" stroke="${primaryColor}" stroke-width="1.6" stroke-linecap="round"/>
          <!-- Rear Taillight Bar -->
          <path d="M 8.5 37 C 10 37.4 11.5 37.6 13 37.6 C 14.5 37.6 16 37.4 17.5 37" stroke="#ef4444" stroke-width="1.4" stroke-linecap="round"/>
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