# Hourly Activity Trend Chart & Interactive Hover Tooltip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the hourly activity section from a vertical bar chart into an SVG Area & Line trend graph with peak-hour backdrop zones and an interactive hover crosshair with floating tooltip card, and unify this hover tooltip experience across `Trend7DayChart`.

**Architecture:** 
1. Re-architect `HourlyActivityChart.tsx` as a pure SVG Area & Line chart using the standardized `500 x 180` viewBox matching `Trend7DayChart`.
2. Introduce translucent Amber backdrop zones for morning (07:00–09:00) and evening (16:00–18:00) rush hours, with color-accented data dots.
3. Build a high-precision pointer tracking engine (`onPointerMove`, `onTouchMove`, `onPointerLeave`) that snaps to the nearest hourly point, displaying an SVG vertical crosshair guideline, an active dot halo, and a high-contrast floating HTML tooltip card with bold distance and peak badges.
4. Unify `Trend7DayChart.tsx` with the identical pointer tracking and floating tooltip mechanism.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, SVG, Vitest, Testing Library.

## Global Constraints
- Preserve 100% backward compatibility with existing component props (`HourlyActivityChartProps`, `Trend7DayChartProps`, and `FleetDistanceAnalyticsCardProps`).
- Zero additional npm dependencies (built natively using SVG and React state).
- All 325+ tests across 38 test files must pass with zero regression.
- Seamless Dark and Light theme styling using Tailwind CSS dark classes.
- Responsive design with touch ergonomics on mobile (375px) and desktop (1280px).

---

### Task 1: Redesign `HourlyActivityChart.tsx` to SVG Area & Line Chart with Peak Hour Zones

**Files:**
- Modify: `frontend/src/components/charts/HourlyActivityChart.tsx`
- Modify: `frontend/src/components/charts/__tests__/FleetCharts.test.tsx`

**Interfaces:**
- Consumes:
  ```ts
  export interface HourlyActivityPoint {
    hour: number;
    hourLabel: string;
    intensity: number;
    distanceKm: number;
    isPeak: boolean;
  }
  export interface HourlyActivityChartProps {
    hours: HourlyActivityPoint[];
    selectedVehicleId?: string;
    vehicleLabel?: string;
  }
  ```
- Produces:
  - SVG Area & Line chart rendering inside `HourlyActivityChart` with `svg`, `path` (area and line), peak backdrop rects, and coordinate points.

- [ ] **Step 1: Update tests in `frontend/src/components/charts/__tests__/FleetCharts.test.tsx`**

Update the `HourlyActivityChart` tests to verify that it renders an SVG element, area/line paths, peak commute info, and hour labels:

```tsx
  it('renders HourlyActivityChart with SVG trend line, area, and peak commute zones', () => {
    const hours = [
      { hour: 7, hourLabel: '07:00', intensity: 0.9, distanceKm: 12.5, isPeak: true },
      { hour: 12, hourLabel: '12:00', intensity: 0.4, distanceKm: 4.2, isPeak: false },
      { hour: 17, hourLabel: '17:00', intensity: 0.8, distanceKm: 11.0, isPeak: true },
    ];
    const { container } = render(<HourlyActivityChart hours={hours} />);
    expect(screen.getByText('07:00')).toBeInTheDocument();
    expect(screen.getByText('12:00')).toBeInTheDocument();
    expect(screen.getByText('17:00')).toBeInTheDocument();
    expect(screen.getByText(/ช่วงเร่งด่วนเช้า/i)).toBeInTheDocument();

    // Verify SVG and path elements
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBeGreaterThanOrEqual(2); // Area path and line stroke path
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npx vitest run src/components/charts/__tests__/FleetCharts.test.tsx`
Expected: FAIL because `HourlyActivityChart` currently uses a CSS `div` grid without `<svg>` or `<path>`.

- [ ] **Step 3: Implement SVG Area & Line Chart in `HourlyActivityChart.tsx`**

Rewrite `frontend/src/components/charts/HourlyActivityChart.tsx`:

