# Historical Trip Replay 14-Day Retention & Compact-Fullscreen Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 14-day retention bounds and quick navigation in historical replay, alongside a compact dashboard card and fullscreen map parity with the live view.

**Architecture:** 
- Add Bangkok-timezone retention calculation and day shifting functions to `historicalDateUtils.ts`.
- Upgrade `ReplayToolbar.tsx` with `min` 14-day date clamping, day stepping (`◀` and `▶`), quick preset pills (`วันนี้` and `เมื่อวาน`), and summary metric cards.
- Refactor `HistoricalTripReplay.tsx` to support both compact dashboard mode (`!isMapFullscreen`) with responsive layout and fullscreen mode (`isMapFullscreen`) with header bar and `Escape` exit handling, plus an informative 14-day retention empty state.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide React, Vitest, React Testing Library.

## Global Constraints
- Bangkok timezone (`Asia/Bangkok` or UTC+7) for all date operations.
- Retention window: Exactly 14 days before current Bangkok date.
- Strict touch target accessibility: min 36px–44px for clickable elements.
- Clean Tailwind dark mode support (`dark:` classes).

---

### Task 1: Date Retention & Shift Utilities in `historicalDateUtils.ts` (TDD)

**Files:**
- Modify: `frontend/src/services/historicalDateUtils.ts`
- Test: `frontend/src/services/__tests__/historicalDateUtils.test.ts`

**Interfaces:**
- Consumes: `getBangkokDate`, `BANGKOK_TZ`
- Produces:
  ```typescript
  export function getBangkokMinRetentionDate(retentionDays?: number, now?: Date | number): string;
  export function shiftBangkokDate(dateStr: string, deltaDays: number, minDate?: string, maxDate?: string): string;
  ```

- [ ] **Step 1: Write failing unit tests for retention and date shift utilities**

Add test cases in `frontend/src/services/__tests__/historicalDateUtils.test.ts`:
```typescript
describe('getBangkokMinRetentionDate and shiftBangkokDate', () => {
  it('returns exactly 14 days before Bangkok date by default', () => {
    // 2026-11-26 12:00:00 UTC+7 -> 14 days prior is 2026-11-12
    const mockNow = new Date('2026-11-26T05:00:00.000Z'); // 12:00 Bangkok
    expect(getBangkokMinRetentionDate(14, mockNow)).toBe('2026-11-12');
  });

  it('shifts date forward and backward by delta days', () => {
    expect(shiftBangkokDate('2026-11-20', 1)).toBe('2026-11-21');
    expect(shiftBangkokDate('2026-11-20', -1)).toBe('2026-11-19');
  });

  it('clamps shifted date to minDate and maxDate boundaries', () => {
    expect(shiftBangkokDate('2026-11-12', -1, '2026-11-12', '2026-11-26')).toBe('2026-11-12');
    expect(shiftBangkokDate('2026-11-26', 1, '2026-11-12', '2026-11-26')).toBe('2026-11-26');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npx vitest run src/services/__tests__/historicalDateUtils.test.ts`
Expected: FAIL (Cannot find names `getBangkokMinRetentionDate`, `shiftBangkokDate`)

- [ ] **Step 3: Implement minimal code in `historicalDateUtils.ts`**

