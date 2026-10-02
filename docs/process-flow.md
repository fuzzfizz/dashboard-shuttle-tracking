# 🚐 กระบวนการทำงานตั้งแต่ฮาร์ดแวร์จนถึงเว็บ (End-to-End Process Flow)

เอกสารนี้แสดงโฟลว์การทำงานตั้งแต่การเก็บพิกัดดาวเทียมของกล่อง GPS บนรถ จนถึงการแสดงผลสดบน Web Dashboard

---

## 1. Flowchart สถาปัตยกรรมและการไหลของข้อมูล (System Architecture Flow)

```mermaid
flowchart TD
    %% Hardware Layer
    subgraph HW["1. ฮาร์ดแวร์บนรถ (Vehicle IoT Box)"]
        GPS["🛰️ GPS Module (อ่านพิกัด Lat, Lng, Speed)"]
        MCU["📟 MCU / ESP32 (แปลงเป็น JSON Data)"]
        GPS -->|NMEA Data| MCU
    end

    %% Network & Broker
    subgraph BROKER["2. ตัวกลางรับส่งข้อมูล (Message Broker)"]
        MQTT["📡 Eclipse Mosquitto Broker (Port 1883)\nTopic: vehicles/{id}/telemetry"]
    end

    %% Backend & Processing
    subgraph BACKEND["3. แบ็กเอนด์และระบบประมวลผล (Backend Processing)"]
        INGEST["⚡ MQTT Ingest Service\n(ตรวจเช็กความถูกต้อง/กรอง Noise)"]
        CALC["📏 Distance & Trip Engine\n(คำนวณระยะทาง Haversine & เช็กจุดจอด)"]
        BROADCASTER["📢 WebSocket Broadcaster Service"]
        
        INGEST --> CALC
        CALC --> BROADCASTER
    end

    %% Database
    subgraph STORAGE["4. ฐานข้อมูลเชิงพื้นที่ (Spatial Database)"]
        DB[("🐘 PostgreSQL 16 + PostGIS 3.4\n- gps_points (Partitioned)\n- trips & vehicles")]
    end

    %% Frontend & Clients
    subgraph CLIENT["5. เว็บแดชบอร์ด (Next.js 15 Web Dashboard)"]
        WS_SUB["🔌 WebSocket Client (/ws/public, /ws)"]
        MAP["🗺️ Interactive Map (Leaflet.js)\nหมุดรถขยับสด & สรุปข้อมูล"]
        WS_SUB --> MAP
    end

    %% Connections
    MCU -->|"MQTT QoS 1 (4G/LTE)"| MQTT
    MCU -.->|"HTTP POST Fallback (Port 3000)"| INGEST
    MQTT -->|Subscribe Telemetry| INGEST
    CALC -->|บันทึกพิกัดและประวัติการวิ่ง| DB
    BROADCASTER -->|"WebSocket Stream (Real-time Push)"| WS_SUB
```

---

## 2. ลำดับเวลาการทำงาน (Sequence Diagram)

```mermaid
sequenceDiagram
    autonumber
    actor Driver as 🚐 รถรับ-ส่ง
    participant GPS as 🛰️ GPS Module
    participant MCU as 📟 ESP32/4G Module
    participant Broker as 📡 MQTT Mosquitto
    participant Backend as ⚡ Fastify Backend
    participant DB as 🐘 PostgreSQL / PostGIS
    participant Web as 🌐 Web Dashboard (Browser)

    Note over Web,Backend: ผู้ใช้เปิดหน้าเว็บและต่อ WebSocket ค้างไว้ (/ws/public)
    Web->>Backend: เชื่อมต่อ WebSocket Connection

    Note over Driver,MCU: รถกำลังวิ่งบนเส้นทาง
    GPS->>MCU: ส่งพิกัดดาวเทียม (NMEA: Lat, Lng, Speed, Course)
    MCU->>MCU: แพ็กข้อมูลเป็น JSON Telemetry Payload
    MCU->>Broker: MQTT Publish topic: vehicles/{id}/telemetry (QoS 1)
    
    Broker->>Backend: Forward ข้อความให้ Backend (MQTT Subscriber)
    
    rect rgb(240, 248, 255)
        Note over Backend,DB: ประมวลผลและเก็บข้อมูล
        Backend->>Backend: กรองสัญญาณกระโดด (GPS Jitter Filter)
        Backend->>Backend: คำนวณระยะทางที่เพิ่มขึ้น (Haversine Formula)
        Backend->>Backend: ตรวจสอบรัศมีจุดจอดรถ (Bus Stop Detection <= 50m)
        Backend-)DB: บันทึกลงตาราง gps_points และอัปเดตสถานะรถ
    end

    rect rgb(245, 255, 245)
        Note over Backend,Web: กระจายพิกัดสดทันที
        Backend->>Web: WebSocket Broadcast: event 'location:update'
        Web->>Web: อัปเดตตำแหน่งหมุดรถบนแผนที่ (Leaflet Animation)
        Web->>Web: แสดงความเร็วสด และระยะทางรวมประจำวัน
    end
```

---

## 3. รายละเอียด Payload ข้อมูล (Data Contract)

### 3.1 ข้อมูลพิกัดที่ฮาร์ดแวร์ส่ง (Telemetry Payload)
```json
{
  "lat": 13.7563,
  "lng": 100.5018,
  "speed": 35.5,
  "heading": 180,
  "timestamp": "2026-09-16T08:30:00.000Z",
  "acc": true
}
```

### 3.2 ข้อมูลที่สตรีมผ่าน WebSocket ให้หน้าเว็บ (Broadcast Payload)
```json
{
  "event": "location:update",
  "data": {
    "vehicle_id": "d0000000-0000-0000-0000-000000000001",
    "plate_number": "กข-1234",
    "lat": 13.7563,
    "lng": 100.5018,
    "speed": 35.5,
    "heading": 180,
    "status": "online",
    "trip_id": "t1000000-0000-0000-0000-000000000001",
    "daily_distance_km": 14.2,
    "updated_at": "2026-09-16T08:30:00.000Z"
  }
}
```
