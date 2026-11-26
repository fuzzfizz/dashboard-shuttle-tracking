import mqtt from 'mqtt';
import { EventEmitter } from 'events';
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
  const primaryBroker = options.broker || process.env.MQTT_BROKER || process.env.VITE_MQTT_BROKER_URL || 'wss://65f2ec1d516f46368f91e15a90eb91a1.s1.eu.hivemq.cloud:8884/mqtt';
  const TOPIC = options.topic || process.env.VITE_MQTT_TOPIC || process.env.MQTT_TOPIC || 'shuttle/+';
  const USERNAME = options.username || process.env.VITE_MQTT_USERNAME || process.env.MQTT_USERNAME;
  const PASSWORD = options.password || process.env.VITE_MQTT_PASSWORD || process.env.MQTT_PASSWORD;
  const SUPABASE_URL = options.supabaseUrl || process.env.SUPABASE_URL;
  const SUPABASE_KEY = options.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  // Build candidate brokers list for automatic transport/port failover
  const candidateBrokers = [];
  if (primaryBroker) candidateBrokers.push(primaryBroker);
  if (!candidateBrokers.includes('wss://65f2ec1d516f46368f91e15a90eb91a1.s1.eu.hivemq.cloud:8884/mqtt')) {
    candidateBrokers.push('wss://65f2ec1d516f46368f91e15a90eb91a1.s1.eu.hivemq.cloud:8884/mqtt');
  }
  if (!candidateBrokers.includes('mqtts://65f2ec1d516f46368f91e15a90eb91a1.s1.eu.hivemq.cloud:8883')) {
    candidateBrokers.push('mqtts://65f2ec1d516f46368f91e15a90eb91a1.s1.eu.hivemq.cloud:8883');
  }
  if (!candidateBrokers.includes('wss://iot.pharmacy.cmu.ac.th:8083/mqtt')) {
    candidateBrokers.push('wss://iot.pharmacy.cmu.ac.th:8083/mqtt');
  }
  if (!candidateBrokers.includes('mqtt://iot.pharmacy.cmu.ac.th:1883')) {
    candidateBrokers.push('mqtt://iot.pharmacy.cmu.ac.th:1883');
  }
  if (!candidateBrokers.includes('wss://broker.emqx.io:8084/mqtt')) {
    candidateBrokers.push('wss://broker.emqx.io:8084/mqtt');
  }

  let supabase = null;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('[Worker Warning] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY not fully provided.');
    console.warn('[Worker Warning] Running in in-memory simulation/telemetry pass-through mode without database persistence.');
  } else {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    });
  }

  // In-memory state tracking per vehicle
  const emitter = new EventEmitter();
  const latestTelemetryMap = new Map();
  const vehicleState = new Map();
  let totalPacketsReceived = 0;
  let connectionStatus = 'connecting';
  let activeBroker = null;
  let lastErrorMessage = null;
  let lastErrorTime = null;
  const brokerErrors = {};
  let currentBrokerIndex = 0;
  let failoverTimer = null;
  let client = null;
  let isShuttingDown = false;

  function connectToBroker(index = 0) {
    if (isShuttingDown) return;
    currentBrokerIndex = index % candidateBrokers.length;
    const brokerUrl = candidateBrokers[currentBrokerIndex];
    const isHiveMQ = brokerUrl.includes('hivemq.cloud');
    const isPharmacy = brokerUrl.includes('pharmacy');
    const username = USERNAME || (isHiveMQ ? 'cmu_phamacy_shuttle' : isPharmacy ? 'pharmacy' : undefined);
    const password = PASSWORD || (isHiveMQ ? 'cmu_phamacy_shuttle' : isPharmacy ? 'pharmacy' : undefined);

    console.log(`[Worker] Connecting to MQTT broker (${currentBrokerIndex + 1}/${candidateBrokers.length}): ${brokerUrl}...`);
    connectionStatus = 'connecting';

    try {
      client = mqtt.connect(brokerUrl, {
        clientId: `shuttle_ingest_worker_${Math.random().toString(16).slice(2, 8)}`,
        connectTimeout: 8000,
        reconnectPeriod: 5000,
        rejectUnauthorized: false, // In case of expired/self-signed SSL certificates on campus brokers
        ...(username ? { username } : {}),
        ...(password ? { password } : {}),
      });
    } catch (e) {
      console.error(`[Worker] Failed to initialize MQTT client for ${brokerUrl}:`, e.message);
      lastErrorMessage = e.message;
      lastErrorTime = new Date().toISOString();
      tryNextBroker();
      return;
    }

    let hasConnected = false;
    clearTimeout(failoverTimer);
    failoverTimer = setTimeout(() => {
      if (!hasConnected && !isShuttingDown) {
        brokerErrors[brokerUrl] = 'Connection timed out after 8s';
        lastErrorMessage = brokerErrors[brokerUrl];
        lastErrorTime = new Date().toISOString();
        console.warn(`[Worker] Connection to ${brokerUrl} timed out after 8s. Attempting failover to next candidate...`);
        tryNextBroker();
      }
    }, 8000);

    client.on('connect', () => {
      hasConnected = true;
      clearTimeout(failoverTimer);
      connectionStatus = 'connected';
      activeBroker = brokerUrl;
      lastErrorMessage = null;
      console.log(`[Worker] Connected to MQTT broker! (${brokerUrl}) Subscribing to: ${TOPIC}`);
      client.subscribe(TOPIC, (err) => {
        if (err) {
          console.error('[Worker] Subscribe error:', err.message);
        } else {
          console.log('[Worker] Ingestion pipeline is active and listening for telemetry.');
        }
      });
    });

    client.on('offline', () => {
      if (connectionStatus === 'connected') {
        connectionStatus = 'offline';
      }
    });

    client.on('error', (err) => {
      brokerErrors[brokerUrl] = err.message;
      lastErrorMessage = err.message;
      lastErrorTime = new Date().toISOString();
      console.error(`[Worker] MQTT client error on ${brokerUrl}:`, err.message);
      if (!hasConnected && candidateBrokers.length > 1) {
        clearTimeout(failoverTimer);
        tryNextBroker();
      } else {
        connectionStatus = 'error';
      }
    });

    client.on('message', handleIncomingMessage);
  }

  function tryNextBroker() {
    if (isShuttingDown) return;
    clearTimeout(failoverTimer);
    if (client) {
      try {
        client.removeAllListeners();
        client.end(true);
      } catch {}
      client = null;
    }
    setTimeout(() => {
      if (!isShuttingDown) {
        connectToBroker(currentBrokerIndex + 1);
      }
    }, 1000);
  }

  // Start connecting to primary candidate
  connectToBroker(0);

  async function flushVehicle(vehicle_id, state) {
    const hasDistance = state.pendingDistanceKm > 0;
    const hasActiveTime = (state.pendingActiveSeconds || 0) >= 30;
    if (!supabase || state.isFlushing || (!hasDistance && !hasActiveTime)) return;

    state.isFlushing = true;
    const distanceToFlush = state.pendingDistanceKm;
    const activeSecondsToFlush = state.pendingActiveSeconds || 0;
    state.pendingDistanceKm = 0;
    state.pendingActiveSeconds = 0;
    state.lastFlushTime = Date.now();
    const today = state.currentDate || getBangkokDate();

    try {
      const { data: existing, error: fetchErr } = await supabase
        .from('daily_vehicle_metrics')
        .select('total_distance_km, max_speed_kmh, active_minutes, avg_speed_kmh')
        .eq('vehicle_id', vehicle_id)
        .eq('date', today)
        .maybeSingle();

      if (fetchErr) {
        console.error(`[Worker Error] Failed to fetch current metrics for ${vehicle_id}:`, fetchErr.message);
        state.pendingDistanceKm += distanceToFlush;
        state.pendingActiveSeconds += activeSecondsToFlush;
        return;
      }

      const existingDistance = Number(existing?.total_distance_km) || 0;
      const existingMaxSpeed = Number(existing?.max_speed_kmh) || 0;
      const existingActiveMinutes = Number(existing?.active_minutes) || 0;

      const newTotalDistance = Math.round((existingDistance + distanceToFlush) * 100) / 100;
      const newMaxSpeed = Math.max(existingMaxSpeed, Math.round(state.maxSpeedKmh * 10) / 10);

      const addedMinutes = Math.floor(activeSecondsToFlush / 60);
      const remainingSeconds = activeSecondsToFlush % 60;
      state.pendingActiveSeconds += remainingSeconds;
      const newActiveMinutes = existingActiveMinutes + addedMinutes;

      const newAvgSpeed = newActiveMinutes > 0 && newTotalDistance > 0
        ? Math.round((newTotalDistance / (newActiveMinutes / 60)) * 10) / 10
        : (Number(existing?.avg_speed_kmh) || 0);

      const { error: upsertErr } = await supabase.from('daily_vehicle_metrics').upsert({
        vehicle_id,
        date: today,
        total_distance_km: newTotalDistance,
        max_speed_kmh: newMaxSpeed,
        avg_speed_kmh: newAvgSpeed,
        active_minutes: newActiveMinutes,
        last_updated_at: new Date().toISOString(),
      });

      if (upsertErr) {
        console.error(`[Worker Error] Failed to upsert metrics for ${vehicle_id}:`, upsertErr.message);
        state.pendingDistanceKm += distanceToFlush;
        state.pendingActiveSeconds += activeSecondsToFlush;
      } else {
        console.log(`[Worker] Updated ${vehicle_id}: +${distanceToFlush.toFixed(3)} km, +${addedMinutes}m active (Total: ${newTotalDistance} km, ${newActiveMinutes} min, Date: ${today})`);
      }
    } catch (flushErr) {
      console.error(`[Worker Error] Unexpected error during flush for ${vehicle_id}:`, flushErr.message);
      state.pendingDistanceKm += distanceToFlush;
      state.pendingActiveSeconds += activeSecondsToFlush;
    } finally {
      state.isFlushing = false;
    }
  }

  async function flushAllVehicles() {
    const promises = [];
    for (const [vehicle_id, state] of vehicleState.entries()) {
      const hasDistance = state.pendingDistanceKm > 0;
      const hasActiveTime = (state.pendingActiveSeconds || 0) >= 30;
      if ((hasDistance || hasActiveTime) && !state.isFlushing) {
        promises.push(flushVehicle(vehicle_id, state));
      }
    }
    await Promise.allSettled(promises);
  }

  // Background timer to flush idle vehicles every 5 seconds
  const flushInterval = setInterval(flushAllVehicles, 5000);

  async function handleIncomingMessage(topicReceived, message) {
    try {
      totalPacketsReceived++;
      const data = JSON.parse(message.toString());
      let vehicle_id = data.vehicle_id;
      if (!vehicle_id && topicReceived) {
        const parts = topicReceived.split('/');
        if (parts[0] === 'shuttle' && parts.length === 2) {
          vehicle_id = parts[1];
        } else if (parts.length >= 4 && parts[parts.length - 1] === 'telemetry') {
          vehicle_id = parts[parts.length - 2];
        }
      }
      const { lat, lng, speed, heading, timestamp } = data;

      if (!vehicle_id || typeof lat !== 'number' || typeof lng !== 'number') {
        return;
      }

      const now = Date.now();
      const today = getBangkokDate(now);
      const numericSpeed = typeof speed === 'number' && !isNaN(speed) ? speed : 0;
      const numericHeading = typeof heading === 'number' && !isNaN(heading) ? heading : 0;
      const payloadTimestamp = typeof timestamp === 'number' && !isNaN(timestamp) ? timestamp : now;

      const currentPayload = {
        vehicle_id,
        lat,
        lng,
        speed: numericSpeed,
        heading: numericHeading,
        timestamp: payloadTimestamp,
      };
      latestTelemetryMap.set(vehicle_id, currentPayload);
      emitter.emit('telemetry', currentPayload);
      if (typeof options.onTelemetry === 'function') {
        try {
          options.onTelemetry(currentPayload);
        } catch (cbErr) {
          console.error('[Worker] onTelemetry callback error:', cbErr.message);
        }
      }

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
          pendingActiveSeconds: 0,
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
          state.pendingActiveSeconds = 0;
        }

        const dist = haversineDistance(state.lastLat, state.lastLng, lat, lng);
        const timeElapsedSec = Math.abs((timestamp || now) - state.lastTime) / 1000;
        const timeElapsedHours = timeElapsedSec / 3600;
        const impliedSpeed = timeElapsedHours > 0 ? dist / timeElapsedHours : 0;

        const isJitter = dist < 0.008 && numericSpeed < 1.5;
        const isTeleportGlitch = (timeElapsedHours === 0 && dist > 0.008) || impliedSpeed > 150;

        if (!isJitter && !isTeleportGlitch) {
          state.pendingDistanceKm += dist;
        }

        // Active running time: vehicle is moving (speed >= 2.0 km/h or dist >= 0.008 km)
        // and time gap between consecutive pings is within 120 seconds
        const isMoving = numericSpeed >= 2.0 || (!isJitter && !isTeleportGlitch && dist >= 0.008);
        if (isMoving && timeElapsedSec > 0 && timeElapsedSec <= 120) {
          state.pendingActiveSeconds = (state.pendingActiveSeconds || 0) + timeElapsedSec;
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
  };

  const getStats = () => ({
    broker: activeBroker || candidateBrokers[currentBrokerIndex],
    activeBroker,
    candidateBrokers,
    brokerErrors,
    topic: TOPIC,
    status: connectionStatus,
    lastError: lastErrorMessage,
    lastErrorTime,
    activeVehicles: vehicleState.size,
    vehicleIds: Array.from(vehicleState.keys()),
    totalPacketsReceived,
    currentBangkokDate: getBangkokDate(),
    supabaseConnected: Boolean(supabase),
  });

  const getFleetSnapshot = () => {
    const snapshot = {};
    for (const [id, data] of latestTelemetryMap.entries()) {
      snapshot[id] = { ...data };
    }
    return snapshot;
  };

  const shutdown = async () => {
    isShuttingDown = true;
    clearTimeout(failoverTimer);
    console.log('\n[Worker] Gracefully shutting down ingestion pipeline...');
    clearInterval(flushInterval);

    try {
      console.log('[Worker] Flushing pending vehicle buffers to Supabase...');
      await flushAllVehicles();
    } catch (err) {
      console.error('[Worker] Error flushing buffers on shutdown:', err.message);
    }

    return new Promise((resolve) => {
      if (client) {
        client.end(false, () => {
          console.log('[Worker] Disconnected from MQTT broker.');
          resolve();
        });
      } else {
        resolve();
      }
    });
  };

  return {
    client,
    shutdown,
    getStats,
    getFleetSnapshot,
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    once: emitter.once.bind(emitter),
    emit: emitter.emit.bind(emitter),
  };
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
