# Full-Width Bottom Daily Analytics Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the daily analytics experience from a disconnected popup modal into a comprehensive, responsive, full-width (12-column) bottom dashboard table with 3 summary cards, enriched vehicle metrics (Distance, Max Speed, Active Time, Status), and smooth scroll navigation.

**Architecture:** Enrich `DailyDistanceTable` with 3 summary metric cards and additional columns (Max Speed, Active Time). Move the table in `App.tsx` from the 8-column left container to a full-width `lg:col-span-12` section beneath the operational grid. Eliminate `DailyMetricsModal` and rewire header/panel "Analytics" buttons to trigger a smooth scroll to `#fleet-analytics`.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide React, Vitest, React Testing Library.

## Global Constraints
- Layout must span 12 columns (`lg:col-span-12 w-full`) without horizontal page overflow across 375px, 768px, and 1280px+.
- All mobile interactive targets (cards, buttons) must maintain minimum 44px height bounds (`min-h-[44px]`).
- Clicking any vehicle row or "Open Map" button must focus the vehicle and expand the map to fullscreen mode.
- Escape key and "Exit full screen" button must dismiss fullscreen mode and return to dashboard view.
- 100% test pass rate with zero TypeScript errors on production build (`tsc && vite build`).

---

### Task 1: Enrich DailyDistanceTable with Summary Cards and Extended Metrics (TDD)

**Files:**
- Modify: `frontend/src/components/__tests__/DailyDistanceTable.test.tsx`
- Modify: `frontend/src/components/DailyDistanceTable.tsx`

**Interfaces:**
- Consumes: `DailyMetricsMap`, `FleetMap`, `lastSeenMap`, `selectedVehicleId`, `onOpenVehicleMap(vehicleId: string)`, `now?: number`, `className?: string`.
- Produces: Enhanced `DailyDistanceTable` rendering summary cards (Total Distance, Max Speed, Tracked Shuttles), Max Speed & Active Time columns on desktop, 3-metric summary on mobile cards, and extended sort cycling (`distance-desc` ➔ `speed-desc` ➔ `id-asc`).

- [ ] **Step 1: Write failing tests in `DailyDistanceTable.test.tsx`**

Add tests to `frontend/src/components/__tests__/DailyDistanceTable.test.tsx`:
```tsx
  it('renders summary metric cards for total distance, max speed, and tracked units', () => {
    const metrics: DailyMetricsMap = {
      'EV-01': {
        vehicle_id: 'EV-01',
        date: '2026-10-26',
        total_distance_km: 12.5,
        max_speed_kmh: 42.0,
        avg_speed_kmh: 22.0,
        active_minutes: 65, // 1h 5m
        last_updated_at: new Date().toISOString(),
      },
    };

    render(
      <DailyDistanceTable
        dailyMetrics={metrics}
        vehicles={{}}
        lastSeenMap={{}}
        selectedVehicleId={null}
        onOpenVehicleMap={vi.fn()}
      />
    );

    // Summary cards
    expect(screen.getByText('Total Distance')).toBeInTheDocument();
    expect(screen.getByText('Max Speed')).toBeInTheDocument();
    expect(screen.getByText('Tracked Shuttles')).toBeInTheDocument();
    expect(screen.getByText('42.0 km/h')).toBeInTheDocument();
    expect(screen.getByText('1 shuttles')).toBeInTheDocument();

    // Table row columns
    expect(screen.getByText('1h 5m')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix frontend -- src/components/__tests__/DailyDistanceTable.test.tsx`
Expected: FAIL because summary cards and extended columns are not yet implemented.

- [ ] **Step 3: Implement enhancements in `DailyDistanceTable.tsx`**

In `frontend/src/components/DailyDistanceTable.tsx`:
1. Calculate overall metrics:
   ```tsx
   const maxSpeedOverall = useMemo(() => {
     return Object.values(dailyMetrics).reduce((max, m) => Math.max(max, m.max_speed_kmh || 0), 0);
   }, [dailyMetrics]);

   const trackedUnitsCount = useMemo(() => {
     return allVehicleIds.length;
   }, [allVehicleIds]);
   ```
2. Helper for formatting active time:
   ```tsx
   const formatActiveTime = (minutes: number) => {
     if (!minutes || minutes <= 0) return '0m';
     const h = Math.floor(minutes / 60);
     const m = Math.round(minutes % 60);
     return h > 0 ? `${h}h ${m}m` : `${m}m`;
   };
   ```
