import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Vehicle, Route } from '../../lib/types';
import { formatSpeed, formatDistance } from '../../lib/utils';
import { Bus, Navigation, Gauge, X } from 'lucide-react';

interface LiveMapProps {
  vehicles: Vehicle[];
  routes: Route[];
  selectedVehicleId: string | null;
  onVehicleClick: (id: string) => void;
  onResetFocus?: () => void;
}

const LiveMap: React.FC<LiveMapProps> = ({
  vehicles,
  routes,
  selectedVehicleId,
  onVehicleClick,
  onResetFocus
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const routeLayersRef = useRef<L.LayerGroup | null>(null);

  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);
  const assignedRoute = routes.find(
    r => r.id === (selectedVehicle?.current_route_id || selectedVehicle?.route_id)
  );

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      zoomControl: false,
    }).setView([13.7367, 100.5283], 13);

    // Modern clean tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 19
    }).addTo(map);

    // Zoom control at bottom right for easy touch reach
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    routeLayersRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Render Routes (highlight selected vehicle's route or show active routes)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = routeLayersRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    routes.forEach(route => {
      const isSelectedRoute = assignedRoute?.id === route.id;
      // If a vehicle is selected, highlight only its assigned route
      if (selectedVehicleId && !isSelectedRoute) return;

      const color = route.color || '#3b82f6';

      if (route.coordinates && route.coordinates.length > 0) {
        // Outer glow polyline for selected route
        if (isSelectedRoute) {
          L.polyline(route.coordinates, {
            color: color,
            weight: 8,
            opacity: 0.35,
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(layerGroup);
        }

        // Main polyline
        L.polyline(route.coordinates, {
          color: color,
          weight: isSelectedRoute ? 5 : 3,
          opacity: isSelectedRoute ? 0.95 : 0.6,
          dashArray: isSelectedRoute ? undefined : '6, 8',
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(layerGroup);
      }

      // Render stops
      route.stops?.forEach((stop, idx) => {
        const stopMarker = L.circleMarker([stop.lat, stop.lng], {
          radius: isSelectedRoute ? 7 : 5,
          fillColor: isSelectedRoute ? color : '#ffffff',
          color: color,
          weight: 2,
          fillOpacity: isSelectedRoute ? 1 : 0.8
        }).addTo(layerGroup);

        const stopTooltip = `
          <div style="font-weight: 600; font-size: 11px; padding: 2px 4px;">
            ${idx + 1}. ${stop.name}
          </div>
        `;
        stopMarker.bindTooltip(stopTooltip, { direction: 'top', offset: [0, -6] });
      });
    });
  }, [routes, selectedVehicleId, assignedRoute]);

  // Update Vehicle Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const currentVehicleIds = new Set<string>();

    vehicles.forEach(vehicle => {
      if (!vehicle.last_lat || !vehicle.last_lng) return;
      currentVehicleIds.add(vehicle.id);

      const latLng: [number, number] = [vehicle.last_lat, vehicle.last_lng];
      const heading = vehicle.last_heading || 0;
      const isSelected = vehicle.id === selectedVehicleId;

      let statusColor = '#64748b'; // offline
      if (vehicle.status === 'in_transit') {
        statusColor = '#10b981'; // emerald
      } else if (vehicle.status === 'idle') {
        statusColor = '#f59e0b'; // amber
      }

      const htmlContent = `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer;">
          ${vehicle.status === 'in_transit' ? `
            <div style="position: absolute; width: 40px; height: 40px; border-radius: 50%; background: ${statusColor}; opacity: 0.35; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          ` : ''}
          <div style="
            position: relative;
            width: 36px;
            height: 36px;
            border-radius: 12px;
            background: ${statusColor};
            color: white;
            box-shadow: 0 4px 10px rgba(0,0,0,0.25);
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid ${isSelected ? '#60a5fa' : '#ffffff'};
            transform: ${isSelected ? 'scale(1.15)' : 'scale(1)'};
            transition: all 0.3s ease;
          ">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="transform: rotate(${heading}deg); transition: transform 0.4s ease;">
              <path d="M12 2L19 21L12 17L5 21L12 2Z" />
            </svg>
          </div>
          <div style="
            position: absolute;
            bottom: -22px;
            left: 50%;
            transform: translateX(-50%);
            padding: 1px 6px;
            border-radius: 6px;
            background: rgba(15, 23, 42, 0.9);
            color: #ffffff;
            font-size: 10px;
            font-weight: 700;
            white-space: nowrap;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            pointer-events: none;
          ">
            ${vehicle.plate_number}
          </div>
        </div>
      `;

      const icon = L.divIcon({
        html: htmlContent,
        className: 'vehicle-custom-marker',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -20]
      });

      let marker = markersRef.current[vehicle.id];
      if (marker) {
        marker.setLatLng(latLng);
        marker.setIcon(icon);
      } else {
        marker = L.marker(latLng, { icon }).addTo(map);
        marker.on('click', () => {
          onVehicleClick(vehicle.id);
        });
        markersRef.current[vehicle.id] = marker;
      }
    });

    // Cleanup removed vehicles
    Object.keys(markersRef.current).forEach(id => {
      if (!currentVehicleIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });
  }, [vehicles, selectedVehicleId, onVehicleClick]);

  // Smooth Fly-to on Vehicle Select
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedVehicleId) return;

    const marker = markersRef.current[selectedVehicleId];
    if (marker) {
      map.flyTo(marker.getLatLng(), 15, {
        animate: true,
        duration: 0.8
      });
    }
  }, [selectedVehicleId]);

  return (
    <div className="relative w-full h-full overflow-hidden rounded-2xl shadow-sm border border-slate-200">
      <div ref={mapRef} className="w-full h-full z-0" />

      {/* Floating Vehicle Focus HUD Widget */}
      {selectedVehicle && (
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 max-w-[calc(100vw-24px)] sm:max-w-sm bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-200/90 text-slate-800 transition-all animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2.5 mb-2.5">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <Bus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 leading-tight">
                  {selectedVehicle.plate_number}
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  {selectedVehicle.model || 'รถรับส่งทั่วไป'}
                </span>
              </div>
            </div>

            <button
              onClick={() => onResetFocus && onResetFocus()}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="แสดงรถทั้งหมด"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                <Gauge className="w-3.5 h-3.5" />
                <span>ความเร็ว</span>
              </div>
              <span className="text-sm font-bold text-slate-800 font-mono">
                {formatSpeed(selectedVehicle.last_speed)}
              </span>
            </div>

            <div className="bg-blue-50/60 p-2.5 rounded-xl border border-blue-100">
              <div className="flex items-center gap-1.5 text-blue-700 mb-1">
                <Navigation className="w-3.5 h-3.5" />
                <span>ระยะทางวันนี้</span>
              </div>
              <span className="text-sm font-bold text-blue-900 font-mono">
                {formatDistance(selectedVehicle.today_total_km)}
              </span>
            </div>
          </div>

          {assignedRoute ? (
            <div className="mt-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2 text-xs">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: assignedRoute.color || '#3b82f6' }}
              />
              <div className="truncate flex-1">
                <span className="font-semibold text-slate-800">{assignedRoute.name}</span>
                <span className="text-slate-500 ml-1">({assignedRoute.stops?.length || 0} จุดจอด)</span>
              </div>
            </div>
          ) : (
            <div className="mt-2.5 text-[11px] text-slate-400 italic">
              ยังไม่ได้กำหนดเส้นทางเป้าหมาย
            </div>
          )}

          <button
            onClick={() => onResetFocus && onResetFocus()}
            className="w-full mt-3 py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
          >
            <span>ดูรถทุกคันบนแผนที่</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default LiveMap;
