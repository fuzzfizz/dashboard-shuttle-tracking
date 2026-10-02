# Executive Fleet Tracking Dashboard — Design Specification

## 1. Overview & Vision
A modern, responsive, mobile-first live shuttle fleet tracking application designed for end-users. The system provides a unified single-page experience where users can see all registered vehicles on a primary live map, inspect active routes in real-time, view each vehicle's target path and stops, and check today's accumulated travel distance (mileage) without requiring an admin login or portal navigation.

## 2. Key Objectives & Success Criteria
1. **Unified User Experience**: Complete all tracking, route viewing, and fleet telemetry on the public root page (`/`). No separate login screen or admin barriers for viewing fleet status.
2. **Mobile-First Responsive Layout**:
   - Touch-optimized for mobile viewports (375px–430px) with minimum 44px tap targets and non-conflicting map gestures.
   - Converts cleanly between a rich card-based list on mobile screens and a comprehensive 7-column data table on tablet/desktop (768px+).
3. **Primary Fleet Live Map**:
   - High-performance Leaflet map displaying real-time positions, headings, and status colors of all active registered vehicles.
   - When a vehicle is selected, the map smoothly pans/flies to the vehicle, highlights its assigned target route path and stops, and displays a floating **Vehicle Focus HUD**.
4. **Today's Movement Distance (Today's Mileage)**:
   - Each vehicle displays its total distance traveled today (`today_total_km`) fetched directly from daily trips/telemetry summaries.
5. **Real-time Live Sync**:
   - WebSocket streaming for vehicle positions (`vehicle:location`), status changes (`vehicle:status`), and trip milestones (`trip:started`, `trip:completed`) with instant UI updates.

---

## 3. Architecture & Data Flow

```
┌────────────────────────────────────────────────────────┐
│                   Next.js 15 Frontend                  │
│  (Tailwind CSS + Lucide Icons + Leaflet Interactive)   │
└───────────────▲────────────────────────▲───────────────┘
                │ HTTP REST (Public)     │ WebSocket (/ws/public)
                │ (Vehicles, Routes)     │ (Real-time telemetry)
┌───────────────▼────────────────────────▼───────────────┐
│                    Fastify Backend                     │
│  • Public GET /api/v1/vehicles (with today_total_km)   │
│  • Public GET /api/v1/routes (with stops & coords)     │
│  • WebSocket Broadcaster (/ws/public)                  │
└───────────────────────┬────────────────────────────────┘
                        │ SQL Queries
┌───────────────────────▼────────────────────────────────┐
│                  PostgreSQL Database                   │
│  • vehicles, routes, route_stops, trips, gps_points    │
└────────────────────────────────────────────────────────┘
```

### 3.1 Backend Endpoints
- **`GET /api/v1/vehicles`**: Remove `fastify.authenticate` requirement for reading active vehicles so public users can fetch registered vehicles alongside aggregated `today_total_km`, `today_total_trips`, `route_name`, and real-time status.
- **`GET /api/v1/routes`**: Remove `fastify.authenticate` requirement for read-only routes listing and route details (`GET /api/v1/routes/:id`) with stops.
- **`WebSocket /ws/public`**: Connects without token, receives broadcasts for:
  - `vehicle:location` (lat, lng, speed_kmh, heading, timestamp)
  - `vehicle:status` (status: in_transit, idle, offline)
  - `trip:started` & `trip:completed`

---

## 4. UI & Component Design

### 4.1 Header Bar & Live Metrics
- **Logo & Title**: Sleek modern badge with Shuttle icon, "Shuttle Live Fleet", and subtitle.
- **Connection Indicator**: Glowing pulse badge showing `Live Sync` (green) or `Connecting...` (amber/rose).
- **Fleet Summary Pills**:
  - Total Registered Vehicles
  - Active Running Vehicles (In Transit, green)
  - Idle Vehicles (Amber)
  - Today's Total Fleet Mileage (Sum of kilometers traveled today)

### 4.2 Main Fleet Live Map (Top Section)
- **Viewport Dimensions**:
  - Mobile: Responsive height (approx. 48vh / 380px–420px) with comfortable margins.
  - Desktop: 520px–560px for immersive situational awareness.
- **Vehicle Markers**:
  - Directional SVG vehicle arrow rotating to `last_heading`.
  - Color-coded status ring:
    - 🟢 Green: In Transit (driving)
    - 🟡 Amber: Idle (engine on / stopped)
    - ⚪ Slate: Offline
  - Plate number tag anchored above marker.
- **Active Route Overlay (เส้นทางเป้าหมาย)**:
  - Shows assigned route polyline with matching route theme color.
  - Numbered circular stop badges for all stops along the target route.
- **Floating Vehicle Focus HUD**:
  - Positioned at top-right (desktop) or floating card over bottom of map (mobile).
  - Displays selected vehicle's plate number, model, assigned route, live speed (km/h), target destination stop, and **Today's Distance (ระยะทางวิ่งวันนี้)**.
  - Includes "✕ ดูรถทั้งหมด (Reset View)" button.

### 4.3 Live Fleet Overview (Bottom Section)
- **Search & Filter Toolbar**:
  - Search input for plate number or route name.
  - Status filter buttons: `ทั้งหมด` | `กำลังวิ่ง` | `จอดรอ` | `ออฟไลน์`.
- **Mobile Layout (Screen < 768px)**:
  - Card-based view optimized for thumb scrolling.
  - Each card features:
    - Plate number badge + vehicle model.
    - Status pill with pulsing dot indicator.
    - Assigned route badge with route color swatch.
    - 2-column telemetry grid: **ความเร็วปัจจุบัน (Speed)** and **ระยะทางวันนี้ (Today's Mileage km)**.
    - Timestamp of last GPS ping.
    - Full-width button: **"ดูเส้นทาง & โฟกัสแผนที่" (Focus Map)** with auto-scroll to top.
- **Desktop/Tablet Layout (Screen >= 768px)**:
  - 7-Column Executive Table:
    1. **รถ / ป้ายทะเบียน**: Plate number with bus icon & model.
    2. **สายรถ & ปลายทาง**: Route badge with color dot & description.
    3. **สถานะ**: In Transit / Idle / Offline badge.
    4. **ความเร็ว**: Formatted km/h.
    5. **ระยะทางวันนี้**: Bold mileage with odometer icon (e.g. `52.4 km`).
    6. **อัปเดตล่าสุด**: Formatted time / relative minutes.
    7. **แอ็กชัน**: Action button to focus map and view target route.

---

## 5. Mobile Ergonomics & Gesture Handling
- Map interaction defaults to cooperative gesture handling so users can scroll the webpage past the map without getting "trapped" in Leaflet touch zoom/pan.
- Tap targets adhere to Apple Human Interface and Material Design standards (minimum 44x44px).
- Smooth scrolling behavior (`window.scrollTo({ top: 0, behavior: 'smooth' })`) triggers when tapping any "Focus Map" button from the table or card list.

---

## 6. Implementation Plan & Scope
1. Update backend route handlers (`backend/src/routes/vehicles.js` & `backend/src/routes/routes.js`) to allow public read access for vehicles, today's distance stats, and routes.
2. Refactor `frontend/src/app/page.tsx` into the new Executive Mobile-First Dashboard.
3. Enhance `frontend/src/components/Map/LiveMap.tsx` to support target route isolation, stop tooltips, vehicle selection highlighting, and directional orientation.
4. Verify end-to-end responsiveness and live telemetry via WebSocket.
