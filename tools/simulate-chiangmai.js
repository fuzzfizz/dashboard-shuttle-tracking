import mqtt from 'mqtt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BROKER = process.env.MQTT_BROKER || 'mqtt://broker.emqx.io:1883';
const BASE_TOPIC = process.env.MQTT_TOPIC_BASE || 'shuttle/fleet/v1';
const VEHICLE_ID = process.env.VEHICLE_ID || 'shuttle-cm-01';
const INTERVAL_SEC = parseFloat(process.env.INTERVAL_SEC || '5'); // 5 seconds
const BASE_SPEED_KMH = parseFloat(process.env.SPEED_KMH || '32'); // City cruising speed

// Load verified road coordinates between Central Airport Chiang Mai and Chiang Mai Technical College
const routePath = path.join(__dirname, 'chiangmai_route.json');
const rawCoords = JSON.parse(fs.readFileSync(routePath, 'utf8'));

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
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

// Precompute cumulative distances along the route
// GeoJSON rawCoords format: [lng, lat]
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

// Find coordinate and bearing at a specific distance along the route
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

console.log('='.repeat(70));
console.log('🚌 Chiang Mai Shuttle Telemetry Simulator');
console.log('='.repeat(70));
console.log(`- Vehicle ID:   ${VEHICLE_ID}`);
console.log(`- Route Origin: Central Chiangmai Airport (18.7695, 98.9759)`);
console.log(`- Destination:  Chiang Mai Technical College (18.7928, 98.9835)`);
console.log(`- Distance:     ${(totalRouteMeters / 1000).toFixed(2)} km`);
console.log(`- Interval:     ${INTERVAL_SEC} seconds`);
console.log(`- MQTT Broker:  ${BROKER}`);
console.log(`- Topic:        ${BASE_TOPIC}/${VEHICLE_ID}/telemetry`);
console.log('='.repeat(70));

const client = mqtt.connect(BROKER, {
  clientId: `sim_${VEHICLE_ID}_${Math.random().toString(16).slice(2, 8)}`,
});

let currentDistance = 0;
let isReversing = false;
let pauseTicksRemaining = 0;
let step = 0;

client.on('connect', () => {
  console.log(`\n Connected to MQTT Broker! Beginning simulation (5-second intervals)...\n`);

  // Publish first point immediately
  sendTelemetry();

  // Then schedule at requested 5-second interval
  const timer = setInterval(sendTelemetry, INTERVAL_SEC * 1000);

  function sendTelemetry() {
    step++;

    // Handle pause at destination / origin
    if (pauseTicksRemaining > 0) {
      pauseTicksRemaining--;
      const pos = getPositionAtDistance(isReversing ? 0 : totalRouteMeters);
      const payload = {
        vehicle_id: VEHICLE_ID,
        lat: parseFloat(pos.lat.toFixed(6)),
        lng: parseFloat(pos.lng.toFixed(6)),
        speed: 0.0,
        heading: parseFloat(pos.bearing.toFixed(1)),
        timestamp: Date.now(),
      };
      client.publish(`${BASE_TOPIC}/${VEHICLE_ID}/telemetry`, JSON.stringify(payload));
      console.log(
        `[Step ${step}] 🛑 STOPPED at ${isReversing ? 'Central Airport' : 'Technical College'} (Pause ${pauseTicksRemaining * INTERVAL_SEC}s left)`
      );
      return;
    }

    // Dynamic realistic city speed (between 24 and 38 km/h, with gentle jitter)
    const speedJitter = (Math.random() - 0.5) * 6;
    const speedKmh = Math.max(18.0, Math.min(42.0, BASE_SPEED_KMH + speedJitter));
    const speedMps = (speedKmh * 1000) / 3600;
    const stepMeters = speedMps * INTERVAL_SEC;

    // Advance vehicle position along route
    if (!isReversing) {
      currentDistance += stepMeters;
      if (currentDistance >= totalRouteMeters) {
        currentDistance = totalRouteMeters;
        pauseTicksRemaining = Math.round(30 / INTERVAL_SEC); // Pause 30s at college
        isReversing = true;
        console.log(`\n🎉 [Step ${step}] ARRIVED AT CHIANG MAI TECHNICAL COLLEGE! (Dropping off passengers for 30s)\n`);
      }
    } else {
      currentDistance -= stepMeters;
      if (currentDistance <= 0) {
        currentDistance = 0;
        pauseTicksRemaining = Math.round(30 / INTERVAL_SEC); // Pause 30s at airport
        isReversing = false;
        console.log(`\n🎉 [Step ${step}] RETURNED TO CENTRAL AIRPORT CHIANG MAI! (Waiting for next departure for 30s)\n`);
      }
    }

    const pos = getPositionAtDistance(currentDistance);
    const heading = isReversing ? (pos.bearing + 180) % 360 : pos.bearing;

    const payload = {
      vehicle_id: VEHICLE_ID,
      lat: parseFloat(pos.lat.toFixed(6)),
      lng: parseFloat(pos.lng.toFixed(6)),
      speed: parseFloat(speedKmh.toFixed(1)),
      heading: parseFloat(heading.toFixed(1)),
      timestamp: Date.now(),
    };

    const topic = `${BASE_TOPIC}/${VEHICLE_ID}/telemetry`;
    client.publish(topic, JSON.stringify(payload), { qos: 0 });

    const progressPct = ((currentDistance / totalRouteMeters) * 100).toFixed(1);
    const directionStr = isReversing ? '⬅️ (To Central Airport)' : '➡️ (To Technical College)';
    console.log(
      `[${new Date().toLocaleTimeString()}] Step ${step} | ${VEHICLE_ID} ${directionStr} | ` +
        `Loc: ${payload.lat}, ${payload.lng} | Spd: ${payload.speed} km/h | ` +
        `Heading: ${payload.heading.toString().padStart(5, ' ')}° | Progress: ${progressPct}% (${(currentDistance / 1000).toFixed(2)} / ${(totalRouteMeters / 1000).toFixed(2)} km)`
    );
  }

  process.on('SIGINT', () => {
    console.log('\nStopping simulator cleanly...');
    clearInterval(timer);
    client.end(true, () => {
      console.log('MQTT disconnected. Bye!');
      process.exit(0);
    });
  });
});

client.on('error', (err) => {
  console.error('MQTT connection error:', err.message);
});
