const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculates the great-circle distance between two geographical points using the Haversine formula.
 *
 * @param {number} lat1 - Latitude of first point in decimal degrees (-90 to 90)
 * @param {number} lon1 - Longitude of first point in decimal degrees (-180 to 180)
 * @param {number} lat2 - Latitude of second point in decimal degrees (-90 to 90)
 * @param {number} lon2 - Longitude of second point in decimal degrees (-180 to 180)
 * @returns {number} Distance in meters
 * @throws {Error} If coordinates are not valid numbers or outside bounds
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  if (
    typeof lat1 !== 'number' ||
    typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' ||
    typeof lon2 !== 'number' ||
    Number.isNaN(lat1) ||
    Number.isNaN(lon1) ||
    Number.isNaN(lat2) ||
    Number.isNaN(lon2)
  ) {
    throw new Error('Invalid coordinate: all arguments must be finite numbers');
  }

  if (lat1 < -90 || lat1 > 90 || lat2 < -90 || lat2 > 90) {
    throw new Error('Invalid coordinate: latitude must be between -90 and 90 degrees');
  }

  if (lon1 < -180 || lon1 > 180 || lon2 < -180 || lon2 > 180) {
    throw new Error('Invalid coordinate: longitude must be between -180 and 180 degrees');
  }

  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;

  const lat1Rad = lat1 * toRad;
  const lat2Rad = lat2 * toRad;

  const sinDLat2 = Math.sin(dLat / 2);
  const sinDLon2 = Math.sin(dLon / 2);

  const a =
    sinDLat2 * sinDLat2 +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * sinDLon2 * sinDLon2;

  // Numerical safeguard against floating point rounding errors beyond 1
  const clampedA = Math.min(1, Math.max(0, a));
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));

  return EARTH_RADIUS_METERS * c;
}
