# Historical Trip Replay 14-Day Retention & Compact-Fullscreen Parity Design Spec

**Date:** 2026-11-26  
**Status:** Approved  
**Author:** Antigravity Pairing Assistant & User  

---

## 1. Overview & Problem Statement

### 1.1 Problem 1: Unrestricted Date Selection vs. 14-Day Telemetry Retention
In production IoT tracking, high-frequency GPS pinging (every 2–5 seconds) produces millions of database rows per month. A 14-day data retention policy is enforced on raw `telemetry_logs`. Currently, `ReplayToolbar` only caps the future date (`max={maxDate}`), allowing users to pick any past date arbitrarily. When users pick dates older than 14 days, the query returns empty results, leaving users confused about whether no trips ran or data expired.

### 1.2 Problem 2: Layout Inconsistency (Missing Compact/Fullscreen Parity)
On the live dashboard (`activeTab === 'today'`), users have an integrated compact dashboard experience: a structured map card with title, stats, and a **"ขยายเต็มจอ" (Maximize)** button, alongside metric cards. In contrast, the historical replay view immediately occupies the entire viewport height (`h-[calc(100vh-4rem)]`), forcing a full-bleed map without the organized dashboard structure or an explicit compact/fullscreen toggle.

---

## 2. Goals & Success Criteria

1. **14-Day Retention Boundary**:
   - Enforce `min={minDate}` (14 days ago Bangkok time) and `max={today}` on the date input.
   - Provide a clear retention badge: `"เก็บบันทึกย้อนหลัง 14 วัน"`.
2. **Quick Date Navigation Controls**:
   - `[ ◀ วันก่อนหน้า ]`: Decrement date by 1 day (disabled when at 14 days ago).
   - `[ วันถัดไป ▶ ]`: Increment date by 1 day (disabled when at today).
   - Preset pills: `[ วันนี้ ]` and `[ เมื่อวาน ]` for 1-click jumps.
3. **Informative Empty State**:
   - When no points exist for a vehicle on a selected date, clearly state: `"ไม่พบบันทึกการเดินทางของรถ [ทะเบียน] ในวันที่ [วันที่] (ระบบจัดเก็บบันทึกย้อนหลัง 14 วัน)"`.
4. **Dashboard Layout Parity with Live View**:
   - Default to a structured **Compact Dashboard Mode** with:
     - Top Toolbar with date/vehicle selectors and 4 metric summary cards (Total Distance, Max Speed, Avg Speed, Data Points).
     - Compact Replay Map Card (`h-[380px] sm:h-[480px] lg:h-[580px] xl:h-[620px]`) with header and **"ขยายเต็มจอ" (Maximize)** button.
     - Integrated player controls.
   - Support **Fullscreen Mode** (`fixed inset-0 z-[1500]`):
     - Floating top control bar with title, vehicle/date info, and **"ออกจากเต็มจอ" (Esc)** button.
     - Floating bottom player bar with HUD and scrubber.
     - Keyboard shortcut `Escape` to exit fullscreen.

---

## 3. Architecture & Component Design

### 3.1 Date Utilities (`historicalDateUtils.ts`)
Add helper functions to calculate retention dates and day shifts in Bangkok timezone (`Asia/Bangkok`):
```typescript
/**
 * Returns YYYY-MM-DD for N days before today in Bangkok timezone.
 * Defaults to 14 days ago for production data retention.
 */
export function getBangkokMinRetentionDate(retentionDays: number = 14, now?: Date | number): string;

/**
 * Shifts a YYYY-MM-DD date string by a given number of days (+1 or -1).
 * Clamps result between minDate and maxDate.
 */
export function shiftBangkokDate(
  dateStr: string,
  deltaDays: number,
  minDate?: string,
  maxDate?: string
): string;
```

### 3.2 Enhanced ReplayToolbar (`ReplayToolbar.tsx`)
1. **Retention Constraints & Navigation**:
   - Compute `minDate = getBangkokMinRetentionDate(14)` and `maxDate = getBangkokDate()`.
   - Date picker `<input type="date" min={minDate} max={maxDate} value={selectedDate} />`.
   - Previous Day button: `<button disabled={selectedDate <= minDate} onClick={() => onDateChange(shiftBangkokDate(selectedDate, -1, minDate, maxDate))}>`.
   - Next Day button: `<button disabled={selectedDate >= maxDate} onClick={() => onDateChange(shiftBangkokDate(selectedDate, +1, minDate, maxDate))}>`.
   - Quick preset pills: `[ วันนี้ ]` (sets `selectedDate = maxDate`) and `[ เมื่อวาน ]` (sets `selectedDate = shiftBangkokDate(maxDate, -1)`).
   - Retention indicator label: `<span className="text-[11px] text-slate-400">บันทึกย้อนหลัง 14 วัน</span>`.
