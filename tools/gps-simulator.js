import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mqtt from 'mqtt';
import util from 'node:util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pre-configured vehicles
export const SEED_VEHICLES = [
  { id: 'd0000000-0000-0000-0000-000000000001', plate_number: '\u0E01\u0E02-1234', device_api_key: 'dev_key_v01_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6' },
  { id: 'd0000000-0000-0000-0000-000000000002', plate_number: '\u0E02\u0E04-5678', device_api_key: 'dev_key_v02_q1w2e3r4t5y6u7i8o9p0a1s2d3f4g5h6' }
];

export function toRadians(degrees) {
  return degrees * Math.PI / 180;
}

export function toDegrees(radians) {
  return radians * 180 / Math.PI;
}

export function calculateBearing(lat1, lon1, lat2, lon2) {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const lambda1 = toRadians(lon1);
  const lambda2 = toRadians(lon2);

  const y = Math.sin(lambda2 - lambda1) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambda2 - lambda1);
  const theta = Math.atan2(y, x);
  return (toDegrees(theta) + 360) % 360;
}

// Distance in meters using Haversine
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lon2 - lon1);

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function interpolateRoute(state, stepDistance) {
  let { segmentIndex, routeCoordinates } = state;
  let remainingDistance = stepDistance;
  let currentLon = routeCoordinates[segmentIndex][0];
  let currentLat = routeCoordinates[segmentIndex][1];

  let nextLon = routeCoordinates[segmentIndex + 1][0];
  let nextLat = routeCoordinates[segmentIndex + 1][1];

  let segmentDist = calculateDistance(currentLat, currentLon, nextLat, nextLon);
  let distToNext = segmentDist - state.segmentProgress;

  if (distToNext > remainingDistance) {
    // Interpolate within current segment
    const fraction = (state.segmentProgress + remainingDistance) / segmentDist;
    const interpLon = currentLon + (nextLon - currentLon) * fraction;
    const interpLat = currentLat + (nextLat - currentLat) * fraction;
    
    return {
      segmentIndex,
      segmentProgress: state.segmentProgress + remainingDistance,
      routeCoordinates,
      lat: interpLat,
      lng: interpLon,
      heading: calculateBearing(currentLat, currentLon, nextLat, nextLon),
      reachedEnd: false
    };
  } else {
    // Move to next segment
    remainingDistance -= distToNext;
    segmentIndex++;
    
    while (segmentIndex < routeCoordinates.length - 1) {
      currentLon = routeCoordinates[segmentIndex][0];
      currentLat = routeCoordinates[segmentIndex][1];
      nextLon = routeCoordinates[segmentIndex + 1][0];
      nextLat = routeCoordinates[segmentIndex + 1][1];
      
      segmentDist = calculateDistance(currentLat, currentLon, nextLat, nextLon);
      
      if (segmentDist > remainingDistance) {
        const fraction = remainingDistance / segmentDist;
        const interpLon = currentLon + (nextLon - currentLon) * fraction;
        const interpLat = currentLat + (nextLat - currentLat) * fraction;
        return {
          segmentIndex,
          segmentProgress: remainingDistance,
          routeCoordinates,
          lat: interpLat,
          lng: interpLon,
          heading: calculateBearing(currentLat, currentLon, nextLat, nextLon),
          reachedEnd: false
        };
      }
      
      remainingDistance -= segmentDist;
      segmentIndex++;
    }
    
    // Reached the end
    const lastCoord = routeCoordinates[routeCoordinates.length - 1];
    return {
      segmentIndex: 0,
      segmentProgress: 0,
      routeCoordinates,
      lat: lastCoord[1],
      lng: lastCoord[0],
      heading: 0,
      reachedEnd: true
    };
  }
}

export function buildTelemetry({ lat, lng, speed, heading, acc = true }) {
  return {
    lat,
    lng,
    speed,
    heading,
    timestamp: new Date().toISOString(),
    acc
  };
}

export function handleCommand(deviceState, command) {
  if (command.type === 'set_interval') {
    deviceState.interval = command.payload.interval;
  } else if (command.type === 'reboot') {
    deviceState.status = 'rebooting';
  } else if (command.type === 'check_ota') {
    deviceState.otaCheck = true;
  }
  return deviceState;
}

