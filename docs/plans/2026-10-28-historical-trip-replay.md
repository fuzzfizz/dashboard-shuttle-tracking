# Historical Trip Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-width historical trip replay feature with top header tab navigation ("วันนี้" vs "ประวัติย้อนหลัง"), top selection toolbar (date & vehicle), interactive Leaflet polyline map, and floating frosted-glass timeline playback controller with speed multipliers and instantaneous telemetry HUD.

**Architecture:** A tab controller in `App.tsx` switches between the live dashboard and the `HistoricalTripReplay` container. Telemetry points for the selected vehicle and date (Bangkok timezone UTC+7) are queried from Supabase `telemetry_logs` and cached in `useHistoricalTrip`. An animation loop in `useTripPlayback` drives the scrubber, calculates traversed polylines, and updates vehicle position and heading on `ReplayMap`, controlled by `ReplayPlayerBar`.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Leaflet, `react-leaflet`, Lucide React icons, Supabase JS Client, Vitest, `@testing-library/react`.

## Global Constraints

- **Tab Names:** Header tab 1 must be named `"วันนี้"`; header tab 2 must be named `"ประวัติย้อนหลัง"`.
- **No Trip Rounds:** Telemetry for a selected date is a continuous single timeline ("ไม่เอารอบการวิ่งแล้ว"); do not implement trip segmentation.
- **Map Isolation:** Map tiles remain unaltered in both Light and Dark modes (no CSS filter invert or color alterations on `.leaflet-container`).
- **Timezone Standard:** All date and time calculations must align with `Asia/Bangkok` (UTC+7).
- **Test Integrity:** All existing 125 tests must continue to pass without regressions; production build (`npm run build`) must succeed with zero errors.

---

### Task 1: Historical Types & Bangkok Date Time Utilities

**Files:**
- Create: `frontend/src/types/historical.ts`
- Create: `frontend/src/services/historicalDateUtils.ts`
- Test: `frontend/src/services/__tests__/historicalDateUtils.test.ts`

**Interfaces:**
- Consumes: Standard JS `Date` and `Intl.DateTimeFormat`.
- Produces:
  - Types: `HistoricalPoint`, `HistoricalTripSummary`, `SpeedMultiplier`.
  - Functions: `getBangkokStartOfDayUtc(dateStr: string): string`, `getBangkokEndOfDayUtc(dateStr: string): string`, `formatTimeHHmmss(isoStr: string): string`, `formatDateDisplay(dateStr: string): string`.

- [ ] **Step 1: Write the failing test for date and time utilities**

Create `frontend/src/services/__tests__/historicalDateUtils.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  getBangkokStartOfDayUtc,
  getBangkokEndOfDayUtc,
  formatTimeHHmmss,
  formatDateDisplay,
} from '../historicalDateUtils';

describe('historicalDateUtils', () => {
  it('converts Bangkok date string to UTC start of day ISO string', () => {
    // 2026-10-28 00:00:00 +07:00 is 2026-10-27 17:00:00 UTC
    const startUtc = getBangkokStartOfDayUtc('2026-10-28');
    expect(startUtc).toBe('2026-10-27T17:00:00.000Z');
  });

  it('converts Bangkok date string to UTC end of day ISO string', () => {
    // 2026-10-28 23:59:59.999 +07:00 is 2026-10-28 16:59:59.999 UTC
    const endUtc = getBangkokEndOfDayUtc('2026-10-28');
    expect(endUtc).toBe('2026-10-28T16:59:59.999Z');
  });

  it('formats UTC ISO timestamp into Bangkok HH:mm:ss', () => {
    // 2026-10-28T03:15:45.000Z -> 10:15:45 in Bangkok (+7)
    const formatted = formatTimeHHmmss('2026-10-28T03:15:45.000Z');
    expect(formatted).toBe('10:15:45');
  });

  it('formats invalid ISO timestamp as fallback dashes', () => {
    expect(formatTimeHHmmss('')).toBe('--:--:--');
    expect(formatTimeHHmmss('invalid')).toBe('--:--:--');
  });

  it('formats date string for readable display', () => {
    expect(formatDateDisplay('2026-10-28')).toBe('28/10/2026');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npm test -- src/services/__tests__/historicalDateUtils.test.ts --run`
Expected: FAIL with "Cannot find module '../historicalDateUtils'".

- [ ] **Step 3: Implement historical types and date utilities**

Create `frontend/src/types/historical.ts`:
```typescript
export interface HistoricalPoint {
  id?: string;
  vehicle_id: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  recorded_at: string;
}

export interface HistoricalTripSummary {
  vehicle_id: string;
  date: string;
  total_distance_km: number;
  max_speed_kmh: number;
  avg_speed_kmh: number;
  total_points: number;
  start_time: string | null;
  end_time: string | null;
}

export type SpeedMultiplier = 1 | 2 | 5 | 10 | 30;
```

Create `frontend/src/services/historicalDateUtils.ts`:
```typescript
export function getBangkokStartOfDayUtc(dateStr: string): string {
  // Input: 'YYYY-MM-DD'
  // Bangkok is UTC+7 -> local 00:00:00+07:00 = previous day 17:00:00 UTC
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  // Subtract 7 hours to get UTC equivalent of 00:00:00 UTC+7
  date.setUTCHours(date.getUTCHours() - 7);
  return date.toISOString();
}

export function getBangkokEndOfDayUtc(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  // Subtract 7 hours
  date.setUTCHours(date.getUTCHours() - 7);
  return date.toISOString();
}

export function formatTimeHHmmss(isoStr: string): string {
  if (!isoStr) return '--:--:--';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '--:--:--';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
}

export function formatDateDisplay(dateStr: string): string {
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend; npm test -- src/services/__tests__/historicalDateUtils.test.ts --run`
Expected: PASS (5/5 tests passing).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/historical.ts frontend/src/services/historicalDateUtils.ts frontend/src/services/__tests__/historicalDateUtils.test.ts
git commit -m "feat(history): add historical types and bangkok date utilities"
```

---

### Task 2: Supabase Historical Telemetry Service & `useHistoricalTrip` Hook

**Files:**
- Create: `frontend/src/services/historicalTelemetryService.ts`
- Create: `frontend/src/hooks/useHistoricalTrip.ts`
- Test: `frontend/src/hooks/__tests__/useHistoricalTrip.test.ts`

**Interfaces:**
- Consumes: `getSupabaseClient`, `haversineDistance`, `getBangkokStartOfDayUtc`, `getBangkokEndOfDayUtc`.
- Produces:
  - `fetchHistoricalTripData(vehicleId: string, dateStr: string): Promise<{ points: HistoricalPoint[]; summary: HistoricalTripSummary }>`
  - Hook `useHistoricalTrip(vehicleId: string, dateStr: string)`:
    - `{ points, summary, isLoading, error, refetch }`

- [ ] **Step 1: Write the failing test for `useHistoricalTrip`**

Create `frontend/src/hooks/__tests__/useHistoricalTrip.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useHistoricalTrip } from '../useHistoricalTrip';
import * as supabaseClientModule from '../../services/supabaseClient';

