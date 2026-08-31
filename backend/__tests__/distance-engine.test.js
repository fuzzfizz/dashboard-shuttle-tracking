import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { processTelemetryPoint } from '../src/services/distance-engine.js';

describe('Distance Engine Service', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = {
      vehicles: [],
      trips: [],
      gps_points: [],
      query: async function (text, params = []) {
        const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();

        // 1. SELECT vehicle by id
        if (normalized.includes('select') && normalized.includes('from vehicles') && normalized.includes('where id = $1')) {
          const vehicleId = params[0];
          const vehicle = this.vehicles.find((v) => v.id === vehicleId);
          return { rows: vehicle ? [{ ...vehicle }] : [] };
        }

        // 2. UPDATE vehicle
        if (normalized.includes('update vehicles') && normalized.includes('where id = $1')) {
          const vehicleId = params[0];
          const vehicle = this.vehicles.find((v) => v.id === vehicleId);
          if (vehicle) {
            if (normalized.includes("status = 'offline'")) {
              // params: [vehicleId, last_seen_at]
              vehicle.last_seen_at = params[1] ? new Date(params[1]).toISOString() : new Date().toISOString();
              vehicle.status = 'offline';
            } else {
              // params: [vehicleId, last_lat, last_lng, last_speed_kmh, last_heading, last_seen_at]
              const [, lastLat, lastLng, lastSpeed, lastHeading, lastSeenAt] = params;
              vehicle.last_lat = lastLat;
              vehicle.last_lng = lastLng;
              vehicle.last_speed_kmh = lastSpeed;
              vehicle.last_heading = lastHeading;
              vehicle.last_seen_at = lastSeenAt ? new Date(lastSeenAt).toISOString() : new Date().toISOString();
              vehicle.status = 'online';
            }
            return { rows: [{ ...vehicle }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }

        // 3. Trip queries: SELECT active trip
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

        // 4. Trip queries: SELECT MAX(trip_number)
        if (normalized.includes('max(trip_number)') && normalized.includes('from trips')) {
          const vehicleId = params[0];
          const tripDate = params[1];
          const matching = this.trips.filter(
            (t) => t.vehicle_id === vehicleId && (!tripDate || t.trip_date === tripDate)
          );
          const maxNum = matching.reduce((max, t) => Math.max(max, t.trip_number || 0), 0);
          return { rows: [{ max_trip_number: maxNum }] };
        }

        // 5. Trip queries: INSERT INTO trips
        if (normalized.includes('insert into trips')) {
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

        // 6. Trip queries: UPDATE trips (increment distance and points)
        if (normalized.includes('update trips') && normalized.includes('total_distance_km = total_distance_km + $2')) {
          const [tripId, distanceKm] = params;
          const trip = this.trips.find((t) => t.id === tripId);
          if (trip) {
            trip.total_distance_km += Number(distanceKm);
            trip.total_points += 1;
            return { rows: [{ ...trip }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }

        // 7. Trip queries: UPDATE trips to close active trip
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

        // 8. INSERT INTO gps_points
        if (normalized.includes('insert into gps_points')) {
          // params: [vehicleId, tripId, lat, lng, speed, heading, distance_from_prev_m, device_timestamp, is_valid]
          const [
            vehicleId,
            tripId,
            lat,
            lng,
            speedKmh,
            heading,
            distPrevM,
            deviceTimestamp,
            isValid
          ] = params;

          const point = {
            id: this.gps_points.length + 1,
            vehicle_id: vehicleId,
            trip_id: tripId,
            lat,
            lng,
            speed_kmh: speedKmh,
            heading,
            distance_from_prev_m: distPrevM,
            device_timestamp: new Date(deviceTimestamp).toISOString(),
            server_timestamp: new Date().toISOString(),
            is_valid: isValid
          };
          this.gps_points.push(point);
          return { rows: [{ ...point }] };
        }

        throw new Error(`Unhandled mock query: ${text}`);
      }
    };
  });

  describe('First GPS telemetry point (no prior position)', () => {
    it('initializes trip, inserts valid gps_point with 0 distance, updates vehicle state', async () => {
      const vehicleId = 'veh-init-1';
      mockDb.vehicles.push({
        id: vehicleId,
        plate_number: '1กข-1234',
        last_lat: null,
        last_lng: null,
        last_speed_kmh: 0,
        last_heading: 0,
        last_seen_at: null,
        status: 'offline'
      });

      const telemetryData = {
        vehicleId,
        lat: 13.7463,
        lng: 100.5347,
        speed: 25.0,
        heading: 90,
        timestamp: '2026-09-15T08:00:00Z',
        acc: true
      };

      const result = await processTelemetryPoint(mockDb, telemetryData);

      assert.ok(result);
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.distanceAddedM, 0);
      assert.ok(result.trip);
      assert.strictEqual(result.trip.status, 'in_progress');
      assert.strictEqual(result.trip.total_distance_km, 0);
      assert.strictEqual(result.trip.total_points, 1);

      // Verify GPS point insertion
      assert.strictEqual(mockDb.gps_points.length, 1);
      assert.strictEqual(mockDb.gps_points[0].vehicle_id, vehicleId);
      assert.strictEqual(mockDb.gps_points[0].distance_from_prev_m, 0);
      assert.strictEqual(mockDb.gps_points[0].is_valid, true);

      // Verify vehicle update
      const vehicle = mockDb.vehicles.find((v) => v.id === vehicleId);
      assert.strictEqual(vehicle.status, 'online');
      assert.strictEqual(vehicle.last_lat, 13.7463);
      assert.strictEqual(vehicle.last_lng, 100.5347);
      assert.strictEqual(vehicle.last_speed_kmh, 25.0);
      assert.strictEqual(vehicle.last_heading, 90);
    });
  });

  describe('Consecutive valid telemetry points', () => {
    it('calculates accurate Haversine distance, accumulates trip distance and points', async () => {
      const vehicleId = 'veh-consecutive-1';
      const prevTimestamp = '2026-09-15T08:00:00Z';
      const curTimestamp = '2026-09-15T08:00:05Z';

      // Siam coords
      mockDb.vehicles.push({
        id: vehicleId,
        plate_number: '2กค-5678',
        last_lat: 13.7463,
        last_lng: 100.5347,
        last_speed_kmh: 30.0,
        last_heading: 45,
        last_seen_at: prevTimestamp,
        status: 'online'
      });

      // Existing trip with 1 previous point and 0 distance
      const trip = {
        id: 'trip-consec',
        vehicle_id: vehicleId,
        trip_number: 1,
        started_at: prevTimestamp,
        ended_at: null,
        total_distance_km: 0,
        total_points: 1,
        status: 'in_progress',
        trip_date: '2026-09-15'
      };
      mockDb.trips.push(trip);

      // Victory Monument coords (~2102m away)
      const telemetryData = {
        vehicleId,
        lat: 13.7649,
        lng: 100.5382,
        speed: 40.0,
        heading: 10,
        timestamp: curTimestamp,
        acc: true
      };

      const result = await processTelemetryPoint(mockDb, telemetryData);

      assert.ok(result);
      assert.strictEqual(result.isValid, true);
      assert.ok(result.distanceAddedM >= 2080 && result.distanceAddedM <= 2120);

      // Verify trip accumulation
      assert.ok(result.trip.total_distance_km > 2.0 && result.trip.total_distance_km < 2.2);
      assert.strictEqual(result.trip.total_points, 2);

      // Verify GPS point recorded
      assert.strictEqual(mockDb.gps_points.length, 1);
      assert.strictEqual(mockDb.gps_points[0].is_valid, true);
      assert.strictEqual(mockDb.gps_points[0].distance_from_prev_m, result.distanceAddedM);

      // Verify vehicle update
      const vehicle = mockDb.vehicles.find((v) => v.id === vehicleId);
      assert.strictEqual(vehicle.last_lat, 13.7649);
      assert.strictEqual(vehicle.last_lng, 100.5382);
      assert.strictEqual(vehicle.last_speed_kmh, 40.0);
      assert.strictEqual(vehicle.last_heading, 10);
    });
  });

  describe('Noise filter: Stationary GPS drift', () => {
    it('records gps_point as is_valid=false and skips trip distance/points increment', async () => {
      const vehicleId = 'veh-drift-1';
      const prevTimestamp = '2026-09-15T08:00:00Z';
      const curTimestamp = '2026-09-15T08:00:05Z';

      mockDb.vehicles.push({
        id: vehicleId,
        plate_number: '3กง-9999',
        last_lat: 13.746300,
        last_lng: 100.534700,
        last_speed_kmh: 0,
        last_heading: 0,
        last_seen_at: prevTimestamp,
        status: 'online'
      });

      mockDb.trips.push({
        id: 'trip-drift',
        vehicle_id: vehicleId,
        trip_number: 1,
        started_at: prevTimestamp,
        ended_at: null,
        total_distance_km: 1.5,
        total_points: 10,
        status: 'in_progress',
        trip_date: '2026-09-15'
      });

      // Drift point: ~1.11m distance, speed 0.8 km/h (< 1.5 km/h)
      const telemetryData = {
        vehicleId,
        lat: 13.746310,
        lng: 100.534700,
        speed: 0.8,
        heading: 0,
        timestamp: curTimestamp,
        acc: true
      };

      const result = await processTelemetryPoint(mockDb, telemetryData);

      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.distanceAddedM, 0);

      // Verify trip distance and points were NOT incremented
      const trip = mockDb.trips.find((t) => t.id === 'trip-drift');
      assert.strictEqual(trip.total_distance_km, 1.5);
      assert.strictEqual(trip.total_points, 10);

      // Verify GPS point recorded with is_valid = false
      assert.strictEqual(mockDb.gps_points.length, 1);
      assert.strictEqual(mockDb.gps_points[0].is_valid, false);
    });
  });

  describe('Noise filter: GPS Teleport anomaly', () => {
    it('records gps_point as is_valid=false and rejects jump > 5000m within 5s', async () => {
      const vehicleId = 'veh-jump-1';
      const prevTimestamp = '2026-09-15T08:00:00Z';
      const curTimestamp = '2026-09-15T08:00:05Z';

      mockDb.vehicles.push({
        id: vehicleId,
        plate_number: '4กจ-0000',
        last_lat: 13.7463,
        last_lng: 100.5347,
        last_speed_kmh: 50.0,
        last_heading: 0,
        last_seen_at: prevTimestamp,
        status: 'online'
      });

      mockDb.trips.push({
        id: 'trip-jump',
        vehicle_id: vehicleId,
        trip_number: 1,
        started_at: prevTimestamp,
        ended_at: null,
        total_distance_km: 3.0,
        total_points: 20,
        status: 'in_progress',
        trip_date: '2026-09-15'
      });

      // Jump ~11km in 5 seconds
      const telemetryData = {
        vehicleId,
        lat: 13.8463,
        lng: 100.5347,
        speed: 50.0,
        heading: 0,
        timestamp: curTimestamp,
        acc: true
      };

      const result = await processTelemetryPoint(mockDb, telemetryData);

      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.distanceAddedM, 0);

      // Verify trip distance and points unchanged
      const trip = mockDb.trips.find((t) => t.id === 'trip-jump');
      assert.strictEqual(trip.total_distance_km, 3.0);
      assert.strictEqual(trip.total_points, 20);

      // Verify point flagged as invalid
      assert.strictEqual(mockDb.gps_points.length, 1);
      assert.strictEqual(mockDb.gps_points[0].is_valid, false);
    });
  });

  describe('Ignition off handling (acc === false)', () => {
    it('closes active trip, updates vehicle status to offline, and returns isAccOff=true', async () => {
      const vehicleId = 'veh-acc-off-1';
      const curTimestamp = '2026-09-15T08:30:00Z';

      mockDb.vehicles.push({
        id: vehicleId,
        plate_number: '5กฉ-7777',
        last_lat: 13.7463,
        last_lng: 100.5347,
        last_speed_kmh: 0,
        last_heading: 0,
        last_seen_at: '2026-09-15T08:29:55Z',
        status: 'online'
      });

      mockDb.trips.push({
        id: 'trip-acc-off',
        vehicle_id: vehicleId,
        trip_number: 1,
        started_at: '2026-09-15T08:00:00Z',
        ended_at: null,
        total_distance_km: 8.5,
        total_points: 60,
        status: 'in_progress',
        trip_date: '2026-09-15'
      });

      const telemetryData = {
        vehicleId,
        lat: 13.7463,
        lng: 100.5347,
        speed: 0,
        heading: 0,
        timestamp: curTimestamp,
        acc: false
      };

      const result = await processTelemetryPoint(mockDb, telemetryData);

      assert.ok(result);
      assert.strictEqual(result.isAccOff, true);
      assert.strictEqual(result.distanceAddedM, 0);
      assert.ok(result.trip);
      assert.strictEqual(result.trip.status, 'completed');

      // Vehicle should be updated to offline
      const vehicle = mockDb.vehicles.find((v) => v.id === vehicleId);
      assert.strictEqual(vehicle.status, 'offline');

      // No GPS point recorded for acc off event
      assert.strictEqual(mockDb.gps_points.length, 0);
    });
  });

  describe('Coordinate aliases and error handling', () => {
    it('supports lon as alias for lng property', async () => {
      const vehicleId = 'veh-lon-1';
      mockDb.vehicles.push({
        id: vehicleId,
        plate_number: '6กช-8888',
        last_lat: null,
        last_lng: null,
        last_speed_kmh: 0,
        last_heading: 0,
        last_seen_at: null,
        status: 'offline'
      });

      const telemetryData = {
        vehicleId,
        lat: 13.7463,
        lon: 100.5347,
        speed: 15.0,
        heading: 180,
        timestamp: '2026-09-15T08:00:00Z',
        acc: true
      };

      const result = await processTelemetryPoint(mockDb, telemetryData);
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(mockDb.gps_points[0].lng, 100.5347);
    });

    it('throws error when vehicle does not exist in database', async () => {
      const telemetryData = {
        vehicleId: 'non-existent-veh',
        lat: 13.7463,
        lng: 100.5347,
        speed: 0,
        heading: 0,
        timestamp: '2026-09-15T08:00:00Z',
        acc: true
      };

      await assert.rejects(
        () => processTelemetryPoint(mockDb, telemetryData),
        /Vehicle with ID non-existent-veh not found/i
      );
    });

    it('throws error when telemetryData is null or invalid', async () => {
      await assert.rejects(
        () => processTelemetryPoint(mockDb, null),
        /payload must be an object/i
      );
      await assert.rejects(
        () => processTelemetryPoint(mockDb, 'string'),
        /payload must be an object/i
      );
    });

    it('uses default values when optional fields (heading, timestamp, acc) are omitted', async () => {
      const vehicleId = 'veh-defaults-1';
      mockDb.vehicles.push({
        id: vehicleId,
        plate_number: '7กด-1111',
        last_lat: null,
        last_lng: null,
        last_speed_kmh: 0,
        last_heading: 0,
        last_seen_at: null,
        status: 'offline'
      });

      const telemetryData = {
        vehicleId,
        lat: 13.7463,
        lng: 100.5347,
        speed: 20.0
      };

      const result = await processTelemetryPoint(mockDb, telemetryData);
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(mockDb.gps_points[0].heading, 0);
      assert.ok(mockDb.gps_points[0].device_timestamp);
      assert.strictEqual(result.trip.status, 'in_progress');
    });
  });
});
