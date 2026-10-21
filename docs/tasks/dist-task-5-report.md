# Task 5 Report: Background MQTT Ingestion Worker (tools/worker.js)

## Execution Summary
- **Status**: Completed successfully (DONE)
- **Files Created / Modified**:
  - `tools/worker.js` (Created)
  - `tools/package.json` (Modified)
  - `tools/package-lock.json` (Modified)
  - `tools/README.md` (Modified)
  - `docs/tasks/dist-task-5-diff.txt` (Generated diff)
- **Commit**: `69c72f0` ("feat(tools): add background MQTT ingestion worker for Supabase persistence")

## Implementation Details
1. **Dependency Installation**:
   - Installed `@supabase/supabase-js` (^2.118.0) and `dotenv` (^18.0.8) into `tools/`.
2. **Background Ingestion Worker (`tools/worker.js`)**:
   - Connects to MQTT broker (`MQTT_BROKER` or default `mqtt://broker.emqx.io:1883`).
   - Subscribes to `MQTT_TOPIC` (default `shuttle/fleet/v1/+/telemetry`).
   - Validates `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` from `tools/.env`; prints clear guidance and exits if missing.
   - Calculates Haversine distance between consecutive GPS telemetry pings.
   - Filters GPS jitter (< 8m when speed < 1.5 km/h) and teleport glitch jumps (> 150 km/h implied speed).
   - Manages in-memory state map per vehicle and batches incremental distance.
   - Upserts aggregated `total_distance_km`, `max_speed_kmh`, and `last_updated_at` to `daily_vehicle_metrics` every 5 seconds per vehicle.
   - Clean error handling for packet decoding and network issues.
3. **Scripts & Documentation**:
   - Added `"worker": "node worker.js"` to `tools/package.json`.
   - Updated `tools/README.md` with complete instructions for setting up `.env`, running the worker, and understanding the filtering & batching logic.

## Verification
- **Syntax Check**: `node --check tools/worker.js` passed with exit code 0.
- **Graceful Error Handling Check**: Executed `node tools/worker.js` without credentials and verified clear instructions to configure `tools/.env` and exit code 1.
- **Frontend Regression Suite**: `npm test -- --run` passed (12/12 test suites, 52/52 tests passing).

---

## Code Review Findings Addressed & Resolved

### 1. [CRITICAL] Prevent Daily Distance Wipeout on Read Failure
- **Issue**: Previously, if `supabase.from('daily_vehicle_metrics').select(...)` errored (`fetchErr`), `existingDistance` was defaulted to `0`, overwriting historical mileage in Supabase on the subsequent upsert.
- **Fix**: When `fetchErr` is returned, the error is logged to `console.error`, uncommitted distance is restored (`state.pendingDistanceKm += distanceToFlush`), and the flush function immediately aborts (`return`), preserving existing database records intact.

### 2. [IMPORTANT] Distance Recovery on Upsert Failure
- **Issue**: If `supabase.from('daily_vehicle_metrics').upsert(...)` failed or threw an exception, `distanceToFlush` was lost permanently from in-memory state.
- **Fix**: Wrapped flush operation in `try...catch`. If `upsertErr` occurs or an exception is thrown, `state.pendingDistanceKm += distanceToFlush` is executed to restore uncommitted distance for the next sync retry.

### 3. [IMPORTANT] Concurrency Lock (`isFlushing`)
- **Issue**: If Supabase queries took longer than the 5-second flush interval, overlapping flush invocations could create race conditions and duplicate distance additions.
- **Fix**: Added `isFlushing: false` to each vehicle's state map entry. Flush is gated behind `!state.isFlushing`. When entering flush, `state.isFlushing = true` is set, and a `try...finally { state.isFlushing = false; }` block guarantees the lock is released after network completion.

### 4. [IMPORTANT] Midnight Rollover for `maxSpeedKmh`
- **Issue**: Without day awareness, yesterday's highest recorded speed persisted in memory into the next calendar day.
- **Fix**: Tracked `currentDate: today` in `vehicleState`. When incoming telemetry crosses midnight (`state.currentDate !== today`), `state.currentDate` updates to `today` and `state.maxSpeedKmh` resets to the current telemetry ping's `numericSpeed`.

### 5. [BONUS/CLEANUP] Graceful Shutdown
- **Issue**: Terminating the worker abruptly could drop MQTT connection state ungracefully.
- **Fix**: Added `SIGINT` (and `SIGTERM`) process signal handlers that invoke `client.end(false)` to disconnect cleanly from the MQTT broker before exiting with code 0 (with a 1.5s fallback safety timer).

### Verification & Commit
- **Syntax Check**: `node --check tools/worker.js` passed (exit code 0).
- **Test Suite**: Vitest suite in `frontend` (12/12 files, 52/52 tests) passing.
- **Commit**: `2838125` ("fix(tools): enhance worker reliability with flush lock, error retry, and date rollover").
- **Final Status**: DONE.

