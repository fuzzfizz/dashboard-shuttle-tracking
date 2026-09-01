import mqtt from 'mqtt';
import crypto from 'node:crypto';
import defaultDb from '../db/index.js';
import config from '../config/env.js';
import { processTelemetryPoint } from './distance-engine.js';
import { closeActiveTrip } from './trip-service.js';

/**
 * MQTT Ingestion & Downlink Command Service
 *
 * Ingests live telemetry pings and device status/LWT messages from MQTT broker.
 * Integrates with distance engine and trip service to persist points and manage trips.
 * Dispatches real-time broadcast events and sends downlink command messages with QoS 1.
 */
export class MqttIngestService {
  /**
   * @param {object} options
   * @param {string} [options.brokerUrl] - MQTT broker connection URL.
   * @param {string} [options.username] - MQTT username.
   * @param {string} [options.password] - MQTT password.
   * @param {object} [options.dbClient] - PostgreSQL database client or pool.
   * @param {object} [options.mqttClient] - Pre-initialized MQTT client (useful for unit testing).
   * @param {Function} [options.onBroadcastLocation] - Callback fired on new telemetry point.
   * @param {Function} [options.onBroadcastStatus] - Callback fired on vehicle status change.
   * @param {Function} [options.onTripEvent] - Callback fired on trip status transitions.
   * @param {Function} [options.onCommandResponse] - Callback fired on device command response.
   * @param {object} [options.logger] - Logger instance.
   */
  constructor(options = {}) {
    this.brokerUrl = options.brokerUrl || config.MQTT_BROKER_URL || 'mqtt://localhost:1883';
    this.username = options.username;
    this.password = options.password;
    this.dbClient = options.dbClient || defaultDb;
    this.onBroadcastLocation = options.onBroadcastLocation;
    this.onBroadcastStatus = options.onBroadcastStatus;
    this.onTripEvent = options.onTripEvent;
    this.onCommandResponse = options.onCommandResponse;
    const isTest =
      process.env.NODE_ENV === 'test' ||
      Boolean(process.env.NODE_TEST_CONTEXT) ||
      config.NODE_ENV === 'test';
    this.logger = options.logger !== undefined ? options.logger : (isTest ? null : console);

    // Connect or use injected client
    if (options.mqttClient) {
      this.client = options.mqttClient;
    } else {
      this.client = mqtt.connect(this.brokerUrl, {
        username: this.username,
        password: this.password,
        reconnectPeriod: 5000,
      });
    }

    this._setupListeners();
  }

  /**
   * Setup MQTT client event listeners for subscriptions and message handling.
   * @private
   */
  _setupListeners() {
    this.client.on('connect', () => {
      this.log('info', `Connected to MQTT Broker at ${this.brokerUrl}`);
      const topics = [
        'vehicles/+/telemetry',
        'vehicles/+/status',
        'vehicles/+/response'
      ];
      this.client.subscribe(topics, { qos: 1 }, (err) => {
        if (err) {
          this.log('error', `Failed to subscribe to MQTT topics: ${err.message}`);
        } else {
          this.log('info', `Subscribed to MQTT topics: ${topics.join(', ')}`);
        }
      });
    });

    this.client.on('message', async (topic, payload) => {
      try {
        await this.handleMessage(topic, payload);
      } catch (err) {
        this.log('error', `Error handling MQTT message on topic ${topic}: ${err.message}`);
      }
    });

    this.client.on('error', (err) => {
      this.log('error', `MQTT client error: ${err.message}`);
    });
  }

  /**
   * Safe logger helper
   * @param {'info'|'warn'|'error'|'debug'} level
   * @param {string} msg
   * @param {*} [meta]
   */
  log(level, msg, meta) {
    if (this.logger && typeof this.logger[level] === 'function') {
      if (meta !== undefined) {
        this.logger[level](msg, meta);
      } else {
        this.logger[level](msg);
      }
    }
  }

