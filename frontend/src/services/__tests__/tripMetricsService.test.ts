import { describe, it, expect } from 'vitest';
import {
  calculateTripProgressMetrics,
  formatRemainingTime,
} from '../tripMetricsService';
import { VehicleTrip } from '../../types/trip';

describe('tripMetricsService', () => {
  const mockTrip: VehicleTrip = {
    vehicleId: 'shuttle-test-01',
    pickup: { lat: 18.7900, lng: 98.9655, name: 'จุดรับ (สุเทพ)' },
    dropoff: { lat: 18.7240, lng: 98.9838, name: 'จุดส่ง (หางดง)' },
    plannedPath: [
      [18.7900, 98.9655],
      [18.7600, 98.9700],
      [18.7240, 98.9838],
    ],
    distanceMeters: 14000,
    durationSeconds: 1200, // 20 minutes
    createdAt: Date.now(),
  };

  describe('formatRemainingTime', () => {
    it('formats less than 1 minute', () => {
      expect(formatRemainingTime(0)).toBe('ถึงจุดส่งแล้ว');
      expect(formatRemainingTime(30)).toBe('< 1 นาที');
    });

    it('formats minutes under 1 hour', () => {
      expect(formatRemainingTime(180)).toBe('~3 นาที');
      expect(formatRemainingTime(540)).toBe('~9 นาที');
    });

    it('formats hours and minutes', () => {
      expect(formatRemainingTime(3660)).toBe('~1 ชม. 1 นาที');
      expect(formatRemainingTime(7200)).toBe('~2 ชม.');
    });
  });

  describe('calculateTripProgressMetrics', () => {
    it('returns null when trip is null or missing locations', () => {
      expect(calculateTripProgressMetrics(undefined)).toBeNull();
    });

    it('calculates total distance and initial metrics when vehicle has not started', () => {
      const res = calculateTripProgressMetrics(mockTrip, null, 'in-transit');
      expect(res).not.toBeNull();
      expect(res?.totalDistanceKm).toBeCloseTo(14.0, 1);
      expect(res?.remainingDistanceKm).toBeCloseTo(14.0, 1);
      expect(res?.progressPercent).toBe(0);
      expect(res?.formattedEta).toBe('~20 นาที');
    });

    it('calculates remaining distance and ETA midway along the trip', () => {
      // Vehicle at midway coordinate [18.7600, 98.9700] traveling at 45 km/h
      const currentLocation = {
        lat: 18.7600,
        lng: 98.9700,
        speed: 45,
      };

      const res = calculateTripProgressMetrics(mockTrip, currentLocation, 'in-transit');
      expect(res).not.toBeNull();
      expect(res!.remainingDistanceKm).toBeLessThan(14.0);
      expect(res!.remainingDistanceKm).toBeGreaterThan(0);
      expect(res!.progressPercent).toBeGreaterThan(0);
      expect(res!.progressPercent).toBeLessThan(100);
      expect(res!.estimatedRemainingSeconds).toBeGreaterThan(0);
      expect(res!.formattedEta).toMatch(/นาที/);
    });

    it('returns 0 remaining distance and arrived status when dwelling at dropoff', () => {
      const res = calculateTripProgressMetrics(
        mockTrip,
        { lat: 18.7240, lng: 98.9838, speed: 0 },
        'dwelling-dropoff'
      );
      expect(res).not.toBeNull();
      expect(res?.remainingDistanceKm).toBe(0);
      expect(res?.progressPercent).toBe(100);
      expect(res?.formattedEta).toBe('ถึงจุดส่งแล้ว (กำลังส่งคนลง)');
    });

    it('returns arrived-dropoff status when departed and waiting 3-min reset', () => {
      const res = calculateTripProgressMetrics(
        mockTrip,
        { lat: 18.7300, lng: 98.9800, speed: 30 },
        'arrived-dropoff'
      );
      expect(res).not.toBeNull();
      expect(res?.remainingDistanceKm).toBe(0);
      expect(res?.progressPercent).toBe(100);
      expect(res?.formattedEta).toBe('ส่งผู้โดยสารเสร็จสิ้นแล้ว');
      expect(res?.remainingDistanceLabel).toMatch(/กำลังกลับจุดรับ/);
    });

    it('returns waiting-pickup status and calculates distance/time back to pickup', () => {
      const res = calculateTripProgressMetrics(
        mockTrip,
        { lat: 18.7800, lng: 98.9700, speed: 40 },
        'waiting-pickup'
      );
      expect(res).not.toBeNull();
      expect(res?.etaTitle).toBe('เวลาที่เหลือจนถึงจุดรับ');
      expect(res?.remainingDistanceKm).toBeGreaterThan(0);
      expect(res?.remainingDistanceLabel).toMatch(/ถึงจุดรับ/);
      expect(res?.formattedEta).toMatch(/นาที/);
    });
  });
});
