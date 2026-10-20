# Shuttle Fleet Tracking Dashboard (Real-Time Hardware Gateway)

A minimalist, high-performance real-time shuttle tracking dashboard designed for hardware and IoT fleet testing. Connects directly to a public MQTT broker over WebSockets with zero backend installation needed.

---

## Quick Start

### 1. Run the Web Dashboard
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 2. Test with the Simulator (Optional)
If your hardware is not yet powered on, run the test telemetry publisher:
```bash
cd tools
npm install
npm run simulate
```
You will immediately see the shuttle move across the map and live telemetry update on the HUD card.

---

## Hardware Configuration (ESP32 / GSM Module)

Configure your device's MQTT client with:
- **Broker Host:** `broker.emqx.io` (or `broker.hivemq.com`)
- **Port:** `1883` (Standard TCP MQTT, unauthenticated)
- **Topic:** `shuttle/fleet/v1/shuttle-01/telemetry`
- **Payload Format (JSON):**
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

---

## Automated Tests & Build

```bash
cd frontend
npm test        # Run Vitest test suites (10 passing tests)
npm run build   # Typecheck and build production assets
```
