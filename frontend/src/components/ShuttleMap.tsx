import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { FleetMap, TelemetryPayload } from '../types/telemetry';
import { computeVehicleStatus } from '../services/fleetStatus';
import { AnimatedVehicleMarker } from './AnimatedVehicleMarker';

// OpenStreetMap standard tile layer
const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const cartoKey = import.meta.env.VITE_CARTO_API_KEY;
const customTileUrl = import.meta.env.VITE_TILE_URL;

const tileUrl = customTileUrl
  ? customTileUrl
  : cartoKey
    ? `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${cartoKey}`
    : OSM_URL;

const tileAttribution = cartoKey
  ? '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  : OSM_ATTRIBUTION;

export const DEFAULT_CENTER: [number, number] = [13.7563, 100.5018];

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
        map.panTo([target.lat, target.lng], { animate: true, duration: 0.8 });
        prevTargetCoordsRef.current = { lat: target.lat, lng: target.lng };
      }
    } else {
      // Overview Mode / No focus
      prevTargetCoordsRef.current = null;

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

// SVG vehicle marker with direction arrow and vehicle badge
export function createVehicleIcon(
  heading: number = 0,
  isSelected: boolean = false,
  vehicleId: string = '',
  isOnline: boolean = true
) {
  const safeVehicleId = escapeHtml(vehicleId);
  const borderColor = !isOnline ? '#94a3b8' : isSelected ? '#10b981' : '#ffffff';
  const arrowColor = !isOnline ? '#475569' : '#10b981';
  const overallOpacity = !isOnline ? '0.6' : '1';
  const pulseHtml = isOnline
    ? `<div style="position: absolute; width: 38px; height: 38px; background: rgba(16, 185, 129, ${isSelected ? '0.4' : '0.2'}); border-radius: 9999px; animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></div>`
    : '';

  const html = `
    <div style="position: relative; width: 44px; height: 44px; display: flex; flex-direction: column; align-items: center; justify-content: center; opacity: ${overallOpacity};">
      <!-- Vehicle ID Pill Badge -->
      <div style="position: absolute; top: -14px; background: rgba(15, 23, 42, 0.9); color: #ffffff; font-size: 9px; font-weight: bold; font-family: monospace; padding: 1px 5px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2); pointer-events: none;">
        ${safeVehicleId}
      </div>
      <!-- Pulse Ring -->
      ${pulseHtml}
      <!-- Rotational Body -->
      <div style="position: relative; width: 28px; height: 28px; background: #0f172a; border: 2.5px solid ${borderColor}; border-radius: 9999px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3); display: flex; align-items: center; justify-content: center; transform: rotate(${heading}deg); transition: transform 0.4s ease;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${arrowColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>
        </svg>
      </div>
    </div>
  `;
  return L.divIcon({
    html,
    className: 'custom-vehicle-marker',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

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

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={defaultCenter}
        zoom={zoom}
        zoomControl={false}
        className="w-full h-full"
      >
        <TileLayer
          attribution={tileAttribution}
          url={tileUrl}
          maxZoom={19}
        />

        {/* Camera auto controller */}
        <FleetCameraController
          vehicles={effectiveVehicles}
          selectedVehicleId={selectedVehicleId}
          defaultCenter={defaultCenter}
        />

        {/* Leaflet resize invalidation handler */}
        <MapResizeHandler isFullscreen={isFullscreen} />

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