import { haversineDistance } from '../utils/distance.js';
import { isValidPoint } from '../utils/gps-filter.js';
import { getOrCreateActiveTrip, closeActiveTrip } from './trip-service.js';

/**
 * Distance Accumulation & Telemetry Processing Engine
 *
 * Processes incoming GPS telemetry pings:
 * - Checks vehicle ignition (ACC status)
 * - Manages trips (opens/closes active trips)
 * - Computes Haversine distance from previous ping
 * - Applies noise filtering (drift & teleport jump detection)
 * - Persists telemetry point into partitioned gps_points table
 * - Updates trip total distance and points
 * - Updates vehicle live status, coordinates, and timestamp
 *
 * @param {object} dbClient - PostgreSQL database client or pool.
 * @param {object} telemetryData - GPS telemetry payload.
 * @param {string} telemetryData.vehicleId - UUID of the vehicle.
 * @param {number} telemetryData.lat - Latitude (-90 to 90).
 * @param {number} [telemetryData.lng] - Longitude (-180 to 180).
 * @param {number} [telemetryData.lon] - Longitude alias (-180 to 180).
 * @param {number} telemetryData.speed - Speed in km/h.
 * @param {number} [telemetryData.heading=0] - Heading direction in degrees (0-360).
 * @param {string|number|Date} [telemetryData.timestamp] - Device ping timestamp.
 * @param {boolean} [telemetryData.acc=true] - Ignition status (true: ON, false: OFF).
 * @returns {Promise<object>} Processing outcome with trip, distance, validity, and gpsPoint.
 */
export async function processTelemetryPoint(dbClient, telemetryData) {
  if (!telemetryData || typeof telemetryData !== 'object') {
    throw new Error('Invalid telemetryData: payload must be an object');
  }

  const {
    vehicleId,
    speed,
    heading = 0,
    timestamp,
    acc = true
  } = telemetryData;

  const lat = telemetryData.lat;
  const lng = telemetryData.lng !== undefined ? telemetryData.lng : telemetryData.lon;

  // 1. Query vehicle's current state
  const vehicleQuery = `
    SELECT id, last_lat, last_lng, last_speed_kmh, last_heading, last_seen_at, status
    FROM vehicles
    WHERE id = $1;
  `;
  const vehicleRes = await dbClient.query(vehicleQuery, [vehicleId]);

  if (!vehicleRes.rows || vehicleRes.rows.length === 0) {
    throw new Error(`Vehicle with ID ${vehicleId} not found`);
  }

  const vehicle = vehicleRes.rows[0];
  const dateObj = timestamp ? new Date(timestamp) : new Date();
  const formattedTimestamp = !isNaN(dateObj.getTime())
    ? dateObj.toISOString()
    : new Date().toISOString();

  // 2. Handle Ignition OFF (acc === false)
  if (acc === false) {
    const closedTrip = await closeActiveTrip(dbClient, vehicleId, formattedTimestamp, 'acc_off');

    const updateVehicleOffQuery = `
      UPDATE vehicles
      SET last_seen_at = $2,
          status = 'offline'
      WHERE id = $1
      RETURNING *;
    `;
    await dbClient.query(updateVehicleOffQuery, [vehicleId, formattedTimestamp]);

    return {
      trip: closedTrip,
      distanceAddedM: 0,
      isValid: true,
      isAccOff: true
    };
  }

  // 3. Handle Ignition ON (acc === true / default)
  const activeTrip = await getOrCreateActiveTrip(dbClient, vehicleId, formattedTimestamp);

  const hasPrev =
    vehicle.last_lat !== null &&
    vehicle.last_lat !== undefined &&
    vehicle.last_lng !== null &&
    vehicle.last_lng !== undefined;

  let distanceFromPrevM = 0;
  if (hasPrev) {
    distanceFromPrevM = haversineDistance(
      vehicle.last_lat,
      vehicle.last_lng,
      lat,
      lng
    );
  }

  let timeDiffSec = 5;
  if (vehicle.last_seen_at && timestamp) {
    const prevTime = new Date(vehicle.last_seen_at).getTime();
    const currTime = new Date(timestamp).getTime();
    if (!isNaN(prevTime) && !isNaN(currTime)) {
      timeDiffSec = Math.max(0, (currTime - prevTime) / 1000);
    }
  }

  const prevPoint = hasPrev
    ? {
        lat: vehicle.last_lat,
        lng: vehicle.last_lng,
        speed: vehicle.last_speed_kmh
      }
    : null;

  const isValid = isValidPoint({ lat, lng, speed }, prevPoint, timeDiffSec);

  // 4. Insert into gps_points
  const insertPointQuery = `
    INSERT INTO gps_points (
      vehicle_id,
      trip_id,
      lat,
      lng,
      speed_kmh,
      heading,
      distance_from_prev_m,
      device_timestamp,
      server_timestamp,
      is_valid
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)
    RETURNING *;
  `;

  const pointRes = await dbClient.query(insertPointQuery, [
    vehicleId,
    activeTrip.id,
    lat,
    lng,
    speed,
    heading,
    distanceFromPrevM,
    formattedTimestamp,
    isValid
  ]);
  const gpsPoint = pointRes.rows[0];

  // 5. If valid, increment trip distance and points count
  let currentTrip = activeTrip;
  if (isValid) {
    const distanceKm = distanceFromPrevM / 1000;
    const updateTripQuery = `
      UPDATE trips
      SET total_distance_km = total_distance_km + $2,
          total_points = total_points + 1
      WHERE id = $1
      RETURNING *;
    `;
    const updatedTripRes = await dbClient.query(updateTripQuery, [activeTrip.id, distanceKm]);
    currentTrip = updatedTripRes.rows?.[0] || activeTrip;
  }

  // 6. Update vehicle live status and coordinates
  const updateVehicleQuery = `
    UPDATE vehicles
    SET last_lat = $2,
        last_lng = $3,
        last_speed_kmh = $4,
        last_heading = $5,
        last_seen_at = $6,
        status = 'online'
    WHERE id = $1
    RETURNING *;
  `;

  await dbClient.query(updateVehicleQuery, [
    vehicleId,
    lat,
    lng,
    speed,
    heading,
    formattedTimestamp
  ]);

  return {
    trip: currentTrip,
    distanceAddedM: isValid ? distanceFromPrevM : 0,
    isValid,
    gpsPoint
  };
}
