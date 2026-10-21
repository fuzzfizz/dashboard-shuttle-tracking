# Multi-Vehicle Fleet Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the shuttle tracking dashboard from single-vehicle tracking to full multi-vehicle fleet tracking with a shared overview map (`fitBounds`), interactive vehicle selection, and a live fleet status panel.

**Architecture:** Extend MQTT ingestion in `useShuttleTelemetry` to index vehicles by `vehicle_id`. The interactive Leaflet map renders directional markers with badges for all active shuttles and uses a smart camera controller (fit bounds for overview, panTo for focused shuttle). A responsive `FleetPanel` displays vehicle status and allows one-click switching between individual shuttles and the fleet overview.

**Tech Stack:** React 18, TypeScript, Leaflet / React-Leaflet, TailwindCSS, MQTT.js, Vitest, Testing Library.

## Global Constraints

- Preserve all existing environment variable names (`VITE_MQTT_BROKER_URL`, `VITE_MQTT_TOPIC`).
- MQTT wildcards: Web client subscribes to `shuttle/fleet/v1/+/telemetry`.
- Stale threshold: Vehicles that have not reported for > 15,000ms (15 seconds) are marked stale / offline.
- Backward compatibility: Retain `telemetry` field on `useShuttleTelemetry` for seamless transition.
- Vitest test suites must pass 100% with no regressions.

---

### Task 1: Extend Telemetry Types and Fleet Status Helpers

**Files:**
- Modify: `frontend/src/types/telemetry.ts`
- Create: `frontend/src/services/fleetStatus.ts`
- Create: `frontend/src/services/__tests__/fleetStatus.test.ts`

**Interfaces:**
- Consumes: `TelemetryPayload` from `frontend/src/types/telemetry.ts`
- Produces: `FleetMap`, `VehicleStatus`, `OFFLINE_THRESHOLD_MS`, `computeVehicleStatus()`, `calculateFleetStats()`

- [ ] **Step 1: Write failing unit tests for fleet status helpers**

Create `frontend/src/services/__tests__/fleetStatus.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeVehicleStatus, calculateFleetStats } from '../fleetStatus';
import { TelemetryPayload } from '../../types/telemetry';

describe('fleetStatus helpers', () => {
  const mockTelemetry1: TelemetryPayload = {
    vehicle_id: 'shuttle-01',
    lat: 13.7563,
    lng: 100.5018,
    speed: 30.0,
    heading: 90,
    timestamp: 1000,
  };

  const mockTelemetry2: TelemetryPayload = {
    vehicle_id: 'shuttle-02',
    lat: 13.7600,
    lng: 100.5100,
    speed: 10.0,
    heading: 180,
    timestamp: 1000,
  };

  it('computes online status correctly within 15 seconds threshold', () => {
    const now = 20000;
    const online = computeVehicleStatus(mockTelemetry1, now - 5000, now);
    expect(online.isOnline).toBe(true);

    const offline = computeVehicleStatus(mockTelemetry1, now - 20000, now);
    expect(offline.isOnline).toBe(false);
  });

  it('calculates fleet statistics correctly', () => {
    const fleet = {
      'shuttle-01': mockTelemetry1,
      'shuttle-02': mockTelemetry2,
    };
    const lastSeenMap = {
      'shuttle-01': 10000,
      'shuttle-02': 2000, // Offline if now is 20000
    };
    const stats = calculateFleetStats(fleet, lastSeenMap, 20000);
    expect(stats.totalVehicles).toBe(2);
    expect(stats.onlineVehicles).toBe(1);
    expect(stats.averageSpeed).toBe(20.0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npx vitest run src/services/__tests__/fleetStatus.test.ts`  
Expected: FAIL with "Cannot find module '../fleetStatus'"

- [ ] **Step 3: Update `frontend/src/types/telemetry.ts`**

Edit `frontend/src/types/telemetry.ts`:

