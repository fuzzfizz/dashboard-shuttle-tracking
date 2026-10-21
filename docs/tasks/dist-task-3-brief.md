# Task 3 Brief: Real-Time & Persistent Daily Metrics Hook (useDailyMetrics)

## Files:
- Create: `frontend/src/hooks/useDailyMetrics.ts`
- Create: `frontend/src/hooks/__tests__/useDailyMetrics.test.ts`

## Interfaces:
- Consumes:
  - `FleetMap` from `../types/telemetry`
  - `DailyMetricsMap`, `DailyVehicleMetric` from `../types/metrics`
  - `getSupabaseClient`, `isSupabaseConfigured` from `../services/supabaseClient`
  - `calculateDistanceIncrement`, `CoordinatePoint` from `../services/distanceCalculator`
- Produces:
  ```typescript
  export function useDailyMetrics(vehicles: FleetMap): {
    dailyMetrics: DailyMetricsMap;
    totalFleetDistanceKm: number;
    isLoading: boolean;
    refetch: () => void;
  }
  ```

## Global Constraints:
- Resilient: If Supabase is unconfigured, accumulates in-memory session distance per vehicle using `calculateDistanceIncrement` without throwing errors.
- If Supabase is configured, fetches today's metrics (`daily_vehicle_metrics` where `date = CURRENT_DATE`) on mount and periodically (every 30s), merging with any live real-time increments.
- Precision: `total_distance_km` and `totalFleetDistanceKm` are rounded to 2 decimal places.
- Strict TypeScript with zero `any`.
- All tests must pass with clean output.

## Steps:

### Step 1: Write failing unit test for `useDailyMetrics`
Create `frontend/src/hooks/__tests__/useDailyMetrics.test.ts`:
```typescript
import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useDailyMetrics } from '../useDailyMetrics';
import { FleetMap } from '../../types/telemetry';

describe('useDailyMetrics', () => {
  it('initializes with zero distance and accumulates in-memory when Supabase is unconfigured', () => {
    const initialFleet: FleetMap = {};
    const { result, rerender } = renderHook(({ fleet }) => useDailyMetrics(fleet), {
      initialProps: { fleet: initialFleet },
    });

    expect(result.current.totalFleetDistanceKm).toBe(0);

    // Simulate vehicle movement
    const updatedFleet1: FleetMap = {
      'shuttle-01': {
        vehicle_id: 'shuttle-01',
        lat: 13.7563,
        lng: 100.5018,
        speed: 25.0,
        timestamp: 1000,
      },
    };
    rerender({ fleet: updatedFleet1 });

    // Vehicle moves ~200 meters in 5 seconds
    const updatedFleet2: FleetMap = {
      'shuttle-01': {
        vehicle_id: 'shuttle-01',
        lat: 13.7580,
        lng: 100.5018,
        speed: 30.0,
        timestamp: 6000,
      },
    };
    rerender({ fleet: updatedFleet2 });

    const shuttle01Metric = result.current.dailyMetrics['shuttle-01'];
    expect(shuttle01Metric).toBeDefined();
    expect(shuttle01Metric.total_distance_km).toBeGreaterThan(0.1);
    expect(result.current.totalFleetDistanceKm).toBe(shuttle01Metric.total_distance_km);
  });
});
```

### Step 2: Run test to verify it fails
Run: `cd frontend; npx vitest run src/hooks/__tests__/useDailyMetrics.test.ts`
Expected: FAIL (Cannot find module '../useDailyMetrics')

### Step 3: Implement `frontend/src/hooks/useDailyMetrics.ts`
```typescript
import { useEffect, useRef, useState, useCallback } from 'react';
import { FleetMap } from '../types/telemetry';
import { DailyMetricsMap } from '../types/metrics';
import { getSupabaseClient, isSupabaseConfigured } from '../services/supabaseClient';
import { calculateDistanceIncrement, CoordinatePoint } from '../services/distanceCalculator';

export function useDailyMetrics(vehicles: FleetMap) {
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetricsMap>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // In-memory tracking of previous coordinate per vehicle
  const prevCoordsRef = useRef<Record<string, CoordinatePoint>>({});

  const todayStr = new Date().toISOString().split('T')[0];

  // Fetch metrics from Supabase if configured
  const fetchSupabaseMetrics = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('daily_vehicle_metrics')
        .select('*')
        .eq('date', todayStr);

      if (!error && data) {
        const map: DailyMetricsMap = {};
        for (const row of data) {
          map[row.vehicle_id] = {
            vehicle_id: row.vehicle_id,
            date: row.date,
            total_distance_km: Number(row.total_distance_km) || 0,
            max_speed_kmh: Number(row.max_speed_kmh) || 0,
            avg_speed_kmh: Number(row.avg_speed_kmh) || 0,
            active_minutes: Number(row.active_minutes) || 0,
            last_updated_at: row.last_updated_at || new Date().toISOString(),
          };
        }
        setDailyMetrics((prev) => ({ ...prev, ...map }));
      }
    } catch (err) {
      console.warn('Supabase daily metrics query error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [todayStr]);

  // Initial fetch and 30-second refetch interval
  useEffect(() => {
    if (isSupabaseConfigured()) {
      fetchSupabaseMetrics();
      const interval = setInterval(fetchSupabaseMetrics, 30000);
      return () => clearInterval(interval);
    }
  }, [fetchSupabaseMetrics]);

  // Real-time incremental distance accumulation from live telemetry stream
  useEffect(() => {
    for (const vehicle of Object.values(vehicles)) {
      const { vehicle_id, lat, lng, speed, timestamp } = vehicle;
      const currPoint: CoordinatePoint = { lat, lng, speed, timestamp };
      const prevPoint = prevCoordsRef.current[vehicle_id];

      if (prevPoint) {
        const increment = calculateDistanceIncrement(prevPoint, currPoint);
        if (increment > 0) {
          setDailyMetrics((prev) => {
            const existing = prev[vehicle_id] || {
              vehicle_id,
              date: todayStr,
              total_distance_km: 0,
              max_speed_kmh: 0,
              avg_speed_kmh: 0,
              active_minutes: 0,
              last_updated_at: new Date().toISOString(),
            };

            const updatedDistance = Math.round((existing.total_distance_km + increment) * 100) / 100;
            const updatedMaxSpeed = Math.max(existing.max_speed_kmh, Math.round(speed * 10) / 10);

            return {
              ...prev,
              [vehicle_id]: {
                ...existing,
                total_distance_km: updatedDistance,
                max_speed_kmh: updatedMaxSpeed,
                last_updated_at: new Date().toISOString(),
              },
            };
          });
        }
      }

      prevCoordsRef.current[vehicle_id] = currPoint;
    }
  }, [vehicles, todayStr]);

  const totalFleetDistanceKm = Math.round(
    Object.values(dailyMetrics).reduce((sum, m) => sum + m.total_distance_km, 0) * 100
  ) / 100;

  return {
    dailyMetrics,
    totalFleetDistanceKm,
    isLoading,
    refetch: fetchSupabaseMetrics,
  };
}
```

### Step 4: Run test to verify it passes
Run: `cd frontend; npx vitest run src/hooks/__tests__/useDailyMetrics.test.ts`
Expected: PASS

### Step 5: Commit
```bash
git add frontend/src/hooks/useDailyMetrics.ts frontend/src/hooks/__tests__/useDailyMetrics.test.ts
git commit -m "feat: add useDailyMetrics hook with Supabase query and live accumulation"
```
