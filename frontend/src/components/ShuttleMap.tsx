import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { FleetMap, TelemetryPayload } from '../types/telemetry';

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

interface ShuttleMapProps {
  vehicles?: FleetMap;
  selectedVehicleId?: string | null;
  onSelectVehicle?: (vehicleId: string) => void;
  telemetry?: TelemetryPayload | null;
  defaultCenter?: [number, number];
  zoom?: number;
}

// Camera auto controller: handles overview (fitBounds) or focused tracking (panTo)
const FleetCameraController: React.FC<{
  vehicles: FleetMap;
  selectedVehicleId: string | null;
  defaultCenter: [number, number];
}> = ({ vehicles, selectedVehicleId, defaultCenter }) => {
  const map = useMap();

  useEffect(() => {
    const vehicleList = Object.values(vehicles);

    if (selectedVehicleId && vehicles[selectedVehicleId]) {
      // Focus Mode: follow single vehicle
      const target = vehicles[selectedVehicleId];
      map.panTo([target.lat, target.lng], { animate: true, duration: 0.8 });
    } else if (vehicleList.length > 1) {
      // Fleet Overview Mode: fit all active vehicles with padding
      const bounds = L.latLngBounds(vehicleList.map((v) => [v.lat, v.lng]));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16, animate: true });
    } else if (vehicleList.length === 1) {
      // Single vehicle active: pan to it
      map.panTo([vehicleList[0].lat, vehicleList[0].lng], { animate: true, duration: 0.8 });
    } else {
      // Empty fleet: reset to default city center
      map.panTo(defaultCenter, { animate: true });
    }
  }, [vehicles, selectedVehicleId, map, defaultCenter]);

  return null;
};

// SVG vehicle marker with direction arrow and vehicle badge
function createVehicleIcon(heading: number = 0, isSelected: boolean = false, vehicleId: string = '') {
  const borderColor = isSelected ? '#10b981' : '#ffffff';
  const pulseClass = isSelected ? 'background: rgba(16, 185, 129, 0.4);' : 'background: rgba(16, 185, 129, 0.2);';

  const html = `
    <div style="position: relative; width: 44px; height: 44px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
      <!-- Vehicle ID Pill Badge -->
      <div style="position: absolute; top: -14px; background: rgba(15, 23, 42, 0.9); color: #ffffff; font-size: 9px; font-weight: bold; font-family: monospace; padding: 1px 5px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2); pointer-events: none;">
        ${vehicleId}
      </div>
      <!-- Pulse Ring -->
      <div style="position: absolute; width: 38px; height: 38px; ${pulseClass} border-radius: 9999px; animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></div>
      <!-- Rotational Body -->
      <div style="position: relative; width: 28px; height: 28px; background: #0f172a; border: 2.5px solid ${borderColor}; border-radius: 9999px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3); display: flex; align-items: center; justify-content: center; transform: rotate(${heading}deg); transition: transform 0.4s ease;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
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
  selectedVehicleId = null,
  onSelectVehicle,
  telemetry,
  defaultCenter = DEFAULT_CENTER,
  zoom = 15,
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

        {/* Render vehicle markers */}
        {vehicleList.map((v) => {
          const isSelected = selectedVehicleId === v.vehicle_id;
          return (
            <Marker
              key={v.vehicle_id}
              position={[v.lat, v.lng]}
              icon={createVehicleIcon(v.heading ?? 0, isSelected, v.vehicle_id)}
              eventHandlers={{
                click: () => onSelectVehicle?.(v.vehicle_id),
              }}
            >
              <Tooltip direction="top" offset={[0, -20]} opacity={0.95}>
                <div className="text-xs font-sans">
                  <strong>{v.vehicle_id}</strong>
                  <br />
                  Speed: {(v.speed ?? 0).toFixed(1)} km/h
                </div>
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};
