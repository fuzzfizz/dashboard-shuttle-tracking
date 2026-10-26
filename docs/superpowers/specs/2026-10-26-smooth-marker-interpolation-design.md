# Design Spec: Smooth 60 FPS Vehicle Marker Interpolation

**Date:** 2026-10-26  
**Status:** Approved  
**Author:** Antigravity Pairing Assistant  

---

## 1. Context & Motivation

In the current live dashboard (`https://dashboard-shuttle-tracking.onrender.com/`), telemetry packets from active vehicles (e.g., GPS devices or simulator) arrive every 5 seconds. Because Leaflet's `<Marker position={[v.lat, v.lng]}>` immediately snaps to coordinates on React state updates, vehicles appear to jump/teleport across the map every 5 seconds rather than smoothly driving.

To deliver a polished experience comparable to Google Maps or Grab/Uber, vehicle markers must glide smoothly at 60 FPS between telemetry updates using client-side linear interpolation (LERP).

---

## 2. Architecture & Design

### 2.1 Dedicated Animated Marker Component (`AnimatedVehicleMarker.tsx`)

Instead of rendering standard `<Marker>` directly in `ShuttleMap`, each vehicle is rendered by `<AnimatedVehicleMarker>`:

```
[ShuttleMap]
   ├── TileLayer
   ├── FleetCameraController
   └── vehicleList.map(...) => <AnimatedVehicleMarker key={v.vehicle_id} vehicle={v} ... />
                                  └── Leaflet Marker (updated via markerRef.current.setLatLng at 60 FPS)
```

### 2.2 Interpolation Logic (LERP)

1. **State Tracking:**
   - `prevPositionRef`: `[prevLat, prevLng]`
   - `targetPositionRef`: `[newLat, newLng]`
   - `startTimeRef`: `performance.now()`
   - `durationRef`: `Math.max(1000, Math.min(10000, newTimestamp - prevTimestamp || 5000))`

2. **Frame Update (`requestAnimationFrame`):**
   - For each frame:
     - `elapsed = performance.now() - startTime`
     - `progress = Math.min(1, elapsed / duration)`
     - `lat = prevLat + (targetLat - prevLat) * progress`
     - `lng = prevLng + (targetLng - prevLng) * progress`
     - Call `markerRef.current.setLatLng([lat, lng])` directly (bypassing React re-renders for maximum performance).
     - If `progress < 1`, schedule next frame via `requestAnimationFrame`.

3. **Shortest Angular Rotation (Heading):**
   - When heading changes (e.g. 355° to 5°), calculate minimal delta:
     ```typescript
     export function shortestAngleDelta(fromAngle: number, toAngle: number): number {
       let diff = ((toAngle - fromAngle + 180) % 360) - 180;
       return diff < -180 ? diff + 360 : diff;
     }
     ```
   - Heading rotation in icon retains CSS transition `transform 0.4s ease`.

4. **Teleport Guard / Jump Threshold:**
   - If distance between `prev` and `target` exceeds 2.0 km (e.g. city change or test reset), skip interpolation and snap immediately to the target coordinate.
   - On initial mount or vehicle creation, snap immediately to the initial coordinate.

---

## 3. Interfaces & Signatures

```typescript
export interface AnimatedVehicleMarkerProps {
  vehicle: TelemetryPayload;
  isSelected: boolean;
  isOnline: boolean;
  onClick?: (vehicleId: string) => void;
  jumpThresholdKm?: number; // default 2.0 km
}
```

---

## 4. Error Handling & Edge Cases

1. **Window blur / Background tab:**
   - When the browser tab is hidden, `requestAnimationFrame` pauses. When the user returns, `elapsed >= duration`, so `progress = 1.0` and the marker cleanly positions at `targetPosition`.
2. **Rapid packet bursts (< 500ms):**
   - Handled seamlessly: new target updates `prevPosition` to the current interpolated position and resets `startTime`.
3. **Component Unmount:**
   - Active `cancelAnimationFrame` invoked on unmount to prevent memory leaks.

---

## 5. Verification Plan

1. **Unit Tests (`frontend/src/components/__tests__/AnimatedVehicleMarker.test.tsx`):**
   - Math tests: `shortestAngleDelta` across 0°/360° boundary.
   - Snapping on mount vs gliding on update.
   - Snapping on large jumps (> 2 km).
   - Clean cleanup of animation frame on unmount.
2. **Integration Tests (`ShuttleMap.test.tsx` & `App.test.tsx`):**
   - Ensure all 66 existing Vitest tests continue to pass.
3. **Puppeteer Visual Verification:**
   - Run simulation and capture multiple consecutive frames (e.g., at 0s, 1.5s, 3.0s, 4.5s) to verify continuous coordinate movement between 5-second MQTT telemetry updates.
