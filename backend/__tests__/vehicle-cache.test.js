import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { VehicleCache } from '../src/services/vehicle-cache.js';
import { createNullRedisClient } from '../src/services/redis-client.js';
import { buildApp } from '../src/app.js';

describe('VehicleCache Service', () => {
  describe('Unready / Fallback Mode', () => {
    test('methods handle unready Redis gracefully without errors', async () => {
      const nullRedis = createNullRedisClient();
      const cache = new VehicleCache({ redisClient: nullRedis });

      assert.strictEqual(cache.isReady(), false);

      await cache.updatePosition(1, { lat: 13.7, lng: 100.5 });
      const single = await cache.get(1);
      assert.strictEqual(single, null);

      const all = await cache.getAll();
      assert.deepStrictEqual(all, []);

      const map = await cache.getMap();
      assert.strictEqual(map.size, 0);
    });
  });

  describe('Active Cache Operations', () => {
    test('updatePosition writes hash and sets TTL', async () => {
      const storage = new Map();
      const expires = new Map();

      const mockRedis = {
        isReady: () => true,
        cache: {
          hset: async (key, data) => {
            storage.set(key, { ...data });
            return 1;
          },
          expire: async (key, ttl) => {
            expires.set(key, ttl);
            return 1;
          },
        },
      };

      const cache = new VehicleCache({ redisClient: mockRedis });
      assert.strictEqual(cache.isReady(), true);

      await cache.updatePosition(10, {
        lat: 13.7563,
        lng: 100.5018,
        speed: 35.5,
        heading: 180,
        status: 'online',
      });

      assert.ok(storage.has('vehicle:10:state'));
      const stored = storage.get('vehicle:10:state');
      assert.strictEqual(stored.vehicle_id, '10');
      assert.strictEqual(stored.lat, '13.7563');
      assert.strictEqual(stored.lng, '100.5018');
      assert.strictEqual(stored.speed, '35.5');
      assert.strictEqual(stored.heading, '180');
      assert.strictEqual(stored.status, 'online');
      assert.strictEqual(expires.get('vehicle:10:state'), 86400);
    });

    test('get retrieves and parses vehicle state from Redis hash', async () => {
      const mockRedis = {
        isReady: () => true,
        cache: {
          hgetall: async (key) => {
            if (key === 'vehicle:5:state') {
              return {
                vehicle_id: '5',
                lat: '13.72',
                lng: '100.52',
                speed: '40.2',
                heading: '270',
                today_total_km: '12.4',
                status: 'online',
                updated_at: '2026-10-02T10:00:00.000Z',
              };
            }
            return {};
          },
        },
      };

      const cache = new VehicleCache({ redisClient: mockRedis });
      const state = await cache.get(5);

      assert.ok(state);
      assert.strictEqual(state.vehicle_id, 5);
      assert.strictEqual(state.lat, 13.72);
      assert.strictEqual(state.lng, 100.52);
      assert.strictEqual(state.speed, 40.2);
      assert.strictEqual(state.heading, 270);
      assert.strictEqual(state.today_total_km, 12.4);
      assert.strictEqual(state.status, 'online');

      const nonExistent = await cache.get(999);
      assert.strictEqual(nonExistent, null);
    });

    test('getAll and getMap iterate keys using SCAN and return structured collections', async () => {
      const dataStore = {
        'vehicle:1:state': {
          vehicle_id: '1',
          lat: '13.1',
          lng: '100.1',
          speed: '10',
          heading: '0',
          today_total_km: '5.5',
          status: 'online',
        },
        'vehicle:2:state': {
          vehicle_id: '2',
          lat: '13.2',
          lng: '100.2',
          speed: '20',
          heading: '90',
          today_total_km: '15.0',
          status: 'offline',
        },
      };

      let scanCall = 0;
      const mockRedis = {
        isReady: () => true,
        cache: {
          scan: async (cursor) => {
            scanCall++;
            if (scanCall === 1) {
              return ['10', ['vehicle:1:state']];
            } else {
              return ['0', ['vehicle:2:state']];
            }
          },
          hgetall: async (key) => dataStore[key] || {},
        },
      };

      const cache = new VehicleCache({ redisClient: mockRedis });

      const all = await cache.getAll();
      assert.strictEqual(all.length, 2);
      assert.strictEqual(all[0].vehicle_id, 1);
      assert.strictEqual(all[1].vehicle_id, 2);

      // Reset scanCall counter for getMap
      scanCall = 0;
      const map = await cache.getMap();
      assert.strictEqual(map.size, 2);
      assert.ok(map.has(1));
      assert.ok(map.has(2));
      assert.strictEqual(map.get(1).lat, 13.1);
      assert.strictEqual(map.get(2).status, 'offline');
    });
  });

  describe('Integration with GET /api/v1/vehicles', () => {
    test('GET /api/v1/vehicles enriches database records with live Redis cache', async () => {
      const dbMock = {
        query: async () => ({
          rows: [
            {
              id: 1,
              plate_number: '1กก-1234',
              lat: 10.0,
              lng: 20.0,
              speed: 0,
              heading: 0,
              status: 'offline',
              route_name: 'สาย 1',
              today_total_km: '5.2',
              today_total_trips: '2',
              current_trip_km: '0',
            },
          ],
        }),
      };

      const mockVehicleCache = {
        isReady: () => true,
        getMap: async () => {
          const map = new Map();
          map.set(1, {
            vehicle_id: 1,
            lat: 13.75, // Updated live position in Redis
            lng: 100.5,
            speed: 55.0,
            heading: 120,
            status: 'online', // Live status from Redis
          });
          return map;
        },
      };

      const app = buildApp({
        logger: false,
        db: dbMock,
        vehicleCache: mockVehicleCache,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/vehicles',
      });

      assert.strictEqual(response.statusCode, 200);
      const json = JSON.parse(response.body);
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.length, 1);

      const vehicle = json.data[0];
      assert.strictEqual(vehicle.id, 1);
      assert.strictEqual(vehicle.plate_number, '1กก-1234');
      // Verify cached live state was applied over DB stale values
      assert.strictEqual(vehicle.lat, 13.75);
      assert.strictEqual(vehicle.lng, 100.5);
      assert.strictEqual(vehicle.speed, 55.0);
      assert.strictEqual(vehicle.heading, 120);
      assert.strictEqual(vehicle.status, 'online');
      assert.strictEqual(vehicle.today_total_km, 5.2);

      await app.close();
    });
  });
});
