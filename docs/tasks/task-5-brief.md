# Task 5 Brief: Upgrade TelemetryHUD and Integrate Multi-Vehicle Fleet in App.tsx

## Files:
- Modify: `frontend/src/components/TelemetryHUD.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/__tests__/TelemetryHUD.test.tsx`
- Modify: `frontend/src/__tests__/App.test.tsx`
- Quick fix: `frontend/src/components/ShuttleMap.tsx` (extract `DEFAULT_CENTER = [13.7563, 100.5018]` constant)
- Quick fix: `frontend/src/components/__tests__/ShuttleMap.test.tsx` (change `.toBeDefined()` to `.not.toBeNull()`)

## Interfaces:
- Consumes:
  - `useShuttleTelemetry` from `frontend/src/hooks/useShuttleTelemetry.ts`
  - `FleetPanel` from `frontend/src/components/FleetPanel.tsx`
  - `ShuttleMap` from `frontend/src/components/ShuttleMap.tsx`
  - `TelemetryHUD` from `frontend/src/components/TelemetryHUD.tsx`
- Props for `TelemetryHUD`:
  ```typescript
  interface TelemetryHUDProps {
    telemetry: TelemetryPayload | null;
    status: ConnectionStatus;
    lastSeen: number | null;
    totalVehicles?: number;
  }
  ```

## Global Constraints:
- Clean integration in `App.tsx`: Header, FleetPanel, TelemetryHUD, ShuttleMap.
- TelemetryHUD displays overview stats when in fleet overview mode (`selectedVehicleId === null`), and vehicle-specific stats when a vehicle is focused.
- All existing and new tests must pass with 100% success rate.
- TypeScript compiler and Vite build must be clean with 0 warnings or errors.

## Steps:

### Step 1: Update `frontend/src/components/TelemetryHUD.tsx`
```tsx
import React from 'react';
import { Gauge, Radio, Clock, Compass, Bus } from 'lucide-react';
import { ConnectionStatus, TelemetryPayload } from '../types/telemetry';

interface TelemetryHUDProps {
  telemetry: TelemetryPayload | null;
  status: ConnectionStatus;
  lastSeen: number | null;
  totalVehicles?: number;
}

export const TelemetryHUD: React.FC<TelemetryHUDProps> = ({
  telemetry,
  status,
  lastSeen,
  totalVehicles = 0,
}) => {
  const getStatusColor = (s: ConnectionStatus) => {
    switch (s) {
      case 'connected':
        return 'bg-emerald-500 text-emerald-700 border-emerald-200';
      case 'connecting':
        return 'bg-amber-500 text-amber-700 border-amber-200 animate-pulse';
      case 'disconnected':
      case 'error':
        return 'bg-rose-500 text-rose-700 border-rose-200';
    }
  };

  const formatLastSeen = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 2) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-[92vw] max-w-xl">
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 text-white px-5 py-4 rounded-2xl shadow-2xl flex flex-wrap items-center justify-between gap-4">
        {/* Status & Vehicle Info */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-3 w-3">
            {status === 'connected' && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span className={`relative inline-flex rounded-full h-3 w-3 ${getStatusColor(status).split(' ')[0]}`}></span>
          </div>
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5" />
              <span>Broker: {status}</span>
            </div>
            <div className="text-sm font-bold tracking-tight text-white flex items-center gap-1 mt-0.5">
              <Bus className="w-4 h-4 text-emerald-400" />
              <span>{telemetry ? telemetry.vehicle_id : `Overview (${totalVehicles} online)`}</span>
            </div>
          </div>
        </div>

        {/* Telemetry Metrics */}
        <div className="flex items-center gap-6 border-l border-slate-800 pl-6">
          {/* Speed */}
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-800/80 rounded-xl text-emerald-400">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Speed</div>
              <div className="text-lg font-bold font-mono text-white leading-none">
                {telemetry ? telemetry.speed.toFixed(1) : '--'}
                <span className="text-xs font-normal text-slate-400 ml-1">km/h</span>
              </div>
            </div>
          </div>

          {/* Heading */}
          <div className="hidden sm:flex items-center gap-2.5">
            <div className="p-2 bg-slate-800/80 rounded-xl text-sky-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Heading</div>
              <div className="text-lg font-bold font-mono text-white leading-none">
                {telemetry?.heading !== undefined ? `${telemetry.heading}°` : '--'}
              </div>
            </div>
          </div>

          {/* Last Seen */}
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-800/80 rounded-xl text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Heartbeat</div>
              <div className="text-xs font-bold font-mono text-white leading-none">
                {formatLastSeen(lastSeen)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
```

