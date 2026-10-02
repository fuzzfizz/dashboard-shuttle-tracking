import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import BroadcasterService from '../src/services/broadcaster.js';
import { createNullRedisClient } from '../src/services/redis-client.js';

describe('BroadcasterService with Redis Pub/Sub', () => {
  test('operates without Redis (null client fallback)', () => {
    const nullRedis = createNullRedisClient();
    const broadcaster = new BroadcasterService(nullRedis);

    const received = [];
    const mockSocket = {
      readyState: 1, // OPEN
      send: (data) => received.push(JSON.parse(data)),
      on: () => {},
    };

    broadcaster.addClient(mockSocket);
    broadcaster.broadcastLocation({ vehicle_id: 1, lat: 13.75, lng: 100.5 });

    assert.strictEqual(received.length, 1);
    assert.strictEqual(received[0].event, 'vehicle:location');
    assert.strictEqual(received[0].data.vehicle_id, 1);
  });

  test('publishes to Redis channel fleet:broadcast when Redis is ready', async () => {
    const published = [];
    const mockRedis = {
      isReady: () => true,
      pub: {
        publish: async (channel, msg) => {
          published.push({ channel, data: JSON.parse(msg) });
          return 1;
        },
      },
      sub: {
        subscribe: async () => {},
        on: () => {},
      },
    };

    const broadcaster = new BroadcasterService(mockRedis);
    broadcaster.broadcastLocation({ vehicle_id: 42, lat: 14.1, lng: 100.8 });
    broadcaster.broadcastStatus({ vehicle_id: 42, status: 'offline' });
    broadcaster.broadcastTripEvent('trip:completed', { trip_id: 99, vehicle_id: 42 });

    assert.strictEqual(published.length, 3);
    assert.strictEqual(published[0].channel, 'fleet:broadcast');
    assert.strictEqual(published[0].data.event, 'vehicle:location');
    assert.strictEqual(published[0].data.payload.vehicle_id, 42);
    assert.strictEqual(published[0].data.instanceId, broadcaster.instanceId);

    assert.strictEqual(published[1].data.event, 'vehicle:status');
    assert.strictEqual(published[2].data.event, 'trip:completed');
  });

  test('receives message from Redis sub and broadcasts to local clients', () => {
    let messageHandler = null;
    const mockRedis = {
      isReady: () => true,
      pub: {
        publish: async () => 1,
      },
      sub: {
        subscribe: async () => {},
        on: (event, handler) => {
          if (event === 'message') messageHandler = handler;
        },
      },
    };

    const broadcaster = new BroadcasterService(mockRedis);
    assert.ok(messageHandler, 'Redis message handler must be registered');

    const received = [];
    const mockSocket = {
      readyState: 1,
      send: (data) => received.push(JSON.parse(data)),
      on: () => {},
    };

    broadcaster.addClient(mockSocket);

    // Simulate cross-instance incoming message from another instance
    messageHandler('fleet:broadcast', JSON.stringify({
      instanceId: 'other-instance-uuid',
      event: 'vehicle:location',
      payload: { vehicle_id: 88, lat: 13.9, lng: 100.6 }
    }));

    assert.strictEqual(received.length, 1);
    assert.strictEqual(received[0].event, 'vehicle:location');
    assert.strictEqual(received[0].data.vehicle_id, 88);
  });

  test('deduplicates messages originating from own instanceId', () => {
    let messageHandler = null;
    const mockRedis = {
      isReady: () => true,
      pub: {
        publish: async () => 1,
      },
      sub: {
        subscribe: async () => {},
        on: (event, handler) => {
          if (event === 'message') messageHandler = handler;
        },
      },
    };

    const broadcaster = new BroadcasterService(mockRedis);

    const received = [];
    const mockSocket = {
      readyState: 1,
      send: (data) => received.push(JSON.parse(data)),
      on: () => {},
    };

    broadcaster.addClient(mockSocket);

    // Incoming message from own instanceId should be ignored (already sent locally)
    messageHandler('fleet:broadcast', JSON.stringify({
      instanceId: broadcaster.instanceId,
      event: 'vehicle:location',
      payload: { vehicle_id: 99, lat: 13.0, lng: 100.0 }
    }));

    assert.strictEqual(received.length, 0);
  });

  test('applies vehicle filters on cross-instance messages received from Redis', () => {
    let messageHandler = null;
    const mockRedis = {
      isReady: () => true,
      pub: {
        publish: async () => 1,
      },
      sub: {
        subscribe: async () => {},
        on: (event, handler) => {
          if (event === 'message') messageHandler = handler;
        },
      },
    };

    const broadcaster = new BroadcasterService(mockRedis);

    const client1Received = [];
    const client1 = broadcaster.addClient({
      readyState: 1,
      send: (data) => client1Received.push(JSON.parse(data)),
      on: () => {},
    }, { vehicleFilter: [10] }); // Only wants vehicle 10

    const client2Received = [];
    const client2 = broadcaster.addClient({
      readyState: 1,
      send: (data) => client2Received.push(JSON.parse(data)),
      on: () => {},
    }, { vehicleFilter: [20] }); // Only wants vehicle 20

    // Remote message for vehicle 10
    messageHandler('fleet:broadcast', JSON.stringify({
      instanceId: 'remote-instance-1',
      event: 'vehicle:location',
      payload: { vehicle_id: 10, lat: 13.5, lng: 100.5 }
    }));

    assert.strictEqual(client1Received.length, 1);
    assert.strictEqual(client1Received[0].data.vehicle_id, 10);
    assert.strictEqual(client2Received.length, 0);
  });
});
