import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { HistoricalPoint } from '../types/historical';
import { AlertCircle, Loader2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

export interface ReplayMapProps {
  points: HistoricalPoint[];
  traversedPoints: HistoricalPoint[];
  currentPoint: HistoricalPoint | null;
  isLoading: boolean;
  emptyMessage?: string;
}

// Controller to auto-fit bounds when new points load
export const AutoFitBounds: React.FC<{ points: HistoricalPoint[] }> = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    if (points.length >= 2) {
      const latLngs = points.map((p) => [p.lat, p.lng] as [number, number]);
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 17 });
    } else if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 16);
    }
  }, [points, map]);

  return null;
};

// Custom vehicle marker icon with rotation
export function createVehicleIcon(heading: number) {
  return L.divIcon({
    className: 'custom-shuttle-marker',
    html: `
      <div style="transform: rotate(${heading}deg); transform-origin: center center;" class="w-8 h-8 flex items-center justify-center">
        <div class="w-7 h-7 bg-emerald-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-xs">
          ▲
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

export const startIcon = L.divIcon({
  className: 'start-pin',
  html: `<div class="w-4 h-4 rounded-full bg-emerald-600 border-2 border-white shadow-md"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export const endIcon = L.divIcon({
  className: 'end-pin',
  html: `<div class="w-4 h-4 rounded-full bg-rose-600 border-2 border-white shadow-md"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export const ReplayMap: React.FC<ReplayMapProps> = ({
  points,
  traversedPoints,
  currentPoint,
  isLoading,
  emptyMessage = 'ไม่พบประวัติการเดินรถในวันที่เลือก',
}) => {
  const fullPositions = useMemo(
    () => points.map((p) => [p.lat, p.lng] as [number, number]),
    [points]
  );

  const traversedPositions = useMemo(
    () => traversedPoints.map((p) => [p.lat, p.lng] as [number, number]),
    [traversedPoints]
  );

  const center: [number, number] = useMemo(() => {
    if (currentPoint) return [currentPoint.lat, currentPoint.lng];
    if (points.length > 0) return [points[0].lat, points[0].lng];
    return [13.736717, 100.523186]; // Default Bangkok
  }, [currentPoint, points]);

  return (
    <div className="relative w-full h-full flex-1 overflow-hidden bg-slate-100 dark:bg-slate-900">
      <MapContainer
        center={center}
        zoom={15}
        className="w-full h-full"
        attributionControl={false}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        <AutoFitBounds points={points} />

        {/* 1. Full Day Route (Background Neutral Polyline) */}
        {fullPositions.length >= 2 && (
          <Polyline
            positions={fullPositions}
            pathOptions={{
              color: '#94a3b8',
              weight: 4,
              opacity: 0.5,
              dashArray: '6, 8',
            }}
          />
        )}

        {/* 2. Traversed Route (Active Glowing Polyline) */}
        {traversedPositions.length >= 2 && (
          <Polyline
            positions={traversedPositions}
            pathOptions={{
              color: '#10b981',
              weight: 5,
              opacity: 0.95,
            }}
          />
        )}

        {/* 3. Start Point Pin */}
        {points.length > 0 && (
          <Marker position={[points[0].lat, points[0].lng]} icon={startIcon}>
            <Tooltip direction="top" offset={[0, -10]}>
              จุดเริ่มต้น
            </Tooltip>
          </Marker>
        )}

        {/* 4. End Point Pin */}
        {points.length > 1 && (
          <Marker
            position={[points[points.length - 1].lat, points[points.length - 1].lng]}
            icon={endIcon}
          >
            <Tooltip direction="top" offset={[0, -10]}>
              จุดสิ้นสุด
            </Tooltip>
          </Marker>
        )}

        {/* 5. Moving Vehicle Marker */}
        {currentPoint && (
          <Marker
            position={[currentPoint.lat, currentPoint.lng]}
            icon={createVehicleIcon(currentPoint.heading)}
            zIndexOffset={1000}
          >
            <Tooltip permanent={false} direction="top" offset={[0, -16]}>
              {currentPoint.vehicle_id} ({currentPoint.speed.toFixed(1)} กม./ชม.)
            </Tooltip>
          </Marker>
        )}
      </MapContainer>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm z-[1500] flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            กำลังโหลดข้อมูลเส้นทาง...
          </p>
        </div>
      )}

      {/* Empty State Banner */}
      {!isLoading && points.length === 0 && (
        <div className="absolute inset-0 z-[1400] flex items-center justify-center p-4 pointer-events-none">
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-6 max-w-md text-center pointer-events-auto flex flex-col items-center gap-3">
            <div className="p-3 bg-amber-500/10 text-amber-500 rounded-full">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {emptyMessage}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              กรุณาเลือกวันที่หรือรถคันอื่นจากแถบเครื่องมือด้านบน
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
