# Shuttle Tracking System — Web & Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้างระบบเว็บและ Backend สำหรับติดตามรถรับ-ส่ง (Shuttle Tracking System) ครบวงจร ทั้งระบบ Ingestion ผ่าน MQTT/HTTP, ฐานข้อมูล PostGIS, REST APIs, WebSocket Real-time, ระบบจำลอง GPS และเว็บ Dashboard (Public Live Map + Admin Management)

**Architecture:** สถาปัตยกรรม Hybrid ประกอบด้วย Eclipse Mosquitto (MQTT Broker), Fastify (Node.js API & Ingestion Worker), PostgreSQL 16 + PostGIS 3.4, Fastify WebSocket Plugin สำหรับ Real-time Broadcast และ Next.js 15 (App Router + Tailwind CSS + Leaflet.js) สำหรับฝั่งผู้ใช้งาน

**Tech Stack:**
- **Backend:** Node.js (v20+), Fastify, `mqtt` client, `pg` (PostgreSQL Client), `@fastify/jwt`, `@fastify/websocket`, `bcrypt`
- **Database:** PostgreSQL 16 + PostGIS 3.4 (Partitioned `gps_points`, Spatial Index)
- **Broker:** Eclipse Mosquitto 2.0 (with ACL authentication)
- **Frontend:** Next.js 15 (TypeScript), Tailwind CSS, Lucide React, Leaflet.js / React-Leaflet, OpenStreetMap
- **DevOps / Testing:** Docker Compose, Jest / Supertest, GPS Simulator CLI Tool

---

## Global Constraints
- Node.js version: 20 LTS or higher
- Database: PostgreSQL 16 with PostGIS 3.4 extension
- MQTT Broker: Eclipse Mosquitto 2.0 (Port 1883 TCP, 9001 WS)
- Backend REST API Base URL: `/api/v1`
- Authentication: JWT Bearer Token for Admin, Device Key / MQTT Username-Password for GPS Devices
- Spatial Projection: WGS 84 (EPSG:4326)

---

## File Structure Map

```
shuttle-tracking-dashboard/
├── docker-compose.yml
├── mosquitto/
│   └── config/
│       ├── mosquitto.conf
│       └── acl.conf
├── database/
│   └── migrations/
│       ├── 001_initial_schema.sql
│       └── 002_seed_data.sql
├── backend/
│   ├── package.json
│   ├── tsconfig.json (or jsconfig)
│   ├── src/
│   │   ├── app.js / server.js
│   │   ├── config/
│   │   │   └── env.js
│   │   ├── db/
│   │   │   └── index.js
│   │   ├── utils/
│   │   │   ├── distance.js
│   │   │   └── gps-filter.js
│   │   ├── services/
│   │   │   ├── distance-engine.js
│   │   │   ├── trip-service.js
│   │   │   └── mqtt-ingest.js
│   │   ├── plugins/
│   │   │   ├── auth.js
│   │   │   └── websocket.js
│   │   └── routes/
│   │       ├── auth.js
│   │       ├── telemetry.js
│   │       ├── vehicles.js
│   │       ├── trips.js
│   │       ├── routes.js
│   │       └── reports.js
│   └── __tests__/
│       ├── distance.test.js
│       ├── gps-filter.test.js
│       └── api.test.js
├── tools/
│   ├── gps-simulator.js
│   └── routes-sample.geojson
└── frontend/
    ├── package.json
    ├── next.config.ts
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx
    │   │   ├── page.tsx (Public Live Tracking Map)
    │   │   ├── login/page.tsx
    │   │   └── admin/
    │   │       ├── page.tsx (Fleet Overview Dashboard)
    │   │       ├── vehicles/page.tsx (Vehicle CRUD & Command Modal)
    │   │       ├── trips/page.tsx (Trip History & Route Playback)
    │   │       ├── routes/page.tsx (Route Management)
    │   │       └── reports/page.tsx (Daily / Range Mileage Report)
    │   ├── components/
    │   │   ├── Map/
    │   │   │   ├── LiveMap.tsx
    │   │   │   └── TrackPlaybackMap.tsx
    │   │   ├── Layout/
    │   │   │   └── AdminSidebar.tsx
    │   │   └── UI/
    │   │       └── StatsCard.tsx
    │   └── lib/
    │       ├── api.ts
    │       ├── ws.ts
    │       └── types.ts
```

---

## Phase 1: DevOps & Database Migration

### Task 1: Docker Compose Stack & Mosquitto Configuration
**Files:**
- Create: `docker-compose.yml`
- Create: `mosquitto/config/mosquitto.conf`
- Create: `mosquitto/config/acl.conf`

