# Task 1 Brief: Extend Telemetry Types and Fleet Status Helpers

## Files:
- Modify: `frontend/src/types/telemetry.ts`
- Create: `frontend/src/services/fleetStatus.ts`
- Create: `frontend/src/services/__tests__/fleetStatus.test.ts`

## Interfaces:
- Consumes: `TelemetryPayload` from `frontend/src/types/telemetry.ts`
- Produces: `FleetMap`, `VehicleStatus`, `OFFLINE_THRESHOLD_MS`, `computeVehicleStatus()`, `calculateFleetStats()`

## Global Constraints:
- Stale threshold: 15,000ms (`OFFLINE_THRESHOLD_MS = 15000`).
- Strict TypeScript types with no `any`.
- All tests must pass with clean output.

## Steps:

### Step 1: Write failing unit test for fleet status helpers
Create `frontend/src/services/__tests__/fleetStatus.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { computeVehicleStatus, calculateFleetStats } from '../fleetStatus';
import { TelemetryPayload } from '../../types/telemetry';

describe('fleetStatus helpers', () => {
  const mockTelemetry1: TelemetryPayload = {
    vehicle_id: 'shuttle-01',
    lat: 13.7563,
    lng: 100.5018,
    speed: 30.0,
    heading: 90,
    timestamp: 1000,
  };

  const mockTelemetry2: TelemetryPayload = {
    vehicle_id: 'shuttle-02',
    lat: 13.7600,
    lng: 100.5100,
    speed: 10.0,
    heading: 180,
    timestamp: 1000,
  };

  it('computes online status correctly within 15 seconds threshold', () => {
    const now = 20000;
    const online = computeVehicleStatus(mockTelemetry1, now - 5000, now);
    expect(online.isOnline).toBe(true);

    const offline = computeVehicleStatus(mockTelemetry1, now - 20000, now);
    expect(offline.isOnline).toBe(false);
  });

  it('calculates fleet statistics correctly', () => {
    const fleet = {
      'shuttle-01': mockTelemetry1,
      'shuttle-02': mockTelemetry2,
    };
    const lastSeenMap = {
      'shuttle-01': 10000,
      'shuttle-02': 2000, // Offline if now is 20000
    };
    const stats = calculateFleetStats(fleet, lastSeenMap, 20000);
    expect(stats.totalVehicles).toBe(2);
    expect(stats.onlineVehicles).toBe(1);
    expect(stats.averageSpeed).toBe(20.0);
  });
});
```

### Step 2: Run test to verify it fails
Run: `cd frontend; npx vitest run src/services/__tests__/fleetStatus.test.ts`
Expected: FAIL (Cannot find module '../fleetStatus')

### Step 3: Update `frontend/src/types/telemetry.ts`
```typescript
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface TelemetryPayload {
  vehicle_id: string;
  lat: number;
  lng: number;
  speed: number;
  heading?: number;
  timestamp: number;
}

export type FleetMap = Record<string, TelemetryPayload>;

export interface VehicleStatus {
  telemetry: TelemetryPayload;
  lastSeen: number;
  isOnline: boolean;
}

export interface FleetStats {
  totalVehicles: number;
  onlineVehicles: number;
  averageSpeed: number;
}

export interface UseShuttleTelemetryOptions {
  brokerUrl?: string;
  topic?: string;
  username?: string;
  password?: string;
}
```

### Step 4: Implement `frontend/src/services/fleetStatus.ts`
```typescript
import { FleetMap, FleetStats, TelemetryPayload, VehicleStatus } from '../types/telemetry';

export const OFFLINE_THRESHOLD_MS = 15000;

export function computeVehicleStatus(
  telemetry: TelemetryPayload,
  lastSeen: number,
  now: number = Date.now()
): VehicleStatus {
  return {
    telemetry,
    lastSeen,
    isOnline: now - lastSeen < OFFLINE_THRESHOLD_MS,
  };
}

export function calculateFleetStats(
  fleet: FleetMap,
  lastSeenMap: Record<string, number>,
  now: number = Date.now()
): FleetStats {
  const vehicleList = Object.values(fleet);
  if (vehicleList.length === 0) {
    return { totalVehicles: 0, onlineVehicles: 0, averageSpeed: 0 };
  }

  let onlineCount = 0;
  let totalSpeed = 0;

  for (const v of vehicleList) {
    const lastSeen = lastSeenMap[v.vehicle_id] || 0;
    if (now - lastSeen < OFFLINE_THRESHOLD_MS) {
      onlineCount++;
    }
    totalSpeed += v.speed;
  }

  return {
    totalVehicles: vehicleList.length,
    onlineVehicles: onlineCount,
    averageSpeed: Math.round((totalSpeed / vehicleList.length) * 10) / 10,
  };
}
```

### Step 5: Run tests to verify they pass
Run: `cd frontend; npx vitest run src/services/__tests__/fleetStatus.test.ts`
Expected: PASS (2 tests passed)

### Step 6: Commit
```bash
git add frontend/src/types/telemetry.ts frontend/src/services/fleetStatus.ts frontend/src/services/__tests__/fleetStatus.test.ts
git commit -m "feat: add fleet status helpers and multi-vehicle types"
```
