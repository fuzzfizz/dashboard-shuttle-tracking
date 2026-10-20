# Design Specification: Minimal Real-Time Shuttle Map for Hardware Testing

**Date:** 2026-10-20  
**Status:** Approved  
**Author:** AI Pair Programmer & User  

---

## 1. System Overview & Objective
Provide a minimalist, highly responsive web dashboard with an interactive map that visualizes real-time shuttle location, speed, and connectivity via MQTT over WebSockets. The system connects directly to a free public MQTT broker (`broker.emqx.io` / `broker.hivemq.com`), enabling instant end-to-end hardware testing without needing a local or self-hosted broker backend.

---

## 2. Architecture & Data Flow

```
[ Hardware Device (ESP32 / SIM7600) ]
        │  MQTT via TCP (Port 1883)
        ▼
[ Public Broker: broker.emqx.io ]
        │  MQTT over Secure WebSocket (Port 8084, WSS)
        ▼
[ React Leaflet Web Application ]
```

- **Broker Address:** `broker.emqx.io` (fallback: `broker.hivemq.com`)
- **Hardware TCP Port:** `1883` (Standard MQTT, unauthenticated)
- **Web App WebSocket URL:** `wss://broker.emqx.io:8084/mqtt` (Secure WebSocket)
- **Topic Pattern:** `shuttle/fleet/v1/{vehicle_id}/telemetry`
  - Default vehicle ID for testing: `shuttle-01`
  - Web subscription topic: `shuttle/fleet/v1/+/telemetry`

---

## 3. Telemetry Payload Contract

Every message sent by the hardware or simulator MUST adhere to the following JSON structure:

```json
{
  "vehicle_id": "shuttle-01",
  "lat": 13.75633,
  "lng": 100.50177,
  "speed": 24.5,
  "heading": 90,
  "timestamp": 1729412400000
}
```

### Field Definitions:
- `vehicle_id` (string): Unique identifier for the vehicle (e.g. `"shuttle-01"`).
- `lat` (number): Latitude in decimal degrees (e.g. `13.75633`).
- `lng` (number): Longitude in decimal degrees (e.g. `100.50177`).
- `speed` (number): Speed in km/h (e.g. `24.5`).
- `heading` (number, optional): Direction of travel in degrees (0-360).
- `timestamp` (number): Epoch timestamp in milliseconds.

---

## 4. UI Design & Aesthetics (Anti-AI Slop)

The design strictly avoids generic AI aesthetic clichés (no random glowing purple gradients, no cluttered cards). It focuses on crisp, restrained, professional telemetry monitoring:

1. **Map Base:**
   - Provider: **CartoDB Positron** (`https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png`)
   - Aesthetic: Light, high-contrast, clean monochrome base map that keeps the vehicle marker distinctly visible.

2. **Vehicle Marker:**
   - Custom SVG marker representing the vehicle with a directional pointer (heading) and a subtle emerald pulse ring indicating live telemetry reception.

3. **Floating HUD Card (Top-Right):**
   - **Connection Status Badge:** Emerald dot + "Connected" or Amber/Rose + "Connecting / Offline".
   - **Vehicle ID:** Clean bold header (e.g., `SHUTTLE-01`).
   - **Speed Gauge:** Prominent numeric readout in km/h using clean monospace typography.
   - **Coordinates:** Lat / Lng with click-to-copy or high-readability small text.
   - **Last Seen:** Relative elapsed time ("Just now", "3s ago").

---

## 5. Hardware Simulation & Test Tool

To verify the dashboard before or alongside actual hardware activation:
- A Node.js CLI script (`tools/simulate.js`) that publishes realistic moving GPS coordinates at 1-2 second intervals to `shuttle/fleet/v1/shuttle-01/telemetry`.
- Enables fast verification of Leaflet marker positioning, speed changes, and status transitions.
