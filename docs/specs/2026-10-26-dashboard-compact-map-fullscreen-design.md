# Design Spec: Dashboard Compact Map & In-App Fullscreen Toggle

**Date:** 2026-10-26  
**Status:** Approved  
**Author:** Pair Programming Agent & User  

---

## 1. Overview & Goal

The current Shuttle Tracking Dashboard displays an edge-to-edge full-screen map with all controls (Header, Fleet Panel, and Telemetry HUD) floating on top of the Leaflet canvas.

The goal of this design is to:
1. Re-structure the main application UI into an organized, responsive **Dashboard Layout** where the map is presented in a compact, well-proportioned card container alongside fleet telemetry and fleet status panels.
2. Provide an intuitive **"Expand to Fullscreen"** button on the map card, enabling operators to seamlessly expand the map to take over the entire viewport (In-App Fullscreen mode) with a single click.
3. Provide an intuitive **"Exit Fullscreen / Minimize"** button and **`Escape` (Esc)** keyboard shortcut to return to the compact dashboard layout.
4. Ensure robust Leaflet tile rendering during layout transitions by invoking `map.invalidateSize()` so no visual artifacts (gray boxes, partial tiles) occur.

---

## 2. Layout & Architecture

### 2.1 Default Compact Dashboard View (`isMapFullscreen === false`)
The default dashboard layout consists of:
- **Top Navigation Bar / Header:**
  - Brand identity ("Shuttle Tracker", "Multi-Vehicle Fleet Gateway", Bus icon)
  - Broker connection status pill
  - Daily Fleet Analytics button (triggers `DailyMetricsModal`)
- **Main Grid Container (`grid grid-cols-1 lg:grid-cols-12 gap-5`):**
  - **Left / Main Column (`lg:col-span-8 flex flex-col gap-4`):**
    - **Map Card Container:**
      - Header bar: Title ("Fleet Live Map"), active vehicles counter, and **Maximize Button** (`Maximize2` icon with tooltip/aria-label "Expand map to full screen").
      - Map frame: Fixed/responsive height (approx. `440px` - `480px`), styled with subtle dark borders (`border-slate-800`), rounded corners (`rounded-2xl`), and overflow containment.
      - Inner `ShuttleMap` rendering fleet vehicles, markers, and tooltips.
    - **Integrated Telemetry HUD:**
      - Embedded directly beneath the map card as an informative operational status row/card, showing current vehicle ID or fleet overview, speed (km/h), heading, and heartbeat timestamp.
  - **Right / Sidebar Column (`lg:col-span-4`):**
    - **Fleet Panel:**
      - Positioned as a clean dashboard widget (no longer strictly absolute floating top-right, but responsive card in the grid).
      - Displays active vehicle list, online/offline status pulses, headings, speeds, and daily distance badges.
      - Includes "All Vehicles (Overview)" fit view button.

### 2.2 In-App Fullscreen View (`isMapFullscreen === true`)
When toggled to fullscreen:
- **Fullscreen Wrapper (`fixed inset-0 z-[2000] w-screen h-screen bg-slate-950 flex flex-col`):**
  - Elevates the map to cover the entire browser viewport.
  - Floating Top Bar / Controls:
    - Left: Mini brand/status indicator or vehicle info badge.
    - Right: Prominent **"Exit Fullscreen"** button (`Minimize2` icon with label "Exit Fullscreen" and Esc hint).
  - Floating Overlays:
    - Floating `TelemetryHUD` anchored at bottom-6 (identical to classic immersive view).
    - Floating `FleetPanel` accessible as an overlay if operators want to switch focused vehicles while in fullscreen mode.
- **Leaflet Auto-Invalidate Size:**
  - Leaflet requires `map.invalidateSize()` whenever container dimensions change between card mode and fullscreen mode.
  - A dedicated controller or hook inside `ShuttleMap` listens to size/fullscreen state changes and triggers `map.invalidateSize()` smoothly.

---

## 3. Keyboard & Accessibility Support

- **Esc Key:** An event listener on `window` listens for `Escape`. If `isMapFullscreen` is `true`, it immediately closes fullscreen mode.
- **Aria Labels:**
  - Expand button: `aria-label="Expand map to full screen"`
  - Minimize button: `aria-label="Exit full screen"`
- **Focus Management:** Smooth keyboard focus and accessible button states.

---

## 4. Component Changes & Interfaces

### 4.1 `App.tsx`
- State:
  - `const [isMapFullscreen, setIsMapFullscreen] = useState(false);`
- Global keydown listener for `Escape`:
  ```ts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMapFullscreen) {
        setIsMapFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMapFullscreen]);
  ```
- Renders:
  - Compact Dashboard layout when `!isMapFullscreen`
  - Viewport-filling overlay when `isMapFullscreen`

### 4.2 `ShuttleMap.tsx`
- Add an `AutoResizeMap` component or effect using `useMap`:
  ```ts
  export const MapResizeHandler: React.FC<{ isFullscreen?: boolean }> = ({ isFullscreen }) => {
    const map = useMap();
    useEffect(() => {
      // Invalidate Leaflet canvas dimensions after transition/state update
      const timer = setTimeout(() => {
        map.invalidateSize();
      }, 100);
      return () => clearTimeout(timer);
    }, [isFullscreen, map]);
    return null;
  };
  ```
- Accepts optional `isFullscreen?: boolean` prop or handles container resizing gracefully.

### 4.3 `FleetPanel.tsx`
- Can be rendered either inline inside the sidebar grid or as an absolute overlay when in fullscreen mode.
- Responsive design ensure smooth collapsing/expansion.

---

## 5. Verification & Testing Plan

1. **Vitest Unit Tests:**
   - In `App.test.tsx`:
     - Test that the Map Card renders with the expand button by default.
     - Test clicking the expand button sets map to fullscreen mode (verifying fullscreen container and minimize button presence).
     - Test clicking the minimize button exits fullscreen.
     - Test pressing `Escape` key exits fullscreen.
   - In `ShuttleMap.test.tsx`:
     - Verify map container mounts and handles resize/fullscreen prop updates without errors.
2. **Regression Testing:**
   - Run full test suite: `npm test --prefix frontend -- --run`.
   - Verify all 52 existing tests continue passing without regression.
3. **Build Verification:**
   - Run `npm run build --prefix frontend` to ensure clean TypeScript compilation and Vite production build.
