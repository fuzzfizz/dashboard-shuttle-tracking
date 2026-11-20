# Design Document: Hourly Activity Trend Chart & Interactive Tooltip

**Date:** 2026-11-20  
**Topic:** Redesign of Hourly Activity Chart to SVG Area/Line Trend Graph with Interactive Hover Tooltip  
**Status:** Approved for Implementation (Option 1: SVG Area & Line Chart with Peak Zones and Interactive Crosshair Tooltip)  

---

## 1. Executive Summary & Goals

In the current dashboard, when the timeframe is set to **"วันนี้" (Today)**, Tab 2 displays the **Hourly Activity** (`HourlyActivityChart.tsx`) using a vertical CSS bar grid (`div` columns for 06:00–20:00). Meanwhile, for **"สัปดาห์" (Week)**, **"เดือน" (Month)**, and **"ปี" (Year)**, Tab 2 displays an SVG Area & Line chart (`Trend7DayChart.tsx`).

### Core Pain Points:
1. **Inconsistent Visual Language:** The bar format in the "Today" tab feels disconnected from the sleek, continuous SVG trend lines used in the other timeframes.
2. **Readability on Hover:** The current hourly bar chart only shows small, basic hover tooltips without prominent typography, making it difficult for operators to inspect exact mileage at a glance.
3. **Trend Visualization:** Shuttle operation density naturally forms a continuous flow (morning rush, midday plateau, evening rush). An Area/Line trend graph represents this flow much more intuitively.

### Objectives:
1. **Redesign `HourlyActivityChart` as an SVG Area & Line Chart:** Harmonize with `Trend7DayChart` using matching canvas dimensions (`500 x 180`), responsive scaling, and an emerald area gradient (`#10b981`).
2. **Preserve & Enhance Peak Hours Distinction:** Display translucent Amber vertical backdrop zones (`#f59e0b` at ~10–12% opacity) behind peak hours (07:00–09:00 and 16:00–18:00), with amber highlighted data dots on the line.
3. **Interactive Hover Crosshair & Floating Tooltip:** When hovering or dragging across the chart (desktop and mobile touch), show a vertical guideline, focused active dot, and a high-contrast floating tooltip badge with large, bold mileage numbers and rush-hour badges.
4. **Unified Hover UX:** Extend the same interactive hover tooltip architecture to `Trend7DayChart.tsx` so both charts share a seamless, polished experience.

---

## 2. Visual Architecture & Layout

### 2.1 Chart Canvas & SVG Structure

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 🕒 ช่วงเร่งด่วนเช้า (07:00–09:00) และเย็น (16:00–18:00)       แสดงความหนาแน่นการวิ่ง... │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  SVG ViewBox (0 0 500 180)                                                             │
│                                                                                        │
│   Y-Axis       [Peak Morning Zone]               [Peak Evening Zone]                   │
│   (km)         ┌─────────────────┐               ┌─────────────────┐                   │
│   15k ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─│ (Dashed Grid)
│                │      ● (14.2 km)│               │      ● (12.8 km)│                   │
│   10k ─ ─ ─ ─ ─│─ ─ ─/───\─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─/───\─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─│
│               /│    /     \      │  Hover Card   │    /     \      │                   │
│    5k ─ ─ ─ ─/─│───/─ ─ ─ ─\─ ─ ─│─ ─┌─────────┐─│───/─ ─ ─ ─\─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─│
│             /  │  /         \    │  │08:00     │ │  /         \    │                   │
│            /   │ /   Area    \   │  │14.2 km   │ │ /           \   │                   │
│    0k ────●────┴──────────────●──┴──│🔥 เร่งด่วน│─┴─────────────●───┴───────────────────│
│          06:00   07:00  08:00  09:00 └─────────┘    16:00 17:00 18:00  19:00 20:00     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Visual Elements Spec
- **Container:** `w-full overflow-hidden py-1 relative select-none`
- **ViewBox:** `0 0 500 180` with `paddingX = 40`, `paddingTop = 25`, `paddingBottom = 30`.
- **Peak Hour Backdrop Zones:**
  - Morning Peak: Rect covering X coordinates from 07:00 to 09:00, Y from `paddingTop` to `paddingTop + innerHeight`, `fill="#f59e0b" fillOpacity="0.10" rx="4"`.
  - Evening Peak: Rect covering X coordinates from 16:00 to 18:00, `fill="#f59e0b" fillOpacity="0.10" rx="4"`.