**Interfaces:**
- Produces: Docker services `postgres` (port 5432), `mosquitto` (port 1883, 9001), `api` (port 3000)

- [ ] **Step 1: Write Mosquitto config and ACL files**
- [ ] **Step 2: Write `docker-compose.yml`**
- [ ] **Step 3: Test starting Postgres and Mosquitto containers**
  - Run: `docker compose up -d postgres mosquitto`
  - Verify: `docker compose ps` shows healthy / running
- [ ] **Step 4: Commit**
  - `git add docker-compose.yml mosquitto/`
  - `git commit -m "chore: setup docker-compose stack and mosquitto config"`

---

### Task 2: Database Schema & Seed Data
**Files:**
- Create: `database/migrations/001_initial_schema.sql`
- Create: `database/migrations/002_seed_data.sql`

**Interfaces:**
- Consumes: PostGIS Docker container
- Produces: Database tables `users`, `routes`, `route_stops`, `vehicles`, `trips`, `gps_points` (partitioned), and view `daily_mileage_summary`

- [ ] **Step 1: Write `001_initial_schema.sql` with PostGIS extension and table partitions**
- [ ] **Step 2: Write `002_seed_data.sql` with admin user, test route, and sample vehicles**
- [ ] **Step 3: Execute migration on database**
- [ ] **Step 4: Verify tables and indexes exist**
- [ ] **Step 5: Commit**
  - `git add database/migrations/`
  - `git commit -m "feat: add initial database schema and seed data"`

---

## Phase 2: Core Domain Logic & Unit Testing (TDD)

### Task 3: Haversine Distance Engine & GPS Noise Filter
**Files:**
- Create: `backend/src/utils/distance.js`
- Create: `backend/src/utils/gps-filter.js`
- Create: `backend/__tests__/distance.test.js`
- Create: `backend/__tests__/gps-filter.test.js`

**Interfaces:**
- Produces: `haversineDistance(lat1, lon1, lat2, lon2): number`
- Produces: `isValidPoint(currentPoint, prevPoint, timeDiffSec): boolean`

- [ ] **Step 1: Write failing unit test for `haversineDistance` and `isValidPoint`**
- [ ] **Step 2: Run test to verify it fails**
  - Run: `npm --prefix backend test`
- [ ] **Step 3: Implement `distance.js` and `gps-filter.js`**
- [ ] **Step 4: Run test to verify all tests pass**
  - Run: `npm --prefix backend test`
- [ ] **Step 5: Commit**
  - `git add backend/src/utils/ backend/__tests__/`
  - `git commit -m "feat: implement distance calculation and gps noise filter with unit tests"`

---

### Task 4: Trip Management & Distance Engine Service
**Files:**
- Create: `backend/src/services/trip-service.js`
- Create: `backend/src/services/distance-engine.js`

**Interfaces:**
- Produces: `processTelemetryPoint(db, telemetryData): Promise<{ trip, distanceAddedM, isValid }>`
- Produces: `closeStaleTrips(db): Promise<Array<Trip>>`

- [ ] **Step 1: Write unit tests for trip start, distance accumulation, and trip auto-close**
- [ ] **Step 2: Implement `trip-service.js` and `distance-engine.js`**
- [ ] **Step 3: Run unit tests to verify behavior**
- [ ] **Step 4: Commit**
  - `git add backend/src/services/`
  - `git commit -m "feat: implement trip service and distance accumulation engine"`

---

## Phase 3: Fastify Backend API & MQTT Ingestion

### Task 5: Fastify App Setup, Config & Authentication
**Files:**
- Create: `backend/package.json`
- Create: `backend/src/config/env.js`
- Create: `backend/src/db/index.js`
- Create: `backend/src/plugins/auth.js`
- Create: `backend/src/routes/auth.js`
- Create: `backend/src/app.js`
- Create: `backend/src/server.js`

**Interfaces:**
- Produces: `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, `POST /api/v1/auth/change-password`
- Produces: `app.authenticate` Fastify decorator

- [ ] **Step 1: Initialize backend dependencies (`fastify`, `pg`, `@fastify/jwt`, `bcrypt`, `dotenv`, etc.)**
- [ ] **Step 2: Write JWT auth plugin and login route**
- [ ] **Step 3: Write test for user login and token validation**
  - Run: `npm --prefix backend test`
- [ ] **Step 4: Commit**
  - `git add backend/`
  - `git commit -m "feat: setup fastify server with database pool and jwt authentication"`

---

### Task 6: MQTT Ingestion Service & Downlink Commands
**Files:**
- Create: `backend/src/services/mqtt-ingest.js`

**Interfaces:**
- Consumes: Mosquitto Broker at `mqtt://mosquitto:1883`
- Subscribes: `vehicles/+/telemetry`, `vehicles/+/status`, `vehicles/+/response`
- Produces: `sendVehicleCommand(vehicleId, commandPayload): Promise<void>`

