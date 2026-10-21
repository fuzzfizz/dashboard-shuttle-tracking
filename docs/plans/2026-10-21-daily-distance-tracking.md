# Daily Distance Tracking & Supabase Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement persistent daily vehicle distance tracking and analytics using Supabase (PostgreSQL) and an MQTT ingestion worker, with graceful in-memory calculation fallback on the frontend.

**Architecture:** A mathematical distance calculation service (`distanceCalculator.ts`) computes accurate ground distance using the Haversine formula with a stationary GPS jitter filter. A Supabase schema (`daily_vehicle_metrics` and `telemetry_logs`) stores daily aggregations. A background ingestion worker (`tools/worker.js`) batches MQTT telemetry into Supabase. A React hook (`useDailyMetrics.ts`) and UI components (`DailyMetricsModal.tsx`, `FleetPanel.tsx`) present daily mileage and statistics.

**Tech Stack:** TypeScript, React 18, Supabase JS Client (`@supabase/supabase-js`), Vitest, Testing Library, Node.js, MQTT.js.

## Global Constraints

- Never crash or throw runtime errors if Supabase environment variables are missing; gracefully fall back to in-memory session distance.
- GPS Jitter Threshold: ignore movement $< 0.008\text{ km}$ ($8$ meters) when speed $< 1.5\text{ km/h}$.
- Teleport Filter: ignore coordinates implying instantaneous speed $> 150\text{ km/h}$.
- Maintain 100% test pass rate across all existing 29 Vitest tests.
- Production build (`tsc && vite build`) must pass cleanly with 0 errors.

---

### Task 1: Spatial Distance & GPS Jitter Filter Service

**Files:**
- Create: `frontend/src/services/distanceCalculator.ts`
- Create: `frontend/src/services/__tests__/distanceCalculator.test.ts`

**Interfaces:**
- Produces:
  - `haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number` (in km)
  - `calculateDistanceIncrement(prevPoint, newPoint): number` (with jitter and teleport filter)
  - `JITTER_THRESHOLD_KM = 0.008` (8 meters)
  - `MAX_VALID_SPEED_KMH = 150`

