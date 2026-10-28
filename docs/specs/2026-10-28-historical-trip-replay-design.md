# Design Spec: Historical Trip Replay (ประวัติย้อนหลัง)

**Date:** 2026-10-28  
**Status:** Approved by User  
**Author:** Antigravity Pairing Assistant  

---

## 1. Overview & Goals

The historical trip replay feature provides users with a dedicated playback interface to review previous shuttle routes, simulated vehicle movements, and instantaneous telemetry for any selected date and vehicle.

### Key Objectives:
1. **Seamless Tab Navigation:** Provide two primary views in the main application header:
   - **"วันนี้"** (Live Dashboard): Real-time tracking and live fleet distance analytics.
   - **"ประวัติย้อนหลัง"** (Historical Trip Replay): Interactive playback of historical vehicle tracks.
2. **Clean & Immersive Map-First Layout:** A full-width interactive map with an overlay top control bar and a floating bottom player bar.
3. **Continuous Daily Timeline:** No segmented trip rounds ("ไม่เอารอบการวิ่งแล้ว"). The full day's telemetry forms a single unified timeline from the first recorded point of the day to the last.
4. **Intuitive Playback Controls:** Play/Pause, Replay, interactive scrubbing slider, variable speed multipliers (1x, 2x, 5x, 10x, 30x), and real-time telemetry readout.
5. **Robust State & Error Handling:** Graceful empty states when no telemetry is found, network error recovery, and smooth marker heading alignment.

---

## 2. User Experience & Layout Architecture

### 2.1 Navigation & Mode Switching
In `App.tsx`, the top header is updated with a prominent segmented tab controller:
```
+---------------------------------------------------------------------------------------+
| 🚌 Shuttle Tracker  |  [ 🔴 วันนี้ ]  [ ⏱️ ประวัติย้อนหลัง ]  |  [Live Badge] [Theme ☀️] |
+---------------------------------------------------------------------------------------+
```
- **Active Tab Styling:** `bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 font-semibold shadow-sm`
- **Inactive Tab Styling:** `text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200`
- Switching tabs preserves application state and cleanly unmounts or pauses active simulations.

---

### 2.2 Replay Toolbar (`ReplayToolbar.tsx`)
Positioned at the top of the historical replay view as an ergonomic floating control strip or dedicated header bar:

```
+---------------------------------------------------------------------------------------+
|  📅 [ 2026-10-28 ▾ ]   🚐 [ Shuttle 1 ▾ ]   |  📍 ระยะทาง: 24.8 กม. (1,420 จุด)  [🔄 รีเฟรช] |
+---------------------------------------------------------------------------------------+
```
1. **Date Picker:**
   - HTML5 date input with custom Tailwind styling.
   - Default value: Today's date in `Asia/Bangkok` timezone (`getBangkokDate()`).
   - Maximum selectable date: Today (future dates disabled).
2. **Vehicle Dropdown:**
   - Selects from all registered fleet vehicles (e.g., `shuttle-01`, `shuttle-02`).
   - Defaults to the currently selected vehicle or the first available vehicle.
3. **Day Summary Metrics Badge:**
   - Displays total distance traversed (`total_distance_km` from `daily_vehicle_metrics` or calculated via Haversine) and total logged GPS points.
4. **Refresh Button:**
   - Manual trigger to re-fetch telemetry data from Supabase for the current selection.

---

### 2.3 Replay Map Viewport (`ReplayMap.tsx`)
A full-width, responsive Leaflet map container:
1. **Map Overlays:**
   - **Full Day Route (Neutral / Background Polyline):**
     - Color: `#94a3b8` (Slate 400) / `#64748b` (Slate 500)
     - Opacity: `0.45`
     - Weight: `4`
     - Shows the entire route the shuttle took throughout the day.
   - **Traversed Route (Active Trajectory Polyline):**
     - Color: `#10b981` (Emerald 500)
     - Opacity: `0.9`
     - Weight: `5`
     - Dynamically slices points from index `0` up to current playback index `k`.
   - **Departure Marker (Start Pin):**
     - Green circular pin with a play/flag icon at index `0`.
     - Tooltip: *"จุดเริ่มต้น: HH:mm:ss"*.
   - **Destination Marker (Last Known Pin):**
     - Amber/Rose circular pin with a flag/finish icon at index `N - 1`.
     - Tooltip: *"จุดสิ้นสุด: HH:mm:ss"*.
   - **Current Vehicle Position Marker:**
     - Utilizes the existing heading-aware vehicle icon (`AnimatedVehicleMarker`).
     - Rotates dynamically to match the interpolated bearing or recorded heading.
     - Glides smoothly along points without jitter.
