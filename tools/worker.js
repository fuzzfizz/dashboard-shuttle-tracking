import mqtt from 'mqtt';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const BROKER = process.env.MQTT_BROKER || 'mqtt://broker.emqx.io:1883';
const TOPIC = process.env.MQTT_TOPIC || 'shuttle/fleet/v1/+/telemetry';
const SUPABASE_URL = process.env.SUPABASE_URL;
// RLS requires service_role key to write to tables
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[Worker Error] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be provided in tools/.env');
  console.error('Note: Because Row Level Security (RLS) is enabled, SUPABASE_SERVICE_ROLE_KEY is required for backend write access.');
  console.error('Please create a tools/.env file with:');
  console.error('  SUPABASE_URL=https://<your-project>.supabase.co');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

console.log(`[Worker] Connecting to MQTT broker: ${BROKER}...`);
const client = mqtt.connect(BROKER, {
  clientId: `shuttle_ingest_worker_${Math.random().toString(16).slice(2, 8)}`,
});

// Haversine formula for distance between GPS coordinates in kilometers
function haversineDistance(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 6371 * 2 * Math.atan2(Math.sqrt(Math.min(1, Math.max(0, a))), Math.sqrt(1 - Math.min(1, Math.max(0, a))));
}

// In-memory state tracking per vehicle
const vehicleState = new Map();

client.on('connect', () => {
  console.log(`[Worker] Connected to MQTT broker! Subscribing to: ${TOPIC}`);
  client.subscribe(TOPIC, (err) => {
    if (err) {
      console.error('[Worker] Subscribe error:', err.message);
    } else {
      console.log('[Worker] Ingestion pipeline is active and listening for telemetry.');
    }
  });
});

async function flushVehicle(vehicle_id, state) {
  if (state.isFlushing || state.pendingDistanceKm <= 0) return;

  state.isFlushing = true;
  const distanceToFlush = state.pendingDistanceKm;
  state.pendingDistanceKm = 0;
  state.lastFlushTime = Date.now();
  const today = state.currentDate || new Date().toISOString().split('T')[0];

  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('daily_vehicle_metrics')
      .select('total_distance_km, max_speed_kmh')
      .eq('vehicle_id', vehicle_id)
      .eq('date', today)
      .maybeSingle();

    if (fetchErr) {
      console.error(`[Worker Error] Failed to fetch current metrics for ${vehicle_id}:`, fetchErr.message);
      state.pendingDistanceKm += distanceToFlush;
      return;
    }

    const existingDistance = Number(existing?.total_distance_km) || 0;
    const existingMaxSpeed = Number(existing?.max_speed_kmh) || 0;

    const newTotalDistance = Math.round((existingDistance + distanceToFlush) * 100) / 100;
    const newMaxSpeed = Math.max(existingMaxSpeed, Math.round(state.maxSpeedKmh * 10) / 10);

    const { error: upsertErr } = await supabase.from('daily_vehicle_metrics').upsert({
      vehicle_id,
      date: today,
      total_distance_km: newTotalDistance,
      max_speed_kmh: newMaxSpeed,
      last_updated_at: new Date().toISOString(),
    });

    if (upsertErr) {
      console.error(`[Worker Error] Failed to upsert metrics for ${vehicle_id}:`, upsertErr.message);
      state.pendingDistanceKm += distanceToFlush;
    } else {
      console.log(`[Worker] Updated ${vehicle_id}: +${distanceToFlush.toFixed(3)} km (Total: ${newTotalDistance} km)`);
    }
  } catch (flushErr) {
    console.error(`[Worker Error] Unexpected error during flush for ${vehicle_id}:`, flushErr.message);
    state.pendingDistanceKm += distanceToFlush;
  } finally {
    state.isFlushing = false;
  }
}

async function flushAllVehicles() {
  const promises = [];
  for (const [vehicle_id, state] of vehicleState.entries()) {
    if (state.pendingDistanceKm > 0 && !state.isFlushing) {
      promises.push(flushVehicle(vehicle_id, state));
    }
  }
  await Promise.allSettled(promises);
}