```typescript
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface TelemetryPayload {
  vehicle_id: string;
  lat: number;
  lng: number;
  speed: number;
  heading?: number;
  timestamp: number;
}

export type FleetMap = Record<string, TelemetryPayload>;

export interface VehicleStatus {
  telemetry: TelemetryPayload;
  lastSeen: number;
  isOnline: boolean;
}

export interface FleetStats {
  totalVehicles: number;
  onlineVehicles: number;
  averageSpeed: number;
}

export interface UseShuttleTelemetryOptions {
  brokerUrl?: string;
  topic?: string;
  username?: string;
  password?: string;
}
```

- [ ] **Step 4: Implement `frontend/src/services/fleetStatus.ts`**

Create `frontend/src/services/fleetStatus.ts`:

```typescript
import { FleetMap, FleetStats, TelemetryPayload, VehicleStatus } from '../types/telemetry';

export const OFFLINE_THRESHOLD_MS = 15000;

export function computeVehicleStatus(
  telemetry: TelemetryPayload,
  lastSeen: number,
  now: number = Date.now()
): VehicleStatus {
  return {
    telemetry,
    lastSeen,
    isOnline: now - lastSeen < OFFLINE_THRESHOLD_MS,
  };
}

export function calculateFleetStats(
  fleet: FleetMap,
  lastSeenMap: Record<string, number>,
  now: number = Date.now()
): FleetStats {
  const vehicleList = Object.values(fleet);
  if (vehicleList.length === 0) {
    return { totalVehicles: 0, onlineVehicles: 0, averageSpeed: 0 };
  }

  let onlineCount = 0;
  let totalSpeed = 0;

  for (const v of vehicleList) {
    const lastSeen = lastSeenMap[v.vehicle_id] || 0;
    if (now - lastSeen < OFFLINE_THRESHOLD_MS) {
      onlineCount++;
    }
    totalSpeed += v.speed;
  }

  return {
    totalVehicles: vehicleList.length,
    onlineVehicles: onlineCount,
    averageSpeed: Math.round((totalSpeed / vehicleList.length) * 10) / 10,
  };
}
```

- [ ] **Step 5: Run tests and verify they pass**

Run: `cd frontend; npx vitest run src/services/__tests__/fleetStatus.test.ts`  
Expected: PASS (2 tests passed)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/telemetry.ts frontend/src/services/fleetStatus.ts frontend/src/services/__tests__/fleetStatus.test.ts
git commit -m "feat: add fleet status helpers and multi-vehicle types"
```

---

### Task 2: Upgrade `useShuttleTelemetry` Hook for Multi-Vehicle Ingestion

**Files:**
- Modify: `frontend/src/hooks/useShuttleTelemetry.ts`
- Create: `frontend/src/hooks/__tests__/useShuttleTelemetry.test.ts`

**Interfaces:**
- Consumes: `TelemetryPayload`, `FleetMap`, `ConnectionStatus`
- Produces: `{ status, vehicles, selectedVehicleId, setSelectedVehicleId, telemetry, lastSeenMap }`

- [ ] **Step 1: Write failing unit test for `useShuttleTelemetry`**

Create `frontend/src/hooks/__tests__/useShuttleTelemetry.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useShuttleTelemetry } from '../useShuttleTelemetry';

const mockMqttClient = {
  on: vi.fn(),
  subscribe: vi.fn(),
  end: vi.fn(),
};

vi.mock('mqtt', () => ({
  default: {
    connect: vi.fn(() => mockMqttClient),
  },
}));

