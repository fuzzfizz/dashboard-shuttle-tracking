# UI Typography & Copywriting Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scale up micro-typography to standard readable font sizes (min 12px for subtext, 14px for body, 16px+ for key metrics) and streamline all bilingual redundant copy to clean, concise Thai labels across the dashboard.

**Architecture:** Update UI component styling via Tailwind classes across `App.tsx`, `TelemetryHUD.tsx`, `DailyDistanceTable.tsx`, and `FleetDistanceAnalyticsCard.tsx`, while updating corresponding Vitest matcher assertions.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest, Testing Library.

## Global Constraints

- Minimum font size: `text-xs` (12px) for any subtext/labels; no `text-[9px]` or `text-[10px]` in general text.
- No redundant English in parentheses (e.g. remove `(Connected)`, `(Search vehicle)`, `(Daily Distance Overview)`).
- Preserve 100% test pass rate across all 38 test suites.
- Preserve responsive layout without horizontal scroll on 375px mobile breakpoint.

---

### Task 1: Header & Telemetry HUD Copy & Typography Cleanup

**Files:**
- Modify: `frontend/src/App.tsx:160-240`
- Modify: `frontend/src/components/TelemetryHUD.tsx:70-130`
- Test: `frontend/src/__tests__/App.test.tsx`
- Test: `frontend/src/components/__tests__/TelemetryHUD.test.tsx`

**Interfaces:**
- Consumes: `ConnectionStatus`, `TelemetryPayload` from `frontend/src/types/telemetry.ts`
- Produces: Cleaner header labels (`ระบบติดตามรถรับส่ง`, `ติดตามตำแหน่งและระยะทางแบบเรียลไทม์`) and simplified HUD statuses (`กำลังวิ่ง`, `จอดพัก`, `ขาดสัญญาณ`, `เชื่อมต่อระบบแล้ว`).

- [ ] **Step 1: Write the updated test expectations in TelemetryHUD.test.tsx and App.test.tsx**

In `frontend/src/components/__tests__/TelemetryHUD.test.tsx`, update expectations to check for concise Thai text without English suffixes:
```tsx
// Moving status should show "กำลังวิ่ง" instead of "Moving / กำลังวิ่ง"
expect(screen.getByText('กำลังวิ่ง')).toBeInTheDocument();
// Stopped status should show "จอดพัก" instead of "Stopped / จอดพัก"
expect(screen.getByText('จอดพัก')).toBeInTheDocument();
// Disconnected status should show "ขาดสัญญาณ" instead of "Signal Lost / ขาดการเชื่อมต่อ"
expect(screen.getByText('ขาดสัญญาณ')).toBeInTheDocument();
// Overview status should show "เชื่อมต่อระบบแล้ว" instead of "Broker: connected"
expect(screen.getByText('เชื่อมต่อระบบแล้ว')).toBeInTheDocument();
```

In `frontend/src/__tests__/App.test.tsx`, update header heading expectations:
```tsx
expect(screen.getByText('ระบบติดตามรถรับส่ง')).toBeInTheDocument();
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test --prefix frontend -- src/components/__tests__/TelemetryHUD.test.tsx src/__tests__/App.test.tsx`
Expected: FAIL on changed text matchers.

- [ ] **Step 3: Implement concise copy and readable typography in TelemetryHUD.tsx and App.tsx**

In `frontend/src/App.tsx`:
- Change header title: `ระบบติดตามรถรับส่ง`
- Change header subtitle: `ติดตามตำแหน่งและระยะทางแบบเรียลไทม์`
- Fleet status pills: `ออนไลน์ {onlineCount}` and `ขาดสัญญาณ {offlineCount}` with `text-xs sm:text-sm font-semibold`.

In `frontend/src/components/TelemetryHUD.tsx`:
- Replace consumer vehicle status text:
  - `isOnline === false`: `<span className="text-rose-600 dark:text-rose-400 font-semibold">ขาดสัญญาณ</span>`
  - `isMoving`: `<span className="text-emerald-600 dark:text-emerald-400 font-semibold">กำลังวิ่ง</span>`
  - else: `<span className="text-slate-600 dark:text-slate-300 font-medium">จอดพัก</span>`
  - overview status: `<span className="text-xs sm:text-sm font-medium">เชื่อมต่อระบบแล้ว</span>`
