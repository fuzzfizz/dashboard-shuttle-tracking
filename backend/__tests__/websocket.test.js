import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../src/app.js';
import WebSocket from 'ws';

describe('WebSocket Server & Broadcaster', () => {
  let app;
  let serverAddress;
  let adminToken;
  let dbMock;

  before(async () => {
    dbMock = {
      query: async () => ({ rows: [] })
    };
    app = buildApp({
      logger: false,
      jwtSecret: 'test-secret',
      db: dbMock
    });
    
    await app.listen({ port: 0 });
    const port = app.server.address().port;
    serverAddress = `ws://127.0.0.1:${port}`;
    adminToken = app.jwt.sign({ id: 1, role: 'admin' });
  });

  after(async () => {
    await app.close();
  });

  test('Public WebSocket: ping-pong', async () => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${serverAddress}/ws/public`);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Timeout'));
      }, 1000);

      ws.on('open', () => {
        ws.send(JSON.stringify({ action: 'ping' }));
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.event === 'pong') {
          clearTimeout(timeout);
          assert.ok(msg.timestamp);
          ws.close();
          resolve();
        }
      });
      ws.on('error', reject);
    });
  });

  test('Public WebSocket: subscription and filter', async () => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${serverAddress}/ws/public`);
      const received = [];

      const timeout = setTimeout(() => {
        ws.close();
        try {
          // Should receive for vehicle 1, but not 2
          assert.strictEqual(received.length, 1);
          assert.strictEqual(received[0].data.vehicle_id, 1);
          resolve();
        } catch (e) {
          reject(e);
        }
      }, 500);

      ws.on('open', () => {
        ws.send(JSON.stringify({ action: 'subscribe', vehicle_ids: [1] }));
        
        // Wait a bit for subscription to process, then broadcast
        setTimeout(() => {
          app.broadcaster.broadcastLocation({ vehicle_id: 1, lat: 10, lng: 20 });
          app.broadcaster.broadcastLocation({ vehicle_id: 2, lat: 30, lng: 40 });
        }, 50);
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.event === 'vehicle:location') {
          received.push(msg);
        }
      });
      ws.on('error', reject);
    });
  });

  test('Admin WebSocket: valid token and receive all', async () => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${serverAddress}/ws?token=${adminToken}`);
      const received = [];

      const timeout = setTimeout(() => {
        ws.close();
        try {
          assert.strictEqual(received.length, 3);
          assert.strictEqual(received[0].event, 'auth:success');
          assert.strictEqual(received[1].event, 'vehicle:status');
          assert.strictEqual(received[2].event, 'trip:started');
          resolve();
        } catch (e) {
          reject(e);
        }
      }, 500);

      ws.on('open', () => {
        setTimeout(() => {
          app.broadcaster.broadcastStatus({ vehicle_id: 1, status: 'online' });
          app.broadcaster.broadcastTripEvent('trip:started', { trip_id: 100 });
        }, 50);
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        received.push(msg);
      });
      ws.on('error', reject);
    });
  });

  test('Admin WebSocket: auth via message', async () => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${serverAddress}/ws`);
      let authed = false;

      const timeout = setTimeout(() => {
        ws.close();
        if (authed) resolve();
        else reject(new Error('Did not receive auth success'));
      }, 500);

      ws.on('open', () => {
        ws.send(JSON.stringify({ action: 'auth', token: adminToken }));
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.event === 'auth:success') {
          authed = true;
        }
      });
      ws.on('error', reject);
    });
  });

  test('Admin WebSocket: invalid token disconnects', async () => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${serverAddress}/ws?token=invalid`);
      
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Should have disconnected'));
      }, 500);

      ws.on('close', (code) => {
        clearTimeout(timeout);
        assert.strictEqual(code, 4401);
        resolve();
      });
      ws.on('error', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  });

  test('Admin WebSocket: auth timeout if no token provided', async () => {
    return new Promise((resolve, reject) => {
      // Connect without token
      const ws = new WebSocket(`${serverAddress}/ws`);
      
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Should have disconnected due to auth timeout'));
      }, 6000); // Wait longer than 5 seconds

      ws.on('close', (code, reason) => {
        clearTimeout(timeout);
        assert.strictEqual(code, 4401);
        assert.strictEqual(reason.toString(), 'Auth timeout');
        resolve();
      });
      ws.on('error', (err) => {
        clearTimeout(timeout);
        resolve();
      });
    });
  });

  test('Broadcaster handles closed sockets gracefully', async () => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${serverAddress}/ws/public`);
      ws.on('open', () => {
        ws.close();
        setTimeout(() => {
          try {
            app.broadcaster.broadcastLocation({ vehicle_id: 3, plate_number: 'XYZ', lat: 10, lng: 20 });
            resolve();
          } catch(e) {
            reject(e);
          }
        }, 100);
      });
      ws.on('error', reject);
    });
  });

  test('Public WebSocket: verify plate_number in location broadcast', async () => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${serverAddress}/ws/public`);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Timeout waiting for location broadcast'));
      }, 1000);

      ws.on('open', () => {
        setTimeout(() => {
          app.broadcaster.broadcastLocation({
            vehicle_id: 99,
            plate_number: 'TEST-123',
            lat: 10,
            lng: 20
          });
        }, 50);
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.event === 'vehicle:location') {
          clearTimeout(timeout);
          assert.strictEqual(msg.data.vehicle_id, 99);
          assert.strictEqual(msg.data.plate_number, 'TEST-123');
          ws.close();
          resolve();
        }
      });
    });
  });

  test('Admin WebSocket: verify trip:started and trip:completed payload formats', async () => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${serverAddress}/ws?token=${adminToken}`);
      const receivedEvents = {};

      const timeout = setTimeout(() => {
        ws.close();
        try {
          assert.ok(receivedEvents['trip:started']);
          assert.strictEqual(receivedEvents['trip:started'].trip_id, 100);
          assert.strictEqual(receivedEvents['trip:started'].vehicle_id, 1);
          assert.strictEqual(receivedEvents['trip:started'].ended_at, null);
          assert.strictEqual(receivedEvents['trip:started'].total_distance_km, 0);

          assert.ok(receivedEvents['trip:completed']);
          assert.strictEqual(receivedEvents['trip:completed'].trip_id, 100);
          assert.strictEqual(receivedEvents['trip:completed'].vehicle_id, 1);
          assert.strictEqual(receivedEvents['trip:completed'].total_distance_km, 5);
          assert.ok(receivedEvents['trip:completed'].ended_at !== null);
          
          resolve();
        } catch (e) {
          reject(e);
        }
      }, 500);

      ws.on('open', () => {
        setTimeout(() => {
          app.broadcaster.broadcastTripEvent('trip:started', {
            trip_id: 100,
            vehicle_id: 1,
            started_at: new Date().toISOString(),
            ended_at: null,
            total_distance_km: 0
          });

          app.broadcaster.broadcastTripEvent('trip:completed', {
            trip_id: 100,
            vehicle_id: 1,
            started_at: new Date().toISOString(),
            ended_at: new Date().toISOString(),
            total_distance_km: 5
          });
        }, 50);
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.event === 'trip:started' || msg.event === 'trip:completed') {
          receivedEvents[msg.event] = msg.data;
        }
      });
    });
  });
});
