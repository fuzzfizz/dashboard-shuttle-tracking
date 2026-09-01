import { processTelemetryPoint } from '../services/distance-engine.js';

/**
 * Authentication Middleware for Device API Key
 */
export async function verifyDeviceKey(request, reply) {
  const deviceKey = request.headers['x-device-key'];
  if (!deviceKey) {
    return reply.code(401).send({
      success: false,
      error: {
        code: 'MISSING_KEY',
        message: 'X-Device-Key header is required',
      },
    });
  }

  const db = request.server.db;
  const result = await db.query(
    `SELECT id, plate_number, name, device_api_key, status, is_active, last_lat, last_lng, last_speed_kmh, last_heading, last_seen_at
     FROM vehicles
     WHERE device_api_key = $1 AND is_active = true
     LIMIT 1;`,
    [deviceKey]
  );

  const vehicle = result.rows && result.rows[0];
  if (!vehicle) {
    return reply.code(403).send({
      success: false,
      error: {
        code: 'INVALID_KEY',
        message: 'Invalid or inactive device key',
      },
    });
  }

  request.vehicle = vehicle;
}

/**
 * Validate latitude and longitude coordinates.
 */
function validateCoordinates(lat, lng, lon) {
  if (lat === undefined || lat === null || typeof lat !== 'number' || isNaN(lat)) {
    return { valid: false, code: 'INVALID_COORDINATES', message: 'Latitude must be a valid number' };
  }
  if (lat < -90 || lat > 90) {
    return { valid: false, code: 'INVALID_COORDINATES', message: 'Latitude must be between -90 and 90' };
  }

  const lngVal = lng !== undefined ? lng : lon;
  if (lngVal === undefined || lngVal === null || typeof lngVal !== 'number' || isNaN(lngVal)) {
    return { valid: false, code: 'INVALID_COORDINATES', message: 'Longitude must be a valid number' };
  }
  if (lngVal < -180 || lngVal > 180) {
    return { valid: false, code: 'INVALID_COORDINATES', message: 'Longitude must be between -180 and 180' };
  }

  return { valid: true };
}

/**
 * Validate vehicle speed.
 */
function validateSpeed(speed) {
  if (speed === undefined || speed === null || typeof speed !== 'number' || isNaN(speed)) {
    return { valid: false, code: 'INVALID_SPEED', message: 'Speed must be a valid number' };
  }
  if (speed < 0) {
    return { valid: false, code: 'INVALID_SPEED', message: 'Speed must be non-negative' };
  }
  return { valid: true };
}

/**
 * Validate ping timestamp.
 */
function validateTimestamp(timestamp) {
  if (timestamp === undefined || timestamp === null || timestamp === '') {
    return { valid: true, dateObj: null };
  }

  let dateObj;
  if (typeof timestamp === 'number') {
    dateObj = timestamp < 1e11 ? new Date(timestamp * 1000) : new Date(timestamp);
  } else {
    dateObj = new Date(timestamp);
  }

  if (isNaN(dateObj.getTime())) {
    return { valid: false, code: 'INVALID_TIMESTAMP', message: 'Invalid timestamp format' };
  }

  const tenMinutesInFuture = Date.now() + 10 * 60 * 1000;
  if (dateObj.getTime() > tenMinutesInFuture) {
    return { valid: false, code: 'INVALID_TIMESTAMP', message: 'Timestamp cannot be more than 10 minutes in the future' };
  }

  return { valid: true, dateObj };
}

/**
 * Parse timestamp to numeric milliseconds for sorting.
 */
