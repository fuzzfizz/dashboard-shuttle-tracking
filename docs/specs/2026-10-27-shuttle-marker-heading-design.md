# Design Spec: Top-Down Shuttle Van Icon & Directional Heading Alignment

**Date:** 2026-10-27  
**Status:** Approved  
**Author:** Antigravity Pairing Assistant  

---

## 1. Context & Motivation

In the fleet tracking dashboard, vehicle markers on Leaflet maps are currently represented by a generic circular marker containing a small triangle arrow. The user requested:
1. **"ปรับไอคอนรถบนแมพให้เป็นรถรับส่ง"**: Transform the vehicle icon into a recognizable shuttle bus / van (รถตู้รับส่ง / รถบัสรับส่ง).
2. **"หันหน้าให้ตรงทางที่มุ่งหน้าไป"**: Accurately orient the front of the shuttle van directly towards its heading / direction of travel.

Additionally, in field telemetry, GPS devices or simulators may omit heading or send `0` when moving, or vehicles may stop at intersections (speed = 0). If the system resets to North (0°) when stationary, the vehicle unnaturally twists away from the road. The system must provide smart bearing calculation and retain orientation when stopped.

---

## 2. Visual Design: Top-Down Shuttle Van Icon

### 2.1 Marker Layout & Dimensions
- **Container Size:** 52px × 52px (Leaflet `iconSize: [52, 52]`, `iconAnchor: [26, 26]`).
- **Vehicle ID Badge:** Anchored at `top: -14px` above the vehicle body. Rendered in a fixed horizontal orientation (never rotating with the vehicle) so vehicle IDs (`shuttle-01`, `CM-01`) remain readable regardless of vehicle orientation.
- **Pulse Aura:** Soft pulsating ring active when the vehicle is online, with expanded glow when selected.

### 2.2 Top-Down Shuttle Van SVG Anatomy
The rotating body (`transform: rotate(${heading}deg); transition: transform 0.4s ease;`) renders a top-down shuttle van pointing forward (0° = North):
- **Dimensions:** 26px width × 42px length (streamlined minibus / shuttle van proportions).
- **Headlight Beam Glow:** Two forward-projecting conical/linear gradient beams shining ahead of the front bumper. Instantly identifies heading even at low map zoom levels.
- **Van Body & Aerodynamics:** Sleek rounded rectangular chassis with front hood curve and side mirrors.
- **Windows & Cabin:** Dark curved front windshield, dual-sided passenger windows, and rear window.
- **Roof Accents:** Shuttle roof ventilation / rack styling distinguishing it from passenger sedans.
- **Status Colors & Opacity:**
  - **Online:** Emerald green accent highlights (`#10b981`), white/green headlight beams, full opacity (1.0).
  - **Selected:** Amber / neon-emerald border and box-shadow glow.
  - **Offline:** Muted slate gray chassis (`#64748b`), disabled headlights, 0.6 overall opacity.

---

## 3. Directional Heading & Bearing Logic

### 3.1 Bearing Calculation (`calculateBearing`)
A dedicated mathematical utility added to `src/services/distanceCalculator.ts`:
```typescript
/**
 * Computes forward azimuth (bearing) in degrees (0 - 360) from point 1 to point 2.
 * 0° = North, 90° = East, 180° = South, 270° = West.
 */
export function calculateBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLng);

  const bearingRad = Math.atan2(y, x);
  return ((bearingRad * 180) / Math.PI + 360) % 360;
}
```

### 3.2 Smart Heading Selection Hierarchy
Inside `AnimatedVehicleMarker.tsx`:
1. **Direct Telemetry Heading:** If `vehicle.heading` is provided, non-null, and non-zero, use `vehicle.heading`.
2. **Dynamic Bearing Fallback:** If `vehicle.heading` is missing or 0, check if the vehicle moved:
   - If `haversineDistance(prevCoord, targetCoord) > JITTER_THRESHOLD_KM` (8 meters) OR `vehicle.speed >= 1.5 km/h`:
     Calculate `calculateBearing(prevCoord[0], prevCoord[1], targetCoord[0], targetCoord[1])`.
3. **Stationary Retention:** If the vehicle is stopped (`speed < 1.5 km/h` and distance within jitter threshold):
   - Retain `prevHeading`—do **not** reset to 0° (North).

### 3.3 Continuous Angle Rotation (Preventing 360° Flip Glitch)
When transitioning across the 0°/360° boundary (e.g. 355° to 5°), CSS `rotate(5deg)` from `rotate(355deg)` would trigger a 350° counter-clockwise spin.
Using `shortestAngleDelta(prevAngle, targetAngle)`, accumulate continuous rotation:
`continuousHeading = prevCumulativeHeading + shortestAngleDelta(prevCumulativeHeading, targetHeading)`
This ensures the transition rotates smoothly by +10° clockwise.

---

## 4. Components & Files Modified

1. **`src/services/distanceCalculator.ts`**:
   - Add and export `calculateBearing(lat1, lng1, lat2, lng2): number`.
2. **`src/services/__tests__/distanceCalculator.test.ts`**:
   - Add unit tests for cardinal and intercardinal bearings (North, East, South, West, Northeast, Southwest).
3. **`src/components/ShuttleMap.tsx`**:
   - Update `createVehicleIcon` to output top-down shuttle van SVG with headlights, van body, windows, mirrors, fixed ID badge, and rotation wrapper.
4. **`src/components/__tests__/ShuttleMap.test.tsx`**:
   - Update icon test expectations for shuttle van SVG elements and rotation CSS.
5. **`src/components/AnimatedVehicleMarker.tsx`**:
   - Maintain `cumulativeHeadingRef` and `lastHeadingRef`.
   - Compute smart bearing when telemetry heading is absent or zero.
   - Retain last heading when vehicle is stationary.
6. **`src/components/__tests__/AnimatedVehicleMarker.test.tsx`**:
   - Add tests verifying bearing calculation on movement, heading retention on park, and continuous angle rotation.

---

## 5. Verification Plan

1. **Unit Tests:**
   - Run `npm test --prefix frontend` ensuring all existing 90 tests pass plus new tests for `calculateBearing`, `createVehicleIcon`, and `AnimatedVehicleMarker` heading logic.
2. **Build Verification:**
   - Run `npm run build --prefix frontend` to ensure zero TypeScript compiler warnings or bundling issues.
