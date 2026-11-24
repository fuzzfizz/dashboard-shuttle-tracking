# Single Vehicle Focus Map Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Isolate map markers to only the selected vehicle when focusing an individual vehicle (`selectedVehicleId !== null`), while displaying all vehicles in Fleet Overview Mode (`selectedVehicleId === null`), along with quick-return controls on both fullscreen and inline dashboard views.

**Architecture:** 
1. In `ShuttleMap.tsx`, memoize `displayedVehicles` to filter to only the vehicle matching `selectedVehicleId` when present and known, falling back to all vehicles when `selectedVehicleId` is null or unknown.
2. In `App.tsx`, provide a clear indicator and button (`กำลังดู: [ID] [✕ ดูรถทั้งหมด]`) in the inline map header when a vehicle is focused, allowing instant return to overview.
3. Verify via TDD in `ShuttleMap.test.tsx` and `App.test.tsx`.

**Tech Stack:** React 18, TypeScript, Leaflet / React-Leaflet, Tailwind CSS, Vitest, React Testing Library.

## Global Constraints

- Never mutate props or bypass React immutability.
- Keep camera auto controller and smooth 60 FPS marker interpolation intact.
- Follow Thai / Pharmacy CMU theme colors.
- Maintain 100% pass rate across all existing test suites.

---

### Task 1: Filter Map Markers in `ShuttleMap.tsx` with TDD

**Files:**
- Modify: `frontend/src/components/ShuttleMap.tsx:440-575`
- Test: `frontend/src/components/__tests__/ShuttleMap.test.tsx`

**Interfaces:**
- Consumes: `vehicles: FleetMap`, `selectedVehicleId: string | null`
- Produces: `displayedVehicles: TelemetryPayload[]` filtered by selection

- [ ] **Step 1: Write failing unit tests in `ShuttleMap.test.tsx`**

Add tests to `frontend/src/components/__tests__/ShuttleMap.test.tsx`:
```tsx
it('renders only the selected vehicle marker when selectedVehicleId is specified', () => {
  const vehicles: FleetMap = {
    'EV-01': {
      vehicle_id: 'EV-01',
      lat: 18.7883,
      lng: 98.9853,
      speed: 20,
      heading: 90,
      timestamp: Date.now(),
    },
    'EV-02': {
      vehicle_id: 'EV-02',
      lat: 18.7900,
      lng: 98.9800,
      speed: 15,
      heading: 180,
      timestamp: Date.now(),
    },
  };

  const { container } = render(
    <ShuttleMap vehicles={vehicles} selectedVehicleId="EV-01" />
  );

  // EV-01 should be present in marker inner html
  expect(container.innerHTML).toContain('EV-01');
  // EV-02 should NOT be rendered when focusing EV-01
  expect(container.innerHTML).not.toContain('EV-02');
});

it('renders all vehicles when selectedVehicleId is null (Overview Mode)', () => {
  const vehicles: FleetMap = {
    'EV-01': {
      vehicle_id: 'EV-01',
      lat: 18.7883,
      lng: 98.9853,
      speed: 20,
      heading: 90,
      timestamp: Date.now(),
    },
    'EV-02': {
      vehicle_id: 'EV-02',
      lat: 18.7900,
      lng: 98.9800,
      speed: 15,
      heading: 180,
      timestamp: Date.now(),
    },
  };

  const { container } = render(
    <ShuttleMap vehicles={vehicles} selectedVehicleId={null} />
  );

  expect(container.innerHTML).toContain('EV-01');
  expect(container.innerHTML).toContain('EV-02');
});

it('falls back to rendering all vehicles if selectedVehicleId is not in effectiveVehicles', () => {
  const vehicles: FleetMap = {
    'EV-01': {
      vehicle_id: 'EV-01',
      lat: 18.7883,
      lng: 98.9853,
      speed: 20,
      heading: 90,
      timestamp: Date.now(),
    },
  };

  const { container } = render(
    <ShuttleMap vehicles={vehicles} selectedVehicleId="UNKNOWN_BUS" />
  );

  expect(container.innerHTML).toContain('EV-01');
  expect(container.innerHTML).toContain('No GPS coordinates recorded for UNKNOWN_BUS yet');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run frontend/src/components/__tests__/ShuttleMap.test.tsx`
Confirm that `'renders only the selected vehicle marker when selectedVehicleId is specified'` fails because EV-02 is currently still rendered.

- [ ] **Step 3: Implement marker filtering in `ShuttleMap.tsx`**

In `frontend/src/components/ShuttleMap.tsx`:
```tsx
const displayedVehicles = React.useMemo(() => {
  if (selectedVehicleId && effectiveVehicles[selectedVehicleId]) {
    return [effectiveVehicles[selectedVehicleId]];
  }
  return vehicleList;
}, [selectedVehicleId, effectiveVehicles, vehicleList]);
```
Replace `vehicleList.map((v) => ...)` with `displayedVehicles.map((v) => ...)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run frontend/src/components/__tests__/ShuttleMap.test.tsx`

- [ ] **Step 5: Commit changes**

`git commit -m "feat: isolate vehicle markers on map during single vehicle focus mode"`

---

### Task 2: Add Return to Overview Button in Inline Dashboard Header & Integration Tests

**Files:**
- Modify: `frontend/src/App.tsx:235-273`
- Test: `frontend/src/__tests__/App.test.tsx`

**Interfaces:**
- Consumes: `selectedVehicleId: string | null`, `setSelectedVehicleId: (id: string | null) => void`
- Produces: Actionable UI badge to reset focus back to overview

- [ ] **Step 1: Write integration test in `App.test.tsx`**

Add test to `frontend/src/__tests__/App.test.tsx`:
```tsx
it('renders a return to overview button on inline map header when a vehicle is selected, and clicking it resets focus', async () => {
  // Test selecting a vehicle and verifying the overview button appears and works
});
```

- [ ] **Step 2: Implement return-to-overview badge/button in `App.tsx`**

In `frontend/src/App.tsx` around line 247 (inside the card header when `!isMapFullscreen`):
```tsx
{selectedVehicleId && (
  <button
    type="button"
    onClick={() => setSelectedVehicleId(null)}
    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 dark:text-emerald-300 dark:border-emerald-800 text-xs font-medium transition-colors"
    title="กลับสู่มุมมองรถทั้งหมด"
  >
    <span>กำลังดู: <strong className="font-mono">{selectedVehicleId}</strong></span>
    <span className="text-[10px] bg-emerald-200/70 dark:bg-emerald-800/80 px-1.5 py-0.5 rounded font-sans">✕ ดูรถทั้งหมด</span>
  </button>
)}
```

- [ ] **Step 3: Run integration tests**

Run: `npx vitest run frontend/src/__tests__/App.test.tsx`

- [ ] **Step 4: Commit changes**

`git commit -m "feat: add quick return to overview button in inline dashboard map header"`

---

### Task 3: Full Test Suite Verification

- [ ] **Step 1: Run complete test suite**

Run: `npm test` from project root. Ensure all 38 test suites and 330+ tests pass with 0 regressions.

- [ ] **Step 2: Final commit and summary**
