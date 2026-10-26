# Dashboard Compact Map & In-App Fullscreen Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Shuttle Tracking UI into a structured dashboard with a compact map card, and provide an in-app fullscreen toggle (with expand/minimize buttons and Escape key support) that smoothly resizes Leaflet tiles.

**Architecture:** Refactor `App.tsx` layout from an edge-to-edge floating canvas into a responsive dashboard grid consisting of a top nav header, an 8-column main area (compact Map Card + integrated Telemetry HUD), and a 4-column sidebar (Fleet Panel). Introduce an `isMapFullscreen` state that elevates the map into an overlay viewport container, with a `MapResizeHandler` calling `map.invalidateSize()` and an Escape key handler for seamless transitions.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Leaflet / react-leaflet, Lucide React (`Maximize2`, `Minimize2`, `Bus`, `Layers`, etc.), Vitest, React Testing Library.

## Global Constraints
- Preserve backward compatibility for all existing props in `ShuttleMap`, `TelemetryHUD`, and `FleetPanel`.
- Must not produce gray or incomplete Leaflet tiles when transitioning between compact and fullscreen modes (`map.invalidateSize()` must be triggered).
- Fullscreen mode must support keyboard exit via `Escape` key.
- Buttons must include accessible labels (`aria-label="Expand map to full screen"` and `aria-label="Exit full screen"`).
- All existing 52 tests must continue to pass with zero regressions.

---

### Task 1: Map Resize Handler & Fullscreen Support in ShuttleMap

**Files:**
- Modify: `frontend/src/components/ShuttleMap.tsx`
- Test: `frontend/src/components/__tests__/ShuttleMap.test.tsx`

**Interfaces:**
- Consumes: Leaflet `map.invalidateSize()` via `useMap()` from `react-leaflet`.
- Produces: `isFullscreen?: boolean` prop in `ShuttleMapProps`, and `MapResizeHandler` component that triggers `map.invalidateSize()` upon size/fullscreen updates.

- [ ] **Step 1: Write the failing test for `isFullscreen` prop and `invalidateSize` trigger in `ShuttleMap.test.tsx`**

Add a test in `frontend/src/components/__tests__/ShuttleMap.test.tsx`:
```tsx
  it('calls map.invalidateSize when isFullscreen prop changes or window resizes', async () => {
    const invalidateSizeSpy = vi.spyOn(L.Map.prototype, 'invalidateSize').mockImplementation(() => ({} as any));

    const { rerender } = render(<ShuttleMap vehicles={{}} isFullscreen={false} />);

    // Toggle fullscreen prop
    rerender(<ShuttleMap vehicles={{}} isFullscreen={true} />);

    // Wait for the scheduled timeout
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(invalidateSizeSpy).toHaveBeenCalled();
    invalidateSizeSpy.mockRestore();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix frontend -- src/components/__tests__/ShuttleMap.test.tsx -t "calls map.invalidateSize when isFullscreen prop changes"`
Expected: FAIL or type error because `isFullscreen` is not yet defined on `ShuttleMapProps` or `invalidateSize` is not called.

- [ ] **Step 3: Implement `MapResizeHandler` and `isFullscreen` prop in `ShuttleMap.tsx`**

In `frontend/src/components/ShuttleMap.tsx`:
1. Add `isFullscreen?: boolean` to `ShuttleMapProps`:
```ts
export interface ShuttleMapProps {
  vehicles?: FleetMap;
  lastSeenMap?: Record<string, number>;
  now?: number;
  selectedVehicleId?: string | null;
  onSelectVehicle?: (vehicleId: string) => void;
  telemetry?: TelemetryPayload | null;
  defaultCenter?: [number, number];
  zoom?: number;
  isFullscreen?: boolean;
}
```
2. Define `MapResizeHandler`:
```tsx
export const MapResizeHandler: React.FC<{ isFullscreen?: boolean }> = ({ isFullscreen }) => {
  const map = useMap();

  useEffect(() => {
    // Invalidate Leaflet canvas dimensions after transition/state update
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);

    const handleWindowResize = () => {
      map.invalidateSize();
    };

    window.addEventListener('resize', handleWindowResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [isFullscreen, map]);

  return null;
};
```
3. Insert `<MapResizeHandler isFullscreen={isFullscreen} />` inside `<MapContainer>` in `ShuttleMap`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --prefix frontend -- src/components/__tests__/ShuttleMap.test.tsx`
Expected: PASS (all tests pass).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ShuttleMap.tsx frontend/src/components/__tests__/ShuttleMap.test.tsx
git commit -m "feat(map): add isFullscreen prop and automatic Leaflet resize invalidation"
```

