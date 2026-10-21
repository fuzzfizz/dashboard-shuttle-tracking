# Task 4 Brief: UI Updates - Daily Distance in FleetPanel & DailyMetricsModal

## Files:
- Create: `frontend/src/components/DailyMetricsModal.tsx`
- Create: `frontend/src/components/__tests__/DailyMetricsModal.test.tsx`
- Modify: `frontend/src/components/FleetPanel.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/__tests__/FleetPanel.test.tsx`

## Interfaces:
- In `frontend/src/components/DailyMetricsModal.tsx`:
  ```typescript
  interface DailyMetricsModalProps {
    isOpen: boolean;
    onClose: () => void;
    dailyMetrics: DailyMetricsMap;
    totalFleetDistanceKm: number;
  }
  ```
- In `frontend/src/components/FleetPanel.tsx`:
  Extend `FleetPanelProps`:
  ```typescript
  interface FleetPanelProps {
    vehicles: FleetMap;
    lastSeenMap: Record<string, number>;
    selectedVehicleId: string | null;
    onSelectVehicle: (vehicleId: string | null) => void;
    now?: number;
    dailyMetrics?: DailyMetricsMap;
    onOpenAnalytics?: () => void;
  }
  ```

## Global Constraints:
- Under each vehicle card in `FleetPanel`, render the vehicle's daily distance:
  `📍 {distanceKm.toFixed(1)} km`
- Add an "Analytics" button with an icon (e.g. `BarChart3` or `Route`) in `FleetPanel` header to trigger `onOpenAnalytics`.
- `DailyMetricsModal`:
  - When `isOpen` is true, renders fixed backdrop overlay and dialog.
  - Shows 3 top cards: Total Distance (`km`), Max Speed (`km/h`), and Tracked Units.
  - Shows breakdown table with vehicle cards displaying distance, max speed, and active minutes.
  - Close button calls `onClose`.
  - When `isOpen` is false, returns `null`.
- In `App.tsx`:
  - Invoke `const { dailyMetrics, totalFleetDistanceKm } = useDailyMetrics(vehicles);`
  - Track `const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);`
  - Pass `dailyMetrics` and `onOpenAnalytics={() => setIsAnalyticsOpen(true)}` to `FleetPanel`.
  - Render `<DailyMetricsModal isOpen={isAnalyticsOpen} onClose={() => setIsAnalyticsOpen(false)} dailyMetrics={dailyMetrics} totalFleetDistanceKm={totalFleetDistanceKm} />`.
- All tests must pass with clean output.

## Steps:

### Step 1: Create `frontend/src/components/DailyMetricsModal.tsx`
```tsx
import React from 'react';
import { X, Calendar, Route, Gauge, Bus, Clock } from 'lucide-react';
import { DailyMetricsMap } from '../types/metrics';

interface DailyMetricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  dailyMetrics: DailyMetricsMap;
  totalFleetDistanceKm: number;
}

export const DailyMetricsModal: React.FC<DailyMetricsModalProps> = ({
  isOpen,
  onClose,
  dailyMetrics,
  totalFleetDistanceKm,
}) => {
  if (!isOpen) return null;

  const metricList = Object.values(dailyMetrics);
  const totalVehicles = metricList.length;
  const maxSpeedOverall = metricList.reduce((max, m) => Math.max(max, m.max_speed_kmh), 0);
  const totalMinutes = metricList.reduce((sum, m) => sum + m.active_minutes, 0);

  const formatHours = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 text-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <Route className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white">Daily Fleet Analytics</h2>
              <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Today ({new Date().toLocaleDateString()})</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-3 gap-3 p-6 border-b border-slate-800/80 bg-slate-900/50">
          <div className="bg-slate-800/50 border border-slate-800 p-3.5 rounded-2xl">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Total Distance</div>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
              {totalFleetDistanceKm.toFixed(1)} <span className="text-xs font-normal text-slate-400">km</span>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-800 p-3.5 rounded-2xl">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Max Speed</div>
            <div className="text-xl font-bold font-mono text-sky-400 mt-1">
              {maxSpeedOverall.toFixed(1)} <span className="text-xs font-normal text-slate-400">km/h</span>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-800 p-3.5 rounded-2xl">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Tracked Units</div>
            <div className="text-xl font-bold font-mono text-amber-400 mt-1">
              {totalVehicles} <span className="text-xs font-normal text-slate-400">shuttles</span>
            </div>
          </div>
        </div>

        {/* Vehicles Breakdown Table */}
        <div className="p-6 overflow-y-auto flex-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Vehicle Mileage Breakdown</h3>
          {metricList.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              No mileage recorded for today yet. Telemetry will calculate distance as vehicles travel.
            </div>
          ) : (
            <div className="space-y-2">
              {metricList.map((m) => (
                <div
                  key={m.vehicle_id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/40 border border-slate-800/80"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-slate-800 text-emerald-400 rounded-lg">
                      <Bus className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white font-mono">{m.vehicle_id}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-0.5">
                          <Gauge className="w-3 h-3 text-sky-400" />
                          Max: {m.max_speed_kmh.toFixed(1)} km/h
                        </span>
                        {m.active_minutes > 0 && (
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-3 h-3 text-amber-400" />
                            {formatHours(m.active_minutes)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-bold font-mono text-emerald-400">
                      {m.total_distance_km.toFixed(2)} km
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
```

### Step 2: Create `frontend/src/components/__tests__/DailyMetricsModal.test.tsx`
Write tests verifying open/close behavior, rendering summary cards, and vehicle mileage breakdown.

### Step 3: Update `frontend/src/components/FleetPanel.tsx` and `FleetPanel.test.tsx`
- Add distance badge `📍 {distanceKm.toFixed(1)} km` under vehicle card.
- Add an Analytics button in the header calling `onOpenAnalytics`.
- Update `FleetPanel.test.tsx` to verify distance display and onOpenAnalytics callback.

### Step 4: Update `frontend/src/App.tsx` and `App.test.tsx`
Wire `useDailyMetrics(vehicles)` and render `DailyMetricsModal`.

### Step 5: Verify and Commit
Run: `cd frontend && npm test -- --run`
Expected: 100% pass across all test suites.
Commit:
```bash
git add frontend/src/components/DailyMetricsModal.tsx frontend/src/components/__tests__/DailyMetricsModal.test.tsx frontend/src/components/FleetPanel.tsx frontend/src/App.tsx frontend/src/components/__tests__/FleetPanel.test.tsx
git commit -m "feat: display daily distance in FleetPanel and add DailyMetricsModal"
```
