export const JITTER_THRESHOLD_KM = 0.008; // 8 meters
export const MIN_SPEED_THRESHOLD_KMH = 1.5; // km/h
export const MAX_VALID_SPEED_KMH = 150.0; // km/h

const EARTH_RADIUS_KM = 6371.0;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180.0;
}

/**
 * Calculates great-circle distance between two GPS coordinates in kilometers.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export interface CoordinatePoint {
  lat: number;
  lng: number;
  speed: number;
  timestamp: number;
}

/**
 * Computes incremental distance between consecutive telemetry points with noise filtering.
 */
export function calculateDistanceIncrement(
  prev: CoordinatePoint | null | undefined,
  curr: CoordinatePoint
): number {
  if (!prev) return 0;

  const rawDistanceKm = haversineDistance(prev.lat, prev.lng, curr.lat, curr.lng);

  // 1. Filter out parked GPS jitter
  if (rawDistanceKm < JITTER_THRESHOLD_KM && curr.speed < MIN_SPEED_THRESHOLD_KMH) {
    return 0;
  }

  // 2. Reject GPS teleport glitch if implied speed exceeds threshold or impossible jump at same millisecond
  const timeElapsedHours = Math.abs(curr.timestamp - prev.timestamp) / 3600000;
  if (timeElapsedHours === 0 && rawDistanceKm > JITTER_THRESHOLD_KM) {
    return 0;
  }
  if (timeElapsedHours > 0) {
    const impliedSpeed = rawDistanceKm / timeElapsedHours;
    if (impliedSpeed > MAX_VALID_SPEED_KMH) {
      return 0;
    }
  }

  return rawDistanceKm;
}

/**
 * Calculates forward azimuth (bearing) in degrees (0 - 360) from point 1 to point 2.
 * 0° = North, 90° = East, 180° = South, 270° = West.
 */
export function calculateBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLng = toRadians(lng2 - lng1);
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);

  const y = Math.sin(dLng) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLng);

  const bearingRad = Math.atan2(y, x);
  return ((bearingRad * 180.0) / Math.PI + 360.0) % 360.0;
}

