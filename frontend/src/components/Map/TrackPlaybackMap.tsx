'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { GpsPoint } from '@/lib/types';

interface TrackPlaybackMapProps {
  track: GpsPoint[];
  currentIndex: number;
  vehiclePlate?: string;
}

const getShuttleIcon = (heading: number) => {
  return L.divIcon({
    className: 'custom-shuttle-icon',
    html: `
      <div style="transform: rotate(${heading}deg); transform-origin: center; display: flex; justify-content: center; align-items: center; width: 32px; height: 32px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #3b82f6; background: white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.2); padding: 4px;">
          <polygon points="12 2 19 21 12 17 5 21 12 2" fill="#3b82f6" />
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

const startIcon = L.divIcon({
  className: 'start-icon',
  html: `<div style="background-color: #10b981; color: white; border: 2px solid white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">S</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const endIcon = L.divIcon({
  className: 'end-icon',
  html: `<div style="background-color: #ef4444; color: white; border: 2px solid white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">E</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

export default function TrackPlaybackMap({ track, currentIndex, vehiclePlate }: TrackPlaybackMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const movingMarkerRef = useRef<L.Marker | null>(null);
  const startMarkerRef = useRef<L.Marker | null>(null);
  const endMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current).setView([13.7563, 100.5018], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapRef.current);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !track || track.length === 0) return;

    const map = mapRef.current;
    
    const latlngs: [number, number][] = track.map(p => [p.lat, p.lng]);
    
    if (!polylineRef.current) {
      polylineRef.current = L.polyline(latlngs, { color: '#3b82f6', weight: 4, opacity: 0.7 }).addTo(map);
    } else {
      polylineRef.current.setLatLngs(latlngs);
    }

    if (!startMarkerRef.current) {
      startMarkerRef.current = L.marker(latlngs[0], { icon: startIcon }).addTo(map)
        .bindPopup(`Start: ${new Date(track[0].timestamp).toLocaleTimeString()}`);
    } else {
      startMarkerRef.current.setLatLng(latlngs[0]);
    }

    if (!endMarkerRef.current) {
      endMarkerRef.current = L.marker(latlngs[latlngs.length - 1], { icon: endIcon }).addTo(map)
        .bindPopup(`End: ${new Date(track[track.length - 1].timestamp).toLocaleTimeString()}`);
    } else {
      endMarkerRef.current.setLatLng(latlngs[latlngs.length - 1]);
    }

    if (latlngs.length > 0) {
      const bounds = L.latLngBounds(latlngs);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [track]);

  useEffect(() => {
    if (!mapRef.current || !track || track.length === 0 || currentIndex < 0 || currentIndex >= track.length) return;

    const map = mapRef.current;
    const currentPoint = track[currentIndex];
    
    if (!movingMarkerRef.current) {
      movingMarkerRef.current = L.marker([currentPoint.lat, currentPoint.lng], { 
        icon: getShuttleIcon(currentPoint.heading)
      }).addTo(map);
    } else {
      movingMarkerRef.current.setLatLng([currentPoint.lat, currentPoint.lng]);
      movingMarkerRef.current.setIcon(getShuttleIcon(currentPoint.heading));
    }

    const popupContent = `
      <div class="text-sm">
        <div class="font-bold mb-1">${vehiclePlate || 'Vehicle'}</div>
        <div>Speed: ${currentPoint.speed_kmh} km/h</div>
        <div>Time: ${new Date(currentPoint.timestamp).toLocaleTimeString()}</div>
        <div class="text-gray-500 text-xs mt-1">Point ${currentIndex + 1}/${track.length}</div>
      </div>
    `;
    movingMarkerRef.current.bindPopup(popupContent);
  }, [currentIndex, track, vehiclePlate]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: '400px', zIndex: 0 }} />;
}