// Background timer to flush idle vehicles every 5 seconds
const flushInterval = setInterval(flushAllVehicles, 5000);

client.on('message', async (_topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    const { vehicle_id, lat, lng, speed, heading, timestamp } = data;

    if (!vehicle_id || typeof lat !== 'number' || typeof lng !== 'number') {
      return;
    }

    const now = Date.now();
    const today = new Date().toISOString().split('T')[0];
    const numericSpeed = typeof speed === 'number' && !isNaN(speed) ? speed : 0;
    const numericHeading = typeof heading === 'number' && !isNaN(heading) ? heading : 0;

    let state = vehicleState.get(vehicle_id);
    if (!state) {
      state = {
        lastLat: lat,
        lastLng: lng,
        lastSpeed: numericSpeed,
        lastTime: timestamp || now,
        lastBreadcrumbTime: now,
        lastBreadcrumbLat: lat,
        lastBreadcrumbLng: lng,
        pendingDistanceKm: 0,
        maxSpeedKmh: numericSpeed,
        lastFlushTime: now,
        isFlushing: false,
        currentDate: today,
      };
      vehicleState.set(vehicle_id, state);
    } else {
      if (state.currentDate !== today) {
        state.currentDate = today;
        state.maxSpeedKmh = numericSpeed;
      }

      const dist = haversineDistance(state.lastLat, state.lastLng, lat, lng);
      const timeElapsedHours = Math.abs((timestamp || now) - state.lastTime) / 3600000;
      const impliedSpeed = timeElapsedHours > 0 ? dist / timeElapsedHours : 0;

      const isJitter = dist < 0.008 && numericSpeed < 1.5;
      const isTeleportGlitch = (timeElapsedHours === 0 && dist > 0.008) || impliedSpeed > 150;

      if (!isJitter && !isTeleportGlitch) {
        state.pendingDistanceKm += dist;
      }

      state.lastLat = lat;
      state.lastLng = lng;
      state.lastSpeed = numericSpeed;
      state.lastTime = timestamp || now;
      state.maxSpeedKmh = Math.max(state.maxSpeedKmh, numericSpeed);
    }

    // Downsampled breadcrumb log: save every 10s or if moved > 20 meters
    const distFromLastBreadcrumb = haversineDistance(state.lastBreadcrumbLat, state.lastBreadcrumbLng, lat, lng);
    if (now - state.lastBreadcrumbTime >= 10000 || distFromLastBreadcrumb >= 0.02) {
      state.lastBreadcrumbTime = now;
      state.lastBreadcrumbLat = lat;
      state.lastBreadcrumbLng = lng;

      supabase
        .from('telemetry_logs')
        .insert({
          vehicle_id,
          lat,
          lng,
          speed: numericSpeed,
          heading: numericHeading,
          recorded_at: new Date(timestamp || now).toISOString(),
        })
        .then(({ error }) => {
          if (error) console.warn(`[Worker] Breadcrumb log error for ${vehicle_id}:`, error.message);
        });
    }

    // Flush if interval exceeded
    if (now - state.lastFlushTime >= 5000 && state.pendingDistanceKm > 0) {
      await flushVehicle(vehicle_id, state);
    }
  } catch (err) {
    console.error('[Worker] Message processing error:', err.message);
  }
});

client.on('error', (err) => {
  console.error('[Worker] MQTT client error:', err.message);
});

// Graceful shutdown with pending flush
let isShuttingDown = false;
const shutdown = async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('\n[Worker] Gracefully shutting down ingestion pipeline...');
  clearInterval(flushInterval);

  try {
    console.log('[Worker] Flushing pending vehicle buffers to Supabase...');
    await flushAllVehicles();
  } catch (err) {
    console.error('[Worker] Error flushing buffers on shutdown:', err.message);
  }

  client.end(false, () => {
    console.log('[Worker] Disconnected from MQTT broker. Goodbye.');
    process.exit(0);
  });

  setTimeout(() => process.exit(0), 2000).unref();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
