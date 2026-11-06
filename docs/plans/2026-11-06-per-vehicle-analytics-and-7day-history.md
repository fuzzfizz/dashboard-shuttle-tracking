# Per-Vehicle Analytics & 7-Day History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 7-day trend chart to fetch and display actual historical mileage from Supabase (`daily_vehicle_metrics`), and add a Vehicle Filter Selector to the analytics card so both 7-day trend and hourly activity charts can be viewed per vehicle or for the entire fleet.

**Architecture:** 
1. Service layer (`historicalTelemetryService.ts`): Queries the last 7 days of metrics from Supabase `daily_vehicle_metrics` and computes hourly distance buckets from `telemetry_logs`.
2. Mathematical calculator (`analyticsCalculator.ts`): Pure functions calculate 7-day trend and hourly intensity/distance filtered by `selectedVehicleId` or aggregated for `'all'`.
3. Hook layer (`useDailyMetrics.ts`): Exposes `past7DayMetrics` and `hourlyDistanceMap` alongside today's live telemetry increments.
4. UI layer (`FleetDistanceAnalyticsCard.tsx`): Adds a sleek Header Vehicle Selector, highlights selected vehicle in comparison view, and binds per-vehicle data into `Trend7DayChart` and `HourlyActivityChart`.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide React, Vitest, Supabase JS.

## Global Constraints
- Preserve existing 190 Vitest tests with 0 regressions.
- Support `Asia/Bangkok` timezone for all date calculations and hour groupings (06:00 to 20:00).
- Fully responsive: Mobile touch targets >= 42px, accessible ARIA attributes, light/dark mode support.
- No synthetic sine-wave fallbacks when real database records are available.

---

### Task 1: Update `analyticsCalculator.ts` for Per-Vehicle 7-Day Trend & Hourly Distance

**Files:**
- Modify: `frontend/src/services/analyticsCalculator.ts`
- Test: `frontend/src/services/__tests__/analyticsCalculator.test.ts`

**Interfaces:**
- `DailyRecordItem`: `{ vehicle_id: string; date: string; total_distance_km: number }`
- `compute7DayTrendData(dailyMetrics: DailyMetricsMap, pastDailyRecords: DailyRecordItem[], referenceDate?: Date, selectedVehicleId?: string | null): TrendDayPoint[]`
- `computeHourlyActivityData(hourlyMap: Record<string, Record<number, number>>, selectedVehicleId?: string | null, dailyMetrics?: DailyMetricsMap): HourlyActivityPoint[]`

- [ ] **Step 1: Write failing unit tests in `analyticsCalculator.test.ts`**

Add tests verifying:
1. `compute7DayTrendData` filters by `selectedVehicleId = 'shuttle-01'` and picks up 4.91 km for 2026-11-05.
2. `compute7DayTrendData` aggregates all vehicles when `selectedVehicleId = 'all'` or `null`.
3. `computeHourlyActivityData` returns distance per hour for a selected vehicle using `hourlyMap`.

```typescript
// Add to frontend/src/services/__tests__/analyticsCalculator.test.ts:
it('computes 7-day trend for a specific vehicle filtering out others', () => {
  const refDate = new Date('2026-11-06T12:00:00Z');
  const pastRecords = [
    { vehicle_id: 'shuttle-01', date: '2026-11-05', total_distance_km: 4.91 },
    { vehicle_id: 'shuttle-02', date: '2026-11-05', total_distance_km: 12.0 },
    { vehicle_id: 'shuttle-01', date: '2026-11-04', total_distance_km: 3.2 },
  ];
  const dailyMetrics = {
    'shuttle-01': { vehicle_id: 'shuttle-01', date: '2026-11-06', total_distance_km: 1.5, max_speed_kmh: 30, avg_speed_kmh: 15, active_minutes: 10, last_updated_at: '' }
  };

  const points = compute7DayTrendData(dailyMetrics, pastRecords, refDate, 'shuttle-01');
  const yesterday = points.find((p) => p.date === '2026-11-05');
  const today = points.find((p) => p.date === '2026-11-06');

  expect(yesterday?.totalDistanceKm).toBe(4.91);
  expect(today?.totalDistanceKm).toBe(1.5);
});

it('computes hourly activity accurately for a selected vehicle', () => {
  const hourlyMap = {
    'shuttle-01': { 7: 1.8, 8: 2.5, 13: 4.9 },
    'shuttle-02': { 7: 3.0, 9: 5.0 }
  };

  const points = computeHourlyActivityData(hourlyMap, 'shuttle-01');
  const hour7 = points.find((p) => p.hour === 7);
  const hour8 = points.find((p) => p.hour === 8);
  const hour9 = points.find((p) => p.hour === 9);

  expect(hour7?.distanceKm).toBe(1.8);
  expect(hour8?.distanceKm).toBe(2.5);
  expect(hour9?.distanceKm).toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/__tests__/analyticsCalculator.test.ts`
