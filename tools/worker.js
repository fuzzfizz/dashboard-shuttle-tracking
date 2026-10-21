import mqtt from 'mqtt';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const BROKER = process.env.MQTT_BROKER || 'mqtt://broker.emqx.io:1883';
const TOPIC = process.env.MQTT_TOPIC || 'shuttle/fleet/v1/+/telemetry';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[Worker Error] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) must be provided in tools/.env');
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
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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

client.on('message', async (_topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    const { vehicle_id, lat, lng, speed, timestamp } = data;

    if (!vehicle_id || typeof lat !== 'number' || typeof lng !== 'number') {
      return;
    }

    const now = Date.now();
    const today = new Date().toISOString().split('T')[0];
    const numericSpeed = typeof speed === 'number' ? speed : 0;
    const pointTimestamp = typeof timestamp === 'number' ? timestamp : now;

    let state = vehicleState.get(vehicle_id);
    if (!state) {
      state = {
        lastLat: lat,
        lastLng: lng,
        lastSpeed: numericSpeed,
        lastTime: pointTimestamp,
        pendingDistanceKm: 0,
        maxSpeedKmh: numericSpeed,
        lastFlushTime: now,
      };
      vehicleState.set(vehicle_id, state);
    } else {
      const dist = haversineDistance(state.lastLat, state.lastLng, lat, lng);

      // Filter jitter (< 8m when speed < 1.5 km/h) & teleport (> 150 km/h)
      const elapsedHours = Math.abs(pointTimestamp - state.lastTime) / 3600000;
      const impliedSpeed = elapsedHours > 0 ? dist / elapsedHours : 0;

      if (!(dist < 0.008 && numericSpeed < 1.5) && impliedSpeed <= 150) {
        state.pendingDistanceKm += dist;
      }

      state.lastLat = lat;
      state.lastLng = lng;
      state.lastSpeed = numericSpeed;
      state.lastTime = pointTimestamp;
      state.maxSpeedKmh = Math.max(state.maxSpeedKmh, numericSpeed);
    }

    // Flush batch to Supabase every 5 seconds per vehicle
    if (now - state.lastFlushTime >= 5000 && state.pendingDistanceKm > 0) {
      const distanceToFlush = state.pendingDistanceKm;
      state.pendingDistanceKm = 0;
      state.lastFlushTime = now;

      // Upsert daily metrics
      const { data: existing, error: fetchErr } = await supabase
        .from('daily_vehicle_metrics')
        .select('total_distance_km, max_speed_kmh')
        .eq('vehicle_id', vehicle_id)
        .eq('date', today)
        .maybeSingle();

      if (fetchErr) {
        console.warn(`[Worker] Warning fetching current metrics for ${vehicle_id}:`, fetchErr.message);
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
      } else {
        console.log(`[Worker] Updated ${vehicle_id}: +${distanceToFlush.toFixed(3)} km (Total: ${newTotalDistance} km)`);
      }
    }
  } catch (err) {
    console.error('[Worker] Message processing error:', err.message);
  }
});

client.on('error', (err) => {
  console.error('[Worker] MQTT client error:', err.message);
});
