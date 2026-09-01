import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createMqttIngestService, MqttIngestService } from '../src/services/mqtt-ingest.js';

class MockMqttClient extends EventEmitter {
  constructor() {
    super();
    this.subscriptions = [];
    this.publishedMessages = [];
    this.connected = false;
    this.closed = false;
    this.publishShouldFail = false;
  }

  subscribe(topic, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    const topics = Array.isArray(topic) ? topic : [topic];
    for (const t of topics) {
      this.subscriptions.push({ topic: t, options });
    }
    if (callback) callback(null, topics.map(t => ({ topic: t, qos: options?.qos || 0 })));
    return this;
  }

  publish(topic, message, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    if (this.publishShouldFail) {
      if (callback) callback(new Error('Network publish error'));
      return this;
    }
    this.publishedMessages.push({
      topic,
      message: typeof message === 'string' ? message : message.toString(),
      options: options || {}
    });
    if (callback) callback(null);
    return this;
  }

  end(force, options, callback) {
    if (typeof force === 'function') {
      callback = force;
    } else if (typeof options === 'function') {
      callback = options;
    }
    this.connected = false;
    this.closed = true;
    if (callback) callback();
    return this;
  }

  simulateConnect() {
    this.connected = true;
    this.emit('connect');
  }

  simulateMessage(topic, payload) {
    const messageBuffer = Buffer.isBuffer(payload)
      ? payload
      : Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload));
    this.emit('message', topic, messageBuffer);
  }
}