- Scale up metrics: `text-sm sm:text-base font-bold font-mono` for numbers, `text-xs text-slate-500` for labels.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test --prefix frontend -- src/components/__tests__/TelemetryHUD.test.tsx src/__tests__/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add frontend/src/App.tsx frontend/src/components/TelemetryHUD.tsx frontend/src/__tests__/App.test.tsx frontend/src/components/__tests__/TelemetryHUD.test.tsx
git commit -m "refactor(hud): clean up header and telemetry hud copy and typography"
```

---

### Task 2: Daily Distance Table Typography & Copywriting Scale-Up

**Files:**
- Modify: `frontend/src/components/DailyDistanceTable.tsx`
- Test: `frontend/src/components/__tests__/DailyDistanceTable.test.tsx`
- Test: `frontend/src/components/__tests__/MobileResponsive.test.tsx`
- Test: `frontend/src/__tests__/App.test.tsx`

**Interfaces:**
- Consumes: `DailyDistanceTableProps`, `LicensePlateBadgeProps`
- Produces: Updated table title (`ระยะทางประจำวัน`), concise search placeholder (`ค้นหาหมายเลขรถ...`), enlarged license plate font (`text-sm font-black`), larger distance and status text.

- [ ] **Step 1: Update test matchers in DailyDistanceTable.test.tsx and MobileResponsive.test.tsx**

In `frontend/src/components/__tests__/DailyDistanceTable.test.tsx`:
- Update search placeholder matcher to `ค้นหาหมายเลขรถ...`
- Update table title matcher to `ระยะทางประจำวัน`
- Update status filter labels to concise text (`ออนไลน์`, `ขาดสัญญาณ`)
- Update empty search clear button to `ล้างตัวกรอง`

In `frontend/src/components/__tests__/MobileResponsive.test.tsx`:
- Update card text matchers to match `ระยะทางวันนี้` and `อัปเดตล่าสุด`.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test --prefix frontend -- src/components/__tests__/DailyDistanceTable.test.tsx src/components/__tests__/MobileResponsive.test.tsx`
Expected: FAIL on outdated text assertions.

- [ ] **Step 3: Implement clean copy and typography scale-up in DailyDistanceTable.tsx**

In `frontend/src/components/DailyDistanceTable.tsx`:
- `LicensePlateBadge`:
  - Change span font size: `text-sm font-black tracking-wider` (was `text-xs`).
- Header:
  - Heading: `ระยะทางประจำวัน` (remove `Daily Distance Overview`).
  - Subheading: `ระยะทางสะสมรายคันวันนี้` (`text-xs sm:text-sm`).
- Toolbar:
  - Search placeholder: `ค้นหาหมายเลขรถ...` (remove `(Search vehicle)`).
  - Empty button: `ล้างตัวกรอง` (remove `(Clear filters)`).
- Table Headers:
  - `text-xs font-semibold text-slate-500` (scale up from `text-[10px]`).
- Table Rows (Desktop):
  - Distance: `text-sm sm:text-base font-bold font-mono text-slate-850 dark:text-slate-100`.
  - Status text: `text-sm font-medium`.
  - Last seen: main `text-xs sm:text-sm font-medium`, sub `text-xs text-slate-400` (scale up from `text-[10px]`).
  - Button `เปิดแผนที่`: `text-xs sm:text-sm font-semibold px-3 py-1.5`.
- Mobile Cards:
  - Remove subtitle `(Connected)` / `(Signal Lost)` under license plate.
  - Status badge: `text-xs sm:text-sm font-semibold`.
  - Distance metric value: `text-base sm:text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400`.
  - Open map button: `text-sm font-semibold py-2.5 min-h-[44px]`.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test --prefix frontend -- src/components/__tests__/DailyDistanceTable.test.tsx src/components/__tests__/MobileResponsive.test.tsx src/__tests__/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add frontend/src/components/DailyDistanceTable.tsx frontend/src/components/__tests__/DailyDistanceTable.test.tsx frontend/src/components/__tests__/MobileResponsive.test.tsx frontend/src/__tests__/App.test.tsx
