# Telemetry Tools & Hardware Guide

This directory contains standalone tools for fleet simulation, testing, and background data ingestion into Supabase.

---

### 1. Background MQTT Ingestion Worker (`worker.js`)
The ingestion worker connects to the MQTT broker, consumes real-time telemetry packets from all shuttles (`shuttle/fleet/v1/+/telemetry`), calculates incremental Haversine distance with GPS jitter & teleport glitch rejection, and batches daily mileage and speed metrics directly into Supabase (`daily_vehicle_metrics`).

#### Environment Setup
Create a `.env` file in the `tools` directory (or export environment variables):
```env
# Supabase Configuration (Required for persistence)
SUPABASE_URL=https://<your-project-id>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key-here

# MQTT Broker Configuration (Optional, defaults to public broker)
MQTT_BROKER=mqtt://broker.emqx.io:1883
MQTT_TOPIC=shuttle/fleet/v1/+/telemetry
```

#### Running the Worker
```bash
cd tools
npm install
npm run worker
```

#### Processing Features:
- **Haversine Distance**: Computes great-circle distance between successive GPS pings.
- **Jitter Filtering**: Rejects stationary GPS drift (< 8 meters when vehicle speed is under 1.5 km/h).
- **Teleport Glitch Filter**: Rejects erroneous GPS jumps where implied travel speed exceeds 150 km/h.
- **Throttled Batching**: Batches accumulated distance per vehicle and upserts to `daily_vehicle_metrics` every 5 seconds, avoiding database write contention.

---

### 2. Telemetry Simulator (`simulate.js`)
To test the web map and worker without physical hardware:
```bash
cd tools
npm install
npm run simulate
```

You can optionally specify your own broker or vehicle ID via environment variables:
```bash
# Example with custom vehicle and private broker
VEHICLE_ID=shuttle-vip-01 MQTT_BROKER=mqtt://my-broker.domain:1883 npm run simulate
```

---

### 3. Hardware Firmware Configuration (ESP32 / GSM)
- **Protocol:** MQTT (TCP)
- **Host:** `<BROKER_HOST>` (Default testing: `broker.emqx.io`)
- **Port:** `1883` (Standard MQTT) or `8883` (MQTT with TLS)
- **Topic:** `shuttle/fleet/v1/<VEHICLE_ID>/telemetry`
- **Format:** JSON matching:
```json
{
  "vehicle_id": "YOUR_VEHICLE_ID",
  "lat": 13.7563,
  "lng": 100.5018,
  "speed": 24.5,
  "heading": 90,
  "timestamp": 1729412400000
}
```
