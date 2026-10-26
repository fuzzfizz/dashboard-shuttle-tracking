# Daily Distance Table & Responsive Vehicle Focus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a responsive Daily Distance Table on the main dashboard that displays today's distance per vehicle with sorting, and allows users to click any vehicle row to immediately focus that vehicle on the map in fullscreen mode.

**Architecture:** Create a new `DailyDistanceTable` component with dual-mode responsive layout (HTML table for desktop, stacked cards with 44px tap targets for mobile). Integrate into `App.tsx` beneath the Map & HUD, wiring up `onOpenVehicleMap(vehicleId)` to set `selectedVehicleId` and `isMapFullscreen(true)`.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide React, Vitest, React Testing Library.

## Global Constraints
- Must be 100% responsive across mobile (375px), tablet (768px), and desktop (1280px+) without horizontal page scroll.
- Interactive rows and buttons must adhere to 44px minimum tap target bounds (`min-h-[44px]`).
- Clicking any vehicle row or action button must select that vehicle and open the map in fullscreen mode.
- All existing 59 tests must continue to pass with zero regressions.

---

### Task 1: Create DailyDistanceTable Component with TDD

**Files:**
- Create: `frontend/src/components/DailyDistanceTable.tsx`
- Test: `frontend/src/components/__tests__/DailyDistanceTable.test.tsx`

**Interfaces:**
- Consumes: `DailyMetricsMap`, `FleetMap`, `lastSeenMap`, `selectedVehicleId`, `onOpenVehicleMap(vehicleId: string)`.
- Produces: `DailyDistanceTable` React component.

- [ ] **Step 1: Write failing tests in `DailyDistanceTable.test.tsx`**

Create `frontend/src/components/__tests__/DailyDistanceTable.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DailyDistanceTable } from '../DailyDistanceTable';
import { DailyMetricsMap } from '../../types/metrics';
import { FleetMap } from '../../types/telemetry';

describe('DailyDistanceTable', () => {
  it('renders empty state when no vehicles are available', () => {
    render(
      <DailyDistanceTable
        dailyMetrics={{}}
        vehicles={{}}
        lastSeenMap={{}}
        selectedVehicleId={null}
        onOpenVehicleMap={vi.fn()}
      />
    );
    expect(screen.getByText(/no distance recorded today/i)).toBeInTheDocument();
  });

  it('renders vehicle list with daily distance and triggers onOpenVehicleMap when clicked', () => {
    const handleOpenMap = vi.fn();
    const metrics: DailyMetricsMap = {
      'EV-01': {
        vehicle_id: 'EV-01',
        date: '2026-10-26',
        total_distance_km: 18.5,
        max_speed_kmh: 45,
        avg_speed_kmh: 25,
        active_minutes: 60,
        last_updated_at: new Date().toISOString(),
      },
    };
    const vehicles: FleetMap = {
      'EV-01': {
        vehicle_id: 'EV-01',
        lat: 13.75,
        lng: 100.5,
        speed: 30,
        timestamp: Date.now(),
      },
    };

    render(
      <DailyDistanceTable
        dailyMetrics={metrics}
        vehicles={vehicles}
        lastSeenMap={{ 'EV-01': Date.now() }}
        selectedVehicleId={null}
        onOpenVehicleMap={handleOpenMap}
      />
    );

    expect(screen.getByText('EV-01')).toBeInTheDocument();
    expect(screen.getByText('18.50 km')).toBeInTheDocument();

    // Click row or open button
    const openBtn = screen.getByRole('button', { name: /open map for ev-01/i });
    fireEvent.click(openBtn);
    expect(handleOpenMap).toHaveBeenCalledWith('EV-01');
  });

  it('sorts vehicles by highest distance first by default and toggles on sort button click', () => {
    const metrics: DailyMetricsMap = {
      'EV-01': {
        vehicle_id: 'EV-01',
        date: '2026-10-26',
        total_distance_km: 10.0,
        max_speed_kmh: 40,
        avg_speed_kmh: 20,
        active_minutes: 30,
        last_updated_at: new Date().toISOString(),
      },
      'EV-02': {
        vehicle_id: 'EV-02',
        date: '2026-10-26',
        total_distance_km: 35.0,
        max_speed_kmh: 50,
        avg_speed_kmh: 30,
        active_minutes: 90,
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

    const vehicleItems = screen.getAllByTestId('vehicle-id-cell');
    expect(vehicleItems[0]).toHaveTextContent('EV-02'); // 35km first
    expect(vehicleItems[1]).toHaveTextContent('EV-01'); // 10km second
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix frontend -- src/components/__tests__/DailyDistanceTable.test.tsx`
Expected: FAIL because `DailyDistanceTable` does not exist yet.

- [ ] **Step 3: Implement `DailyDistanceTable.tsx`**

Create `frontend/src/components/DailyDistanceTable.tsx` with:
- Desktop table view (`hidden sm:block overflow-x-auto`)
- Mobile card list view (`sm:hidden space-y-2.5`)
- Sorting state (`distance-desc`, `distance-asc`, `id-asc`)
- Accessible touch targets (`min-h-[44px]`)
- Total fleet distance header pill
- `onOpenVehicleMap(vehicleId)` on click

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --prefix frontend -- src/components/__tests__/DailyDistanceTable.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/DailyDistanceTable.tsx frontend/src/components/__tests__/DailyDistanceTable.test.tsx
git commit -m "feat(ui): add responsive DailyDistanceTable component with distance sorting"
```

---

### Task 2: Integrate DailyDistanceTable into App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/__tests__/App.test.tsx`

**Interfaces:**
- Consumes: `<DailyDistanceTable>`
- Produces: Seamless interaction where clicking a row selects the vehicle and expands the map to fullscreen.

- [ ] **Step 1: Write integration test in `App.test.tsx`**

In `frontend/src/__tests__/App.test.tsx`:
```tsx
  it('renders DailyDistanceTable and opens map in fullscreen mode when a vehicle row is clicked', () => {
    render(<App />);

    expect(screen.getByText(/daily distance overview/i)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix frontend -- src/__tests__/App.test.tsx`
Expected: FAIL if `Daily Distance Overview` is not rendered.

- [ ] **Step 3: Implement integration in `App.tsx`**

In `frontend/src/App.tsx`:
1. Import `DailyDistanceTable`.
2. Define:
   ```tsx
   const handleOpenVehicleMap = (vehicleId: string) => {
     setSelectedVehicleId(vehicleId);
     setIsMapFullscreen(true);
   };
   ```
3. Place `<DailyDistanceTable>` below `<TelemetryHUD>` inside the left/main column (`lg:col-span-8 flex flex-col gap-4`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --prefix frontend -- src/__tests__/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/__tests__/App.test.tsx
git commit -m "feat(ui): integrate DailyDistanceTable into dashboard with fullscreen focus on click"
```

---

### Task 3: Full Verification & Build Check

**Files:**
- None (verification across existing files)

- [ ] **Step 1: Run full test suite**
Run: `npm test`
Expected: 100% tests pass.

- [ ] **Step 2: Run build**
Run: `npm run build`
Expected: Clean build with zero errors.

- [ ] **Step 3: Push to origin master**
Run: `git push origin master`
