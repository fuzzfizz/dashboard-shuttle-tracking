# Shuttle Fleet Tracking Dashboard (Real-Time Hardware Gateway)

A minimalist, high-performance real-time shuttle tracking dashboard designed for hardware and IoT fleet testing. Connects directly to MQTT brokers over WebSockets without requiring a local backend server.

---

## Quick Start

### 1. Run the All-in-One System Locally
```bash
npm install
npm run build
npm start
```
Open [http://localhost:3000](http://localhost:3000) for the web dashboard and health endpoint at [http://localhost:3000/health](http://localhost:3000/health).

### 2. Run Only the Frontend Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Deploy to Render (All-in-One: Frontend + 24/7 Worker)
Deploy directly using Render Blueprint (`render.yaml`) or as a Node Web Service.

**Required Environment Variables on Render:**
| Variable | Description | Source |
| :--- | :--- | :--- |
| `SUPABASE_URL` | Supabase Project URL | Supabase Console > Project Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Secret Key (for Worker writes) | Supabase Console > Project Settings > API |
| `VITE_SUPABASE_ANON_KEY` | Supabase Anon Public Key (for Frontend reads) | Supabase Console > Project Settings > API |

*Note: `MQTT_BROKER` defaults to `mqtt://broker.emqx.io:1883` and `MQTT_TOPIC` defaults to `shuttle/fleet/v1/+/telemetry`.*

### 2. Test with the Simulator (Optional)
If your hardware is not yet powered on, run the test telemetry publisher:
```bash
cd tools
npm install
npm run simulate
```

---

## Configuration & Environment Variables

Copy `frontend/.env.example` to `frontend/.env` (or set in Vercel Environment Variables):

| Variable | Description | Default (Testing) |
| :--- | :--- | :--- |
| `VITE_MQTT_BROKER_URL` | WebSocket URL to MQTT broker | `wss://broker.emqx.io:8084/mqtt` |
| `VITE_MQTT_TOPIC` | Subscription topic pattern | `shuttle/fleet/v1/+/telemetry` |
| `VITE_MQTT_USERNAME` | *(Optional)* Broker username | - |
| `VITE_MQTT_PASSWORD` | *(Optional)* Broker password | - |

---

## Hardware Configuration (ESP32 / GSM Module)

Configure your device firmware to publish telemetry to:
- **Broker Host:** `<YOUR_BROKER_HOST>` *(e.g. `broker.emqx.io` for development)*
- **Port:** `1883` (TCP) or `8883` (TCP with TLS)
- **Topic:** `shuttle/fleet/v1/<VEHICLE_ID>/telemetry`
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

## Security & Privacy Notice

> [!WARNING]
> **Do not use public MQTT brokers for production or real-world passenger/vehicle tracking.**
> - Public test brokers (such as `broker.emqx.io` or `broker.hivemq.com`) are unencrypted/shared environments where anyone can view or publish data to public topics.
> - For production deployments:
>   1. Deploy a private MQTT broker (e.g., Mosquitto with SSL/TLS, AWS IoT, or private EMQX cluster).
>   2. Enable client authentication (username/password or client certificates).
>   3. Store all sensitive URLs, credentials, and unique vehicle IDs inside environment variables (`.env` or Vercel Secrets) and never commit them to public version control.

---

## Automated Tests & Build

```bash
cd frontend
npm test        # Run Vitest test suites (10 passing tests)
npm run build   # Typecheck and build production assets
```
