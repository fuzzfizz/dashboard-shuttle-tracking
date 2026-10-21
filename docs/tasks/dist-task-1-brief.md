# Task 1 Brief: Spatial Distance & GPS Jitter Filter Service

## Files:
- Create: `frontend/src/services/distanceCalculator.ts`
- Create: `frontend/src/services/__tests__/distanceCalculator.test.ts`

## Interfaces:
- Produces:
  - `haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number` (in km)
  - `calculateDistanceIncrement(prev: CoordinatePoint | null | undefined, curr: CoordinatePoint): number`
  - `CoordinatePoint { lat: number; lng: number; speed: number; timestamp: number; }`
  - `JITTER_THRESHOLD_KM = 0.008` (8 meters)
  - `MIN_SPEED_THRESHOLD_KMH = 1.5`
  - `MAX_VALID_SPEED_KMH = 150.0`

## Global Constraints:
- GPS Jitter Threshold: ignore movement $< 0.008\text{ km}$ ($8$ meters) when speed $< 1.5\text{ km/h}$.
- Teleport Filter: ignore coordinates implying instantaneous speed $> 150\text{ km/h}$.
- Strict TypeScript with zero `any`.
- All tests must pass with clean output.

## Steps:

### Step 1: Write failing unit tests for distance calculator
Create `frontend/src/services/__tests__/distanceCalculator.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { haversineDistance, calculateDistanceIncrement } from '../distanceCalculator';

describe('distanceCalculator', () => {
  it('calculates known distance accurately using Haversine formula', () => {
    // Distance between Victory Monument (13.7649, 100.5383) and Siam Paragon (13.7460, 100.5340) ~2.15 km
    const dist = haversineDistance(13.7649, 100.5383, 13.7460, 100.5340);
    expect(dist).toBeGreaterThan(2.0);
    expect(dist).toBeLessThan(2.3);
  });

  it('filters out GPS jitter when stationary (speed < 1.5 km/h and distance < 8m)', () => {
    const prev = { lat: 13.756300, lng: 100.501800, speed: 0.0, timestamp: 1000 };
    // Small drift of ~4 meters
    const next = { lat: 13.756336, lng: 100.501800, speed: 0.5, timestamp: 2000 };

    const dist = calculateDistanceIncrement(prev, next);
    expect(dist).toBe(0);
  });

  it('accumulates valid movement distance when vehicle is in motion', () => {
    const prev = { lat: 13.756300, lng: 100.501800, speed: 30.0, timestamp: 1000 };
    // Move ~110 meters in 5 seconds
    const next = { lat: 13.757300, lng: 100.501800, speed: 32.0, timestamp: 6000 };

    const dist = calculateDistanceIncrement(prev, next);
    expect(dist).toBeGreaterThan(0.1);
    expect(dist).toBeLessThan(0.12);
  });

  it('rejects unrealistic GPS teleport glitch (> 150 km/h)', () => {
    const prev = { lat: 13.7563, lng: 100.5018, speed: 30.0, timestamp: 1000 };
    // Jumps to Chiang Mai in 1 second
    const next = { lat: 18.7883, lng: 98.9853, speed: 30.0, timestamp: 2000 };

    const dist = calculateDistanceIncrement(prev, next);
    expect(dist).toBe(0);
  });
});
```

### Step 2: Run test to verify it fails
Run: `cd frontend; npx vitest run src/services/__tests__/distanceCalculator.test.ts`
Expected: FAIL (Cannot find module '../distanceCalculator')

### Step 3: Implement `frontend/src/services/distanceCalculator.ts`
```typescript
export const JITTER_THRESHOLD_KM = 0.008; // 8 meters
export const MIN_SPEED_THRESHOLD_KMH = 1.5; // km/h
export const MAX_VALID_SPEED_KMH = 150.0; // km/h

const EARTH_RADIUS_KM = 6371.0;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180.0;
}

/**
 * Calculates great-circle distance between two GPS coordinates in kilometers.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export interface CoordinatePoint {
  lat: number;
  lng: number;
  speed: number;
  timestamp: number;
}

/**
 * Computes incremental distance between consecutive telemetry points with noise filtering.
 */
export function calculateDistanceIncrement(
  prev: CoordinatePoint | null | undefined,
  curr: CoordinatePoint
): number {
  if (!prev) return 0;

  const rawDistanceKm = haversineDistance(prev.lat, prev.lng, curr.lat, curr.lng);

  // 1. Filter out parked GPS jitter
  if (rawDistanceKm < JITTER_THRESHOLD_KM && curr.speed < MIN_SPEED_THRESHOLD_KMH) {
    return 0;
  }

  // 2. Reject GPS teleport glitch if implied speed exceeds threshold
  const timeElapsedHours = Math.abs(curr.timestamp - prev.timestamp) / 3600000;
  if (timeElapsedHours > 0) {
    const impliedSpeed = rawDistanceKm / timeElapsedHours;
    if (impliedSpeed > MAX_VALID_SPEED_KMH) {
      return 0;
    }
  }

  return rawDistanceKm;
}
```

### Step 4: Run test to verify it passes
Run: `cd frontend; npx vitest run src/services/__tests__/distanceCalculator.test.ts`
Expected: PASS (4 tests passed)

### Step 5: Commit
```bash
git add frontend/src/services/distanceCalculator.ts frontend/src/services/__tests__/distanceCalculator.test.ts
git commit -m "feat: add haversine distance calculator with GPS jitter filtering"
```
