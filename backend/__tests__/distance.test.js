import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { haversineDistance } from '../src/utils/distance.js';

describe('haversineDistance', () => {
  describe('Valid Calculations', () => {
    it('returns 0 for identical points', () => {
      const dist = haversineDistance(13.7463, 100.5347, 13.7463, 100.5347);
      assert.strictEqual(dist, 0);
    });

    it('calculates distance between Siam and Victory Monument (~2102m)', () => {
      // Siam: 13.7463, 100.5347; Victory Monument: 13.7649, 100.5382
      const dist = haversineDistance(13.7463, 100.5347, 13.7649, 100.5382);
      // Expect approximately 2102.5 meters (tolerance +/- 20m around 2100m)
      assert.ok(dist >= 2080 && dist <= 2120, `Expected ~2100m, got ${dist}`);
    });

    it('calculates distance along equator (1 degree longitude ~111.19km)', () => {
      const dist = haversineDistance(0, 0, 0, 1);
      // 1 degree longitude at equator = 2 * PI * 6371000 / 360 = ~111195m
      assert.ok(Math.abs(dist - 111195) < 50, `Expected ~111195m, got ${dist}`);
    });

    it('calculates pole to pole distance (~20015km)', () => {
      const dist = haversineDistance(90, 0, -90, 0);
      const expected = Math.PI * 6371000;
      assert.ok(Math.abs(dist - expected) < 1, `Expected ${expected}m, got ${dist}`);
    });

    it('calculates small distance accurately (few meters)', () => {
      // Offset by ~0.00001 degrees lat (~1.11 meters)
      const dist = haversineDistance(13.74630, 100.53470, 13.74631, 100.53470);
      assert.ok(dist > 1.0 && dist < 1.3, `Expected ~1.11m, got ${dist}`);
    });

    it('accepts valid boundary coordinate values (-90, 90, -180, 180)', () => {
      assert.doesNotThrow(() => {
        haversineDistance(-90, -180, 90, 180);
      });
    });
  });

  describe('Validation and Error Handling', () => {
    it('throws Error if lat1 is less than -90', () => {
      assert.throws(() => {
        haversineDistance(-90.1, 100.0, 13.0, 100.0);
      }, /coordinate/i);
    });

    it('throws Error if lat1 is greater than 90', () => {
      assert.throws(() => {
        haversineDistance(90.1, 100.0, 13.0, 100.0);
      }, /coordinate/i);
    });

    it('throws Error if lat2 is out of range', () => {
      assert.throws(() => {
        haversineDistance(13.0, 100.0, -95.0, 100.0);
      }, /coordinate/i);
      assert.throws(() => {
        haversineDistance(13.0, 100.0, 95.0, 100.0);
      }, /coordinate/i);
    });

    it('throws Error if lon1 is less than -180', () => {
      assert.throws(() => {
        haversineDistance(13.0, -180.1, 13.0, 100.0);
      }, /coordinate/i);
    });

    it('throws Error if lon1 is greater than 180', () => {
      assert.throws(() => {
        haversineDistance(13.0, 180.1, 13.0, 100.0);
      }, /coordinate/i);
    });

    it('throws Error if lon2 is out of range', () => {
      assert.throws(() => {
        haversineDistance(13.0, 100.0, 13.0, -181.0);
      }, /coordinate/i);
      assert.throws(() => {
        haversineDistance(13.0, 100.0, 13.0, 181.0);
      }, /coordinate/i);
    });

    it('throws Error if any coordinate is NaN or non-number', () => {
      assert.throws(() => haversineDistance(NaN, 100, 13, 100), /coordinate/i);
      assert.throws(() => haversineDistance(13, 'invalid', 13, 100), /coordinate/i);
      assert.throws(() => haversineDistance(13, 100, null, 100), /coordinate/i);
      assert.throws(() => haversineDistance(13, 100, 13, undefined), /coordinate/i);
    });
  });
});
