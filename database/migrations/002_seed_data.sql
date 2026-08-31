-- ============================================================
-- Migration: 002_seed_data.sql
-- Shuttle Tracking System Seed Data
-- ============================================================

-- ------------------------------------------------------------
-- 1. Users (Admin & Viewer Accounts)
-- Passwords:
-- admin@example.com   -> admin123456
-- viewer@example.com  -> viewer123456
-- ------------------------------------------------------------
INSERT INTO users (id, email, password_hash, role, display_name, is_active)
VALUES
    (
        'a0000000-0000-0000-0000-000000000001',
        'admin@example.com',
        '$2b$10$YIR5GfjWDCJ5dmAo/lZnIesRKdGKo1HLCDWGajfnDpX/tSFl3ycqW',
        'admin',
        'System Administrator',
        TRUE
    ),
    (
        'a0000000-0000-0000-0000-000000000002',
        'viewer@example.com',
        '$2b$10$X1z80cco9PgVmH06OoG.2.srbfHJyIg/g5UpzmevY2JXiS4sIa7Xa',
        'viewer',
        'Shuttle Operator',
        TRUE
    )
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    display_name = EXCLUDED.display_name,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- ------------------------------------------------------------
-- 2. Routes (Sample Route: Route A - University ⇄ BTS Station)
-- ------------------------------------------------------------
INSERT INTO routes (id, name, description, route_geojson, is_active)
VALUES
    (
        'b0000000-0000-0000-0000-000000000001',
        'สาย A - มหาวิทยาลัย ⇄ รถไฟฟ้า',
        'เส้นทางเดินรถรับ-ส่งระหว่างมหาวิทยาลัยและสถานีรถไฟฟ้า ให้บริการวันจันทร์-ศุกร์',
        '{
            "type": "LineString",
            "coordinates": [
                [100.52830, 13.73670],
                [100.52980, 13.73740],
                [100.53150, 13.73820],
                [100.53320, 13.73940],
                [100.53480, 13.74050],
                [100.53600, 13.74180],
                [100.53720, 13.74310],
                [100.53880, 13.74450],
                [100.54010, 13.74600],
                [100.53880, 13.74450],
                [100.53720, 13.74310],
                [100.53600, 13.74180],
                [100.53480, 13.74050],
                [100.53320, 13.73940],
                [100.53150, 13.73820],
                [100.52980, 13.73740],
                [100.52830, 13.73670]
            ]
        }'::jsonb,
        TRUE
    )
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    route_geojson = EXCLUDED.route_geojson,
    is_active = EXCLUDED.is_active;

-- ------------------------------------------------------------
-- 3. Route Stops (4 Stops on Route A)
-- ------------------------------------------------------------
INSERT INTO route_stops (id, route_id, name, lat, lng, stop_order, radius_meters)
VALUES
    (
        'c0000000-0000-0000-0000-000000000001',
        'b0000000-0000-0000-0000-000000000001',
        'จุดจอดหน้าประตู 1 (Main Gate 1)',
        13.73670,
        100.52830,
        1,
        50
    ),
    (
        'c0000000-0000-0000-0000-000000000002',
        'b0000000-0000-0000-0000-000000000001',
        'จุดจอดอาคารเรียนรวม (Lecture Complex)',
        13.73820,
        100.53150,
        2,
        50
    ),
    (
        'c0000000-0000-0000-0000-000000000003',
        'b0000000-0000-0000-0000-000000000001',
        'จุดจอดหอพักนักศึกษา (Student Dormitory)',
        13.74050,
        100.53480,
        3,
        50
    ),
    (
        'c0000000-0000-0000-0000-000000000004',
        'b0000000-0000-0000-0000-000000000001',
        'จุดจอดสถานี BTS (BTS Station)',
        13.74600,
        100.54010,
        4,
        50
    )
ON CONFLICT (route_id, stop_order) DO UPDATE SET
    name = EXCLUDED.name,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    radius_meters = EXCLUDED.radius_meters;

-- ------------------------------------------------------------
-- 4. Vehicles (2 Sample EV Shuttles)
-- ------------------------------------------------------------
INSERT INTO vehicles (id, plate_number, name, route_id, device_api_key, status, last_lat, last_lng, last_speed_kmh, last_heading, is_active)
VALUES
    (
        'd0000000-0000-0000-0000-000000000001',
        'กข-1234',
        'รถคันที่ 1 (EV Bus 01)',
        'b0000000-0000-0000-0000-000000000001',
        'dev_key_v01_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
        'offline',
        13.73670,
        100.52830,
        0,
        0,
        TRUE
    ),
    (
        'd0000000-0000-0000-0000-000000000002',
        'ขค-5678',
        'รถคันที่ 2 (EV Bus 02)',
        'b0000000-0000-0000-0000-000000000001',
        'dev_key_v02_q1w2e3r4t5y6u7i8o9p0a1s2d3f4g5h6',
        'offline',
        13.74600,
        100.54010,
        0,
        180,
        TRUE
    )
ON CONFLICT (plate_number) DO UPDATE SET
    name = EXCLUDED.name,
    route_id = EXCLUDED.route_id,
    device_api_key = EXCLUDED.device_api_key,
    status = EXCLUDED.status,
    last_lat = EXCLUDED.last_lat,
    last_lng = EXCLUDED.last_lng,
    last_speed_kmh = EXCLUDED.last_speed_kmh,
    last_heading = EXCLUDED.last_heading,
    is_active = EXCLUDED.is_active;
