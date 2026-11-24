# Design Spec: UI Typography & Copywriting Cleanup

**Date:** 2026-11-24  
**Status:** Approved  
**Topic:** Clean, Concise Copywriting & Readable Typography Scale-Up  

---

## 1. Background & Problem Statement

Currently, multiple components in the dashboard use micro-sized typography (e.g., `text-[9px]`, `text-[10px]`, `text-[11px]`) across table headers, cell values, metadata, and status badges. In addition, many labels contain redundant bilingual text in parentheses (such as `(Connected)`, `(Search vehicle)`, `(Daily Distance Overview)`, `(Clear filters)`), and technical jargon like `Broker: connected`.

This creates visual clutter, reduces scanning speed for fleet operators, and makes key operational metrics (vehicle ID, distance, status) hard to read without squinting.

---

## 2. Goals & Non-Goals

### Goals
- **Readable Typography:** Scale up micro-fonts across the dashboard to standard accessible sizes (minimum `text-xs` 12px for secondary metadata, `text-sm` 14px for table cells/badges, and `text-base` 16px+ for primary metrics).
- **Concise Copywriting:** Eliminate redundant English parenthetical translations and verbose descriptions. Use direct, clear Thai labels.
- **Enhanced Hierarchy:** Increase visual contrast and font-weight distinction between primary vehicle identity/metrics and secondary timestamps/units.
- **Zero Layout Breakage:** Maintain seamless responsiveness across desktop, tablet, and mobile (375px) without text clipping or horizontal overflow.
- **100% Test Pass Rate:** Update existing Vitest suites to reflect revised text and ensure all 38 test suites pass without regression.

### Non-Goals
- Altering underlying routing, telemetry, or distance calculation logic.
- Redesigning the entire application layout structure or changing color palettes.

---

## 3. Typography Scale & Size Mapping

| Element Type | Old Class | New Class | Pixel Equivalent | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Micro Labels / Subtext** | `text-[9px]`, `text-[10px]` | `text-xs` | 12px | Relative time, axis labels, badges |
| **Table Headers / Minor Metadata**| `text-[10px]`, `text-[11px]` | `text-xs font-semibold` | 12px | Column headers, filter toolbars |
| **Table Cell Body / List Items** | `text-xs` (12px) | `text-sm` | 14px | General text, status text |
| **License Plate Badges** | `text-xs` (12px) | `text-sm font-black` | 14px | Vehicle identifiers (`EV-01`, `shuttle-01`) |
| **Key Metrics (Distance, Speed)** | `text-xs`, `text-sm` | `text-base` to `text-lg font-bold font-mono` | 16px - 18px | Distance numbers, speed values |

---

## 4. Component-by-Component Specifications

### 4.1 Header & Overview (`App.tsx`)
- **Title:** Change from `ภาพรวมระบบติดตามรถรับส่ง` + `Fleet Live Tracking & Daily Operations` + `อัปเดตสดจากระบบ Telemetry` to:
  - Title: **`ระบบติดตามรถรับส่ง`**
  - Subtitle: **`ติดตามตำแหน่งและระยะทางแบบเรียลไทม์`**
- **Fleet Status Pills:**
  - `ออนไลน์ X คัน` ➔ `ออนไลน์ X`
  - `ขาดสัญญาณ X คัน` (clear, concise status)

### 4.2 Daily Distance Table (`DailyDistanceTable.tsx`)
- **Header:**
  - Remove `Daily Distance Overview` from heading ➔ Title: **`ระยะทางประจำวัน`**
  - Subtitle: **`ระยะทางสะสมรายคันวันนี้`**
- **Search Bar:**
  - Placeholder: `ค้นหาหมายเลขรถ...` (Remove `(Search vehicle)`)
- **Empty State Action:**
  - Button text: `ล้างตัวกรอง` (Remove `(Clear filters)`)
- **License Plate Badge (`LicensePlateBadge`):**
  - Scale up font from `text-xs` to `text-sm font-black tracking-wider`.
- **Status Column:**
  - Status labels: `ออนไลน์` (green) / `ขาดสัญญาณ` (red) (Remove `(Connected)` / `(Signal Lost)`).
  - Text size: `text-sm font-medium`.
- **Distance Column:**
  - Font size: `text-sm sm:text-base font-bold font-mono text-slate-850 dark:text-slate-100`.
- **Last Seen Column:**
  - Main text: `text-xs sm:text-sm font-semibold`.
  - Sub text (e.g. `เมื่อสักครู่`): scaled from `text-[10px]` to `text-xs`.
- **Mobile Card View (`Mobile Vehicle Card`):**
  - Metric box titles: `text-xs text-slate-500 font-medium`.
  - Metric values: `text-base font-bold font-mono text-emerald-600 dark:text-emerald-400`.
  - Open map button: `text-sm font-semibold py-2.5`.

### 4.3 Telemetry HUD (`TelemetryHUD.tsx`)
- **Vehicle Status State:**
  - `Signal Lost / ขาดการเชื่อมต่อ` ➔ **`ขาดสัญญาณ`**
  - `Moving / กำลังวิ่ง` ➔ **`กำลังวิ่ง`**
  - `Stopped / จอดพัก` ➔ **`จอดพัก`**
  - `Broker: connected` ➔ **`เชื่อมต่อระบบแล้ว`** (Remove technical broker term)
- **HUD Metric Cards:**
  - Primary metrics (speed, distance): `text-sm sm:text-base font-bold font-mono`.
  - Metric labels: `text-xs text-slate-500`.

### 4.4 Analytics & Charts (`FleetDistanceAnalyticsCard.tsx` & Charts)
- **Header:**
  - Heading: `สถิติระยะทางวิ่ง` (Remove `Fleet Distance Analytics`)
  - Subheading: `เปรียบเทียบระยะทางและแนวโน้มการใช้งานของกองรถ`
- **Timeframe Selector:**
  - Button font: `text-xs sm:text-sm font-semibold px-3 py-1.5`.
- **Tab Buttons:**
  - Tab 1: `เปรียบเทียบรายคัน`
  - Tab 2: Dynamic tab name (`รายชั่วโมง`, `แนวโน้ม 7 วัน`, `แนวโน้ม 30 วัน`, `แนวโน้ม 12 เดือน`)
- **Chart Subtitles & Axes (`Trend7DayChart.tsx`, `HourlyActivityChart.tsx`, `VehicleComparisonChart.tsx`):**
  - Axis tick labels: increase from `text-[9px]` to `text-[10px]` / `text-xs font-mono`.
  - Chart legends: `text-xs` with clean contrast.

---

## 5. Testing & Verification Plan

1. **Vitest Unit & Integration Suites:**
   - Update text matcher regexes in:
     - `App.test.tsx` (e.g. heading `Daily Distance Overview` -> `ระยะทางประจำวัน`)
     - `DailyDistanceTable.test.tsx` (search placeholder, clear filters, status labels)
     - `TelemetryHUD.test.tsx` (status labels without English suffixes)
     - `FleetDistanceAnalyticsCard.test.tsx` (card header text)
     - `MobileResponsive.test.tsx` (mobile card checks)
   - Ensure all 38 test suites (339+ tests) pass 100%.
2. **Production Build:**
   - Verify TypeScript compiles without type errors (`tsc && vite build`).
3. **Responsive Verification:**
   - Verify that 375px mobile breakpoint does not trigger horizontal scroll or badge clipping.
