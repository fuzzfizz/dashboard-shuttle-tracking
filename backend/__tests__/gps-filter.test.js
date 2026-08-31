import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isValidPoint } from '../src/utils/gps-filter.js';

describe('isValidPoint', () => {
  const basePoint = { lat: 13.7463, lng: 100.5347, speed: 20 };

  describe('Initial Point Handling (prevPoint is null/undefined)', () => {
    it('returns true when prevPoint is null and currentPoint is valid', () => {
      const valid = isValidPoint({ lat: 13.7463, lng: 100.5347, speed: 0 }, null);
      assert.strictEqual(valid, true);
    });

    it('returns true when prevPoint is undefined and currentPoint is valid', () => {
      const valid = isValidPoint({ lat: 13.7463, lng: 100.5347, speed: 10 }, undefined);
      assert.strictEqual(valid, true);
    });

    it('returns false when prevPoint is null but currentPoint coordinates are invalid', () => {
      const valid = isValidPoint({ lat: 95.0, lng: 100.5347, speed: 0 }, null);
      assert.strictEqual(valid, false);
    });

    it('returns false when prevPoint is null but currentPoint speed is negative', () => {
      const valid = isValidPoint({ lat: 13.7463, lng: 100.5347, speed: -5 }, null);
      assert.strictEqual(valid, false);
    });
  });

  describe('Stationary GPS Drift Filter', () => {
    it('returns false when speed < 1.5 km/h and distance < 3 meters (GPS drift)', () => {
      const prev = { lat: 13.746300, lng: 100.534700, speed: 0 };
      // Drift offset of ~0.00001 deg lat is ~1.11m (< 3m)
      const current = { lat: 13.746310, lng: 100.534700, speed: 0.8 };
      const valid = isValidPoint(current, prev, 5);
      assert.strictEqual(valid, false);
    });

    it('returns false when speed is 0 and distance is 0 meters', () => {
      const prev = { lat: 13.7463, lng: 100.5347, speed: 0 };
      const current = { lat: 13.7463, lng: 100.5347, speed: 0 };
      const valid = isValidPoint(current, prev, 5);
      assert.strictEqual(valid, false);
    });

    it('returns true when speed < 1.5 km/h but distance >= 3 meters', () => {
      const prev = { lat: 13.746300, lng: 100.534700, speed: 0.5 };
      // Offset of ~0.00004 deg lat is ~4.44m (>= 3m)
      const current = { lat: 13.746340, lng: 100.534700, speed: 1.0 };
      const valid = isValidPoint(current, prev, 5);
      assert.strictEqual(valid, true);
    });

    it('returns true when speed >= 1.5 km/h even if distance < 3 meters', () => {
      const prev = { lat: 13.746300, lng: 100.534700, speed: 5 };
      // Offset of ~1.11m but speed is 5 km/h
      const current = { lat: 13.746310, lng: 100.534700, speed: 5.0 };
      const valid = isValidPoint(current, prev, 5);
      assert.strictEqual(valid, true);
    });
  });

  describe('GPS Teleport / Jump Anomaly Filter', () => {
    it('returns false when distance > 5000m and timeDiffSec <= 10s (teleport anomaly)', () => {
      const prev = { lat: 13.7463, lng: 100.5347, speed: 60 };
      // Move to ~10km away in 5 seconds
      const current = { lat: 13.8463, lng: 100.5347, speed: 60 };
      const valid = isValidPoint(current, prev, 5);
      assert.strictEqual(valid, false);
    });

    it('uses default timeDiffSec of 5s and rejects > 5000m jump', () => {
      const prev = { lat: 13.7463, lng: 100.5347, speed: 60 };
      const current = { lat: 13.8463, lng: 100.5347, speed: 60 };
      const valid = isValidPoint(current, prev); // default timeDiffSec = 5
      assert.strictEqual(valid, false);
    });

    it('returns true when distance > 5000m but timeDiffSec > 10s (legitimate long interval)', () => {
      const prev = { lat: 13.7463, lng: 100.5347, speed: 60 };
      // Move ~11km away over 600 seconds (10 minutes)
      const current = { lat: 13.8463, lng: 100.5347, speed: 60 };
      const valid = isValidPoint(current, prev, 600);
      assert.strictEqual(valid, true);
    });

    it('returns true for normal vehicle movement (< 5000m in 5s)', () => {
      const prev = { lat: 13.7463, lng: 100.5347, speed: 40 };
      // Move ~50 meters in 5s
      const current = { lat: 13.74675, lng: 100.5347, speed: 40 };
      const valid = isValidPoint(current, prev, 5);
      assert.strictEqual(valid, true);
    });
  });

  describe('Input Validation & Coordinate Bounds', () => {
    it('returns false for null or non-object currentPoint', () => {
      assert.strictEqual(isValidPoint(null), false);
      assert.strictEqual(isValidPoint(undefined), false);
      assert.strictEqual(isValidPoint('invalid'), false);
    });

    it('returns false when currentPoint coordinates are out of bounds', () => {
      assert.strictEqual(isValidPoint({ lat: -91, lng: 100, speed: 10 }), false);
      assert.strictEqual(isValidPoint({ lat: 91, lng: 100, speed: 10 }), false);
      assert.strictEqual(isValidPoint({ lat: 13, lng: -181, speed: 10 }), false);
      assert.strictEqual(isValidPoint({ lat: 13, lng: 181, speed: 10 }), false);
    });

    it('returns false when speed is negative or NaN', () => {
      assert.strictEqual(isValidPoint({ lat: 13, lng: 100, speed: -1 }), false);
      assert.strictEqual(isValidPoint({ lat: 13, lng: 100, speed: NaN }), false);
      assert.strictEqual(isValidPoint({ lat: 13, lng: 100, speed: 'fast' }), false);
    });

    it('supports lon as alias for lng property', () => {
      const current = { lat: 13.7463, lon: 100.5347, speed: 20 };
      assert.strictEqual(isValidPoint(current, null), true);
    });
  });
});
