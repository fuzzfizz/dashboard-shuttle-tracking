import React, { useEffect, useRef } from 'react';
import { useMap, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import '@maplibre/maplibre-gl-leaflet';

export interface MapLibreLayerProps {
  style: string;
  attribution?: string;
  fallbackTileUrl?: string;
}

if (typeof window !== 'undefined') {
  try {
    setWorkerUrl(workerUrl);
  } catch {
    // Ignore in non-browser environments
  }
}

function isWebGLSupported(): boolean {
  if (typeof window === 'undefined') return false;
  // In JSDOM / headless test environments without WebGL, immediately return false
  if (typeof window.WebGL2RenderingContext === 'undefined' && typeof (window as any).WebGLRenderingContext === 'undefined') {
    return false;
  }
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    return Boolean(gl);
  } catch {
    return false;
  }
}

export const MapLibreLayer: React.FC<MapLibreLayerProps> = ({
  style,
  attribution,
  fallbackTileUrl = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
}) => {
  const map = useMap();
  const layerRef = useRef<any>(null);
  const webGLAvailable = isWebGLSupported();

  useEffect(() => {
    if (!webGLAvailable) {
      return;
    }

    if (typeof (L as any).maplibreGL === 'function') {
      try {
        const glLayer = (L as any).maplibreGL({
          style,
          attribution,
        });

        // Only add to map if GL map initialized successfully
        if (glLayer) {
          glLayer.addTo(map);
          layerRef.current = glLayer;
        }
      } catch (err) {
        console.warn('MapLibre GL Layer could not be initialized:', err);
      }
    }

    return () => {
      if (layerRef.current && map) {
        try {
          if (map.hasLayer(layerRef.current)) {
            map.removeLayer(layerRef.current);
          }
        } catch {
          // Ignore unmount layer cleanup errors
        }
        layerRef.current = null;
      }
    };
  }, [map, style, attribution, webGLAvailable]);

  // If WebGL is not available (e.g., in jsdom test runner or legacy browsers), render fallback raster tiles
  if (!webGLAvailable && fallbackTileUrl) {
    return (
      <TileLayer
        attribution={attribution || '&copy; OpenFreeMap'}
        url={fallbackTileUrl}
        maxZoom={19}
      />
    );
  }

  return null;
};
