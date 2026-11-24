/**
 * Dynamic Road Route Telemetry Simulator
 * Simulates a shuttle vehicle travelling along the real primary road route
 * between pickup and dropoff points using Mapbox or OSRM route geometry.
 *
 * Usage:
 *   node tools/simulate-trip.js [options]
 *
 * Options:
 *   --vehicle=<id>         Vehicle ID (default: shuttle-test-01)
 *   --pickup=<lat,lng>     Pickup coordinate (default: 18.790033, 98.965539)
 *   --dropoff=<lat,lng>    Dropoff coordinate (default: 18.723997, 98.983808)
 *   --speed=<kmh>          Base speed in km/h (default: 45)
 *   --speed-mult=<mult>    Speed multiplier for faster demonstration (default: 1.0)
 *   --interval=<seconds>   Telemetry interval in seconds (default: 5.0)
 *   --broker=<url>         MQTT Broker URL (default: mqtt://broker.emqx.io:1883)
 *   --loop                 Loop back after reaching destination (default: true)
 */

import mqtt from 'mqtt';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables if available
dotenv.config();
const toolsEnv = path.join(__dirname, '.env');
if (fs.existsSync(toolsEnv)) {
  dotenv.config({ path: toolsEnv });
}
const frontendEnv = path.join(__dirname, '..', 'frontend', '.env');
if (fs.existsSync(frontendEnv)) {
  dotenv.config({ path: frontendEnv });
}

// Helper: Parse CLI Arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    vehicleId: 'shuttle-test-01',
    pickup: { lat: 18.790033028824645, lng: 98.96553891726919 },
    dropoff: { lat: 18.7239969760301, lng: 98.98380842699336 },
    speedKmh: 45,
    speedMult: 1.0,
    intervalSec: 5.0,
    dropoffDwellSec: 60.0, // Dwell 1 minute (60s) at dropoff for passenger drop-off
    pickupDwellSec: 15.0,
    broker: process.env.MQTT_BROKER || process.env.VITE_MQTT_BROKER_URL || 'mqtt://localhost:1883',
    topicBase: process.env.VITE_MQTT_TOPIC_BASE || process.env.MQTT_TOPIC_BASE || 'shuttle',
    username: process.env.VITE_MQTT_USERNAME || process.env.MQTT_USERNAME,
    password: process.env.VITE_MQTT_PASSWORD || process.env.MQTT_PASSWORD,
    loop: true,
    mapboxToken: process.env.MAPBOX_TOKEN || process.env.VITE_MAPBOX_TOKEN || '',
  };

  for (const arg of args) {
    if (arg.startsWith('--vehicle=')) {
      config.vehicleId = arg.split('=')[1].trim();
    } else if (arg.startsWith('--pickup=')) {
      const parts = arg.split('=')[1].split(',').map((s) => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        config.pickup = { lat: parts[0], lng: parts[1] };
      }
    } else if (arg.startsWith('--dropoff=')) {
      const parts = arg.split('=')[1].split(',').map((s) => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        config.dropoff = { lat: parts[0], lng: parts[1] };
      }
    } else if (arg.startsWith('--speed=')) {
      config.speedKmh = parseFloat(arg.split('=')[1]) || config.speedKmh;
    } else if (arg.startsWith('--speed-mult=')) {
      config.speedMult = parseFloat(arg.split('=')[1]) || config.speedMult;
    } else if (arg.startsWith('--interval=')) {
      config.intervalSec = parseFloat(arg.split('=')[1]) || config.intervalSec;
    } else if (arg.startsWith('--dropoff-dwell=')) {
      config.dropoffDwellSec = parseFloat(arg.split('=')[1]) || config.dropoffDwellSec;
    } else if (arg.startsWith('--pickup-dwell=')) {
      config.pickupDwellSec = parseFloat(arg.split('=')[1]) || config.pickupDwellSec;
    } else if (arg.startsWith('--broker=')) {
      config.broker = arg.split('=')[1].trim();
    } else if (arg === '--no-loop') {
      config.loop = false;
    } else if (arg.startsWith('--token=')) {
      config.mapboxToken = arg.split('=')[1].trim();
    }
  }

  return config;
}

