import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../src/app.js';
import WebSocket from 'ws';
import { interpolateRoute, buildTelemetry } from '../../tools/gps-simulator.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Full System End-to-End (E2E) Integration Flow', () => {
  let app;
  let serverWsAddress;
  let adminToken;
  const vehicleId = 'd0000000-0000-0000-0000-000000000001';
  const deviceKey = 'dev_key_v01_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';
  let routeGeojson;

  // In-memory simulation state
  const mockDbState = {
    vehicles: [
      {
        id: vehicleId,
        plate_number: 'กข-1234',
        model: 'Toyota Commuter',
        device_api_key: deviceKey,
        current_route_id: 'b0000000-0000-0000-0000-000000000001',
        status: 'online',
        is_active: true,
      }
    ],
    trips: [],
    gpsPoints: []
  };

  const dbMock = {
    query: async (sql, params = []) => {
      const sqlLower = sql.toLowerCase();

      // Device key lookup
      if (sqlLower.includes('from vehicles') && sqlLower.includes('device_api_key')) {
        const found = mockDbState.vehicles.find(v => v.device_api_key === params[0]);
        return { rows: found ? [found] : [] };
      }

      // Active trip lookup
      if (sqlLower.includes('from trips') && sqlLower.includes('status')) {
        const active = mockDbState.trips.find(t => t.vehicle_id === params[0] && t.status === params[1]);
        return { rows: active ? [active] : [] };
      }

      // Last point lookup
      if (sqlLower.includes('from gps_points') && sqlLower.includes('trip_id')) {
        const points = mockDbState.gpsPoints.filter(p => p.trip_id === params[0]);
        const last = points[points.length - 1];
        return { rows: last ? [last] : [] };
      }

      // Insert trip
      if (sqlLower.includes('insert into trips')) {
        const newTrip = {
          id: 'trip-' + (mockDbState.trips.length + 1),
          vehicle_id: params[0],
          route_id: params[1],
          started_at: params[2] || new Date().toISOString(),
          status: 'in_progress',
          total_distance_km: 0,
        };
        mockDbState.trips.push(newTrip);
        return { rows: [newTrip] };
      }

      // Insert gps point
      if (sqlLower.includes('insert into gps_points')) {
        const newPt = {
          id: mockDbState.gpsPoints.length + 1,
          trip_id: params[0],
          vehicle_id: params[1],
          latitude: params[2],
          longitude: params[3],
          speed: params[4],
          heading: params[5],
          recorded_at: params[6],
          is_valid: true,
          acc: params[8] !== undefined ? params[8] : true
        };
        mockDbState.gpsPoints.push(newPt);
        return { rows: [newPt] };
      }

      // Update trip distance
      if (sqlLower.includes('update trips set total_distance_km = total_distance_km + $1')) {
        const trip = mockDbState.trips.find(t => t.id === params[1]);
        if (trip) {
          trip.total_distance_km += params[0];
        }
        return { rows: trip ? [trip] : [] };
      }

      // Vehicles list
      if (sqlLower.includes('from vehicles')) {
        return { rows: mockDbState.vehicles };
      }

      // Default fallback
      return { rows: [] };
    }
  };

  before(async () => {
    // Load sample route
    const sampleRoutePath = path.join(__dirname, '../../tools/routes-sample.geojson');
    routeGeojson = JSON.parse(fs.readFileSync(sampleRoutePath, 'utf8'));

    app = buildApp({
      logger: false,
      jwtSecret: 'super-secret-e2e-key',
      db: dbMock
    });

    await app.listen({ port: 0 });
    const port = app.server.address().port;
    serverWsAddress = `ws://127.0.0.1:${port}`;
    adminToken = app.jwt.sign({ id: 'admin-1', username: 'admin', role: 'admin' });
  });

  after(async () => {
    await app.close();
  });

  test('E2E: WebSocket real-time delivery from HTTP telemetry stream', async () => {
    const coordinates = routeGeojson.features[0].geometry.coordinates;
    const pt1 = coordinates[0];
    const pt2 = coordinates[1];

    const publicWs = new WebSocket(`${serverWsAddress}/ws/public`);
    const adminWs = new WebSocket(`${serverWsAddress}/ws?token=${adminToken}`);

    await Promise.all([
      new Promise(res => publicWs.on('open', res)),
      new Promise(res => adminWs.on('open', res))
    ]);

    const receivedPublic = [];
    const receivedAdmin = [];

    publicWs.on('message', (msg) => {
      receivedPublic.push(JSON.parse(msg.toString()));
    });

    adminWs.on('message', (msg) => {
      receivedAdmin.push(JSON.parse(msg.toString()));
    });

    // 1. Ingest Point 1
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/telemetry',
      headers: {
        'x-device-key': deviceKey
      },
      payload: {
        lat: pt1[1],
        lng: pt1[0],
        speed: 25.5,
        heading: 45,
        timestamp: new Date().toISOString(),
        acc: true
      }
    });

    assert.strictEqual(res1.statusCode, 200);
    const body1 = JSON.parse(res1.payload);
    assert.strictEqual(body1.success, true);

    // 2. Ingest Point 2 (simulating vehicle movement)
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/telemetry',
      headers: {
        'x-device-key': deviceKey
      },
      payload: {
        lat: pt2[1],
        lng: pt2[0],
        speed: 30.0,
        heading: 50,
        timestamp: new Date().toISOString(),
        acc: true
      }
    });

    assert.strictEqual(res2.statusCode, 200);

    // Wait a brief tick for WebSocket events to flush
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify Public WS received vehicle location
    const publicLocationEvents = receivedPublic.filter(e => e.event === 'vehicle:location');
    assert.ok(publicLocationEvents.length >= 2, 'Public client should receive vehicle location updates');
    assert.strictEqual(publicLocationEvents[0].data.vehicle_id, vehicleId);
    assert.strictEqual(publicLocationEvents[0].data.plate_number, 'กข-1234');

    // Verify Admin WS received trip started and vehicle location
    const adminLocationEvents = receivedAdmin.filter(e => e.event === 'vehicle:location');
    const adminTripEvents = receivedAdmin.filter(e => e.event === 'trip:started');
    assert.ok(adminLocationEvents.length >= 2, 'Admin client should receive location updates');
    assert.ok(adminTripEvents.length >= 1, 'Admin client should receive trip:started event');

    publicWs.close();
    adminWs.close();
  });

  test('E2E: Simulator coordinate generation matches backend ingestion validation', async () => {
    const coords = routeGeojson.features[0].geometry.coordinates;
    const simState = {
      segmentIndex: 0,
      segmentProgress: 0,
      routeCoordinates: coords
    };

    const nextState = interpolateRoute(simState, 50); // move 50 meters
    assert.ok(nextState.lat !== undefined);
    assert.ok(nextState.lng !== undefined);

    const vehicleProfile = {
      id: vehicleId,
      plate_number: 'กข-1234',
      device_api_key: deviceKey
    };

    const payload = buildTelemetry({ ...nextState, speed: 30 });
    assert.ok(payload.lat >= -90 && payload.lat <= 90);
    assert.ok(payload.lng >= -180 && payload.lng <= 180);
    assert.ok(payload.speed >= 0);
    assert.ok(payload.heading >= 0 && payload.heading <= 360);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/telemetry',
      headers: { 'x-device-key': vehicleProfile.device_api_key },
      payload
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
  });
});
