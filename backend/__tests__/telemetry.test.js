import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import buildApp from '../src/app.js';

function createMockDb(initialVehicles = [], initialTrips = [], initialPoints = []) {
  const vehicles = initialVehicles.map((v) => ({ ...v }));
  const trips = initialTrips.map((t) => ({ ...t }));
  const gps_points = initialPoints.map((p) => ({ ...p }));

  return {
    vehicles,
    trips,
    gps_points,
    async query(text, params = []) {
      const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();

      // 1. SELECT vehicle by device_api_key AND is_active = true
      if (
        normalized.includes('select') &&
        normalized.includes('from vehicles') &&
        normalized.includes('device_api_key = $1') &&
        normalized.includes('is_active = true')
      ) {
        const key = params[0];
        const vehicle = vehicles.find((v) => v.device_api_key === key && v.is_active === true);
        return { rows: vehicle ? [{ ...vehicle }] : [], rowCount: vehicle ? 1 : 0 };
      }

      // 2. SELECT vehicle by id
      if (
        normalized.includes('select') &&
        normalized.includes('from vehicles') &&
        normalized.includes('where id = $1')
      ) {
        const id = params[0];
        const vehicle = vehicles.find((v) => v.id === id);
        return { rows: vehicle ? [{ ...vehicle }] : [], rowCount: vehicle ? 1 : 0 };
      }

      // 3. UPDATE vehicle status / coordinates
      if (normalized.includes('update vehicles') && normalized.includes('where id = $1')) {
        const id = params[0];
        const vehicle = vehicles.find((v) => v.id === id);
        if (vehicle) {
          if (normalized.includes("status = 'offline'")) {
            vehicle.last_seen_at = params[1] ? new Date(params[1]).toISOString() : new Date().toISOString();
            vehicle.status = 'offline';
          } else {
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

      // 4. Trip queries: SELECT active trip
      if (
        normalized.includes('select') &&
        normalized.includes('from trips') &&
        normalized.includes("status = 'in_progress'")
      ) {
        const vehicleId = params[0];
        const tripDate = params[1];
        const trip = trips.find(
          (t) =>
            t.vehicle_id === vehicleId &&
            t.status === 'in_progress' &&
            (!tripDate || t.trip_date === tripDate)
        );
        return { rows: trip ? [{ ...trip }] : [], rowCount: trip ? 1 : 0 };
      }

      // 5. Trip queries: SELECT MAX(trip_number)
      if (normalized.includes('max(trip_number)') && normalized.includes('from trips')) {
        const vehicleId = params[0];
        const tripDate = params[1];
        const matching = trips.filter(
          (t) => t.vehicle_id === vehicleId && (!tripDate || t.trip_date === tripDate)
        );
        const maxNum = matching.reduce((max, t) => Math.max(max, t.trip_number || 0), 0);
        return { rows: [{ max_trip_number: maxNum }], rowCount: 1 };
      }

      // 6. Trip queries: INSERT INTO trips
      if (normalized.includes('insert into trips')) {
        const [vehicleId, tripNumber, startedAt, tripDate] = params;
        const newTrip = {
          id: `trip-uuid-${trips.length + 1}`,
          vehicle_id: vehicleId,
          trip_number: tripNumber,
          started_at: startedAt ? new Date(startedAt).toISOString() : new Date().toISOString(),
          ended_at: null,
          total_distance_km: 0,
          total_points: 0,
          status: 'in_progress',
          trip_date: tripDate || new Date().toISOString().slice(0, 10),
        };
        trips.push(newTrip);
        return { rows: [{ ...newTrip }], rowCount: 1 };
      }

      // 7. Trip queries: UPDATE trips (increment distance and points)
      if (
        normalized.includes('update trips') &&
        normalized.includes('total_distance_km = total_distance_km + $2')
      ) {
        const [tripId, distanceKm] = params;
        const trip = trips.find((t) => t.id === tripId);
        if (trip) {
          trip.total_distance_km += Number(distanceKm);
          trip.total_points += 1;
          return { rows: [{ ...trip }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }

      // 8. Trip queries: UPDATE trips to close active trip
      if (
        normalized.includes('update trips') &&
        normalized.includes("status = 'completed'") &&
        normalized.includes('vehicle_id = $1')
      ) {
        const vehicleId = params[0];
        const endedAt = params[1] ? new Date(params[1]).toISOString() : new Date().toISOString();
        const trip = trips.find(
          (t) => t.vehicle_id === vehicleId && t.status === 'in_progress'
        );
        if (trip) {
          trip.status = 'completed';
          trip.ended_at = endedAt;
          return { rows: [{ ...trip }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }

      // 9. INSERT INTO gps_points
      if (normalized.includes('insert into gps_points')) {
        const [
          vehicleId,
          tripId,
          lat,
          lng,
          speedKmh,
          heading,
          distPrevM,
          deviceTimestamp,
          isValid,
        ] = params;

        const point = {
          id: gps_points.length + 1,
          vehicle_id: vehicleId,
          trip_id: tripId,
          lat,
          lng,
          speed_kmh: speedKmh,
          heading,
          distance_from_prev_m: distPrevM,
          device_timestamp: new Date(deviceTimestamp).toISOString(),
          server_timestamp: new Date().toISOString(),
          is_valid: isValid,
        };
        gps_points.push(point);
        return { rows: [{ ...point }], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    },
  };
}

describe('HTTP Telemetry API & Batch Flush Endpoints', () => {
  let app;
  let mockDb;
  let broadcastedLocations = [];

  const VALID_KEY = 'dev-key-active-001';
  const INACTIVE_KEY = 'dev-key-inactive-002';
  const VEHICLE_ID = 'v0000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    broadcastedLocations = [];

    const initialVehicles = [
      {
        id: VEHICLE_ID,
        plate_number: '1กข-1234',
        name: 'Shuttle 1',
        device_api_key: VALID_KEY,
        status: 'offline',
        last_lat: null,
        last_lng: null,
        last_speed_kmh: 0,
        last_heading: 0,
        last_seen_at: null,
        is_active: true,
      },
      {
        id: 'v0000000-0000-0000-0000-000000000002',
        plate_number: '2กค-5678',
        name: 'Shuttle Inactive',
        device_api_key: INACTIVE_KEY,
        status: 'offline',
        last_lat: null,
        last_lng: null,
        last_speed_kmh: 0,
        last_heading: 0,
        last_seen_at: null,
        is_active: false,
      },
    ];

    mockDb = createMockDb(initialVehicles);

    app = buildApp({
      logger: false,
      db: mockDb,
    });

    await app.ready();
    
    app.broadcaster.broadcastLocation = (payload) => {
      broadcastedLocations.push(payload);
    };
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Device Key Authentication Middleware', () => {
    it('returns 401 MISSING_KEY when X-Device-Key header is absent', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/telemetry',
        payload: {
          lat: 13.7563,
          lng: 100.5018,
          speed: 30,
        },
      });

      assert.equal(res.statusCode, 401);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'MISSING_KEY');
      assert.ok(json.error.message.includes('X-Device-Key'));
    });

    it('returns 403 INVALID_KEY when X-Device-Key does not exist in database', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/telemetry',
        headers: {
          'x-device-key': 'non-existent-device-key-999',
        },
        payload: {
          lat: 13.7563,
          lng: 100.5018,
          speed: 30,
        },
      });

      assert.equal(res.statusCode, 403);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'INVALID_KEY');
    });

    it('returns 403 INVALID_KEY when device vehicle is inactive', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/telemetry',
        headers: {
          'x-device-key': INACTIVE_KEY,
        },
        payload: {
          lat: 13.7563,
          lng: 100.5018,
          speed: 30,
        },
      });

      assert.equal(res.statusCode, 403);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'INVALID_KEY');
    });

    it('returns 401 MISSING_KEY on batch endpoint when X-Device-Key is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/telemetry/batch',
        payload: {
          points: [
            { lat: 13.7563, lng: 100.5018, speed: 20 },
          ],
        },
      });

      assert.equal(res.statusCode, 401);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'MISSING_KEY');
    });

    it('returns 403 INVALID_KEY on batch endpoint when X-Device-Key is invalid', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/telemetry/batch',
        headers: {
          'x-device-key': 'invalid-key-batch',
        },
        payload: {
          points: [
            { lat: 13.7563, lng: 100.5018, speed: 20 },
          ],
        },
      });

      assert.equal(res.statusCode, 403);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'INVALID_KEY');
    });
  });

  describe('Single Telemetry Ingestion (POST /api/v1/telemetry)', () => {
    it('successfully processes initial valid point and creates trip', async () => {
      const nowIso = new Date(Date.now() - 60000).toISOString();
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/telemetry',
        headers: {
          'x-device-key': VALID_KEY,
        },
        payload: {
          lat: 13.7463,
          lng: 100.5347,
          speed: 25.5,
          heading: 90,
          timestamp: nowIso,
          acc: true,
        },
      });

      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, true);
      assert.ok(json.data.trip_id);
      assert.equal(json.data.distance_added_m, 0);
      assert.equal(json.data.trip_total_km, 0);
      assert.equal(json.data.is_valid, true);

      // Verify DB updates
      const vehicle = mockDb.vehicles.find((v) => v.id === VEHICLE_ID);
      assert.equal(vehicle.status, 'online');
      assert.equal(vehicle.last_lat, 13.7463);
      assert.equal(vehicle.last_lng, 100.5347);
      assert.equal(vehicle.last_speed_kmh, 25.5);

      // Verify broadcast callback
      assert.equal(broadcastedLocations.length, 1);
      assert.equal(broadcastedLocations[0].vehicle_id, VEHICLE_ID);
      assert.equal(broadcastedLocations[0].lat, 13.7463);
      assert.equal(broadcastedLocations[0].speed_kmh, 25.5);
    });

    it('accumulates distance on consecutive valid point', async () => {
      const t1 = new Date(Date.now() - 30000).toISOString();
      const t2 = new Date(Date.now() - 25000).toISOString();

      // 1st point (Siam)
      await app.inject({
        method: 'POST',
        url: '/api/v1/telemetry',
        headers: { 'x-device-key': VALID_KEY },
        payload: {
          lat: 13.7463,
          lng: 100.5347,
          speed: 30,
          timestamp: t1,
        },
      });

      // 2nd point (~2.1 km away towards Victory Monument)
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/telemetry',
        headers: { 'x-device-key': VALID_KEY },
        payload: {
          lat: 13.7649,
          lng: 100.5382,
          speed: 40,
          heading: 15,
          timestamp: t2,
        },
      });

      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, true);
      assert.ok(json.data.distance_added_m > 2000);
      assert.ok(json.data.trip_total_km > 2.0);
      assert.equal(json.data.is_valid, true);
    });

    it('accepts lon property as an alias for lng', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/telemetry',
        headers: { 'x-device-key': VALID_KEY },
        payload: {
          lat: 13.7563,
          lon: 100.5018,
          speed: 15.0,
        },
      });

      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, true);
      assert.equal(mockDb.gps_points[0].lng, 100.5018);
    });

    it('handles ignition off (acc: false) by closing trip and setting vehicle status to offline', async () => {
      const t1 = new Date(Date.now() - 30000).toISOString();
      const t2 = new Date(Date.now() - 10000).toISOString();

      // 1st point (online)
      await app.inject({
        method: 'POST',
        url: '/api/v1/telemetry',
        headers: { 'x-device-key': VALID_KEY },
        payload: {
          lat: 13.7463,
          lng: 100.5347,
          speed: 20,
          timestamp: t1,
          acc: true,
        },
      });

      // 2nd ping with acc = false
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/telemetry',
        headers: { 'x-device-key': VALID_KEY },
        payload: {
          lat: 13.7463,
          lng: 100.5347,
          speed: 0,
          timestamp: t2,
          acc: false,
        },
      });

      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, true);
      assert.equal(json.data.distance_added_m, 0);

      const vehicle = mockDb.vehicles.find((v) => v.id === VEHICLE_ID);
      assert.equal(vehicle.status, 'offline');

      const trip = mockDb.trips[0];
      assert.equal(trip.status, 'completed');
    });

    it('accepts epoch numeric timestamp', async () => {
      const epochSeconds = Math.floor(Date.now() / 1000) - 30;
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/telemetry',
        headers: { 'x-device-key': VALID_KEY },
        payload: {
          lat: 13.7563,
          lng: 100.5018,
          speed: 10,
          timestamp: epochSeconds,
        },
      });

      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, true);
    });

    it('defaults optional fields (heading, timestamp, acc) gracefully', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/telemetry',
        headers: { 'x-device-key': VALID_KEY },
        payload: {
          lat: 13.7563,
          lng: 100.5018,
          speed: 10,
        },
      });

      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, true);
      assert.equal(mockDb.gps_points[0].heading, 0);
      assert.ok(mockDb.gps_points[0].device_timestamp);
    });
  });

  describe('Single Telemetry Validation Errors (POST /api/v1/telemetry)', () => {
    it('returns 400 INVALID_COORDINATES when lat is missing or non-number', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/telemetry',
        headers: { 'x-device-key': VALID_KEY },
        payload: {
          lng: 100.5018,
          speed: 20,
        },
      });

      assert.equal(res.statusCode, 400);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'INVALID_COORDINATES');
    });

    it('returns 400 INVALID_COORDINATES when lat is out of range (> 90)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/telemetry',
        headers: { 'x-device-key': VALID_KEY },
        payload: {
          lat: 91.5,
          lng: 100.5018,
          speed: 20,
        },
      });

      assert.equal(res.statusCode, 400);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'INVALID_COORDINATES');
    });

    it('returns 400 INVALID_COORDINATES when lat is out of range (< -90)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/telemetry',
        headers: { 'x-device-key': VALID_KEY },
        payload: {
          lat: -90.001,
          lng: 100.5018,
          speed: 20,
        },
      });

      assert.equal(res.statusCode, 400);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'INVALID_COORDINATES');
    });

    it('returns 400 INVALID_COORDINATES when lng/lon is missing or non-number', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/telemetry',
        headers: { 'x-device-key': VALID_KEY },
        payload: {
          lat: 13.7563,
          speed: 20,
        },
      });

      assert.equal(res.statusCode, 400);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'INVALID_COORDINATES');
    });

    it('returns 400 INVALID_COORDINATES when lng is out of range (> 180)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/telemetry',
        headers: { 'x-device-key': VALID_KEY },
        payload: {
          lat: 13.7563,
          lng: 180.5,
          speed: 20,
        },
      });

      assert.equal(res.statusCode, 400);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'INVALID_COORDINATES');
    });

    it('returns 400 INVALID_COORDINATES when lng is out of range (< -180)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/telemetry',
        headers: { 'x-device-key': VALID_KEY },
        payload: {
          lat: 13.7563,
          lng: -180.1,
          speed: 20,
        },
      });

      assert.equal(res.statusCode, 400);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'INVALID_COORDINATES');
    });

    it('returns 400 INVALID_SPEED when speed is missing or not a number', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/telemetry',
        headers: { 'x-device-key': VALID_KEY },
        payload: {
          lat: 13.7563,
          lng: 100.5018,
          speed: 'fast',
        },
      });

      assert.equal(res.statusCode, 400);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'INVALID_SPEED');
    });

    it('returns 400 INVALID_SPEED when speed is negative', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/telemetry',
        headers: { 'x-device-key': VALID_KEY },
        payload: {
          lat: 13.7563,
          lng: 100.5018,
          speed: -5,
        },
      });

      assert.equal(res.statusCode, 400);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'INVALID_SPEED');
    });

    it('returns 400 INVALID_TIMESTAMP when timestamp string is invalid', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/telemetry',
        headers: { 'x-device-key': VALID_KEY },
        payload: {
          lat: 13.7563,
          lng: 100.5018,
          speed: 20,
          timestamp: 'invalid-date-string',
        },
      });

      assert.equal(res.statusCode, 400);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'INVALID_TIMESTAMP');
    });

    it('returns 400 INVALID_TIMESTAMP when timestamp is > 10 minutes in the future', async () => {
      const futureDate = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/telemetry',
        headers: { 'x-device-key': VALID_KEY },
        payload: {
          lat: 13.7563,
          lng: 100.5018,
          speed: 20,
          timestamp: futureDate,
        },
      });

      assert.equal(res.statusCode, 400);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'INVALID_TIMESTAMP');
    });
  });

  describe('Batch Telemetry Flush (POST /api/v1/telemetry/batch)', () => {
    it('returns 400 INVALID_BATCH_SIZE when points is empty array', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/telemetry/batch',
        headers: { 'x-device-key': VALID_KEY },
        payload: {
          points: [],
        },
      });

      assert.equal(res.statusCode, 400);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'INVALID_BATCH_SIZE');
    });

    it('returns 400 INVALID_BATCH_SIZE when points is missing or not an array', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/telemetry/batch',
        headers: { 'x-device-key': VALID_KEY },
        payload: {},
      });

      assert.equal(res.statusCode, 400);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'INVALID_BATCH_SIZE');
    });

    it('returns 400 INVALID_BATCH_SIZE when points array exceeds 500 items', async () => {
      const points = Array.from({ length: 501 }, () => ({
        lat: 13.7563,
        lng: 100.5018,
        speed: 10,
      }));

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/telemetry/batch',
        headers: { 'x-device-key': VALID_KEY },
        payload: { points },
      });

      assert.equal(res.statusCode, 400);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'INVALID_BATCH_SIZE');
    });

    it('returns 400 INVALID_COORDINATES when any batch item has invalid coordinates', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/telemetry/batch',
        headers: { 'x-device-key': VALID_KEY },
        payload: {
          points: [
            { lat: 13.7563, lng: 100.5018, speed: 20 },
            { lat: 99.9999, lng: 100.5018, speed: 20 },
          ],
        },
      });

      assert.equal(res.statusCode, 400);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'INVALID_COORDINATES');
    });

    it('returns 400 INVALID_SPEED when any batch item has negative speed', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/telemetry/batch',
        headers: { 'x-device-key': VALID_KEY },
        payload: {
          points: [
            { lat: 13.7563, lng: 100.5018, speed: 20 },
            { lat: 13.7565, lng: 100.5020, speed: -10 },
          ],
        },
      });

      assert.equal(res.statusCode, 400);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'INVALID_SPEED');
    });

    it('sorts points ascending by timestamp and processes batch sequentially', async () => {
      const now = Date.now();
      const t1 = new Date(now - 30000).toISOString();
      const t2 = new Date(now - 25000).toISOString();
      const t3 = new Date(now - 20000).toISOString();

      // Provide points out of chronological order (t3, t1, t2)
      const points = [
        {
          lat: 13.7649,
          lng: 100.5382,
          speed: 40,
          heading: 10,
          timestamp: t3,
          acc: true,
        },
        {
          lat: 13.7463,
          lng: 100.5347,
          speed: 20,
          heading: 90,
          timestamp: t1,
          acc: true,
        },
        {
          lat: 13.7556,
          lng: 100.5365,
          speed: 35,
          heading: 45,
          timestamp: t2,
          acc: true,
        },
      ];

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/telemetry/batch',
        headers: { 'x-device-key': VALID_KEY },
        payload: { points },
      });

      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.payload);
      assert.equal(json.success, true);
      assert.equal(json.data.processed_count, 3);
      assert.ok(json.data.total_distance_added_km > 1.8);
      assert.ok(json.data.latest_trip_id);

      // Verify points were inserted in chronological order (t1 first, then t2, then t3)
      assert.equal(mockDb.gps_points.length, 3);
      assert.equal(mockDb.gps_points[0].device_timestamp, t1);
      assert.equal(mockDb.gps_points[1].device_timestamp, t2);
      assert.equal(mockDb.gps_points[2].device_timestamp, t3);

      // Verify final vehicle state matches newest point (t3)
      const vehicle = mockDb.vehicles.find((v) => v.id === VEHICLE_ID);
      assert.equal(vehicle.last_lat, 13.7649);
      assert.equal(vehicle.last_lng, 100.5382);
      assert.equal(vehicle.last_speed_kmh, 40);
      assert.equal(vehicle.last_seen_at, t3);
    });
  });
});
