import mqtt from 'mqtt';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// Format YYYY-MM-DD in Asia/Bangkok (UTC+7) timezone
export function getBangkokDate(timestamp = Date.now()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date(timestamp));
}

// Haversine formula for distance between GPS coordinates in kilometers
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 6371 * 2 * Math.atan2(Math.sqrt(Math.min(1, Math.max(0, a))), Math.sqrt(1 - Math.min(1, Math.max(0, a))));
}

export function startWorker(options = {}) {
  const BROKER = options.broker || process.env.MQTT_BROKER || 'mqtt://broker.emqx.io:1883';
  const TOPIC = options.topic || process.env.MQTT_TOPIC || 'shuttle/fleet/v1/+/telemetry';
  const SUPABASE_URL = options.supabaseUrl || process.env.SUPABASE_URL;
  const SUPABASE_KEY = options.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  let supabase = null;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('[Worker Warning] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY not fully provided.');
    console.warn('[Worker Warning] Running in in-memory simulation/telemetry pass-through mode without database persistence.');
  } else {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    });
  }

  console.log(`[Worker] Connecting to MQTT broker: ${BROKER}...`);
  const client = mqtt.connect(BROKER, {
    clientId: `shuttle_ingest_worker_${Math.random().toString(16).slice(2, 8)}`,
  });

  // In-memory state tracking per vehicle
  const vehicleState = new Map();
  let totalPacketsReceived = 0;
  let connectionStatus = 'connecting';

  client.on('connect', () => {
    connectionStatus = 'connected';
    console.log(`[Worker] Connected to MQTT broker! Subscribing to: ${TOPIC}`);
    client.subscribe(TOPIC, (err) => {
      if (err) {
        console.error('[Worker] Subscribe error:', err.message);
      } else {
        console.log('[Worker] Ingestion pipeline is active and listening for telemetry.');
      }
    });
  });

  client.on('offline', () => {
    connectionStatus = 'offline';
  });

  client.on('error', (err) => {
    connectionStatus = 'error';
    console.error('[Worker] MQTT client error:', err.message);
  });

  async function flushVehicle(vehicle_id, state) {
    if (!supabase || state.isFlushing || state.pendingDistanceKm <= 0) return;

    state.isFlushing = true;
    const distanceToFlush = state.pendingDistanceKm;
    state.pendingDistanceKm = 0;
    state.lastFlushTime = Date.now();
    const today = state.currentDate || getBangkokDate();

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
        console.log(`[Worker] Updated ${vehicle_id}: +${distanceToFlush.toFixed(3)} km (Total: ${newTotalDistance} km, Date: ${today})`);
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
      totalPacketsReceived++;
      const data = JSON.parse(message.toString());
      const { vehicle_id, lat, lng, speed, heading, timestamp } = data;

      if (!vehicle_id || typeof lat !== 'number' || typeof lng !== 'number') {
        return;
      }

      const now = Date.now();
      const today = getBangkokDate(now);
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
      if (supabase) {
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
      }

      // Flush if interval exceeded
      if (now - state.lastFlushTime >= 5000 && state.pendingDistanceKm > 0) {
        await flushVehicle(vehicle_id, state);
      }
    } catch (err) {
      console.error('[Worker] Message processing error:', err.message);
    }
  });

  const getStats = () => ({
    broker: BROKER,
    topic: TOPIC,
    status: connectionStatus,
    activeVehicles: vehicleState.size,
    vehicleIds: Array.from(vehicleState.keys()),
    totalPacketsReceived,
    currentBangkokDate: getBangkokDate(),
    supabaseConnected: Boolean(supabase),
  });

  const shutdown = async () => {
    console.log('\n[Worker] Gracefully shutting down ingestion pipeline...');
    clearInterval(flushInterval);

    try {
      console.log('[Worker] Flushing pending vehicle buffers to Supabase...');
      await flushAllVehicles();
    } catch (err) {
      console.error('[Worker] Error flushing buffers on shutdown:', err.message);
    }

    return new Promise((resolve) => {
      client.end(false, () => {
        console.log('[Worker] Disconnected from MQTT broker.');
        resolve();
      });
    });
  };

  return { client, shutdown, getStats };
}

// Auto-run if executed directly as a script
const isMainModule = () => {
  try {
    const currentFile = fileURLToPath(import.meta.url);
    const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : '';
    return currentFile === invokedFile;
  } catch {
    return false;
  }
};

if (isMainModule()) {
  const worker = startWorker();
  const handleExit = async () => {
    await worker.shutdown();
    process.exit(0);
  };
  process.on('SIGINT', handleExit);
  process.on('SIGTERM', handleExit);
}
