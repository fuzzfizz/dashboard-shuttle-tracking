# Main Dashboard Theme Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implement a Light Mode (default) and Dark Mode theme toggle on the main operational dashboard (`/`) while keeping map tiles, map markers, and map canvas completely untouched.

**Architecture:** Enable Tailwind CSS class-based dark mode (`darkMode: 'class'`). Manage theme state via a React `ThemeContext` / `useTheme` hook with initial default `'light'` and persistence in `localStorage` (`shuttle_theme`). Update layout and dashboard components (`App.tsx`, `TelemetryHUD`, `FleetPanel`, `DailyDistanceTable`) to adapt dynamically with Tailwind light and `dark:` utility classes, leaving `ShuttleMap` unaffected.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide React (`Sun`, `Moon`), Vitest, Testing Library React.

## Global Constraints

- Default theme MUST be `'light'`.
- Map tiles, map layers, vehicle markers, and map canvas MUST remain completely untouched ("ไม่ต้องทำให้ map") — no CSS inversion filters or dark mode tile styling on the map container.
- Theme preference MUST persist in `localStorage` under key `shuttle_theme`.
- Single icon button (☀️ / 🌙) on the Header to toggle between Light and Dark mode.
- All 119 existing tests must pass and new tests added for theme capabilities.

---

### Task 1: Setup Tailwind Dark Mode Configuration and ThemeContext / useTheme Hook

**Files:**
- Modify: `frontend/tailwind.config.js`
- Create: `frontend/src/context/ThemeContext.tsx`
- Test: `frontend/src/context/__tests__/ThemeContext.test.tsx`

**Interfaces:**
- Produces:
  ```typescript
  export type Theme = 'light' | 'dark';
  export interface ThemeContextValue {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
  }
  export const ThemeProvider: React.FC<{ children: React.ReactNode; initialTheme?: Theme }>;
  export const useTheme: () => ThemeContextValue;
  ```

- [x] **Step 1: Write failing tests for ThemeContext**

```typescript
// frontend/src/context/__tests__/ThemeContext.test.tsx
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ThemeProvider, useTheme } from '../ThemeContext';

const TestConsumer = () => {
  const { theme, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <button onClick={toggleTheme}>Toggle Theme</button>
    </div>
  );
};

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    vi.restoreAllMocks();
  });

  it('defaults to light theme when no localStorage value exists', () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('current-theme').textContent).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('toggles theme to dark and adds dark class to documentElement', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    const button = screen.getByRole('button', { name: /Toggle Theme/i });
    await user.click(button);

    expect(screen.getByTestId('current-theme').textContent).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('shuttle_theme')).toBe('dark');

    await user.click(button);
    expect(screen.getByTestId('current-theme').textContent).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('shuttle_theme')).toBe('light');
  });

  it('restores dark theme from localStorage if previously saved', () => {
    localStorage.setItem('shuttle_theme', 'dark');

    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('current-theme').textContent).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
```

- [x] **Step 2: Run test to verify it fails**
Command: `npm test --prefix frontend ThemeContext`

- [x] **Step 3: Update `tailwind.config.js` and implement `ThemeContext.tsx`**
In `frontend/tailwind.config.js`:
```javascript
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // ...
}
```

In `frontend/src/context/ThemeContext.tsx`:
Implement `ThemeProvider` and `useTheme` managing `'light' | 'dark'`, syncing `.dark` class on `document.documentElement`, and persisting in `localStorage.setItem('shuttle_theme', ...)`.

- [x] **Step 4: Run test to verify it passes**
Command: `npm test --prefix frontend ThemeContext`

- [x] **Step 5: Commit changes**
`git add frontend/tailwind.config.js frontend/src/context/ && git commit -m "feat(theme): configure tailwind darkMode and implement ThemeContext"`

---

### Task 2: Implement Theme Toggle in Main Dashboard Header (`App.tsx`)

**Files:**
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/__tests__/App.test.tsx`

**Interfaces:**
- Consumes: `useTheme`, `ThemeProvider` from `../context/ThemeContext`
- Produces: Header theme toggle button with ☀️ / 🌙 icon, aria-label, and responsive styling.

- [x] **Step 1: Write integration tests for Theme Toggle in `App.test.tsx`**

Add tests to `frontend/src/__tests__/App.test.tsx`:
```typescript
it('renders theme toggle button in header and defaults to light mode', () => {
  render(<App />);
  const toggleBtn = screen.getByRole('button', { name: /switch to dark mode/i });
  expect(toggleBtn).toBeInTheDocument();
  expect(document.documentElement.classList.contains('dark')).toBe(false);
});

