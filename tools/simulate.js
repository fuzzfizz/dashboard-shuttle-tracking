import mqtt from 'mqtt';

const BROKER = process.env.MQTT_BROKER || 'mqtt://broker.emqx.io:1883';
const BASE_TOPIC = 'shuttle/fleet/v1';

console.log(`Connecting to ${BROKER}...`);
const client = mqtt.connect(BROKER, {
  clientId: `sim_fleet_${Math.random().toString(16).slice(2, 8)}`,
});

// Configure 2 distinct test shuttles in Bangkok
const vehicles = [
  {
    id: 'shuttle-01',
    lat: 13.7563,
    lng: 100.5018,
    speed: 28.0,
    heading: 45.0,
    speedDelta: 3.5,
  },
  {
    id: 'shuttle-02',
    lat: 13.7460,
    lng: 100.5340,
    speed: 18.5,
    heading: 135.0,
    speedDelta: 2.5,
  },
];

client.on('connect', () => {
  console.log(`Connected to broker!`);
  console.log(`Simulating fleet of ${vehicles.length} shuttles:`);
  vehicles.forEach((v) => console.log(` - ${v.id} -> ${BASE_TOPIC}/${v.id}/telemetry`));
  console.log(`Press Ctrl+C to stop simulation.\n`);

  setInterval(() => {
    vehicles.forEach((v) => {
      // Move vehicle smoothly
      v.lat += (Math.random() - 0.48) * 0.0003;
      v.lng += (Math.random() - 0.48) * 0.0003;
      v.speed = Math.max(5.0, Math.min(65.0, v.speed + (Math.random() - 0.5) * v.speedDelta));
      v.heading = (v.heading + (Math.random() - 0.5) * 8.0 + 360) % 360;

      const payload = {
        vehicle_id: v.id,
        lat: parseFloat(v.lat.toFixed(6)),
        lng: parseFloat(v.lng.toFixed(6)),
        speed: parseFloat(v.speed.toFixed(1)),
        heading: parseFloat(v.heading.toFixed(1)),
        timestamp: Date.now(),
      };

      const topic = `${BASE_TOPIC}/${v.id}/telemetry`;
      client.publish(topic, JSON.stringify(payload), { qos: 0 });
      console.log(`[${new Date().toLocaleTimeString()}] ${v.id}: ${payload.lat}, ${payload.lng} | ${payload.speed} km/h`);
    });
  }, 1500);
});

client.on('error', (err) => {
  console.error('MQTT connection error:', err);
});