3. Update Sort modes: `'distance-desc' | 'speed-desc' | 'id-asc'`.
4. Render 3 summary cards above the table in a responsive 3-column grid (`grid grid-cols-1 sm:grid-cols-3 gap-3 my-3`).
5. In desktop table (`hidden sm:block overflow-x-auto`), add `Max Speed` and `Active Time` `<th>` and `<td>` cells.
6. In mobile cards (`sm:hidden space-y-3`), render 3 metrics (Distance, Max Speed, Active Time) with `min-h-[44px]` touch targets.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --prefix frontend -- src/components/__tests__/DailyDistanceTable.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/DailyDistanceTable.tsx frontend/src/components/__tests__/DailyDistanceTable.test.tsx
git commit -m "feat(ui): enrich DailyDistanceTable with summary cards and speed/time metrics"
```

---

### Task 2: Layout Migration in App.tsx & Deprecation of DailyMetricsModal (TDD)

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/__tests__/App.test.tsx`
- Modify / Clean: `frontend/src/components/DailyMetricsModal.tsx` & `frontend/src/components/__tests__/DailyMetricsModal.test.tsx`
- Modify: `frontend/src/components/FleetPanel.tsx` (if `onOpenAnalytics` signature/behavior is adjusted)

**Interfaces:**
- Consumes: `<DailyDistanceTable>`
- Produces: Full-width bottom layout (`lg:col-span-12`), smooth scroll navigation on "Analytics" buttons, and zero modal overhead.

- [ ] **Step 1: Write integration tests in `App.test.tsx`**

Update `frontend/src/__tests__/App.test.tsx`:
1. Remove tests asserting `DailyMetricsModal` open/close.
2. Add test verifying that clicking the Analytics button calls `scrollIntoView` for `#fleet-analytics`.
3. Add test verifying that the analytics section has `id="fleet-analytics"` and renders full-width at the bottom.
4. Verify clicking any vehicle row in the bottom table still expands the map to fullscreen.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix frontend -- src/__tests__/App.test.tsx`
Expected: FAIL because `scrollIntoView` wiring and bottom layout are not yet updated.

- [ ] **Step 3: Implement layout changes in `App.tsx`**

In `frontend/src/App.tsx`:
1. Remove `import { DailyMetricsModal } from './components/DailyMetricsModal';`.
2. Remove `isAnalyticsOpen` state and remove `!isAnalyticsOpen` condition from Escape listener.
3. Define scroll handler:
   ```tsx
   const handleScrollToAnalytics = () => {
     const el = document.getElementById('fleet-analytics');
     if (el) {
       el.scrollIntoView({ behavior: 'smooth' });
     }
   };
   ```
4. Update Header Analytics button:
   ```tsx
   <button
     onClick={handleScrollToAnalytics}
     aria-label="View Daily Analytics"
     title="View Daily Analytics"
     ...
   ```
5. Move `<DailyDistanceTable>` outside the `lg:col-span-8` container and place it as a full-width child of `<main>`:
   ```tsx
   {/* Full-Width Bottom Analytics Table */}
   {!isMapFullscreen && (
     <section id="fleet-analytics" className="lg:col-span-12 w-full mt-2">
       <DailyDistanceTable
         dailyMetrics={dailyMetrics}
         vehicles={vehicles}
         lastSeenMap={lastSeenMap}
         selectedVehicleId={selectedVehicleId}
         onOpenVehicleMap={handleOpenVehicleMap}
         now={now}
       />
     </section>
   )}
   ```
6. Remove `<DailyMetricsModal ... />` from JSX.
7. Update `FleetPanel.tsx` `onOpenAnalytics` callback to invoke `handleScrollToAnalytics`.

- [ ] **Step 4: Clean up `DailyMetricsModal.test.tsx`**
Update or retire `DailyMetricsModal.test.tsx` so the test suite reflects active codebase components.

- [ ] **Step 5: Run tests to verify all pass**

Run: `npm test --prefix frontend -- src/__tests__/App.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.tsx frontend/src/__tests__/App.test.tsx frontend/src/components/FleetPanel.tsx frontend/src/components/DailyMetricsModal.tsx frontend/src/components/__tests__/DailyMetricsModal.test.tsx
git commit -m "feat(ui): migrate analytics to full-width bottom table and eliminate modal"
```

---

### Task 3: Full Verification & Build Check

**Files:**
- None (system-wide verification)

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: 100% tests pass.

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: Clean build (`tsc && vite build`) with zero errors.

- [ ] **Step 3: Push to GitHub master**

Run: `git push origin master`
Expected: Successful push to trigger Render automatic deployment.

- [ ] **Step 4: Update walkthrough artifact**
Update `walkthrough.md` with verification details and responsive UI checks.