function parseTimestampMs(pt) {
  const ts = pt.timestamp !== undefined ? pt.timestamp : pt.ts;
  if (!ts) return 0;
  if (typeof ts === 'number') {
    return ts < 1e11 ? ts * 1000 : ts;
  }
  const d = new Date(ts);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

/**
 * Telemetry Routes Plugin
 */
export default async function telemetryRoutes(fastify, opts) {
  // 1. Single Telemetry Ping (POST /)
  fastify.post(
    '/',
    { preHandler: [verifyDeviceKey] },
    async (request, reply) => {
      const body = request.body || {};
      const { lat, lng, lon, speed, heading, timestamp, ts, acc } = body;

      const coordVal = validateCoordinates(lat, lng, lon);
      if (!coordVal.valid) {
        return reply.code(400).send({
          success: false,
          error: {
            code: coordVal.code,
            message: coordVal.message,
          },
        });
      }

      const speedVal = validateSpeed(speed);
      if (!speedVal.valid) {
        return reply.code(400).send({
          success: false,
          error: {
            code: speedVal.code,
            message: speedVal.message,
          },
        });
      }

      const tsToValidate = timestamp !== undefined ? timestamp : ts;
      const tsVal = validateTimestamp(tsToValidate);
      if (!tsVal.valid) {
        return reply.code(400).send({
          success: false,
          error: {
            code: tsVal.code,
            message: tsVal.message,
          },
        });
      }

      const finalLng = lng !== undefined ? lng : lon;
      const finalSpeed = Number(speed);
      const finalHeading = heading !== undefined ? Number(heading) : 0;
      const finalAcc = acc !== undefined ? Boolean(acc) : true;
      const finalTimestamp = tsVal.dateObj ? tsVal.dateObj.toISOString() : undefined;

      const result = await processTelemetryPoint(fastify.db, {
        vehicleId: request.vehicle.id,
        lat,
        lng: finalLng,
        speed: finalSpeed,
        heading: finalHeading,
        timestamp: finalTimestamp,
        acc: finalAcc,
      });

      const broadcaster = fastify.broadcaster || request.server.broadcaster;
      if (broadcaster) {
        broadcaster.broadcastLocation({
          vehicle_id: request.vehicle.id,
          lat,
          lng: finalLng,
          speed_kmh: finalSpeed,
          heading: finalHeading,
          timestamp: finalTimestamp,
          trip_id: result?.trip?.id || null,
          status: finalAcc === false ? 'offline' : 'online',
        });
      }

      return reply.code(200).send({
        success: true,
        data: {
          trip_id: result?.trip?.id || null,
          distance_added_m: result?.distanceAddedM ?? 0,
          trip_total_km: result?.trip?.total_distance_km ? Number(result.trip.total_distance_km) : 0,
          is_valid: result?.isValid ?? true,
        },
      });
    }
  );

  // 2. Batch Telemetry Buffer Flush (POST /batch)
  fastify.post(
    '/batch',
    { preHandler: [verifyDeviceKey] },
    async (request, reply) => {
      const body = request.body || {};
      const { points } = body;

      if (!Array.isArray(points) || points.length === 0 || points.length > 500) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'INVALID_BATCH_SIZE',
            message: 'Batch points must be an array of 1 to 500 items',
          },
        });
      }

      // Validate all points before processing
      for (const pt of points) {
        if (!pt || typeof pt !== 'object') {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'INVALID_COORDINATES',
              message: 'Batch point must be an object',
            },
          });
        }

        const coordVal = validateCoordinates(pt.lat, pt.lng, pt.lon);
        if (!coordVal.valid) {
          return reply.code(400).send({
            success: false,
            error: {
              code: coordVal.code,
              message: coordVal.message,
            },
          });
        }

        const speedVal = validateSpeed(pt.speed);
        if (!speedVal.valid) {
          return reply.code(400).send({
            success: false,
            error: {
              code: speedVal.code,
              message: speedVal.message,
            },
          });
        }

        const tsToValidate = pt.timestamp !== undefined ? pt.timestamp : pt.ts;
        const tsVal = validateTimestamp(tsToValidate);
        if (!tsVal.valid) {
          return reply.code(400).send({
            success: false,
            error: {
              code: tsVal.code,
              message: tsVal.message,
            },
          });
        }
      }

      // Sort points ascending by timestamp (oldest first)
      const sortedPoints = [...points].sort((a, b) => parseTimestampMs(a) - parseTimestampMs(b));

      let totalDistanceAddedM = 0;
      let processedCount = 0;
      let latestTripId = null;

      for (const pt of sortedPoints) {
        const ptLng = pt.lng !== undefined ? pt.lng : pt.lon;
        const ptSpeed = Number(pt.speed);
        const ptHeading = pt.heading !== undefined ? Number(pt.heading) : 0;
        const ptAcc = pt.acc !== undefined ? Boolean(pt.acc) : true;
        const tsVal = validateTimestamp(pt.timestamp !== undefined ? pt.timestamp : pt.ts);
        const ptTimestamp = tsVal.dateObj ? tsVal.dateObj.toISOString() : undefined;

        const result = await processTelemetryPoint(fastify.db, {
          vehicleId: request.vehicle.id,
          lat: pt.lat,
          lng: ptLng,
          speed: ptSpeed,
          heading: ptHeading,
          timestamp: ptTimestamp,
          acc: ptAcc,
        });

        processedCount++;
        totalDistanceAddedM += (result?.distanceAddedM || 0);
        if (result?.trip?.id) {
          latestTripId = result.trip.id;
        }
      }

      return reply.code(200).send({
        success: true,
        data: {
          processed_count: processedCount,
          total_distance_added_km: Number((totalDistanceAddedM / 1000).toFixed(4)),
          latest_trip_id: latestTripId,
        },
      });
    }
  );
}
