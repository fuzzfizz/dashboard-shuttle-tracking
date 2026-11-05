# Design Document: Unified Fleet Distance Analytics Card

**Date:** 2026-11-05  
**Topic:** Interactive Multi-View Fleet Distance Analytics Card for Shuttle Tracking Dashboard  
**Status:** Approved for Implementation (Layout Option A)  

---

## 1. Executive Summary & Goals

The faculty committee and system administrators require actionable insights into vehicle mileage, fleet utilization, and peak usage hours without cluttering the operational view.

This design introduces a **Unified Fleet Distance Analytics Card** (`FleetDistanceAnalyticsCard.tsx`) positioned directly between the Live Fleet Map and the Daily Distance Table (Layout Option A). It integrates executive KPI stat counters with an interactive tab switcher toggling between three analytical chart views:
1. **By Vehicle Comparison (Bar Chart):** Compares today's distance across each shuttle with a fleet average benchmark.
2. **7-Day Trend (Area / Line Chart):** Displays daily cumulative mileage over the past week for weekly reporting.
3. **Hourly Activity (Bar Distribution):** Highlights peak operational hours throughout the day (06:00 – 20:00).

All charts are implemented using **pure responsive React SVG with Tailwind CSS**, ensuring zero bundle overhead, instantaneous rendering, native dark mode support, and seamless Vitest testability.

---

## 2. Layout & Information Architecture

### 2.1 Placement in Dashboard (`App.tsx`)

In the primary dashboard view (`activeTab === 'today'`), the vertical flow is:
```
1. Top Navigation Bar (Header)
2. Live Fleet Map Card (`ShuttleMap`)
3. 📊 Fleet Distance Analytics Card (`FleetDistanceAnalyticsCard`) [NEW]
4. Daily Distance & Vehicle Table (`DailyDistanceTable`)
```

### 2.2 Card Layout & Visual Hierarchy

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 📊 สถิติและกราฟวิเคราะห์การเดินรถ (Fleet Mileage Analytics)              [ ⛶ ขยาย / ย่อ ]│
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. KPI Stat Cards (4 columns on desktop, 2x2 grid on mobile)                           │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐   │
│  │ ระยะทางรวมวันนี้   │ │ เฉลี่ยต่อคัน     │ │ คันที่วิ่งมากสุด │ │ เวลาวิ่งสะสมรวม  │   │
│  │ 128.5 km         │ │ 32.1 km/คัน      │ │ BUS-01 (45.2km)  │ │ 7 ชม. 30 นาที    │   │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘ └──────────────────┘   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 2. View Switcher Tabs (Segmented Control)                                              │
│  [ 🚗 เปรียบเทียบรายคัน ]   [ 📈 แนวโน้ม 7 วันย้อนหลัง ]   [ ⏰ กิจกรรมรายชั่วโมง ]    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 3. Active Chart View Canvas (Animated SVG, responsive viewBox)                         │
│                                                                                        │
│    - Tab 1: Horizontal bar chart per vehicle + Fleet Average dashed line               │
│    - Tab 2: Smooth area chart with gradient fill and data point tooltips               │
│    - Tab 3: Hourly distribution bars highlighting peak morning/afternoon commute       │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Component Specifications

### 3.1 KPI Highlights Row
Calculated directly from `dailyMetrics`:
* **Total Fleet Distance:** $\sum \text{total\_distance\_km}$ (km)
* **Fleet Average Distance:** $\frac{\text{Total Distance}}{\text{Active Vehicles Count}}$ (km/vehicle)
* **Top Vehicle:** Vehicle with the highest `total_distance_km` (e.g. `BUS-01 (48.5 km)`)
* **Total Active Time:** Sum of `active_minutes` formatted into `X ชม. Y นาที`

### 3.2 View 1: By Vehicle Comparison (`VehicleComparisonChart`)
* **Visual Form:** Horizontal Bar Chart.
* **X-Axis:** Distance (km).
* **Y-Axis:** Vehicle ID badge (`BUS-01`, `BUS-02`, ...).
* **Benchmark Guideline:** A vertical dashed line marking the **Fleet Average**, allowing immediate detection of underutilized or overworked shuttles.
* **Styling:** Emerald gradient bars with rounded corners, dark mode adaptive colors.

### 3.3 View 2: 7-Day Trend (`Trend7DayChart`)
* **Visual Form:** Smooth SVG Area Chart with subtle gradient fill and bold stroke line.
* **X-Axis:** Date labels (past 7 days, e.g. `29 ต.ค.`, `30 ต.ค.`, ..., `วันนี้`).
* **Y-Axis:** Total Fleet Distance in km.
* **Data Source:** Fetches historical daily sums from `daily_vehicle_metrics` in Supabase; falls back to simulated/available metric days when running locally or unconfigured.

### 3.4 View 3: Hourly Activity Distribution (`HourlyActivityChart`)
* **Visual Form:** Vertical Bar Chart.
* **X-Axis:** Operating hours (`06:00` to `20:00`).
* **Y-Axis:** Distance run (km) or activity intensity during that hour.
* **Visual Feedback:** Morning peak (`07:00–09:00`) and Evening peak (`16:00–18:00`) bars highlighted in accent colors (Amber/Emerald) to reflect university transit demand.

---

## 4. Technical Implementation & Data Flow

### 4.1 Props & Interfaces
```typescript
export interface FleetDistanceAnalyticsCardProps {
  dailyMetrics: DailyMetricsMap;
  vehicles: FleetMap;
  lastSeenMap: Record<string, number>;
  now?: number;
  className?: string;
  defaultTab?: 'vehicles' | 'trend7d' | 'hourly';
}
```

### 4.2 Data Fetching & State
* Hook: `useFleetAnalyticsData(dailyMetrics, vehicles, now)`:
  * In-memory memoized computation for KPI stats and today's vehicle comparisons.
  * Async query for the past 7 days from `daily_vehicle_metrics` table via Supabase client.
* Local UI State:
  * `activeTab: 'vehicles' | 'trend7d' | 'hourly'`
  * `isCollapsed: boolean` (allowing users to minimize the card if they only want to see the table below)

---

## 5. Mobile Ergonomics & Responsive Behavior

* **360px – 640px (Mobile):**
  * KPI row wraps into a 2x2 grid with `p-3` and legible `text-sm`/`text-base` numbers.
  * View Switcher buttons use compact icon + short text (`รายคัน`, `7 วัน`, `รายชั่วโมง`) with `min-h-[42px]` tap targets.
  * SVG charts dynamically scale with `viewBox="0 0 500 240"` and `w-full h-auto`.
* **641px – 1024px (Tablet):**
  * 4 KPI cards in a single row.
* **1025px+ (Desktop):**
  * Full width with expansive padding and subtle backdrop blur.

---

## 6. Testing & Quality Assurance

* **Unit Tests (`FleetDistanceAnalyticsCard.test.tsx`):**
  * Renders 4 KPI cards with correct math (sum, average, top vehicle).
  * Switches between the 3 tabs on click, verifying that the appropriate chart elements and labels render.
  * Toggles collapsed and expanded states smoothly.
  * Renders empty state gracefully when no vehicles have recorded distance yet.
* **Integration Tests (`App.test.tsx`):**
  * Verifies that the analytics card renders between the map and the daily distance table.
* **Regression Protection:**
  * All 175 existing tests continue to pass with 0 regressions.
