-- ============================================================
-- Migration: 001_initial_schema.sql
-- Shuttle Tracking System (PostgreSQL 16 + PostGIS 3.4)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================
-- Table: users (ผู้ดูแลระบบและเจ้าหน้าที่)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20) NOT NULL DEFAULT 'viewer'
                  CHECK (role IN ('admin', 'viewer')),
    display_name  VARCHAR(100),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================================
-- Table: routes (เส้นทางเดินรถ)
-- ============================================================
CREATE TABLE IF NOT EXISTS routes (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name          VARCHAR(100) NOT NULL,
    description   TEXT,
    route_geojson JSONB,          -- GeoJSON LineString / Feature
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Table: route_stops (จุดจอดบนเส้นทาง)
-- ============================================================
CREATE TABLE IF NOT EXISTS route_stops (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id      UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    name          VARCHAR(100) NOT NULL,
    lat           DOUBLE PRECISION NOT NULL,
    lng           DOUBLE PRECISION NOT NULL,
    stop_order    INTEGER NOT NULL,
    radius_meters INTEGER NOT NULL DEFAULT 50,
    UNIQUE(route_id, stop_order)
);

CREATE INDEX IF NOT EXISTS idx_route_stops_route_id ON route_stops(route_id);

-- ============================================================
-- Table: vehicles (ข้อมูลรถและสถานะล่าสุด)
-- ============================================================
CREATE TABLE IF NOT EXISTS vehicles (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plate_number   VARCHAR(20) NOT NULL UNIQUE,
    name           VARCHAR(100),
    route_id       UUID REFERENCES routes(id) ON DELETE SET NULL,
    device_api_key VARCHAR(64) NOT NULL UNIQUE,  -- สำหรับ Hardware / MQTT Auth
    status         VARCHAR(20) NOT NULL DEFAULT 'offline'
                   CHECK (status IN ('online', 'offline', 'maintenance')),
    last_lat       DOUBLE PRECISION,
    last_lng       DOUBLE PRECISION,
    last_speed_kmh REAL DEFAULT 0,
    last_heading   REAL DEFAULT 0,
    last_seen_at   TIMESTAMPTZ,
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_api_key ON vehicles(device_api_key);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_route_id ON vehicles(route_id);

-- ============================================================
-- Table: trips (รอบการเดินทาง)
-- ============================================================
CREATE TABLE IF NOT EXISTS trips (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id        UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    trip_number       INTEGER NOT NULL,
    started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at          TIMESTAMPTZ,
    total_distance_km DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_points      INTEGER NOT NULL DEFAULT 0,
    status            VARCHAR(20) NOT NULL DEFAULT 'in_progress'
                      CHECK (status IN ('in_progress', 'completed', 'cancelled')),
    trip_date         DATE NOT NULL DEFAULT CURRENT_DATE,
    UNIQUE(vehicle_id, trip_date, trip_number)
);

CREATE INDEX IF NOT EXISTS idx_trips_vehicle_date ON trips(vehicle_id, trip_date);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);

-- ============================================================
-- Table: gps_points (พิกัด GPS ละเอียด - Partitioned by month)
-- ============================================================
CREATE TABLE IF NOT EXISTS gps_points (
    id                   BIGSERIAL,
    vehicle_id           UUID NOT NULL,
    trip_id              UUID NOT NULL,
    lat                  DOUBLE PRECISION NOT NULL,
    lng                  DOUBLE PRECISION NOT NULL,
    speed_kmh            REAL DEFAULT 0,
    heading              REAL DEFAULT 0,
    distance_from_prev_m REAL DEFAULT 0,
    device_timestamp     TIMESTAMPTZ NOT NULL,
    server_timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_valid             BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id, server_timestamp)
) PARTITION BY RANGE (server_timestamp);

-- Monthly Partitions (Current 2026-08 through 2027-02 + Default)
CREATE TABLE IF NOT EXISTS gps_points_2026_08 PARTITION OF gps_points
    FOR VALUES FROM ('2026-08-01 00:00:00+00') TO ('2026-09-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS gps_points_2026_09 PARTITION OF gps_points
    FOR VALUES FROM ('2026-09-01 00:00:00+00') TO ('2026-10-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS gps_points_2026_10 PARTITION OF gps_points
    FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS gps_points_2026_11 PARTITION OF gps_points
    FOR VALUES FROM ('2026-11-01 00:00:00+00') TO ('2026-12-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS gps_points_2026_12 PARTITION OF gps_points
    FOR VALUES FROM ('2026-12-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS gps_points_2027_01 PARTITION OF gps_points
    FOR VALUES FROM ('2027-01-01 00:00:00+00') TO ('2027-02-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS gps_points_2027_02 PARTITION OF gps_points
    FOR VALUES FROM ('2027-02-01 00:00:00+00') TO ('2027-03-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS gps_points_default PARTITION OF gps_points DEFAULT;

-- Indexes for gps_points
CREATE INDEX IF NOT EXISTS idx_gps_vehicle_time ON gps_points(vehicle_id, server_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_gps_trip ON gps_points(trip_id, server_timestamp ASC);

-- ============================================================
-- View: daily_mileage_summary (สรุประยะทางรายวันของรถแต่ละคัน)
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