describe('useShuttleTelemetry', () => {
  let messageHandler: (topic: string, message: Buffer) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMqttClient.on.mockImplementation((event: string, handler: any) => {
      if (event === 'message') {
        messageHandler = handler;
      }
      return mockMqttClient;
    });
  });

  it('ingests multiple vehicles without overwriting each other', () => {
    const { result } = renderHook(() => useShuttleTelemetry());

    act(() => {
      messageHandler(
        'shuttle/fleet/v1/shuttle-01/telemetry',
        Buffer.from(
          JSON.stringify({
            vehicle_id: 'shuttle-01',
            lat: 13.75,
            lng: 100.5,
            speed: 20,
            timestamp: 1000,
          })
        )
      );
    });

    act(() => {
      messageHandler(
        'shuttle/fleet/v1/shuttle-02/telemetry',
        Buffer.from(
          JSON.stringify({
            vehicle_id: 'shuttle-02',
            lat: 13.76,
            lng: 100.51,
            speed: 25,
            timestamp: 2000,
          })
        )
      );
    });

    expect(Object.keys(result.current.vehicles)).toHaveLength(2);
    expect(result.current.vehicles['shuttle-01'].speed).toBe(20);
    expect(result.current.vehicles['shuttle-02'].speed).toBe(25);
  });

  it('allows selecting a vehicle and switching back to overview', () => {
    const { result } = renderHook(() => useShuttleTelemetry());

    expect(result.current.selectedVehicleId).toBeNull();

    act(() => {
      result.current.setSelectedVehicleId('shuttle-01');
    });
    expect(result.current.selectedVehicleId).toBe('shuttle-01');

    act(() => {
      result.current.setSelectedVehicleId(null);
    });
    expect(result.current.selectedVehicleId).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npx vitest run src/hooks/__tests__/useShuttleTelemetry.test.ts`  
Expected: FAIL with "Cannot read properties of undefined (reading 'vehicles')"

- [ ] **Step 3: Update `frontend/src/hooks/useShuttleTelemetry.ts`**

Edit `frontend/src/hooks/useShuttleTelemetry.ts`:

```typescript
import { useEffect, useState } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import { ConnectionStatus, FleetMap, TelemetryPayload, UseShuttleTelemetryOptions } from '../types/telemetry';
import { parseTelemetryPayload } from '../services/telemetryParser';

const DEFAULT_BROKER = import.meta.env.VITE_MQTT_BROKER_URL || 'wss://broker.emqx.io:8084/mqtt';
const DEFAULT_TOPIC = import.meta.env.VITE_MQTT_TOPIC || 'shuttle/fleet/v1/+/telemetry';
const DEFAULT_USERNAME = import.meta.env.VITE_MQTT_USERNAME;
const DEFAULT_PASSWORD = import.meta.env.VITE_MQTT_PASSWORD;

export function useShuttleTelemetry(options: UseShuttleTelemetryOptions = {}) {
  const brokerUrl = options.brokerUrl || DEFAULT_BROKER;
  const topic = options.topic || DEFAULT_TOPIC;
  const username = options.username || DEFAULT_USERNAME;
  const password = options.password || DEFAULT_PASSWORD;

  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [vehicles, setVehicles] = useState<FleetMap>({});
  const [lastSeenMap, setLastSeenMap] = useState<Record<string, number>>({});
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  useEffect(() => {
    setStatus('connecting');
    const client: MqttClient = mqtt.connect(brokerUrl, {
      clientId: `shuttle_web_${Math.random().toString(16).slice(2, 10)}`,
      clean: true,
      connectTimeout: 8000,
      reconnectPeriod: 3000,
      ...(username ? { username } : {}),
      ...(password ? { password } : {}),
    });

    client.on('connect', () => {
      setStatus('connected');
      client.subscribe(topic, (err) => {
        if (err) {
          console.error('MQTT subscribe error:', err);
          setStatus('error');
        }
      });
    });

    client.on('message', (_topic, message) => {
      const parsed = parseTelemetryPayload(message.toString());
      if (parsed) {
        const now = Date.now();
        setVehicles((prev) => ({
          ...prev,
          [parsed.vehicle_id]: parsed,
        }));
        setLastSeenMap((prev) => ({
          ...prev,
          [parsed.vehicle_id]: now,
        }));
      }
    });

    client.on('error', (err) => {
      console.error('MQTT client error:', err);
      setStatus('error');
    });

    client.on('close', () => {
      setStatus('disconnected');
    });

    client.on('reconnect', () => {
      setStatus('connecting');
    });

    return () => {
      client.end(true);
    };
  }, [brokerUrl, topic]);

  // Backward compatibility helper
  const selectedVehicle = selectedVehicleId ? vehicles[selectedVehicleId] || null : null;
  const fallbackVehicle = Object.values(vehicles)[0] || null;
  const telemetry: TelemetryPayload | null = selectedVehicle || fallbackVehicle;
  const lastSeen: number | null = telemetry ? lastSeenMap[telemetry.vehicle_id] || null : null;

  return {
    status,
    vehicles,
    lastSeenMap,
    selectedVehicleId,
    setSelectedVehicleId,
    telemetry,
    lastSeen,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend; npx vitest run src/hooks/__tests__/useShuttleTelemetry.test.ts`  
Expected: PASS (2 tests passed)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useShuttleTelemetry.ts frontend/src/hooks/__tests__/useShuttleTelemetry.test.ts
git commit -m "feat: upgrade useShuttleTelemetry for multi-vehicle fleet state"
```

---

### Task 3: Build `FleetPanel` Component

**Files:**
- Create: `frontend/src/components/FleetPanel.tsx`
- Create: `frontend/src/components/__tests__/FleetPanel.test.tsx`

**Interfaces:**
- Consumes: `FleetMap`, `Record<string, number>`, `selectedVehicleId: string | null`, `onSelectVehicle: (id: string | null) => void`
- Produces: Collapsible floating card on the right displaying fleet metrics and vehicle list

- [ ] **Step 1: Write failing unit test for `FleetPanel`**

Create `frontend/src/components/__tests__/FleetPanel.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FleetPanel } from '../FleetPanel';
import { FleetMap } from '../../types/telemetry';

describe('FleetPanel', () => {
  const mockFleet: FleetMap = {
    'shuttle-01': {
      vehicle_id: 'shuttle-01',
      lat: 13.75,
      lng: 100.5,
      speed: 32.5,
      heading: 90,
      timestamp: 1000,
    },
    'shuttle-02': {
      vehicle_id: 'shuttle-02',
      lat: 13.76,
      lng: 100.51,
      speed: 0.0,
      heading: 180,
      timestamp: 1000,
    },
  };

  const lastSeenMap = {
    'shuttle-01': Date.now(),
    'shuttle-02': Date.now(),
  };

  it('renders vehicle list correctly', () => {
    render(
      <FleetPanel
        vehicles={mockFleet}
        lastSeenMap={lastSeenMap}
        selectedVehicleId={null}
        onSelectVehicle={vi.fn()}
      />
    );

    expect(screen.getByText('shuttle-01')).toBeDefined();
    expect(screen.getByText('shuttle-02')).toBeDefined();
    expect(screen.getByText('32.5 km/h')).toBeDefined();
  });

  it('triggers onSelectVehicle when vehicle card is clicked', () => {
    const onSelect = vi.fn();
    render(
      <FleetPanel
        vehicles={mockFleet}
        lastSeenMap={lastSeenMap}
        selectedVehicleId={null}
        onSelectVehicle={onSelect}
      />
    );

    fireEvent.click(screen.getByText('shuttle-01'));
    expect(onSelect).toHaveBeenCalledWith('shuttle-01');
  });

  it('triggers onSelectVehicle(null) when overview button is clicked', () => {
    const onSelect = vi.fn();
    render(
      <FleetPanel
        vehicles={mockFleet}
        lastSeenMap={lastSeenMap}
        selectedVehicleId="shuttle-01"
        onSelectVehicle={onSelect}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /all vehicles|overview/i }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npx vitest run src/components/__tests__/FleetPanel.test.tsx`  
Expected: FAIL with "Cannot find module '../FleetPanel'"

- [ ] **Step 3: Implement `frontend/src/components/FleetPanel.tsx`**

Create `frontend/src/components/FleetPanel.tsx`:

```tsx
import React, { useState } from 'react';
import { Bus, Layers, Navigation, ChevronRight, ChevronDown, Radio } from 'lucide-react';
import { FleetMap } from '../types/telemetry';
import { computeVehicleStatus } from '../services/fleetStatus';

interface FleetPanelProps {
  vehicles: FleetMap;
  lastSeenMap: Record<string, number>;
  selectedVehicleId: string | null;
  onSelectVehicle: (vehicleId: string | null) => void;
}

export const FleetPanel: React.FC<FleetPanelProps> = ({
  vehicles,
  lastSeenMap,
  selectedVehicleId,
  onSelectVehicle,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const vehicleList = Object.values(vehicles);
  const totalCount = vehicleList.length;

  return (
    <div className="absolute top-4 right-4 z-[1000] w-72 max-w-[calc(100vw-2rem)] flex flex-col gap-2">
      <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xl overflow-hidden transition-all duration-300">
        {/* Panel Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-emerald-500/10 text-emerald-600 rounded-lg">
              <Bus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Fleet Status</h2>
              <p className="text-[10px] text-slate-500 font-medium">
                {totalCount} {totalCount === 1 ? 'vehicle' : 'vehicles'} active
              </p>
            </div>
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
            className="p-1 hover:bg-slate-200/60 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {!collapsed && (
          <div className="p-2 space-y-1.5 max-h-[60vh] overflow-y-auto">
            {/* View All / Overview Button */}
            <button
              onClick={() => onSelectVehicle(null)}
              aria-label="All Vehicles (Overview)"
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                selectedVehicleId === null
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100/80'
              }`}
            >
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>All Vehicles (Overview)</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/20">
                Fit View
              </span>
            </button>

            {/* Vehicle List */}
            {totalCount === 0 ? (
              <div className="py-6 px-4 text-center">
                <Radio className="w-6 h-6 text-slate-300 mx-auto mb-2 animate-pulse" />
                <p className="text-xs text-slate-500 font-medium">Listening for vehicles...</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Publish telemetry to see fleet</p>
              </div>
            ) : (
              vehicleList.map((vehicle) => {
                const status = computeVehicleStatus(vehicle, lastSeenMap[vehicle.vehicle_id] || 0);
                const isSelected = selectedVehicleId === vehicle.vehicle_id;

                return (
                  <div
                    key={vehicle.vehicle_id}
                    onClick={() => onSelectVehicle(vehicle.vehicle_id)}
                    className={`group cursor-pointer flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/60 shadow-sm'
                        : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="relative flex h-2.5 w-2.5">
                        {status.isOnline && (
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        )}
                        <span
                          className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                            status.isOnline ? 'bg-emerald-500' : 'bg-amber-400'
                          }`}
                        ></span>
                      </span>
                      <div className="truncate">
                        <div className="text-xs font-bold text-slate-800 truncate">
                          {vehicle.vehicle_id}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                          <Navigation className="w-2.5 h-2.5" />
                          <span>{vehicle.heading ?? 0}°</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-slate-900">
                        {vehicle.speed.toFixed(1)} km/h
                      </div>
                      <div className="text-[9px] text-slate-400">
                        {status.isOnline ? 'Live' : 'Stale'}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend; npx vitest run src/components/__tests__/FleetPanel.test.tsx`  
Expected: PASS (3 tests passed)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/FleetPanel.tsx frontend/src/components/__tests__/FleetPanel.test.tsx
git commit -m "feat: add interactive FleetPanel component"
```

---

### Task 4: Upgrade `ShuttleMap` for Multi-Vehicle Markers & Smart Camera

**Files:**
- Modify: `frontend/src/components/ShuttleMap.tsx`
- Modify: `frontend/src/components/__tests__/ShuttleMap.test.tsx`

**Interfaces:**
- Consumes: `vehicles: FleetMap`, `selectedVehicleId: string | null`, `onSelectVehicle?: (id: string) => void`, `defaultCenter?: [number, number]`, `zoom?: number`
- Produces: Leaflet map with multi-vehicle directional icons, vehicle labels, click handlers, and camera fitBounds / panTo controller.

- [ ] **Step 1: Write failing unit test for multi-vehicle `ShuttleMap`**

Update `frontend/src/components/__tests__/ShuttleMap.test.tsx`:

```typescript
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ShuttleMap } from '../ShuttleMap';
import { FleetMap } from '../../types/telemetry';

describe('ShuttleMap', () => {
  it('renders map container without crashing', () => {
    const { container } = render(<ShuttleMap vehicles={{}} selectedVehicleId={null} />);
    expect(container.querySelector('.leaflet-container')).toBeDefined();
  });

  it('renders with multiple vehicles provided', () => {
    const vehicles: FleetMap = {
      'EV-01': {
        vehicle_id: 'EV-01',
        lat: 13.7563,
        lng: 100.5018,
        speed: 25.5,
        heading: 90,
        timestamp: 1713600000000,
      },
      'EV-02': {
        vehicle_id: 'EV-02',
        lat: 13.7600,
        lng: 100.5100,
        speed: 15.0,
        heading: 180,
        timestamp: 1713600000000,
      },
    };
    const { container } = render(
      <ShuttleMap vehicles={vehicles} selectedVehicleId={null} onSelectVehicle={vi.fn()} />
    );
    expect(container.querySelector('.leaflet-container')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npx vitest run src/components/__tests__/ShuttleMap.test.tsx`  
Expected: FAIL or type mismatch

- [ ] **Step 3: Implement multi-vehicle `ShuttleMap.tsx`**

Edit `frontend/src/components/ShuttleMap.tsx`:

```tsx
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { FleetMap, TelemetryPayload } from '../types/telemetry';

// OpenStreetMap standard tile layer
const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const cartoKey = import.meta.env.VITE_CARTO_API_KEY;
const customTileUrl = import.meta.env.VITE_TILE_URL;

const tileUrl = customTileUrl
  ? customTileUrl
  : cartoKey
    ? `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${cartoKey}`
    : OSM_URL;

const tileAttribution = cartoKey
  ? '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  : OSM_ATTRIBUTION;

interface ShuttleMapProps {
  vehicles?: FleetMap;
  selectedVehicleId?: string | null;
  onSelectVehicle?: (vehicleId: string) => void;
  // Backward compatibility prop
  telemetry?: TelemetryPayload | null;
  defaultCenter?: [number, number];
  zoom?: number;
}

// Camera controller: handles overview (fitBounds) or focused tracking (panTo)
const FleetCameraController: React.FC<{
  vehicles: FleetMap;
  selectedVehicleId: string | null;
  defaultCenter: [number, number];
}> = ({ vehicles, selectedVehicleId, defaultCenter }) => {
  const map = useMap();

  useEffect(() => {
    const vehicleList = Object.values(vehicles);

    if (selectedVehicleId && vehicles[selectedVehicleId]) {
      // Focus Mode: follow single vehicle
      const target = vehicles[selectedVehicleId];
      map.panTo([target.lat, target.lng], { animate: true, duration: 0.8 });
    } else if (vehicleList.length > 1) {
      // Fleet Overview Mode: fit all active vehicles with padding
      const bounds = L.latLngBounds(vehicleList.map((v) => [v.lat, v.lng]));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16, animate: true });
    } else if (vehicleList.length === 1) {
      // Single vehicle active: pan to it
      map.panTo([vehicleList[0].lat, vehicleList[0].lng], { animate: true, duration: 0.8 });
    } else {
      // Empty fleet: reset to default city center
      map.panTo(defaultCenter, { animate: true });
    }
  }, [vehicles, selectedVehicleId, map, defaultCenter]);

  return null;
};

// SVG vehicle marker with direction arrow and vehicle badge
function createVehicleIcon(heading: number = 0, isSelected: boolean = false, vehicleId: string = '') {
  const borderColor = isSelected ? '#10b981' : '#ffffff';
  const pulseClass = isSelected ? 'background: rgba(16, 185, 129, 0.4);' : 'background: rgba(16, 185, 129, 0.2);';

  const html = `
    <div style="position: relative; width: 44px; height: 44px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
      <!-- Vehicle ID Pill Badge -->
      <div style="position: absolute; top: -14px; background: rgba(15, 23, 42, 0.9); color: #ffffff; font-size: 9px; font-weight: bold; font-family: monospace; padding: 1px 5px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2); pointer-events: none;">
        ${vehicleId}
      </div>
      <!-- Pulse Ring -->
      <div style="position: absolute; width: 38px; height: 38px; ${pulseClass} border-radius: 9999px; animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></div>
      <!-- Rotational Body -->
      <div style="position: relative; width: 28px; height: 28px; background: #0f172a; border: 2.5px solid ${borderColor}; border-radius: 9999px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3); display: flex; align-items: center; justify-content: center; transform: rotate(${heading}deg); transition: transform 0.4s ease;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>
        </svg>
      </div>
    </div>
  `;
  return L.divIcon({
    html,
    className: 'custom-vehicle-marker',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

export const ShuttleMap: React.FC<ShuttleMapProps> = ({
  vehicles = {},
  selectedVehicleId = null,
  onSelectVehicle,
  telemetry,
  defaultCenter = [13.7563, 100.5018],
  zoom = 15,
}) => {
  // Merge backward compatibility prop `telemetry` if vehicles is empty
  const effectiveVehicles: FleetMap =
    Object.keys(vehicles).length > 0
      ? vehicles
      : telemetry
        ? { [telemetry.vehicle_id]: telemetry }
        : {};

  const vehicleList = Object.values(effectiveVehicles);

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={defaultCenter}
        zoom={zoom}
        zoomControl={false}
        className="w-full h-full"
      >
        <TileLayer
          attribution={tileAttribution}
          url={tileUrl}
          maxZoom={19}
        />

        {/* Camera auto controller */}
        <FleetCameraController
          vehicles={effectiveVehicles}
          selectedVehicleId={selectedVehicleId}
          defaultCenter={defaultCenter}
        />

        {/* Render vehicle markers */}
        {vehicleList.map((v) => {
          const isSelected = selectedVehicleId === v.vehicle_id;
          return (
            <Marker
              key={v.vehicle_id}
              position={[v.lat, v.lng]}
              icon={createVehicleIcon(v.heading ?? 0, isSelected, v.vehicle_id)}
              eventHandlers={{
                click: () => onSelectVehicle?.(v.vehicle_id),
              }}
            >
              <Tooltip direction="top" offset={[0, -20]} opacity={0.95}>
                <div className="text-xs font-sans">
                  <strong>{v.vehicle_id}</strong>
                  <br />
                  Speed: {v.speed.toFixed(1)} km/h
                </div>
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend; npx vitest run src/components/__tests__/ShuttleMap.test.tsx`  
Expected: PASS (2 tests passed)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ShuttleMap.tsx frontend/src/components/__tests__/ShuttleMap.test.tsx
git commit -m "feat: upgrade ShuttleMap with multi-vehicle directional markers and smart camera"
```

---

### Task 5: Upgrade `TelemetryHUD` and Integrate Multi-Vehicle Fleet in `App.tsx`

**Files:**
- Modify: `frontend/src/components/TelemetryHUD.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/__tests__/TelemetryHUD.test.tsx`
- Modify: `frontend/src/__tests__/App.test.tsx`

**Interfaces:**
- Consumes: `useShuttleTelemetry()`, `FleetPanel`, `ShuttleMap`, `TelemetryHUD`
- Produces: Integrated responsive dashboard with HUD toggling between Fleet Overview and focused vehicle metrics.

- [ ] **Step 1: Update `TelemetryHUD.tsx` to support fleet metrics**

Update `frontend/src/components/TelemetryHUD.tsx`:

```tsx
import React from 'react';
import { Gauge, Radio, Clock, Compass, Activity, Bus } from 'lucide-react';
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

- [ ] **Step 2: Update `frontend/src/App.tsx`**

Edit `frontend/src/App.tsx`:

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

- [ ] **Step 3: Run all unit and integration tests**

Run: `cd frontend; npm test -- --run`  
Expected: PASS (All test suites pass)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/TelemetryHUD.tsx frontend/src/App.tsx
git commit -m "feat: integrate FleetPanel and multi-vehicle telemetry in App"
```

---

### Task 6: Upgrade Telemetry Simulator for Multi-Vehicle Fleet

**Files:**
- Modify: `tools/simulate.js`

**Interfaces:**
- Produces: Live multi-vehicle MQTT simulation publishing coordinates for `shuttle-01` and `shuttle-02` simultaneously.

- [ ] **Step 1: Update `tools/simulate.js`**

Edit `tools/simulate.js` to simulate multiple vehicles concurrently:

```javascript
import mqtt from 'mqtt';

const BROKER = process.env.MQTT_BROKER || 'mqtt://broker.emqx.io:1883';
const BASE_TOPIC = 'shuttle/fleet/v1';

console.log(`Connecting to ${BROKER}...`);
const client = mqtt.connect(BROKER, {
  clientId: `sim_fleet_${Math.random().toString(16).slice(2, 8)}`,
});

// Configure 2 distinct test shuttles in Bangkok
const vehicles = [
  {
    id: 'shuttle-01',
    lat: 13.7563,
    lng: 100.5018,
    speed: 28.0,
    heading: 45.0,
    speedDelta: 3.5,
  },
  {
    id: 'shuttle-02',
    lat: 13.7460,
    lng: 100.5340,
    speed: 18.5,
    heading: 135.0,
    speedDelta: 2.5,
  },
];

client.on('connect', () => {
  console.log(`Connected to broker!`);
  console.log(`Simulating fleet of ${vehicles.length} shuttles:`);
  vehicles.forEach((v) => console.log(` - ${v.id} -> ${BASE_TOPIC}/${v.id}/telemetry`));
  console.log(`Press Ctrl+C to stop simulation.\n`);

  setInterval(() => {
    vehicles.forEach((v) => {
      // Move vehicle smoothly
      v.lat += (Math.random() - 0.48) * 0.0003;
      v.lng += (Math.random() - 0.48) * 0.0003;
      v.speed = Math.max(5.0, Math.min(65.0, v.speed + (Math.random() - 0.5) * v.speedDelta));
      v.heading = (v.heading + (Math.random() - 0.5) * 8.0 + 360) % 360;

      const payload = {
        vehicle_id: v.id,
        lat: parseFloat(v.lat.toFixed(6)),
        lng: parseFloat(v.lng.toFixed(6)),
        speed: parseFloat(v.speed.toFixed(1)),
        heading: parseFloat(v.heading.toFixed(1)),
        timestamp: Date.now(),
      };

      const topic = `${BASE_TOPIC}/${v.id}/telemetry`;
      client.publish(topic, JSON.stringify(payload), { qos: 0 });
      console.log(`[${new Date().toLocaleTimeString()}] ${v.id}: ${payload.lat}, ${payload.lng} | ${payload.speed} km/h`);
    });
  }, 1500);
});

client.on('error', (err) => {
  console.error('MQTT connection error:', err);
});
```

- [ ] **Step 2: Commit**

```bash
git add tools/simulate.js
git commit -m "feat(tools): simulate multi-vehicle fleet telemetry concurrently"
```

---

### Task 7: Full Verification and Build Validation

- [ ] **Step 1: Run complete test suite**

Run: `cd frontend; npm test -- --run`  
Expected: All tests pass.

- [ ] **Step 2: Run type check and production build**

Run: `cd frontend; npm run build`  
Expected: Clean build without TypeScript or bundling errors.

- [ ] **Step 3: Commit and push**

```bash
git add -A
git commit -m "chore: verify build and multi-vehicle integration"
```
