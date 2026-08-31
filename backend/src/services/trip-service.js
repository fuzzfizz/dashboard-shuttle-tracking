/**
 * Trip Management Service
 * Handles active trip retrieval, creation, completion, and stale trip cleanup.
 */

/**
 * Retrieves an existing in-progress trip for the vehicle on the given date,
 * or creates a new trip with an incremented trip number.
 *
 * @param {object} dbClient - PostgreSQL database client or pool with query method.
 * @param {string} vehicleId - UUID of the vehicle.
 * @param {string|number|Date} [timestamp] - Timestamp of telemetry point (defaults to now).
 * @returns {Promise<object>} The active or newly created trip object.
 */
export async function getOrCreateActiveTrip(dbClient, vehicleId, timestamp) {
  const dateObj = timestamp ? new Date(timestamp) : new Date();
  const tripDate = !isNaN(dateObj.getTime())
    ? dateObj.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const startedAt = !isNaN(dateObj.getTime())
    ? dateObj.toISOString()
    : new Date().toISOString();

  // 1. Check for active trip for this vehicle today
  const activeTripQuery = `
    SELECT *
    FROM trips
    WHERE vehicle_id = $1
      AND status = 'in_progress'
      AND trip_date = $2::date
    LIMIT 1;
  `;
  const activeTripRes = await dbClient.query(activeTripQuery, [vehicleId, tripDate]);

  if (activeTripRes.rows && activeTripRes.rows.length > 0) {
    return activeTripRes.rows[0];
  }

  // 2. Determine next trip_number for today
  const maxTripQuery = `
    SELECT COALESCE(MAX(trip_number), 0) AS max_trip_number
    FROM trips
    WHERE vehicle_id = $1
      AND trip_date = $2::date;
  `;
  const maxTripRes = await dbClient.query(maxTripQuery, [vehicleId, tripDate]);
  const maxNum = maxTripRes.rows?.[0]?.max_trip_number;
  const nextTripNumber = (parseInt(maxNum, 10) || 0) + 1;

  // 3. Insert new in_progress trip
  const insertTripQuery = `
    INSERT INTO trips (
      vehicle_id,
      trip_number,
      started_at,
      total_distance_km,
      total_points,
      status,
      trip_date
    )
    VALUES ($1, $2, $3, 0, 0, 'in_progress', $4::date)
    RETURNING *;
  `;
  const insertRes = await dbClient.query(insertTripQuery, [
    vehicleId,
    nextTripNumber,
    startedAt,
    tripDate
  ]);

  return insertRes.rows[0];
}

/**
 * Closes an active trip for a vehicle by setting its status to completed and ended_at.
 *
 * @param {object} dbClient - PostgreSQL database client or pool.
 * @param {string} vehicleId - UUID of the vehicle.
 * @param {string|number|Date} [timestamp] - Completion timestamp.
 * @param {string} [reason] - Optional reason for closing (e.g. 'acc_off', 'manual', 'timeout').
 * @returns {Promise<object|null>} The closed trip object or null if no active trip existed.
 */
export async function closeActiveTrip(dbClient, vehicleId, timestamp, reason = 'manual') {
  const dateObj = timestamp ? new Date(timestamp) : new Date();
  const endedAt = !isNaN(dateObj.getTime())
    ? dateObj.toISOString()
    : new Date().toISOString();

  const closeQuery = `
    UPDATE trips
    SET status = 'completed',
        ended_at = $2
    WHERE vehicle_id = $1
      AND status = 'in_progress'
    RETURNING *;
  `;

  const res = await dbClient.query(closeQuery, [vehicleId, endedAt]);
  if (res.rows && res.rows.length > 0) {
    return res.rows[0];
  }

  return null;
}

/**
 * Closes stale active trips where the vehicle's last seen time exceeds maxIdleMinutes.
 *
 * @param {object} dbClient - PostgreSQL database client or pool.
 * @param {number} [maxIdleMinutes=15] - Idle duration threshold in minutes.
 * @returns {Promise<Array<object>>} Array of closed trip objects.
 */
export async function closeStaleTrips(dbClient, maxIdleMinutes = 15) {
  const staleQuery = `
    UPDATE trips t
    SET status = 'completed',
        ended_at = NOW()
    FROM vehicles v
    WHERE t.vehicle_id = v.id
      AND t.status = 'in_progress'
      AND (
        v.last_seen_at < NOW() - ($1 * INTERVAL '1 minute')
        OR (v.last_seen_at IS NULL AND t.started_at < NOW() - ($1 * INTERVAL '1 minute'))
      )
    RETURNING t.*;
  `;

  const res = await dbClient.query(staleQuery, [maxIdleMinutes]);
  return res.rows || [];
}
