import mqtt from 'mqtt';

const BROKER = process.env.MQTT_BROKER || 'mqtt://broker.emqx.io:1883';
const VEHICLE_ID = process.env.VEHICLE_ID || 'shuttle-01';
const TOPIC = process.env.MQTT_TOPIC || `shuttle/fleet/v1/${VEHICLE_ID}/telemetry`;

console.log(`Connecting to ${BROKER}...`);
const client = mqtt.connect(BROKER, {
  clientId: `sim_hardware_${Math.random().toString(16).slice(2, 8)}`,
});

// Starting coordinates (Bangkok demo route)
let lat = 13.7563;
let lng = 100.5018;
let speed = 25.0;
let heading = 45.0;

client.on('connect', () => {
  console.log(`Connected to broker! Publishing to topic: ${TOPIC}`);
  console.log(`Press Ctrl+C to stop simulation.\n`);

  setInterval(() => {
    // Simulate slight movement
    lat += (Math.random() - 0.45) * 0.0003;
    lng += (Math.random() - 0.45) * 0.0003;
    speed = Math.max(5.0, Math.min(60.0, speed + (Math.random() - 0.5) * 4.0));
    heading = (heading + (Math.random() - 0.5) * 10.0 + 360) % 360;

    const payload = {
      vehicle_id: VEHICLE_ID,
      lat: parseFloat(lat.toFixed(6)),
      lng: parseFloat(lng.toFixed(6)),
      speed: parseFloat(speed.toFixed(1)),
      heading: parseFloat(heading.toFixed(1)),
      timestamp: Date.now(),
    };

    client.publish(TOPIC, JSON.stringify(payload), { qos: 0 }, (err) => {
      if (err) {
        console.error('Publish error:', err);
      } else {
        console.log(`[${new Date().toLocaleTimeString()}] Sent: Lat=${payload.lat}, Lng=${payload.lng}, Speed=${payload.speed} km/h`);
      }
    });
  }, 1500);
});

client.on('error', (err) => {
  console.error('MQTT connection error:', err);
});
