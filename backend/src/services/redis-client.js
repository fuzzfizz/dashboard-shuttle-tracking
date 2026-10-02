import Redis from 'ioredis';

/**
 * Creates a Null Redis client (safe no-op implementation for testing and fallback)
 */
export function createNullRedisClient() {
  const dummyClient = {
    publish: async () => 0,
    subscribe: async () => {},
    unsubscribe: async () => {},
    on: () => dummyClient,
    off: () => dummyClient,
    once: () => dummyClient,
    hset: async () => 0,
    hgetall: async () => ({}),
    hget: async () => null,
    scan: async () => ['0', []],
    quit: async () => 'OK',
    disconnect: () => {},
  };

  return {
    pub: dummyClient,
    sub: dummyClient,
    cache: dummyClient,
    isReady: () => false,
    close: async () => {},
  };
}

/**
 * Creates a managed Redis client with pub/sub and cache support.
 * Gracefully handles disconnections and never throws on connection errors.
 *
 * @param {Object} options
 * @param {string} [options.url] Redis connection string
 * @param {Object} [options.logger] Fastify or Pino logger
 * @returns {{ pub: Redis, sub: Redis, cache: Redis, isReady: () => boolean, close: () => Promise<void> }}
 */
export function createRedisClient(options = {}) {
  const { url = 'redis://localhost:6379', logger = null } = options;

  let isPubReady = false;
  let isSubReady = false;

  const defaultOptions = {
    lazyConnect: false,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      // Reconnect with exponential backoff capped at 3s
      return Math.min(times * 200, 3000);
    },
  };

  let pub;
  let sub;

  try {
    pub = new Redis(url, defaultOptions);
    sub = new Redis(url, defaultOptions);
  } catch (err) {
    if (logger?.warn) {
      logger.warn({ err }, 'Failed to initialize Redis clients, falling back to null client');
    }
    return createNullRedisClient();
  }

  // Handle pub events
  pub.on('connect', () => {
    if (logger?.debug) logger.debug('Redis Pub connected');
  });

  pub.on('ready', () => {
    isPubReady = true;
    if (logger?.info) logger.info('Redis Pub client ready');
  });

  pub.on('error', (err) => {
    isPubReady = false;
    if (logger?.warn) {
      logger.warn({ message: err.message }, 'Redis Pub connection error');
    }
  });

  pub.on('close', () => {
    isPubReady = false;
  });

  // Handle sub events
  sub.on('connect', () => {
    if (logger?.debug) logger.debug('Redis Sub connected');
  });

  sub.on('ready', () => {
    isSubReady = true;
    if (logger?.info) logger.info('Redis Sub client ready');
  });

  sub.on('error', (err) => {
    isSubReady = false;
    if (logger?.warn) {
      logger.warn({ message: err.message }, 'Redis Sub connection error');
    }
  });

  sub.on('close', () => {
    isSubReady = false;
  });

  const isReady = () => isPubReady && isSubReady;

  const close = async () => {
    isPubReady = false;
    isSubReady = false;
    try {
      await Promise.allSettled([
        pub.quit().catch(() => pub.disconnect()),
        sub.quit().catch(() => sub.disconnect()),
      ]);
    } catch {
      // Ignore cleanup errors
    }
  };

  return {
    pub,
    sub,
    cache: pub, // semantic alias
    isReady,
    close,
  };
}

export default createRedisClient;
