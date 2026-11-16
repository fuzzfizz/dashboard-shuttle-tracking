import React from 'react';
import { Polyline, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { VehicleTrip, MapPinMode } from '../types/trip';

export interface TripRouteOverlayProps {
  trip?: VehicleTrip;
  actualPath?: Array<[number, number]>;
  pinMode?: MapPinMode;
  onMapClick?: (lat: number, lng: number) => void;
}

export const createPinIcon = (type: 'pickup' | 'dropoff', label: string): L.DivIcon => {
  const isPickup = type === 'pickup';
  const bgColor = isPickup ? '#4a7c0b' : '#dc2626';
  const pinEmoji = isPickup ? '🟢' : '🔴';

  return L.divIcon({
    className: 'custom-trip-pin',
    html: `
      <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%); pointer-events: auto;">
        <div style="background: ${bgColor}; color: white; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; font-family: monospace; box-shadow: 0 2px 4px rgba(0,0,0,0.25); white-space: nowrap; border: 1.5px solid white;">
          ${label}
        </div>
        <div style="font-size: 16px; margin-top: -2px; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.3));">
          ${pinEmoji}
        </div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

const MapClickHandler: React.FC<{
  pinMode?: MapPinMode;
  onMapClick?: (lat: number, lng: number) => void;
}> = ({ pinMode, onMapClick }) => {
  useMapEvents({
    click(e) {
      if (pinMode && pinMode !== 'idle' && onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
};

export const TripRouteOverlay: React.FC<TripRouteOverlayProps> = ({
  trip,
  actualPath,
  pinMode = 'idle',
  onMapClick,
}) => {
  const hasPlannedPath = trip && trip.plannedPath && trip.plannedPath.length >= 2;
  const hasActualPath = actualPath && actualPath.length >= 2;

  return (
    <>
      <MapClickHandler pinMode={pinMode} onMapClick={onMapClick} />

      {/* Planned Route (แนวเส้นทางตามใบจอง): Semi-transparent Dashed line */}
      {hasPlannedPath && (
        <Polyline
          data-testid="planned-route-polyline"
          positions={trip.plannedPath}
          pathOptions={{
            color: '#9e76b4', // CMU Dok Rak Purple
            weight: 5,
            opacity: 0.75,
            dashArray: '8, 8',
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      )}

      {/* Actual Path (เส้นทางที่รถวิ่งจริง): High-contrast Solid line */}
      {hasActualPath && (
        <Polyline
          data-testid="actual-path-polyline"
          positions={actualPath}
          pathOptions={{
            color: '#4a7c0b', // Pharmacy CMU Olive Green
            weight: 4,
            opacity: 0.95,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      )}

      {/* Pickup Location Marker */}
      {trip?.pickup && (
        <Marker
          data-testid="pickup-marker"
          position={[trip.pickup.lat, trip.pickup.lng]}
          icon={createPinIcon('pickup', trip.pickup.name || 'จุดรับ')}
        />
      )}

      {/* Dropoff Location Marker */}
      {trip?.dropoff && (
        <Marker
          data-testid="dropoff-marker"
          position={[trip.dropoff.lat, trip.dropoff.lng]}
          icon={createPinIcon('dropoff', trip.dropoff.name || 'จุดส่ง')}
        />
      )}
    </>
  );
};
