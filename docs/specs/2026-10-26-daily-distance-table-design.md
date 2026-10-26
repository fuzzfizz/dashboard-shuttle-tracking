# Design Spec: Daily Distance Table & Responsive Vehicle Focus

**Date:** 2026-10-26  
**Status:** Approved  
**Author:** Pair Programming Agent & User  

---

## 1. Overview & Goal

The Shuttle Tracking Dashboard currently records and calculates daily distance per vehicle in real-time (`useDailyMetrics` with Haversine incremental accumulation and Supabase storage).

The goal of this feature is to:
1. Add a dedicated, responsive **Daily Distance Table (ตารางค่าระยะการเคลื่อนที่ทั้งวันของรถแต่ละคัน)** onto the main dashboard layout.
2. Present concise, readable columns: **Vehicle ID**, **Status (Live/Signal Lost)**, and **Today's Distance (km)** with progress indicators and sorting (descending by distance by default).
3. Provide an intuitive **"Click row to open map"** interaction: clicking any vehicle row or action button selects that vehicle, focuses the map camera on it, and immediately opens the map in **Fullscreen Mode**.
4. Guarantee **flawless responsiveness across all device viewports** (Mobile 375px–414px, Tablet 768px, Desktop 1280px+) following the `responsive-ui-audit` golden rules (44px touch targets, zero horizontal page scroll, responsive card list on mobile and table on desktop).

---

## 2. Component Architecture & Props

### 2.1 `DailyDistanceTable.tsx`
Location: `frontend/src/components/DailyDistanceTable.tsx`

```typescript
export interface DailyDistanceTableProps {
  dailyMetrics: DailyMetricsMap;
  vehicles: FleetMap;
  lastSeenMap: Record<string, number>;
  selectedVehicleId: string | null;
  onOpenVehicleMap: (vehicleId: string) => void;
  now?: number;
  className?: string;
}
```

### 2.2 Data Merging & Sorting Logic
- Combine all unique vehicles from both `dailyMetrics` and live `vehicles`.
- Calculate:
  - `distanceKm`: `dailyMetrics[vId]?.total_distance_km ?? 0`
  - `isOnline`: via `computeVehicleStatus(vehicle, lastSeenMap[vId] || 0, now).isOnline`
  - `maxDistanceOverall`: `Math.max(...allDistances, 1)` for relative progress bar calculation.
- Sorting options:
  - `distance-desc` (Default): Highest distance first.
  - `distance-asc`: Lowest distance first.
  - `id-asc`: Alphabetical by Vehicle ID.

---

## 3. Responsive UI Layout (Mobile & Desktop)

### 3.1 Desktop View (`hidden sm:block`)
- Clean, high-contrast dark table with `overflow-x-auto`:
  - **Header:** Vehicle, Status, Today's Distance, Quick Action
  - **Rows:** Hover effects (`hover:bg-slate-800/60 cursor-pointer`), subtle border separator, tap target `min-h-[48px]`.
  - **Vehicle ID Column:** Bus icon, `font-mono font-bold text-white`, pulse dot.
  - **Status Column:** Emerald pill for `Live`, Amber pill for `Signal Lost`.
  - **Distance Column:** Number formatted to 2 decimals (`X.XX km`) + subtle progress bar.
  - **Action Column:** Icon button (`Maximize2` / `MapPin`) with label *"Open Map"*.

### 3.2 Mobile & Small Screen View (`sm:hidden`)
- Transforms from a table into an ergonomic **Stacked Card List**:
  - Each vehicle is an independent card (`p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 active:bg-slate-800/80 cursor-pointer`).
  - Full card is an accessible tap target (`min-h-[48px]`).
  - Top row: Vehicle ID, Status pill, and Arrow/Map icon.
  - Bottom row: Distance badge (`📍 X.XX km`) with full-width progress bar.
  - Zero horizontal overflow.

---

## 4. Integration with `App.tsx`

- In `frontend/src/App.tsx`:
  - Add callback `handleOpenVehicleMap(vehicleId: string)`:
    ```typescript
    const handleOpenVehicleMap = (vehicleId: string) => {
      setSelectedVehicleId(vehicleId);
      setIsMapFullscreen(true);
    };
    ```
  - Mount `<DailyDistanceTable>` inside the main column (`lg:col-span-8`) right below the `<TelemetryHUD>`.

---

## 5. Verification & Testing Plan

1. **Automated Unit Tests (`DailyDistanceTable.test.tsx`):**
   - Renders empty state when no metrics or vehicles exist.
   - Renders vehicles with distance, status, and IDs.
   - Triggers `onOpenVehicleMap` when clicking a vehicle row or action button.
   - Sorts correctly when clicking sort toggle (highest distance first by default).
   - Responsive classes are present.
2. **Integration Tests (`App.test.tsx`):**
   - Clicking a vehicle row in the distance table selects the vehicle and enters fullscreen mode.
   - Exiting fullscreen returns to the dashboard with the table intact.
3. **Full Regression Suite:**
   - All existing 59 tests continue to pass (`npm test --prefix frontend -- --run`).
4. **Build Verification:**
   - `npm run build` succeeds without TypeScript or Vite errors.
