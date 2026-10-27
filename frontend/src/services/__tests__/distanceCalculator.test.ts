import { describe, it, expect } from 'vitest';
import {
  haversineDistance,
  calculateDistanceIncrement,
  calculateBearing,
  JITTER_THRESHOLD_KM,
  MIN_SPEED_THRESHOLD_KMH,
  MAX_VALID_SPEED_KMH,
} from '../distanceCalculator';

describe('distanceCalculator', () => {
  it('calculates known distance accurately using Haversine formula', () => {
    // Distance between Victory Monument (13.7649, 100.5383) and Siam Paragon (13.7460, 100.5340) ~2.15 km
    const dist = haversineDistance(13.7649, 100.5383, 13.7460, 100.5340);
    expect(dist).toBeGreaterThan(2.0);
    expect(dist).toBeLessThan(2.3);
  });

  it('calculates zero distance for identical coordinates', () => {
    const dist = haversineDistance(13.7563, 100.5018, 13.7563, 100.5018);
    expect(dist).toBe(0);
  });

  it('filters out GPS jitter when stationary (speed < 1.5 km/h and distance < 8m)', () => {
    const prev = { lat: 13.756300, lng: 100.501800, speed: 0.0, timestamp: 1000 };
    // Small drift of ~4 meters
    const next = { lat: 13.756336, lng: 100.501800, speed: 0.5, timestamp: 2000 };

    const dist = calculateDistanceIncrement(prev, next);
    expect(dist).toBe(0);
  });

  it('accumulates valid movement distance when vehicle is in motion', () => {
    const prev = { lat: 13.756300, lng: 100.501800, speed: 30.0, timestamp: 1000 };
    // Move ~110 meters in 5 seconds
    const next = { lat: 13.757300, lng: 100.501800, speed: 32.0, timestamp: 6000 };

    const dist = calculateDistanceIncrement(prev, next);
    expect(dist).toBeGreaterThan(0.1);
    expect(dist).toBeLessThan(0.12);
  });

  it('rejects unrealistic GPS teleport glitch (> 150 km/h)', () => {
    const prev = { lat: 13.7563, lng: 100.5018, speed: 30.0, timestamp: 1000 };
    // Jumps to Chiang Mai in 1 second
    const next = { lat: 18.7883, lng: 98.9853, speed: 30.0, timestamp: 2000 };

    const dist = calculateDistanceIncrement(prev, next);
    expect(dist).toBe(0);
  });

  it('returns 0 when prev point is null or undefined', () => {
    const curr = { lat: 13.7563, lng: 100.5018, speed: 20.0, timestamp: 1000 };
    expect(calculateDistanceIncrement(null, curr)).toBe(0);
    expect(calculateDistanceIncrement(undefined, curr)).toBe(0);
  });

  it('exports correct filter threshold constants', () => {
    expect(JITTER_THRESHOLD_KM).toBe(0.008);
    expect(MIN_SPEED_THRESHOLD_KMH).toBe(1.5);
    expect(MAX_VALID_SPEED_KMH).toBe(150.0);
  });

  describe('calculateBearing', () => {
    it('calculates 0 degrees for due North movement', () => {
      // Moving directly North from Bangkok equator-side
      const bearing = calculateBearing(13.0, 100.0, 14.0, 100.0);
      expect(Math.round(bearing)).toBe(0);
    });

    it('calculates 90 degrees for due East movement', () => {
      // Moving directly East along equator
      const bearing = calculateBearing(0.0, 100.0, 0.0, 101.0);
      expect(Math.round(bearing)).toBe(90);
    });

    it('calculates 180 degrees for due South movement', () => {
      const bearing = calculateBearing(14.0, 100.0, 13.0, 100.0);
      expect(Math.round(bearing)).toBe(180);
    });

    it('calculates 270 degrees for due West movement', () => {
      const bearing = calculateBearing(0.0, 101.0, 0.0, 100.0);
      expect(Math.round(bearing)).toBe(270);
    });

    it('calculates ~45 degrees for North-East diagonal movement', () => {
      const bearing = calculateBearing(13.0, 100.0, 14.0, 101.0);
      expect(Math.round(bearing)).toBeGreaterThan(40);
      expect(Math.round(bearing)).toBeLessThan(50);
    });
  });
});