2. **Camera Controls:**
   - On data load: Auto-fits bounds (`map.fitBounds(polylineBounds, { padding: [50, 50] })`).
   - Optional "Follow Vehicle" toggle so user can lock camera to the vehicle or freely pan/zoom.

---

### 2.4 Floating Timeline Player Controller (`ReplayPlayerBar.tsx`)
Docked at the bottom center of the screen with a modern frosted glass finish (`bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl`):

```
+---------------------------------------------------------------------------------------------------------+
| [⏮️] [ ▶ Play / ⏸️ Pause ] [⏭️]  08:15:30 ━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 17:45:10   [1x] [2x] [5x] [10x] [30x] |
|                                                                                                         |
| 🕒 เวลา: 10:24:18  |  ⚡ ความเร็ว: 28.5 กม./ชม.  |  📏 ระยะทางสะสม: 12.4 / 24.8 กม.                        |
+---------------------------------------------------------------------------------------------------------+
```

1. **Playback Controls:**
   - **Play / Pause Toggle:** Large central emerald button (`w-11 h-11 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full flex items-center justify-center`).
   - **Reset / Rewind to Start:** Button to quickly reset scrubber to `index = 0`.
   - **Step Forward / Backward:** 10-second or 1-point step buttons for fine inspection.
2. **Interactive Scrubber:**
   - Custom styled HTML5 range slider or accessible slider component.
   - Min: `0`, Max: `totalPoints - 1` (or timestamp span).
   - Dragging or clicking updates the playback position instantaneously.
   - Start and End time labels formatted as `HH:mm:ss` (Bangkok time).
3. **Speed Multipliers:**
   - Preset buttons: `1x`, `2x`, `5x`, `10x`, `30x`.
   - Active multiplier is highlighted (`bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30`).
4. **Real-Time Telemetry HUD:**
   - **Simulated Time:** Current point's `recorded_at` formatted as `HH:mm:ss`.
   - **Speed:** Instantaneous vehicle speed (`XX.X km/h`).
   - **Cumulative Distance:** Distance covered up to the current playback point vs total day distance.

---

## 3. Data Architecture & Database Queries

### 3.1 Telemetry Points Query (`telemetry_logs`)
Telemetric coordinates are retrieved from the indexed Supabase table `telemetry_logs`:
```sql
SELECT 
  id,
  vehicle_id,
  lat,
  lng,
  speed,
  heading,
  recorded_at
FROM telemetry_logs
WHERE vehicle_id = :vehicleId
  AND recorded_at >= :startOfDayUtc
  AND recorded_at <= :endOfDayUtc
ORDER BY recorded_at ASC;
```

#### Timezone Handling:
The selected date (e.g., `2026-10-28`) is parsed in Bangkok time (`UTC+7`):
- `startOfDay`: `2026-10-28T00:00:00+07:00` -> ISO string `2026-10-27T17:00:00.000Z`
- `endOfDay`: `2026-10-28T23:59:59.999+07:00` -> ISO string `2026-10-28T16:59:59.999Z`

#### Performance & Downsampling:
If a shuttle generates 1 point per second over 8 hours (~28,800 points), fetching and rendering all points at once could strain memory.
- If total points > 3,000 points, apply client-side or query-level sampling (e.g. Douglas-Peucker line simplification or distance-based step filter for polyline rendering, while keeping key stops and motion events).
- In standard operation with 1 point every 5–15 seconds, a typical active day contains 1,500–3,500 points, which modern browsers and Leaflet render with high performance without downsampling.

### 3.2 Daily Metrics Query (`daily_vehicle_metrics`)
Fetch day-level aggregated summary:
```sql
SELECT
  total_distance_km,
  max_speed_kmh,
  avg_speed_kmh,
  active_minutes
FROM daily_vehicle_metrics
WHERE vehicle_id = :vehicleId
  AND date = :selectedDate
LIMIT 1;
```

If metrics are not yet recorded for today, distance is calculated on the fly by summing Haversine segments of the telemetry points.

---

## 4. Component Structure & State Architecture

### 4.1 Component Tree
```
App.tsx
├── Header (with Tabs: "วันนี้" | "ประวัติย้อนหลัง", Theme toggle, Status)
├── [Tab: วันนี้]
│   ├── ShuttleMap (Live Fleet Map)
│   └── DailyDistanceTable (Daily Analytics & Vehicle Status)
└── [Tab: ประวัติย้อนหลัง]
    └── HistoricalTripReplay.tsx
        ├── ReplayToolbar.tsx
        │   ├── DatePicker
        │   ├── VehicleSelect
        │   └── SummaryBadge
        ├── ReplayMap.tsx
        │   ├── Leaflet MapContainer & TileLayer
        │   ├── Neutral Background Polyline (Full day)
        │   ├── Active Traversed Polyline (Progress)
        │   ├── Start / End Flag Pins
        │   └── AnimatedVehicleMarker (Heading rotated)
        └── ReplayPlayerBar.tsx
            ├── Play / Pause / Reset buttons
            ├── Progress Scrubber
            ├── Speed Multipliers (1x, 2x, 5x, 10x, 30x)
            └── Real-Time Telemetry HUD Chips
```