export class Simulator {
  constructor(options) {
    this.count = options.count || 2;
    this.protocol = options.protocol || 'mqtt';
    this.brokerUrl = options.brokerUrl || process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
    this.apiUrl = options.apiUrl || 'http://localhost:3000/api/v1';
    this.interval = options.interval || 1000;
    this.speed = options.speed || 30; // km/h
    this.jitter = options.jitter !== false;
    
    this.vehicles = [];
    this.timers = {};
    
    this.mqttClient = null;
    
    // load routes
    const routesData = JSON.parse(fs.readFileSync(path.join(__dirname, 'routes-sample.geojson'), 'utf8'));
    this.routes = routesData.features.map(f => ({
      coordinates: f.geometry.coordinates,
      stops: f.properties.stops || []
    }));
  }

  async start() {
    console.log(`Starting simulator for ${this.count} vehicles via ${this.protocol}`);
    
    for (let i = 0; i < this.count; i++) {
      let seed = SEED_VEHICLES[i];
      if (!seed) {
        seed = {
          id: `d0000000-0000-0000-0000-0000000000${(i + 1).toString().padStart(2, '0')}`,
          plate_number: `SIM-${i + 1}`,
          device_api_key: `dev_key_sim_${i + 1}`
        };
      }
      
      const routeIndex = i % this.routes.length;
      const routeDef = this.routes[routeIndex];
      
      this.vehicles.push({
        ...seed,
        client: null,
        state: {
          interval: this.interval,
          status: 'online',
          segmentIndex: 0,
          segmentProgress: 0,
          routeCoordinates: routeDef.coordinates,
          stops: routeDef.stops,
          lat: routeDef.coordinates[0][1],
          lng: routeDef.coordinates[0][0],
          heading: 0,
          speed: this.speed,
          stopWaitMs: 0,
          lastVisitedStop: null
        }
      });
    }

    if (this.protocol === 'mqtt') {
      this.vehicles.forEach(v => {
        v.client = mqtt.connect(this.brokerUrl, {
          will: {
            topic: `vehicles/${v.id}/status`,
            payload: JSON.stringify({ status: 'offline', timestamp: new Date().toISOString() }),
            qos: 1,
            retain: false
          }
        });
        
        v.client.on('connect', () => {
          console.log(`Vehicle ${v.id} connected to MQTT Broker`);
          v.client.subscribe(`vehicles/${v.id}/command`);
          v.client.publish(`vehicles/${v.id}/status`, JSON.stringify({ status: 'online', timestamp: new Date().toISOString() }), { retain: true });
        });
        
        v.client.on('message', (topic, message) => {
          const parts = topic.split('/');
          if (parts[0] === 'vehicles' && parts[2] === 'command') {
            const cmd = JSON.parse(message.toString());
            handleCommand(v.state, cmd);
            console.log(`Vehicle ${v.id} handled command:`, cmd);
            
            if (cmd.type === 'check_ota') {
              v.client.publish(`vehicles/${v.id}/response`, JSON.stringify({
                command_id: cmd.id,
                status: 'success',
                message: 'No OTA available'
              }));
            }
          }
        });
      });
    }
    
    this.vehicles.forEach(v => {
      this.scheduleNextTick(v);
    });
    
    // graceful shutdown
    process.on('SIGINT', this.stop.bind(this));
    process.on('SIGTERM', this.stop.bind(this));
  }
  
  scheduleNextTick(vehicle) {
    if (vehicle.state.status === 'rebooting') {
      console.log(`Vehicle ${vehicle.id} rebooting...`);
      vehicle.state.status = 'offline';
      if (this.protocol === 'mqtt' && vehicle.client) {
        vehicle.client.publish(`vehicles/${vehicle.id}/status`, JSON.stringify({ status: 'offline' }));
      }
      setTimeout(() => {
        vehicle.state.status = 'online';
        if (this.protocol === 'mqtt' && vehicle.client) {
          vehicle.client.publish(`vehicles/${vehicle.id}/status`, JSON.stringify({ status: 'online', timestamp: new Date().toISOString() }));
        }
        this.scheduleNextTick(vehicle);
      }, 2000);
      return;
    }
    
    this.timers[vehicle.id] = setTimeout(() => {
      this.tick(vehicle);
    }, vehicle.state.interval);
  }
  