describe('useHistoricalTrip', () => {
  const mockTelemetryData = [
    {
      id: '1',
      vehicle_id: 'shuttle-01',
      lat: 13.736717,
      lng: 100.523186,
      speed: 25.0,
      heading: 90,
      recorded_at: '2026-10-28T02:00:00.000Z',
    },
    {
      id: '2',
      vehicle_id: 'shuttle-01',
      lat: 13.738000,
      lng: 100.525000,
      speed: 30.0,
      heading: 95,
      recorded_at: '2026-10-28T02:01:00.000Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches telemetry points and calculates summary successfully', async () => {
    const mockSelectLogs = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          lte: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockTelemetryData, error: null }),
          }),
        }),
      }),
    });

    const mockSelectMetrics = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              total_distance_km: 1.5,
              max_speed_kmh: 30.0,
              avg_speed_kmh: 27.5,
            },
            error: null,
          }),
        }),
      }),
    });

    const mockFrom = vi.fn((table: string) => {
      if (table === 'telemetry_logs') {
        return { select: mockSelectLogs };
      }
      return { select: mockSelectMetrics };
    });

    vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue({
      from: mockFrom,
    } as any);

    const { result } = renderHook(() => useHistoricalTrip('shuttle-01', '2026-10-28'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.points).toHaveLength(2);
    expect(result.current.summary.total_distance_km).toBe(1.5);
    expect(result.current.summary.total_points).toBe(2);
  });

  it('handles empty data response gracefully', async () => {
    const mockSelectLogs = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          lte: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    });

    const mockSelectMetrics = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });

    vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'telemetry_logs') return { select: mockSelectLogs };
        return { select: mockSelectMetrics };
      }),
    } as any);

    const { result } = renderHook(() => useHistoricalTrip('shuttle-01', '2026-10-28'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.points).toEqual([]);
    expect(result.current.summary.total_points).toBe(0);
    expect(result.current.summary.total_distance_km).toBe(0);
    expect(result.current.error).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npm test -- src/hooks/__tests__/useHistoricalTrip.test.ts --run`
Expected: FAIL with "Cannot find module '../useHistoricalTrip'".

- [ ] **Step 3: Implement `historicalTelemetryService` and `useHistoricalTrip`**

Create `frontend/src/services/historicalTelemetryService.ts`:
```typescript
import { getSupabaseClient } from './supabaseClient';
import { haversineDistance } from './distanceCalculator';
import { getBangkokStartOfDayUtc, getBangkokEndOfDayUtc } from './historicalDateUtils';
import { HistoricalPoint, HistoricalTripSummary } from '../types/historical';

export async function fetchHistoricalTripData(
  vehicleId: string,
  dateStr: string
): Promise<{ points: HistoricalPoint[]; summary: HistoricalTripSummary }> {
  const supabase = getSupabaseClient();

  const emptySummary: HistoricalTripSummary = {
    vehicle_id: vehicleId,
    date: dateStr,
    total_distance_km: 0,
    max_speed_kmh: 0,
    avg_speed_kmh: 0,
    total_points: 0,
    start_time: null,
    end_time: null,
  };

  if (!supabase || !vehicleId || !dateStr) {
    return { points: [], summary: emptySummary };
  }

  const startUtc = getBangkokStartOfDayUtc(dateStr);
  const endUtc = getBangkokEndOfDayUtc(dateStr);

  // 1. Fetch telemetry points
  const { data: logsData, error: logsError } = await supabase
    .from('telemetry_logs')
    .select('id, vehicle_id, lat, lng, speed, heading, recorded_at')
    .eq('vehicle_id', vehicleId)
    .gte('recorded_at', startUtc)
    .lte('recorded_at', endUtc)
    .order('recorded_at', { ascending: true });

  if (logsError) {
    throw new Error(logsError.message || 'Failed to fetch telemetry logs');
  }

  const points: HistoricalPoint[] = (logsData || []).map((row: any) => ({
    id: row.id,
    vehicle_id: row.vehicle_id,
    lat: Number(row.lat),
    lng: Number(row.lng),
    speed: Number(row.speed) || 0,
    heading: Number(row.heading) || 0,
    recorded_at: row.recorded_at,
  }));

  if (points.length === 0) {
    return { points: [], summary: emptySummary };
  }

  // 2. Fetch daily metrics (if available)
  const { data: metricsData } = await supabase
    .from('daily_vehicle_metrics')
    .select('total_distance_km, max_speed_kmh, avg_speed_kmh')
    .eq('vehicle_id', vehicleId)
    .eq('date', dateStr)
    .maybeSingle();

  let totalDistanceKm = Number(metricsData?.total_distance_km) || 0;
  let maxSpeedKmh = Number(metricsData?.max_speed_kmh) || 0;
  let avgSpeedKmh = Number(metricsData?.avg_speed_kmh) || 0;

  // Fallback distance calculation if daily_vehicle_metrics has no record or 0
  if (totalDistanceKm === 0 && points.length > 1) {
    let calcDist = 0;
    let maxSpd = 0;
    let speedSum = 0;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      calcDist += haversineDistance(prev.lat, prev.lng, curr.lat, curr.lng);
      if (curr.speed > maxSpd) maxSpd = curr.speed;
      speedSum += curr.speed;
    }
    totalDistanceKm = Math.round(calcDist * 100) / 100;
    maxSpeedKmh = maxSpd;
    avgSpeedKmh = Math.round((speedSum / points.length) * 10) / 10;
  }

  const summary: HistoricalTripSummary = {
    vehicle_id: vehicleId,
    date: dateStr,
    total_distance_km: totalDistanceKm,
    max_speed_kmh: maxSpeedKmh,
    avg_speed_kmh: avgSpeedKmh,
    total_points: points.length,
    start_time: points[0].recorded_at,
    end_time: points[points.length - 1].recorded_at,
  };

  return { points, summary };
}
```

Create `frontend/src/hooks/useHistoricalTrip.ts`:
```typescript
import { useState, useEffect, useCallback } from 'react';
import { HistoricalPoint, HistoricalTripSummary } from '../types/historical';
import { fetchHistoricalTripData } from '../services/historicalTelemetryService';