- [ ] **Step 1: Implement MQTT Client connecting to broker with auto-reconnect**
- [ ] **Step 2: Implement handler for `vehicles/+/telemetry` to pipe into `processTelemetryPoint`**
- [ ] **Step 3: Implement handler for `vehicles/+/status` (LWT / Online events)**
- [ ] **Step 4: Implement command publisher for `vehicles/{id}/command`**
- [ ] **Step 5: Commit**
  - `git add backend/src/services/mqtt-ingest.js`
  - `git commit -m "feat: implement mqtt ingestion service and downlink command publisher"`

---

### Task 7: Telemetry HTTP REST API (Batch & Fallback)
**Files:**
- Create: `backend/src/routes/telemetry.js`

**Interfaces:**
- Produces: `POST /api/v1/telemetry`, `POST /api/v1/telemetry/batch`

- [ ] **Step 1: Implement `POST /api/v1/telemetry` with `X-Device-Key` validation**
- [ ] **Step 2: Implement `POST /api/v1/telemetry/batch` for processing array of points**
- [ ] **Step 3: Write integration tests for telemetry endpoints**
- [ ] **Step 4: Commit**
  - `git add backend/src/routes/telemetry.js`
  - `git commit -m "feat: implement http telemetry and batch flush api"`

---

### Task 8: Vehicle, Trip, Route, and Report APIs
**Files:**
- Create: `backend/src/routes/vehicles.js`
- Create: `backend/src/routes/trips.js`
- Create: `backend/src/routes/routes.js`
- Create: `backend/src/routes/reports.js`

**Interfaces:**
- Produces: Vehicle CRUD & `POST /api/v1/vehicles/:id/command`
- Produces: Trips list, trip detail & `GET /api/v1/trips/:id/track`
- Produces: Daily & Range Reports `GET /api/v1/reports/daily`

- [ ] **Step 1: Implement Vehicle endpoints with API Key generation and command trigger**
- [ ] **Step 2: Implement Trip endpoints and GeoJSON coordinate track query**
- [ ] **Step 3: Implement Route & Route Stops CRUD**
- [ ] **Step 4: Implement Report summary queries from `daily_mileage_summary` view**
- [ ] **Step 5: Write API test suite**
- [ ] **Step 6: Commit**
  - `git add backend/src/routes/`
  - `git commit -m "feat: implement vehicle, trip, route, and report rest apis"`

---

### Task 9: WebSocket Server & Real-time Broadcaster
**Files:**
- Create: `backend/src/plugins/websocket.js`

**Interfaces:**
- Produces: `wss://.../ws` (Admin channel) and `wss://.../ws/public` (Public live map channel)
- Broadcasts: `vehicle:location`, `vehicle:status`, `trip:started`, `trip:completed`

- [ ] **Step 1: Setup `@fastify/websocket` plugin**
- [ ] **Step 2: Implement broadcast helper triggered when telemetry / status arrives**
- [ ] **Step 3: Add vehicle subscription filter (`subscribe` / `unsubscribe`)**
- [ ] **Step 4: Commit**
  - `git add backend/src/plugins/websocket.js`
  - `git commit -m "feat: implement websocket broadcast for real-time live map"`

---

## Phase 4: GPS Simulator for Testing

### Task 10: GPS Simulator CLI Tool
**Files:**
- Create: `tools/gps-simulator.js`
- Create: `tools/routes-sample.geojson`

**Interfaces:**
- Produces: CLI tool to simulate 1–10 vehicles moving along realistic Bangkok routes via MQTT or HTTP

- [ ] **Step 1: Generate sample GeoJSON route coordinates**
- [ ] **Step 2: Implement simulator with speed variation, realistic heading, and MQTT publishing**
- [ ] **Step 3: Test running simulator against local Mosquitto broker**
  - Run: `node tools/gps-simulator.js --count 2 --protocol mqtt`
- [ ] **Step 4: Commit**
  - `git add tools/`
  - `git commit -m "feat: create gps simulator tool for automated fleet testing"`

---

## Phase 5: Next.js Frontend Dashboard