  async tick(vehicle) {
    if (vehicle.state.stopWaitMs > 0) {
      vehicle.state.stopWaitMs -= vehicle.state.interval;
      vehicle.state.speed = 0;
    } else {
      vehicle.state.speed = this.speed;
      const stepDistanceMeters = (vehicle.state.speed / 3.6) * (vehicle.state.interval / 1000);
      
      const nextState = interpolateRoute(vehicle.state, stepDistanceMeters);
      vehicle.state.lat = nextState.lat;
      vehicle.state.lng = nextState.lng;
      vehicle.state.heading = nextState.heading;
      vehicle.state.segmentIndex = nextState.segmentIndex;
      vehicle.state.segmentProgress = nextState.segmentProgress;
      
      if (this.jitter) {
        // Add tiny jitter
        vehicle.state.lat += (Math.random() - 0.5) * 0.00001;
        vehicle.state.lng += (Math.random() - 0.5) * 0.00001;
      }
      
      if (nextState.reachedEnd) {
        vehicle.state.stopWaitMs = 5000; // stop for 5s at end before looping
        vehicle.state.lastVisitedStop = null;
      } else {
        const stopProx = vehicle.state.stops.find(s => {
          return vehicle.state.lastVisitedStop !== s.name &&
                 calculateDistance(vehicle.state.lat, vehicle.state.lng, s.lat, s.lng) <= 50;
        });
        if (stopProx) {
          vehicle.state.stopWaitMs = 5000;
          vehicle.state.lastVisitedStop = stopProx.name;
        } else if (Math.random() < 0.05) {
          // random stops
          vehicle.state.stopWaitMs = 2000;
        }
      }
    }
    
    const telemetry = buildTelemetry(vehicle.state);
    
    if (this.protocol === 'mqtt' && vehicle.client) {
      vehicle.client.publish(`vehicles/${vehicle.id}/telemetry`, JSON.stringify(telemetry));
    } else if (this.protocol === 'http') {
      try {
        await fetch(`${this.apiUrl}/telemetry`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Device-Key': vehicle.device_api_key
          },
          body: JSON.stringify(telemetry)
        });
      } catch (err) {
        console.error(`HTTP publish error for ${vehicle.id}:`, err.message);
      }
    }
    
    if (vehicle.state.status === 'online') {
      this.scheduleNextTick(vehicle);
    }
  }

  stop() {
    console.log('\nShutting down simulator...');
    for (const id in this.timers) {
      clearTimeout(this.timers[id]);
    }
    if (this.protocol === 'mqtt') {
      this.vehicles.forEach(v => {
        if (v.client) {
          v.client.publish(`vehicles/${v.id}/status`, JSON.stringify({ status: 'offline' }));
        }
      });
      setTimeout(() => {
        this.vehicles.forEach(v => {
          if (v.client) v.client.end();
        });
        process.exit(0);
      }, 500);
    } else {
      process.exit(0);
    }
  }
}

// CLI entry point
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = util.parseArgs({
    options: {
      count: { type: 'string', short: 'n' },
      protocol: { type: 'string', short: 'p' },
      broker: { type: 'string', short: 'b' },
      'api-url': { type: 'string' },
      interval: { type: 'string', short: 'i' },
      speed: { type: 'string', short: 's' },
      jitter: { type: 'boolean', default: true },
      help: { type: 'boolean', short: 'h' }
    },
    strict: false
  });

  if (args.values.help) {
    console.log(`
Usage: node gps-simulator.js [options]
Options:
  -n, --count <number>       Number of simulated vehicles (1-10, default: 2)
  -p, --protocol <string>    mqtt | http (default: mqtt)
  -b, --broker <url>         MQTT broker URL (default: mqtt://localhost:1883)
  --api-url <url>            HTTP backend API URL (default: http://localhost:3000/api/v1)
  -i, --interval <ms>        Interval between GPS points in milliseconds (default: 1000)
  -s, --speed <km/h>         Base speed in km/h (default: 30)
  --jitter                   Add small GPS noise (default: true)
  -h, --help                 Show help
    `);
    process.exit(0);
  }

  const sim = new Simulator({
    count: args.values.count ? parseInt(args.values.count, 10) : undefined,
    protocol: args.values.protocol,
    brokerUrl: args.values.broker,
    apiUrl: args.values['api-url'],
    interval: args.values.interval ? parseInt(args.values.interval, 10) : undefined,
    speed: args.values.speed ? parseInt(args.values.speed, 10) : undefined,
    jitter: args.values.jitter
  });

  sim.start();
}