In `frontend/src/services/historicalDateUtils.ts`:
```typescript
/**
 * Returns YYYY-MM-DD for N days before today in Bangkok timezone.
 * Defaults to 14 days ago for production data retention.
 */
export function getBangkokMinRetentionDate(retentionDays: number = 14, now?: Date | number): string {
  const baseDate = now ? (typeof now === 'number' ? new Date(now) : now) : new Date();
  const target = new Date(baseDate.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  return getBangkokDate(target);
}

/**
 * Shifts a YYYY-MM-DD date string by a given number of days (+1 or -1).
 * Clamps result between minDate and maxDate if provided.
 */
export function shiftBangkokDate(
  dateStr: string,
  deltaDays: number,
  minDate?: string,
  maxDate?: string
): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  dateObj.setUTCDate(dateObj.getUTCDate() + deltaDays);

  const shiftedY = dateObj.getUTCFullYear();
  const shiftedM = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const shiftedD = String(dateObj.getUTCDate()).padStart(2, '0');
  let result = `${shiftedY}-${shiftedM}-${shiftedD}`;

  if (minDate && result < minDate) {
    result = minDate;
  }
  if (maxDate && result > maxDate) {
    result = maxDate;
  }
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend; npx vitest run src/services/__tests__/historicalDateUtils.test.ts`
Expected: PASS (all tests pass)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/historicalDateUtils.ts frontend/src/services/__tests__/historicalDateUtils.test.ts
git commit -m "feat(history): add 14-day retention date and date shift utilities"
```

---

### Task 2: 14-Day Retention & Quick Date Navigation in `ReplayToolbar.tsx` (TDD)

**Files:**
- Modify: `frontend/src/components/ReplayToolbar.tsx`
- Test: `frontend/src/components/__tests__/ReplayToolbar.test.tsx`

**Interfaces:**
- Consumes:
  - `getBangkokDate`, `getBangkokMinRetentionDate`, `shiftBangkokDate` from `../services/historicalDateUtils`
  - `HistoricalTripSummary` from `../types/historical`
- Props:
  ```typescript
  interface ReplayToolbarProps {
    selectedDate: string;
    onDateChange: (date: string) => void;
    selectedVehicleId: string;
    onVehicleChange: (id: string) => void;
    vehicleList: Array<{ id: string; name: string }>;
    summary: HistoricalTripSummary;
    isLoading: boolean;
    onRefresh: () => void;
  }
  ```

- [ ] **Step 1: Write failing tests in `ReplayToolbar.test.tsx`**

Test cases in `frontend/src/components/__tests__/ReplayToolbar.test.tsx`:
1. Verify `input[type="date"]` has `min` set to 14 days ago and `max` set to today.
2. Verify previous day `[ ◀ ]` and next day `[ ▶ ]` buttons trigger `onDateChange` with shifted dates.
3. Verify `[ วันนี้ ]` sets date to today, and `[ เมื่อวาน ]` sets date to yesterday.
4. Verify previous button is disabled when at `minDate` and next button is disabled when at `maxDate`.
5. Verify 14-day retention badge is displayed: `"บันทึกย้อนหลัง 14 วัน"`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npx vitest run src/components/__tests__/ReplayToolbar.test.tsx`
Expected: FAIL (buttons and min attribute not found)

- [ ] **Step 3: Implement 14-day retention controls & summary cards in `ReplayToolbar.tsx`**

In `frontend/src/components/ReplayToolbar.tsx`:
- Compute `minDate = getBangkokMinRetentionDate(14)` and `maxDate = getBangkokDate()`.
- Add previous/next day buttons:
  - `<button aria-label="วันก่อนหน้า" disabled={selectedDate <= minDate} onClick={() => onDateChange(shiftBangkokDate(selectedDate, -1, minDate, maxDate))}> <ChevronLeft /> </button>`
  - `<button aria-label="วันถัดไป" disabled={selectedDate >= maxDate} onClick={() => onDateChange(shiftBangkokDate(selectedDate, 1, minDate, maxDate))}> <ChevronRight /> </button>`
- Add preset pills:
  - `<button onClick={() => onDateChange(maxDate)}>วันนี้</button>`
  - `<button onClick={() => onDateChange(shiftBangkokDate(maxDate, -1, minDate, maxDate))}>เมื่อวาน</button>`
