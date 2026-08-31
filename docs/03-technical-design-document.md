# Technical Design Document (TDD) — ระบบติดตามรถรับ-ส่ง (Shuttle Tracking System)

> **เอกสารฉบับสมบูรณ์** — แก้ไขทุกจุดอ่อนจาก [Critical Review](file:///C:/Users/ahit0/.gemini/antigravity-cli/brain/3e60929d-b6ec-4bb1-bb5a-171231b3f880/critical_review_feasibility_doc.md) พร้อมนำไปพัฒนาจริงได้
>
> อ้างอิงโจทย์จาก [ระบบการติดตามรถรับ-ส่ง.md](file:///D:/shuttle-tracking-dashboard/%E0%B8%A3%E0%B8%B0%E0%B8%9A%E0%B8%9A%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%95%E0%B8%B4%E0%B8%94%E0%B8%95%E0%B8%B2%E0%B8%A1%E0%B8%A3%E0%B8%96%E0%B8%A3%E0%B8%B1%E0%B8%9A-%E0%B8%AA%E0%B9%88%E0%B8%87.md)

---

## สารบัญ

1. [สถาปัตยกรรมระบบ (System Architecture)](#1-สถาปัตยกรรมระบบ-system-architecture)
2. [Database Schema & ER Diagram](#2-database-schema--er-diagram)
3. [Messaging & API Specification](#3-messaging--api-specification)
4. [Security & Authentication Design](#4-security--authentication-design)
5. [Error Handling & Edge Cases](#5-error-handling--edge-cases)
6. [Deployment & DevOps](#6-deployment--devops)
7. [Testing Strategy](#7-testing-strategy)
8. [Hardware Firmware Specification](#8-hardware-firmware-specification)
9. [ต้นทุนละเอียดและ TCO](#9-ต้นทุนละเอียดและ-tco)
10. [Timeline สมจริง (Realistic Roadmap)](#10-timeline-สมจริง-realistic-roadmap)

---

## 1. สถาปัตยกรรมระบบ (System Architecture)

### 1.1 ภาพรวมระบบ (Hybrid Architecture: MQTT + HTTPS)

```mermaid
graph TD
    subgraph Vehicle["อุปกรณ์บนรถ (Vehicle Edge)"]
        GPS_HW["ESP32-S3 + NEO-8M GPS + A7670C 4G"]
        LED["LED x3: Power / GPS Fix / 4G"]
        SW["สวิตช์ เปิด-ปิด / ACC Detect"]
        BUFF["Local Buffer (SPIFFS 4MB)"]
    end

    subgraph Cloud["Cloud Infrastructure (VPS Docker)"]
        MOSQ["MQTT Broker (Eclipse Mosquitto 2.0)"]
        NGINX["Nginx (Reverse Proxy + TLS 1.3)"]
        API["Backend API & MQTT Ingest (Node.js / Fastify)"]
        WS_SRV["WebSocket Server (Real-time Broadcast)"]
        DIST_ENGINE["Distance Engine (Trip Calculator)"]
        DB["PostgreSQL 16 + PostGIS 3.4"]
    end

    subgraph Clients["ผู้ใช้งาน"]
        ADMIN["Admin Dashboard (Next.js)"]
        PUBLIC["หน้าดูตำแหน่งรถ (Public Web)"]
    end

    SW -->|ACC ON/OFF| GPS_HW
    GPS_HW -->|LED Status| LED
    GPS_HW -->|ถ้า offline เก็บ buffer| BUFF
    GPS_HW -->|MQTT Telemetry (ทุก 5s): vehicles/V01/telemetry| MOSQ
    GPS_HW -->|LWT Status: vehicles/V01/status| MOSQ
    BUFF -->|HTTPS POST /api/v1/telemetry/batch (เมื่อต่อเน็ตได้)| NGINX
    MOSQ -->|Subscribe vehicles/+/telemetry| API
    NGINX -->|proxy_pass (REST APIs / Batch)| API
    API --> DIST_ENGINE
    DIST_ENGINE --> DB
    API --> WS_SRV
    WS_SRV -->|ws://| ADMIN
    WS_SRV -->|ws://| PUBLIC
    DB -->|query| API
    ADMIN -->|POST /vehicles/:id/command| API
    API -->|Publish vehicles/V01/command| MOSQ
    MOSQ -->|Downlink Commands (Reboot/Interval)| GPS_HW
```

### 1.2 เทคโนโลยีที่ตัดสินใจใช้ (Final Tech Decisions)

| Layer | เทคโนโลยี | เหตุผล |
| :--- | :--- | :--- |
| **Hardware** | ESP32-S3 + A7670C (4G LTE) + NEO-8M (GPS) | ปรับแต่งได้เต็มที่, ต้นทุนต่ำ, โมดูล A7670C มี Hardware MQTT Stack ในตัว |
| **Telemetry Protocol** | **MQTT (Eclipse Mosquitto 2.0)** | Overhead ต่ำ (~50 bytes/msg), ประหยัด Data ซิม ~70%, Real-time Latency ต่ำ, มี LWT และ 2-way control |
| **Batch / Management** | **HTTPS (REST API) + TLS 1.3** | เหมาะสำหรับ Flush ข้อมูล Buffer ก้อนใหญ่ตอน Offline, Admin CRUD, และ OTA Firmware |
| **Frontend** | Next.js 15 + TypeScript + Tailwind CSS + Shadcn/UI | Modern, SSR, Responsive, Dashboard ครบวงจร |
| **Map** | Leaflet.js + OpenStreetMap Tiles | ฟรี 100%, เอกสารเยอะ, ชุมชนใหญ่ |
| **Backend & Ingestion** | Node.js + Fastify + `mqtt` client | เร็ว, จัดการ MQTT Ingest และ REST API ได้ใน Service เดียว, รองรับ WebSocket ในตัว |
| **Database** | PostgreSQL 16 + PostGIS 3.4 | Spatial query คำนวณระยะทางแม่นยำ, Partitioning รองรับข้อมูลโตเร็ว, ฟรี |
| **Real-time Broadcast** | Fastify WebSocket plugin | ส่งพิกัดสดให้ Client บน Web Dashboard แบบ Low Latency |
| **Auth & ACL** | JWT (Admin), MQTT Device Key + Mosquitto ACL (Device) | ปลอดภัย แยกสิทธิ์รายคัน อุปกรณ์ไม่สามารถส่งข้อมูลข้าม Topic ได้ |
| **Deployment** | Docker Compose on VPS (Hetzner / DigitalOcean) | ราคาถูก, ควบคุมเต็มที่, รวม Mosquitto + Fastify + Postgres + Nginx ในชุดเดียว |


---

## 2. Database Schema & ER Diagram

### 2.1 ER Diagram

```mermaid
erDiagram
    users ||--o{ vehicles : "manages"
    vehicles ||--o{ trips : "has"
    vehicles ||--o{ gps_points : "sends"
    trips ||--o{ gps_points : "contains"
    routes ||--o{ route_stops : "has"
    routes ||--o{ vehicles : "assigned_to"

    users {
        uuid id PK
        varchar email UK
        varchar password_hash
        enum role "admin | viewer"
        varchar display_name
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    vehicles {
        uuid id PK
        varchar plate_number UK "ทะเบียนรถ"
        varchar name "ชื่อเรียก เช่น รถคันที่ 1"
        uuid route_id FK "เส้นทางที่กำหนด"
        varchar device_api_key UK "API Key ของอุปกรณ์"
        enum status "online | offline | maintenance"
        float last_lat "พิกัดล่าสุด"
        float last_lng "พิกัดล่าสุด"
        float last_speed_kmh "ความเร็วล่าสุด"
        float last_heading "ทิศทางล่าสุด (0-360)"
        timestamp last_seen_at "เวลาที่ได้รับข้อมูลล่าสุด"
        boolean is_active
        timestamp created_at
    }

    routes {
        uuid id PK
        varchar name "ชื่อเส้นทาง"
        text description
        json route_geojson "GeoJSON LineString ของเส้นทาง"
        boolean is_active
        timestamp created_at
    }

    route_stops {
        uuid id PK
        uuid route_id FK
        varchar name "ชื่อจุดจอด"
        float lat
        float lng
        int stop_order "ลำดับจุดจอด"
        int radius_meters "รัศมี geofence (default 50m)"
    }

    trips {
        uuid id PK
        uuid vehicle_id FK
        int trip_number "รอบที่ (reset ทุกวัน)"
        timestamp started_at
        timestamp ended_at "null = กำลังวิ่งอยู่"
        float total_distance_km "ระยะทางรวม (สะสม)"
        int total_points "จำนวนพิกัดที่บันทึก"
        enum status "in_progress | completed | cancelled"
        date trip_date "วันที่ของรอบ (index)"
    }

    gps_points {
        bigint id PK "BIGSERIAL"
        uuid vehicle_id FK
        uuid trip_id FK
        float lat
        float lng
        float speed_kmh
        float heading
        float distance_from_prev_m "ระยะห่างจากจุดก่อนหน้า (เมตร)"
        timestamp device_timestamp "เวลาจากอุปกรณ์"
        timestamp server_timestamp "เวลาที่ server ได้รับ"
        boolean is_valid "ผ่าน filter หรือไม่"
    }
```

### 2.2 SQL Schema สำหรับ Migration

```sql
-- ============================================================
-- Migration: 001_initial_schema.sql
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================
-- Table: users (ผู้ดูแลระบบ)
-- ============================================================
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email       VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role        VARCHAR(20) NOT NULL DEFAULT 'viewer'
                CHECK (role IN ('admin', 'viewer')),
    display_name VARCHAR(100),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Table: routes (เส้นทางรถ)
-- ============================================================
CREATE TABLE routes (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    route_geojson JSONB,          -- GeoJSON LineString
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Table: route_stops (จุดจอดบนเส้นทาง)
-- ============================================================
CREATE TABLE route_stops (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id        UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    lat             DOUBLE PRECISION NOT NULL,
    lng             DOUBLE PRECISION NOT NULL,
    stop_order      INTEGER NOT NULL,
    radius_meters   INTEGER NOT NULL DEFAULT 50,
    UNIQUE(route_id, stop_order)
);

-- ============================================================
-- Table: vehicles (ข้อมูลรถ)
-- ============================================================
CREATE TABLE vehicles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plate_number    VARCHAR(20) NOT NULL UNIQUE,
    name            VARCHAR(100),
    route_id        UUID REFERENCES routes(id) ON DELETE SET NULL,
    device_api_key  VARCHAR(64) NOT NULL UNIQUE,  -- สำหรับ Hardware Auth
    status          VARCHAR(20) NOT NULL DEFAULT 'offline'
                    CHECK (status IN ('online', 'offline', 'maintenance')),
    last_lat        DOUBLE PRECISION,
    last_lng        DOUBLE PRECISION,
    last_speed_kmh  REAL DEFAULT 0,
    last_heading    REAL DEFAULT 0,
    last_seen_at    TIMESTAMPTZ,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vehicles_api_key ON vehicles(device_api_key);
CREATE INDEX idx_vehicles_status ON vehicles(status);

-- ============================================================
-- Table: trips (รอบการเดินทาง)
-- ============================================================
CREATE TABLE trips (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id      UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    trip_number     INTEGER NOT NULL,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at        TIMESTAMPTZ,
    total_distance_km DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_points    INTEGER NOT NULL DEFAULT 0,
    status          VARCHAR(20) NOT NULL DEFAULT 'in_progress'
                    CHECK (status IN ('in_progress', 'completed', 'cancelled')),
    trip_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    UNIQUE(vehicle_id, trip_date, trip_number)
);

CREATE INDEX idx_trips_vehicle_date ON trips(vehicle_id, trip_date);
CREATE INDEX idx_trips_status ON trips(status) WHERE status = 'in_progress';

-- ============================================================
-- Table: gps_points (พิกัด GPS ที่บันทึก)
-- Partitioned by month เพราะข้อมูลจะโตเร็วมาก
-- ============================================================
CREATE TABLE gps_points (
    id                  BIGSERIAL,
    vehicle_id          UUID NOT NULL,
    trip_id             UUID NOT NULL,
    lat                 DOUBLE PRECISION NOT NULL,
    lng                 DOUBLE PRECISION NOT NULL,
    speed_kmh           REAL DEFAULT 0,
    heading             REAL DEFAULT 0,
    distance_from_prev_m REAL DEFAULT 0,
    device_timestamp    TIMESTAMPTZ NOT NULL,
    server_timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_valid            BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id, server_timestamp)
) PARTITION BY RANGE (server_timestamp);

-- สร้าง Partition สำหรับ 3 เดือนแรก
CREATE TABLE gps_points_2026_09 PARTITION OF gps_points
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE gps_points_2026_10 PARTITION OF gps_points
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE gps_points_2026_11 PARTITION OF gps_points
    FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

-- Indexes สำหรับ gps_points
CREATE INDEX idx_gps_vehicle_time ON gps_points(vehicle_id, server_timestamp DESC);
CREATE INDEX idx_gps_trip ON gps_points(trip_id, server_timestamp ASC);

-- ============================================================
-- View: daily_mileage_summary (สรุประยะทางรายวัน)
-- ============================================================
CREATE OR REPLACE VIEW daily_mileage_summary AS
SELECT
    v.id AS vehicle_id,
    v.plate_number,
    v.name AS vehicle_name,
    t.trip_date,
    COUNT(t.id) AS total_trips,
    COALESCE(SUM(t.total_distance_km), 0) AS total_distance_km,
    MIN(t.started_at) AS first_trip_start,
    MAX(t.ended_at) AS last_trip_end
FROM vehicles v
LEFT JOIN trips t ON t.vehicle_id = v.id
GROUP BY v.id, v.plate_number, v.name, t.trip_date;
```

### 2.3 Index Strategy & Data Growth

| Table | ปริมาณข้อมูลต่อเดือน (10 คัน) | Strategy |
|:---|:---|:---|
| `gps_points` | ~5.2 ล้าน rows (10 คัน × 12 ชม./วัน × 30 วัน × ทุก 5 วินาที) | **Monthly Partition** + Archive หลัง 6 เดือน |
| `trips` | ~600 rows (10 คัน × 2 รอบ/วัน × 30 วัน) | ไม่ต้อง Partition |
| `vehicles` | ~10 rows | ไม่ต้อง Partition |

> [!TIP]
> **Data Retention Policy**: เก็บ `gps_points` แบบ full detail 6 เดือน → Archive ลง cold storage (compressed CSV) → ลบ Partition เก่าทิ้ง
> เก็บ `trips` summary ตลอดไป (ข้อมูลเบา)

---

## 3. Messaging & API Specification

### 3.1 Base URL & Protocols

```
MQTT Broker: tcp://tracking.example.com:1883 (MQTTS TLS: 8883)
REST API:    https://tracking.example.com/api/v1
Content-Type: application/json
Auth:        Authorization: Bearer <token>  (สำหรับ Admin REST API)
             Username: <vehicle_id>, Password: <device_api_key> (สำหรับ MQTT Hardware)
```

**REST API Error Response Format (ทุก Endpoint):**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_COORDINATES",
    "message": "Latitude must be between -90 and 90"
  }
}
```

---

### 3.2 MQTT Telemetry & Messaging Specification (Hardware ⇄ Server)

> **ช่องทางหลัก (Primary Channel) สำหรับการส่งพิกัด GPS แบบ Real-time และการสั่งการระยะไกล**

#### 1. Uplink Telemetry (ส่งพิกัดสดทุก 5 วินาที)
* **Topic:** `vehicles/{vehicle_id}/telemetry`
* **QoS:** `0` (ปกติขณะเคลื่อนที่) หรือ `1` (เมื่อต้องการการันตีการส่ง)
* **Payload (JSON - ขนาดกะทัดรัด ~110-130 bytes):**
```json
{
  "lat": 13.75630,
  "lng": 100.50180,
  "speed": 35.2,
  "heading": 180,
  "ts": 1757925015,
  "acc": true
}
```
* **Payload Fields:**
  | Field | Type | Required | Rules / Description |
  |:---|:---|:---:|:---|
  | `lat` | float | ✅ | -90 ≤ lat ≤ 90 |
  | `lng` | float | ✅ | -180 ≤ lng ≤ 180 |
  | `speed` | float | ✅ | ความเร็วหน่วย km/h (≥ 0) |
  | `heading` | int | ❌ | ทิศทางหัวรถ (0–360) |
  | `ts` | int | ✅ | Unix Timestamp (Epoch seconds) จาก GPS/NTP |
  | `acc` | bool | ✅ | `true` = ติดเครื่องยนต์, `false` = ดับเครื่องยนต์ |

---

#### 2. Uplink Status & LWT (สถานะการเชื่อมต่อ และการแจ้งเตือนเน็ตหลุด)
* **Topic:** `vehicles/{vehicle_id}/status`
* **QoS:** `1` (Retained = true)
* **Online Message (ส่งเมื่ออุปกรณ์ต่อ Broker สำเร็จ):**
  ```json
  { "status": "online", "fw": "1.0.0", "rssi": -65, "ts": 1757925000 }
  ```
* **LWT Message (Last Will and Testament - Broker ส่งให้อัตโนมัติเมื่ออุปกรณ์ขาดการติดต่อ):**
  ```json
  { "status": "offline", "reason": "connection_lost", "ts": 1757925500 }
  ```

---

#### 3. Downlink Commands (Server สั่งการไปยังอุปกรณ์บนรถ)
* **Topic:** `vehicles/{vehicle_id}/command`
* **QoS:** `1`
* **Command Payloads ตัวอย่าง:**
  ```json
  // สั่งเปลี่ยนความถี่การส่งข้อมูล
  { "cmd_id": "cmd_01", "action": "set_interval", "params": { "moving_sec": 3, "idle_sec": 30 } }

  // สั่ง Restart อุปกรณ์
  { "cmd_id": "cmd_02", "action": "reboot" }

  // สั่ง Force Sync OTA
  { "cmd_id": "cmd_03", "action": "check_ota" }
  ```

---

#### 4. Command Response (อุปกรณ์รายงานผลคำสั่งกลับมายัง Server)
* **Topic:** `vehicles/{vehicle_id}/response`
* **Payload:**
  ```json
  { "cmd_id": "cmd_01", "status": "ok", "message": "Interval updated to 3s" }
  ```

---

#### 5. Server-side Ingestion & Processing Logic (สำหรับ MQTT Message):
```
1. Ingestion Service (Fastify MQTT Client) รับ Message จาก vehicles/+/telemetry
2. ตรวจสอบ Payload Format & Value Range (-90<=lat<=90, -180<=lng<=180)
3. ตรวจสอบ GPS Noise Filter:
   - ถ้า speed < 1.5 km/h AND distance_from_prev < 3m → is_valid = false (ไม่นับระยะทาง)
   - ถ้า distance_from_prev > 5000m (5km) ใน interval < 10s → is_valid = false (GPS Jump)
4. Trip Management:
   - ถ้ายังไม่มี trip วันนี้ที่ status='in_progress' → สร้าง trip ใหม่
   - ถ้า acc=false → ปิด trip ปัจจุบัน (status='completed')
5. Distance Calculation (Haversine Formula):
   - distance_m = haversine(prev_lat, prev_lng, lat, lng)
   - ถ้า is_valid → trip.total_distance_km += distance_m / 1000
6. บันทึกข้อมูลลงฐานข้อมูล (INSERT INTO gps_points)
7. อัปเดตตาราง vehicles (last_lat, last_lng, last_speed, last_seen_at)
8. Broadcast พิกัดสดไปยัง WebSocket Server ทันที
```

---

### 3.3 HTTP Telemetry API (Batch & Fallback)

#### `POST /api/v1/telemetry/batch`
> **สำหรับส่งข้อมูลที่เก็บ Buffer ไว้ใน Flash (SPIFFS) ตอนออฟไลน์** (ยิงส่งก้อนเดียวเมื่อกลับมาต่อ 4G ได้)

* **Auth:** `X-Device-Key: <device_api_key>`
* **Request Body:**
```json
{
  "points": [
    { "lat": 13.7563, "lng": 100.5018, "speed": 0, "heading": 0, "ts": 1757925015, "acc": true },
    { "lat": 13.7565, "lng": 100.5020, "speed": 12, "heading": 90, "ts": 1757925020, "acc": true }
  ]
}
```
* **Rules:** สูงสุด 500 จุดต่อ request, เรียงตาม `ts` จากเก่าไปใหม่

---

#### `POST /api/v1/telemetry` (HTTP Fallback)
> สำรองไว้สำหรับอุปกรณ์หรือกรณีที่เครือข่ายบล็อก MQTT Port

* **Auth:** `X-Device-Key: <device_api_key>`
* **Request Body:** `{ "lat": 13.7563, "lng": 100.5018, "speed": 35.2, "heading": 180.0, "timestamp": "...", "acc": true }`
* **Response (200):** `{ "success": true, "data": { "trip_id": "...", "trip_total_km": 12.87 } }`

---

### 3.4 Vehicle API (Admin Dashboard)

| Method | Endpoint | Auth | คำอธิบาย |
|:---:|:---|:---:|:---|
| `GET` | `/api/v1/vehicles` | JWT | ดูรถทั้งหมด (พร้อมตำแหน่งล่าสุด) |
| `GET` | `/api/v1/vehicles/:id` | JWT | ดูรายละเอียดรถคันเดียว |
| `POST` | `/api/v1/vehicles` | JWT (admin) | เพิ่มรถใหม่ (auto-generate API Key & MQTT Credential) |
| `PUT` | `/api/v1/vehicles/:id` | JWT (admin) | แก้ไขข้อมูลรถ |
| `DELETE` | `/api/v1/vehicles/:id` | JWT (admin) | ลบรถ (soft delete) |
| `POST` | `/api/v1/vehicles/:id/command` | JWT (admin) | ส่งคำสั่งไปยังรถผ่าน MQTT (Reboot, Set Interval) |

**`POST /api/v1/vehicles/:id/command` Request Body:**
```json
{
  "action": "set_interval",
  "params": {
    "moving_sec": 3,
    "idle_sec": 20
  }
}
```

**`GET /api/v1/vehicles` Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-...",
      "plate_number": "กข-1234",
      "name": "รถคันที่ 1",
      "route_name": "สาย A",
      "status": "online",
      "last_lat": 13.7563,
      "last_lng": 100.5018,
      "last_speed_kmh": 35.2,
      "last_heading": 180,
      "last_seen_at": "2026-09-15T08:30:15Z",
      "today_total_km": 45.6,
      "today_total_trips": 3,
      "current_trip_km": 12.3
    }
  ]
}
```

---

### 3.5 Trip API (ดูรอบการเดินทาง)

| Method | Endpoint | Auth | คำอธิบาย |
|:---:|:---|:---:|:---|
| `GET` | `/api/v1/vehicles/:id/trips?date=2026-09-15` | JWT | ดูรอบทั้งหมดของรถในวันที่กำหนด |
| `GET` | `/api/v1/trips/:id` | JWT | ดูรายละเอียดรอบเดียว |
| `GET` | `/api/v1/trips/:id/track` | JWT | ดูเส้นทาง GPS points ของรอบนั้น |

**`GET /api/v1/vehicles/:id/trips?date=2026-09-15` Response:**
```json
{
  "success": true,
  "data": {
    "vehicle": { "id": "...", "plate_number": "กข-1234" },
    "date": "2026-09-15",
    "daily_total_km": 87.4,
    "trips": [
      {
        "id": "uuid-...",
        "trip_number": 1,
        "started_at": "2026-09-15T06:00:00Z",
        "ended_at": "2026-09-15T07:45:00Z",
        "total_distance_km": 32.1,
        "total_points": 1290,
        "status": "completed",
        "duration_minutes": 105
      },
      {
        "id": "uuid-...",
        "trip_number": 2,
        "started_at": "2026-09-15T08:10:00Z",
        "ended_at": null,
        "total_distance_km": 12.3,
        "total_points": 540,
        "status": "in_progress",
        "duration_minutes": null
      }
    ]
  }
}
```

**`GET /api/v1/trips/:id/track` Response:**
```json
{
  "success": true,
  "data": {
    "trip_id": "uuid-...",
    "coordinates": [
      [100.5018, 13.7563],
      [100.5020, 13.7565],
      [100.5025, 13.7570]
    ],
    "total_points": 1290,
    "total_distance_km": 32.1
  }
}
```

---

### 3.6 Report API (สรุประยะทาง)

| Method | Endpoint | Auth | คำอธิบาย |
|:---:|:---|:---:|:---|
| `GET` | `/api/v1/reports/daily?date=2026-09-15` | JWT | สรุประยะทางรถทุกคันในวันนั้น |
| `GET` | `/api/v1/reports/range?from=2026-09-01&to=2026-09-15` | JWT | สรุประยะทางช่วงวันที่ |

**`GET /api/v1/reports/daily` Response:**
```json
{
  "success": true,
  "data": {
    "date": "2026-09-15",
    "vehicles": [
      {
        "vehicle_id": "...",
        "plate_number": "กข-1234",
        "name": "รถคันที่ 1",
        "total_trips": 4,
        "total_distance_km": 124.5,
        "first_trip_start": "06:00",
        "last_trip_end": "18:30"
      }
    ],
    "fleet_total_km": 487.2
  }
}
```

---

### 3.7 Route API (เส้นทาง)

| Method | Endpoint | Auth | คำอธิบาย |
|:---:|:---|:---:|:---|
| `GET` | `/api/v1/routes` | JWT | ดูเส้นทางทั้งหมด |
| `GET` | `/api/v1/routes/:id` | JWT | ดูเส้นทาง + จุดจอด |
| `POST` | `/api/v1/routes` | JWT (admin) | สร้างเส้นทางใหม่ |
| `PUT` | `/api/v1/routes/:id` | JWT (admin) | แก้ไขเส้นทาง |

---

### 3.8 WebSocket Events (Real-time)

**Connection:** `wss://tracking.example.com/ws?token=<jwt>`

**Public Connection (ดูตำแหน่งรถ ไม่ต้อง login):** `wss://tracking.example.com/ws/public`

| Event | Direction | Payload | คำอธิบาย |
|:---|:---:|:---|:---|
| `vehicle:location` | Server → Client | `{ vehicleId, lat, lng, speed, heading, tripKm }` | ตำแหน่งรถอัปเดต |
| `vehicle:status` | Server → Client | `{ vehicleId, status, lastSeenAt }` | สถานะเปลี่ยน (online/offline) |
| `trip:started` | Server → Client | `{ vehicleId, tripId, tripNumber }` | รอบใหม่เริ่ม |
| `trip:completed` | Server → Client | `{ vehicleId, tripId, totalKm, duration }` | รอบจบ |
| `subscribe` | Client → Server | `{ vehicleIds: ["uuid-..."] }` | เลือกติดตามเฉพาะรถบางคัน |
| `unsubscribe` | Client → Server | `{ vehicleIds: ["uuid-..."] }` | หยุดติดตาม |

---

## 4. Security & Authentication Design

### 4.1 สถาปัตยกรรม Security

```mermaid
graph LR
    subgraph Device_Auth["Device Authentication & ACL"]
        HW["ESP32 Hardware"]
        CRED["User: vehicle_id\nPass: device_api_key"]
        HW --> CRED
        CRED -->|MQTTS / MQTT + Auth| BROKER["Mosquitto MQTT Broker"]
        BROKER -->|ACL Check: vehicles/vehicle_id/#| ALLOW["Allow Publish/Sub"]
    end

    subgraph User_Auth["User Authentication"]
        ADMIN["Admin Browser"]
        LOGIN["POST /api/v1/auth/login"]
        JWT["JWT Token (24h expiry)"]
        ADMIN --> LOGIN
        LOGIN --> JWT
        JWT -->|Authorization: Bearer| API["Fastify API"]
    end

    subgraph API_Layer["API & Ingestion Security"]
        API --> MW["Auth Middleware"]
        MW --> RBAC["Role Check (admin/viewer)"]
    end
```

### 4.2 Device Authentication & MQTT Access Control List (ACL)

> [!IMPORTANT]
> **ป้องกันการส่งพิกัดปลอมและการดักฟังข้อมูล:**
> 1. อุปกรณ์แต่ละตัวต้องมี API Key ที่ unique (64 ตัวอักษร, cryptographically random)
> 2. Mosquitto ตรวจสอบสิทธิ์ผ่าน Password File / Dynamic Authentication Plugin
> 3. **Topic ACL (Access Control List):** แต่ละอุปกรณ์จะเข้าถึงได้เฉพาะ Topic ของตัวเองเท่านั้น

**ตัวอย่างการตั้งค่า Mosquitto ACL (`/mosquitto/config/acl.conf`):**
```acl
# Backend Ingestion Service (มีสิทธิ์เข้าถึงทุก topic ของรถทุกคัน)
user backend_ingest_service
topic readwrite vehicles/#

# Vehicle 01 (อนุญาตเฉพาะ topic ของตัวเอง)
user vehicle_01
topic readwrite vehicles/vehicle_01/#

# Vehicle 02
user vehicle_02
topic readwrite vehicles/vehicle_02/#
```

**HTTP Device Authentication (สำหรับ Batch / Fallback):**
* อุปกรณ์ส่ง Key ผ่าน Header: `X-Device-Key: <key>`
* Server ตรวจสอบความถูกต้องจาก Database ก่อนรับข้อมูล Batch

```javascript
// Middleware: verifyDeviceKey (สำหรับ HTTP API)
async function verifyDeviceKey(request, reply) {
  const apiKey = request.headers['x-device-key'];
  if (!apiKey) return reply.code(401).send({ success: false, error: { code: 'MISSING_KEY' } });

  const vehicle = await db.query(
    'SELECT id, plate_number, is_active FROM vehicles WHERE device_api_key = $1',
    [apiKey]
  );
  if (!vehicle.rows[0] || !vehicle.rows[0].is_active) {
    return reply.code(403).send({ success: false, error: { code: 'INVALID_KEY' } });
  }
  request.vehicleId = vehicle.rows[0].id;
}
```

### 4.3 User Authentication (Admin Dashboard)

| Endpoint | Method | คำอธิบาย |
|:---|:---:|:---|
| `/api/v1/auth/login` | POST | Login ด้วย email + password → ได้ JWT |
| `/api/v1/auth/me` | GET | ดูข้อมูล user ปัจจุบัน |
| `/api/v1/auth/change-password` | POST | เปลี่ยนรหัสผ่าน |

**JWT Payload:**
```json
{
  "sub": "uuid-user-id",
  "email": "admin@example.com",
  "role": "admin",
  "iat": 1695801600,
  "exp": 1695888000
}
```

### 4.4 Role-Based Access Control (RBAC)

| Resource | admin | viewer | Public (ไม่ login) |
|:---|:---:|:---:|:---:|
| ดูตำแหน่งรถ real-time | ✅ | ✅ | ✅ (WebSocket public) |
| ดูรอบการเดินทาง + ระยะทาง | ✅ | ✅ | ❌ |
| ดูรายงานสรุป | ✅ | ✅ | ❌ |
| เพิ่ม/แก้/ลบ รถ | ✅ | ❌ | ❌ |
| เพิ่ม/แก้/ลบ เส้นทาง | ✅ | ❌ | ❌ |
| จัดการ User | ✅ | ❌ | ❌ |
| Rotate Device API Key | ✅ | ❌ | ❌ |

### 4.5 Transport Security

- **HTTPS (TLS 1.3)** บังคับสำหรับทุก connection (Nginx + Let's Encrypt)
- **WSS** สำหรับ WebSocket (ผ่าน Nginx TLS termination)
- **ESP32 → Server**: HTTPS POST ผ่าน 4G + TLS (ใช้ root CA certificate ฝัง firmware)
- **Rate Limiting**: Hardware endpoint จำกัด 1 request ต่อ 2 วินาทีต่อ Device Key

---

## 5. Error Handling & Edge Cases

### 5.1 สถานการณ์และวิธีรับมือ

```mermaid
graph TD
    A["Edge Case เกิดขึ้น"] --> B{"ประเภท?"}
    
    B -->|สัญญาณ 4G / MQTT หลุด| C["Device Buffer & LWT"]
    C --> C1["Mosquitto ส่ง LWT: vehicles/V01/status (offline) ทันที"]
    C --> C2["ESP32 เก็บพิกัดใน Flash SPIFFS (สูงสุด 10,000 จุด)"]
    C2 --> C3["เมื่อ reconnect สำเร็จ → ส่ง Buffer ผ่าน HTTPS POST /telemetry/batch"]
    C3 --> C4["Server ประมวลผลตาม device timestamp เรียงตามเวลาจริง"]

    B -->|GPS Fix หาย| D["GPS Recovery"]
    D --> D1["ส่ง last known position ซ้ำ พร้อม speed=0"]
    D1 --> D2["Server: is_valid=false ไม่นับระยะทาง"]
    D2 --> D3["เมื่อ GPS Fix กลับมา → ใช้ timestamp interpolation"]

    B -->|อุปกรณ์ดับเครื่อง / ไฟถูกตัด| E["Instant Offline Detection"]
    E --> E1["Broker LWT แจ้งสถานะ Offline ทันทีภายใน 5-10 วินาที"]
    E1 --> E2["Server Broadcast แจ้งเตือนผ่าน WebSocket ทันที"]
    E2 --> E3["ถ้ามี trip in_progress → ปิด trip (status='completed') หลังผ่านไป 15 นาที"]

    B -->|GPS Jump / Teleport| F["Anomaly Filter"]
    F --> F1["distance_from_prev > 5km ใน 10 วินาที?"]
    F1 --> F2["is_valid=false, ไม่นับระยะทาง, log anomaly"]

    B -->|Server / Broker ล่ม| G["Resilience"]
    G --> G1["Device: retry ต่อ MQTT ทุก 10 วินาที (max 5 ครั้ง)"]
    G1 --> G2["ถ้า retry หมด → บันทึก Buffer ใน Flash"]
    G2 --> G3["Server/Broker กลับมา → Flush Buffer ผ่าน HTTP Batch"]
```

### 5.2 รายละเอียดแต่ละสถานการณ์

| สถานการณ์ | สิ่งที่เกิดขึ้น | วิธีรับมือ (Hardware) | วิธีรับมือ (Server) |
|:---|:---|:---|:---|
| **4G / MQTT หลุด** | ส่งข้อมูลไม่ได้ | เก็บ Buffer ใน Flash SPIFFS (สูงสุด 10,000 จุด) → เมื่อต่อติด ส่งผ่าน `POST /telemetry/batch` | Broker ยิง LWT แจ้ง `status='offline'`, Server รับ batch endpoint ประมวลผลตาม `ts` |
| **GPS Fix หาย** (อุโมงค์/อาคาร) | พิกัด lat/lng = 0 หรือค้าง | ส่ง packet พร้อม flag `speed=0` หรือส่งสถานะแจ้งเตือน | ไม่บันทึกจุดที่พิกัดผิดปกติ, ไม่นับระยะทาง |
| **รถดับเครื่อง (ACC OFF)** | อุปกรณ์หยุดส่งพิกัด | ส่ง status `offline (acc_off)` ก่อนเข้าโหมด Deep Sleep | บันทึกปิดรอบ Trip (status='completed') ทันที |
| **ตัดสายไฟ / เครื่องดับกะทันหัน** | การเชื่อมต่อขาดกะทันหัน | — | Mosquitto ส่ง LWT ทันที → Backend อัปเดต `status='offline'` ใน 5–10 วินาที |
| **Trip ค้าง** (ไม่ได้ปิดสวิตช์) | Trip ยัง in_progress | — | Auto-close trip ถ้าไม่มีข้อมูลเกิน 15 นาที |
| **GPS Jump** (พิกัดกระโดด) | ระยะทางผิดพลาด | — | Filter: ถ้า distance > 5km ใน interval < 10 วินาที → `is_valid=false` |
| **เวลาไม่ตรง** | timestamp drift | ESP32 sync เวลาจาก NMEA GPS / NTP Server ทุก 6 ชม. | ปฏิเสธ timestamp ที่ห่างจาก server time > 10 นาที |
| **Broker / Server ล่ม** | ส่งข้อมูลไม่ได้ | Retry เชื่อมต่อทุก 10s → เก็บ Buffer ใน SPIFFS | Docker auto-restart + health check ทุก Service |
| **Database เต็ม** | INSERT ล้มเหลว | — | Monitoring alert เมื่อ disk usage > 80%, auto-create partition เดือนถัดไป |

---

## 6. Deployment & DevOps

### 6.1 Infrastructure Diagram

```mermaid
graph TB
    subgraph VPS["VPS Server (Hetzner CPX21 - 3 vCPU, 4GB RAM)"]
        subgraph Docker["Docker Compose Stack"]
            NGINX_C["nginx:alpine (port 80/443)"]
            MOSQ_C["eclipse-mosquitto:2.0 (port 1883/8883)"]
            API_C["node:20-alpine (Fastify API & Ingest)"]
            PG_C["postgis/postgis:16-3.4 (PostgreSQL)"]
        end
        CERT["Let's Encrypt (certbot)"]
        VOLUMES["Docker Volumes: pg_data, mosq_data, gps_backups"]
    end

    subgraph DNS["Domain & DNS"]
        CF["Cloudflare DNS"]
    end

    subgraph Backup["Backup Strategy"]
        CRON_BK["Daily pg_dump (02:00 AM)"]
        S3["Backblaze B2 / S3 (off-site)"]
    end

    CF --> NGINX_C
    NGINX_C --> API_C
    MOSQ_C --> API_C
    API_C --> PG_C
    PG_C --> VOLUMES
    MOSQ_C --> VOLUMES
    CRON_BK --> PG_C
    CRON_BK --> S3
```

### 6.2 Docker Compose Configuration

```yaml
# docker-compose.yml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./nginx/certbot:/var/www/certbot:ro
    depends_on:
      - api
    restart: always

  mosquitto:
    image: eclipse-mosquitto:2.0
    ports:
      - "1883:1883"    # MQTT (TLS terminated by Mosquitto or direct)
      - "9001:9001"    # MQTT over WebSocket (Optional for Web direct sub)
    volumes:
      - ./mosquitto/config:/mosquitto/config:ro
      - mosq_data:/mosquitto/data
      - mosq_log:/mosquitto/log
    restart: always

  api:
    build: ./backend
    environment:
      DATABASE_URL: postgres://shuttle:${DB_PASSWORD}@postgres:5432/shuttle_tracking
      MQTT_BROKER_URL: mqtt://mosquitto:1883
      MQTT_USERNAME: backend_ingest_service
      MQTT_PASSWORD: ${BACKEND_MQTT_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
      NODE_ENV: production
      PORT: 3000
    depends_on:
      postgres:
        condition: service_healthy
      mosquitto:
        condition: service_started
    restart: always
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  postgres:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_DB: shuttle_tracking
      POSTGRES_USER: shuttle
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pg_data:/var/lib/postgresql/data
      - ./database/migrations:/docker-entrypoint-initdb.d
    ports:
      - "127.0.0.1:5432:5432"  # localhost only
    restart: always
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U shuttle -d shuttle_tracking"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  pg_data:
    driver: local
  mosq_data:
    driver: local
  mosq_log:
    driver: local
```

### 6.3 Nginx Configuration

```nginx
# nginx/nginx.conf
server {
    listen 80;
    server_name tracking.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tracking.example.com;

    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols       TLSv1.3;

    # API proxy
    location /api/ {
        proxy_pass http://api:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Rate limit สำหรับ telemetry endpoint
        limit_req zone=telemetry burst=5 nodelay;
    }

    # WebSocket proxy
    location /ws {
        proxy_pass http://api:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }

    # Frontend static files (ถ้า deploy แยก ให้ชี้ไป CDN/Vercel แทน)
    location / {
        proxy_pass http://api:3000;
    }
}

# Rate limiting zone
limit_req_zone $http_x_device_key zone=telemetry:10m rate=1r/s;
```

### 6.4 Backup Strategy

```bash
#!/bin/bash
# scripts/backup.sh — รันทุกวันเวลา 02:00 AM (cron)

BACKUP_DIR="/opt/shuttle/backups"
DATE=$(date +%Y%m%d_%H%M)
DB_CONTAINER="shuttle-postgres-1"

# 1. Dump database
docker exec $DB_CONTAINER pg_dump -U shuttle -Fc shuttle_tracking \
  > "$BACKUP_DIR/shuttle_$DATE.dump"

# 2. Compress
gzip "$BACKUP_DIR/shuttle_$DATE.dump"

# 3. Upload to off-site (Backblaze B2)
# b2 upload-file shuttle-backups "$BACKUP_DIR/shuttle_$DATE.dump.gz" "daily/shuttle_$DATE.dump.gz"

# 4. Delete local backups older than 7 days
find "$BACKUP_DIR" -name "*.dump.gz" -mtime +7 -delete

echo "Backup completed: shuttle_$DATE.dump.gz"
```

### 6.5 Monitoring & Alerting

| สิ่งที่ Monitor | เครื่องมือ | Alert Condition |
|:---|:---|:---|
| Server uptime & resources | **UptimeRobot** (ฟรี) | Server ไม่ตอบ HTTP 200 เกิน 1 นาที |
| API health | Docker healthcheck + `/health` endpoint | ตอบช้าเกิน 5 วินาที หรือ 500 error |
| Database disk usage | Cron script + `df -h` | Disk usage > 80% |
| Vehicle offline นานผิดปกติ | Application logic | รถ offline เกิน 1 ชั่วโมงในเวลาที่ควรวิ่ง |
| SSL certificate expiry | UptimeRobot | เหลือ < 7 วัน |

### 6.6 CI/CD Pipeline (อนาคต)

```
git push → GitHub Actions → Build Docker Image → Test → Deploy to VPS via SSH
```

สำหรับ MVP ใช้ **manual deploy ผ่าน SSH** ก่อน:
```bash
ssh server "cd /opt/shuttle && git pull && docker compose up -d --build"
```

---

## 7. Testing Strategy

### 7.1 Test Pyramid

```mermaid
graph BT
    E2E["E2E Tests (Manual)
    - ทดสอบ Hardware → Server → Dashboard ครบ loop
    - ทดสอบบนมือถือจริง"]
    INT["Integration Tests (Automated)
    - API endpoint tests (supertest)
    - Database query tests
    - WebSocket connection tests"]
    UNIT["Unit Tests (Automated)
    - Haversine distance calculation
    - GPS noise filter logic
    - Trip start/end logic
    - Validation functions"]
    UNIT --> INT --> E2E
```

### 7.2 Unit Tests

```javascript
// __tests__/distance.test.js
const { haversineDistance } = require('../src/utils/distance');

describe('Haversine Distance', () => {
  test('คำนวณระยะทางระหว่าง 2 จุดใน กทม.', () => {
    // สยาม → อนุสาวรีย์ชัย ≈ 3.2 km
    const d = haversineDistance(13.7463, 100.5347, 13.7649, 100.5382);
    expect(d).toBeGreaterThan(2000);
    expect(d).toBeLessThan(3500);
  });

  test('จุดเดียวกัน ระยะทาง = 0', () => {
    const d = haversineDistance(13.7563, 100.5018, 13.7563, 100.5018);
    expect(d).toBe(0);
  });

  test('พิกัดไม่ถูกต้อง throw error', () => {
    expect(() => haversineDistance(91, 0, 0, 0)).toThrow();
  });
});

// __tests__/gps-filter.test.js
const { isValidPoint } = require('../src/utils/gps-filter');

describe('GPS Noise Filter', () => {
  test('speed < 1.5 km/h + distance < 3m → invalid (GPS drift)', () => {
    const result = isValidPoint(
      { lat: 13.7563, lng: 100.5018, speed: 0.5 },
      { lat: 13.7563, lng: 100.50181 }, // ~1.1m away
    );
    expect(result).toBe(false);
  });

  test('ระยะทาง > 5km ใน 5 วินาที → invalid (GPS jump)', () => {
    const result = isValidPoint(
      { lat: 13.7563, lng: 100.5018, speed: 50 },
      { lat: 14.0, lng: 100.5018 },  // ~27km away
      5 // seconds
    );
    expect(result).toBe(false);
  });

  test('ข้อมูลปกติ → valid', () => {
    const result = isValidPoint(
      { lat: 13.7563, lng: 100.5018, speed: 35 },
      { lat: 13.7565, lng: 100.5020 }, // ~30m away
      5
    );
    expect(result).toBe(true);
  });
});
```

### 7.3 Integration Tests

```javascript
// __tests__/api/telemetry.test.js
const { buildApp } = require('../src/app');

describe('POST /api/v1/telemetry', () => {
  let app;

  beforeAll(async () => { app = await buildApp(); });
  afterAll(async () => { await app.close(); });

  test('ส่งพิกัดสำเร็จ → 200 + trip distance updated', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/telemetry',
      headers: { 'x-device-key': 'test-device-key-001' },
      payload: { lat: 13.7563, lng: 100.5018, speed: 35, heading: 180, timestamp: new Date().toISOString(), acc: true }
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.trip_id).toBeDefined();
  });

  test('ไม่มี X-Device-Key → 401', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/telemetry',
      payload: { lat: 13.7563, lng: 100.5018, speed: 0, timestamp: new Date().toISOString() }
    });
    expect(res.statusCode).toBe(401);
  });

  test('พิกัดไม่ถูกต้อง (lat > 90) → 400', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/telemetry',
      headers: { 'x-device-key': 'test-device-key-001' },
      payload: { lat: 999, lng: 100.5018, speed: 0, timestamp: new Date().toISOString() }
    });
    expect(res.statusCode).toBe(400);
  });
});
```

### 7.4 Load Test

```bash
# ใช้ k6 หรือ artillery จำลอง GPS data จาก 50 คัน ส่งทุก 5 วินาที
# = 10 requests/second sustained

# k6 script: loadtest/telemetry-load.js
# Target: API ต้องรองรับ 10 req/s ที่ p99 latency < 200ms
```

| Metric | Target |
|:---|:---|
| Throughput | 10 req/s sustained (50 คัน × ทุก 5 วินาที) |
| p99 Latency | < 200ms |
| Error Rate | < 0.1% |
| Database Insert Rate | ~600 rows/นาที |

### 7.5 GPS Simulator (สำหรับทดสอบ)

```javascript
// tools/gps-simulator.js
// จำลองรถวิ่งตามเส้นทางจริงจาก GeoJSON

const route = [
  [100.5018, 13.7563], [100.5020, 13.7565], [100.5025, 13.7570], // ...
];

async function simulate(deviceKey, routeCoords, intervalMs = 5000) {
  for (let i = 0; i < routeCoords.length; i++) {
    const [lng, lat] = routeCoords[i];
    const speed = 20 + Math.random() * 40; // 20-60 km/h
    
    await fetch('https://tracking.example.com/api/v1/telemetry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Key': deviceKey
      },
      body: JSON.stringify({
        lat, lng, speed, heading: 0,
        timestamp: new Date().toISOString(),
        acc: true
      })
    });
    
    await sleep(intervalMs);
  }
}
```

---

## 8. Hardware Firmware Specification

### 8.1 ส่วนประกอบฮาร์ดแวร์

| ชิ้นส่วน | Model | ราคาประมาณ | หน้าที่ |
|:---|:---|:---:|:---|
| MCU | **ESP32-S3-WROOM-1** | ~120 บาท | ประมวลผลหลัก, จัดการ Buffer, WiFi (สำหรับ OTA) |
| 4G LTE Module | **A7670C** (SIMCom LTE Cat 1) | ~350 บาท | โมดูลสื่อสาร 4G ไร้สายแท้ (Cat 1) รองรับคลื่นไทยครบ (B1/B3/B5/B8/B40) ส่งข้อมูลเองไม่ต้องพึ่งมือถือคนขับ |
| GPS Module | **NEO-8M** (u-blox) | ~150 บาท | รับพิกัดดาวเทียม GPS/GLONASS |
| GPS Antenna | Active ceramic antenna | ~40 บาท | เพิ่มความแรงและความไวในการรับสัญญาณดาวเทียม |
| 4G Antenna | SMA 4G antenna | ~30 บาท | ขยายสัญญาณ 4G ให้เสถียรในทุกพื้นที่ |
| Power Regulator | LM2596 DC-DC Step Down (12V→5V) | ~30 บาท | แปลงไฟรถยนต์ 12V/24V เป็น 5V จ่ายบอร์ด |
| LED Indicator x 3 | 5mm LED (เขียว, น้ำเงิน, ส้ม/แดง) | ~5 บาท | ไฟแสดงสถานะการทำงาน 3 ดวงแยกอิสระ (Power, GPS, 4G) |
| สวิตช์ | Toggle Switch | ~15 บาท | เปิด-ปิดอุปกรณ์แมนนวล |
| SIM Card | ซิม IoT 4G (AIS / True IoT) | ~49-59 บาท/เดือน | ซิม Data สำหรับส่งข้อมูล GPS (แพ็กเกจ 200-500 MB) |
| เคสกันน้ำ | ABS Waterproof Box (IP65) | ~80 บาท | ป้องกันความชื้น ฝุ่น และความร้อนในห้องเครื่อง/ใต้คอนโซล |
| **รวมต้นทุนฮาร์ดแวร์ต่อคัน** | | **~860 บาท** | จ่ายครั้งเดียว |

---

### 8.2 Pin Connection Diagram

```
ESP32-S3 Pin Mapping:
┌────────────────────────────────────────────────────────┐
│  GPIO 16 (TX2) ──→ A7670C RX (AT Commands & Data)      │
│  GPIO 17 (RX2) ──← A7670C TX                           │
│  GPIO 4  (TX1) ──→ NEO-8M RX (GPS Configuration)       │
│  GPIO 5  (RX1) ──← NEO-8M TX (NMEA Stream)             │
│  GPIO 12       ──→ LED 1 Green (Power / System OK)     │
│  GPIO 13       ──→ LED 2 Blue (GPS Fix Status)         │
│  GPIO 14       ──→ LED 3 Orange/Red (4G & Cloud Sync)  │
│  GPIO 27       ──← ACC Line (12V→3.3V Voltage Divider) │
│  VIN (5V)      ──← LM2596 Output                       │
│  GND            ── Common Ground                        │
└────────────────────────────────────────────────────────┘
```

---

### 8.3 ความถี่การส่งข้อมูลและปริมาณ Data (MQTT Adaptive Telemetry)

เพื่อความแม่นยำสูงสุดในการวัดระยะทาง พร้อมประหยัด Data ซิมและพลังงาน ระบบจะใช้ **Adaptive Interval ร่วมกับโปรโตคอล MQTT**:

| สถานะรถ | เงื่อนไขความเร็ว | ความถี่การส่ง (Interval) | ระยะทางที่รถขยับ | ข้อมูลที่ส่ง |
|:---|:---:|:---:|:---:|:---|
| 🚗 **รถกำลังวิ่ง (Moving)** | Speed > 5 km/h | **ทุก 5 วินาที** | ~30-70 เมตร | Publish พิกัดเต็ม (`lat, lng, speed, heading, ts, acc`) |
| 🅿️ **รถจอดรอ / ติดไฟแดง (Idling)** | Speed ≤ 5 km/h | **ทุก 30 วินาที** | 0-2 เมตร | Publish พิกัด (`speed=0`) ป้องกัน GPS Drift |
| 🔴 **รถดับเครื่อง (ACC OFF)** | กุญแจ OFF | **หยุดส่ง (Deep Sleep)** | 0 เมตร | ส่ง Status `offline` ผ่าน MQTT แล้วเข้า Sleep ทันที |

#### ผลลัพธ์การประหยัด Data ซิมด้วย MQTT (คิดจากการวิ่ง 8 ชม./วัน):
* **ขนาด Payload MQTT เฉลี่ย:** ~110-130 bytes ต่อ Message (เทียบกับ HTTP เดิมที่ ~800–1,200 bytes)
* **คำนวณรายวัน (วิ่ง 5 ชม. + จอด 3 ชม.):**
  - วิ่ง 5 ชม. = 5 × 720 ข้อความ = 3,600 ข้อความ
  - จอด 3 ชม. = 3 × 120 ข้อความ = 360 ข้อความ
  - รวม 3,960 ข้อความ/วัน × 130 bytes = **~515 KB/วัน**
* **สรุปปริมาณ Data ต่อเดือน:** ~515 KB × 30 วัน = **~15.4 MB/เดือน/คัน** (ประหยัดกว่า HTTP เดิม 80% ปลอดภัยและเหลือเฟือสำหรับซิมแพ็กเกจ 200–500 MB)

---

### 8.4 Firmware MQTT Stack & State Machine Logic

โมดูล **A7670C 4G LTE** มี Hardware MQTT Stack ในตัว สามารถสั่งงานผ่าน Serial AT Commands ของ ESP32 ได้โดยตรง:

#### 1. คำสั่ง AT Commands หลักสำหรับ MQTT (A7670C):
```text
// 1. เริ่มต้นระบบ MQTT
AT+CMQTTSTART

// 2. ขอ Client ID สำหรับรถ (เช่น vehicle_01)
AT+CMQTTACCQ=0,"vehicle_01"

// 3. กำหนด LWT (Last Will and Testament) ให้ Broker แจ้งเมื่อหลุด
AT+CMQTTWILLTOPIC=0,22              // ความยาว topic: "vehicles/vehicle_01/status"
> vehicles/vehicle_01/status
AT+CMQTTWILLMSG=0,45,1              // ความยาว payload, QoS=1
> {"status":"offline","reason":"connection_lost"}

// 4. เชื่อมต่อ MQTT Broker ด้วย Username & Password
AT+CMQTTCONNECT=0,"tcp://tracking.example.com:1883",60,1,"vehicle_01","<device_api_key>"

// 5. Subscribe รับคำสั่งระยะไกล (Downlink Commands)
AT+CMQTTSUB=0,23,1                  // "vehicles/vehicle_01/command", QoS=1
> vehicles/vehicle_01/command

// 6. Publish ข้อมูล Telemetry
AT+CMQTTTOPIC=0,25                  // "vehicles/vehicle_01/telemetry"
> vehicles/vehicle_01/telemetry
AT+CMQTTPAYLOAD=0,88                // ความยาว Payload
> {"lat":13.75630,"lng":100.50180,"speed":35.2,"heading":180,"ts":1757925015,"acc":true}
AT+CMQTTPUB=0,0,60                  // Publish QoS 0
```

#### 2. Firmware State Machine:

```
┌──────────────────────────────────────────────────────────────┐
│                    FIRMWARE STATE MACHINE                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────┐      ACC ON        ┌──────────┐                 │
│  │  SLEEP  │ ─────────────────→ │  INIT    │                 │
│  │(Deep    │                    │- Init 4G │                 │
│  │ Sleep)  │                    │- Wait GPS│                 │
│  └─────────┘                    └────┬─────┘                 │
│       ↑                              │ GPS & 4G Ready        │
│       │                              ↓                       │
│       │                     ┌────────────────┐               │
│       │                     │  CONNECT MQTT  │               │
│       │                     │- Set LWT Msg   │               │
│       │                     │- Auth & Sub Cmd│               │
│       │                     └────────┬───────┘               │
│       │                              │                       │
│       │                              ↓                       │
│       │                     ┌────────────────┐               │
│       │                     │    TRACKING    │←──┐           │
│       │                     │- Moving: 5s    │   │           │
│       │                     │- Idling: 30s   │   │ MQTT Pub  │
│       │                     │- Check In Cmds │   │ Success   │
│       │                     │- Pub Telemetry │───┘           │
│       │                     │- Update LEDs   │               │
│       │      ACC OFF        └───────┬────────┘               │
│       │←────────────────────────────┘                        │
│                                                              │
│  กรณีเชื่อมต่อล้มเหลว / สัญญาณ 4G หลุด:                      │
│  → บันทึกพิกัดลง Local Buffer (SPIFFS Flash สูงสุด 10,000 จุด)│
│  → Retry ต่อ MQTT ทุก 10 วินาที                             │
│  → เมื่อต่อเน็ตได้:                                          │
│     - ส่งพิกัดสดต่อทาง MQTT ทันที                             │
│     - ทยอยส่ง Buffer ค้างผ่าน HTTPS POST /telemetry/batch    │
│                                                              │
│  ระบบเสริม:                                                  │
│  - Sync เวลา NTP/GPS: ทุก 6 ชั่วโมง                          │
│  - Check OTA Update: เมื่อได้รับคำสั่งผ่าน MQTT หรือทุก 24 ชม. │
└──────────────────────────────────────────────────────────────┘
```

---

### 8.5 ระบบไฟแสดงสถานะ 3 ดวง (LED Panel & Troubleshooting Guide)

การแยก LED 3 ดวงช่วยให้คนขับและช่างซ่อมบำรุง **วินิจฉัยปัญหาหน้างานได้ทันที** โดยไม่ต้องต่อคอมพิวเตอร์:

```
┌────────────────────────────────────────────────────────┐
│               ไฟแสดงสถานะ 3 ดวง (LED Panel)             │
│                                                        │
│   🟢 POWER           🔵 GPS            🟠 4G / SERVER   │
│   [ ไฟเลี้ยง ]       [ ดาวเทียม ]        [ ส่งข้อมูล ]   │
└────────────────────────────────────────────────────────┘
```

| LED | สี | สถานะ ON (ติดค้าง) | สถานะ กะพริบ (Blinking) | สถานะ OFF (ดับสนิท) |
|:---|:---:|:---|:---|:---|
| **LED 1: Power** | 🟢 เขียว | ระบบเปิด / ไฟเลี้ยง 5V ปกติ | อุปกรณ์อยู่ในโหมดตั้งค่า / กำลังบูต | สวิตช์ปิดอยู่ / ฟิวส์ขาด / ไฟไม่เข้า |
| **LED 2: GPS** | 🔵 น้ำเงิน | **GPS Fixed** (รับสัญญาณดาวเทียมได้แล้ว ≥ 4 ดวง) | **Searching** (กำลังค้นหาดาวเทียม / สัญญาณอ่อน) | โมดูล GPS ชำรุด หรือสายอากาศหลุด |
| **LED 3: 4G/Cloud** | 🟠 ส้ม | **Connected & Sync** (ต่อ 4G และยิงข้อมูลขึ้น Server สำเร็จ) | **Connecting** (กำลังเกาะสัญญาณ 4G / ต่อ Server) | ซิมเงินหมด / ไม่มีสัญญาณ 4G / ซิมหลุด |

#### ตารางวิเคราะห์ปัญหาหน้างาน (Quick Diagnosis):
- 🟢 ติด / 🔵 ติด / 🟠 ติด ➡️ **ระบบทำงานสมบูรณ์ 100%** ข้อมูลขึ้นแผนที่สด
- 🟢 ดับ ทุกดวง ➡️ **เช็คไฟรถยนต์**: สวิตช์ปิด, ฟิวส์ขาด, หรือขั้วแบตเตอรี่หลุด
- 🟢 ติด / 🔵 **กะพริบ** / 🟠 ติด ➡️ **จุดอับ GPS**: รถจอดในอาคาร/ชั้นใต้ดิน หรือเสา GPS ถูกโครงเหล็กบัง
- 🟢 ติด / 🔵 ติด / 🟠 **กะพริบ** ➡️ **ปัญหาเครือข่าย**: ซิม Data หมด, ซิมหมดอายุ, หรืออยู่ในพื้นที่ไม่มีคลื่น 4G
- 🟢 ติด / 🔵 ติด / 🟠 ติด แต่เว็บไม่ขยับ ➡️ **ปัญหาที่ Server/Database**: กล่องส่งออกปกติ แต่ Server ปลายทางค้าง

---

### 8.6 แผนการจัดการและอายุการใช้งานซิม IoT (SIM Lifecycle & Operation Plan)

#### 1. ความทนทานของซิมการ์ด:
- **ซิมกายภาพ (Industrial Plastic Chip)**: มีอายุการใช้งาน **5–10 ปี** ทนต่อแรงสั่นสะเทือนและความร้อนในห้องโดยสารรถยนต์ (-25°C ถึง +85°C)

#### 2. แผนการเลือกแพ็กเกจซิม:
- **ปริมาณ Data ที่ใช้จริง**: ~15–30 MB/เดือน/คัน (สำหรับวิ่ง 8–12 ชม./วัน ด้วยระบบ MQTT Adaptive Telemetry)
- **แพ็กเกจที่แนะนำ**: **IoT SIM 200 MB – 500 MB** (AIS Business IoT / True IoT) ค่าบริการประมาณ **39–59 บาท/เดือน/เบอร์** (มีโควต้าเหลือเฟือสำหรับ Retry และ Batch Buffer)

#### 3. มาตรการป้องกันปัญหาซิมดับ / ข้อมูลหยุดส่ง:
- **Corporate Auto-Renew**: สมัครในนามนิติบุคคล/องค์กร ตัดยอดรวมผ่านบัญชีธนาคาร/บัตรเครดิตอัตโนมัติ ป้องกันปัญหาซิมหมดอายุจากการลืมเติมเงิน
- **IoT SIM Portal Dashboard**: ใช้ระบบจัดการซิมรวมของค่ายมือถือ ตรวจสอบปริมาณ Data คงเหลือของรถทุกคันได้ในหน้าเดียว
- **Server-side Offline Alert**: ตั้งระบบแจ้งเตือน Admin ทันที หากรถคันใดไม่มีข้อมูลส่งเข้ามาเกิน 15 นาทีในระหว่างเวลาทำการ

---

### 8.7 OTA (Over-the-Air) Update

- ESP32 เช็ค firmware version กับ Server ทุก 24 ชั่วโมง
- อัปเดตผ่าน WiFi เมื่อรถจอดที่สถานี (ที่มี WiFi) เพื่อประหยัด 4G data
- Endpoint: `GET /api/v1/firmware/check?current_version=1.0.0`
- ถ้ามี version ใหม่ → download `.bin` file → flash OTA → reboot

---

### 8.8 แผนผังและแนวทางการจ่ายไฟในรถยนต์ (Vehicle Power Supply & Wiring Guide)

> [!IMPORTANT]
> **ข้อกำหนดระบบไฟ (Power Requirements):**
> 1. **แรงดันไฟ:** 5V DC จ่ายเข้าขา VIN ของบอร์ด ESP32 และโมดูล 4G A7670C
> 2. **กระแสไฟขั้นต่ำ:** **ต้องจ่ายได้ 2A – 3A** เนื่องจากโมดูล 4G มีจังหวะยิงสัญญาณที่กินกระแสกระชาก (Burst Peak Current) สูงถึง ~2A หากใช้ตัวแปลงไฟ 1A ทั่วไป บอร์ดจะรีเซ็ตตัวเอง (Brownout) ทันทีที่ส่งข้อมูล

```mermaid
graph TD
    subgraph Method1["วิธีที่ 1: กล่องฟิวส์ Fuse Tap (แนะนำสำหรับใช้งานจริง - Production)"]
        FUSE["กล่องฟิวส์รถยนต์ (12V/24V)"] -->|Fuse Tap + ฟิวส์ 3A-5A| CONV["โมดูลแปลงไฟ DC-DC 12V/24V→5V 3A"]
        CONV -->|5V 3A| BOX["กล่องติดตามรถ (ESP32 + 4G)"]
        ACC_LINE["สายสวิตช์กุญแจ ACC"] -->|Voltage Divider 3.3V| GPIO27["GPIO 27 (ตรวจจับสถานะติด/ดับเครื่อง)"]
    end

    subgraph Method2["วิธีที่ 2: ช่องจุดบุหรี่ / Car Charger (แนะนำสำหรับช่วงทดสอบ - Prototype)"]
        CIG["ช่องจุดบุหรี่ 12V"] -->|หัวชาร์จ 5V 2.4A-3A คุณภาพสูง| BOX2["กล่องติดตามรถ (ผ่านสาย USB)"]
    end
```

#### 1. เปรียบเทียบวิธีการจ่ายไฟ

| วิธีการ | อุปกรณ์ที่ใช้ | ข้อดี | ข้อจำกัด | ความเหมาะสม |
|:---|:---|:---|:---|:---|
| **วิธีที่ 1: ต่อกล่องฟิวส์ (Fuse Tap + Buck Converter)** | Fuse Tap Kit + ตัวแปลงไฟ Step Down 12V/24V เป็น 5V 3A | ซ่อนสายมิดชิดใต้คอนโซล, ปลอดภัยมีฟิวส์แยก, คนขับแอบถอดปลั๊กไม่ได้, รองรับสาย ACC ตรวจจับดับเครื่องอัตโนมัติ | ต้องใช้ช่างหรือผู้รู้เปิดฝากล่องฟิวส์รถ (ติดตั้ง ~15 นาที/คัน) | ⭐ **แนะนำที่สุดสำหรับการติดตั้งใช้งานจริง (Fleet Production)** |
| **วิธีที่ 2: เสียบช่องจุดบุหรี่ (Car Charger)** | หัวชาร์จรถยนต์ 5V 2.4A - 3A (Anker / Ugreen / Baseus) + สาย USB | เสียบปุ๊บติดปั๊บ, ไม่ยุ่งกับระบบไฟรถ, ย้ายสลับคันได้ทันที | เสี่ยงคนขับดึงปลั๊กออก หรือแย่งช่องไปชาร์จมือถือ | ⭐ **แนะนำสำหรับช่วงทดสอบ Prototype (MVP 1-2 คัน)** |
| **วิธีที่ 3: เสริมแบตเตอรี่สำรองในตัว (Backup Battery)** | แบตเตอรี่ **LiFePO4** (3.2V) + วงจรชาร์จ Step-up 5V | เครื่องทำงานต่อได้ 2–4 ชม. แม้ดับเครื่อง หรือกรณีถูกตัดสายไฟ | ต้องจัดการวงจรชาร์จเพิ่ม | เหมาะสำหรับระบบที่ต้องการ Anti-Theft Alert |

#### 2. แผนผังการต่อสายไฟสำหรับวิธีที่ 1 (Fuse Tap Wiring Diagram):
```
[ขั้วแบตรถยนต์ 12V/24V] ─────[ Fuse Tap + ฟิวส์ 3A ]──→ ขั้ว VCC IN (+) ของโมดูลแปลงไฟ
[โครงตัวถังรถยนต์ GND]  ─────────────────────────────────→ ขั้ว GND (-) ของโมดูลแปลงไฟ
[สายสวิตช์กุญแจ ACC]   ─────[ วงจรแบ่งแรงดัน 3.3V ]────→ ขา GPIO 27 (ESP32 ตรวจจับ ACC)

[โมดูลแปลงไฟ 5V 3A OUT] ─────────────────────────────────→ ขา 5V / VIN (ESP32 + A7670C)
```

> [!CAUTION]
> **ความปลอดภัยเรื่องแบตเตอรี่ในรถยนต์ไทย:**
> หากต้องการใส่แบตเตอรี่สำรองในกล่อง **ห้ามใช้แบตเตอรี่ Li-ion / Lipo ทั่วไป** เนื่องจากห้องโดยสารรถที่จอดกลางแดดเมืองไทยอาจร้อนเกิน 55–65°C ซึ่งเสี่ยงแบตบวมหรือติดไฟ **แนะนำให้ใช้แบตเตอรี่ชนิด LiFePO4 (ลิเธียมไอเอิร์นฟอสเฟต)** เท่านั้น เพราะทนอุณหภูมิได้สูงถึง 70–80°C และไม่ระเบิด

---

## 9. ต้นทุนละเอียดและ TCO

### 9.1 ต้นทุนตั้งต้น (One-time Cost) — สำหรับระบบ 10 คัน

| รายการ | จำนวน | ราคาต่อหน่วย | รวม |
|:---|:---:|:---:|:---:|
| ชุดอุปกรณ์ GPS (ESP32-S3 + A7670C 4G + NEO-8M + เสาอากาศ + LED 3 ดวง + กล่องกันน้ำ) | 10 | ~860 บาท | **8,600 บาท** |
| Domain name (.com) | 1 | ~400 บาท/ปี | **400 บาท** |
| VPS Setup (Hetzner CPX21) | 1 | ฟรี (จ่ายรายเดือน) | **0 บาท** |
| **รวมตั้งต้น** | | | **~9,000 บาท** |

### 9.2 ต้นทุนรายเดือน (Monthly Recurring)

| รายการ | จำนวน | ราคาต่อหน่วย/เดือน | รวม/เดือน |
|:---|:---:|:---:|:---:|
| ซิม IoT 4G (แพ็กเกจ 200-500 MB ต่ออายุอัตโนมัติ) | 10 | ~49 บาท | **490 บาท** |
| VPS Server (Hetzner CPX21: 3vCPU, 4GB RAM, 80GB) | 1 | ~310 บาท (~€7.91) | **310 บาท** |
| SSL Certificate (Let's Encrypt) | 1 | ฟรี | **0 บาท** |
| Map Tiles (OpenStreetMap / Leaflet) | — | ฟรี | **0 บาท** |
| DNS & CDN (Cloudflare Free) | 1 | ฟรี | **0 บาท** |
| Off-site Backup (Backblaze B2: ~1GB) | 1 | ~1 บาท | **~1 บาท** |
| **รวมรายเดือน** | | | **~801 บาท** |

### 9.3 TCO (Total Cost of Ownership)

| ระยะเวลา | ต้นทุนตั้งต้น | ต้นทุนรายเดือน × เดือน | รวม TCO |
|:---|:---:|:---:|:---:|
| **ปีที่ 1** | 9,000 | 801 × 12 = 9,612 | **~18,612 บาท** |
| **ปีที่ 2** | 400 (ต่อ domain) | 801 × 12 = 9,612 | **~10,012 บาท** |
| **ปีที่ 3** | 400 (ต่อ domain) | 801 × 12 = 9,612 | **~10,012 บาท** |
| **3 ปีรวม (สำหรับรถ 10 คัน)** | | | **~38,636 บาท** (ตกคันละ ~107 บาท/เดือน) |

> [!NOTE]
> **ค่าพัฒนาซอฟต์แวร์ไม่ได้รวมอยู่ในตาราง** เพราะขึ้นอยู่กับว่าพัฒนาเอง (ต้นทุนเวลา) หรือจ้างทีม (ต้นทุนเงิน ประมาณ 50,000 - 150,000 บาทสำหรับ MVP)

---

## 10. Timeline สมจริง (Realistic Roadmap)

```mermaid
gantt
    title Realistic Development Roadmap - Shuttle Tracking System
    dateFormat  YYYY-MM-DD

    section Phase 0: สั่งซื้ออุปกรณ์ (ทำขนานกับ Phase 1)
    สั่งซื้อ ESP32 + A7670C + NEO-8M + อุปกรณ์เสริม : hw_order, 2026-09-01, 3d
    รอจัดส่ง + ตรวจรับ : hw_deliver, after hw_order, 10d

    section Phase 1: ฐานข้อมูล + Backend Core (สัปดาห์ 1-2)
    Setup Project Structure (backend + frontend) : p1_1, 2026-09-01, 2d
    สร้าง Database Schema + Migration : p1_2, after p1_1, 2d
    สร้าง Telemetry API (POST /telemetry) : p1_3, after p1_2, 3d
    สร้าง Distance Engine + GPS Filter : p1_4, after p1_3, 3d
    Unit Tests (distance, filter, validation) : p1_5, after p1_4, 2d

    section Phase 2: Dashboard Frontend (สัปดาห์ 3-4)
    หน้า Login + Auth System : p2_1, after p1_5, 2d
    หน้า Fleet Map (ดูรถทุกคันบนแผนที่) : p2_2, after p2_1, 4d
    หน้ารายละเอียดรถ + เส้นทาง (Vehicle Detail) : p2_3, after p2_2, 3d
    หน้าสรุปรอบ + ระยะทางรายวัน (Trip Report) : p2_4, after p2_3, 3d
    WebSocket Real-time Integration : p2_5, after p2_4, 2d

    section Phase 3: GPS Simulator + Integration Test (สัปดาห์ 5)
    สร้าง GPS Simulator Tool : p3_1, after p2_5, 2d
    Integration Tests (API + DB + WebSocket) : p3_2, after p3_1, 3d
    Load Test (จำลอง 10+ คัน) : p3_3, after p3_2, 2d

    section Phase 4: Hardware + Firmware (สัปดาห์ 5-6, ทำขนานกับ Phase 3)
    ประกอบวงจร ESP32 + 4G + GPS : p4_1, after hw_deliver, 3d
    เขียน Firmware (GPS read + HTTP POST + LED) : p4_2, after p4_1, 4d
    ทดสอบ Hardware → Server ครบ loop : p4_3, after p4_2, 3d

    section Phase 5: Deploy + UAT (สัปดาห์ 7)
    Deploy to VPS (Docker Compose) : p5_1, after p3_3, 2d
    ทดสอบ End-to-End ด้วยรถจริง 1 คัน : p5_2, after p5_1, 3d
    แก้ Bug + ปรับปรุง : p5_3, after p5_2, 3d

    section Phase 6: Go-Live (สัปดาห์ 8)
    ติดตั้งอุปกรณ์บนรถทุกคัน : p6_1, after p5_3, 2d
    Monitor + Support ช่วง Go-Live : p6_2, after p6_1, 5d

    section Milestone
    MVP Ready (Software) : milestone, after p3_3, 0d
    Hardware Prototype Ready : milestone, after p4_3, 0d
    Production Go-Live : milestone, after p6_1, 0d
```

### Timeline Summary

| Phase | ระยะเวลา | Output |
|:---|:---:|:---|
| Phase 0: สั่งซื้อฮาร์ดแวร์ | ~2 สัปดาห์ (ทำขนาน) | อุปกรณ์พร้อมใช้ |
| Phase 1: Backend Core | ~2 สัปดาห์ | API + DB + Distance Engine |
| Phase 2: Frontend Dashboard | ~2 สัปดาห์ | Admin Dashboard พร้อมใช้ |
| Phase 3: Simulator + Test | ~1 สัปดาห์ | ทดสอบครบ + Load Test ผ่าน |
| Phase 4: Hardware Firmware | ~1.5 สัปดาห์ (ทำขนาน) | อุปกรณ์ GPS ส่งข้อมูลได้ |
| Phase 5: Deploy + UAT | ~1 สัปดาห์ | ทดสอบกับรถจริง |
| Phase 6: Go-Live | ~1 สัปดาห์ | ระบบ Production |
| **รวม** | **~8 สัปดาห์ (2 เดือน)** | **Production-ready** |

> [!IMPORTANT]
> **ต่างจากเอกสารเดิมอย่างไร:**
> - เอกสารเดิมประมาณ 1 เดือน → **เพิ่มเป็น 2 เดือน** เพื่อความสมจริง
> - เพิ่ม **Phase UAT** (User Acceptance Testing) ที่ไม่มีในเอกสารเดิม
> - เพิ่ม **Phase Bug Fix** ที่ไม่มีในเอกสารเดิม
> - **สั่งซื้อฮาร์ดแวร์ตั้งแต่วันแรก** ทำขนานกับพัฒนาซอฟต์แวร์ (ไม่รอจนซอฟต์แวร์เสร็จ)

---

## Checklist: จุดอ่อนจาก Critical Review — แก้ไขครบหมดแล้วหรือไม่?

| จุดอ่อนจาก Critical Review | สถานะ | Section ที่แก้ |
|:---|:---:|:---|
| ❌ ไม่มี Database Schema | ✅ **แก้แล้ว** | Section 2 — ER Diagram + SQL + Indexes + Partitioning |
| ❌ ไม่มี API Specification | ✅ **แก้แล้ว** | Section 3 — ทุก Endpoint + Payload + Validation + WebSocket Events |
| ❌ ไม่มี Security & Auth | ✅ **แก้แล้ว** | Section 4 — Device Key + JWT + RBAC + TLS + Rate Limiting |
| ❌ ไม่มี Error Handling | ✅ **แก้แล้ว** | Section 5 — 8 Edge Cases + Flowchart + Code ตัวอย่าง |
| ❌ ไม่มี Deployment Plan | ✅ **แก้แล้ว** | Section 6 — Docker Compose + Nginx + Backup + Monitoring |
| ❌ ไม่มี Testing Strategy | ✅ **แก้แล้ว** | Section 7 — Unit + Integration + Load Test + GPS Simulator |
| ❌ ไม่มี Firmware Spec | ✅ **แก้แล้ว** | Section 8 — Pin Diagram + State Machine + LED + OTA |
| ❌ ต้นทุนหยาบเกินไป | ✅ **แก้แล้ว** | Section 9 — รายละเอียด + TCO 3 ปี |
| ❌ Timeline ไม่สมจริง | ✅ **แก้แล้ว** | Section 10 — 8 สัปดาห์ + UAT + Bug Fix + Hardware ขนาน |
| ❌ "100% Feasibility" ใจกว้างเกินไป | ✅ **แก้แล้ว** | Section 1.2 — ตัดสินใจเทคโนโลยีชัดเจน ไม่มีอ้าง 100% |