  /**
   * Route and process incoming MQTT messages.
   *
   * Supported topic patterns:
   * - vehicles/{vehicleKey}/telemetry
   * - vehicles/{vehicleKey}/status
   * - vehicles/{vehicleKey}/response
   *
   * @param {string} topic - MQTT topic string.
   * @param {Buffer|string} payload - Message payload.
   * @returns {Promise<void>}
   */
  async handleMessage(topic, payload) {
    let data;
    try {
      const payloadStr = Buffer.isBuffer(payload) ? payload.toString('utf-8') : String(payload);
      data = JSON.parse(payloadStr);
    } catch (err) {
      this.log('warn', `Malformed JSON payload on topic ${topic}: ${err.message}`);
      return;
    }

    if (!data || typeof data !== 'object') {
      return;
    }

    const topicParts = topic.split('/');
    if (topicParts.length !== 3 || topicParts[0] !== 'vehicles') {
      return;
    }

    const vehicleKey = topicParts[1];
    const messageType = topicParts[2];

    switch (messageType) {
      case 'telemetry':
        await this._handleTelemetry(vehicleKey, data);
        break;
      case 'status':
        await this._handleStatus(vehicleKey, data);
        break;
      case 'response':
        await this._handleResponse(vehicleKey, data);
        break;
      default:
        this.log('debug', `Unhandled message type '${messageType}' on topic ${topic}`);
    }
  }

  /**
   * Find vehicle by ID, plate number, or device API key.
   * @private
   * @param {string} vehicleKey
   * @returns {Promise<object|null>}
   */
  async _findVehicle(vehicleKey) {
    const query = `
      SELECT id, plate_number, device_api_key, last_lat, last_lng, last_speed_kmh, last_heading, last_seen_at, status
      FROM vehicles
      WHERE id::text = $1 OR plate_number = $1 OR device_api_key = $1
      LIMIT 1;
    `;
    const res = await this.dbClient.query(query, [vehicleKey]);
    return res.rows && res.rows.length > 0 ? res.rows[0] : null;
  }