Expected: FAIL due to interface mismatch or unimplemented vehicle filtering.

- [ ] **Step 3: Implement per-vehicle filtering in `analyticsCalculator.ts`**

Update `compute7DayTrendData` and `computeHourlyActivityData` to support `selectedVehicleId` and `hourlyMap`. When `selectedVehicleId` is specified, filter `pastDailyRecords` by `vehicle_id === selectedVehicleId` and use `dailyMetrics[selectedVehicleId]`. When `selectedVehicleId` is `'all'` or undefined, sum all vehicles per date and per hour.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/__tests__/analyticsCalculator.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add frontend/src/services/analyticsCalculator.ts frontend/src/services/__tests__/analyticsCalculator.test.ts
git commit -m "feat(analytics): support per-vehicle filtering in 7-day trend and hourly calculators"
```

---

### Task 2: Implement Historical & Hourly Data Queries in `historicalTelemetryService.ts`

**Files:**
- Modify: `frontend/src/services/historicalTelemetryService.ts`
- Test: `frontend/src/services/__tests__/historicalDateUtils.test.ts` and `frontend/src/hooks/__tests__/useHistoricalTrip.test.ts`

**Interfaces:**
- `fetch7DayVehicleMetrics(referenceDate?: Date): Promise<DailyRecordItem[]>`
- `fetchTodayHourlyDistanceMap(dateStr: string): Promise<Record<string, Record<number, number>>>`

- [ ] **Step 1: Write test for `fetch7DayVehicleMetrics`**

Add unit tests in `historicalTelemetryService.test.ts` (or mock Supabase query test) verifying that `fetch7DayVehicleMetrics` queries `daily_vehicle_metrics` with `gte('date', startStr)` and returns the list of records.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/__tests__/historicalDateUtils.test.ts`

- [ ] **Step 3: Implement `fetch7DayVehicleMetrics` and `fetchTodayHourlyDistanceMap`**

In `historicalTelemetryService.ts`:
1. `fetch7DayVehicleMetrics(referenceDate = new Date())`:
   - Calculate `startDateStr` (referenceDate - 6 days in Bangkok date format `YYYY-MM-DD`).
   - Calculate `todayDateStr` (referenceDate in Bangkok date format).
   - Query `supabase.from('daily_vehicle_metrics').select('vehicle_id, date, total_distance_km').gte('date', startDateStr).lte('date', todayDateStr).order('date', { ascending: true })`.
   - Return mapped records.
2. `fetchTodayHourlyDistanceMap(dateStr: string)`:
   - Query `telemetry_logs` for `recorded_at` between start of day and end of day.
   - Group consecutive points by vehicle and calculate distance per Bangkok hour (UTC + 7).
   - Return `{ [vehicleId]: { [hour]: distanceKm } }`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/__tests__/`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add frontend/src/services/historicalTelemetryService.ts
git commit -m "feat(services): implement 7-day vehicle metrics and hourly logs query"
```

---

### Task 3: Integrate 7-Day & Hourly Ingestion into `useDailyMetrics.ts`

**Files:**
- Modify: `frontend/src/hooks/useDailyMetrics.ts`
- Test: `frontend/src/hooks/__tests__/useDailyMetrics.test.ts`

**Interfaces:**
- `useDailyMetrics(vehicles: FleetMap)` returns:
  `{ dailyMetrics, totalFleetDistanceKm, past7DayRecords, hourlyDistanceMap, isLoading, refetch }`

- [ ] **Step 1: Write failing test in `useDailyMetrics.test.ts`**

