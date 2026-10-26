# Full-Width In-Page Daily Analytics Table Design Spec

**Date:** 2026-10-26  
**Status:** Approved  
**Author:** Antigravity Pairing Assistant & User  

---

## 1. Overview & Problem Statement

Previously, daily analytics metrics (Max Speed, Tracked Shuttles, Active Time) were presented in a popup modal (`DailyMetricsModal`) triggered by an "Analytics" button. Users found the modal disconnected from the primary operational workflow and requested an all-in-one single page experience:
- Eliminate modal popups completely.
- Consolidate all daily metrics (Total Distance, Max Speed, Active Time, and Status) into a permanent, full-width section spanning the bottom of the dashboard across 12 columns (`lg:col-span-12`).
- Retain interactive vehicle selection and map fullscreen focus when any vehicle row or card is clicked.

---

## 2. Architecture & Layout

### 2.1 Grid Layout (`App.tsx`)
The dashboard layout inside `<main>` remains a responsive 12-column grid (`grid grid-cols-1 lg:grid-cols-12 gap-5 max-w-7xl mx-auto w-full`):
- **Top Row (Operational Controls)**:
  - Left Column (`lg:col-span-8`): Map Card + Telemetry HUD.
  - Right Column (`lg:col-span-4`): Fleet Panel (real-time vehicle status list).
- **Bottom Section (Daily Analytics)**:
  - Positioned beneath the operational grid spanning full width: `lg:col-span-12 w-full`.
  - Accessible via smooth scroll target `id="fleet-analytics"`.
  - Visible only in compact mode; hidden when map is in fullscreen view (`!isMapFullscreen`).

### 2.2 Modal Elimination & Navigation
- Remove `DailyMetricsModal.tsx` import and usage.
- Remove `isAnalyticsOpen` state.
- Update "Analytics" buttons in top `<header>` and inside `<FleetPanel>`:
  - Convert to smooth scroll triggers that navigate directly to the `#fleet-analytics` section:
    ```tsx
    const handleScrollToAnalytics = () => {
      document.getElementById('fleet-analytics')?.scrollIntoView({ behavior: 'smooth' });
    };
    ```

---

## 3. Component Design (`DailyDistanceTable` / `DailyAnalyticsTable`)

The existing `DailyDistanceTable` is upgraded into a comprehensive daily analytics component:

### 3.1 Header & Summary Stat Cards
At the top of the component:
1. **Section Header**: Icon (`Route`), Title ("Daily Fleet Analytics"), Subtitle ("Comprehensive mileage, speed, and active operating metrics today").
2. **3 Metric Summary Cards**:
   - **Total Fleet Distance**: Emerald accent, `totalFleetDistanceKm.toFixed(2)` km.
   - **Overall Max Speed**: Sky accent, `maxSpeedOverall.toFixed(1)` km/h (highest recorded across all vehicles today).
   - **Tracked Shuttles**: Amber accent, count of active shuttles with recorded data.
3. **Sort Control Button**:
   - Cycles through: Highest Distance (`distance-desc`) ➔ Highest Max Speed (`speed-desc`) ➔ Vehicle ID (`id-asc`).
   - Adheres to `min-h-[44px] sm:min-h-0` touch target ergonomics.

### 3.2 Desktop & Tablet View (`hidden sm:block overflow-x-auto`)
An HTML table with 6 structured columns:
1. **Vehicle**: Bus icon, monospace ID, live pulse dot.
2. **Status**: Badge (`Live` <15s, `Signal Lost` >=15s).
3. **Today's Distance**: Formatted km value + proportional progress bar relative to the top vehicle.
4. **Max Speed**: Formatted `m.max_speed_kmh.toFixed(1) km/h`.
5. **Active Time**: Formatted duration (`Xh Xm` or `Xm`).
6. **Action**: "Open Map" button with `Maximize2` icon. Clicking the row or button focuses the vehicle and triggers fullscreen map mode.

### 3.3 Mobile View (`sm:hidden space-y-3`)
A stacked card list optimized for touch interaction:
- Monospace vehicle ID, live status dot, and "View on Map" badge.
- A 3-column metric summary on each card:
  - **Distance**: `XX.XX km` with progress bar.
  - **Max Speed**: `XX.X km/h`.
  - **Active Time**: `Xh Xm`.
- Touch target: Full card and action button adhere to minimum 44px height (`min-h-[44px]`).

---

## 4. Interaction & State Management

- **Row / Button Click**:
  ```tsx
  const handleOpenVehicleMap = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    setIsMapFullscreen(true);
  };
  ```
- **Fullscreen Map Dismissal**:
  - Clicking "Exit full screen" button or pressing `Escape` returns user to the dashboard with the analytics table intact.

---

## 5. Testing & Verification

1. **Unit Tests (`DailyDistanceTable.test.tsx`)**:
   - Verify summary cards display (Total Distance, Max Speed, Tracked Shuttles).
   - Verify 6 columns on desktop (Vehicle, Status, Distance, Max Speed, Active Time, Action).
   - Verify mobile cards render all metrics with `min-h-[44px]` touch targets.
   - Verify sorting toggles between distance, max speed, and vehicle ID.
2. **Integration Tests (`App.test.tsx`)**:
   - Verify bottom analytics table renders in 12-column layout.
   - Verify clicking header Analytics button scrolls smoothly to `#fleet-analytics`.
   - Verify clicking any vehicle row focuses vehicle and opens map in fullscreen.
   - Verify no modals or backdrop overlays appear.
3. **Regression Tests**:
   - Run full Vitest suite (all tests passing).
   - Run production build (`npm run build`).
