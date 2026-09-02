import { test, describe } from 'node:test';
import assert from 'node:assert';
import { formatDuration, calculateTrackStats, filterTrips } from '../src/lib/trip-utils.ts';
import type { GpsPoint, Trip } from '../src/lib/types.ts';

describe('Trip Utils', () => {
  describe('formatDuration', () => {
    test('formats seconds', () => {
      const start = new Date('2024-01-01T10:00:00Z').toISOString();
      const end = new Date('2024-01-01T10:00:45Z').toISOString();
      assert.strictEqual(formatDuration(start, end), '45 secs');
    });

    test('formats minutes', () => {
      const start = new Date('2024-01-01T10:00:00Z').toISOString();
      const end = new Date('2024-01-01T10:15:00Z').toISOString();
      assert.strictEqual(formatDuration(start, end), '15 mins');
    });

    test('formats hours and minutes', () => {
      const start = new Date('2024-01-01T10:00:00Z').toISOString();
      const end = new Date('2024-01-01T11:15:00Z').toISOString();
      assert.strictEqual(formatDuration(start, end), '1 hr 15 mins');
    });
  });

  describe('calculateTrackStats', () => {
    test('returns zeros for empty track', () => {
      assert.deepStrictEqual(calculateTrackStats([]), {
        totalPoints: 0,
        maxSpeedKmh: 0,
        avgSpeedKmh: 0,
        distanceKm: 0,
      });
    });

    test('calculates stats correctly', () => {
      const track: Partial<GpsPoint>[] = [
        { lat: 13.7563, lng: 100.5018, speed_kmh: 20 },
        { lat: 13.7573, lng: 100.5028, speed_kmh: 40 },
        { lat: 13.7583, lng: 100.5038, speed_kmh: 30 },
      ];
      const stats = calculateTrackStats(track as GpsPoint[]);
      assert.strictEqual(stats.totalPoints, 3);
      assert.strictEqual(stats.maxSpeedKmh, 40);
      assert.strictEqual(stats.avgSpeedKmh, 30);
      assert.ok(stats.distanceKm > 0);
    });
  });

  describe('filterTrips', () => {
    const trips: Partial<Trip>[] = [
      { id: '1', vehicle_id: 'v1', route_id: 'r1', status: 'completed', started_at: '2024-01-01T10:00:00Z' },
      { id: '2', vehicle_id: 'v2', route_id: 'r1', status: 'in_progress', started_at: '2024-01-02T10:00:00Z' },
      { id: '3', vehicle_id: 'v1', route_id: 'r2', status: 'completed', started_at: '2024-01-02T11:00:00Z' },
    ];

    test('filters by date', () => {
      const filtered = filterTrips(trips as Trip[], { date: '2024-01-01' });
      assert.strictEqual(filtered.length, 1);
      assert.strictEqual(filtered[0].id, '1');
    });

    test('filters by vehicleId', () => {
      const filtered = filterTrips(trips as Trip[], { vehicleId: 'v2' });
      assert.strictEqual(filtered.length, 1);
      assert.strictEqual(filtered[0].id, '2');
    });

    test('filters by status', () => {
      const filtered = filterTrips(trips as Trip[], { status: 'in_progress' });
      assert.strictEqual(filtered.length, 1);
      assert.strictEqual(filtered[0].id, '2');
    });
  });
});
