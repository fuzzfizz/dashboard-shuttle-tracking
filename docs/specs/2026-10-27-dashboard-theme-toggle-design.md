# Design Spec: Main Dashboard Theme Toggle (Light Default, Map Excluded)

**Date:** 2026-10-27  
**Status:** Approved by User  
**Author:** Antigravity Pairing Assistant  

---

## 1. Context & Requirements

The user requested a theme toggle for the main operational dashboard (`/`):
1. **Light Mode as Default:** The dashboard must default to a clean, crisp Light Mode for new sessions or when no preference has been saved.
2. **Theme Toggle Control:** A minimalist single-icon toggle button (☀️ / 🌙) on the dashboard header that allows users to switch seamlessly between Light and Dark modes.
3. **Map Isolation (Explicit Requirement):** The map canvas, tile layers (Longdo Map / OSM), vehicle markers, and map pins must remain **strictly unchanged** ("ไม่ต้องทำให้ map"). No CSS color inversion, dark filters, or tile alterations shall be applied to the map.
4. **State Persistence:** The user's active theme selection (`'light'` or `'dark'`) must persist in browser `localStorage` across page reloads.

---

## 2. Architecture & Implementation Strategy

### 2.1 Tailwind CSS Configuration (`darkMode: 'class'`)
In `frontend/tailwind.config.js`:
- Set `darkMode: 'class'`.
- This enables using standard Tailwind `dark:` variant utilities throughout components while keeping `light` as the default base styling.

### 2.2 Theme Management (`useTheme` / `ThemeContext`)
Create `frontend/src/context/ThemeContext.tsx` providing:
- State: `theme: 'light' | 'dark'` (initial default: `'light'`, checked against `localStorage.getItem('shuttle_theme')`).
- Method: `toggleTheme: () => void`.
- Effect: Adds or removes the `.dark` class on `document.documentElement` whenever `theme` changes, and updates `localStorage`.

### 2.3 Header Toggle Button
Add a single-icon toggle button to:
1. Compact Header (`App.tsx`): Located next to the Connection Status badge and Analytics shortcut button.
2. Fullscreen Map Top Bar (`App.tsx`): Located alongside the vehicle title pill and Exit Fullscreen button.

**Button Interaction:**
- In Light mode: Shows `Moon` icon with tooltip/aria-label *"Switch to Dark Mode"*.
- In Dark mode: Shows `Sun` icon with tooltip/aria-label *"Switch to Light Mode"*.
- Accessible touch target (>= 40px) with hover and focus ring styling.

---

## 3. UI Component Color Schemes

### 3.1 Main Layout & Header (`App.tsx`)
- **Page Wrapper:** `bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-100`
- **Header:** `bg-white/95 border-b border-slate-200 text-slate-800 dark:bg-slate-900/95 dark:border-slate-800 dark:text-white`
- **Connection Badge:** `bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-800/80 dark:border-slate-700/60 dark:text-slate-300`
- **Analytics Button:** `bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700/80 dark:text-slate-200`
- **Map Card Container:** `bg-white border-slate-200 shadow-md dark:bg-slate-900 dark:border-slate-800 dark:shadow-xl`

### 3.2 Telemetry HUD (`TelemetryHUD.tsx`)
- **Card Frame:** `bg-white/95 border-slate-200 text-slate-900 shadow-xl dark:bg-slate-900/90 dark:border-slate-800 dark:text-white dark:shadow-2xl`
- **Metric Cards / Icons:** Light backgrounds (`bg-slate-100 text-slate-800`) in light mode; dark backgrounds (`bg-slate-800/80 text-white`) in dark mode.
- **Labels:** `text-slate-500 dark:text-slate-400`.

### 3.3 Fleet Panel (`FleetPanel.tsx`)
- **Card Frame:** `bg-white/95 border-slate-200 shadow-lg dark:bg-slate-900/95 dark:border-slate-800 dark:shadow-xl`
- **Item Rows:**
  - Default: `border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60`
  - Selected: `border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40`
- **Headers & Labels:** `text-slate-800 dark:text-slate-100`, secondary `text-slate-500 dark:text-slate-400`.

### 3.4 Daily Distance Analytics Table (`DailyDistanceTable.tsx`)
- **Table Card Frame:** `bg-white border-slate-200 text-slate-800 shadow-xl dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100`
- **Summary Cards (Total Dist, Max Speed, Tracked):**
  - Light: `bg-slate-50 border-slate-200 text-slate-800`
  - Dark: `bg-slate-800/60 border-slate-700/60 text-slate-100`
- **Table Structure:**
  - Header row: `bg-slate-100 text-slate-600 dark:bg-slate-800/70 dark:text-slate-400`
  - Data rows: `hover:bg-slate-50 divide-slate-100 dark:hover:bg-slate-800/40 dark:divide-slate-800`
  - Empty state / controls: Styled to adapt seamlessly.

---

## 4. Map Isolation Guarantee ("ไม่ต้องทำให้ map")

- The map viewport element (`.leaflet-container`), MapLibre canvas, tile layers, and vehicle pins remain strictly unmodified.
- No `filter: invert(...)`, `filter: hue-rotate(...)`, or custom dark styling will be injected into Leaflet/Longdo Map containers.
- The map tile visual appearance remains 100% identical between Light and Dark mode.

---

## 5. Verification & Testing Plan

1. **Unit Tests for Theme Context / Hook:**
   - Default theme is `'light'`.
   - `toggleTheme()` flips from `'light'` to `'dark'` and back.
   - Updates `localStorage.getItem('shuttle_theme')`.
   - Toggles `.dark` class on `document.documentElement`.
2. **Integration Tests (`App.test.tsx`):**
   - Renders theme toggle button in header.
   - Clicking toggle switches theme and persists preference.
   - Verifies map container and Leaflet tile container remain unmodified.
3. **Regression Testing:**
   - Execute full Vitest suite (all 119 existing tests pass without regressions).