### Step 2: Update `frontend/src/App.tsx`
```tsx
import { useShuttleTelemetry } from './hooks/useShuttleTelemetry';
import { ShuttleMap } from './components/ShuttleMap';
import { TelemetryHUD } from './components/TelemetryHUD';
import { FleetPanel } from './components/FleetPanel';
import { Bus } from 'lucide-react';

export function App() {
  const {
    status,
    vehicles,
    lastSeenMap,
    selectedVehicleId,
    setSelectedVehicleId,
    telemetry,
    lastSeen,
  } = useShuttleTelemetry();

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-900 select-none">
      {/* Top minimal header brand */}
      <div className="absolute top-4 left-4 z-[1000] flex items-center gap-2.5 bg-white/95 backdrop-blur-sm border border-slate-200/80 px-3.5 py-2 rounded-xl shadow-md">
        <div className="p-1.5 bg-slate-900 text-white rounded-lg">
          <Bus className="w-4 h-4" />
        </div>
        <div>
          <h1 className="text-xs font-bold uppercase tracking-wider text-slate-800">Shuttle Tracker</h1>
          <p className="text-[10px] text-slate-400 font-mono">Multi-Vehicle Fleet Gateway</p>
        </div>
      </div>

      {/* Fleet Overview & Selector Panel */}
      <FleetPanel
        vehicles={vehicles}
        lastSeenMap={lastSeenMap}
        selectedVehicleId={selectedVehicleId}
        onSelectVehicle={setSelectedVehicleId}
      />

      {/* Floating HUD Card */}
      <TelemetryHUD
        telemetry={selectedVehicleId ? vehicles[selectedVehicleId] || null : telemetry}
        status={status}
        lastSeen={lastSeen}
        totalVehicles={Object.keys(vehicles).length}
      />

      {/* Interactive Map */}
      <ShuttleMap
        vehicles={vehicles}
        selectedVehicleId={selectedVehicleId}
        onSelectVehicle={setSelectedVehicleId}
        defaultCenter={[13.7563, 100.5018]}
        zoom={14}
      />
    </div>
  );
}

export default App;
```

### Step 3: Update `TelemetryHUD.test.tsx` and `App.test.tsx`
In `TelemetryHUD.test.tsx`:
Add a test verifying fleet overview mode renders `Overview (2 online)`.

In `App.test.tsx`:
Verify `App` renders without crashing with header, `Fleet Status`, and `leaflet-container`.

In `ShuttleMap.tsx`:
Extract `const DEFAULT_CENTER: [number, number] = [13.7563, 100.5018];` and use it as default parameter for `defaultCenter = DEFAULT_CENTER`.

In `ShuttleMap.test.tsx`:
Change `expect(container.querySelector('.leaflet-container')).toBeDefined();` to `expect(container.querySelector('.leaflet-container')).not.toBeNull();`.

### Step 4: Run full test suite and build
Run: `cd frontend; npm test -- --run`
Expected: 100% pass across all test suites.

Run: `cd frontend; npm run build`
Expected: Clean build.

### Step 5: Commit
```bash
git add frontend/src/components/TelemetryHUD.tsx frontend/src/App.tsx frontend/src/components/__tests__/TelemetryHUD.test.tsx frontend/src/__tests__/App.test.tsx frontend/src/components/ShuttleMap.tsx frontend/src/components/__tests__/ShuttleMap.test.tsx
git commit -m "feat: integrate FleetPanel and multi-vehicle HUD into App"
```