export function useHistoricalTrip(vehicleId: string, dateStr: string) {
  const [points, setPoints] = useState<HistoricalPoint[]>([]);
  const [summary, setSummary] = useState<HistoricalTripSummary>({
    vehicle_id: vehicleId,
    date: dateStr,
    total_distance_km: 0,
    max_speed_kmh: 0,
    avg_speed_kmh: 0,
    total_points: 0,
    start_time: null,
    end_time: null,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!vehicleId || !dateStr) {
      setPoints([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchHistoricalTripData(vehicleId, dateStr);
      setPoints(res.points);
      setSummary(res.summary);
    } catch (err: any) {
      setError(err?.message || 'Failed to load historical data');
      setPoints([]);
    } finally {
      setIsLoading(false);
    }
  }, [vehicleId, dateStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    points,
    summary,
    isLoading,
    error,
    refetch: loadData,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend; npm test -- src/hooks/__tests__/useHistoricalTrip.test.ts --run`
Expected: PASS (2/2 tests passing).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/historicalTelemetryService.ts frontend/src/hooks/useHistoricalTrip.ts frontend/src/hooks/__tests__/useHistoricalTrip.test.ts
git commit -m "feat(history): implement historical telemetry service and useHistoricalTrip hook"
```

---

### Task 3: Interactive Playback State Hook (`useTripPlayback`)

**Files:**
- Create: `frontend/src/hooks/useTripPlayback.ts`
- Test: `frontend/src/hooks/__tests__/useTripPlayback.test.ts`

**Interfaces:**
- Consumes: `HistoricalPoint[]`, `SpeedMultiplier`.
- Produces:
  - Hook `useTripPlayback(points: HistoricalPoint[])`:
    - `currentIndex: number`
    - `currentPoint: HistoricalPoint | null`
    - `isPlaying: boolean`
    - `speedMultiplier: SpeedMultiplier`
    - `progressPercent: number`
    - `traversedPoints: HistoricalPoint[]`
    - `play: () => void`
    - `pause: () => void`
    - `togglePlay: () => void`
    - `seekToIndex: (idx: number) => void`
    - `reset: () => void`
    - `setSpeedMultiplier: (speed: SpeedMultiplier) => void`

- [ ] **Step 1: Write the failing test for `useTripPlayback`**

Create `frontend/src/hooks/__tests__/useTripPlayback.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTripPlayback } from '../useTripPlayback';
import { HistoricalPoint } from '../../types/historical';

describe('useTripPlayback', () => {
  const samplePoints: HistoricalPoint[] = [
    { vehicle_id: 'v1', lat: 13.73, lng: 100.52, speed: 20, heading: 90, recorded_at: '2026-10-28T08:00:00Z' },
    { vehicle_id: 'v1', lat: 13.74, lng: 100.53, speed: 25, heading: 95, recorded_at: '2026-10-28T08:00:10Z' },
    { vehicle_id: 'v1', lat: 13.75, lng: 100.54, speed: 30, heading: 100, recorded_at: '2026-10-28T08:00:20Z' },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes at index 0 and paused', () => {
    const { result } = renderHook(() => useTripPlayback(samplePoints));
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentPoint).toEqual(samplePoints[0]);
    expect(result.current.progressPercent).toBe(0);
  });

  it('allows seeking to valid index within bounds', () => {
    const { result } = renderHook(() => useTripPlayback(samplePoints));
    act(() => {
      result.current.seekToIndex(1);
    });
    expect(result.current.currentIndex).toBe(1);
    expect(result.current.currentPoint).toEqual(samplePoints[1]);
    expect(result.current.progressPercent).toBe(50);
  });

  it('clamps seeking index outside bounds', () => {
    const { result } = renderHook(() => useTripPlayback(samplePoints));
    act(() => {
      result.current.seekToIndex(99);
    });
    expect(result.current.currentIndex).toBe(2);
    expect(result.current.progressPercent).toBe(100);

    act(() => {
      result.current.seekToIndex(-5);
    });
    expect(result.current.currentIndex).toBe(0);
  });

  it('toggles play and pauses at end of route', () => {
    const { result } = renderHook(() => useTripPlayback(samplePoints));

    act(() => {
      result.current.play();
    });
    expect(result.current.isPlaying).toBe(true);

    // Fast-forward ticker timer
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Seek to last point
    act(() => {
      result.current.seekToIndex(2);
    });
    expect(result.current.currentIndex).toBe(2);

    // When playing at end, next tick should pause
    act(() => {
      result.current.play();
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.isPlaying).toBe(false);
  });

  it('resets playback to start', () => {
    const { result } = renderHook(() => useTripPlayback(samplePoints));
    act(() => {
      result.current.seekToIndex(2);
      result.current.reset();
    });
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.isPlaying).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npm test -- src/hooks/__tests__/useTripPlayback.test.ts --run`
Expected: FAIL with "Cannot find module '../useTripPlayback'".

- [ ] **Step 3: Implement `useTripPlayback`**

Create `frontend/src/hooks/useTripPlayback.ts`:
```typescript
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { HistoricalPoint, SpeedMultiplier } from '../types/historical';

export function useTripPlayback(points: HistoricalPoint[]) {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<SpeedMultiplier>(1);

  const totalPoints = points.length;

  // Reset index when points dataset changes
  useEffect(() => {
    setCurrentIndex(0);
    setIsPlaying(false);
  }, [points]);

  const currentPoint = useMemo(() => {
    if (totalPoints === 0) return null;
    return points[Math.min(currentIndex, totalPoints - 1)];
  }, [points, currentIndex, totalPoints]);

  const traversedPoints = useMemo(() => {
    if (totalPoints === 0) return [];
    return points.slice(0, Math.min(currentIndex + 1, totalPoints));
  }, [points, currentIndex, totalPoints]);

  const progressPercent = useMemo(() => {
    if (totalPoints <= 1) return 0;
    return Math.round((currentIndex / (totalPoints - 1)) * 100);
  }, [currentIndex, totalPoints]);

  const play = useCallback(() => {
    if (totalPoints <= 1) return;
    // If at end, loop back to start on play
    if (currentIndex >= totalPoints - 1) {
      setCurrentIndex(0);
    }
    setIsPlaying(true);
  }, [totalPoints, currentIndex]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const seekToIndex = useCallback(
    (index: number) => {
      if (totalPoints === 0) return;
      const clamped = Math.max(0, Math.min(index, totalPoints - 1));
      setCurrentIndex(clamped);
    },
    [totalPoints]
  );

  const reset = useCallback(() => {
    setIsPlaying(false);
    setCurrentIndex(0);
  }, []);

  // Interval-based ticker calculation adapted to real timestamp deltas & speed multiplier
  useEffect(() => {
    if (!isPlaying || totalPoints <= 1) return;

    if (currentIndex >= totalPoints - 1) {
      setIsPlaying(false);
      return;
    }

    // Determine interval step between current point and next point
    const currTime = new Date(points[currentIndex].recorded_at).getTime();
    const nextTime = new Date(points[currentIndex + 1].recorded_at).getTime();
    const realDeltaMs = Math.max(500, Math.min(nextTime - currTime, 30000)); // Cap delta between 0.5s and 30s
    const scaledIntervalMs = Math.max(50, Math.round(realDeltaMs / speedMultiplier));

    const timer = setTimeout(() => {
      setCurrentIndex((prev) => {
        const next = prev + 1;
        if (next >= totalPoints - 1) {
          setIsPlaying(false);
          return totalPoints - 1;
        }
        return next;
      });
    }, scaledIntervalMs);

    return () => clearTimeout(timer);
  }, [isPlaying, currentIndex, totalPoints, points, speedMultiplier]);

  return {
    currentIndex,
    currentPoint,
    isPlaying,
    speedMultiplier,
    progressPercent,
    traversedPoints,
    play,
    pause,
    togglePlay,
    seekToIndex,
    reset,
    setSpeedMultiplier,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend; npm test -- src/hooks/__tests__/useTripPlayback.test.ts --run`
Expected: PASS (5/5 tests passing).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useTripPlayback.ts frontend/src/hooks/__tests__/useTripPlayback.test.ts
git commit -m "feat(history): implement useTripPlayback simulation hook"
```

---

### Task 4: Replay Top Toolbar Component (`ReplayToolbar`)

**Files:**
- Create: `frontend/src/components/ReplayToolbar.tsx`
- Test: `frontend/src/components/__tests__/ReplayToolbar.test.tsx`

**Interfaces:**
- Consumes:
  - `selectedDate: string`
  - `onDateChange: (date: string) => void`
  - `selectedVehicleId: string`
  - `onVehicleChange: (id: string) => void`
  - `vehicleList: Array<{ id: string; name: string }>`
  - `summary: HistoricalTripSummary`
  - `isLoading: boolean`
  - `onRefresh: () => void`
- Produces: `ReplayToolbar` React component with responsive date picker, vehicle select dropdown, summary badge, and refresh button.

- [ ] **Step 1: Write the failing test for `ReplayToolbar`**

Create `frontend/src/components/__tests__/ReplayToolbar.test.tsx`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReplayToolbar } from '../ReplayToolbar';

describe('ReplayToolbar', () => {
  const vehicles = [
    { id: 'shuttle-01', name: 'Shuttle 1' },
    { id: 'shuttle-02', name: 'Shuttle 2' },
  ];

  const defaultSummary = {
    vehicle_id: 'shuttle-01',
    date: '2026-10-28',
    total_distance_km: 24.8,
    max_speed_kmh: 45.2,
    avg_speed_kmh: 22.1,
    total_points: 1420,
    start_time: '2026-10-28T01:00:00Z',
    end_time: '2026-10-28T10:00:00Z',
  };

  it('renders date picker, vehicle selector, and summary stats', () => {
    render(
      <ReplayToolbar
        selectedDate="2026-10-28"
        onDateChange={vi.fn()}
        selectedVehicleId="shuttle-01"
        onVehicleChange={vi.fn()}
        vehicleList={vehicles}
        summary={defaultSummary}
        isLoading={false}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue('2026-10-28')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Shuttle 1')).toBeInTheDocument();
    expect(screen.getByText(/24.8/)).toBeInTheDocument();
    expect(screen.getByText(/1,420 จุด/)).toBeInTheDocument();
  });

  it('triggers onDateChange when date is modified', () => {
    const onDateChange = vi.fn();
    render(
      <ReplayToolbar
        selectedDate="2026-10-28"
        onDateChange={onDateChange}
        selectedVehicleId="shuttle-01"
        onVehicleChange={vi.fn()}
        vehicleList={vehicles}
        summary={defaultSummary}
        isLoading={false}
        onRefresh={vi.fn()}
      />
    );

    fireEvent.change(screen.getByDisplayValue('2026-10-28'), {
      target: { value: '2026-10-27' },
    });
    expect(onDateChange).toHaveBeenCalledWith('2026-10-27');
  });

  it('triggers onVehicleChange when vehicle selection changes', () => {
    const onVehicleChange = vi.fn();
    render(
      <ReplayToolbar
        selectedDate="2026-10-28"
        onDateChange={vi.fn()}
        selectedVehicleId="shuttle-01"
        onVehicleChange={onVehicleChange}
        vehicleList={vehicles}
        summary={defaultSummary}
        isLoading={false}
        onRefresh={vi.fn()}
      />
    );

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'shuttle-02' },
    });
    expect(onVehicleChange).toHaveBeenCalledWith('shuttle-02');
  });

  it('triggers onRefresh on refresh button click', () => {
    const onRefresh = vi.fn();
    render(
      <ReplayToolbar
        selectedDate="2026-10-28"
        onDateChange={vi.fn()}
        selectedVehicleId="shuttle-01"
        onVehicleChange={vi.fn()}
        vehicleList={vehicles}
        summary={defaultSummary}
        isLoading={false}
        onRefresh={onRefresh}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /รีเฟรช/i }));
    expect(onRefresh).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npm test -- src/components/__tests__/ReplayToolbar.test.tsx --run`
Expected: FAIL with "Cannot find module '../ReplayToolbar'".

- [ ] **Step 3: Implement `ReplayToolbar`**

Create `frontend/src/components/ReplayToolbar.tsx`:
```typescript
import React from 'react';
import { Calendar, Bus, RefreshCw, Route, MapPin } from 'lucide-react';
import { HistoricalTripSummary } from '../types/historical';
import { getBangkokDate } from '../hooks/useDailyMetrics';

interface ReplayToolbarProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  selectedVehicleId: string;
  onVehicleChange: (id: string) => void;
  vehicleList: Array<{ id: string; name: string }>;
  summary: HistoricalTripSummary;
  isLoading: boolean;
  onRefresh: () => void;
}

export const ReplayToolbar: React.FC<ReplayToolbarProps> = ({
  selectedDate,
  onDateChange,
  selectedVehicleId,
  onVehicleChange,
  vehicleList,
  summary,
  isLoading,
  onRefresh,
}) => {
  const maxDate = getBangkokDate();

  return (
    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 z-10 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: Selectors (Date & Vehicle) */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Picker */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-1.5 shadow-sm">
            <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              max={maxDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="bg-transparent text-sm font-medium text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
              aria-label="Select Date"
            />
          </div>

          {/* Vehicle Dropdown */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-1.5 shadow-sm">
            <Bus className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <select
              value={selectedVehicleId}
              onChange={(e) => onVehicleChange(e.target.value)}
              className="bg-transparent text-sm font-medium text-slate-800 dark:text-slate-100 outline-none cursor-pointer pr-2"
              aria-label="Select Vehicle"
            >
              {vehicleList.map((v) => (
                <option
                  key={v.id}
                  value={v.id}
                  className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                >
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Summary Badge & Refresh Button */}
        <div className="flex items-center gap-3">
          {/* Day Metrics Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
            <Route className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              ระยะทาง: <strong className="font-semibold">{summary.total_distance_km.toFixed(1)} กม.</strong>
            </span>
            <span className="text-emerald-300 dark:text-emerald-700">|</span>
            <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{summary.total_points.toLocaleString()} จุด</span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            aria-label="รีเฟรชข้อมูล"
            title="รีเฟรชข้อมูล"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-medium transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-500' : ''}`} />
            <span className="hidden sm:inline">รีเฟรช</span>
          </button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend; npm test -- src/components/__tests__/ReplayToolbar.test.tsx --run`
Expected: PASS (4/4 tests passing).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ReplayToolbar.tsx frontend/src/components/__tests__/ReplayToolbar.test.tsx
git commit -m "feat(history): implement ReplayToolbar component"
```

---

### Task 5: Floating Replay Player Bar Component (`ReplayPlayerBar`)

**Files:**
- Create: `frontend/src/components/ReplayPlayerBar.tsx`
- Test: `frontend/src/components/__tests__/ReplayPlayerBar.test.tsx`

**Interfaces:**
- Consumes:
  - `currentIndex: number`
  - `totalPoints: number`
  - `isPlaying: boolean`
  - `speedMultiplier: SpeedMultiplier`
  - `currentPoint: HistoricalPoint | null`
  - `startTimeStr: string | null`
  - `endTimeStr: string | null`
  - `totalDistanceKm: number`
  - `distanceCoveredKm: number`
  - `onTogglePlay: () => void`
  - `onReset: () => void`
  - `onSeek: (idx: number) => void`
  - `onSpeedChange: (speed: SpeedMultiplier) => void`
- Produces: Floating interactive bottom player controller with frosted glass backdrop.

- [ ] **Step 1: Write the failing test for `ReplayPlayerBar`**

Create `frontend/src/components/__tests__/ReplayPlayerBar.test.tsx`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReplayPlayerBar } from '../ReplayPlayerBar';
import { HistoricalPoint } from '../../types/historical';

describe('ReplayPlayerBar', () => {
  const currentPt: HistoricalPoint = {
    vehicle_id: 'shuttle-01',
    lat: 13.736,
    lng: 100.523,
    speed: 28.5,
    heading: 90,
    recorded_at: '2026-10-28T03:15:45.000Z',
  };

  it('renders playback controls and current telemetry HUD', () => {
    render(
      <ReplayPlayerBar
        currentIndex={50}
        totalPoints={100}
        isPlaying={false}
        speedMultiplier={1}
        currentPoint={currentPt}
        startTimeStr="2026-10-28T01:00:00.000Z"
        endTimeStr="2026-10-28T05:00:00.000Z"
        totalDistanceKm={20.0}
        distanceCoveredKm={10.0}
        onTogglePlay={vi.fn()}
        onReset={vi.fn()}
        onSeek={vi.fn()}
        onSpeedChange={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /เล่น/i })).toBeInTheDocument();
    expect(screen.getByText('28.5 กม./ชม.')).toBeInTheDocument();
    expect(screen.getByText('10:15:45')).toBeInTheDocument();
    expect(screen.getByText(/10.0 \/ 20.0 กม./)).toBeInTheDocument();
  });

  it('fires onTogglePlay on play button click', () => {
    const onTogglePlay = vi.fn();
    render(
      <ReplayPlayerBar
        currentIndex={50}
        totalPoints={100}
        isPlaying={false}
        speedMultiplier={1}
        currentPoint={currentPt}
        startTimeStr="2026-10-28T01:00:00.000Z"
        endTimeStr="2026-10-28T05:00:00.000Z"
        totalDistanceKm={20.0}
        distanceCoveredKm={10.0}
        onTogglePlay={onTogglePlay}
        onReset={vi.fn()}
        onSeek={vi.fn()}
        onSpeedChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /เล่น/i }));
    expect(onTogglePlay).toHaveBeenCalled();
  });

  it('fires onSpeedChange when speed pill is clicked', () => {
    const onSpeedChange = vi.fn();
    render(
      <ReplayPlayerBar
        currentIndex={50}
        totalPoints={100}
        isPlaying={false}
        speedMultiplier={1}
        currentPoint={currentPt}
        startTimeStr="2026-10-28T01:00:00.000Z"
        endTimeStr="2026-10-28T05:00:00.000Z"
        totalDistanceKm={20.0}
        distanceCoveredKm={10.0}
        onTogglePlay={vi.fn()}
        onReset={vi.fn()}
        onSeek={vi.fn()}
        onSpeedChange={onSpeedChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '5x' }));
    expect(onSpeedChange).toHaveBeenCalledWith(5);
  });

  it('fires onSeek when range slider is scrubbed', () => {
    const onSeek = vi.fn();
    render(
      <ReplayPlayerBar
        currentIndex={50}
        totalPoints={100}
        isPlaying={false}
        speedMultiplier={1}
        currentPoint={currentPt}
        startTimeStr="2026-10-28T01:00:00.000Z"
        endTimeStr="2026-10-28T05:00:00.000Z"
        totalDistanceKm={20.0}
        distanceCoveredKm={10.0}
        onTogglePlay={vi.fn()}
        onReset={vi.fn()}
        onSeek={onSeek}
        onSpeedChange={vi.fn()}
      />
    );

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '75' } });
    expect(onSeek).toHaveBeenCalledWith(75);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npm test -- src/components/__tests__/ReplayPlayerBar.test.tsx --run`
Expected: FAIL with "Cannot find module '../ReplayPlayerBar'".

- [ ] **Step 3: Implement `ReplayPlayerBar`**

Create `frontend/src/components/ReplayPlayerBar.tsx`:
```typescript
import React from 'react';
import { Play, Pause, RotateCcw, Gauge, Clock, Navigation } from 'lucide-react';
import { HistoricalPoint, SpeedMultiplier } from '../types/historical';
import { formatTimeHHmmss } from '../services/historicalDateUtils';

