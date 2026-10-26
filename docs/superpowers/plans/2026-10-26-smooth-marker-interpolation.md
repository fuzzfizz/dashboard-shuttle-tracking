# Implementation Plan: Smooth 60 FPS Vehicle Marker Interpolation

**Date:** 2026-10-26  
**Spec Reference:** `docs/superpowers/specs/2026-10-26-smooth-marker-interpolation-design.md`  

---

## Proposed Changes

### Frontend Services & Components
- **`frontend/src/services/markerInterpolation.ts`**: Core math for coordinate LERP and shortest-path angular delta.
- **`frontend/src/services/__tests__/markerInterpolation.test.ts`**: Comprehensive math tests for angle boundaries and interpolation.
- **`frontend/src/components/AnimatedVehicleMarker.tsx`**: Component wrapping Leaflet Marker with 60 FPS `requestAnimationFrame` and direct `setLatLng`.
- **`frontend/src/components/__tests__/AnimatedVehicleMarker.test.tsx`**: Unit tests for mounting, animation loop, teleport guard, and cleanup.
- **`frontend/src/components/ShuttleMap.tsx`**: Replace raw `<Marker>` with `<AnimatedVehicleMarker>`.

---

## Detailed Tasks

### Task 1: Math Helpers for Marker Interpolation
- **Deliverable:** `frontend/src/services/markerInterpolation.ts`
- **Tests:** `frontend/src/services/__tests__/markerInterpolation.test.ts`
- **Steps:**
  1. Write failing tests for `shortestAngleDelta`, `interpolateAngle`, and `lerpCoordinate`.
  2. Implement mathematical helpers in `markerInterpolation.ts`.
  3. Verify with `npm test`.

### Task 2: Build `AnimatedVehicleMarker.tsx` Component
- **Deliverable:** `frontend/src/components/AnimatedVehicleMarker.tsx`
- **Tests:** `frontend/src/components/__tests__/AnimatedVehicleMarker.test.tsx`
- **Steps:**
  1. Write test mocking `requestAnimationFrame` and checking `setLatLng` calls and unmount cleanup.
  2. Implement `AnimatedVehicleMarker` using Leaflet `markerRef` and `requestAnimationFrame`.
  3. Verify all tests pass.

### Task 3: Integrate with `ShuttleMap.tsx`
- **Deliverable:** `frontend/src/components/ShuttleMap.tsx`
- **Steps:**
  1. Replace `<Marker>` mapping with `<AnimatedVehicleMarker>`.
  2. Run existing `ShuttleMap.test.tsx` and `App.test.tsx`.
  3. Verify zero regressions across full test suite.

### Task 4: Verification, Production Build & Master Push
- **Steps:**
  1. Run `npm test` (all suites passing).
  2. Run `npm run build` (clean Vite build).
  3. Use Puppeteer to capture multi-frame movement snapshots confirming 60 FPS smooth gliding.
  4. Commit and push to `master`.