Update `useDailyMetrics.test.ts` to assert that `past7DayRecords` and `hourlyDistanceMap` are exposed by `useDailyMetrics` and populated when Supabase returns 7-day metric rows.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/__tests__/useDailyMetrics.test.ts`
Expected: FAIL because `past7DayRecords` is not returned yet.

- [ ] **Step 3: Implement 7-day query and hourly accumulation in `useDailyMetrics.ts`**

1. Maintain state: `const [past7DayRecords, setPast7DayRecords] = useState<DailyRecordItem[]>([])`
2. Maintain state: `const [hourlyDistanceMap, setHourlyDistanceMap] = useState<Record<string, Record<number, number>>>({})`
3. In `fetchSupabaseMetrics`, concurrently query past 7 days using `fetch7DayVehicleMetrics` and update `past7DayRecords`.
4. Accumulate live telemetry movement into `hourlyDistanceMap` using the current Bangkok hour `new Date().getHours()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/__tests__/useDailyMetrics.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add frontend/src/hooks/useDailyMetrics.ts frontend/src/hooks/__tests__/useDailyMetrics.test.ts
git commit -m "feat(hooks): integrate 7-day historical records and live hourly accumulation"
```

---

### Task 4: Enhance `FleetDistanceAnalyticsCard.tsx` with Vehicle Selector & Per-Vehicle Binding

**Files:**
- Modify: `frontend/src/components/FleetDistanceAnalyticsCard.tsx`
- Modify: `frontend/src/components/charts/Trend7DayChart.tsx`
- Modify: `frontend/src/components/charts/HourlyActivityChart.tsx`
- Modify: `frontend/src/components/charts/VehicleComparisonChart.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/components/__tests__/FleetDistanceAnalyticsCard.test.tsx`

**Interfaces:**
- `FleetDistanceAnalyticsCardProps`:
  ```typescript
  export interface FleetDistanceAnalyticsCardProps {
    dailyMetrics: DailyMetricsMap;
    vehicles: FleetMap;
    lastSeenMap: Record<string, number>;
    past7DayRecords?: DailyRecordItem[];
    hourlyDistanceMap?: Record<string, Record<number, number>>;
    now?: number;
    className?: string;
    defaultTab?: AnalyticsTab;
  }
  ```

- [ ] **Step 1: Write failing tests in `FleetDistanceAnalyticsCard.test.tsx`**

Test:
1. Renders the Vehicle Selector with `ทุกคัน (รวมกองรถ)` and detected vehicle IDs.
2. Selecting `shuttle-01` updates 7-day trend points and hourly activity points to reflect `shuttle-01`.
3. Selecting a vehicle highlights that vehicle in the comparison list.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/FleetDistanceAnalyticsCard.test.tsx`
Expected: FAIL (Vehicle selector element not found).

- [ ] **Step 3: Implement Vehicle Selector and wire per-vehicle props**

1. In `FleetDistanceAnalyticsCard.tsx`:
   - State: `const [selectedVehicleId, setSelectedVehicleId] = useState<string>('all')`.
   - Collect unique vehicle IDs from `Object.keys(vehicles)`, `Object.keys(dailyMetrics)`, and `past7DayRecords.map(r => r.vehicle_id)`.
   - Add a `<select>` or custom dropdown styled with Tailwind and Lucide `Bus` icon next to the collapse toggle.
   - Pass `past7DayRecords` and `selectedVehicleId` to `compute7DayTrendData`.
   - Pass `hourlyDistanceMap` and `selectedVehicleId` to `computeHourlyActivityData`.
   - Pass `selectedVehicleId` to `VehicleComparisonChart` to highlight the row.
2. In `Trend7DayChart.tsx`:
   - Accept optional `selectedVehicleId` or vehicle label in header subtitle: e.g. `ปริมาณระยะทางสะสมของ shuttle-01 (กม./วัน)`.
3. In `HourlyActivityChart.tsx`:
   - Accept optional `selectedVehicleId` or vehicle label in header subtitle: e.g. `ระยะทางวิ่งจริงรายชั่วโมงของ shuttle-01`.
4. In `App.tsx`:
   - Pass `past7DayRecords` and `hourlyDistanceMap` from `useDailyMetrics` into `<FleetDistanceAnalyticsCard />`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/FleetDistanceAnalyticsCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add frontend/src/components/FleetDistanceAnalyticsCard.tsx frontend/src/components/charts/ frontend/src/App.tsx frontend/src/components/__tests__/FleetDistanceAnalyticsCard.test.tsx
git commit -m "feat(ui): add vehicle selector and per-vehicle views to fleet distance analytics card"
```

---

### Task 5: End-to-End Regression Testing & Verification

**Files:**
- Test: All tests in `frontend/src`

- [ ] **Step 1: Run full Vitest suite**

Run: `npm test --prefix frontend`
Expected: All 190+ tests pass with 0 failures.

- [ ] **Step 2: Verification of yesterday's data**

Run a script or test to verify that `shuttle-01` on `2026-11-05` outputs `4.91 km` in the 7-day trend array when queried from Supabase.

- [ ] **Step 3: Final Commit**

```bash
git commit -am "chore: verify per-vehicle 7-day trend and hourly activity analytics"
```
