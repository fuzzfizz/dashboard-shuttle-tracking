import { TripLocation, VehicleTrip } from '../types/trip';

export const MAPBOX_DIRECTIONS_API_BASE = 'https://api.mapbox.com/directions/v5/mapbox';

export type MapboxRoutingProfile = 'driving' | 'driving-traffic';

export interface MapboxRouteOptions {
  profile?: MapboxRoutingProfile;
  alternatives?: boolean;
  excludeToll?: boolean;
  excludeMotorway?: boolean;
}

export interface MapboxDetailedRouteResult {
  primaryTrip: VehicleTrip;
  alternativeTrips: VehicleTrip[];
}

/**
 * Parses GeoJSON coordinates [longitude, latitude] from a specific Mapbox route object
 * into Leaflet format [latitude, longitude].
 */
export function parseRouteGeometry(routeItem: any): Array<[number, number]> {
  const coords = routeItem?.geometry?.coordinates;
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
 * Parses GeoJSON coordinates [longitude, latitude] from Mapbox Directions API
 * into Leaflet format [latitude, longitude].
 */
export function parseMapboxRouteCoordinates(json: any): Array<[number, number]> {
  if (!json || !json.routes || !Array.isArray(json.routes) || json.routes.length === 0) {
    return [];
  }
  return parseRouteGeometry(json.routes[0]);
}

/**
 * Calculates road-following route with customization options (traffic, alternatives, exclusions).
 * Requires a valid Mapbox Public Access Token (pk.eyJ...).
 */
export async function calculateMapboxTripRouteDetailed(
  vehicleId: string,
  pickup: TripLocation,
  dropoff: TripLocation,
  token: string,
  options?: MapboxRouteOptions
): Promise<MapboxDetailedRouteResult> {
  const cleanToken = token?.trim();
  if (!cleanToken) {
    throw new Error('Mapbox Access Token is required to use Mapbox Directions API.');
  }

  const profile = options?.profile || 'driving';
  let url = `${MAPBOX_DIRECTIONS_API_BASE}/${profile}/${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}?geometries=geojson&overview=full&access_token=${cleanToken}`;

  if (options?.alternatives) {
    url += '&alternatives=true';
  }

  const excludes: string[] = [];
  if (options?.excludeToll) excludes.push('toll');
  if (options?.excludeMotorway) excludes.push('motorway');
  if (excludes.length > 0) {
    url += `&exclude=${excludes.join(',')}`;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Mapbox API error status: ${response.status}`);
  }

  const data = await response.json();
  if (!data?.routes || !Array.isArray(data.routes) || data.routes.length === 0) {
    throw new Error('Mapbox returned invalid or empty route data.');
  }

  const primaryCoords = parseRouteGeometry(data.routes[0]);
  if (primaryCoords.length < 2) {
    throw new Error('Mapbox returned invalid or empty route coordinates.');
  }

  const primaryTrip: VehicleTrip = {
    vehicleId,
    pickup,
    dropoff,
    plannedPath: primaryCoords,
    distanceMeters:
      typeof data.routes[0].distance === 'number'
        ? Math.round(data.routes[0].distance)
        : undefined,
    durationSeconds:
      typeof data.routes[0].duration === 'number'
        ? Math.round(data.routes[0].duration)
        : undefined,
    createdAt: Date.now(),
  };

  const alternativeTrips: VehicleTrip[] = [];
  if (data.routes.length > 1) {
    for (let i = 1; i < data.routes.length; i++) {
      const altRoute = data.routes[i];
      const altCoords = parseRouteGeometry(altRoute);
      if (altCoords.length >= 2) {
        alternativeTrips.push({
          vehicleId: `${vehicleId}-alt-${i}`,
          pickup,
          dropoff,
          plannedPath: altCoords,
          distanceMeters:
            typeof altRoute.distance === 'number'
              ? Math.round(altRoute.distance)
              : undefined,
          durationSeconds:
            typeof altRoute.duration === 'number'
              ? Math.round(altRoute.duration)
              : undefined,
          createdAt: Date.now(),
        });
      }
    }
  }

  return { primaryTrip, alternativeTrips };
}

/**
 * Calculates road-following route using Mapbox Directions API.
 * Backward-compatible helper that returns the primary VehicleTrip.
 */
export async function calculateMapboxTripRoute(
  vehicleId: string,
  pickup: TripLocation,
  dropoff: TripLocation,
  token: string,
  options?: MapboxRouteOptions
): Promise<VehicleTrip> {
  const result = await calculateMapboxTripRouteDetailed(vehicleId, pickup, dropoff, token, options);
  return result.primaryTrip;
}
