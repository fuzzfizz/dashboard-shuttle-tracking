import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getOrCreateActiveTrip,
  closeActiveTrip,
  closeStaleTrips
} from '../src/services/trip-service.js';

describe('Trip Service', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = {
      trips: [],
      vehicles: [],
      query: async function (text, params = []) {
        const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();

        // 1. SELECT active trip for vehicle
        if (normalized.includes('select') && normalized.includes('from trips') && normalized.includes("status = 'in_progress'")) {
          const vehicleId = params[0];
          const tripDate = params[1];
          const trip = this.trips.find(
            (t) =>
              t.vehicle_id === vehicleId &&
              t.status === 'in_progress' &&
              (!tripDate || t.trip_date === tripDate)
          );
          return { rows: trip ? [{ ...trip }] : [] };
        }

        // 2. SELECT MAX(trip_number) for vehicle and date
        if (normalized.includes('max(trip_number)') && normalized.includes('from trips')) {
          const vehicleId = params[0];
          const tripDate = params[1];
          const matching = this.trips.filter(
            (t) => t.vehicle_id === vehicleId && (!tripDate || t.trip_date === tripDate)
          );
          const maxNum = matching.reduce((max, t) => Math.max(max, t.trip_number || 0), 0);
          return { rows: [{ max_trip_number: maxNum }] };
        }

        // 3. INSERT INTO trips
        if (normalized.includes('insert into trips')) {
          // params: [vehicleId, tripNumber, startedAt, tripDate]
          const [vehicleId, tripNumber, startedAt, tripDate] = params;
          const newTrip = {
            id: `trip-${this.trips.length + 1}`,
            vehicle_id: vehicleId,
            trip_number: tripNumber,
            started_at: startedAt ? new Date(startedAt).toISOString() : new Date().toISOString(),
            ended_at: null,
            total_distance_km: 0,
            total_points: 0,
            status: 'in_progress',
            trip_date: tripDate || new Date().toISOString().slice(0, 10)
          };
          this.trips.push(newTrip);
          return { rows: [{ ...newTrip }] };
        }

        // 4. UPDATE trips to close active trip
        if (normalized.includes('update trips') && normalized.includes("status = 'completed'") && normalized.includes("vehicle_id = $1")) {
          const vehicleId = params[0];
          const endedAt = params[1] ? new Date(params[1]).toISOString() : new Date().toISOString();
          const trip = this.trips.find(
            (t) => t.vehicle_id === vehicleId && t.status === 'in_progress'
          );
          if (trip) {
            trip.status = 'completed';
            trip.ended_at = endedAt;
            return { rows: [{ ...trip }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }

        // 5. UPDATE trips for closeStaleTrips
        if (normalized.includes('update trips') && normalized.includes("status = 'completed'") && (normalized.includes('last_seen_at') || normalized.includes('vehicles'))) {
          const maxIdleMinutes = params[0] || 15;
          const cutoffTime = Date.now() - maxIdleMinutes * 60 * 1000;
          const closed = [];

          for (const trip of this.trips) {
            if (trip.status === 'in_progress') {
              const vehicle = this.vehicles.find((v) => v.id === trip.vehicle_id);
              if (vehicle && vehicle.last_seen_at) {
                const lastSeen = new Date(vehicle.last_seen_at).getTime();
                if (lastSeen < cutoffTime) {
                  trip.status = 'completed';
                  trip.ended_at = new Date().toISOString();
                  closed.push({ ...trip });
                }
              } else if (!vehicle || !vehicle.last_seen_at) {
                // If vehicle has no last_seen_at, treat as stale
                trip.status = 'completed';
                trip.ended_at = new Date().toISOString();
                closed.push({ ...trip });
              }
            }
          }
          return { rows: closed, rowCount: closed.length };
        }

        throw new Error(`Unhandled mock query: ${text}`);
      }
    };
  });

  describe('getOrCreateActiveTrip', () => {
    it('returns an existing active trip if one is already in_progress today', async () => {
      const vehicleId = 'veh-001';
      const today = '2026-09-15';
      const existingTrip = {
        id: 'trip-existing',
        vehicle_id: vehicleId,
        trip_number: 1,
        started_at: '2026-09-15T08:00:00Z',
        ended_at: null,
        total_distance_km: 5.2,
        total_points: 42,
        status: 'in_progress',
        trip_date: today
      };
      mockDb.trips.push(existingTrip);

      const trip = await getOrCreateActiveTrip(mockDb, vehicleId, '2026-09-15T08:30:00Z');

      assert.ok(trip);
      assert.strictEqual(trip.id, 'trip-existing');
      assert.strictEqual(trip.vehicle_id, vehicleId);
      assert.strictEqual(trip.status, 'in_progress');
      assert.strictEqual(mockDb.trips.length, 1);
    });

    it('creates a new trip with trip_number = 1 when no trips exist for today', async () => {
      const vehicleId = 'veh-002';
      const timestamp = '2026-09-15T09:00:00Z';

      const trip = await getOrCreateActiveTrip(mockDb, vehicleId, timestamp);

      assert.ok(trip);
      assert.strictEqual(trip.vehicle_id, vehicleId);
      assert.strictEqual(trip.trip_number, 1);
      assert.strictEqual(trip.status, 'in_progress');
      assert.strictEqual(trip.total_distance_km, 0);
      assert.strictEqual(trip.total_points, 0);
      assert.strictEqual(trip.trip_date, '2026-09-15');
      assert.strictEqual(mockDb.trips.length, 1);
    });

    it('creates trip with trip_number = max + 1 when previous trips exist on the same day', async () => {
      const vehicleId = 'veh-003';
      const today = '2026-09-15';

      mockDb.trips.push(
        {
          id: 'trip-1',
          vehicle_id: vehicleId,
          trip_number: 1,
          started_at: '2026-09-15T06:00:00Z',
          ended_at: '2026-09-15T07:00:00Z',
          status: 'completed',
          trip_date: today
        },
        {
          id: 'trip-2',
          vehicle_id: vehicleId,
          trip_number: 2,
          started_at: '2026-09-15T07:30:00Z',
          ended_at: '2026-09-15T08:30:00Z',
          status: 'completed',
          trip_date: today
        }
      );

      const trip = await getOrCreateActiveTrip(mockDb, vehicleId, '2026-09-15T09:00:00Z');

      assert.ok(trip);
      assert.strictEqual(trip.trip_number, 3);
      assert.strictEqual(trip.status, 'in_progress');
      assert.strictEqual(mockDb.trips.length, 3);
    });

    it('defaults to current timestamp if timestamp is not provided', async () => {
      const vehicleId = 'veh-004';
      const trip = await getOrCreateActiveTrip(mockDb, vehicleId);

      assert.ok(trip);
      assert.strictEqual(trip.vehicle_id, vehicleId);
      assert.strictEqual(trip.trip_number, 1);
      assert.strictEqual(trip.status, 'in_progress');
      assert.ok(trip.started_at);
      assert.ok(trip.trip_date);
    });
  });

  describe('closeActiveTrip', () => {
    it('marks active trip as completed with ended_at set to provided timestamp', async () => {
      const vehicleId = 'veh-005';
      mockDb.trips.push({
        id: 'trip-active',
        vehicle_id: vehicleId,
        trip_number: 1,
        started_at: '2026-09-15T08:00:00Z',
        ended_at: null,
        total_distance_km: 12.5,
        total_points: 100,
        status: 'in_progress',
        trip_date: '2026-09-15'
      });

      const closedTrip = await closeActiveTrip(
        mockDb,
        vehicleId,
        '2026-09-15T08:45:00Z',
        'acc_off'
      );

      assert.ok(closedTrip);
      assert.strictEqual(closedTrip.id, 'trip-active');
      assert.strictEqual(closedTrip.status, 'completed');
      assert.strictEqual(closedTrip.ended_at, '2026-09-15T08:45:00.000Z');

      const inDb = mockDb.trips.find((t) => t.id === 'trip-active');
      assert.strictEqual(inDb.status, 'completed');
    });

    it('returns null if no active trip is in_progress for vehicle', async () => {
      const vehicleId = 'veh-006';
      mockDb.trips.push({
        id: 'trip-done',
        vehicle_id: vehicleId,
        trip_number: 1,
        started_at: '2026-09-15T08:00:00Z',
        ended_at: '2026-09-15T08:30:00Z',
        status: 'completed',
        trip_date: '2026-09-15'
      });

      const result = await closeActiveTrip(mockDb, vehicleId, '2026-09-15T09:00:00Z');
      assert.strictEqual(result, null);
    });
  });

  describe('closeStaleTrips', () => {
    it('closes trips whose vehicles have been idle longer than maxIdleMinutes', async () => {
      const now = Date.now();
      const twentyMinsAgo = new Date(now - 20 * 60 * 1000).toISOString();
      const fiveMinsAgo = new Date(now - 5 * 60 * 1000).toISOString();

      mockDb.vehicles.push(
        { id: 'v-stale', last_seen_at: twentyMinsAgo },
        { id: 'v-active', last_seen_at: fiveMinsAgo }
      );

      mockDb.trips.push(
        {
          id: 'trip-stale',
          vehicle_id: 'v-stale',
          status: 'in_progress',
          trip_number: 1,
          started_at: twentyMinsAgo
        },
        {
          id: 'trip-active',
          vehicle_id: 'v-active',
          status: 'in_progress',
          trip_number: 1,
          started_at: fiveMinsAgo
        }
      );

      const closed = await closeStaleTrips(mockDb, 15);

      assert.strictEqual(closed.length, 1);
      assert.strictEqual(closed[0].id, 'trip-stale');
      assert.strictEqual(closed[0].status, 'completed');

      const staleTripInDb = mockDb.trips.find((t) => t.id === 'trip-stale');
      assert.strictEqual(staleTripInDb.status, 'completed');

      const activeTripInDb = mockDb.trips.find((t) => t.id === 'trip-active');
      assert.strictEqual(activeTripInDb.status, 'in_progress');
    });

    it('returns empty array when no trips exceed maxIdleMinutes', async () => {
      const now = Date.now();
      const twoMinsAgo = new Date(now - 2 * 60 * 1000).toISOString();

      mockDb.vehicles.push({ id: 'v-active', last_seen_at: twoMinsAgo });
      mockDb.trips.push({
        id: 'trip-active',
        vehicle_id: 'v-active',
        status: 'in_progress',
        trip_number: 1
      });

      const closed = await closeStaleTrips(mockDb, 15);
      assert.deepStrictEqual(closed, []);
    });
  });
});
