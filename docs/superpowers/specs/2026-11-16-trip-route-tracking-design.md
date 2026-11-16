# Design Specification: Planned Route & Live Path Tracking with In-Browser Testing Panel

- **Date**: 2026-11-16
- **Status**: Approved
- **Author**: Antigravity Assistant & User
- **Reference**: [idea.md](file:///D:/shuttle-tracking-dashboard/idea.md)

---

## 1. Executive Summary & Objectives

This feature introduces a two-tier route visualization system on the Leaflet shuttle tracking map:
1. **Planned Route (เส้นทางตามใบจอง)**: The official road navigation path between a passenger pickup point and dropoff point, calculated via the Longdo Map Route REST API.
2. **Actual Path (เส้นทางที่รถวิ่งจริง)**: The live GPS breadcrumb trail plotted in real-time as the vehicle moves, running 100% in-browser with zero API requests.
3. **Interactive Testing Panel (แผงควบคุมการทดสอบ)**: A floating, collapsible panel that allows operators and developers to select any vehicle, click on the map to pin pickup and dropoff points, trigger trip calculation, and clear/reset trips.

### Golden Rule Compliance (กฎเหล็ก)
- **Zero-Loop Calling**: The routing API is **strictly prohibited** from running inside any telemetry interval, polling loop, or live stream listener. It is triggered **only once per trip assignment** when a user clicks "Calculate & Start Trip" or when a booking changes.
- **On-Demand Visibility**: Route lines are not loaded or shown for every vehicle upon opening the dashboard. They appear **only when a vehicle is clicked/focused** on the map or opened via the Daily Distance Table, avoiding unnecessary network traffic and API quota consumption.
- **In-Memory & Local Cache**: Calculated routes are cached by trip coordinate signature (`trip_${vehicleId}_${pickupLat},${pickupLng}_${dropoffLat},${dropoffLng}`). Re-focusing or toggling fullscreen for the same vehicle retrieves the cached path at 0 cost.

---

## 2. Architecture & Data Flow

```
[User clicks vehicle / opens from table]
             │
             ▼
    Does vehicle have an active trip?
      ├── NO  ──► Display live vehicle marker only (0 Request)
      └── YES ──► Check in-memory / localStorage cache
                    ├── Cache HIT  ──► Render cached Planned Route immediately (0 Request)
                    └── Cache MISS ──► Call Longdo Route REST API once (1 Transaction)
                                        └── Cache result & render Planned Route on Leaflet map

[Live ESP32-S3 Telemetry tick every 3–5 seconds]
             │
             ▼
    Update AnimatedVehicleMarker (Leaflet Marker)
             │
             ▼
    Append [lat, lng] to in-memory Actual Path breadcrumbs (0 Request)
             │
             ▼
    Update solid Polyline on Leaflet map
```

---

## 3. Module & Component Breakdown

### 3.1 Type Definitions (`frontend/src/types/trip.ts`)
```typescript
export interface TripLocation {
  lat: number;
  lng: number;
  name?: string;
}

export interface VehicleTrip {
  vehicleId: string;
  pickup: TripLocation;
  dropoff: TripLocation;
  plannedPath: Array<[number, number]>; // [lat, lng] road coordinates
  distanceMeters?: number;
  durationSeconds?: number;
  createdAt: number;
}

export type MapPinMode = 'idle' | 'pick-pickup' | 'pick-dropoff';
```

### 3.2 Routing Service (`frontend/src/services/tripRouteService.ts`)
- **API Endpoint**: Longdo Map Route Guide Service
  ```
  https://api.longdo.com/RouteService/json/route/guide?flon={pickup.lng}&flat={pickup.lat}&tlon={dropoff.lng}&tlat={dropoff.lat}&mode=t&key={LONGDO_API_KEY}
  ```
- **Parsing**: Extracts segment coordinates from response guide points into standard `[lat, lng]` coordinate tuples.
- **Cache**: In-memory `Map<string, VehicleTrip>` and `localStorage` fallback.
- **Error Handling**: Catches network/API errors, returns a straight geodesic fallback line between pickup and dropoff if road routing fails, and surfaces user-friendly error messages.

### 3.3 Custom Hook (`frontend/src/hooks/useVehicleTripRoute.ts`)
- Manages state for:
  - `trips`: `Record<string, VehicleTrip>` (active trip per vehicle).
  - `actualPaths`: `Record<string, Array<[number, number]>>` (live breadcrumb trail).
  - `pinMode`: `'idle' | 'pick-pickup' | 'pick-dropoff'`.
  - `selectedVehicleId`: Active vehicle.
  - `isCalculating`: Loading state to disable double-submits.
- Exposes actions:
  - `startTrip(vehicleId, pickup, dropoff)`
  - `clearTrip(vehicleId)`
  - `recordVehicleBreadcrumb(vehicleId, lat, lng)`
  - `setPinMode(mode)`

### 3.4 Overlay Renderer (`frontend/src/components/TripRouteOverlay.tsx`)
Rendered inside Leaflet `<MapContainer>`:
1. **Planned Route (`<Polyline>`)**:
   - Color: Purple accent (`#9e76b4` - CMU Dok Rak branding).
   - Style: Semi-transparent dashed path (`weight: 5`, `opacity: 0.65`, `dashArray: '8, 8'`).
2. **Actual Path (`<Polyline>`)**:
   - Color: Olive Green (`#4a7c0b` - Pharmacy CMU branding).
   - Style: High-contrast solid path (`weight: 4`, `opacity: 0.95`).
3. **Pickup Pin (`<Marker>`)**:
   - Custom green icon 🟢 with label "จุดรับ (Pickup)".
4. **Dropoff Pin (`<Marker>`)**:
   - Custom red icon 🔴 with label "จุดส่ง (Dropoff)".
5. **Map Click Handler (`useMapEvents`)**:
   - When `pinMode` is active, intercept clicks on the map to set pickup or dropoff coordinates, then return cursor to normal.

### 3.5 Floating Test Panel (`frontend/src/components/TripTestPanel.tsx`)
- Floating card anchored at the top-right of the map container, toggleable via a `"ทดสอบเส้นทาง (Route Test)"` button.
- Controls:
  - Vehicle selector dropdown (syncs with map selection).
  - Pickup location display + `"📍 จิ้มจุดรับบนแผนที่"` button.
  - Dropoff location display + `"🏁 จิ้มจุดส่งบนแผนที่"` button.
  - `"คำนวณและเริ่มทริป (Start Trip)"` button (olive green primary).
  - `"ล้างเส้นทาง / จบทริป (Clear Trip)"` button (secondary danger/neutral).

---

## 4. UI / UX Design & Brand Consistency

1. **Brand Identity**:
   - Primary accents adhere to Faculty of Pharmacy, Chiang Mai University official palette (Olive Green `#4a7c0b` / `#5c990e` and CMU Dok Rak Purple `#9e76b4`).
2. **Ergonomics**:
   - Mobile touch targets meet `min-h-[44px]` accessibility criteria.
   - Crosshair cursor indicator on map during pin-selection mode.
3. **Preservation**:
   - Top-down shuttle bus icon, license plate frame, hover zoom interaction (`scale(1.18)`), Telemetry HUD, and Daily Distance Table remain 100% operational and untouched.

---

## 5. Error Handling & Robustness

1. **Network Failure / Invalid Coordinates**:
   - If Longdo Route API returns an error or empty guide, display a non-blocking toast warning and draw a straight geodesic line between pickup and dropoff so the user is never left with an unresponsive screen.
2. **Rapid Click Throttling**:
   - Disable the "Start Trip" button with a spinner while `isCalculating` is true.
   - Throttle requests to at least 2 seconds between clicks.
3. **Stationary GPS Jitter Filter**:
   - Telemetry ticks only append coordinates to `actualPaths` if the vehicle has moved more than 5 meters from the previous breadcrumb point, preventing spiderweb clusters when parked.

---

## 6. Testing Strategy

1. **Service Tests (`tripRouteService.test.ts`)**:
   - Verify parsing of Longdo Route Guide response into `[lat, lng]` coordinates.
   - Verify cache hit behavior (0 network requests on second call with identical coordinates).
   - Verify fallback behavior when API returns an error.
2. **Hook Tests (`useVehicleTripRoute.test.ts`)**:
   - Test starting trip, clearing trip, and appending breadcrumbs.
   - Verify isolation: telemetry ticks never trigger route calculations.
3. **Component Tests (`TripTestPanel.test.tsx` & `TripRouteOverlay.test.tsx`)**:
   - Test toggling panel visibility.
   - Test picking pickup/dropoff points and triggering trip calculation.
   - Verify rendering of planned route polyline, actual path polyline, and markers.
4. **Regression Verification**:
   - Run the full suite (224 existing tests) to ensure zero regressions across telemetry HUD, distance table, historical replay, and map components.
