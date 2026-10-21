# Final Code Review Fixes Report

**Date:** 2026-10-21  
**Status:** DONE  
**Commit SHA:** `0722504d7843e023dc9c656cacfd490254037db9` (`0722504`)  

---

## 1. Summary of Changes

### 1. DOM XSS Protection (`ShuttleMap.tsx`)
- Added `escapeHtml(str: string): string` to sanitize `&`, `<`, `>`, `"`, and `'`.
- Sanitized `vehicleId` before interpolating into the `createVehicleIcon` pill badge template string.
- Exported `escapeHtml` and `createVehicleIcon`.
- Added unit tests in `ShuttleMap.test.tsx` verifying that malicious strings (e.g. `<img src=x onerror=alert(1)>`) are safely encoded as `&lt;img src=x onerror=alert(1)&gt;` with no raw script/tag insertion into the DOM.

### 2. 1-Second Periodic Clock Tick (`useShuttleTelemetry.ts`)
- Added a 1-second interval (`setInterval(() => setNow(Date.now()), 1000)`) in `useShuttleTelemetry`.
- Exported `now: number` as part of the hook return payload.
- Passed `now` down to `App.tsx`, `FleetPanel.tsx`, `TelemetryHUD.tsx`, and `ShuttleMap.tsx`.
- Enabled live staleness transitions (>15s) and relative heartbeat times (e.g. "Just now" -> "2s ago") to advance smoothly in real time even when MQTT traffic is paused.
- Added a timer-based unit test in `useShuttleTelemetry.test.ts`.

### 3. Wire `calculateFleetStats` into `App.tsx` & `TelemetryHUD.tsx`
- In `App.tsx`:
  - Computed `fleetStats = calculateFleetStats(vehicles, lastSeenMap, now)`.
  - Computed `latestFleetHeartbeat = Object.keys(lastSeenMap).length > 0 ? Math.max(...Object.values(lastSeenMap)) : null`.
  - Calculated `isOnline` for the focused vehicle using `computeVehicleStatus`.
  - Passed `fleetStats`, `isOnline`, and the active `lastSeen` timestamp (`selectedVehicleId ? lastSeenMap[selectedVehicleId] : latestFleetHeartbeat`) to `TelemetryHUD`.
- In `TelemetryHUD.tsx`:
  - In Overview Mode (`telemetry === null`):
    - Vehicle badge label: `Overview (${fleetStats?.onlineVehicles ?? 0} online)`.
    - Speed metric: `${fleetStats?.averageSpeed?.toFixed(1) ?? '--'} km/h`.
    - Heartbeat: Formatted `lastSeen` (latest fleet heartbeat or 'Never').
  - In Focused Mode:
    - When vehicle is offline (`isOnline === false`), renders a high-visibility red badge: `Signal Lost`.
- Added unit tests in `TelemetryHUD.test.tsx` verifying overview stats formatting, fleet heartbeat display, and the "Signal Lost" badge.

### 4. Dim Stale Markers (`ShuttleMap.tsx`)
- Updated `ShuttleMapProps` to accept `lastSeenMap` and `now`.
- Computed `isOnline` per vehicle: `computeVehicleStatus(v, lastSeenMap?.[v.vehicle_id] || 0, now).isOnline`.
- Updated `createVehicleIcon` to take `isOnline: boolean`:
  - Stale markers (`!isOnline`):
    - Border: `#94a3b8` (Slate 400).
    - Arrow / SVG stroke: `#475569` (Slate 600).
    - Pulse ring animation disabled and omitted from DOM.
    - Marker container opacity set to `0.6`.
  - Live markers (`isOnline`):
    - Border: `#ffffff` (or `#10b981` when selected).
    - Arrow: `#10b981`.
    - Pulse ring active.
    - Marker opacity set to `1.0`.
- Added unit tests in `ShuttleMap.test.tsx` checking both online and offline icon CSS/HTML styling.

### 5. Camera Controller Stability (`ShuttleMap.tsx`)
- Refactored `FleetCameraController` using React refs:
  - `prevSelectedRef`: Tracks prior `selectedVehicleId`.
  - `prevVehicleCountRef`: Tracks prior number of vehicles in fleet.
  - `isMountedRef`: Tracks initial mount.
  - `prevTargetCoordsRef`: Tracks lat/lng of currently focused vehicle.
- Camera stability behavior:
  - In Fleet Overview Mode: `map.fitBounds` is ONLY invoked on:
    1. Initial mount with > 1 vehicle.
    2. Mode switch from a selected vehicle back to Overview mode (`prevSelectedRef.current !== null && selectedVehicleId === null`).
    3. Change in fleet vehicle count (e.g. new vehicle appears or vehicle removed).
  - Continuous telemetry updates for existing vehicles do not re-trigger `fitBounds`, preventing camera jitter and preserving user manual zoom/pan.
  - In Focus Mode: `map.panTo` is only called if target coordinates actually change or if selection changes.
- Added comprehensive unit test in `ShuttleMap.test.tsx` verifying `fitBounds` and `panTo` call counts across mode transitions and telemetry updates.

---

## 2. Test & Verification Results

### Vitest Suite:
```
 ✓ src/services/__tests__/telemetryParser.test.ts (2 tests)
 ✓ src/services/__tests__/fleetStatus.test.ts (2 tests)
 ✓ src/hooks/__tests__/useShuttleTelemetry.test.ts (4 tests)
 ✓ src/components/__tests__/TelemetryHUD.test.tsx (7 tests)
 ✓ src/components/__tests__/FleetPanel.test.tsx (5 tests)
 ✓ src/components/__tests__/ShuttleMap.test.tsx (7 tests)
 ✓ src/__tests__/App.test.tsx (1 test)
 ✓ src/__tests__/smoke.test.ts (1 test)

 Test Files  8 passed (8)
      Tests  29 passed (29)
```

### TypeScript & Vite Build:
```
> tsc && vite build

vite v5.4.21 building for production...
✓ 1620 modules transformed.
dist/index.html                   0.61 kB │ gzip:   0.40 kB
dist/assets/index-CIYkLJRv.css   15.39 kB │ gzip:   3.69 kB
dist/assets/index-CPouirji.js   663.96 kB │ gzip: 203.43 kB
✓ built in 4.48s
```
Zero compile errors or warnings.
