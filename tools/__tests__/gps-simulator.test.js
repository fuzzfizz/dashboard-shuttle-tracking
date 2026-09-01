import test from 'node:test';
import assert from 'node:assert';
import { calculateBearing, interpolateRoute, buildTelemetry, handleCommand } from '../gps-simulator.js';

test('calculateBearing', (t) => {
  // Test North, East, South, West
  // 0,0 to 1,0 is North (0 degrees)
  assert.strictEqual(Math.round(calculateBearing(0, 0, 1, 0)), 0);
  
  // 0,0 to 0,1 is East (90 degrees)
  assert.strictEqual(Math.round(calculateBearing(0, 0, 0, 1)), 90);
  
  // 1,0 to 0,0 is South (180 degrees)
  assert.strictEqual(Math.round(calculateBearing(1, 0, 0, 0)), 180);
  
  // 0,1 to 0,0 is West (270 degrees)
  assert.strictEqual(Math.round(calculateBearing(0, 1, 0, 0)), 270);
});

test('interpolateRoute', (t) => {
  const route = [
    [0, 0], // lng, lat
    [0, 1]
  ];
  
  // Step distance is large enough to cover half the distance
  // 1 degree lat ~ 111km.
  
  // With step size 0.5 degrees, we should be halfway.
  // Not real distances, just a mock test for interpolation logic
  const state = {
    segmentIndex: 0,
    segmentProgress: 0,
    routeCoordinates: route
  };
  
  const stepDistance = 0.5; // in degrees for simple test, or meters?
  // Let's use simple cartesian math for the mock if possible, or expect haversine.
  // Actually, gps-simulator interpolate should work with real earth distances.
  // distance from (0,0) to (0,1) is approx 111319 meters.
  
  const nextState = interpolateRoute(state, 55659.5); // half distance
  assert.ok(nextState.segmentProgress > 0);
  assert.ok(nextState.lat > 0 && nextState.lat < 1);
});

test('buildTelemetry', (t) => {
  const telemetry = buildTelemetry({ lat: 13.7, lng: 100.5, speed: 30, heading: 45 });
  assert.strictEqual(telemetry.lat, 13.7);
  assert.strictEqual(telemetry.lng, 100.5);
  assert.strictEqual(telemetry.speed, 30);
  assert.strictEqual(telemetry.heading, 45);
  assert.ok(telemetry.timestamp);
  assert.strictEqual(telemetry.acc, true);
});

test('handleCommand', (t) => {
  const deviceState = { interval: 1000, status: 'online' };
  
  const response = handleCommand(deviceState, { type: 'set_interval', payload: { interval: 5000 } });
  assert.strictEqual(deviceState.interval, 5000);
  
  const rebootResponse = handleCommand(deviceState, { type: 'reboot' });
  assert.strictEqual(deviceState.status, 'rebooting');
});

import { SEED_VEHICLES, Simulator, calculateDistance } from '../gps-simulator.js';

test('Verify Thai Plate Numbers and UTF-8 encoding', (t) => {
  assert.strictEqual(SEED_VEHICLES[0].plate_number, 'กข-1234');
  assert.strictEqual(SEED_VEHICLES[1].plate_number, 'ขค-5678');
});

test('Route stop proximity detection', async (t) => {
  const sim = new Simulator({ count: 1, protocol: 'http', jitter: false });
  
  // mock fetch to avoid errors
  global.fetch = async () => ({ ok: true });
  
  const vehicle = {
    id: 'test-id',
    device_api_key: 'test-key',
    state: {
      interval: 1000,
      status: 'online',
      segmentIndex: 0,
      segmentProgress: 0,
      routeCoordinates: [[0, 0], [0, 0.001]], // very short mock route
      stops: [
        { name: 'Test Stop', lat: 0, lng: 0 } // Stop at start
      ],
      lat: 0,
      lng: 0,
      heading: 0,
      speed: 30,
      stopWaitMs: 0,
      lastVisitedStop: null
    }
  };
  
  // Initial tick, vehicle is at 0,0, should detect stop and set stopWaitMs
  await sim.tick(vehicle);
  
  assert.strictEqual(vehicle.state.lastVisitedStop, 'Test Stop', 'Should have visited Test Stop');
  assert.strictEqual(vehicle.state.stopWaitMs, 5000, 'Should wait 5s at stop');
  
  // Second tick, stopWaitMs should decrease
  await sim.tick(vehicle);
  assert.strictEqual(vehicle.state.stopWaitMs, 4000, 'Should decrease wait time');
  assert.strictEqual(vehicle.state.speed, 0, 'Speed should be 0 while stopping');
  
  // Clear stopWaitMs to simulate finishing wait, move it away
  vehicle.state.stopWaitMs = 0;
  vehicle.state.lat = 0.5; // Far away
  await sim.tick(vehicle);
  
  assert.ok(vehicle.state.speed > 0, 'Speed should resume');
});
