# Redis Integration Plan

## Goal

Add Redis to the backend stack to provide:
1. **Pub/Sub** for cross-instance WebSocket broadcasting (horizontal scaling)
2. **Live vehicle state cache** for sub-millisecond reads instead of PostgreSQL queries

Redis complements (does not replace) the existing MQTT → PostgreSQL pipeline. MQTT remains the IoT ingestion layer; Redis sits between the backend instances for real-time state distribution.

## Global Constraints

- All 143+ existing backend tests MUST continue to pass
- Redis is **optional**: if Redis is unavailable, the system falls back to in-memory-only behavior (current behavior). No startup crash.
- `ioredis` is the Redis driver (ESM compatible, robust reconnect)
- All new code uses ESM (`import`/`export`)
- Follow existing code patterns in the codebase
- Tests use `node:test` and `node:assert/strict` (or `node:assert`)
- PowerShell on Windows — use `;` not `&&` for command chaining
- Test command: `node --test` from `backend/` directory

## Architecture

```
GPS Device → MQTT Broker → MqttIngestService → processTelemetryPoint()
                                    ↓
                           PostgreSQL (durable store)
                                    ↓
                           BroadcasterService.broadcastLocation()
                                    ↓
                    ┌───────── Redis Pub/Sub ──────────┐
                    ↓               ↓                  ↓
              Instance A       Instance B         Instance C
              (local WS)      (local WS)         (local WS)
                    ↓
              Redis Hash Cache (vehicle:{id}:state)
```

## Tasks

### Task 1: Redis Client Factory & Docker Setup

**Files to create:**
- `backend/src/services/redis-client.js`

**Files to modify:**
- `backend/src/config/env.js` — add `REDIS_URL` config
- `docker-compose.yml` — add Redis 7-alpine service

**Requirements:**

1. Add to `env.js`:
```js
REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
```