- [ ] **Step 1: Write failing unit tests for distance calculator**

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

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npx vitest run src/services/__tests__/distanceCalculator.test.ts`  
Expected: FAIL (Cannot find module '../distanceCalculator')

- [ ] **Step 3: Implement `frontend/src/services/distanceCalculator.ts`**

Create `frontend/src/services/distanceCalculator.ts`:

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

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend; npx vitest run src/services/__tests__/distanceCalculator.test.ts`  
Expected: PASS (4 tests passed)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/distanceCalculator.ts frontend/src/services/__tests__/distanceCalculator.test.ts
git commit -m "feat: add haversine distance calculator with GPS jitter filtering"
```

---

### Task 2: Supabase Schema Migration Script & Client Setup

**Files:**
- Create: `docs/migrations/001_daily_metrics_and_logs.sql`
- Create: `frontend/src/types/metrics.ts`
- Create: `frontend/src/services/supabaseClient.ts`
- Create: `frontend/src/services/__tests__/supabaseClient.test.ts`

**Interfaces:**
- Consumes: `@supabase/supabase-js` (install via npm in `frontend`)
- Produces: `supabase` client instance, `DailyVehicleMetric` type, `isSupabaseConfigured()` helper

- [ ] **Step 1: Install `@supabase/supabase-js` in frontend**

Run: `cd frontend; npm install @supabase/supabase-js`

- [ ] **Step 2: Create SQL migration file `docs/migrations/001_daily_metrics_and_logs.sql`**

Create `docs/migrations/001_daily_metrics_and_logs.sql`:

```sql
-- 1. Daily Vehicle Metrics Table
CREATE TABLE IF NOT EXISTS daily_vehicle_metrics (
    vehicle_id VARCHAR(64) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_distance_km NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    max_speed_kmh NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    avg_speed_kmh NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    active_minutes INT NOT NULL DEFAULT 0,
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (vehicle_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_vehicle_metrics (date DESC);

-- 2. Telemetry Logs Table
CREATE TABLE IF NOT EXISTS telemetry_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vehicle_id VARCHAR(64) NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    speed NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    heading NUMERIC(5, 2) DEFAULT 0.00,
    recorded_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_logs_vehicle_time ON telemetry_logs (vehicle_id, recorded_at DESC);

-- 3. Row Level Security (RLS)
ALTER TABLE daily_vehicle_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read daily_vehicle_metrics"
    ON daily_vehicle_metrics FOR SELECT USING (true);

CREATE POLICY "Public read telemetry_logs"
    ON telemetry_logs FOR SELECT USING (true);

CREATE POLICY "Service write daily_vehicle_metrics"
    ON daily_vehicle_metrics FOR ALL
    USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

CREATE POLICY "Service write telemetry_logs"
    ON telemetry_logs FOR INSERT
    WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');
```

- [ ] **Step 3: Create `frontend/src/types/metrics.ts`**

Create `frontend/src/types/metrics.ts`:

```typescript
export interface DailyVehicleMetric {
  vehicle_id: string;
  date: string; // 'YYYY-MM-DD'
  total_distance_km: number;
  max_speed_kmh: number;
  avg_speed_kmh: number;
  active_minutes: number;
  last_updated_at: string;
}

export type DailyMetricsMap = Record<string, DailyVehicleMetric>;
```

- [ ] **Step 4: Create `frontend/src/services/supabaseClient.ts`**

Create `frontend/src/services/supabaseClient.ts`:

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http'));
};

let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!clientInstance && supabaseUrl && supabaseAnonKey) {
    clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });
  }
  return clientInstance;
}
```

- [ ] **Step 5: Write unit test for `supabaseClient.ts`**

Create `frontend/src/services/__tests__/supabaseClient.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { isSupabaseConfigured, getSupabaseClient } from '../supabaseClient';

describe('supabaseClient', () => {
  it('returns null client when environment variables are not set', () => {
    // In test environment, VITE_SUPABASE_URL is unconfigured
    expect(isSupabaseConfigured()).toBe(false);
    expect(getSupabaseClient()).toBeNull();
  });
});
```

- [ ] **Step 6: Run test and commit**

Run: `cd frontend; npx vitest run src/services/__tests__/supabaseClient.test.ts`  
Expected: PASS (1 test passed)

```bash
git add docs/migrations/001_daily_metrics_and_logs.sql frontend/package.json frontend/package-lock.json frontend/src/types/metrics.ts frontend/src/services/supabaseClient.ts frontend/src/services/__tests__/supabaseClient.test.ts
git commit -m "feat: add supabase migration schema and resilient client configuration"
```

---

### Task 3: Real-Time & Persistent Daily Metrics Hook (`useDailyMetrics`)

**Files:**
- Create: `frontend/src/hooks/useDailyMetrics.ts`
- Create: `frontend/src/hooks/__tests__/useDailyMetrics.test.ts`

**Interfaces:**
- Consumes: `FleetMap` from `types/telemetry`, `getSupabaseClient()` from `services/supabaseClient`, `calculateDistanceIncrement` from `services/distanceCalculator`
- Produces: `{ dailyMetrics: DailyMetricsMap, totalFleetDistanceKm: number, isLoading: boolean, refetch: () => void }`

- [ ] **Step 1: Write failing unit test for `useDailyMetrics`**

Create `frontend/src/hooks/__tests__/useDailyMetrics.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react';
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

    // Vehicle moves ~200 meters
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

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npx vitest run src/hooks/__tests__/useDailyMetrics.test.ts`  
Expected: FAIL (Cannot find module '../useDailyMetrics')

- [ ] **Step 3: Implement `frontend/src/hooks/useDailyMetrics.ts`**

Create `frontend/src/hooks/useDailyMetrics.ts`:

```typescript
import { useEffect, useRef, useState, useCallback } from 'react';
import { FleetMap, TelemetryPayload } from '../types/telemetry';
import { DailyMetricsMap, DailyVehicleMetric } from '../types/metrics';
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
            total_distance_km: Number(row.total_distance_km),
            max_speed_kmh: Number(row.max_speed_kmh),
            avg_speed_kmh: Number(row.avg_speed_kmh),
            active_minutes: Number(row.active_minutes),
            last_updated_at: row.last_updated_at,
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

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend; npx vitest run src/hooks/__tests__/useDailyMetrics.test.ts`  
Expected: PASS (1 test passed)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useDailyMetrics.ts frontend/src/hooks/__tests__/useDailyMetrics.test.ts
git commit -m "feat: add useDailyMetrics hook with Supabase query and live accumulation"
```

---

### Task 4: UI Updates - Daily Distance in FleetPanel & DailyMetricsModal

**Files:**
- Create: `frontend/src/components/DailyMetricsModal.tsx`
- Create: `frontend/src/components/__tests__/DailyMetricsModal.test.tsx`
- Modify: `frontend/src/components/FleetPanel.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/__tests__/FleetPanel.test.tsx`

**Interfaces:**
- Consumes: `dailyMetrics: DailyMetricsMap`, `totalFleetDistanceKm: number`
- Produces: Daily distance badge in `FleetPanel`, interactive `DailyMetricsModal` popup

- [ ] **Step 1: Write failing test for `DailyMetricsModal`**

Create `frontend/src/components/__tests__/DailyMetricsModal.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DailyMetricsModal } from '../DailyMetricsModal';
import { DailyMetricsMap } from '../../types/metrics';

describe('DailyMetricsModal', () => {
  const mockMetrics: DailyMetricsMap = {
    'shuttle-01': {
      vehicle_id: 'shuttle-01',
      date: '2026-10-21',
      total_distance_km: 42.5,
      max_speed_kmh: 58.0,
      avg_speed_kmh: 28.5,
      active_minutes: 180,
      last_updated_at: new Date().toISOString(),
    },
  };

  it('renders modal with fleet statistics and vehicle breakdown when open', () => {
    const onClose = vi.fn();
    render(
      <DailyMetricsModal
        isOpen={true}
        onClose={onClose}
        dailyMetrics={mockMetrics}
        totalFleetDistanceKm={42.5}
      />
    );

    expect(screen.getByText(/Daily Fleet Analytics/i)).toBeDefined();
    expect(screen.getByText(/42.5 km/i)).toBeDefined();
    expect(screen.getByText('shuttle-01')).toBeDefined();

    fireEvent.click(screen.getByLabelText(/Close modal/i));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <DailyMetricsModal
        isOpen={false}
        onClose={vi.fn()}
        dailyMetrics={mockMetrics}
        totalFleetDistanceKm={42.5}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npx vitest run src/components/__tests__/DailyMetricsModal.test.tsx`  
Expected: FAIL (Cannot find module '../DailyMetricsModal')

- [ ] **Step 3: Implement `frontend/src/components/DailyMetricsModal.tsx`**

Create `frontend/src/components/DailyMetricsModal.tsx`:

```tsx
import React from 'react';
import { X, Calendar, Route, Gauge, Bus, Clock } from 'lucide-react';
import { DailyMetricsMap } from '../types/metrics';

interface DailyMetricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  dailyMetrics: DailyMetricsMap;
  totalFleetDistanceKm: number;
}

export const DailyMetricsModal: React.FC<DailyMetricsModalProps> = ({
  isOpen,
  onClose,
  dailyMetrics,
  totalFleetDistanceKm,
}) => {
  if (!isOpen) return null;

  const metricList = Object.values(dailyMetrics);
  const totalVehicles = metricList.length;
  const maxSpeedOverall = metricList.reduce((max, m) => Math.max(max, m.max_speed_kmh), 0);
  const totalMinutes = metricList.reduce((sum, m) => sum + m.active_minutes, 0);

  const formatHours = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 text-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <Route className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white">Daily Fleet Analytics</h2>
              <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Today ({new Date().toLocaleDateString()})</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-3 gap-3 p-6 border-b border-slate-800/80 bg-slate-900/50">
          <div className="bg-slate-800/50 border border-slate-800 p-3.5 rounded-2xl">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Total Distance</div>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
              {totalFleetDistanceKm.toFixed(1)} <span className="text-xs font-normal text-slate-400">km</span>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-800 p-3.5 rounded-2xl">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Max Speed</div>
            <div className="text-xl font-bold font-mono text-sky-400 mt-1">
              {maxSpeedOverall.toFixed(1)} <span className="text-xs font-normal text-slate-400">km/h</span>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-800 p-3.5 rounded-2xl">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Tracked Units</div>
            <div className="text-xl font-bold font-mono text-amber-400 mt-1">
              {totalVehicles} <span className="text-xs font-normal text-slate-400">shuttles</span>
            </div>
          </div>
        </div>

        {/* Vehicles Breakdown Table */}
        <div className="p-6 overflow-y-auto flex-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Vehicle Mileage Breakdown</h3>
          {metricList.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              No mileage recorded for today yet. Telemetry will calculate distance as vehicles travel.
            </div>
          ) : (
            <div className="space-y-2">
              {metricList.map((m) => (
                <div
                  key={m.vehicle_id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/40 border border-slate-800/80"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-slate-800 text-emerald-400 rounded-lg">
                      <Bus className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white font-mono">{m.vehicle_id}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-0.5">
                          <Gauge className="w-3 h-3 text-sky-400" />
                          Max: {m.max_speed_kmh.toFixed(1)} km/h
                        </span>
                        {m.active_minutes > 0 && (
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-3 h-3 text-amber-400" />
                            {formatHours(m.active_minutes)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-bold font-mono text-emerald-400">
                      {m.total_distance_km.toFixed(2)} km
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Update `FleetPanel.tsx` to display daily distance and analytics button**

In `frontend/src/components/FleetPanel.tsx`:
Add `dailyMetrics?: DailyMetricsMap;` and `onOpenAnalytics?: () => void;` to `FleetPanelProps`.
Under each vehicle card, render `distanceKm`:
```tsx
const distanceKm = dailyMetrics?.[vehicle.vehicle_id]?.total_distance_km ?? 0;
// Render:
<div className="text-[10px] font-mono text-emerald-600 font-semibold mt-0.5">
  📍 {distanceKm.toFixed(1)} km
</div>
```
Add an "Analytics / สรุปวันนี้" button in the panel header.

- [ ] **Step 5: Update `App.tsx`**

Integrate `useDailyMetrics(vehicles)` and render `DailyMetricsModal` with state `[isAnalyticsOpen, setIsAnalyticsOpen]`. Pass `dailyMetrics` to `FleetPanel`.

- [ ] **Step 6: Run tests and verify they pass**

Run: `cd frontend; npx vitest run`  
Expected: All test suites pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/DailyMetricsModal.tsx frontend/src/components/__tests__/DailyMetricsModal.test.tsx frontend/src/components/FleetPanel.tsx frontend/src/App.tsx frontend/src/components/__tests__/FleetPanel.test.tsx
git commit -m "feat: display daily distance in FleetPanel and add DailyMetricsModal"
```

---

### Task 5: Background MQTT Ingestion Worker (`tools/worker.js`)

**Files:**
- Create: `tools/worker.js`
- Modify: `tools/package.json`
- Modify: `tools/README.md`

**Interfaces:**
- Connects to MQTT broker and Supabase (via `@supabase/supabase-js` and `dotenv`).
- Batches updates to `daily_vehicle_metrics` and inserts downsampled breadcrumbs to `telemetry_logs`.

- [ ] **Step 1: Install dependencies in `tools`**

Run: `cd tools; npm install @supabase/supabase-js dotenv`

- [ ] **Step 2: Implement `tools/worker.js`**

Create `tools/worker.js`:

```javascript
import mqtt from 'mqtt';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const BROKER = process.env.MQTT_BROKER || 'mqtt://broker.emqx.io:1883';
const TOPIC = process.env.MQTT_TOPIC || 'shuttle/fleet/v1/+/telemetry';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[Worker Error] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be provided in tools/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log(`[Worker] Connecting to MQTT broker: ${BROKER}...`);
const client = mqtt.connect(BROKER, {
  clientId: `shuttle_ingest_worker_${Math.random().toString(16).slice(2, 8)}`,
});

// Haversine formula
function haversineDistance(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// In-memory state tracking per vehicle
const vehicleState = new Map();

client.on('connect', () => {
  console.log(`[Worker] Connected to MQTT broker! Subscribing to: ${TOPIC}`);
  client.subscribe(TOPIC, (err) => {
    if (err) console.error('[Worker] Subscribe error:', err);
    else console.log('[Worker] Ingestion pipeline is active and listening for telemetry.');
  });
});

client.on('message', async (_topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    const { vehicle_id, lat, lng, speed, heading, timestamp } = data;

    if (!vehicle_id || typeof lat !== 'number' || typeof lng !== 'number') return;

    const now = Date.now();
    const today = new Date().toISOString().split('T')[0];

    let state = vehicleState.get(vehicle_id);
    if (!state) {
      state = {
        lastLat: lat,
        lastLng: lng,
        lastSpeed: speed,
        lastTime: timestamp || now,
        pendingDistanceKm: 0,
        maxSpeedKmh: speed || 0,
        lastFlushTime: now,
      };
      vehicleState.set(vehicle_id, state);
    } else {
      const dist = haversineDistance(state.lastLat, state.lastLng, lat, lng);

      // Filter jitter (< 8m when speed < 1.5 km/h) & teleport (> 150 km/h)
      const elapsedHours = Math.abs((timestamp || now) - state.lastTime) / 3600000;
      const impliedSpeed = elapsedHours > 0 ? dist / elapsedHours : 0;

      if (!(dist < 0.008 && speed < 1.5) && impliedSpeed <= 150) {
        state.pendingDistanceKm += dist;
      }

      state.lastLat = lat;
      state.lastLng = lng;
      state.lastSpeed = speed;
      state.lastTime = timestamp || now;
      state.maxSpeedKmh = Math.max(state.maxSpeedKmh, speed || 0);
    }

    // Flush batch to Supabase every 5 seconds
    if (now - state.lastFlushTime >= 5000 && state.pendingDistanceKm > 0) {
      const distanceToFlush = state.pendingDistanceKm;
      state.pendingDistanceKm = 0;
      state.lastFlushTime = now;

      // Upsert daily metrics
      const { data: existing } = await supabase
        .from('daily_vehicle_metrics')
        .select('total_distance_km, max_speed_kmh')
        .eq('vehicle_id', vehicle_id)
        .eq('date', today)
        .maybeSingle();

      const newTotalDistance = Math.round(((existing?.total_distance_km || 0) + distanceToFlush) * 100) / 100;
      const newMaxSpeed = Math.max(existing?.max_speed_kmh || 0, state.maxSpeedKmh);

      await supabase.from('daily_vehicle_metrics').upsert({
        vehicle_id,
        date: today,
        total_distance_km: newTotalDistance,
        max_speed_kmh: newMaxSpeed,
        last_updated_at: new Date().toISOString(),
      });

      console.log(`[Worker] Updated ${vehicle_id}: +${distanceToFlush.toFixed(3)} km (Total: ${newTotalDistance} km)`);
    }
  } catch (err) {
    console.error('[Worker] Message processing error:', err.message);
  }
});
```

- [ ] **Step 3: Add `worker` script to `tools/package.json`**

In `tools/package.json`, add:
```json
"scripts": {
  "simulate": "node simulate.js",
  "worker": "node worker.js"
}
```

- [ ] **Step 4: Check syntax and commit**

Run: `node --check tools/worker.js`  
Expected: Clean exit code 0.

```bash
git add tools/package.json tools/worker.js
git commit -m "feat(tools): add background MQTT ingestion worker for Supabase persistence"
```

---

### Task 6: Full Verification and Build Validation

- [ ] **Step 1: Run complete test suite**

Run: `cd frontend; npm test -- --run`  
Expected: All test suites pass.

- [ ] **Step 2: Run type check and production build**

Run: `cd frontend; npm run build`  
Expected: Clean build without errors.

- [ ] **Step 3: Commit and push**

```bash
git add -A
git commit -m "chore: complete daily distance tracking implementation and verification"
```
