# Telemetry Simulator & Hardware Guide

### Running the Simulator
To test the web map without hardware:
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

### Hardware Firmware Configuration (ESP32 / GSM)
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
