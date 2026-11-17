import { TripLocation, VehicleTrip } from '../types/trip';

export const MAPBOX_DIRECTIONS_API_BASE = 'https://api.mapbox.com/directions/v5/mapbox/driving';

/**
 * Parses GeoJSON coordinates [longitude, latitude] from Mapbox Directions API
 * into Leaflet format [latitude, longitude].
 */
export function parseMapboxRouteCoordinates(json: any): Array<[number, number]> {
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
 * Calculates road-following route using Mapbox Directions API.
 * Requires a valid Mapbox Public Access Token (pk.eyJ...).
 */
export async function calculateMapboxTripRoute(
  vehicleId: string,
  pickup: TripLocation,
  dropoff: TripLocation,
  token: string
): Promise<VehicleTrip> {
  const cleanToken = token?.trim();
  if (!cleanToken) {
    throw new Error('Mapbox Access Token is required to use Mapbox Directions API.');
  }

  const url = `${MAPBOX_DIRECTIONS_API_BASE}/${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}?geometries=geojson&overview=full&access_token=${cleanToken}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Mapbox API error status: ${response.status}`);
  }

  const data = await response.json();
  const plannedPath = parseMapboxRouteCoordinates(data);

  if (plannedPath.length < 2) {
    throw new Error('Mapbox returned invalid or empty route coordinates.');
  }

  return {
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
    createdAt: Date.now(),
  };
}