interface ReplayPlayerBarProps {
  currentIndex: number;
  totalPoints: number;
  isPlaying: boolean;
  speedMultiplier: SpeedMultiplier;
  currentPoint: HistoricalPoint | null;
  startTimeStr: string | null;
  endTimeStr: string | null;
  totalDistanceKm: number;
  distanceCoveredKm: number;
  onTogglePlay: () => void;
  onReset: () => void;
  onSeek: (index: number) => void;
  onSpeedChange: (speed: SpeedMultiplier) => void;
}

const SPEED_OPTIONS: SpeedMultiplier[] = [1, 2, 5, 10, 30];

export const ReplayPlayerBar: React.FC<ReplayPlayerBarProps> = ({
  currentIndex,
  totalPoints,
  isPlaying,
  speedMultiplier,
  currentPoint,
  startTimeStr,
  endTimeStr,
  totalDistanceKm,
  distanceCoveredKm,
  onTogglePlay,
  onReset,
  onSeek,
  onSpeedChange,
}) => {
  const hasPoints = totalPoints > 1;
  const currentTimeDisplay = currentPoint ? formatTimeHHmmss(currentPoint.recorded_at) : '--:--:--';
  const startTimeDisplay = startTimeStr ? formatTimeHHmmss(startTimeStr) : '--:--:--';
  const endTimeDisplay = endTimeStr ? formatTimeHHmmss(endTimeStr) : '--:--:--';
  const currentSpeed = currentPoint ? `${currentPoint.speed.toFixed(1)} กม./ชม.` : '0.0 กม./ชม.';

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-4xl z-[1000] transition-all">
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 flex flex-col gap-3">
        {/* Top Row: Controls, Scrubber Slider, Speeds */}
        <div className="flex items-center gap-3 w-full">
          {/* Reset button */}
          <button
            onClick={onReset}
            disabled={!hasPoints}
            aria-label="ย้อนกลับจุดเริ่มต้น"
            title="ย้อนกลับจุดเริ่มต้น"
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          {/* Play / Pause button */}
          <button
            onClick={onTogglePlay}
            disabled={!hasPoints}
            aria-label={isPlaying ? 'หยุดชั่วคราว' : 'เล่น'}
            title={isPlaying ? 'หยุดชั่วคราว' : 'เล่น'}
            className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-40 shrink-0"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>

          {/* Timeline Time & Slider */}
          <div className="flex-1 flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
              {startTimeDisplay}
            </span>
            <input
              type="range"
              min={0}
              max={Math.max(0, totalPoints - 1)}
              value={currentIndex}
              disabled={!hasPoints}
              onChange={(e) => onSeek(Number(e.target.value))}
              aria-label="Timeline Scrubber"
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-40"
            />
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
              {endTimeDisplay}
            </span>
          </div>

          {/* Speed Multipliers */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 shrink-0">
            {SPEED_OPTIONS.map((speed) => (
              <button
                key={speed}
                onClick={() => onSpeedChange(speed)}
                className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition-all ${
                  speedMultiplier === speed
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Row: Real-time Telemetry HUD Chips */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-2.5 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 font-medium">
              <Clock className="w-4 h-4 text-emerald-500" />
              <span>เวลา:</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                {currentTimeDisplay}
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-medium">
              <Gauge className="w-4 h-4 text-emerald-500" />
              <span>ความเร็ว:</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                {currentSpeed}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 font-medium">
            <Navigation className="w-4 h-4 text-emerald-500" />
            <span>ระยะทางสะสม:</span>
            <span className="font-mono font-semibold text-slate-900 dark:text-white">
              {distanceCoveredKm.toFixed(1)} / {totalDistanceKm.toFixed(1)} กม.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend; npm test -- src/components/__tests__/ReplayPlayerBar.test.tsx --run`
Expected: PASS (4/4 tests passing).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ReplayPlayerBar.tsx frontend/src/components/__tests__/ReplayPlayerBar.test.tsx
git commit -m "feat(history): implement ReplayPlayerBar floating controller"
```

---

### Task 6: Replay Map Viewport Component (`ReplayMap`)

**Files:**
- Create: `frontend/src/components/ReplayMap.tsx`
- Test: `frontend/src/components/__tests__/ReplayMap.test.tsx`

**Interfaces:**
- Consumes:
  - `points: HistoricalPoint[]`
  - `traversedPoints: HistoricalPoint[]`
  - `currentPoint: HistoricalPoint | null`
  - `isLoading: boolean`
  - `emptyMessage?: string`
- Produces: `ReplayMap` interactive Leaflet map component with neutral route, active traversed trajectory, start/end pins, vehicle marker, and empty state message.

- [ ] **Step 1: Write the failing test for `ReplayMap`**

Create `frontend/src/components/__tests__/ReplayMap.test.tsx`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReplayMap } from '../ReplayMap';
import { HistoricalPoint } from '../../types/historical';

// Mock Leaflet react components to isolate DOM rendering
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: any) => <div data-testid="leaflet-map-container">{children}</div>,
  TileLayer: () => <div data-testid="leaflet-tile-layer" />,
  Polyline: ({ positions, pathOptions }: any) => (
    <div data-testid="leaflet-polyline" data-color={pathOptions?.color} data-count={positions?.length} />
  ),
  Marker: ({ position, children }: any) => (
    <div data-testid="leaflet-marker" data-lat={position?.[0]} data-lng={position?.[1]}>
      {children}
    </div>
  ),
  Tooltip: ({ children }: any) => <div data-testid="leaflet-tooltip">{children}</div>,
  useMap: () => ({ fitBounds: vi.fn() }),
}));

describe('ReplayMap', () => {
  const points: HistoricalPoint[] = [
    { vehicle_id: 'v1', lat: 13.73, lng: 100.52, speed: 20, heading: 90, recorded_at: '2026-10-28T08:00:00Z' },
    { vehicle_id: 'v1', lat: 13.74, lng: 100.53, speed: 25, heading: 95, recorded_at: '2026-10-28T08:00:10Z' },
  ];

  it('renders polylines and vehicle marker when points exist', () => {
    render(
      <ReplayMap
        points={points}
        traversedPoints={[points[0]]}
        currentPoint={points[0]}
        isLoading={false}
      />
    );

    expect(screen.getByTestId('leaflet-map-container')).toBeInTheDocument();
    const polylines = screen.getAllByTestId('leaflet-polyline');
    expect(polylines.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId('leaflet-marker').length).toBeGreaterThanOrEqual(1);
  });

  it('renders loading overlay when isLoading is true', () => {
    render(
      <ReplayMap
        points={[]}
        traversedPoints={[]}
        currentPoint={null}
        isLoading={true}
      />
    );

    expect(screen.getByText(/กำลังโหลดข้อมูลเส้นทาง/i)).toBeInTheDocument();
  });

  it('renders empty state banner when no points and not loading', () => {
    render(
      <ReplayMap
        points={[]}
        traversedPoints={[]}
        currentPoint={null}
        isLoading={false}
        emptyMessage="ไม่พบข้อมูลการเดินรถในวันที่เลือก"
      />
    );

    expect(screen.getByText(/ไม่พบข้อมูลการเดินรถในวันที่เลือก/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npm test -- src/components/__tests__/ReplayMap.test.tsx --run`
Expected: FAIL with "Cannot find module '../ReplayMap'".

- [ ] **Step 3: Implement `ReplayMap`**

Create `frontend/src/components/ReplayMap.tsx`:
```typescript
import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { HistoricalPoint } from '../types/historical';
import { AlertCircle, Loader2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

interface ReplayMapProps {
  points: HistoricalPoint[];
  traversedPoints: HistoricalPoint[];
  currentPoint: HistoricalPoint | null;
  isLoading: boolean;
  emptyMessage?: string;
}

// Controller to auto-fit bounds when new points load
const AutoFitBounds: React.FC<{ points: HistoricalPoint[] }> = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    if (points.length >= 2) {
      const latLngs = points.map((p) => [p.lat, p.lng] as [number, number]);
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 17 });
    } else if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 16);
    }
  }, [points, map]);

  return null;
};

// Custom vehicle marker icon with rotation
function createVehicleIcon(heading: number) {
  return L.divIcon({
    className: 'custom-shuttle-marker',
    html: `
      <div style="transform: rotate(${heading}deg); transform-origin: center center;" class="w-8 h-8 flex items-center justify-center">
        <div class="w-7 h-7 bg-emerald-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-xs">
          ▲
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

const startIcon = L.divIcon({
  className: 'start-pin',
  html: `<div class="w-4 h-4 rounded-full bg-emerald-600 border-2 border-white shadow-md"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const endIcon = L.divIcon({
  className: 'end-pin',
  html: `<div class="w-4 h-4 rounded-full bg-rose-600 border-2 border-white shadow-md"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export const ReplayMap: React.FC<ReplayMapProps> = ({
  points,
  traversedPoints,
  currentPoint,
  isLoading,
  emptyMessage = 'ไม่พบประวัติการเดินรถในวันที่เลือก',
}) => {
  const fullPositions = useMemo(
    () => points.map((p) => [p.lat, p.lng] as [number, number]),
    [points]
  );

  const traversedPositions = useMemo(
    () => traversedPoints.map((p) => [p.lat, p.lng] as [number, number]),
    [traversedPoints]
  );

  const center: [number, number] = useMemo(() => {
    if (currentPoint) return [currentPoint.lat, currentPoint.lng];
    if (points.length > 0) return [points[0].lat, points[0].lng];
    return [13.736717, 100.523186]; // Default Bangkok
  }, [currentPoint, points]);

  return (
    <div className="relative w-full h-full flex-1 overflow-hidden bg-slate-100 dark:bg-slate-900">
      <MapContainer
        center={center}
        zoom={15}
        className="w-full h-full"
        attributionControl={false}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        <AutoFitBounds points={points} />

        {/* 1. Full Day Route (Background Neutral Polyline) */}
        {fullPositions.length >= 2 && (
          <Polyline
            positions={fullPositions}
            pathOptions={{
              color: '#94a3b8',
              weight: 4,
              opacity: 0.5,
              dashArray: '6, 8',
            }}
          />
        )}

        {/* 2. Traversed Route (Active Glowing Polyline) */}
        {traversedPositions.length >= 2 && (
          <Polyline
            positions={traversedPositions}
            pathOptions={{
              color: '#10b981',
              weight: 5,
              opacity: 0.95,
            }}
          />
        )}

        {/* 3. Start Point Pin */}
        {points.length > 0 && (
          <Marker position={[points[0].lat, points[0].lng]} icon={startIcon}>
            <Tooltip direction="top" offset={[0, -10]}>
              จุดเริ่มต้น
            </Tooltip>
          </Marker>
        )}

        {/* 4. End Point Pin */}
        {points.length > 1 && (
          <Marker
            position={[points[points.length - 1].lat, points[points.length - 1].lng]}
            icon={endIcon}
          >
            <Tooltip direction="top" offset={[0, -10]}>
              จุดสิ้นสุด
            </Tooltip>
          </Marker>
        )}

        {/* 5. Moving Vehicle Marker */}
        {currentPoint && (
          <Marker
            position={[currentPoint.lat, currentPoint.lng]}
            icon={createVehicleIcon(currentPoint.heading)}
            zIndexOffset={1000}
          >
            <Tooltip permanent={false} direction="top" offset={[0, -16]}>
              {currentPoint.vehicle_id} ({currentPoint.speed.toFixed(1)} กม./ชม.)
            </Tooltip>
          </Marker>
        )}
      </MapContainer>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm z-[1500] flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            กำลังโหลดข้อมูลเส้นทาง...
          </p>
        </div>
      )}

      {/* Empty State Banner */}
      {!isLoading && points.length === 0 && (
        <div className="absolute inset-0 z-[1400] flex items-center justify-center p-4 pointer-events-none">
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-6 max-w-md text-center pointer-events-auto flex flex-col items-center gap-3">
            <div className="p-3 bg-amber-500/10 text-amber-500 rounded-full">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {emptyMessage}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              กรุณาเลือกวันที่หรือรถคันอื่นจากแถบเครื่องมือด้านบน
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend; npm test -- src/components/__tests__/ReplayMap.test.tsx --run`
Expected: PASS (3/3 tests passing).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ReplayMap.tsx frontend/src/components/__tests__/ReplayMap.test.tsx
git commit -m "feat(history): implement ReplayMap component"
```

---

### Task 7: Full Container Assembly (`HistoricalTripReplay`) & Header Tab Integration (`App.tsx`)

**Files:**
- Create: `frontend/src/components/HistoricalTripReplay.tsx`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/__tests__/HistoricalTripReplay.test.tsx`
- Modify: `frontend/src/__tests__/App.test.tsx`

**Interfaces:**
- Consumes:
  - `HistoricalTripReplay`: handles data loading via `useHistoricalTrip` and playback via `useTripPlayback`.
  - `App.tsx`: introduces state `activeTab: 'today' | 'history'`.
- Produces: Complete end-to-end user navigation with tabs "วันนี้" and "ประวัติย้อนหลัง".

- [ ] **Step 1: Write the failing test for `HistoricalTripReplay` container and App tabs**

Create `frontend/src/__tests__/HistoricalTripReplay.test.tsx`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HistoricalTripReplay } from '../components/HistoricalTripReplay';
import * as tripHook from '../hooks/useHistoricalTrip';

// Mock child components to verify composition
vi.mock('../components/ReplayMap', () => ({
  ReplayMap: () => <div data-testid="replay-map" />,
}));

describe('HistoricalTripReplay', () => {
  it('renders toolbar, map, and player bar', () => {
    vi.spyOn(tripHook, 'useHistoricalTrip').mockReturnValue({
      points: [
        { vehicle_id: 'shuttle-01', lat: 13.73, lng: 100.52, speed: 20, heading: 90, recorded_at: '2026-10-28T08:00:00Z' },
      ],
      summary: {
        vehicle_id: 'shuttle-01',
        date: '2026-10-28',
        total_distance_km: 15.0,
        max_speed_kmh: 40,
        avg_speed_kmh: 20,
        total_points: 1,
        start_time: '2026-10-28T08:00:00Z',
        end_time: '2026-10-28T08:00:00Z',
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<HistoricalTripReplay initialVehicleId="shuttle-01" />);

    expect(screen.getByText(/ระยะทาง:/i)).toBeInTheDocument();
    expect(screen.getByTestId('replay-map')).toBeInTheDocument();
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npm test -- src/__tests__/HistoricalTripReplay.test.tsx --run`
Expected: FAIL with "Cannot find module '../components/HistoricalTripReplay'".

- [ ] **Step 3: Implement `HistoricalTripReplay`**

Create `frontend/src/components/HistoricalTripReplay.tsx`:
```typescript
import React, { useState, useMemo } from 'react';
import { ReplayToolbar } from './ReplayToolbar';
import { ReplayMap } from './ReplayMap';
import { ReplayPlayerBar } from './ReplayPlayerBar';
import { useHistoricalTrip } from '../hooks/useHistoricalTrip';
import { useTripPlayback } from '../hooks/useTripPlayback';
import { getBangkokDate } from '../hooks/useDailyMetrics';
import { haversineDistance } from '../services/distanceCalculator';

interface HistoricalTripReplayProps {
  initialVehicleId?: string;
  vehicleList?: Array<{ id: string; name: string }>;
}

const DEFAULT_VEHICLES = [
  { id: 'shuttle-01', name: 'Shuttle 1' },
  { id: 'shuttle-02', name: 'Shuttle 2' },
];

export const HistoricalTripReplay: React.FC<HistoricalTripReplayProps> = ({
  initialVehicleId = 'shuttle-01',
  vehicleList = DEFAULT_VEHICLES,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(getBangkokDate());
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(initialVehicleId);

  const { points, summary, isLoading, refetch } = useHistoricalTrip(
    selectedVehicleId,
    selectedDate
  );

  const {
    currentIndex,
    currentPoint,
    isPlaying,
    speedMultiplier,
    traversedPoints,
    togglePlay,
    reset,
    seekToIndex,
    setSpeedMultiplier,
  } = useTripPlayback(points);

  // Calculate distance covered up to current scrubber point
  const distanceCoveredKm = useMemo(() => {
    if (traversedPoints.length <= 1) return 0;
    let dist = 0;
    for (let i = 1; i < traversedPoints.length; i++) {
      dist += haversineDistance(
        traversedPoints[i - 1].lat,
        traversedPoints[i - 1].lng,
        traversedPoints[i].lat,
        traversedPoints[i].lng
      );
    }
    return Math.round(dist * 10) / 10;
  }, [traversedPoints]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] w-full relative overflow-hidden bg-slate-100 dark:bg-slate-900">
      {/* Top Toolbar */}
      <ReplayToolbar
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        selectedVehicleId={selectedVehicleId}
        onVehicleChange={setSelectedVehicleId}
        vehicleList={vehicleList}
        summary={summary}
        isLoading={isLoading}
        onRefresh={refetch}
      />

      {/* Main Map Viewport */}
      <ReplayMap
        points={points}
        traversedPoints={traversedPoints}
        currentPoint={currentPoint}
        isLoading={isLoading}
      />

      {/* Floating Bottom Player Bar */}
      <ReplayPlayerBar
        currentIndex={currentIndex}
        totalPoints={points.length}
        isPlaying={isPlaying}
        speedMultiplier={speedMultiplier}
        currentPoint={currentPoint}
        startTimeStr={summary.start_time}
        endTimeStr={summary.end_time}
        totalDistanceKm={summary.total_distance_km}
        distanceCoveredKm={distanceCoveredKm}
        onTogglePlay={togglePlay}
        onReset={reset}
        onSeek={seekToIndex}
        onSpeedChange={setSpeedMultiplier}
      />
    </div>
  );
};
```

- [ ] **Step 4: Update `App.tsx` with Header Tabs and view switching**

In `frontend/src/App.tsx`:
- Import `HistoricalTripReplay`.
- Add tab state: `const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');`.
- In the compact header:
  - Add segmented control pills:
    - Tab 1: `วันนี้`
    - Tab 2: `ประวัติย้อนหลัง`
- Conditionally render either:
  - If `activeTab === 'today'`: render `ShuttleMap` and `DailyDistanceTable`.
  - If `activeTab === 'history'`: render `<HistoricalTripReplay initialVehicleId={selectedVehicleId || 'shuttle-01'} />`.
- Update `frontend/src/__tests__/App.test.tsx` to assert that:
  - Header renders "วันนี้" and "ประวัติย้อนหลัง" tabs.
  - Clicking "ประวัติย้อนหลัง" switches view to historical replay.
  - Clicking "วันนี้" returns to live view.

- [ ] **Step 5: Run full test suite and build verification**

Run:
```bash
cd frontend
npm test -- --run
npm run build
```
Expected: All tests pass (including existing 125 tests + new tests) and production build succeeds with zero errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/HistoricalTripReplay.tsx frontend/src/App.tsx frontend/src/__tests__/HistoricalTripReplay.test.tsx frontend/src/__tests__/App.test.tsx
git commit -m "feat(history): assemble HistoricalTripReplay and integrate header tabs into App"
```
