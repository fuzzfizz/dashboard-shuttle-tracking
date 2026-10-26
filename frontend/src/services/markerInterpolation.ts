import { haversineDistance } from './distanceCalculator';

/**
 * Calculates the shortest angular difference in degrees from fromAngle to toAngle.
 * Positive for clockwise rotation, negative for counter-clockwise (-180 to +180).
 */
export function shortestAngleDelta(fromAngle: number, toAngle: number): number {
  const diff = ((toAngle - fromAngle + 180) % 360 + 360) % 360 - 180;
  return diff === -180 ? 180 : diff;
}

/**
 * Interpolates heading smoothly taking the shortest angular path across 0/360.
 */
export function interpolateAngle(fromAngle: number, toAngle: number, progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  const delta = shortestAngleDelta(fromAngle, toAngle);
  const result = (fromAngle + delta * p + 360) % 360;
  return result;
}

/**
 * Linearly interpolates between two [lat, lng] coordinates based on progress (0 to 1).
 */
export function lerpCoordinate(
  from: [number, number],
  to: [number, number],
  progress: number
): [number, number] {
  const p = Math.max(0, Math.min(1, progress));
  const lat = from[0] + (to[0] - from[0]) * p;
  const lng = from[1] + (to[1] - from[1]) * p;
  return [lat, lng];
}

/**
 * Checks if the jump distance between two coordinates is larger than maxAllowedKm.
 * Used as a teleportation guard (e.g. testing in Bangkok then moving to Chiang Mai).
 */
export function isJumpTooLarge(
  from: [number, number],
  to: [number, number],
  maxAllowedKm: number = 2.0
): boolean {
  const dist = haversineDistance(from[0], from[1], to[0], to[1]);
  return dist > maxAllowedKm;
}
