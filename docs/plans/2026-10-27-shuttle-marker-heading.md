# Top-Down Shuttle Van Icon & Directional Heading Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the generic vehicle marker on the dashboard map into a top-down shuttle van icon with forward headlights and vehicle ID badge, and accurately orient its heading using smart bearing fallback and stationary heading retention.

**Architecture:** Client-side vector SVG rendering within Leaflet `divIcon` with smooth CSS transitions; mathematical forward azimuth calculation for bearing fallback; continuous angle delta tracking across 0°/360° boundaries.

**Tech Stack:** React 18, Leaflet, React-Leaflet, TypeScript, Vitest, Tailwind CSS.

## Global Constraints

- No external image assets; all icons must be pure inline SVG for instant crisp rendering.
- Heading angles must follow navigation conventions: 0° = North, 90° = East, 180° = South, 270° = West.
- Vehicle ID badges must remain horizontally level above the vehicle marker and not rotate with vehicle body.
- When stationary (speed < 1.5 km/h or movement within 8m GPS jitter), retain last known heading instead of snapping to 0°.
- All existing 90 frontend tests must continue to pass with zero regressions.

---

### Task 1: Implement `calculateBearing` in Distance Calculator

**Files:**
- Modify: `frontend/src/services/distanceCalculator.ts`
- Test: `frontend/src/services/__tests__/distanceCalculator.test.ts`

**Interfaces:**
- Produces: `calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number`

- [ ] **Step 1: Write failing tests for calculateBearing**

Add tests to `frontend/src/services/__tests__/distanceCalculator.test.ts`:

```typescript
describe('calculateBearing', () => {
  it('calculates 0 degrees for due North movement', () => {
    // Moving directly North from Bangkok equator-side
    const bearing = calculateBearing(13.0, 100.0, 14.0, 100.0);
    expect(Math.round(bearing)).toBe(0);
  });

  it('calculates 90 degrees for due East movement', () => {
    // Moving directly East along equator
    const bearing = calculateBearing(0.0, 100.0, 0.0, 101.0);
    expect(Math.round(bearing)).toBe(90);
  });

  it('calculates 180 degrees for due South movement', () => {
    const bearing = calculateBearing(14.0, 100.0, 13.0, 100.0);
    expect(Math.round(bearing)).toBe(180);
  });

  it('calculates 270 degrees for due West movement', () => {
    const bearing = calculateBearing(0.0, 101.0, 0.0, 100.0);
    expect(Math.round(bearing)).toBe(270);
  });

  it('calculates ~45 degrees for North-East diagonal movement', () => {
    const bearing = calculateBearing(13.0, 100.0, 14.0, 101.0);
    expect(Math.round(bearing)).toBeGreaterThan(40);
    expect(Math.round(bearing)).toBeLessThan(50);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix frontend src/services/__tests__/distanceCalculator.test.ts`  
Expected: FAIL with "calculateBearing is not defined"

- [ ] **Step 3: Implement `calculateBearing`**

In `frontend/src/services/distanceCalculator.ts`, add and export `calculateBearing`:

```typescript
/**
 * Calculates forward azimuth (bearing) in degrees (0 - 360) from point 1 to point 2.
 * 0° = North, 90° = East, 180° = South, 270° = West.
 */
export function calculateBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLng = toRadians(lng2 - lng1);
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);

  const y = Math.sin(dLng) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLng);

  const bearingRad = Math.atan2(y, x);
  return ((bearingRad * 180.0) / Math.PI + 360.0) % 360.0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --prefix frontend src/services/__tests__/distanceCalculator.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/distanceCalculator.ts frontend/src/services/__tests__/distanceCalculator.test.ts
git commit -m "feat(services): implement calculateBearing for GPS coordinate navigation"
```

---

### Task 2: Implement Top-Down Shuttle Van Icon in `ShuttleMap.tsx`

**Files:**
- Modify: `frontend/src/components/ShuttleMap.tsx`
- Test: `frontend/src/components/__tests__/ShuttleMap.test.tsx`

**Interfaces:**
- Consumes: `escapeHtml`, `heading`, `isSelected`, `vehicleId`, `isOnline`
- Produces: `createVehicleIcon(heading: number, isSelected: boolean, vehicleId: string, isOnline: boolean): L.DivIcon`