---

### Task 2: Allow Custom Styling / Positioning in FleetPanel and TelemetryHUD

**Files:**
- Modify: `frontend/src/components/FleetPanel.tsx`
- Modify: `frontend/src/components/TelemetryHUD.tsx`
- Test: `frontend/src/components/__tests__/FleetPanel.test.tsx`
- Test: `frontend/src/components/__tests__/TelemetryHUD.test.tsx`

**Interfaces:**
- Consumes: Optional `className?: string` prop.
- Produces: Flexible container styling so components can be rendered either in the dashboard grid flow or as floating absolute overlays in fullscreen mode.

- [ ] **Step 1: Write test for custom className prop in `FleetPanel.test.tsx` and `TelemetryHUD.test.tsx`**

In `frontend/src/components/__tests__/FleetPanel.test.tsx`:
```tsx
  it('applies custom className when provided', () => {
    const { container } = render(
      <FleetPanel
        vehicles={{}}
        lastSeenMap={{}}
        selectedVehicleId={null}
        onSelectVehicle={vi.fn()}
        className="custom-fleet-class"
      />
    );
    expect(container.firstChild).toHaveClass('custom-fleet-class');
  });
```

In `frontend/src/components/__tests__/TelemetryHUD.test.tsx`:
```tsx
  it('applies custom className when provided', () => {
    const { container } = render(
      <TelemetryHUD
        telemetry={null}
        status="connected"
        lastSeen={null}
        className="custom-hud-class"
      />
    );
    expect(container.firstChild).toHaveClass('custom-hud-class');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix frontend -- src/components/__tests__/FleetPanel.test.tsx src/components/__tests__/TelemetryHUD.test.tsx`
Expected: FAIL because `className` is not in prop interfaces.

- [ ] **Step 3: Add `className?: string` to `FleetPanelProps` and `TelemetryHUDProps`**

In `frontend/src/components/FleetPanel.tsx`:
```ts
interface FleetPanelProps {
  vehicles: FleetMap;
  lastSeenMap: Record<string, number>;
  selectedVehicleId: string | null;
  onSelectVehicle: (vehicleId: string | null) => void;
  now?: number;
  dailyMetrics?: DailyMetricsMap;
  onOpenAnalytics?: () => void;
  className?: string;
}
```
Update root div:
```tsx
<div className={className ?? "absolute top-4 right-4 z-[1000] w-72 max-w-[calc(100vw-2rem)] flex flex-col gap-2"}>
```

In `frontend/src/components/TelemetryHUD.tsx`:
```ts
export interface TelemetryHUDProps {
  telemetry: TelemetryPayload | null;
  status: ConnectionStatus;
  lastSeen: number | null;
  totalVehicles?: number;
  fleetStats?: FleetStats;
  isOnline?: boolean;
  now?: number;
  className?: string;
}
```
Update root div:
```tsx
<div className={className ?? "absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-[92vw] max-w-xl"}>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --prefix frontend -- src/components/__tests__/FleetPanel.test.tsx src/components/__tests__/TelemetryHUD.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/FleetPanel.tsx frontend/src/components/TelemetryHUD.tsx frontend/src/components/__tests__/FleetPanel.test.tsx frontend/src/components/__tests__/TelemetryHUD.test.tsx
git commit -m "refactor(components): add className prop to FleetPanel and TelemetryHUD for flexible layout"
```

---

### Task 3: Dashboard Layout and Fullscreen Map Toggle in App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/__tests__/App.test.tsx`

**Interfaces:**
- Consumes: `ShuttleMap`, `TelemetryHUD`, `FleetPanel`, `DailyMetricsModal`, `Maximize2`, `Minimize2` icons.
- Produces:
  - Default Compact Dashboard layout: Top nav header + Main Grid (Map Card with Expand button + Telemetry HUD below it, FleetPanel sidebar).
  - Fullscreen In-App Mode: Viewport overlay with Exit Fullscreen button (`Minimize2`) + Escape key handler.

