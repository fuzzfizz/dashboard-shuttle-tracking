export class VehicleCache {
  /**
   * @param {object} options
   * @param {object} [options.redisClient]
   * @param {object} [options.logger]
   */
  constructor({ redisClient = null, logger = null } = {}) {
    this.redis = redisClient;
    this.logger = logger;
  }

  isReady() {
    return Boolean(this.redis?.isReady?.());
  }

  _getKey(vehicleId) {
    return `vehicle:${vehicleId}:state`;
  }

  /**
   * Update vehicle live state in Redis Hash
   * @param {number|string} vehicleId
   * @param {object} data
   */
  async updatePosition(vehicleId, data = {}) {
    if (!this.isReady() || !this.redis?.cache) return;

    try {
      const key = this._getKey(vehicleId);
      const payload = {
        vehicle_id: String(vehicleId),
        lat: String(data.lat ?? ''),
        lng: String(data.lng ?? data.lon ?? ''),
        speed: String(data.speed ?? data.speed_kmh ?? 0),
        heading: String(data.heading ?? 0),
        today_total_km: String(data.today_total_km ?? 0),
        status: String(data.status ?? 'online'),
        updated_at: data.updated_at || data.timestamp || new Date().toISOString(),
      };

      await this.redis.cache.hset(key, payload);
      if (typeof this.redis.cache.expire === 'function') {
        await this.redis.cache.expire(key, 86400).catch(() => {});
      }
    } catch (err) {
      if (this.logger?.warn) {
        this.logger.warn({ err: err.message, vehicleId }, 'Failed to update vehicle cache');
      }
    }
  }

  /**
   * Get single vehicle state from Redis Hash
   * @param {number|string} vehicleId
   * @returns {Promise<object|null>}
   */
  async get(vehicleId) {
    if (!this.isReady() || !this.redis?.cache) return null;

    try {
      const key = this._getKey(vehicleId);
      const raw = await this.redis.cache.hgetall(key);
      if (!raw || Object.keys(raw).length === 0) return null;

      return {
        vehicle_id: Number(raw.vehicle_id) || Number(vehicleId),
        lat: raw.lat ? parseFloat(raw.lat) : null,
        lng: raw.lng ? parseFloat(raw.lng) : null,
        speed: raw.speed ? parseFloat(raw.speed) : 0,
        heading: raw.heading ? parseFloat(raw.heading) : 0,
        today_total_km: raw.today_total_km ? parseFloat(raw.today_total_km) : 0,
        status: raw.status || 'unknown',
        updated_at: raw.updated_at || null,
      };
    } catch (err) {
      if (this.logger?.warn) {
        this.logger.warn({ err: err.message, vehicleId }, 'Failed to read vehicle from cache');
      }
      return null;
    }
  }

  /**
   * Get all cached vehicle states using SCAN (production safe)
   * @returns {Promise<Array<object>>}
   */
  async getAll() {
    if (!this.isReady() || !this.redis?.cache) return [];

    try {
      let cursor = '0';
      const keys = [];

      do {
        const [nextCursor, matchedKeys] = await this.redis.cache.scan(
          cursor,
          'MATCH',
          'vehicle:*:state',
          'COUNT',
          100
        );
        cursor = nextCursor;
        if (matchedKeys && matchedKeys.length > 0) {
          keys.push(...matchedKeys);
        }
      } while (cursor !== '0');

      if (keys.length === 0) return [];

      const results = [];
      for (const key of keys) {
        const raw = await this.redis.cache.hgetall(key);
        if (raw && Object.keys(raw).length > 0) {
          results.push({
            vehicle_id: Number(raw.vehicle_id),
            lat: raw.lat ? parseFloat(raw.lat) : null,
            lng: raw.lng ? parseFloat(raw.lng) : null,
            speed: raw.speed ? parseFloat(raw.speed) : 0,
            heading: raw.heading ? parseFloat(raw.heading) : 0,
            today_total_km: raw.today_total_km ? parseFloat(raw.today_total_km) : 0,
            status: raw.status || 'unknown',
            updated_at: raw.updated_at || null,
          });
        }
      }

      return results;
    } catch (err) {
      if (this.logger?.warn) {
        this.logger.warn({ err: err.message }, 'Failed to scan vehicle cache');
      }
      return [];
    }
  }

  /**
   * Get all cached vehicles as a Map keyed by vehicleId
   * @returns {Promise<Map<number, object>>}
   */
  async getMap() {
    const list = await this.getAll();
    const map = new Map();
    for (const item of list) {
      if (item.vehicle_id) {
        map.set(Number(item.vehicle_id), item);
      }
    }
    return map;
  }
}

export default VehicleCache;