- [ ] **Step 1: Write failing test for createVehicleIcon shuttle van anatomy**

In `frontend/src/components/__tests__/ShuttleMap.test.tsx`, update and add assertions for the shuttle van SVG:

```typescript
  it('creates shuttle van icon with headlight beam, van body, and non-rotating vehicle id badge', () => {
    const icon = createVehicleIcon(90, true, 'VAN-01', true);
    expect(icon.options.className).toBe('custom-vehicle-marker');
    expect(icon.options.iconSize).toEqual([52, 52]);
    expect(icon.options.iconAnchor).toEqual([26, 26]);

    const html = icon.options.html as string;
    expect(html).toContain('VAN-01');
    expect(html).toContain('rotate(90deg)');
    // Headlight beam / van indicators
    expect(html).toContain('headlight-beam');
    expect(html).toContain('shuttle-van-body');
  });

  it('renders muted gray shuttle van with reduced opacity when offline', () => {
    const icon = createVehicleIcon(180, false, 'VAN-OFFLINE', false);
    const html = icon.options.html as string;
    expect(html).toContain('VAN-OFFLINE');
    expect(html).toContain('rotate(180deg)');
    expect(html).toContain('opacity: 0.6');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix frontend src/components/__tests__/ShuttleMap.test.tsx`  
Expected: FAIL due to missing `shuttle-van-body` and `headlight-beam`

- [ ] **Step 3: Update `createVehicleIcon` in `ShuttleMap.tsx`**

Replace `createVehicleIcon` in `frontend/src/components/ShuttleMap.tsx`:

```typescript
// SVG top-down shuttle van marker with headlight beam, van body, and fixed vehicle badge
export function createVehicleIcon(
  heading: number = 0,
  isSelected: boolean = false,
  vehicleId: string = '',
  isOnline: boolean = true
) {
  const safeVehicleId = escapeHtml(vehicleId);
  const primaryColor = !isOnline ? '#64748b' : isSelected ? '#34d399' : '#10b981';
  const borderColor = !isOnline ? '#94a3b8' : isSelected ? '#6ee7b7' : '#ffffff';
  const overallOpacity = !isOnline ? '0.6' : '1';
  const pulseHtml = isOnline
    ? `<div style="position: absolute; width: 44px; height: 44px; background: rgba(16, 185, 129, ${isSelected ? '0.35' : '0.15'}); border-radius: 9999px; animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></div>`
    : '';

  const headlightGradient = isOnline
    ? `<defs>
        <linearGradient id="headlight-glow" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stop-color="${primaryColor}" stop-opacity="0.6"/>
          <stop offset="100%" stop-color="${primaryColor}" stop-opacity="0"/>
        </linearGradient>
       </defs>`
    : '';

  const headlightBeam = isOnline
    ? `<path class="headlight-beam" d="M 9 10 L 3 0 L 23 0 L 17 10 Z" fill="url(#headlight-glow)" pointer-events="none" />`
    : '';

  const html = `
    <div style="position: relative; width: 52px; height: 52px; display: flex; align-items: center; justify-content: center; opacity: ${overallOpacity};">
      <!-- Vehicle ID Pill Badge (Fixed horizontal orientation) -->
      <div style="position: absolute; top: -14px; background: rgba(15, 23, 42, 0.95); color: #ffffff; font-size: 9px; font-weight: bold; font-family: monospace; padding: 1px 6px; border-radius: 4px; border: 1px solid ${borderColor}; white-space: nowrap; box-shadow: 0 2px 5px rgba(0,0,0,0.3); pointer-events: none; z-index: 10;">
        ${safeVehicleId}
      </div>
      <!-- Pulse Ring -->
      ${pulseHtml}
      <!-- Rotational Top-Down Van Body -->
      <div class="shuttle-van-body" style="position: relative; width: 26px; height: 42px; display: flex; align-items: center; justify-content: center; transform: rotate(${heading}deg); transition: transform 0.4s cubic-bezier(0.2, 0, 0, 1);">
        <svg width="26" height="42" viewBox="0 0 26 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          ${headlightGradient}
          <!-- Forward Headlight Beam Cone -->
          ${headlightBeam}
          <!-- Side Mirrors -->
          <rect x="1" y="14" width="2" height="4" rx="1" fill="${borderColor}" />
          <rect x="23" y="14" width="2" height="4" rx="1" fill="${borderColor}" />
          <!-- Wheels -->
          <rect x="1.5" y="10" width="1.5" height="5" rx="0.75" fill="#0f172a" />
          <rect x="23" y="10" width="1.5" height="5" rx="0.75" fill="#0f172a" />
          <rect x="1.5" y="28" width="1.5" height="5" rx="0.75" fill="#0f172a" />
          <rect x="23" y="28" width="1.5" height="5" rx="0.75" fill="#0f172a" />
          <!-- Van Chassis Shell -->
          <rect x="3" y="9" width="20" height="28" rx="4" fill="#0f172a" stroke="${borderColor}" stroke-width="1.8" />
          <!-- Front Hood Curve -->
          <path d="M 4 12 C 4 9.5 7 8 13 8 C 19 8 22 9.5 22 12 Z" fill="#1e293b" />
          <!-- Windshield Glass -->
          <path d="M 5 14 C 5 12.5 8 11.5 13 11.5 C 18 11.5 21 12.5 21 14 L 20 18 L 6 18 Z" fill="#38bdf8" fill-opacity="0.85" />
          <!-- Front Headlight Lamps -->
          <circle cx="6" cy="9.5" r="1.5" fill="${primaryColor}" />
          <circle cx="20" cy="9.5" r="1.5" fill="${primaryColor}" />
          <!-- Side Passenger Windows -->
          <rect x="4.5" y="19.5" width="2" height="12" rx="0.8" fill="#38bdf8" fill-opacity="0.65" />
          <rect x="19.5" y="19.5" width="2" height="12" rx="0.8" fill="#38bdf8" fill-opacity="0.65" />
          <!-- Shuttle Passenger Cabin Roof Ridge -->
          <line x1="8.5" y1="20" x2="8.5" y2="31" stroke="${primaryColor}" stroke-width="1" stroke-opacity="0.4" />
          <line x1="17.5" y1="20" x2="17.5" y2="31" stroke="${primaryColor}" stroke-width="1" stroke-opacity="0.4" />
          <rect x="10" y="22" width="6" height="8" rx="1.5" fill="#1e293b" stroke="${primaryColor}" stroke-width="1" stroke-opacity="0.5" />
          <!-- Rear Window Glass -->
          <rect x="6" y="33.5" width="14" height="2" rx="0.8" fill="#38bdf8" fill-opacity="0.7" />
          <!-- Rear Taillights -->
          <rect x="4.5" y="36" width="2.5" height="1" rx="0.5" fill="#ef4444" />
          <rect x="19" y="36" width="2.5" height="1" rx="0.5" fill="#ef4444" />
        </svg>
      </div>
    </div>
  `;
  return L.divIcon({
    html,
    className: 'custom-vehicle-marker',
    iconSize: [52, 52],
    iconAnchor: [26, 26],
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --prefix frontend src/components/__tests__/ShuttleMap.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ShuttleMap.tsx frontend/src/components/__tests__/ShuttleMap.test.tsx
git commit -m "feat(components): render top-down shuttle van vector icon with headlights"
```

---

### Task 3: Smart Bearing Fallback & Heading Retention in `AnimatedVehicleMarker.tsx`

**Files:**
- Modify: `frontend/src/components/AnimatedVehicleMarker.tsx`
- Test: `frontend/src/components/__tests__/AnimatedVehicleMarker.test.tsx`

**Interfaces:**
- Consumes: `calculateBearing`, `shortestAngleDelta`, `haversineDistance`, `JITTER_THRESHOLD_KM`
- Produces: Smooth heading orientation facing forward during motion and preserved orientation when stationary.

- [ ] **Step 1: Write failing tests for smart heading calculation in AnimatedVehicleMarker**

In `frontend/src/components/__tests__/AnimatedVehicleMarker.test.tsx`:

```typescript
  it('calculates bearing automatically when vehicle moves East and telemetry heading is 0', () => {
    const initialVehicle = {
      vehicle_id: 'shuttle-cm-01',
      lat: 18.7800,
      lng: 98.9800,
      speed: 25.0,
      heading: 0,
      timestamp: 1000,
    };

    const { rerender, container } = render(
      <MapContainer center={[18.78, 98.98]} zoom={15}>
        <AnimatedVehicleMarker vehicle={initialVehicle} />
      </MapContainer>
    );

    // Move vehicle directly East with speed 25 km/h, heading still 0 in telemetry
    const movedVehicle = {
      ...initialVehicle,
      lng: 98.9850,
      timestamp: 6000,
    };

    rerender(
      <MapContainer center={[18.78, 98.98]} zoom={15}>
        <AnimatedVehicleMarker vehicle={movedVehicle} />
      </MapContainer>
    );

    const vanBody = container.querySelector('.shuttle-van-body');
    expect(vanBody).toBeDefined();
    // Bearing from 98.9800 to 98.9850 is ~90 deg East
    expect(vanBody?.getAttribute('style')).toMatch(/rotate\(9\ddeg\)/);
  });

  it('retains last known heading when vehicle stops (speed = 0)', () => {
    const movingVehicle = {
      vehicle_id: 'shuttle-cm-01',
      lat: 18.7800,
      lng: 98.9800,
      speed: 30.0,
      heading: 120,
      timestamp: 1000,
    };

    const { rerender, container } = render(
      <MapContainer center={[18.78, 98.98]} zoom={15}>
        <AnimatedVehicleMarker vehicle={movingVehicle} />
      </MapContainer>
    );

    // Vehicle stops, speed = 0, no heading provided
    const stoppedVehicle = {
      ...movingVehicle,
      speed: 0,
      heading: 0,
      timestamp: 6000,
    };

    rerender(
      <MapContainer center={[18.78, 98.98]} zoom={15}>
        <AnimatedVehicleMarker vehicle={stoppedVehicle} />
      </MapContainer>
    );

    const vanBody = container.querySelector('.shuttle-van-body');
    // Should retain 120 deg and NOT reset to 0 deg North
    expect(vanBody?.getAttribute('style')).toContain('rotate(120deg)');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix frontend src/components/__tests__/AnimatedVehicleMarker.test.tsx`  
Expected: FAIL

- [ ] **Step 3: Update `AnimatedVehicleMarker.tsx` with Smart Bearing Fallback**

In `frontend/src/components/AnimatedVehicleMarker.tsx`:
1. Import `calculateBearing`, `haversineDistance`, `JITTER_THRESHOLD_KM` from `../services/distanceCalculator`.
2. Import `shortestAngleDelta` from `../services/markerInterpolation`.
3. Add `cumulativeHeadingRef` and `lastHeadingRef` to track vehicle orientation.
4. When telemetry arrives, determine target heading:
   - If `vehicle.heading` is defined and > 0, use `vehicle.heading`.
   - Else if `vehicle.speed >= 1.5` or `haversineDistance(prev, new) > JITTER_THRESHOLD_KM`, compute `calculateBearing(prev[0], prev[1], new[0], new[1])`.
   - Else (stationary / stopped), keep `lastHeadingRef.current`.
5. Accumulate continuous rotation using `shortestAngleDelta` to avoid 360° flip glitch.
6. Pass continuous heading to `createVehicleIcon`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --prefix frontend src/components/__tests__/AnimatedVehicleMarker.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AnimatedVehicleMarker.tsx frontend/src/components/__tests__/AnimatedVehicleMarker.test.tsx
git commit -m "feat(components): smart bearing fallback and heading retention for AnimatedVehicleMarker"
```

---

### Task 4: Full Verification & Build Check

**Files:**
- Entire codebase

- [ ] **Step 1: Run all unit and integration tests**

Run: `npm test --prefix frontend`  
Expected: All test suites PASS (0 failures)

- [ ] **Step 2: Run production build**

Run: `npm run build --prefix frontend`  
Expected: Build succeeds with 0 errors

- [ ] **Step 3: Commit any final test updates or cleanups**

```bash
git add .
git commit -m "chore: verify tests and production build for shuttle marker heading alignment"
```
