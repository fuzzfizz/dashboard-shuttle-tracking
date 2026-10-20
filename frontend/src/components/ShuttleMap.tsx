import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { TelemetryPayload } from '../types/telemetry';

// OpenStreetMap standard tile layer (100% free, no API key, no watermark)
const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// CartoDB Positron with optional API key
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

interface ShuttleMapProps {
  telemetry: TelemetryPayload | null;
  defaultCenter?: [number, number];
  zoom?: number;
}

// Controller component to smoothly center map when coordinates change
const AutoCenter: React.FC<{ coords: [number, number] | null }> = ({ coords }) => {
  const map = useMap();
  useEffect(() => {
    if (coords) {
      map.panTo(coords, { animate: true, duration: 1.0 });
    }
  }, [coords, map]);
  return null;
};

// Custom SVG vehicle marker with direction arrow and live pulse ring
function createVehicleIcon(heading: number = 0) {
  const html = `
    <div style="position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
      <!-- Subtle outer pulse -->
      <div style="position: absolute; width: 36px; height: 36px; background: rgba(16, 185, 129, 0.25); border-radius: 9999px; animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></div>
      <!-- Center vehicle body with heading -->
      <div style="position: relative; width: 26px; height: 26px; background: #0f172a; border: 2.5px solid #ffffff; border-radius: 9999px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2); display: flex; align-items: center; justify-content: center; transform: rotate(${heading}deg); transition: transform 0.4s ease;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>
        </svg>
      </div>
    </div>
  `;
  return L.divIcon({
    html,
    className: 'custom-vehicle-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

export const ShuttleMap: React.FC<ShuttleMapProps> = ({
  telemetry,
  defaultCenter = [13.7563, 100.5018],
  zoom = 15,
}) => {
  const position: [number, number] = telemetry ? [telemetry.lat, telemetry.lng] : defaultCenter;

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={position}
        zoom={zoom}
        zoomControl={false}
        className="w-full h-full"
      >
        <TileLayer
          attribution={tileAttribution}
          url={tileUrl}
          maxZoom={19}
        />
        {telemetry && (
          <>
            <Marker position={[telemetry.lat, telemetry.lng]} icon={createVehicleIcon(telemetry.heading)} />
            <AutoCenter coords={[telemetry.lat, telemetry.lng]} />
          </>
        )}
      </MapContainer>
    </div>
  );
};