- [ ] **Step 1: Write tests for compact map card and fullscreen toggle in `App.test.tsx`**

In `frontend/src/__tests__/App.test.tsx`, add:
```tsx
  it('renders compact map card with expand button and toggles fullscreen on click', () => {
    render(<App />);

    // Default compact mode: Expand button is visible
    const expandBtn = screen.getByRole('button', { name: /expand map to full screen/i });
    expect(expandBtn).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /exit full screen/i })).not.toBeInTheDocument();

    // Click expand button to enter fullscreen
    fireEvent.click(expandBtn);

    // Fullscreen mode: Exit button is visible
    const exitBtn = screen.getByRole('button', { name: /exit full screen/i });
    expect(exitBtn).toBeInTheDocument();

    // Click exit button to return to compact mode
    fireEvent.click(exitBtn);
    expect(screen.getByRole('button', { name: /expand map to full screen/i })).toBeInTheDocument();
  });

  it('exits fullscreen mode when Escape key is pressed', () => {
    render(<App />);

    const expandBtn = screen.getByRole('button', { name: /expand map to full screen/i });
    fireEvent.click(expandBtn);
    expect(screen.getByRole('button', { name: /exit full screen/i })).toBeInTheDocument();

    // Press Escape key
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    // Should return to compact mode
    expect(screen.queryByRole('button', { name: /exit full screen/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /expand map to full screen/i })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix frontend -- src/__tests__/App.test.tsx`
Expected: FAIL because the expand button with name "expand map to full screen" does not exist yet.

- [ ] **Step 3: Implement Dashboard Layout and Fullscreen Toggle in `App.tsx`**

Implement:
1. `const [isMapFullscreen, setIsMapFullscreen] = useState(false);`
2. `useEffect` for `window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isMapFullscreen) setIsMapFullscreen(false); })`
3. Render logic:
   - Header bar with Shuttle Tracker brand, connection status, and Analytics modal button.
   - When `!isMapFullscreen`:
     - Render structured dashboard container (`min-h-screen bg-slate-900 text-slate-100 flex flex-col`).
     - Header at top.
     - Content grid (`flex-1 p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 max-w-7xl mx-auto w-full`):
       - Left column (`lg:col-span-8 flex flex-col gap-4`):
         - Map Card:
           - Header bar with "Fleet Live Map", online status pill, and "Expand map to full screen" button with `Maximize2` icon.
           - Map container (`h-[440px] md:h-[480px] w-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-xl relative`).
           - `<ShuttleMap vehicles={vehicles} lastSeenMap={lastSeenMap} now={now} selectedVehicleId={selectedVehicleId} onSelectVehicle={setSelectedVehicleId} isFullscreen={false} />`
         - Telemetry HUD below the map card (`className="w-full relative static"`)
       - Right column (`lg:col-span-4 flex flex-col gap-4`):
         - FleetPanel (`className="w-full flex flex-col gap-2"`)
   - When `isMapFullscreen`:
     - Render full-screen overlay (`fixed inset-0 z-[2000] w-screen h-screen bg-slate-950 flex flex-col select-none`):
       - Floating Top Bar with title/vehicle indicator, and "Exit full screen" button with `Minimize2` icon.
       - Full viewport `<ShuttleMap isFullscreen={true} ... />`
       - Floating `TelemetryHUD` (`className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-[92vw] max-w-xl"`)
       - Floating `FleetPanel` (`className="absolute top-16 right-4 z-[1000] w-72 max-w-[calc(100vw-2rem)] flex flex-col gap-2"`)
4. DailyMetricsModal remains mounted at root.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --prefix frontend -- src/__tests__/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/__tests__/App.test.tsx
git commit -m "feat(ui): implement compact dashboard layout and in-app map fullscreen toggle"
```

---

### Task 4: Complete Verification & Build Check

**Files:**
- None (verification across existing files)

- [ ] **Step 1: Run full test suite**

Run: `npm test --prefix frontend -- --run`
Expected: 100% tests pass (all test files and suites).

- [ ] **Step 2: Run production TypeScript and Vite build**

Run: `npm run build --prefix frontend`
Expected: Clean build with zero errors.

- [ ] **Step 3: Verification commit (if needed) & final review**
