# Final Whole-Branch Review Fixes Brief

## Issues to Address:
1. **[Critical] DOM XSS in `ShuttleMap.tsx`**:
   Escape `vehicleId` in `createVehicleIcon` before inserting into `L.divIcon` HTML template.
2. **[Critical] 1-Second Periodic Clock Tick**:
   In `useShuttleTelemetry.ts`, add a 1-second interval timer that updates `now` timestamp state and exports `now: number`. This ensures vehicle stale states and HUD heartbeats automatically transition/advance in real time even when no new MQTT messages arrive.
3. **[Important] Connect `calculateFleetStats` in `App.tsx` & `TelemetryHUD.tsx`**:
   - In `App.tsx`, invoke `calculateFleetStats(vehicles, lastSeenMap, now)`.
   - In Overview Mode (`selectedVehicleId === null`), `TelemetryHUD` displays:
     - Vehicle Label: `Overview (${fleetStats.onlineVehicles} online)`
     - Speed: `fleetStats.averageSpeed.toFixed(1) km/h`
     - Heartbeat: Latest heartbeat across fleet (`Math.max(...Object.values(lastSeenMap))`) or `null`
   - In Focused Mode:
     - If focused vehicle is offline/stale (`now - lastSeen >= OFFLINE_THRESHOLD_MS`), display a "Signal Lost" badge.
4. **[Important] Dimmed Stale Markers (Spec 4.2 & 4.3)**:
   - In `ShuttleMap.tsx`, pass `lastSeenMap` and `now`.
   - Calculate `isOnline` for each vehicle marker. If offline/stale, render marker with dimmed slate colors, muted opacity, and no pulse animation.
5. **[Important] Prevent Camera fitBounds Thrashing**:
   - In `FleetCameraController`, use a ref to track mode transitions (`selectedVehicleId` transitioning to `null`) and fleet size changes.
   - Do not invoke `map.fitBounds` on every continuous telemetry packet in overview mode; only fit bounds on mode switch, fleet count change, or initial load.

## Verification:
- All Vitest tests must pass 100%.
- TypeScript compile and Vite build must pass cleanly.
