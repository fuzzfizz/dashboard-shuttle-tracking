import { describe, it, expect } from 'vitest';
import {
  shortestAngleDelta,
  interpolateAngle,
  lerpCoordinate,
  isJumpTooLarge,
} from '../markerInterpolation';

describe('markerInterpolation', () => {
  describe('shortestAngleDelta', () => {
    it('returns positive delta for clockwise rotation within 180 deg', () => {
      expect(shortestAngleDelta(10, 50)).toBe(40);
    });

    it('returns negative delta for counter-clockwise rotation within 180 deg', () => {
      expect(shortestAngleDelta(50, 10)).toBe(-40);
    });

    it('handles 0/360 wrap-around clockwise (e.g. 350 to 10 deg is +20 deg)', () => {
      expect(shortestAngleDelta(350, 10)).toBe(20);
    });

    it('handles 0/360 wrap-around counter-clockwise (e.g. 10 to 350 deg is -20 deg)', () => {
      expect(shortestAngleDelta(10, 350)).toBe(-20);
    });

    it('returns 0 when angles are identical', () => {
      expect(shortestAngleDelta(90, 90)).toBe(0);
      expect(shortestAngleDelta(0, 360)).toBe(0);
    });
  });

  describe('interpolateAngle', () => {
    it('interpolates smoothly at progress 0, 0.5, and 1.0', () => {
      expect(interpolateAngle(10, 50, 0)).toBe(10);
      expect(interpolateAngle(10, 50, 0.5)).toBe(30);
      expect(interpolateAngle(10, 50, 1)).toBe(50);
    });

    it('interpolates across 360 wrap boundary without flipping', () => {
      // 350 to 10 is delta +20. At 0.5, angle should be 0 (or 360)
      const mid = interpolateAngle(350, 10, 0.5);
      expect(mid === 0 || mid === 360).toBe(true);
    });
  });

  describe('lerpCoordinate', () => {
    it('interpolates [lat, lng] accurately between from and to', () => {
      const from: [number, number] = [18.70, 98.90];
      const to: [number, number] = [18.80, 99.00];

      const start = lerpCoordinate(from, to, 0);
      expect(start[0]).toBeCloseTo(18.70);
      expect(start[1]).toBeCloseTo(98.90);

      const mid = lerpCoordinate(from, to, 0.5);
      expect(mid[0]).toBeCloseTo(18.75);
      expect(mid[1]).toBeCloseTo(98.95);

      const end = lerpCoordinate(from, to, 1.0);
      expect(end[0]).toBeCloseTo(18.80);
      expect(end[1]).toBeCloseTo(99.00);
    });

    it('clamps progress between 0 and 1', () => {
      const from: [number, number] = [10, 20];
      const to: [number, number] = [20, 30];

      expect(lerpCoordinate(from, to, -0.5)).toEqual([10, 20]);
      expect(lerpCoordinate(from, to, 1.5)).toEqual([20, 30]);
    });
  });

  describe('isJumpTooLarge', () => {
    it('returns false for realistic GPS updates (< 2 km)', () => {
      // ~100 meters
      expect(isJumpTooLarge([18.769, 98.975], [18.770, 98.976], 2.0)).toBe(false);
    });

    it('returns true for unrealistic coordinate teleportation (> 2 km)', () => {
      // Bangkok to Chiang Mai (~580 km)
      expect(isJumpTooLarge([13.756, 100.501], [18.769, 98.975], 2.0)).toBe(true);
    });
  });
});