git commit -m "refactor(table): scale up typography and clean copy in DailyDistanceTable"
```

---

### Task 3: Fleet Distance Analytics Card & Charts Typography Scale-Up

**Files:**
- Modify: `frontend/src/components/FleetDistanceAnalyticsCard.tsx`
- Modify: `frontend/src/components/charts/Trend7DayChart.tsx`
- Modify: `frontend/src/components/charts/HourlyActivityChart.tsx`
- Modify: `frontend/src/components/charts/VehicleComparisonChart.tsx`
- Test: `frontend/src/components/__tests__/FleetDistanceAnalyticsCard.test.tsx`
- Test: `frontend/src/components/charts/__tests__/FleetCharts.test.tsx`

**Interfaces:**
- Consumes: `FleetDistanceAnalyticsCardProps`, `HourlyActivityPoint`, `Trend7DayPoint`
- Produces: Concise card header (`สถิติระยะทางวิ่ง`), enlarged timeframe buttons (`text-xs sm:text-sm`), clearer chart axis ticks and subtitles.

- [ ] **Step 1: Update test matchers in FleetDistanceAnalyticsCard.test.tsx**

In `frontend/src/components/__tests__/FleetDistanceAnalyticsCard.test.tsx`:
- Update heading expectation from `Fleet Distance Analytics` to `สถิติระยะทางวิ่ง`.
- Verify tab buttons and timeframe switchers.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test --prefix frontend -- src/components/__tests__/FleetDistanceAnalyticsCard.test.tsx`
Expected: FAIL on heading text mismatch.

- [ ] **Step 3: Implement clean copy and typography scale-up in FleetDistanceAnalyticsCard and charts**

In `frontend/src/components/FleetDistanceAnalyticsCard.tsx`:
- Header title: `สถิติระยะทางวิ่ง`
- Subheading: `เปรียบเทียบระยะทางและแนวโน้มการใช้งานของกองรถ` (`text-xs sm:text-sm text-slate-500`)
- Timeframe buttons: `text-xs sm:text-sm font-semibold px-3 py-1.5`
- Tabs: `text-xs sm:text-sm font-semibold px-3 py-2`

In `Trend7DayChart.tsx` & `HourlyActivityChart.tsx` & `VehicleComparisonChart.tsx`:
- Scale axis text from `text-[9px]` to `text-[11px] font-mono`.
- Subtitle labels: `text-xs text-slate-500`.
- Tooltip badges: `text-xs font-semibold`.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test --prefix frontend -- src/components/__tests__/FleetDistanceAnalyticsCard.test.tsx src/components/charts/__tests__/FleetCharts.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add frontend/src/components/FleetDistanceAnalyticsCard.tsx frontend/src/components/charts/Trend7DayChart.tsx frontend/src/components/charts/HourlyActivityChart.tsx frontend/src/components/charts/VehicleComparisonChart.tsx frontend/src/components/__tests__/FleetDistanceAnalyticsCard.test.tsx frontend/src/components/charts/__tests__/FleetCharts.test.tsx
git commit -m "refactor(analytics): scale up typography and clean up copy in analytics card and charts"
```

---

### Task 4: Full Regression Verification & Build Validation

**Files:**
- Entire frontend test suite
- TypeScript build check

- [ ] **Step 1: Run complete Vitest test suite**

Run: `npm test --prefix frontend`
Expected: All 38 test suites pass (339+ tests passing, 0 failures).

- [ ] **Step 2: Run production build check**

Run: `npm run build --prefix frontend`
Expected: Exit code 0, 0 TypeScript errors.

- [ ] **Step 3: Check git status and remote sync**

Run: `git status`
Expected: Clean working directory.
Push: `git push origin master`
