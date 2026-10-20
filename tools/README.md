# Telemetry Simulator & Hardware Guide

### Running the Simulator
To test the web map without hardware:
```bash
cd tools
npm install
node simulate.js
```

### Hardware Firmware Configuration (ESP32 / GSM)
- **Protocol:** MQTT (TCP)
- **Host:** `broker.emqx.io`
- **Port:** `1883`
- **Topic:** `shuttle/fleet/v1/shuttle-01/telemetry`
- **Format:** JSON matching:
```json
{
  "vehicle_id": "shuttle-01",
  "lat": 13.7563,
  "lng": 100.5018,
  "speed": 24.5,
  "heading": 90,
  "timestamp": 1729412400000
}
```