### Task 11: Next.js 15 Project Setup & Core Layout
**Files:**
- Create: `frontend/package.json`
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/ws.ts`
- Create: `frontend/src/lib/types.ts`
- Create: `frontend/src/app/layout.tsx`

- [ ] **Step 1: Initialize Next.js project with Tailwind CSS and Lucide icons**
- [ ] **Step 2: Implement API client with JWT storage and WebSocket hook**
- [ ] **Step 3: Commit**
  - `git add frontend/`
  - `git commit -m "feat: initialize nextjs frontend and api/websocket client"`

---

### Task 12: Public Live Tracking Map
**Files:**
- Create: `frontend/src/components/Map/LiveMap.tsx`
- Create: `frontend/src/app/page.tsx`

**Interfaces:**
- Produces: Public web page displaying real-time shuttle positions on OpenStreetMap with Leaflet, vehicle list sidebar, speed, and last updated time.

- [ ] **Step 1: Create dynamic Leaflet Map component (SSR-safe)**
- [ ] **Step 2: Implement real-time marker animations and route polyline display**
- [ ] **Step 3: Connect to `/ws/public` WebSocket stream**
- [ ] **Step 4: Commit**
  - `git add frontend/src/components/Map/ frontend/src/app/page.tsx`
  - `git commit -m "feat: implement public real-time shuttle tracking map"`

---

### Task 13: Admin Fleet Overview Dashboard
**Files:**
- Create: `frontend/src/app/admin/page.tsx`
- Create: `frontend/src/components/Layout/AdminSidebar.tsx`
- Create: `frontend/src/components/UI/StatsCard.tsx`

**Interfaces:**
- Produces: Admin Dashboard showing Online/Offline count, Today's total fleet mileage, Active trips table, and Mini fleet map.

- [ ] **Step 1: Create Admin layout with Navigation Sidebar**
- [ ] **Step 2: Implement summary cards (Active Vehicles, Total Km Today, Active Trips)**
- [ ] **Step 3: Implement live fleet table with real-time status badges**
- [ ] **Step 4: Commit**
  - `git add frontend/src/app/admin/`
  - `git commit -m "feat: implement admin fleet overview dashboard"`

---

### Task 14: Vehicle Management & Remote Command Modal
**Files:**
- Create: `frontend/src/app/admin/vehicles/page.tsx`
- Create: `frontend/src/components/Vehicles/CommandModal.tsx`

**Interfaces:**
- Produces: Add/Edit/Delete vehicle dialogs, API Key copy button, and Remote Command modal (Reboot, Set Interval).

- [ ] **Step 1: Implement Vehicle CRUD Table with search/filter**
- [ ] **Step 2: Implement Add/Edit modal with Route assignment**
- [ ] **Step 3: Implement Remote Command modal triggering `POST /api/v1/vehicles/:id/command`**
- [ ] **Step 4: Commit**
  - `git add frontend/src/app/admin/vehicles/`
  - `git commit -m "feat: implement vehicle management and remote command interface"`

---

### Task 15: Trip History & Track Playback Visualizer
**Files:**
- Create: `frontend/src/app/admin/trips/page.tsx`
- Create: `frontend/src/components/Map/TrackPlaybackMap.tsx`

**Interfaces:**
- Produces: Trip list by date/vehicle, detail drawer, and animated GPS point playback on map.

- [ ] **Step 1: Implement Trip list with date picker and vehicle filter**
- [ ] **Step 2: Implement Track Playback component showing start/end markers and path polyline**
- [ ] **Step 3: Commit**
  - `git add frontend/src/app/admin/trips/`
  - `git commit -m "feat: implement trip history and route playback visualizer"`

---

### Task 16: Daily Mileage & Fleet Report Page
**Files:**
- Create: `frontend/src/app/admin/reports/page.tsx`

**Interfaces:**
- Produces: Mileage report table by date/range with CSV export button.

- [ ] **Step 1: Implement Daily & Range summary table**
- [ ] **Step 2: Add CSV export function**
- [ ] **Step 3: Commit**
  - `git add frontend/src/app/admin/reports/`
  - `git commit -m "feat: implement mileage summary report and csv export"`

---

## Phase 6: End-to-End Verification

### Task 17: Full System E2E Verification
- [ ] **Step 1: Start full Docker Compose stack (`postgres`, `mosquitto`, `backend`)**
- [ ] **Step 2: Run GPS Simulator to stream 2 vehicles via MQTT**
- [ ] **Step 3: Verify data arrives in Database (`gps_points`, `trips`)**
- [ ] **Step 4: Open Public Map & Admin Dashboard in browser and verify live marker updates**
- [ ] **Step 5: Send remote command from Dashboard and verify simulator response**