- **Area Fill:** `<linearGradient id="hourlyAreaGradient">` from `#10b981` (opacity 0.4) to `#10b981` (opacity 0.0).
- **Line Stroke:** `#10b981`, `strokeWidth="2.5"`, `strokeLinecap="round"`, `strokeLinejoin="round"`.
- **Data Dots:**
  - Normal Hours: `r=3.5`, `stroke="#10b981"`, fill matching background (`fill-white dark:fill-slate-900`).
  - Peak Hours: `r=4`, `stroke="#f59e0b"`, `fill="#f59e0b"`.
  - Active (Hovered) Dot: `r=6`, with outer pulsing ring (`r=9`, `stroke="#10b981"` or `#f59e0b`, `strokeOpacity="0.3"`).

---

## 3. Interactive Hover & Tooltip Architecture

### 3.1 State Management & Pointer Tracking
```typescript
const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
```
- **Track Interaction:** Use `onPointerMove` and `onTouchMove` attached to the SVG container.
- **Coord-to-Index Mapping:**
  ```typescript
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX;
    const svgX = ((clientX - rect.left) / rect.width) * chartWidth;
    
    // Find closest data point along the X axis
    let closestIdx = 0;
    let minDist = Infinity;
    coords.forEach((c, idx) => {
      const d = Math.abs(c.x - svgX);
      if (d < minDist) {
        minDist = d;
        closestIdx = idx;
      }
    });
    setHoveredIndex(closestIdx);
  };

  const handlePointerLeave = () => {
    setHoveredIndex(null);
  };
  ```

### 3.2 Floating Tooltip Positioning & Content
To guarantee smooth rendering and sharp fonts without SVG text scaling distortions, the tooltip card can be rendered as an absolute-positioned HTML container over the SVG:
- **Positioning:**
  - `left: ${pctX}%`, clamped to ensure it stays within bounds (e.g. `transform: translate(-50%, -100%)`).
  - `top: ${hoveredCoord.y - 12}px` (or pinned to top when near ceiling).
- **Card Content:**
  - **Header:** Time label (e.g., `08:00 น.`) in `text-xs text-slate-400 dark:text-slate-400 font-sans`.
  - **Value:** `14.2 km` in `text-base font-bold font-mono text-emerald-600 dark:text-emerald-400`.
  - **Peak Badge:** If `isPeak === true`, render badge:
    `🔥 ช่วงเร่งด่วนเช้า` (for 07:00–09:00) or `🔥 ช่วงเร่งด่วนเย็น` (for 16:00–18:00).
- **Crosshair Line:**
  - SVG `<line x1={hovered.x} y1={paddingTop} x2={hovered.x} y2={paddingTop + innerHeight} strokeDasharray="3 3" className="stroke-slate-300 dark:stroke-slate-600" strokeWidth="1.5" />`

---

## 4. Unification with `Trend7DayChart`

To give the entire dashboard a consistent, high-end feel:
- Apply the same pointer tracking and floating tooltip badge pattern to `Trend7DayChart.tsx`.
- In `Trend7DayChart`, the tooltip shows:
  - Date / Day label (e.g., `ศุกร์ที่ 20 พ.ย.` or `วันนี้`)
  - Distance: `85.4 km`
  - Relative indication or vehicle comparison note.

---

## 5. Testing & Verification Plan

### 5.1 Unit Tests (`frontend/src/components/charts/__tests__/FleetCharts.test.tsx`)
1. **Rendering Test:** Verify `HourlyActivityChart` renders SVG, path, peak hour zones, and hour labels (06:00, 12:00, 20:00).
2. **Hover Interaction Test:** Simulate pointer move on SVG container and assert that:
   - Guideline/crosshair is rendered.
   - Active tooltip element appears with the formatted distance (e.g., `12.5 km`) and time.
3. **Empty State Test:** Verify correct fallback message when `hours = []`.
4. **Trend7DayChart Test:** Verify existing tests pass and that the new hover tooltip works as expected.

### 5.2 Browser & Responsive Verification
- Verify layout on both mobile (375px) and desktop (1280px).
- Verify dark mode and light mode contrast.
- Run `npm test` and `npm run build` in `frontend` directory.
