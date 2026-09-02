import { describe, it } from 'node:test';
import assert from 'node:assert';
import { formatSpeed, formatHeading, filterVehicles, updateVehicleLocation } from '../src/lib/utils.ts';

describe('Live Tracking Helpers', () => {
  describe('formatSpeed', () => {
    it('formats speed correctly', () => {
      assert.strictEqual(formatSpeed(32.4), '32 km/h');
      assert.strictEqual(formatSpeed(0), '0 km/h');
      assert.strictEqual(formatSpeed(null), '0 km/h');
      assert.strictEqual(formatSpeed(undefined), '0 km/h');
    });
  });

  describe('formatHeading', () => {
    it('formats heading into cardinal direction', () => {
      assert.strictEqual(formatHeading(0), 'N');
      assert.strictEqual(formatHeading(90), 'E');
      assert.strictEqual(formatHeading(180), 'S');
      assert.strictEqual(formatHeading(270), 'W');
      assert.strictEqual(formatHeading(45), 'NE');
      assert.strictEqual(formatHeading(null), 'N/A');
    });
  });

  describe('filterVehicles', () => {
    const vehicles = [
      { id: '1', plate_number: 'AB-1234', current_route_id: 'route-1' },
      { id: '2', plate_number: 'CD-5678', current_route_id: 'route-2' },
      { id: '3', plate_number: 'EF-9012', current_route_id: 'route-1' },
    ];

    it('filters by route_id', () => {
      const result = filterVehicles(vehicles, 'route-1', '');
      assert.strictEqual(result.length, 2);
      assert.deepStrictEqual(result.map(v => v.id), ['1', '3']);
    });

    it('filters by search query', () => {
      const result = filterVehicles(vehicles, 'all', 'cd');
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].id, '2');
    });

    it('filters by both route_id and search query', () => {
      const result = filterVehicles(vehicles, 'route-1', 'ab');
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].id, '1');
    });

    it('returns all when no filters applied', () => {
      const result = filterVehicles(vehicles, 'all', '');
      assert.strictEqual(result.length, 3);
    });
  });

  describe('updateVehicleLocation', () => {
    const vehicles = [
      { id: '1', plate_number: 'AB-1234', status: 'idle', last_lat: 0, last_lng: 0, last_speed: 0, last_heading: 0, last_seen_at: '2023-01-01T00:00:00Z' },
    ];

    it('updates vehicle state correctly on location payload', () => {
      const payload = {
        vehicle_id: '1',
        lat: 13.75,
        lng: 100.5,
        speed_kmh: 40,
        heading: 90,
        timestamp: '2023-01-01T00:01:00Z',
        status: 'in_transit'
      };

      const updated = updateVehicleLocation(vehicles, payload);
      assert.strictEqual(updated[0].last_lat, 13.75);
      assert.strictEqual(updated[0].last_lng, 100.5);
      assert.strictEqual(updated[0].last_speed, 40);
      assert.strictEqual(updated[0].last_heading, 90);
      assert.strictEqual(updated[0].last_seen_at, '2023-01-01T00:01:00Z');
      assert.strictEqual(updated[0].status, 'in_transit');
    });

    it('does not mutate original array', () => {
      const payload = { vehicle_id: '1', lat: 10, lng: 10, speed_kmh: 10, heading: 10, timestamp: 'now' };
      const updated = updateVehicleLocation(vehicles, payload);
      assert.notStrictEqual(updated, vehicles);
      assert.notStrictEqual(updated[0], vehicles[0]);
    });
    
    it('returns same array if vehicle not found', () => {
      const payload = { vehicle_id: '99', lat: 10, lng: 10, speed_kmh: 10, heading: 10, timestamp: 'now' };
      const updated = updateVehicleLocation(vehicles, payload);
      assert.deepStrictEqual(updated, vehicles);
    });
  });
});
