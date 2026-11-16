import { TripLocation, VehicleTrip } from '../types/trip';

export const DEFAULT_LONGDO_KEY = '72ba939d7a7166c36d59b88d0b125307';
export const LONGDO_ROUTE_API_BASE = 'https://api.longdo.com/RouteService/json/route/guide';

const inMemoryRouteCache = new Map<string, VehicleTrip>();

export function getTripCacheKey(vehicleId: string, pickup: TripLocation, dropoff: TripLocation): string {
  return `trip_${vehicleId}_${pickup.lat.toFixed(6)},${pickup.lng.toFixed(6)}_${dropoff.lat.toFixed(6)},${dropoff.lng.toFixed(6)}`;
}

export function parseLongdoGuideCoordinates(json: any): Array<[number, number]> {
  if (!json) return [];
  const coords: Array<[number, number]> = [];

  // Longdo returns guide objects in `data` array with `latitude` and `longitude`
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

export async function calculateTripRoute(
  vehicleId: string,
  pickup: TripLocation,
  dropoff: TripLocation,
  apiKey: string = DEFAULT_LONGDO_KEY
): Promise<VehicleTrip> {
  // 1. Check in-memory & local cache first (Strict Zero Request policy)
  const cached = getCachedTripRoute(vehicleId, pickup, dropoff);
  if (cached) {
    return cached;
  }

  const cacheKey = getTripCacheKey(vehicleId, pickup, dropoff);
  const now = Date.now();

  try {
    const url = new URL(LONGDO_ROUTE_API_BASE);
    url.searchParams.set('flon', pickup.lng.toString());
    url.searchParams.set('flat', pickup.lat.toString());
    url.searchParams.set('tlon', dropoff.lng.toString());
    url.searchParams.set('tlat', dropoff.lat.toString());
    url.searchParams.set('mode', 't'); // Car/traffic mode
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Longdo Route API error status: ${response.status}`);
    }

    const data = await response.json();
    let plannedPath = parseLongdoGuideCoordinates(data);

    if (plannedPath.length < 2) {
      plannedPath = [
        [pickup.lat, pickup.lng],
        [dropoff.lat, dropoff.lng],
      ];
    }

    const trip: VehicleTrip = {
      vehicleId,
      pickup,
      dropoff,
      plannedPath,
      distanceMeters: typeof data?.distance === 'number' ? data.distance : undefined,
      durationSeconds: typeof data?.interval === 'number' ? data.interval : undefined,
      createdAt: now,
    };

    inMemoryRouteCache.set(cacheKey, trip);
    try {
      localStorage.setItem(cacheKey, JSON.stringify(trip));
    } catch {}

    return trip;
  } catch (error) {
    // Geodesic straight-line fallback to ensure UI never freezes
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
}