```tsx
import React from 'react';
import { HourlyActivityPoint } from '../../services/analyticsCalculator';

export interface HourlyActivityChartProps {
  hours: HourlyActivityPoint[];
  selectedVehicleId?: string;
  vehicleLabel?: string;
}

export const HourlyActivityChart: React.FC<HourlyActivityChartProps> = ({
  hours,
  selectedVehicleId,
  vehicleLabel,
}) => {
  if (hours.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs font-sans">
        ไม่มีข้อมูลความหนาแน่นรายชั่วโมง
      </div>
    );
  }

  const maxDist = Math.max(...hours.map((h) => h.distanceKm), 1);
  const chartWidth = 500;
  const chartHeight = 180;
  const paddingX = 40;
  const paddingTop = 25;
  const paddingBottom = 30;

  const innerWidth = chartWidth - paddingX * 2;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  const coords = hours.map((h, idx) => {
    const x = paddingX + (idx / Math.max(hours.length - 1, 1)) * innerWidth;
    const y = paddingTop + innerHeight - (h.distanceKm / maxDist) * innerHeight;
    return { x, y, h };
  });

  const linePath = coords.reduce(
    (acc, curr, idx) => (idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`),
    ''
  );

  const areaPath = `
    ${linePath}
    L ${coords[coords.length - 1].x} ${paddingTop + innerHeight}
    L ${coords[0].x} ${paddingTop + innerHeight}
    Z
  `;

  // Morning Peak (07:00 - 09:00, index 1 to 3 in 06:00-20:00 range)
  const mStartIdx = hours.findIndex((h) => h.hour === 7);
  const mEndIdx = hours.findIndex((h) => h.hour === 9);
  const morningPeakZone =
    mStartIdx !== -1 && mEndIdx !== -1
      ? {
          x: coords[mStartIdx].x - 6,
          width: coords[mEndIdx].x - coords[mStartIdx].x + 12,
        }
      : null;

  // Evening Peak (16:00 - 18:00, index 10 to 12 in 06:00-20:00 range)
  const eStartIdx = hours.findIndex((h) => h.hour === 16);
  const eEndIdx = hours.findIndex((h) => h.hour === 18);
  const eveningPeakZone =
    eStartIdx !== -1 && eEndIdx !== -1
      ? {
          x: coords[eStartIdx].x - 6,
          width: coords[eEndIdx].x - coords[eStartIdx].x + 12,
        }
      : null;

  const isVehicleSpecific = Boolean(selectedVehicleId && selectedVehicleId !== 'all');
  const subtitleLabel = isVehicleSpecific
    ? `แสดงความหนาแน่นการวิ่งของ ${vehicleLabel || selectedVehicleId}`
    : 'แสดงความหนาแน่นการวิ่งตลอดวัน';

  return (
    <div className="w-full overflow-hidden py-1">
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 mb-2 gap-2 font-sans">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
          <span>ช่วงเร่งด่วนเช้า (07:00–09:00) และเย็น (16:00–18:00)</span>
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-medium text-slate-400">
            {subtitleLabel}
          </span>
          <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
            สูงสุด: {maxDist.toFixed(1)} km
          </span>
        </div>
      </div>

      <div className="w-full relative">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto overflow-visible select-none"
        >
          <defs>
            <linearGradient id="hourlyAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Peak Hours Backdrop Zones */}
          {morningPeakZone && (
            <rect
              x={morningPeakZone.x}
              y={paddingTop - 4}
              width={morningPeakZone.width}
              height={innerHeight + 8}
              rx="6"
              className="fill-amber-500/10 dark:fill-amber-400/10 pointer-events-none"
            />
          )}
          {eveningPeakZone && (
            <rect
              x={eveningPeakZone.x}
              y={paddingTop - 4}
              width={eveningPeakZone.width}
              height={innerHeight + 8}
              rx="6"
              className="fill-amber-500/10 dark:fill-amber-400/10 pointer-events-none"
            />
          )}

          {/* Gridlines */}
          {[0, 0.5, 1].map((pct, idx) => {
            const y = paddingTop + innerHeight * (1 - pct);
            return (
              <g key={idx}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={chartWidth - paddingX}
                  y2={y}
                  stroke="currentColor"
                  strokeDasharray="4 4"
                  className="text-slate-200 dark:text-slate-800"
                  strokeWidth="1"
                />
                <text
                  x={paddingX - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="text-[9px] font-mono fill-slate-400 dark:fill-slate-500"
                >
                  {(maxDist * pct).toFixed(1)}k
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          <path d={areaPath} fill="url(#hourlyAreaGradient)" />

          {/* Line stroke */}
          <path
            d={linePath}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points and Labels */}
          {coords.map(({ x, y, h }, idx) => {
            const circleRadius = h.isPeak ? 4 : 3;
            // Show hour labels for every other hour or key points to avoid overlap
            const shouldShowLabel = idx % 2 === 0 || idx === coords.length - 1;

            return (
              <g key={h.hour}>
                <circle
                  cx={x}
                  cy={y}
                  r={circleRadius}
                  aria-label={`${h.hourLabel}: ${h.distanceKm.toFixed(1)} km`}
                  className={
                    h.isPeak
                      ? 'fill-amber-500 stroke-white dark:stroke-slate-900 stroke-2'
                      : 'fill-white dark:fill-slate-900 stroke-emerald-500 stroke-2'
                  }
                />
                {shouldShowLabel && (
                  <text
                    x={x}
                    y={chartHeight - 8}
                    textAnchor="middle"
                    className={`text-[9px] font-mono ${
                      h.isPeak
                        ? 'font-bold fill-amber-600 dark:fill-amber-400'
                        : 'fill-slate-400 dark:fill-slate-500'
                    }`}
                  >
                    {h.hourLabel}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend; npx vitest run src/components/charts/__tests__/FleetCharts.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/charts/HourlyActivityChart.tsx frontend/src/components/charts/__tests__/FleetCharts.test.tsx
git commit -m "feat(charts): convert HourlyActivityChart to SVG area and line trend graph"
```

---

### Task 2: Implement Interactive Hover Crosshair & Floating Tooltip in `HourlyActivityChart.tsx`

**Files:**
- Modify: `frontend/src/components/charts/HourlyActivityChart.tsx`
- Modify: `frontend/src/components/charts/__tests__/FleetCharts.test.tsx`

**Interfaces:**
- Consumes: `hours: HourlyActivityPoint[]`, `selectedVehicleId?: string`
- Produces:
  - Snaps to closest hourly coordinate upon `pointermove` or `touchmove`.
  - Displays vertical guideline crosshair `<line>`.
  - Displays expanded active circle dot.
  - Displays floating HTML tooltip card with time, distance (km), and rush-hour badge (`ช่วงเร่งด่วน`).

- [ ] **Step 1: Write interactive hover tests in `FleetCharts.test.tsx`**

Add unit tests for pointer movement and tooltip display:

```tsx
  it('displays interactive guideline and tooltip badge when hovered on HourlyActivityChart', () => {
    const hours = [
      { hour: 7, hourLabel: '07:00', intensity: 0.9, distanceKm: 12.5, isPeak: true },
      { hour: 8, hourLabel: '08:00', intensity: 1.0, distanceKm: 15.0, isPeak: true },
      { hour: 12, hourLabel: '12:00', intensity: 0.4, distanceKm: 4.2, isPeak: false },
    ];
    const { container } = render(<HourlyActivityChart hours={hours} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();

    // Trigger pointer move on SVG
    fireEvent.pointerMove(svg!, { clientX: 200, clientY: 50 });

    // Guideline line should appear
    expect(container.querySelector('[data-testid="hourly-guideline"]')).toBeInTheDocument();

    // Floating tooltip badge should show formatted distance
    const tooltip = container.querySelector('[data-testid="hourly-tooltip"]');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent(/km/);

    // Pointer leave should dismiss the tooltip
    fireEvent.pointerLeave(svg!);
    expect(container.querySelector('[data-testid="hourly-tooltip"]')).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npx vitest run src/components/charts/__tests__/FleetCharts.test.tsx`
Expected: FAIL because guideline and tooltip elements are not yet implemented.

- [ ] **Step 3: Implement Interactive Hover Scrubber & Tooltip in `HourlyActivityChart.tsx`**

Update `HourlyActivityChart.tsx` with pointer tracking, state, SVG crosshair, and HTML floating tooltip:

```tsx
  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);
  const svgRef = React.useRef<SVGSVGElement | null>(null);

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current || coords.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const svgX = ((e.clientX - rect.left) / rect.width) * chartWidth;

    let closest = 0;
    let minDist = Infinity;
    coords.forEach((c, idx) => {
      const d = Math.abs(c.x - svgX);
      if (d < minDist) {
        minDist = d;
        closest = idx;
      }
    });
    setHoveredIdx(closest);
  };

  const handlePointerLeave = () => {
    setHoveredIdx(null);
  };

  const activeCoord = hoveredIdx !== null && hoveredIdx >= 0 && hoveredIdx < coords.length ? coords[hoveredIdx] : null;
```

Render inside JSX:
```tsx
  {/* Guideline when hovering */}
  {activeCoord && (
    <line
      data-testid="hourly-guideline"
      x1={activeCoord.x}
      y1={paddingTop - 4}
      x2={activeCoord.x}
      y2={paddingTop + innerHeight}
      stroke="currentColor"
      strokeDasharray="3 3"
      className="text-slate-400 dark:text-slate-500 pointer-events-none"
      strokeWidth="1.5"
    />
  )}

  {/* Active Point Halo */}
  {activeCoord && (
    <g className="pointer-events-none">
      <circle
        cx={activeCoord.x}
        cy={activeCoord.y}
        r={9}
        className={
          activeCoord.h.isPeak
            ? 'fill-amber-500/20 stroke-amber-500/40'
            : 'fill-emerald-500/20 stroke-emerald-500/40'
        }
        strokeWidth="1.5"
      />
      <circle
        cx={activeCoord.x}
        cy={activeCoord.y}
        r={5.5}
        className={
          activeCoord.h.isPeak
            ? 'fill-amber-500 stroke-white dark:stroke-slate-900 stroke-2'
            : 'fill-emerald-500 stroke-white dark:stroke-slate-900 stroke-2'
        }
      />
    </g>
  )}
```

And floating tooltip overlay positioned in parent relative container:
```tsx
  {/* Floating Tooltip Card */}
  {activeCoord && (
    <div
      data-testid="hourly-tooltip"
      style={{
        left: `${(activeCoord.x / chartWidth) * 100}%`,
        top: `${Math.max(10, (activeCoord.y / chartHeight) * 100 - 18)}%`,
        transform: 'translate(-50%, -100%)',
      }}
      className="absolute pointer-events-none z-30 flex flex-col items-center bg-slate-900/95 dark:bg-slate-950/95 text-white border border-slate-700/60 rounded-xl px-3 py-1.5 shadow-xl transition-transform duration-75 backdrop-blur-xs min-w-[95px]"
    >
      <div className="flex items-center gap-1.5 text-[10px] text-slate-300 font-sans">
        <span>⏰</span>
        <span>{activeCoord.h.hourLabel} น.</span>
      </div>
      <div className="text-sm font-bold font-mono text-emerald-400 mt-0.5">
        {activeCoord.h.distanceKm.toFixed(1)} <span className="text-[10px] font-normal text-slate-300">km</span>
      </div>
      {activeCoord.h.isPeak && (
        <span className="mt-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/25 text-amber-300 border border-amber-400/30 whitespace-nowrap">
          🔥 {activeCoord.h.hour < 12 ? 'ช่วงเร่งด่วนเช้า' : 'ช่วงเร่งด่วนเย็น'}
        </span>
      )}
    </div>
  )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend; npx vitest run src/components/charts/__tests__/FleetCharts.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/charts/HourlyActivityChart.tsx frontend/src/components/charts/__tests__/FleetCharts.test.tsx
git commit -m "feat(charts): add interactive crosshair guideline and floating tooltip to HourlyActivityChart"
```

---

### Task 3: Unify Interactive Hover Tooltip in `Trend7DayChart.tsx`

**Files:**
- Modify: `frontend/src/components/charts/Trend7DayChart.tsx`
- Modify: `frontend/src/components/charts/__tests__/FleetCharts.test.tsx`

**Interfaces:**
- Consumes: `points: TrendDayPoint[]`, `selectedVehicleId?: string`, `vehicleLabel?: string`, `timeframe?: AnalyticsTimeframe`
- Produces:
  - Interactive pointer hover on `Trend7DayChart` with vertical crosshair guideline, active dot halo, and floating tooltip displaying day/month label and exact distance.

- [ ] **Step 1: Write interactive hover tests for `Trend7DayChart` in `FleetCharts.test.tsx`**

Add test:
```tsx
  it('displays interactive guideline and tooltip badge when hovered on Trend7DayChart', () => {
    const points = [
      { date: '2026-11-04', dayLabel: 'พฤ. 4', totalDistanceKm: 45.2, isToday: false },
      { date: '2026-11-05', dayLabel: 'วันนี้', totalDistanceKm: 78.6, isToday: true },
    ];
    const { container } = render(<Trend7DayChart points={points} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();

    fireEvent.pointerMove(svg!, { clientX: 250, clientY: 50 });

    expect(container.querySelector('[data-testid="trend-guideline"]')).toBeInTheDocument();
    const tooltip = container.querySelector('[data-testid="trend-tooltip"]');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent(/km/);

    fireEvent.pointerLeave(svg!);
    expect(container.querySelector('[data-testid="trend-tooltip"]')).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npx vitest run src/components/charts/__tests__/FleetCharts.test.tsx`
Expected: FAIL because guideline and tooltip are not yet present in `Trend7DayChart`.

- [ ] **Step 3: Implement Interactive Hover in `Trend7DayChart.tsx`**

Update `Trend7DayChart.tsx`:
1. Add `hoveredIdx` state and `svgRef`:
```tsx
  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);
  const svgRef = React.useRef<SVGSVGElement | null>(null);

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current || coords.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const svgX = ((e.clientX - rect.left) / rect.width) * chartWidth;

    let closest = 0;
    let minDist = Infinity;
    coords.forEach((c, idx) => {
      const d = Math.abs(c.x - svgX);
      if (d < minDist) {
        minDist = d;
        closest = idx;
      }
    });
    setHoveredIdx(closest);
  };

  const handlePointerLeave = () => {
    setHoveredIdx(null);
  };

  const activeCoord = hoveredIdx !== null && hoveredIdx >= 0 && hoveredIdx < coords.length ? coords[hoveredIdx] : null;
```

2. Render SVG crosshair guideline and active dot halo inside `<svg>`:
```tsx
  {activeCoord && (
    <line
      data-testid="trend-guideline"
      x1={activeCoord.x}
      y1={paddingTop - 4}
      x2={activeCoord.x}
      y2={paddingTop + innerHeight}
      stroke="currentColor"
      strokeDasharray="3 3"
      className="text-slate-400 dark:text-slate-500 pointer-events-none"
      strokeWidth="1.5"
    />
  )}

  {activeCoord && (
    <g className="pointer-events-none">
      <circle
        cx={activeCoord.x}
        cy={activeCoord.y}
        r={9}
        className="fill-emerald-500/20 stroke-emerald-500/40"
        strokeWidth="1.5"
      />
      <circle
        cx={activeCoord.x}
        cy={activeCoord.y}
        r={6}
        className="fill-emerald-500 stroke-white dark:stroke-slate-900 stroke-2"
      />
    </g>
  )}
```

3. Render HTML floating tooltip card in container:
```tsx
  {activeCoord && (
    <div
      data-testid="trend-tooltip"
      style={{
        left: `${(activeCoord.x / chartWidth) * 100}%`,
        top: `${Math.max(10, (activeCoord.y / chartHeight) * 100 - 18)}%`,
        transform: 'translate(-50%, -100%)',
      }}
      className="absolute pointer-events-none z-30 flex flex-col items-center bg-slate-900/95 dark:bg-slate-950/95 text-white border border-slate-700/60 rounded-xl px-3 py-1.5 shadow-xl transition-transform duration-75 backdrop-blur-xs min-w-[95px]"
    >
      <div className="flex items-center gap-1.5 text-[10px] text-slate-300 font-sans">
        <span>📅</span>
        <span>{activeCoord.p.dayLabel}</span>
      </div>
      <div className="text-sm font-bold font-mono text-emerald-400 mt-0.5">
        {activeCoord.p.totalDistanceKm.toFixed(1)} <span className="text-[10px] font-normal text-slate-300">km</span>
      </div>
      {activeCoord.p.isToday && (
        <span className="mt-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/25 text-emerald-300 border border-emerald-400/30 whitespace-nowrap">
          วันนี้
        </span>
      )}
    </div>
  )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend; npx vitest run src/components/charts/__tests__/FleetCharts.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/charts/Trend7DayChart.tsx frontend/src/components/charts/__tests__/FleetCharts.test.tsx
git commit -m "feat(charts): add interactive crosshair guideline and floating tooltip to Trend7DayChart"
```

---

### Task 4: Full Suite Regression Verification & Production Build

**Files:**
- None (Verification step across whole codebase)

- [ ] **Step 1: Run full test suite across entire project**

Run: `cd frontend; npm test -- --run`
Expected: 38 test files, 327+ tests passing with 0 failures.

- [ ] **Step 2: Run production build**

Run: `cd frontend; npm run build`
Expected: Build succeeds with 0 TypeScript or bundling errors.

- [ ] **Step 3: Commit any final integration adjustments**

If any adjustments were made:
```bash
git add -A
git commit -m "chore: verify full test suite and production build"
```
