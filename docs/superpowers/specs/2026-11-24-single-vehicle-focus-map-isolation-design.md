# Design Document: Single Vehicle Focus Map Isolation & Fleet Overview Mode

**Date:** 2026-11-24  
**Topic:** Isolate Map Marker View During Single Vehicle Focus (แสดงเฉพาะคันที่เลือกเมื่อดูรายคัน และแสดงทุกคันในโหมดภาพรวม)  
**Status:** Approved for Implementation  

---

## 1. Executive Summary & Problem Statement

Currently, when a user selects a vehicle to focus on (either by clicking a vehicle marker on the map, clicking "เปิดแผนที่" from `DailyDistanceTable`, or selecting from the vehicle list), all other active fleet vehicles remain fully rendered on the map.

### Problem:
- When tracking a specific shuttle, showing every other vehicle causes visual clutter (especially in busy pickup zones, stations, or when vehicles pass each other).
- For passengers and operators monitoring a specific vehicle, they need high cognitive focus on that target vehicle's position, heading, and route path without distraction.
- When no vehicle is selected (or when returning to overview), the user expects to see the entire active fleet at a glance.

### Solution:
- **Focus Mode (`selectedVehicleId !== null`):** Filter map markers so **only** the selected vehicle is rendered on the map. All other vehicles are hidden.
- **Fleet Overview Mode (`selectedVehicleId === null`):** Render **all** active vehicles across the map with auto-bounds framing.
- **Seamless Navigation:** Ensure users can conveniently return to Overview Mode from both Fullscreen mode and Inline Dashboard mode with clear, accessible UI controls.

---

## 2. UI/UX Specifications

### 2.1 Fleet Overview Mode (`selectedVehicleId === null`)
- **Map Markers:** Render all active vehicles in `effectiveVehicles`.
- **Camera Auto Controller:** Automatically frames all active vehicles using `map.fitBounds` with comfortable padding.
- **Recenter Control:** Button at bottom-right displays `จัดมุมมองรถทั้งหมด (X คัน)` or `รีเซ็ตมุมมอง`.
- **Top Bar / Dashboard Header:** Shows fleet summary (e.g. `ออนไลน์ X คัน / ทั้งหมด Y คัน`).

### 2.2 Single Vehicle Focus Mode (`selectedVehicleId !== null`)
- **Map Markers:** Filter rendered markers to **only** the vehicle matching `selectedVehicleId`. All other vehicle markers are not rendered.
- **Camera Auto Controller:** Automatically pans smoothly and tracks the selected vehicle (`map.panTo` synchronized with telemetry updates).
- **Recenter Control:** Button at bottom-right displays `กลับสู่ตำแหน่งรถ` (recentering directly to the selected vehicle's position).
- **Trip & Route Paths:** Display planned route and breadcrumb path for the selected vehicle only.

### 2.3 Returning to Overview Mode
1. **In Fullscreen Mode (`isMapFullscreen === true`):**
   - Top Bar contains existing button `ดูรถทั้งหมด` which calls `setSelectedVehicleId(null)`.
   - Bottom `TelemetryHUD` contains close button `onClose` which calls `setSelectedVehicleId(null)`.
2. **In Inline Dashboard Mode (`isMapFullscreen === false`):**
   - In the card header of `แผนที่ตำแหน่งรถสด (Fleet Live Map)`, when `selectedVehicleId` is active, display a badge/button:
     - `กำลังติดตาม [vehicle_id]` with a quick dismiss/reset button `✕ ดูรถทั้งหมด` (calls `setSelectedVehicleId(null)`).
     - Allows instant return to fleet overview without entering fullscreen mode.

### 2.4 Fallback & Guard Handling
- If `selectedVehicleId` is set but the vehicle has no GPS telemetry recorded yet:
  - Display the existing amber toast: `"No GPS coordinates recorded for {vehicleId} yet. Showing map overview."`
  - Fall back to rendering the general vehicle fleet list so the user is not left with a blank map.

---

## 3. Architecture & Code Changes

### 3.1 `frontend/src/components/ShuttleMap.tsx`
Derive `displayedVehicles` to pass into `.map(...)`:
```tsx
const displayedVehicles = useMemo(() => {
  if (selectedVehicleId && effectiveVehicles[selectedVehicleId]) {
    return [effectiveVehicles[selectedVehicleId]];
  }
  return vehicleList;
}, [selectedVehicleId, effectiveVehicles, vehicleList]);
```
Iterate over `displayedVehicles` when rendering `AnimatedVehicleMarker`.

### 3.2 `frontend/src/App.tsx`
- In the inline map header (`!isMapFullscreen` section):
  - When `selectedVehicleId` is set, render a sleek focus indicator with a clear button:
    ```tsx
    {selectedVehicleId && (
      <button
        onClick={() => setSelectedVehicleId(null)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 dark:text-emerald-300 dark:border-emerald-800 text-xs font-medium transition-colors"
        title="กลับสู่มุมมองรถทั้งหมด"
      >
        <span>กำลังดู: {selectedVehicleId}</span>
        <span className="text-[10px] bg-emerald-200/60 dark:bg-emerald-800/60 px-1 py-0.5 rounded">✕ ดูรถทั้งหมด</span>
      </button>
    )}
    ```

---

## 4. Test & Verification Plan

1. **Unit Tests in `ShuttleMap.test.tsx`:**
   - Verify that when `selectedVehicleId` is `null`, all vehicles are rendered.
   - Verify that when `selectedVehicleId` is `'EV-01'`, only `'EV-01'` marker is rendered in the DOM, and `'EV-02'` is not rendered.
   - Verify that when `selectedVehicleId` points to an unknown ID, it falls back to rendering all vehicles or showing the missing notification without crashing.
2. **Integration Tests in `App.test.tsx`:**
   - Verify clicking "เปิดแผนที่" or selecting a vehicle focuses that vehicle and provides a button to return to overview.
   - Verify clicking "ดูรถทั้งหมด" resets `selectedVehicleId` to `null` and shows all vehicles again.
3. **Full Suite Regression:**
   - Run `npm test` across all 38 test suites to verify 0 regressions.