### 4.2 Custom Hook: `useHistoricalTrip`
Location: `frontend/src/hooks/useHistoricalTrip.ts`
- **Inputs:** `vehicleId: string`, `dateStr: string` (YYYY-MM-DD).
- **Outputs:**
  - `points: HistoricalPoint[]`
  - `metrics: DailyVehicleMetric | null`
  - `isLoading: boolean`
  - `error: string | null`
  - `refetch: () => Promise<void>`

### 4.3 Custom Hook: `useTripPlayback`
Location: `frontend/src/hooks/useTripPlayback.ts`
- **Inputs:** `points: HistoricalPoint[]`
- **State & Controls:**
  - `currentIndex: number` (integer index into `points`)
  - `currentPoint: HistoricalPoint | null`
  - `isPlaying: boolean`
  - `speedMultiplier: number` (1, 2, 5, 10, 30)
  - `play: () => void`
  - `pause: () => void`
  - `seekToIndex: (index: number) => void`
  - `reset: () => void`
  - `setSpeedMultiplier: (speed: number) => void`
  - `traversedPoints: HistoricalPoint[]`
  - `progressPercent: number` (0 to 100)
- **Animation Mechanism:**
  - Uses `requestAnimationFrame` with delta time calculation.
  - Dynamically increments simulation timestamp based on actual recorded time deltas multiplied by `speedMultiplier`.
  - Automatically pauses when reaching the end of points.

---

## 5. Edge Cases & Error Handling

1. **No Telemetry for Selected Date:**
   - Show an elegant empty state card centered over the map or toolbar:
     - Icon: Calendar with exclamation mark (`CalendarX2` / `AlertCircle`).
     - Message: *"ไม่พบข้อมูลการเดินรถของ [Shuttle Name] ในวันที่ [Date]"*.
     - Call to action: Quick buttons for *"ดูเมื่อวาน"* or *"กลับไปวันนี้"*.
2. **Single Point or Stationary Shuttle:**
   - If only 1 point exists, disable scrubber and play button; display marker at that location with a badge: *"รถจอดนิ่งตลอดวัน"*.
3. **Network / Supabase Connection Failure:**
   - Display a red alert banner with error details and a *"ลองใหม่อีกครั้ง"* (Retry) button.
4. **Active Tab Switching:**
   - When switching from "ประวัติย้อนหลัง" back to "วันนี้", playback loop automatically pauses to prevent background memory or CPU usage.

---

## 6. Theme & Responsive Design

- **Light Mode Default:**
  - Backgrounds: `bg-white`, `bg-slate-50`, `bg-slate-100`
  - Borders: `border-slate-200`, `border-slate-300`
  - Texts: `text-slate-800`, `text-slate-900`, `text-slate-500`
- **Dark Mode (`dark:`):**
  - Backgrounds: `dark:bg-slate-900`, `dark:bg-slate-800`
  - Borders: `dark:border-slate-800`, `dark:border-slate-700`
  - Texts: `dark:text-slate-100`, `dark:text-slate-400`
- **Map Isolation:** Map tiles remain unaltered in both modes (no invert filters).
- **Mobile Ergonomics:**
  - On screens `< 640px`, toolbar stacks vertically.
  - Floating player bar condenses speed multiplier pills into a compact dropdown or horizontally scrollable pill group.
  - Minimum touch targets >= 44px for play/pause and scrubber touch areas.

---

## 7. Verification & Testing Plan

1. **Unit Tests:**
   - `useHistoricalTrip.test.ts`:
     - Fetches and formats telemetry points from Supabase.
     - Correctly computes Bangkok date bounds.
     - Handles empty result sets and API errors gracefully.
   - `useTripPlayback.test.ts`:
     - Plays, pauses, seeks, and loops correctly.
     - Speed multipliers scale playback speed accurately.
     - Stops when reaching the end of points.
2. **Component Tests:**
   - `HistoricalTripReplay.test.tsx`:
     - Renders toolbar with date picker and vehicle selector.
     - Displays empty state when no points exist.
     - Renders player bar with playback controls when points are loaded.
   - `App.test.tsx`:
     - Header displays "วันนี้" and "ประวัติย้อนหลัง" tabs.
     - Clicking "ประวัติย้อนหลัง" switches view to historical replay.
     - Clicking "วันนี้" switches back to live dashboard.
3. **Regression & Build Verification:**
   - Run `npm test` across all existing and new test suites.
   - Run `npm run build` to confirm zero TypeScript and bundling issues.