  /**
   * Parse timestamp into Date object.
   * @private
   * @param {number|string|Date} ts
   * @returns {Date}
   */
  _parseTimestamp(ts) {
    if (!ts) return new Date();
    if (typeof ts === 'number') {
      return ts < 1e11 ? new Date(ts * 1000) : new Date(ts);
    }
    const d = new Date(ts);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  /**
   * Process vehicle telemetry ping.
   * @private
   * @param {string} vehicleKey
   * @param {object} payload
   */
  async _handleTelemetry(vehicleKey, payload) {
    const vehicle = await this._findVehicle(vehicleKey);
    if (!vehicle) {
      this.log('warn', `Telemetry ignored: vehicle not found for key '${vehicleKey}'`);
      return;
    }

    const lat = payload.lat;
    const lng = payload.lng !== undefined ? payload.lng : payload.lon;
    const speed = payload.speed !== undefined ? Number(payload.speed) : 0;
    const heading = payload.heading !== undefined ? Number(payload.heading) : 0;
    const acc = payload.acc !== undefined ? Boolean(payload.acc) : true;
    const timestamp = this._parseTimestamp(payload.ts);

    const result = await processTelemetryPoint(this.dbClient, {
      vehicleId: vehicle.id,
      lat,
      lng,
      speed,
      heading,
      timestamp,
      acc
    });

    if (this.onBroadcastLocation) {
      this.onBroadcastLocation({
        vehicle_id: vehicle.id,
        plate_number: vehicle.plate_number,
        lat,
        lng,
        speed_kmh: speed,
        heading,
        trip_id: result?.trip?.id || null,
        status: acc === false ? 'offline' : 'online',
        timestamp: timestamp.toISOString()
      });
    }

    if (this.onTripEvent && result?.trip) {
      if (result.isAccOff) {
        this.onTripEvent('trip:completed', {
          trip_id: result.trip.id,
          vehicle_id: vehicle.id,
          started_at: result.trip.started_at,
          ended_at: result.trip.ended_at,
          total_distance_km: Number(result.trip.total_distance_km || 0)
        });
      } else if (result.trip.isNew) {
        this.onTripEvent('trip:started', {
          trip_id: result.trip.id,
          vehicle_id: vehicle.id,
          started_at: result.trip.started_at,
          ended_at: null,
          total_distance_km: 0
        });
      }
    }
  }

  /**
   * Process vehicle status update (e.g. LWT offline or online event).
   * @private
   * @param {string} vehicleKey
   * @param {object} payload
   */
  async _handleStatus(vehicleKey, payload) {
    const vehicle = await this._findVehicle(vehicleKey);
    if (!vehicle) {
      this.log('warn', `Status update ignored: vehicle not found for key '${vehicleKey}'`);
      return;
    }

    const status = payload.status === 'offline' ? 'offline' : 'online';
    const timestamp = this._parseTimestamp(payload.ts);
    const isoTimestamp = timestamp.toISOString();

    if (status === 'offline') {
      const closedTrip = await closeActiveTrip(this.dbClient, vehicle.id, isoTimestamp, payload.reason || 'offline_status');
      const updateQuery = `
        UPDATE vehicles
        SET status = 'offline',
            last_seen_at = $2
        WHERE id = $1
        RETURNING *;
      `;
      await this.dbClient.query(updateQuery, [vehicle.id, isoTimestamp]);

      if (this.onTripEvent && closedTrip) {
        this.onTripEvent('trip:completed', {
          trip_id: closedTrip.id,
          vehicle_id: closedTrip.vehicle_id,
          started_at: closedTrip.started_at,
          ended_at: closedTrip.ended_at,
          total_distance_km: Number(closedTrip.total_distance_km || 0)
        });
      }
    } else {
      const updateQuery = `
        UPDATE vehicles
        SET status = 'online',
            last_seen_at = $2
        WHERE id = $1
        RETURNING *;
      `;
      await this.dbClient.query(updateQuery, [vehicle.id, isoTimestamp]);
    }

    if (this.onBroadcastStatus) {
      this.onBroadcastStatus({
        vehicle_id: vehicle.id,
        status,
        last_seen_at: isoTimestamp,
        reason: payload.reason
      });
    }
  }

  /**
   * Process vehicle command response.
   * @private
   * @param {string} vehicleKey
   * @param {object} payload
   */
  async _handleResponse(vehicleKey, payload) {
    this.log('info', `Device response from ${vehicleKey}: ${JSON.stringify(payload)}`);
    if (this.onCommandResponse) {
      this.onCommandResponse({
        vehicleKey,
        cmd_id: payload.cmd_id,
        status: payload.status,
        message: payload.message
      });
    }
  }

  /**
   * Publish downlink command to device with QoS 1.
   *
   * @param {string} vehicleKey - Vehicle ID, plate number, or device API key.
   * @param {object} command - Command payload.
   * @param {string} [command.cmd_id] - Optional UUID command identifier.
   * @param {string} command.action - Action name (e.g. 'SET_PING_INTERVAL', 'REBOOT').
   * @param {object} [command.params={}] - Action parameters.
   * @param {number} [command.ts] - Command timestamp in ms.
   * @returns {Promise<{success: boolean, commandId: string, topic: string}>}
   */
  async sendCommand(vehicleKey, command) {
    if (!command || typeof command !== 'object') {
      throw new Error('Invalid command: payload must be an object');
    }

    const commandId = command.cmd_id || crypto.randomUUID();
    const topic = `vehicles/${vehicleKey}/command`;
    const payload = {
      cmd_id: commandId,
      action: command.action,
      params: command.params || {},
      ts: command.ts || Date.now()
    };

    return new Promise((resolve, reject) => {
      this.client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
        if (err) {
          this.log('error', `Failed to publish command to ${topic}: ${err.message}`);
          return reject(err);
        }
        resolve({
          success: true,
          commandId,
          topic
        });
      });
    });
  }

  /**
   * Gracefully close MQTT connection.
   * @returns {Promise<void>}
   */
  async close() {
    return new Promise((resolve) => {
      if (this.client && typeof this.client.end === 'function') {
        this.client.end(false, {}, () => {
          this.log('info', 'MQTT Ingest Service closed');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

/**
 * Factory helper to instantiate MqttIngestService.
 * @param {object} options
 * @returns {MqttIngestService}
 */
export function createMqttIngestService(options = {}) {
  return new MqttIngestService(options);
}

export default {
  MqttIngestService,
  createMqttIngestService
};