// Helper: Haversine distance in meters
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Helper: Bearing calculation in degrees (0 - 360)
function calculateBearing(lat1, lon1, lat2, lon2) {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(dLon);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

// Fetch primary road route from Mapbox or OSRM
async function fetchPrimaryRoute(pickup, dropoff, mapboxToken) {
  // Try Mapbox Directions API if token provided
  if (mapboxToken && mapboxToken.startsWith('pk.')) {
    try {
      console.log('📍 Requesting primary route from Mapbox Directions API (driving-traffic)...');
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}?geometries=geojson&overview=full&access_token=${mapboxToken}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.routes && json.routes.length > 0) {
          console.log('✅ Received primary route from Mapbox.');
          return {
            source: 'Mapbox Directions API',
            coordinates: json.routes[0].geometry.coordinates,
            distanceMeters: json.routes[0].distance,
            durationSeconds: json.routes[0].duration,
          };
        }
      }
    } catch (err) {
      console.warn('⚠️ Mapbox fetch failed, falling back to OSRM:', err.message);
    }
  }

  // Fallback to OSRM primary driving route
  console.log('📍 Requesting primary route from OSRM Driving Engine...');
  const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}?overview=full&geometries=geojson`;
  const res = await fetch(osrmUrl);
  if (!res.ok) {
    throw new Error(`OSRM API responded with status ${res.status}: ${res.statusText}`);
  }
  const json = await res.json();
  if (!json.routes || json.routes.length === 0) {
    throw new Error('No route found between coordinates');
  }

  console.log('✅ Received primary route from OSRM.');
  return {
    source: 'OSRM Driving Engine',
    coordinates: json.routes[0].geometry.coordinates,
    distanceMeters: json.routes[0].distance,
    durationSeconds: json.routes[0].duration,
  };
}

async function runSimulation() {
  const config = parseArgs();

  console.log('='.repeat(75));
  console.log('🚌 Shuttle Vehicle Trip Simulator (Real Road Navigation)');
  console.log('='.repeat(75));
  console.log(`- Vehicle ID:   ${config.vehicleId}`);
  console.log(`- Pickup:       ${config.pickup.lat.toFixed(6)}, ${config.pickup.lng.toFixed(6)}`);
  console.log(`- Dropoff:      ${config.dropoff.lat.toFixed(6)}, ${config.dropoff.lng.toFixed(6)}`);
  console.log(`- Base Speed:   ${config.speedKmh} km/h (x${config.speedMult} multiplier)`);
  console.log(`- Interval:     ${config.intervalSec} seconds`);
  console.log(`- MQTT Broker:  ${config.broker}`);
  console.log(`- Telemetry:    ${config.topicBase}/${config.vehicleId}/telemetry`);
  console.log('='.repeat(75));

  // 1. Fetch Primary Route
  const routeData = await fetchPrimaryRoute(config.pickup, config.dropoff, config.mapboxToken);
  const rawCoords = routeData.coordinates; // [ [lng, lat], ... ]

  console.log(`- Routing:      ${routeData.source}`);
  console.log(`- Total Dist:   ${(routeData.distanceMeters / 1000).toFixed(2)} km`);
  console.log(`- Road Points:  ${rawCoords.length} coordinates`);
  console.log('='.repeat(75));

  // 2. Precompute segment lengths and bearings
  const segments = [];
  let totalRouteMeters = 0;

  for (let i = 0; i < rawCoords.length - 1; i++) {
    const [lng1, lat1] = rawCoords[i];
    const [lng2, lat2] = rawCoords[i + 1];
    const dist = haversineMeters(lat1, lng1, lat2, lng2);
    const bearing = calculateBearing(lat1, lng1, lat2, lng2);

    segments.push({
      from: { lat: lat1, lng: lng1 },
      to: { lat: lat2, lng: lng2 },
      distance: dist,
      startDist: totalRouteMeters,
      endDist: totalRouteMeters + dist,
      bearing,
    });

    totalRouteMeters += dist;
  }

  function getPositionAtDistance(distMeters) {
    const clampedDist = Math.max(0, Math.min(totalRouteMeters, distMeters));
    for (const seg of segments) {
      if (clampedDist >= seg.startDist && clampedDist <= seg.endDist) {
        const segRatio = seg.distance > 0 ? (clampedDist - seg.startDist) / seg.distance : 0;
        return {
          lat: seg.from.lat + (seg.to.lat - seg.from.lat) * segRatio,
          lng: seg.from.lng + (seg.to.lng - seg.from.lng) * segRatio,
          bearing: seg.bearing,
        };
      }
    }
    const last = segments[segments.length - 1];
    return { lat: last.to.lat, lng: last.to.lng, bearing: last.bearing };
  }

  // 3. Connect to MQTT Broker
  console.log(`\nConnecting to MQTT Broker (${config.broker})...`);
  const client = mqtt.connect(config.broker, {
    clientId: `sim_${config.vehicleId}_${Math.random().toString(16).slice(2, 8)}`,
    clean: true,
    ...(config.username ? { username: config.username } : {}),
    ...(config.password ? { password: config.password } : {}),
  });

  let currentDistance = 0;
  let isReversing = false;
  let pauseTicksRemaining = 0;
  let step = 0;

  client.on('connect', () => {
    console.log(`🚀 Connected! Starting vehicle ${config.vehicleId} simulation along primary route...\n`);

    // Publish first point immediately at pickup
    sendTelemetry();

    // Schedule regular telemetry updates
    const timer = setInterval(sendTelemetry, config.intervalSec * 1000);

    function sendTelemetry() {
      step++;

      // Handle pause at destination or origin
      if (pauseTicksRemaining > 0) {
        pauseTicksRemaining--;
        const pos = getPositionAtDistance(isReversing ? totalRouteMeters : 0);
        const payload = {
          vehicle_id: config.vehicleId,
          lat: parseFloat(pos.lat.toFixed(6)),
          lng: parseFloat(pos.lng.toFixed(6)),
          speed: 0.0,
          heading: parseFloat(pos.bearing.toFixed(1)),
          timestamp: Date.now(),
        };

        const topic = config.topicBase.includes('v1')
          ? `${config.topicBase}/${config.vehicleId}/telemetry`
          : `${config.topicBase}/${config.vehicleId}`;
        client.publish(topic, JSON.stringify(payload), { qos: 0 });

        const locationLabel = isReversing
          ? '🏁 DROPOFF (Passenger Drop-off / จอดส่งคน)'
          : '🏁 PICKUP (Origin / จอดรอรับคน)';
        console.log(
          `[Step ${step}] 🛑 DWELLING at ${locationLabel} | Speed: 0.0 km/h | Resuming in ${pauseTicksRemaining * config.intervalSec}s`
        );
        return;
      }

      // Dynamic realistic speed with slight jitter
      const speedJitter = (Math.random() - 0.5) * 4.0;
      const effectiveSpeed = Math.max(20.0, (config.speedKmh + speedJitter) * config.speedMult);
      const speedMps = (effectiveSpeed * 1000) / 3600;
      const stepMeters = speedMps * config.intervalSec;

      // Advance along route
      if (!isReversing) {
        currentDistance += stepMeters;
        if (currentDistance >= totalRouteMeters) {
          currentDistance = totalRouteMeters;
          if (config.loop) {
            pauseTicksRemaining = Math.round(config.dropoffDwellSec / config.intervalSec); // Dwell at dropoff
            isReversing = true;
          } else {
            console.log(`\n🎉 [Step ${step}] ARRIVED AT DROPOFF! Simulation complete.\n`);
            clearInterval(timer);
            client.end();
            return;
          }
        }
      } else {
        currentDistance -= stepMeters;
        if (currentDistance <= 0) {
          currentDistance = 0;
          pauseTicksRemaining = Math.round(config.pickupDwellSec / config.intervalSec); // Dwell at pickup
          isReversing = false;
        }
      }

      const pos = getPositionAtDistance(currentDistance);
      const displaySpeed = isReversing ? effectiveSpeed : effectiveSpeed;
      const displayHeading = isReversing ? (pos.bearing + 180) % 360 : pos.bearing;

      const payload = {
        vehicle_id: config.vehicleId,
        lat: parseFloat(pos.lat.toFixed(6)),
        lng: parseFloat(pos.lng.toFixed(6)),
        speed: parseFloat(displaySpeed.toFixed(1)),
        heading: parseFloat(displayHeading.toFixed(1)),
        timestamp: Date.now(),
      };

      const topic = config.topicBase.includes('v1')
        ? `${config.topicBase}/${config.vehicleId}/telemetry`
        : `${config.topicBase}/${config.vehicleId}`;
      client.publish(topic, JSON.stringify(payload), { qos: 0 });

      const progressPct = ((currentDistance / totalRouteMeters) * 100).toFixed(1);
      const distKm = (currentDistance / 1000).toFixed(2);
      const totalKm = (totalRouteMeters / 1000).toFixed(2);
      const directionStr = isReversing ? '⬅ Returning to Pickup' : '➡ Heading to Dropoff';

      console.log(
        `[Step ${step}] 🚌 ${config.vehicleId}: ${payload.lat}, ${payload.lng} | ${payload.speed} km/h | ` +
          `Progress: ${distKm}/${totalKm} km (${progressPct}%) | Head: ${payload.heading}° | ${directionStr}`
      );
    }
  });

  client.on('error', (err) => {
    console.error('MQTT error:', err.message);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nStopping simulation gracefully...');
    client.end();
    process.exit(0);
  });
}

runSimulation().catch((err) => {
  console.error('Fatal simulation error:', err);
  process.exit(1);
});
