import { TripLocation, VehicleTrip } from '../types/trip';
import {
  calculateMapboxTripRouteDetailed,
  getDivergentSegments,
} from './mapboxRouteService';

export const OSRM_ROUTE_API_BASE = 'https://router.project-osrm.org/route/v1/driving';
export const DEFAULT_LONGDO_KEY = '72ba939d7a7166c36d59b88d0b125307';
export const LONGDO_ROUTE_API_BASE = 'https://api.longdo.com/RouteService/json/route/guide';

/**
 * Retrieves configured Mapbox Access Token from localStorage or environment variable.
 */
export function getMapboxToken(): string {
  if (typeof window !== 'undefined') {
    return (
      localStorage.getItem('mapbox_access_token') ||
      (import.meta as any).env?.VITE_MAPBOX_TOKEN ||
      ''
    );
  }
  return (import.meta as any).env?.VITE_MAPBOX_TOKEN || '';
}

const inMemoryRouteCache = new Map<string, VehicleTrip>();

export function getTripCacheKey(
  vehicleId: string,
  pickup: TripLocation,
  dropoff: TripLocation
): string {
  return `trip_${vehicleId}_${pickup.lat.toFixed(6)},${pickup.lng.toFixed(6)}_${dropoff.lat.toFixed(6)},${dropoff.lng.toFixed(6)}`;
}

/**
 * Parses coordinates from OSRM GeoJSON response.
 * OSRM returns coordinates as [longitude, latitude].
 * Leaflet requires [latitude, longitude].
 */
export function parseOsrmRouteCoordinates(json: any): Array<[number, number]> {
  if (!json || !json.routes || !Array.isArray(json.routes) || json.routes.length === 0) {
    return [];
  }
  const primaryRoute = json.routes[0];
  const coords = primaryRoute?.geometry?.coordinates;
  if (!Array.isArray(coords)) {
    return [];
  }

  const result: Array<[number, number]> = [];
  for (const point of coords) {
    if (Array.isArray(point) && point.length >= 2) {
      const lng = Number(point[0]);
      const lat = Number(point[1]);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        result.push([lat, lng]);
      }
    }
  }
  return result;
}

/**
 * Legacy/fallback parser for Longdo guide data.
 */
export function parseLongdoGuideCoordinates(json: any): Array<[number, number]> {
  if (!json) return [];
  const coords: Array<[number, number]> = [];

  if (Array.isArray(json.data)) {
    for (const point of json.data) {
      const lat = Number(point.latitude ?? point.lat);
      const lng = Number(point.longitude ?? point.lon ?? point.lng);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        coords.push([lat, lng]);
      }
    }
  }

  return coords;
}

export function getCachedTripRoute(
  vehicleId: string,
  pickup: TripLocation,
  dropoff: TripLocation
): VehicleTrip | null {
  const key = getTripCacheKey(vehicleId, pickup, dropoff);
  if (inMemoryRouteCache.has(key)) {
    return inMemoryRouteCache.get(key)!;
  }
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored) as VehicleTrip;
      inMemoryRouteCache.set(key, parsed);
      return parsed;
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

export function clearTripRouteCache(vehicleId?: string): void {
  if (vehicleId) {
    for (const key of Array.from(inMemoryRouteCache.keys())) {
      if (key.startsWith(`trip_${vehicleId}_`)) {
        inMemoryRouteCache.delete(key);
        try {
          localStorage.removeItem(key);
        } catch {}
      }
    }
  } else {
    inMemoryRouteCache.clear();
    try {
      if (typeof localStorage !== 'undefined') {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('trip_')) {
            keysToRemove.push(key);
          }
        }
        for (const k of keysToRemove) {
          localStorage.removeItem(k);
        }
      }
    } catch {}
  }
}

/**
 * Calculates a road-following trip route using the Hybrid engine (Mapbox Directions API with alternatives
 * and hidden overlapping segments when token is configured), or falls back to OSRM.
 * Includes strict caching (Zero Request Policy on repeated calls) and resilient fallback.
 */
export async function calculateTripRoute(
  vehicleId: string,
  pickup: TripLocation,
  dropoff: TripLocation,
  _apiKey: string = DEFAULT_LONGDO_KEY
): Promise<VehicleTrip> {
  // 1. Check in-memory & local cache first (Strict Zero Request policy)
  const cached = getCachedTripRoute(vehicleId, pickup, dropoff);
  if (cached) {
    return cached;
  }

  const cacheKey = getTripCacheKey(vehicleId, pickup, dropoff);
  const now = Date.now();

  // 2. Hybrid Router: If Mapbox Token is present, use Mapbox Directions with traffic & alternatives
  const mapboxToken = getMapboxToken();
  if (mapboxToken && mapboxToken.trim()) {
    try {
      const detailed = await calculateMapboxTripRouteDetailed(
        vehicleId,
        pickup,
        dropoff,
        mapboxToken.trim(),
        {
          profile: 'driving-traffic',
          alternatives: true,
        }
      );

      const primaryTrip = detailed.primaryTrip;

      // Extract divergent branches for all alternative routes, hiding segments that overlap with primary
      const alternativeBranches: Array<Array<[number, number]>> = [];
      for (const alt of detailed.alternativeTrips) {
        const branches = getDivergentSegments(alt.plannedPath, primaryTrip.plannedPath, 12);
        alternativeBranches.push(...branches);
      }

      const trip: VehicleTrip = {
        ...primaryTrip,
        alternativePaths: alternativeBranches.length > 0 ? alternativeBranches : undefined,
      };

      inMemoryRouteCache.set(cacheKey, trip);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(trip));
      } catch {}

      return trip;
    } catch {
      // Fallback to OSRM below if Mapbox call fails
    }
  }

  // 3. Fallback Router: OSRM driving engine with GeoJSON full road geometry
  try {
    const osrmUrl = `${OSRM_ROUTE_API_BASE}/${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}?overview=full&geometries=geojson`;
    const response = await fetch(osrmUrl);

    if (response.ok) {
      const data = await response.json();
      const plannedPath = parseOsrmRouteCoordinates(data);

      if (plannedPath.length >= 2) {
        const trip: VehicleTrip = {
          vehicleId,
          pickup,
          dropoff,
          plannedPath,
          distanceMeters:
            typeof data?.routes?.[0]?.distance === 'number'
              ? Math.round(data.routes[0].distance)
              : undefined,
          durationSeconds:
            typeof data?.routes?.[0]?.duration === 'number'
              ? Math.round(data.routes[0].duration)
              : undefined,
          createdAt: now,
        };

        inMemoryRouteCache.set(cacheKey, trip);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(trip));
        } catch {}

        return trip;
      }
    }
  } catch (error) {
    // Try secondary router or fallback below
  }

  // Fallback: Geodesic straight-line fallback to ensure UI never breaks or freezes
  const fallbackTrip: VehicleTrip = {
    vehicleId,
    pickup,
    dropoff,
    plannedPath: [
      [pickup.lat, pickup.lng],
      [dropoff.lat, dropoff.lng],
    ],
    createdAt: now,
  };
  return fallbackTrip;
}
