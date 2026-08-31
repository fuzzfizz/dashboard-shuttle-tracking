import { haversineDistance } from './distance.js';

/**
 * Validates a GPS telemetry point against noise filters:
 * 1. Valid structure, coordinates (-90<=lat<=90, -180<=lng<=180), and speed (>=0).
 * 2. Stationary GPS drift: speed < 1.5 km/h AND distance < 3 meters -> false.
 * 3. GPS teleport / jump anomaly: distance > 5000 meters AND timeDiffSec <= 10 -> false.
 *
 * @param {{ lat: number, lng?: number, lon?: number, speed: number }} currentPoint - The incoming GPS point.
 * @param {{ lat: number, lng?: number, lon?: number, speed: number } | null} [prevPoint] - The previous valid GPS point.
 * @param {number} [timeDiffSec=5] - Time elapsed in seconds since previous point.
 * @returns {boolean} True if point is valid and passes noise filters, false otherwise.
 */
export function isValidPoint(currentPoint, prevPoint, timeDiffSec = 5) {
  if (!currentPoint || typeof currentPoint !== 'object') {
    return false;
  }

  const { lat, speed } = currentPoint;
  const lng = currentPoint.lng !== undefined ? currentPoint.lng : currentPoint.lon;

  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    typeof speed !== 'number' ||
    Number.isNaN(lat) ||
    Number.isNaN(lng) ||
    Number.isNaN(speed)
  ) {
    return false;
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return false;
  }

  if (speed < 0) {
    return false;
  }

  if (!prevPoint || typeof prevPoint !== 'object') {
    return true;
  }

  const prevLat = prevPoint.lat;
  const prevLng = prevPoint.lng !== undefined ? prevPoint.lng : prevPoint.lon;

  if (
    typeof prevLat !== 'number' ||
    typeof prevLng !== 'number' ||
    Number.isNaN(prevLat) ||
    Number.isNaN(prevLng) ||
    prevLat < -90 ||
    prevLat > 90 ||
    prevLng < -180 ||
    prevLng > 180
  ) {
    return true;
  }

  const distance = haversineDistance(lat, lng, prevLat, prevLng);
  const effectiveTimeDiff =
    typeof timeDiffSec === 'number' && !Number.isNaN(timeDiffSec)
      ? timeDiffSec
      : 5;

  // Filter 1: GPS drift while stationary (speed < 1.5 km/h and distance < 3m)
  if (speed < 1.5 && distance < 3) {
    return false;
  }

  // Filter 2: GPS teleport / jump anomaly (> 5000m within <= 10s)
  if (distance > 5000 && effectiveTimeDiff <= 10) {
    return false;
  }

  return true;
}