2. Create `redis-client.js` that exports a factory function `createRedisClient(options)`:
   - Accepts `{ url, logger }` options
   - Returns `{ pub, sub, cache, isReady() }` where:
     - `pub` = Redis client for publishing and cache writes
     - `sub` = separate Redis client for subscriptions (ioredis requirement: subscriber client can't do other commands)
     - `cache` = alias for `pub` (same client, semantic clarity)
     - `isReady()` = returns boolean for connection status
   - On connection error, log warning and set internal `ready = false`
   - On reconnect, set `ready = true`
   - Export `createRedisClient` and a `createNullRedisClient()` that returns the same interface but does nothing (for tests and fallback)
   - The factory should NOT throw on connection failure

3. Add to `docker-compose.yml`:
```yaml
redis:
  image: redis:7-alpine
  container_name: shuttle-redis
  restart: unless-stopped
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 5s
    timeout: 3s
    retries: 5
```
   - Add `redis_data` to the volumes section
   - Add `redis` to `api` service `depends_on` with `condition: service_healthy`
   - Add `REDIS_URL: redis://redis:6379` to `api` environment

**Tests to create:** `backend/__tests__/redis-client.test.js`
- Test `createNullRedisClient()` returns correct interface
- Test `isReady()` returns false for null client
- Test that null client methods don't throw

**Test command:** `node --test __tests__/redis-client.test.js`

---

### Task 2: BroadcasterService Redis Pub/Sub Integration

**Files to modify:**
- `backend/src/services/broadcaster.js`
- `backend/src/plugins/websocket.js`

**Requirements:**

1. Modify `BroadcasterService` constructor to accept optional `redisClient`:
```js
constructor(redisClient = null)
```
   - Store `this.redis = redisClient`
   - If `redisClient` and `redisClient.isReady()`, subscribe `redisClient.sub` to channel `fleet:broadcast`
   - On message from subscription, parse JSON and call `this._broadcastLocal(event, payload, filterFn)` to send to local WebSocket clients only

2. Split `_broadcast` into two paths:
   - `_broadcast(event, payload, filterFn)` — if Redis is ready, publish `{ event, payload }` to `fleet:broadcast` channel via `redisClient.pub.publish()`. Always also call `_broadcastLocal()` for the current instance's clients.
   - `_broadcastLocal(event, payload, filterFn)` — the current `_broadcast` logic (loop local `this.clients` Set), renamed. This is what Redis subscription handler calls.
   - If Redis is NOT ready, `_broadcast` falls back to `_broadcastLocal` directly (current behavior)

3. Add deduplication: When this instance publishes AND receives its own message back from Redis, it would double-send. Use an `instanceId` (random UUID generated in constructor) included in the published message. When receiving from Redis sub, skip messages with own `instanceId`.

4. Modify `websocket.js` plugin:
   - Accept `redisClient` option or create one
   - Pass it to `new BroadcasterService(redisClient)`
   - On fastify `onClose` hook, disconnect Redis clients

5. Modify `app.js`:
   - Import `createRedisClient` and `createNullRedisClient` from `redis-client.js`
   - If `opts.redis` is provided, use it; else if `config.NODE_ENV !== 'test'`, call `createRedisClient({ url: config.REDIS_URL, logger: app.log })`; else use `createNullRedisClient()`
   - Pass the redis client to websocket plugin registration

**Backward compatibility:** All existing WebSocket tests must pass unchanged because `BroadcasterService` without a `redisClient` argument behaves identically to before.

**Tests to create:** `backend/__tests__/broadcaster-redis.test.js`
- Test BroadcasterService with null redis (existing behavior)
- Test BroadcasterService with mock redis client that captures publish calls
- Test that `_broadcastLocal` sends to local clients
- Test deduplication: messages from own instanceId are skipped
- Test fallback: when `redisClient.isReady()` returns false, falls back to local-only

**Test command:** `node --test __tests__/broadcaster-redis.test.js`

---

### Task 3: Live Vehicle State Cache via Redis Hash

**Files to create:**
- `backend/src/services/vehicle-cache.js`

**Files to modify:**
- `backend/src/services/mqtt-ingest.js` (minor: add cache write after telemetry processing)
- `backend/src/routes/vehicles.js` (GET `/` route: read from cache first)
- `backend/src/app.js` (wire vehicle cache)

**Requirements:**

1. Create `vehicle-cache.js` that exports a `VehicleCache` class:
   - Constructor accepts `{ redisClient, logger }`
   - `async updatePosition(vehicleId, data)` — writes to Redis Hash key `vehicle:${vehicleId}:state` with fields: `lat`, `lng`, `speed`, `heading`, `today_total_km`, `updated_at`. Uses `HSET` with `EX` (expiry) of 86400 seconds (24 hours).
   - `async getAll()` — scans keys matching `vehicle:*:state`, returns array of cached states. Uses `SCAN` (not `KEYS`) for production safety.
   - `async get(vehicleId)` — returns cached state for one vehicle or null
   - All methods are no-ops that return defaults if Redis is not ready

2. Wire into `mqtt-ingest.js`:
   - After `processTelemetryPoint()` succeeds, if `this.vehicleCache` exists, call `vehicleCache.updatePosition(vehicleId, { lat, lng, speed, heading })`. This is a fire-and-forget (don't await, catch errors silently).

3. Wire into `vehicles.js` GET `/`:
   - After the PostgreSQL query, if `fastify.vehicleCache` exists and is ready, enrich each vehicle row with cached `lat`, `lng`, `speed`, `heading` from Redis (overwriting PostgreSQL values if newer). This is an optimization — if cache misses, PostgreSQL data is used as-is.

4. Wire in `app.js`:
   - Create `VehicleCache` instance with the redis client
   - Decorate fastify with `vehicleCache`
   - Pass `vehicleCache` reference to mqtt-ingest service options

**Tests to create:** `backend/__tests__/vehicle-cache.test.js`
- Test `VehicleCache` with mock redis client
- Test `updatePosition` calls HSET correctly
- Test `getAll` returns cached data
- Test `get` returns single vehicle state
- Test graceful fallback when redis not ready

**Test command:** `node --test __tests__/vehicle-cache.test.js`

---

### Task 4: Full Integration Verification

**Requirements:**

1. Run ALL backend tests: `node --test` from `backend/` directory
2. Verify all 143+ tests pass
3. Check that no existing test files were broken
4. Run `npm run build` in frontend to ensure no regressions
5. Commit all changes with message: `feat(backend): integrate Redis for Pub/Sub broadcasting and vehicle state cache`
6. Version bump `backend/package.json` to `1.2.0`

**Test command:** `node --test` from `backend/`

