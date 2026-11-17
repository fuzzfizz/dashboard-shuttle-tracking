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
 * Calculates perpendicular distance in meters from point (pLat, pLng)
 * to line segment between (aLat, aLng) and (bLat, bLng).
 */
export function distanceToSegmentMeters(
  pLat: number,
  pLng: number,
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const midLatRad = ((aLat + bLat) / 2) * (Math.PI / 180);
  const cosLat = Math.cos(midLatRad);
  const M_PER_DEG = 111320;

  const ax = aLng * cosLat * M_PER_DEG;
  const ay = aLat * M_PER_DEG;
  const bx = bLng * cosLat * M_PER_DEG;
  const by = bLat * M_PER_DEG;
  const px = pLng * cosLat * M_PER_DEG;
  const py = pLat * M_PER_DEG;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    const diffX = px - ax;
    const diffY = py - ay;
    return Math.sqrt(diffX * diffX + diffY * diffY);
  }

  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = ax + t * dx;
  const projY = ay + t * dy;

  const diffX = px - projX;
  const diffY = py - projY;
  return Math.sqrt(diffX * diffX + diffY * diffY);
}

/**
 * Filters an alternative route's polyline to only keep segments that diverge
 * from the primary route (i.e. hides segments where the alternative overlaps with the primary).
 * Returns an array of polyline coordinate arrays.
 */
export function getDivergentSegments(
  alternativePath: Array<[number, number]>,
  primaryPath: Array<[number, number]>,
  thresholdMeters: number = 12
): Array<Array<[number, number]>> {
  if (!alternativePath || alternativePath.length < 2) return [];
  if (!primaryPath || primaryPath.length < 2) return [alternativePath];

  const numSegments = alternativePath.length - 1;
  const isDivergent: boolean[] = new Array(numSegments);

  for (let i = 0; i < numSegments; i++) {
    const p1 = alternativePath[i];
    const p2 = alternativePath[i + 1];
    const midLat = (p1[0] + p2[0]) / 2;
    const midLng = (p1[1] + p2[1]) / 2;

    let minDistance = Infinity;
    for (let j = 0; j < primaryPath.length - 1; j++) {
      const a = primaryPath[j];
      const b = primaryPath[j + 1];
      const d = distanceToSegmentMeters(midLat, midLng, a[0], a[1], b[0], b[1]);
      if (d < minDistance) {
        minDistance = d;
        if (minDistance < thresholdMeters) break;
      }
    }

    isDivergent[i] = minDistance >= thresholdMeters;
  }

  const divergentPolylines: Array<Array<[number, number]>> = [];
  let currentPolyline: Array<[number, number]> | null = null;

  for (let i = 0; i < numSegments; i++) {
    if (isDivergent[i]) {
      if (!currentPolyline) {
        currentPolyline = [alternativePath[i], alternativePath[i + 1]];
      } else {
        currentPolyline.push(alternativePath[i + 1]);
      }
    } else {
      if (currentPolyline) {
        divergentPolylines.push(currentPolyline);
        currentPolyline = null;
      }
    }
  }

  if (currentPolyline) {
    divergentPolylines.push(currentPolyline);
  }

  return divergentPolylines;
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
