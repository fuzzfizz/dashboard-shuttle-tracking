# Task 5 Brief: Background MQTT Ingestion Worker (tools/worker.js)

## Files:
- Create: `tools/worker.js`
- Modify: `tools/package.json`
- Modify: `tools/README.md`

## Responsibilities:
- Install dependencies in `tools`:
  `npm install @supabase/supabase-js dotenv`
- Connects to MQTT broker (`MQTT_BROKER` or default `mqtt://broker.emqx.io:1883`).
- Subscribes to `MQTT_TOPIC` (default `shuttle/fleet/v1/+/telemetry`).
- Reads Supabase credentials from `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_ANON_KEY`).
  - If missing credentials, outputs clear guidance to create `tools/.env` and exits gracefully or warns.
- Distance calculation & filtering:
  - Haversine distance between consecutive points.
  - Jitter filter: ignore if distance < 0.008 km and speed < 1.5 km/h.
  - Teleport filter: ignore if implied speed > 150 km/h.
- Batch upserting:
  - Batches distance accumulation per vehicle.
  - Upserts to `daily_vehicle_metrics` table in Supabase every 5 seconds per active vehicle.
- Updates `tools/package.json` with `"worker": "node worker.js"` in `scripts`.
- Updates `tools/README.md` explaining how to configure `.env` and run `npm run worker`.

## Global Constraints:
- Clean Node.js ESM script (`"type": "module"` in `tools/package.json`).
- Syntax verification via `node --check tools/worker.js`.
- Clean error handling on connection failure or malformed packets.

## Steps:

### Step 1: Install dependencies in `tools/`
Run: `cd tools && npm install @supabase/supabase-js dotenv`

### Step 2: Implement `tools/worker.js`
Create `tools/worker.js` with:
- Haversine calculation
- In-memory state map for vehicles
- 5-second throttled batch upserts to `daily_vehicle_metrics`
- Clean logs

### Step 3: Update `tools/package.json` and `tools/README.md`
Add `"worker": "node worker.js"` to `scripts` in `tools/package.json`.
Document usage in `tools/README.md`.

### Step 4: Verify syntax and commit
Run: `node --check tools/worker.js`
Commit:
```bash
git add tools/package.json tools/package-lock.json tools/worker.js tools/README.md
git commit -m "feat(tools): add background MQTT ingestion worker for Supabase persistence"
```