describe('MQTT Ingestion Service & Downlink Commands', () => {
  let mockDb;
  let mockMqttClient;

  beforeEach(() => {
    mockMqttClient = new MockMqttClient();

    mockDb = {
      vehicles: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          plate_number: '1กข-1234',
          device_api_key: 'DEV-KEY-001',
          last_lat: 13.7463,
          last_lng: 100.5347,
          last_speed_kmh_kmh: 0,
          last_heading: 0,
          last_seen_at: '2026-09-15T08:00:00Z',
          status: 'online'
        },
        {
          id: '22222222-2222-2222-2222-222222222222',
          plate_number: '2กค-5678',
          device_api_key: 'DEV-KEY-002',
          last_lat: null,
          last_lng: null,
          last_speed_kmh_kmh: 0,
          last_heading: 0,
          last_seen_at: null,
          status: 'offline'
        }
      ],
      trips: [],
      gps_points: [],
      query: async function (text, params = []) {
        const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();

        // 1. SELECT vehicle by id, plate_number, or device_api_key
        if (
          normalized.includes('select') &&
          normalized.includes('from vehicles') &&
          (normalized.includes('where') || normalized.includes('id::text = $1') || normalized.includes('id = $1'))
        ) {
          const key = params[0];
          const vehicle = this.vehicles.find(
            (v) => v.id === key || v.plate_number === key || v.device_api_key === key
          );
          return { rows: vehicle ? [{ ...vehicle }] : [] };
        }

        // 2. UPDATE vehicle
        if (normalized.includes('update vehicles') && (normalized.includes('where id = $1') || normalized.includes('where id::text = $1'))) {
          const vehicle_id = params[0];
          const vehicle = this.vehicles.find((v) => v.id === vehicle_id);
          if (vehicle) {
            if (normalized.includes("status = 'offline'")) {
              vehicle.last_seen_at = params[1] ? new Date(params[1]).toISOString() : new Date().toISOString();
              vehicle.status = 'offline';
            } else if (normalized.includes('status = $2')) {
              vehicle.status = params[1];
              vehicle.last_seen_at = params[2] ? new Date(params[2]).toISOString() : new Date().toISOString();
            } else {
              // Telemetry update: [vehicle_id, last_lat, last_lng, last_speed_kmh_kmh, last_heading, last_seen_at]
              const [, lastLat, lastLng, lastspeed_kmh, lastHeading, last_seen_at] = params;
              vehicle.last_lat = lastLat;
              vehicle.last_lng = lastLng;
              vehicle.last_speed_kmh_kmh = lastspeed_kmh;
              vehicle.last_heading = lastHeading;
              vehicle.last_seen_at = last_seen_at ? new Date(last_seen_at).toISOString() : new Date().toISOString();
              vehicle.status = 'online';
            }
            return { rows: [{ ...vehicle }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }

        // 3. Trip queries: SELECT active trip
        if (normalized.includes('select') && normalized.includes('from trips') && normalized.includes("status = 'in_progress'")) {
          const vehicle_id = params[0];
          const tripDate = params[1];
          const trip = this.trips.find(
            (t) =>
              t.vehicle_id === vehicle_id &&
              t.status === 'in_progress' &&
              (!tripDate || t.trip_date === tripDate)
          );
          return { rows: trip ? [{ ...trip }] : [] };
        }

        // 4. Trip queries: SELECT MAX(trip_number)
        if (normalized.includes('max(trip_number)') && normalized.includes('from trips')) {
          const vehicle_id = params[0];
          const tripDate = params[1];
          const matching = this.trips.filter(
            (t) => t.vehicle_id === vehicle_id && (!tripDate || t.trip_date === tripDate)
          );
          const maxNum = matching.reduce((max, t) => Math.max(max, t.trip_number || 0), 0);
          return { rows: [{ max_trip_number: maxNum }] };
        }

        // 5. Trip queries: INSERT INTO trips
        if (normalized.includes('insert into trips')) {
          const [vehicle_id, tripNumber, startedAt, tripDate] = params;
          const newTrip = {
            id: `trip-${this.trips.length + 1}`,
            vehicle_id: vehicle_id,
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
          const vehicle_id = params[0];
          const endedAt = params[1] ? new Date(params[1]).toISOString() : new Date().toISOString();
          const trip = this.trips.find(
            (t) => t.vehicle_id === vehicle_id && t.status === 'in_progress'
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
          const [
            vehicle_id,
            tripId,
            lat,
            lng,
            speed_kmhKmh,
            heading,
            distPrevM,
            deviceTimestamp,
            isValid
          ] = params;

          const point = {
            id: this.gps_points.length + 1,
            vehicle_id: vehicle_id,
            trip_id: tripId,
            lat,
            lng,
            speed_kmh_kmh: speed_kmhKmh,
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

  describe('Service Initialization & MQTT Subscriptions', () => {
    it('creates service, connects, and automatically subscribes to required topics on connect', async () => {
      const service = createMqttIngestService({
        mqttClient: mockMqttClient,
        dbClient: mockDb
      });

      assert.ok(service instanceof MqttIngestService);
      
      mockMqttClient.simulateConnect();

      const subscribedTopics = mockMqttClient.subscriptions.map((s) => s.topic);
      assert.ok(subscribedTopics.includes('vehicles/+/telemetry'));
      assert.ok(subscribedTopics.includes('vehicles/+/status'));
      assert.ok(subscribedTopics.includes('vehicles/+/response'));
    });

    it('handles client errors gracefully through error listener', async () => {
      let loggedError = false;
      const customLogger = {
        info: () => {},
        warn: () => {},
        error: () => { loggedError = true; },
        debug: () => {}
      };

      createMqttIngestService({
        mqttClient: mockMqttClient,
        dbClient: mockDb,
        logger: customLogger
      });

      mockMqttClient.emit('error', new Error('Simulated broker connection failure'));
      assert.strictEqual(loggedError, true);
    });
  });

  describe('Incoming Telemetry Ingestion (vehicles/{key}/telemetry)', () => {
    it('processes telemetry point by vehicle ID and fires onBroadcastLocation callback', async () => {
      let broadcastData = null;
      let tripEventData = null;
      const service = createMqttIngestService({
        mqttClient: mockMqttClient,
        dbClient: mockDb,
        onBroadcastLocation: (data) => {
          broadcastData = data;
        },
        onTripEvent: (data) => {
          tripEventData = data;
        }
      });

      mockMqttClient.simulateConnect();

      const telemetryPayload = {
        lat: 13.7465,
        lng: 100.5350,
        speed: 28.5,
        heading: 85,
        ts: 1726387200, // Unix epoch seconds
        acc: true
      };

      await service.handleMessage(
        'vehicles/11111111-1111-1111-1111-111111111111/telemetry',
        Buffer.from(JSON.stringify(telemetryPayload))
      );

      assert.ok(broadcastData, 'onBroadcastLocation should have been called');
      assert.strictEqual(broadcastData.vehicle_id, '11111111-1111-1111-1111-111111111111');
      assert.strictEqual(broadcastData.lat, 13.7465);
      assert.strictEqual(broadcastData.lng, 100.5350);
      assert.strictEqual(broadcastData.speed_kmh, 28.5);
      assert.strictEqual(broadcastData.heading, 85);
      assert.strictEqual(broadcastData.status, 'online');
      assert.strictEqual(broadcastData.trip_id, 'trip-1');

      assert.ok(tripEventData, 'onTripEvent should have been called');
      assert.strictEqual(tripEventData.vehicle_id, '11111111-1111-1111-1111-111111111111');

      // Verify DB point recorded
      assert.strictEqual(mockDb.gps_points.length, 1);
      assert.strictEqual(mockDb.gps_points[0].vehicle_id, '11111111-1111-1111-1111-111111111111');
    });

    it('resolves vehicle by plate_number and processes telemetry', async () => {
      let broadcastData = null;
      const service = createMqttIngestService({
        mqttClient: mockMqttClient,
        dbClient: mockDb,
        onBroadcastLocation: (data) => {
          broadcastData = data;
        }
      });

      mockMqttClient.simulateConnect();

      const telemetryPayload = {
        lat: 13.7500,
        lng: 100.5400,
        speed_kmh: 35.0,
        heading: 120,
        ts: Date.now(),
        acc: true
      };

      await service.handleMessage(
        'vehicles/1กข-1234/telemetry',
        Buffer.from(JSON.stringify(telemetryPayload))
      );

      assert.ok(broadcastData);
      assert.strictEqual(broadcastData.vehicle_id, '11111111-1111-1111-1111-111111111111');
    });

    it('resolves vehicle by device_api_key and handles lon alias', async () => {
      let broadcastData = null;
      const service = createMqttIngestService({
        mqttClient: mockMqttClient,
        dbClient: mockDb,
        onBroadcastLocation: (data) => {
          broadcastData = data;
        }
      });

      mockMqttClient.simulateConnect();

      const telemetryPayload = {
        lat: 13.7600,
        lon: 100.5500, // lon instead of lng
        speed_kmh: 15.0,
        heading: 0,
        ts: '2026-09-15T08:10:00Z',
        acc: true
      };

      await service.handleMessage(
        'vehicles/DEV-KEY-001/telemetry',
        Buffer.from(JSON.stringify(telemetryPayload))
      );

      assert.ok(broadcastData);
      assert.strictEqual(broadcastData.lat, 13.7600);
      assert.strictEqual(broadcastData.lng, 100.5500);
    });

    it('handles ignition off (acc: false) in telemetry stream', async () => {
      let broadcastData = null;
      const service = createMqttIngestService({
        mqttClient: mockMqttClient,
        dbClient: mockDb,
        onBroadcastLocation: (data) => {
          broadcastData = data;
        }
      });

      mockMqttClient.simulateConnect();

      const telemetryPayload = {
        lat: 13.7463,
        lng: 100.5347,
        speed: 0,
        heading: 0,
        acc: false
      };

      await service.handleMessage(
        'vehicles/11111111-1111-1111-1111-111111111111/telemetry',
        Buffer.from(JSON.stringify(telemetryPayload))
      );

      const vehicle = mockDb.vehicles.find((v) => v.id === '11111111-1111-1111-1111-111111111111');
      assert.strictEqual(vehicle.status, 'offline');
      assert.strictEqual(broadcastData.status, 'offline');
    });

    it('handles omitted timestamp by defaulting to current time', async () => {
      let broadcastData = null;
      const service = createMqttIngestService({
        mqttClient: mockMqttClient,
        dbClient: mockDb,
        onBroadcastLocation: (data) => {
          broadcastData = data;
        }
      });

      mockMqttClient.simulateConnect();

      const telemetryPayload = {
        lat: 13.7463,
        lng: 100.5347,
        speed_kmh: 10.0
      };

      await service.handleMessage(
        'vehicles/11111111-1111-1111-1111-111111111111/telemetry',
        Buffer.from(JSON.stringify(telemetryPayload))
      );

      assert.ok(broadcastData);
      assert.strictEqual(mockDb.gps_points.length, 1);
      assert.ok(mockDb.gps_points[0].device_timestamp);
    });
  });

  describe('Incoming Status / LWT Events (vehicles/{key}/status)', () => {
    it('handles offline status, updates DB, closes trip, and invokes onBroadcastStatus', async () => {
      // Add an active trip for vehicle
      mockDb.trips.push({
        id: 'trip-active-1',
        vehicle_id: '11111111-1111-1111-1111-111111111111',
        trip_number: 1,
        started_at: '2026-09-15T08:00:00Z',
        ended_at: null,
        total_distance_km: 5.2,
        total_points: 40,
        status: 'in_progress',
        trip_date: '2026-09-15'
      });

      let statusData = null;
      const service = createMqttIngestService({
        mqttClient: mockMqttClient,
        dbClient: mockDb,
        onBroadcastStatus: (data) => {
          statusData = data;
        }
      });

      mockMqttClient.simulateConnect();

      const statusPayload = {
        status: 'offline',
        reason: 'lwt_disconnect',
        ts: Date.now()
      };

      await service.handleMessage(
        'vehicles/11111111-1111-1111-1111-111111111111/status',
        Buffer.from(JSON.stringify(statusPayload))
      );

      assert.ok(statusData);
      assert.strictEqual(statusData.vehicle_id, '11111111-1111-1111-1111-111111111111');
      assert.strictEqual(statusData.status, 'offline');
      assert.ok(statusData.last_seen_at);

      // Vehicle in DB updated to offline
      const vehicle = mockDb.vehicles.find((v) => v.id === '11111111-1111-1111-1111-111111111111');
      assert.strictEqual(vehicle.status, 'offline');

      // Active trip completed
      const trip = mockDb.trips.find((t) => t.id === 'trip-active-1');
      assert.strictEqual(trip.status, 'completed');
    });

    it('handles online status and invokes onBroadcastStatus', async () => {
      let statusData = null;
      const service = createMqttIngestService({
        mqttClient: mockMqttClient,
        dbClient: mockDb,
        onBroadcastStatus: (data) => {
          statusData = data;
        }
      });

      mockMqttClient.simulateConnect();

      const statusPayload = {
        status: 'online',
        ts: Date.now()
      };

      await service.handleMessage(
        'vehicles/22222222-2222-2222-2222-222222222222/status',
        Buffer.from(JSON.stringify(statusPayload))
      );

      assert.ok(statusData);
      assert.strictEqual(statusData.vehicle_id, '22222222-2222-2222-2222-222222222222');
      assert.strictEqual(statusData.status, 'online');

      const vehicle = mockDb.vehicles.find((v) => v.id === '22222222-2222-2222-2222-222222222222');
      assert.strictEqual(vehicle.status, 'online');
    });
  });

  describe('Incoming Command Responses (vehicles/{key}/response)', () => {
    it('handles response payload and notifies response listener if registered', async () => {
      let responseReceived = null;
      const service = createMqttIngestService({
        mqttClient: mockMqttClient,
        dbClient: mockDb,
        onCommandResponse: (data) => {
          responseReceived = data;
        }
      });

      mockMqttClient.simulateConnect();

      const responsePayload = {
        cmd_id: 'cmd-uuid-1234',
        status: 'acknowledged',
        message: 'Ping interval updated to 5s'
      };

      await service.handleMessage(
        'vehicles/11111111-1111-1111-1111-111111111111/response',
        Buffer.from(JSON.stringify(responsePayload))
      );

      assert.ok(responseReceived);
      assert.strictEqual(responseReceived.vehicleKey, '11111111-1111-1111-1111-111111111111');
      assert.strictEqual(responseReceived.cmd_id, 'cmd-uuid-1234');
      assert.strictEqual(responseReceived.status, 'acknowledged');
    });
  });

  describe('Downlink Command Publishing (sendCommand)', () => {
    it('publishes command to vehicles/{vehicleKey}/command with QoS 1 and generated UUID', async () => {
      const service = createMqttIngestService({
        mqttClient: mockMqttClient,
        dbClient: mockDb
      });

      const result = await service.sendCommand('1กข-1234', {
        action: 'SET_PING_INTERVAL',
        params: { intervalSec: 5 }
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.commandId);
      assert.strictEqual(result.topic, 'vehicles/1กข-1234/command');

      assert.strictEqual(mockMqttClient.publishedMessages.length, 1);
      const pub = mockMqttClient.publishedMessages[0];
      assert.strictEqual(pub.topic, 'vehicles/1กข-1234/command');
      assert.strictEqual(pub.options.qos, 1);

      const parsedPayload = JSON.parse(pub.message);
      assert.strictEqual(parsedPayload.cmd_id, result.commandId);
      assert.strictEqual(parsedPayload.action, 'SET_PING_INTERVAL');
      assert.deepStrictEqual(parsedPayload.params, { intervalSec: 5 });
      assert.ok(parsedPayload.ts);
    });

    it('uses provided cmd_id if already specified in command object', async () => {
      const service = createMqttIngestService({
        mqttClient: mockMqttClient,
        dbClient: mockDb
      });

      const result = await service.sendCommand('veh-01', {
        cmd_id: 'custom-cmd-id-999',
        action: 'REBOOT',
        params: {}
      });

      assert.strictEqual(result.commandId, 'custom-cmd-id-999');
      const pub = mockMqttClient.publishedMessages[0];
      const parsedPayload = JSON.parse(pub.message);
      assert.strictEqual(parsedPayload.cmd_id, 'custom-cmd-id-999');
      assert.strictEqual(parsedPayload.action, 'REBOOT');
    });

    it('rejects with error when command is not an object', async () => {
      const service = createMqttIngestService({
        mqttClient: mockMqttClient,
        dbClient: mockDb
      });

      await assert.rejects(
        () => service.sendCommand('veh-01', null),
        /payload must be an object/i
      );
    });

    it('rejects with error when mqtt publish fails', async () => {
      mockMqttClient.publishShouldFail = true;
      const service = createMqttIngestService({
        mqttClient: mockMqttClient,
        dbClient: mockDb
      });

      await assert.rejects(
        () => service.sendCommand('veh-01', { action: 'PING' }),
        /Network publish error/i
      );
    });
  });

  describe('Error Handling & Edge Cases', () => {
    it('gracefully handles malformed JSON payload without throwing or crashing', async () => {
      const service = createMqttIngestService({
        mqttClient: mockMqttClient,
        dbClient: mockDb
      });

      mockMqttClient.simulateConnect();

      // Should not throw
      await service.handleMessage(
        'vehicles/11111111-1111-1111-1111-111111111111/telemetry',
        Buffer.from('{invalid: json:')
      );

      assert.strictEqual(mockDb.gps_points.length, 0);
    });

    it('gracefully ignores telemetry for unknown vehicle without throwing', async () => {
      let broadcastCalled = false;
      const service = createMqttIngestService({
        mqttClient: mockMqttClient,
        dbClient: mockDb,
        onBroadcastLocation: () => {
          broadcastCalled = true;
        }
      });

      mockMqttClient.simulateConnect();

      await service.handleMessage(
        'vehicles/unknown-vehicle-id/telemetry',
        Buffer.from(JSON.stringify({ lat: 13.75, lng: 100.5, speed_kmh: 20 }))
      );

      assert.strictEqual(broadcastCalled, false);
      assert.strictEqual(mockDb.gps_points.length, 0);
    });

    it('ignores unrecognized topic structure gracefully', async () => {
      const service = createMqttIngestService({
        mqttClient: mockMqttClient,
        dbClient: mockDb
      });

      mockMqttClient.simulateConnect();

      await service.handleMessage(
        'other/unrelated/topic',
        Buffer.from(JSON.stringify({ hello: 'world' }))
      );

      assert.strictEqual(mockDb.gps_points.length, 0);
    });

    it('handles simulated DB query failure gracefully without crashing', async () => {
      let loggedError = false;
      const customLogger = {
        info: () => {},
        warn: () => {},
        error: () => { loggedError = true; },
        debug: () => {}
      };

      const failingDb = {
        query: async () => {
          throw new Error('Database connection lost');
        }
      };

      const service = createMqttIngestService({
        mqttClient: mockMqttClient,
        dbClient: failingDb,
        logger: customLogger
      });

      mockMqttClient.simulateConnect();

      // Emit message event via client
      mockMqttClient.simulateMessage(
        'vehicles/11111111-1111-1111-1111-111111111111/telemetry',
        { lat: 13.75, lng: 100.5, speed_kmh: 20 }
      );

      // Wait a tick for async message processing
      await new Promise((resolve) => setTimeout(resolve, 50));
      assert.strictEqual(loggedError, true);
    });

    it('closes MQTT client cleanly on close()', async () => {
      const service = createMqttIngestService({
        mqttClient: mockMqttClient,
        dbClient: mockDb
      });

      await service.close();
      assert.strictEqual(mockMqttClient.closed, true);
    });
  });
});
