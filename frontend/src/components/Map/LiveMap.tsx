import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Vehicle, Route } from '../../lib/types';
import { formatSpeed } from '../../lib/utils';

interface LiveMapProps {
  vehicles: Vehicle[];
  routes: Route[];
  selectedVehicleId: string | null;
  onVehicleClick: (id: string) => void;
}

const LiveMap: React.FC<LiveMapProps> = ({ vehicles, routes, selectedVehicleId, onVehicleClick }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const routeLayersRef = useRef<L.Polyline[]>([]);
  const stopsLayersRef = useRef<L.CircleMarker[]>([]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (!mapInstanceRef.current) {
      // Initialize map
      const map = L.map(mapRef.current).setView([13.7367, 100.5283], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update routes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old routes and stops
    routeLayersRef.current.forEach(layer => layer.remove());
    stopsLayersRef.current.forEach(layer => layer.remove());
    routeLayersRef.current = [];
    stopsLayersRef.current = [];

    routes.forEach(route => {
      if (!route.is_active) return;
      
      if (route.coordinates && route.coordinates.length > 0) {
        const polyline = L.polyline(route.coordinates, { color: route.color || '#3b82f6', weight: 4 }).addTo(map);
        routeLayersRef.current.push(polyline);
      }

      route.stops?.forEach(stop => {
        const circle = L.circleMarker([stop.lat, stop.lng], {
          radius: 6,
          fillColor: route.color || '#3b82f6',
          color: '#ffffff',
          weight: 2,
          fillOpacity: 1
        }).addTo(map);
        circle.bindTooltip(stop.name, { direction: 'top' });
        stopsLayersRef.current.push(circle);
      });
    });
  }, [routes]);

  // Update vehicles
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const currentVehicleIds = new Set<string>();

    vehicles.forEach(vehicle => {
      if (!vehicle.last_lat || !vehicle.last_lng) return;
      currentVehicleIds.add(vehicle.id);

      const latLng: [number, number] = [vehicle.last_lat, vehicle.last_lng];
      const heading = vehicle.last_heading || 0;
      
      let statusColor = '#9ca3af'; // offline - gray
      if (vehicle.status === 'in_transit') statusColor = '#22c55e'; // green
      else if (vehicle.status === 'idle') statusColor = '#f59e0b'; // amber

      const routeName = routes.find(r => r.id === vehicle.current_route_id)?.name || 'No Route';
      
      const htmlContent = `
        <div style="transform: rotate(${heading}deg); display: flex; justify-content: center; align-items: center; width: 32px; height: 32px; background-color: ${statusColor}; border-radius: 50%; color: white; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2v20M17 5l-5-3-5 3M19 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
          </svg>
        </div>
        <div style="position: absolute; top: 34px; left: 50%; transform: translateX(-50%); background: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; white-space: nowrap; box-shadow: 0 1px 2px rgba(0,0,0,0.2);">
          ${vehicle.plate_number}
        </div>
      `;

      const icon = L.divIcon({
        html: htmlContent,
        className: 'vehicle-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
      });

      const popupContent = `
        <div style="min-width: 150px; font-family: sans-serif;">
          <h3 style="margin: 0 0 5px; font-size: 14px; font-weight: bold;">${vehicle.plate_number}</h3>
          <p style="margin: 2px 0; font-size: 12px;">Model: ${vehicle.model}</p>
          <p style="margin: 2px 0; font-size: 12px;">Route: ${routeName}</p>
          <p style="margin: 2px 0; font-size: 12px;">Speed: ${formatSpeed(vehicle.last_speed)}</p>
          <p style="margin: 2px 0; font-size: 12px;">Status: 
            <span style="color: ${statusColor}; font-weight: bold;">
              ${vehicle.status === 'in_transit' ? 'In Transit' : vehicle.status === 'idle' ? 'Idle' : 'Offline'}
            </span>
          </p>
          <p style="margin: 2px 0; font-size: 10px; color: #666;">
            Updated: ${vehicle.last_seen_at ? new Date(vehicle.last_seen_at).toLocaleTimeString() : 'N/A'}
          </p>
        </div>
      `;

      let marker = markersRef.current[vehicle.id];
      if (marker) {
        marker.setLatLng(latLng);
        marker.setIcon(icon);
        marker.setPopupContent(popupContent);
      } else {
        marker = L.marker(latLng, { icon }).addTo(map);
        marker.bindPopup(popupContent);
        marker.on('click', () => {
          onVehicleClick(vehicle.id);
        });
        markersRef.current[vehicle.id] = marker;
      }
    });

    // Remove vehicles that are no longer in the list
    Object.keys(markersRef.current).forEach(id => {
      if (!currentVehicleIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });
  }, [vehicles, routes, onVehicleClick]);

  // Handle selected vehicle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedVehicleId) return;

    const marker = markersRef.current[selectedVehicleId];
    if (marker) {
      map.flyTo(marker.getLatLng(), 16, { animate: true, duration: 1 });
      marker.openPopup();
    }
  }, [selectedVehicleId]);

  return <div ref={mapRef} className="w-full h-full z-0" />;
};

export default LiveMap;