- Add retention indicator badge: `"บันทึกย้อนหลัง 14 วัน"`.
- Add 4 Summary stat cards: Total Distance (`summary.total_distance_km`), Max Speed (`summary.max_speed_kmh`), Avg Speed (`summary.avg_speed_kmh`), and GPS Points count (`summary.total_points`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend; npx vitest run src/components/__tests__/ReplayToolbar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ReplayToolbar.tsx frontend/src/components/__tests__/ReplayToolbar.test.tsx
git commit -m "feat(history): implement 14-day retention date controls and summary cards"
```

---

### Task 3: Compact Dashboard & Fullscreen Parity in `HistoricalTripReplay.tsx` (TDD)

**Files:**
- Modify: `frontend/src/components/HistoricalTripReplay.tsx`
- Modify: `frontend/src/components/ReplayMap.tsx` (for empty state overlay / 14-day notice)
- Test: `frontend/src/__tests__/HistoricalTripReplay.test.tsx`
- Test: `frontend/src/__tests__/App.test.tsx`

**Interfaces:**
- Consumes:
  - `ReplayToolbar`, `ReplayMap`, `ReplayPlayerBar`
  - `Maximize2`, `Minimize2` icons from `lucide-react`
  - `useHistoricalTrip`, `useTripPlayback`
- Produces:
  ```typescript
  export interface HistoricalTripReplayProps {
    initialVehicleId?: string;
    vehicleList?: Array<{ id: string; name: string }>;
    onVehicleChange?: (vehicleId: string) => void;
  }
  ```

- [ ] **Step 1: Write failing tests in `HistoricalTripReplay.test.tsx`**

Test cases in `frontend/src/__tests__/HistoricalTripReplay.test.tsx`:
1. Renders in compact mode with button `"ขยายเต็มจอ"` (Maximize).
2. Clicking `"ขยายเต็มจอ"` toggles fullscreen mode, displaying `"ออกจากเต็มจอ"`.
3. Pressing `Escape` key exits fullscreen mode back to compact mode.
4. When `points.length === 0`, displays informative empty state with `"ระบบจัดเก็บบันทึกย้อนหลัง 14 วัน"`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npx vitest run src/__tests__/HistoricalTripReplay.test.tsx`
Expected: FAIL (fullscreen controls not present in HistoricalTripReplay)

- [ ] **Step 3: Implement compact layout and fullscreen toggle in `HistoricalTripReplay.tsx`**

In `frontend/src/components/HistoricalTripReplay.tsx`:
- Add `const [isMapFullscreen, setIsMapFullscreen] = useState(false);`
- Add `keydown` event listener for `Escape` key to exit fullscreen.
- In compact view:
  - Outer container: `w-full px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 flex flex-col gap-4 sm:gap-6 bg-slate-100 dark:bg-slate-900 min-h-screen`.
  - Render `ReplayToolbar` at the top.
  - Map card container: `bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-sm dark:shadow-xl flex flex-col gap-3`.
  - Card Header: Title (`แผนที่เส้นทางย้อนหลัง Historical Trip Replay`), badges (จุดพิกัด, ทะเบียนรถ), and button `[ ⛶ ขยายเต็มจอ ]`.
  - Map Viewport: `h-[380px] sm:h-[480px] md:h-[540px] lg:h-[580px] xl:h-[620px] w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 shadow-xl relative`.
- In fullscreen view:
  - Container: `fixed inset-0 z-[1500] w-screen h-screen bg-slate-950 flex flex-col select-none overflow-hidden`.
  - Floating top bar: Title, vehicle plate, date, and `[ ออกจากเต็มจอ (Esc) ]` button.
- In `ReplayMap.tsx`:
  - Enhance empty state card when `points.length === 0`:
    - Display `"ไม่พบประวัติการเดินทาง"`
    - Display `"รถ ${selectedVehicleId} ไม่มีการบันทึกพิกัดในวันที่ ${selectedDate} (ระบบจัดเก็บบันทึกย้อนหลัง 14 วัน)"`
    - Provide quick button to jump to today (`onSelectToday`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend; npx vitest run src/__tests__/HistoricalTripReplay.test.tsx src/__tests__/App.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/HistoricalTripReplay.tsx frontend/src/components/ReplayMap.tsx frontend/src/__tests__/HistoricalTripReplay.test.tsx frontend/src/__tests__/App.test.tsx
git commit -m "feat(history): implement compact-fullscreen parity and 14-day retention notice"
```

---

### Task 4: Full Build & Regression Verification

**Files:**
- None (verification across all 38 test suites)

- [ ] **Step 1: Run TypeScript compiler and production build**

Run: `cd frontend; npm run build`
Expected: Build succeeds with 0 errors.

- [ ] **Step 2: Run full unit & integration test suite**

Run: `cd frontend; npm test -- --run`
Expected: 38 test suites pass, 340+ tests pass.

- [ ] **Step 3: Commit and push**

```bash
git push origin master
```