2. **Metric Summary Cards**:
   - **ระยะทางสะสม (Distance)**: `summary.total_distance_km.toFixed(2) km`
   - **ความเร็วสูงสุด (Max Speed)**: `summary.max_speed_kmh.toFixed(1) km/h`
   - **ความเร็วเฉลี่ย (Avg Speed)**: `summary.avg_speed_kmh.toFixed(1) km/h`
   - **จุดพิกัด (GPS Points)**: `summary.total_points` จุด

### 3.3 HistoricalTripReplay & Compact/Fullscreen Parity (`HistoricalTripReplay.tsx`)
1. **Fullscreen State**:
   - Maintain `isMapFullscreen` state (boolean, default `false`).
   - Listen for `Escape` keydown to exit fullscreen.
2. **Compact View (`!isMapFullscreen`)**:
   - Outer container: `w-full px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 flex flex-col gap-4 sm:gap-6`.
   - Render `ReplayToolbar` at the top with selectors and summary cards.
   - Render **Compact Replay Map Card**:
     - Header:
       - Left: Icon (`Bus`), Title (`แผนที่เส้นทางย้อนหลัง`), subtitle (`Historical Trip Replay`), vehicle plate badge, and point count badge.
       - Right: Button `ขยายเต็มจอ` with `Maximize2` icon.
     - Map Container: `h-[380px] sm:h-[480px] lg:h-[580px] xl:h-[620px] w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 shadow-xl relative`.
     - Docked `ReplayPlayerBar` positioned at bottom inside the map card with `absolute bottom-3 left-3 right-3 z-[1000]`.
3. **Fullscreen View (`isMapFullscreen === true`)**:
   - Map Container: `fixed inset-0 z-[1500] w-screen h-screen bg-slate-950 flex flex-col select-none overflow-hidden`.
   - Floating Top Bar:
     - Title + Vehicle Badge + Date String.
     - Button `ออกจากเต็มจอ` (`Minimize2` icon + `Esc` badge).
   - Floating Bottom `ReplayPlayerBar`:
     - Centered floating bar `md:max-w-4xl left-1/2 -translate-x-1/2`.
4. **Empty State Component**:
   - When `points.length === 0` and not loading:
     - Render clean card inside/overlaying the map:
       - Icon: `Route` with subtle pulse.
       - Title: `"ไม่พบประวัติการเดินทาง"`
       - Subtitle: `"รถ ${selectedVehicleId} ไม่มีการบันทึกพิกัดในวันที่ ${selectedDate} (ระบบจัดเก็บบันทึกย้อนหลัง 14 วัน)"`
       - Quick action: Button to switch to `[ ดูวันนี้ ]`.

---

## 4. Error Handling & Edge Cases

| Scenario | Expected Behavior |
|---|---|
| User types past date `< minDate` manually | Automatically clamp to `minDate` upon change/blur |
| User selects future date `> maxDate` | Automatically clamp to `maxDate` |
| Previous day button when at 14 days ago | Disabled (`opacity-40 cursor-not-allowed`) |
| Next day button when at today | Disabled (`opacity-40 cursor-not-allowed`) |
| Switching vehicles while replaying | Reset playback position to 0, load new points |
| Esc key in fullscreen | Exits fullscreen mode back to compact dashboard |
| Esc key in compact mode | No-op |

---

## 5. Testing & Verification Plan

1. **Unit Tests (`historicalDateUtils.test.ts`)**:
   - Test `getBangkokMinRetentionDate(14)` returns exactly 14 days before Bangkok today.
   - Test `shiftBangkokDate` handles boundary clamping at `minDate` and `maxDate`.
2. **Toolbar Component Tests (`ReplayToolbar.test.tsx`)**:
   - Verify `min` attribute is set to 14 days ago.
   - Verify `[ ◀ ]` and `[ ▶ ]` decrement and increment dates properly.
   - Verify disabled state when at `minDate` and `maxDate`.
   - Verify preset buttons `[ วันนี้ ]` and `[ เมื่อวาน ]`.
   - Verify summary metrics display correctly.
3. **Integration Tests (`HistoricalTripReplay.test.tsx` & `App.test.tsx`)**:
   - Verify compact layout renders with Maximize button.
   - Verify clicking Maximize toggles `isMapFullscreen` to true.
   - Verify `Escape` exits fullscreen mode.
   - Verify empty state message includes 14-day retention notice.