it('switches theme to dark mode when header toggle is clicked', async () => {
  const user = userEvent.setup();
  render(<App />);
  const toggleBtn = screen.getByRole('button', { name: /switch to dark mode/i });
  await user.click(toggleBtn);

  expect(document.documentElement.classList.contains('dark')).toBe(true);
  expect(screen.getByRole('button', { name: /switch to light mode/i })).toBeInTheDocument();
  expect(localStorage.getItem('shuttle_theme')).toBe('dark');
});
```

- [x] **Step 2: Run test to verify it fails**
Command: `npm test --prefix frontend App.test.tsx`

- [x] **Step 3: Update `App.tsx`**
- Wrap root `App` return in `<ThemeProvider>`.
- In `OperationalDashboard`:
  - Call `const { theme, toggleTheme } = useTheme();`
  - Add theme toggle button in the compact Header:
    ```tsx
    <button
      onClick={toggleTheme}
      aria-label={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
      title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
      className="flex items-center justify-center p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700/80 transition-colors shadow-sm"
    >
      {theme === 'light' ? <Moon className="w-4 h-4 text-slate-700" /> : <Sun className="w-4 h-4 text-amber-400" />}
    </button>
    ```
  - In fullscreen top floating bar: also include the toggle button so the user can change theme in fullscreen.
  - Update page wrapper classes:
    `min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex flex-col`
  - Update header classes:
    `bg-white/95 border-b border-slate-200 dark:bg-slate-900/95 dark:border-slate-800 backdrop-blur-md`
  - Update map card outer frame classes:
    `bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-2xl p-4 shadow-md dark:shadow-xl`
  - Ensure map container (`<ShuttleMap />` and its inner div) is unmodified and isolated.

- [x] **Step 4: Run test to verify it passes**
Command: `npm test --prefix frontend App.test.tsx`

- [x] **Step 5: Commit changes**
`git add frontend/src/App.tsx frontend/src/__tests__/App.test.tsx && git commit -m "feat(dashboard): integrate ThemeProvider and header theme toggle button"`

---

### Task 3: Adapt TelemetryHUD and FleetPanel for Light and Dark Themes

**Files:**
- Modify: `frontend/src/components/TelemetryHUD.tsx`
- Modify: `frontend/src/components/FleetPanel.tsx`
- Test: `frontend/src/components/__tests__/TelemetryHUD.test.tsx`
- Test: `frontend/src/components/__tests__/FleetPanel.test.tsx`

**Interfaces:**
- Consumes: Tailwind `dark:` variant classes

- [x] **Step 1: Run existing component tests to establish baseline**
Command: `npm test --prefix frontend TelemetryHUD.test.tsx FleetPanel.test.tsx`

- [x] **Step 2: Update `TelemetryHUD.tsx`**
- Adjust card frame to:
  `bg-white/95 border-slate-200 text-slate-900 shadow-xl dark:bg-slate-900/90 dark:border-slate-800 dark:text-white dark:shadow-2xl`
- Divider: `border-slate-200 dark:border-slate-800`
- Metric background: `bg-slate-100 text-slate-800 dark:bg-slate-800/80 dark:text-white`
- Metric labels: `text-slate-500 dark:text-slate-400`

- [x] **Step 3: Update `FleetPanel.tsx`**
- Adjust container to support both light and dark:
  `bg-white/95 border-slate-200 text-slate-800 dark:bg-slate-900/95 dark:border-slate-800 dark:text-slate-100`
- Overview button:
  `selectedVehicleId === null ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-slate-800/80'`
- Vehicle items:
  `border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60`
  Selected: `border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40`

- [x] **Step 4: Run component tests to ensure all pass**
Command: `npm test --prefix frontend TelemetryHUD.test.tsx FleetPanel.test.tsx`

- [x] **Step 5: Commit changes**
`git add frontend/src/components/TelemetryHUD.tsx frontend/src/components/FleetPanel.tsx && git commit -m "feat(ui): style TelemetryHUD and FleetPanel for light and dark themes"`

---

### Task 4: Adapt DailyDistanceTable for Light and Dark Themes

**Files:**
- Modify: `frontend/src/components/DailyDistanceTable.tsx`
- Test: `frontend/src/components/__tests__/DailyDistanceTable.test.tsx`

**Interfaces:**
- Consumes: Tailwind `dark:` variant classes

- [x] **Step 1: Run existing tests to establish baseline**
Command: `npm test --prefix frontend DailyDistanceTable.test.tsx`

- [x] **Step 2: Update `DailyDistanceTable.tsx`**
- Container:
  `bg-white border-slate-200 text-slate-800 shadow-xl dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100`
- Header text & description:
  `text-slate-800 dark:text-slate-200` and `text-slate-500 dark:text-slate-400`
- Sort button:
  `bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-300 dark:border-slate-700/80`
- 3 Summary cards:
  `bg-slate-50 border-slate-200 text-slate-800 dark:bg-slate-800/60 dark:border-slate-700/60 dark:text-slate-100`
- Table elements:
  - Table header: `bg-slate-100 text-slate-600 border-b border-slate-200 dark:bg-slate-800/70 dark:text-slate-400 dark:border-slate-800`
  - Rows: `hover:bg-slate-50/80 border-b border-slate-100 dark:hover:bg-slate-800/40 dark:border-slate-800`
  - Progress bar track: `bg-slate-100 dark:bg-slate-800`

- [x] **Step 3: Run component tests to ensure all pass**
Command: `npm test --prefix frontend DailyDistanceTable.test.tsx`

- [x] **Step 4: Commit changes**
`git add frontend/src/components/DailyDistanceTable.tsx && git commit -m "feat(analytics): adapt DailyDistanceTable for light and dark themes"`

---

### Task 5: Full Regression Testing & Build Verification

**Files:**
- Modify: `frontend/src/components/ShuttleMap.tsx` (verify untouched)
- Run: Vitest suite & build

- [x] **Step 1: Verify map isolation**
Check that `ShuttleMap.tsx`, `MapLibreLayer.tsx`, `AnimatedVehicleMarker.tsx`, and `.leaflet-container` contain no filter / dark inversion styles.

- [x] **Step 2: Run all frontend tests**
Command: `npm test --prefix frontend`
Expected: All tests pass (100% green).

- [x] **Step 3: Verify frontend build**
Command: `npm run build --prefix frontend`
Expected: Vite build succeeds with 0 errors.

- [x] **Step 4: Final commit**
`git commit --allow-empty -m "chore: complete theme toggle implementation with verified map isolation"`
