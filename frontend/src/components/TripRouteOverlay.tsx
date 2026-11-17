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
  const iconSvg = isPickup
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15" stroke="currentColor" stroke-width="2"/></svg>`;

  return L.divIcon({
    className: 'custom-trip-pin',
    html: `
      <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%); pointer-events: auto; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">
        <div style="display: flex; align-items: center; gap: 5px; background: ${bgColor}; color: white; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; font-family: ui-sans-serif, system-ui, sans-serif; white-space: nowrap; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.25);">
          ${iconSvg}
          <span>${label}</span>
        </div>
        <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 7px solid ${bgColor}; margin-top: -1px;"></div>
        <div style="width: 6px; height: 6px; border-radius: 50%; background: ${bgColor}; border: 1.5px solid white; margin-top: -2px; box-shadow: 0 0 0 3px rgba(74, 124, 11, 0.3);"></div>
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

      {/* Planned Route (Casing / Glow): Soft underlying halo for visual depth on roads */}
      {hasPlannedPath && (
        <Polyline
          positions={trip.plannedPath}
          pathOptions={{
            color: '#6366f1', // Indigo glow
            weight: 8,
            opacity: 0.35,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      )}

      {/* Planned Route (Main Core Line): Vibrant dashed road polyline */}
      {hasPlannedPath && (
        <Polyline
          eventHandlers={{
            add: (e) => {
              e.target.getElement()?.setAttribute('data-testid', 'planned-route-polyline');
            },
          }}
          data-testid="planned-route-polyline"
          positions={trip.plannedPath}
          pathOptions={{
            color: '#4f46e5', // Rich Indigo / CMU Dok Rak tone
            weight: 5,
            opacity: 0.95,
            dashArray: '8, 8',
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      )}

      {/* Actual Path (Casing / Glow): Deep emerald halo */}
      {hasActualPath && (
        <Polyline
          positions={actualPath}
          pathOptions={{
            color: '#064e3b',
            weight: 7,
            opacity: 0.35,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      )}

      {/* Actual Path (Main Core Line): High-contrast Solid line for breadcrumbs */}
      {hasActualPath && (
        <Polyline
          eventHandlers={{
            add: (e) => {
              e.target.getElement()?.setAttribute('data-testid', 'actual-path-polyline');
            },
          }}
          data-testid="actual-path-polyline"
          positions={actualPath}
          pathOptions={{
            color: '#10b981', // Vibrant Emerald green
            weight: 4,
            opacity: 0.98,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      )}

      {/* Pickup Location Marker */}
      {trip?.pickup && (
        <Marker
          eventHandlers={{
            add: (e) => {
              e.target.getElement()?.setAttribute('data-testid', 'pickup-marker');
            },
          }}
          data-testid="pickup-marker"
          position={[trip.pickup.lat, trip.pickup.lng]}
          icon={createPinIcon('pickup', trip.pickup.name || 'จุดรับ')}
        />
      )}

      {/* Dropoff Location Marker */}
      {trip?.dropoff && (
        <Marker
          eventHandlers={{
            add: (e) => {
              e.target.getElement()?.setAttribute('data-testid', 'dropoff-marker');
            },
          }}
          data-testid="dropoff-marker"
          position={[trip.dropoff.lat, trip.dropoff.lng]}
          icon={createPinIcon('dropoff', trip.dropoff.name || 'จุดส่ง')}
        />
      )}
    </>
  );
};
