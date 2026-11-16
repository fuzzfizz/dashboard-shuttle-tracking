# Planned Route & Live Path Tracking with Testing Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement planned route road geometry calculation via Longdo Route REST API, live GPS breadcrumb actual path plotting on Leaflet map, and an interactive floating test panel to pin pickup/dropoff points for each vehicle.

**Architecture:** A dedicated service (`tripRouteService.ts`) calculates road navigation routes via Longdo Route REST API with in-memory & localStorage caching, strictly called only once per trip assignment. A state hook (`useVehicleTripRoute.ts`) coordinates trips, in-memory live breadcrumb arrays from ESP32-S3 telemetry, and map click-pinning modes. Visual layers (`TripRouteOverlay.tsx`) render dashed planned paths, solid actual paths, and pin markers on Leaflet, controlled by a floating test panel (`TripTestPanel.tsx`).

**Tech Stack:** React 18, TypeScript, Leaflet (`react-leaflet`), Vitest, Testing Library, Tailwind CSS, Lucide React, Longdo Route REST API.

## Global Constraints
- Longdo Route REST API: `https://api.longdo.com/RouteService/json/route/guide`
- Default API Key: Same as map provider (`72ba939d7a7166c36d59b88d0b125307`)
- Strict Zero-Loop Rule: Never invoke route search API inside telemetry loops or polling intervals
- On-Demand Rule: Do not query or display route lines until a vehicle is explicitly focused or opened
- Brand Palette: Primary Olive Green `#4a7c0b` / `#5c990e` (Actual Path), CMU Dok Rak Purple `#9e76b4` (Planned Route)
- Accessibility: Mobile touch targets meet `min-h-[44px]` standards

---

### Task 1: Trip Data Types & Longdo Route Guide Service

**Files:**
- Create: `frontend/src/types/trip.ts`
- Create: `frontend/src/services/tripRouteService.ts`
- Test: `frontend/src/services/__tests__/tripRouteService.test.ts`

**Interfaces:**
- Consumes: Longdo Route Guide REST API (`https://api.longdo.com/RouteService/json/route/guide`)
- Produces:
  ```typescript
  export interface TripLocation {
    lat: number;
    lng: number;
    name?: string;
  }

  export interface VehicleTrip {
    vehicleId: string;
    pickup: TripLocation;
    dropoff: TripLocation;
    plannedPath: Array<[number, number]>; // [lat, lng]
    distanceMeters?: number;
    durationSeconds?: number;
    createdAt: number;
  }

  export type MapPinMode = 'idle' | 'pick-pickup' | 'pick-dropoff';

  export async function calculateTripRoute(
    vehicleId: string,
    pickup: TripLocation,
    dropoff: TripLocation,
    apiKey?: string
  ): Promise<VehicleTrip>;

  export function getCachedTripRoute(
    vehicleId: string,
    pickup: TripLocation,
    dropoff: TripLocation
  ): VehicleTrip | null;

  export function clearTripRouteCache(vehicleId?: string): void;
  ```

- [ ] **Step 1: Write the failing unit tests for `tripRouteService`**

Create `frontend/src/services/__tests__/tripRouteService.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateTripRoute,
  getCachedTripRoute,
  clearTripRouteCache,
  parseLongdoGuideCoordinates,
} from '../tripRouteService';
import { TripLocation } from '../../types/trip';

describe('tripRouteService', () => {
  const pickup: TripLocation = { lat: 18.7883, lng: 98.9853, name: 'Faculty of Pharmacy' };
  const dropoff: TripLocation = { lat: 18.7900, lng: 98.9900, name: 'Maharaj Hospital' };

  beforeEach(() => {
    clearTripRouteCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearTripRouteCache();
  });

  it('parses coordinate pairs from Longdo Route guide data correctly', () => {
    const mockGuideData = {
      data: [
        { latitude: 18.7883, longitude: 98.9853 },
        { latitude: 18.7890, longitude: 98.9870 },
        { latitude: 18.7900, longitude: 98.9900 },
      ],
      distance: 1250,
      interval: 180,
    };

    const coords = parseLongdoGuideCoordinates(mockGuideData);
    expect(coords).toHaveLength(3);
    expect(coords[0]).toEqual([18.7883, 98.9853]);
    expect(coords[2]).toEqual([18.7900, 98.9900]);
  });

  it('fetches route from Longdo Route REST API and formats VehicleTrip on success', async () => {
    const mockResponse = {
      data: [
        { latitude: 18.7883, longitude: 98.9853 },
        { latitude: 18.7900, longitude: 98.9900 },
      ],
      distance: 850,
      interval: 120,
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const trip = await calculateTripRoute('EV-01', pickup, dropoff, 'mock-key');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('https://api.longdo.com/RouteService/json/route/guide?')
    );
    expect(trip.vehicleId).toBe('EV-01');
    expect(trip.plannedPath).toHaveLength(2);
    expect(trip.distanceMeters).toBe(850);
    expect(trip.durationSeconds).toBe(120);
  });

  it('serves cached route without making a network request when called with identical coordinates', async () => {
    const mockResponse = {
      data: [
        { latitude: 18.7883, longitude: 98.9853 },
        { latitude: 18.7900, longitude: 98.9900 },
      ],
      distance: 850,
      interval: 120,
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    // Call 1 -> Network fetch
    const trip1 = await calculateTripRoute('EV-01', pickup, dropoff, 'mock-key');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Call 2 -> Cache hit (0 requests)
    const trip2 = await calculateTripRoute('EV-01', pickup, dropoff, 'mock-key');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(trip2.plannedPath).toEqual(trip1.plannedPath);

    // Direct cache check
    const cached = getCachedTripRoute('EV-01', pickup, dropoff);
    expect(cached).not.toBeNull();
  });

  it('provides straight geodesic fallback path when network or API fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const trip = await calculateTripRoute('EV-01', pickup, dropoff, 'mock-key');
    expect(trip.vehicleId).toBe('EV-01');
    expect(trip.plannedPath).toEqual([
      [pickup.lat, pickup.lng],
      [dropoff.lat, dropoff.lng],
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npx vitest run src/services/__tests__/tripRouteService.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement `frontend/src/types/trip.ts`**

Create `frontend/src/types/trip.ts`:
```typescript
export interface TripLocation {
  lat: number;
  lng: number;
  name?: string;
}

export interface VehicleTrip {
  vehicleId: string;
  pickup: TripLocation;
  dropoff: TripLocation;
  plannedPath: Array<[number, number]>; // [lat, lng]
  distanceMeters?: number;
  durationSeconds?: number;
  createdAt: number;
}

export type MapPinMode = 'idle' | 'pick-pickup' | 'pick-dropoff';
```

- [ ] **Step 4: Implement `frontend/src/services/tripRouteService.ts`**

Create `frontend/src/services/tripRouteService.ts`:
```typescript
import { TripLocation, VehicleTrip } from '../types/trip';

export const DEFAULT_LONGDO_KEY = '72ba939d7a7166c36d59b88d0b125307';
export const LONGDO_ROUTE_API_BASE = 'https://api.longdo.com/RouteService/json/route/guide';

const inMemoryRouteCache = new Map<string, VehicleTrip>();

export function getTripCacheKey(vehicleId: string, pickup: TripLocation, dropoff: TripLocation): string {
  return `trip_${vehicleId}_${pickup.lat.toFixed(6)},${pickup.lng.toFixed(6)}_${dropoff.lat.toFixed(6)},${dropoff.lng.toFixed(6)}`;
}

export function parseLongdoGuideCoordinates(json: any): Array<[number, number]> {
  if (!json) return [];
  const coords: Array<[number, number]> = [];

  // Longdo returns guide objects in `data` array with `latitude` and `longitude`
  if (Array.isArray(json.data)) {
    for (const point of json.data) {
      const lat = Number(point.latitude ?? point.lat);
      const lng = Number(point.longitude ?? point.lon ?? point.lng);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        coords.push([lat, lng]);
      }
    }
  }

  return coords;
}

export function getCachedTripRoute(
  vehicleId: string,
  pickup: TripLocation,
  dropoff: TripLocation
): VehicleTrip | null {
  const key = getTripCacheKey(vehicleId, pickup, dropoff);
  if (inMemoryRouteCache.has(key)) {
    return inMemoryRouteCache.get(key)!;
  }
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored) as VehicleTrip;
      inMemoryRouteCache.set(key, parsed);
      return parsed;
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

export function clearTripRouteCache(vehicleId?: string): void {
  if (vehicleId) {
    for (const key of Array.from(inMemoryRouteCache.keys())) {
      if (key.startsWith(`trip_${vehicleId}_`)) {
        inMemoryRouteCache.delete(key);
        try {
          localStorage.removeItem(key);
        } catch {}
      }
    }
  } else {
    inMemoryRouteCache.clear();
  }
}

export async function calculateTripRoute(
  vehicleId: string,
  pickup: TripLocation,
  dropoff: TripLocation,
  apiKey: string = DEFAULT_LONGDO_KEY
): Promise<VehicleTrip> {
  // 1. Check in-memory & local cache first (Strict Zero Request policy)
  const cached = getCachedTripRoute(vehicleId, pickup, dropoff);
  if (cached) {
    return cached;
  }

  const cacheKey = getTripCacheKey(vehicleId, pickup, dropoff);
  const now = Date.now();

  try {
    const url = new URL(LONGDO_ROUTE_API_BASE);
    url.searchParams.set('flon', pickup.lng.toString());
    url.searchParams.set('flat', pickup.lat.toString());
    url.searchParams.set('tlon', dropoff.lng.toString());
    url.searchParams.set('tlat', dropoff.lat.toString());
    url.searchParams.set('mode', 't'); // Car/traffic mode
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString(), { method: 'GET' });
    if (!response.ok) {
      throw new Error(`Longdo Route API error status: ${response.status}`);
    }

    const data = await response.json();
    let plannedPath = parseLongdoGuideCoordinates(data);

    if (plannedPath.length < 2) {
      plannedPath = [
        [pickup.lat, pickup.lng],
        [dropoff.lat, dropoff.lng],
      ];
    }

    const trip: VehicleTrip = {
      vehicleId,
      pickup,
      dropoff,
      plannedPath,
      distanceMeters: typeof data?.distance === 'number' ? data.distance : undefined,
      durationSeconds: typeof data?.interval === 'number' ? data.interval : undefined,
      createdAt: now,
    };

    inMemoryRouteCache.set(cacheKey, trip);
    try {
      localStorage.setItem(cacheKey, JSON.stringify(trip));
    } catch {}

    return trip;
  } catch (error) {
    // Geodesic straight-line fallback to ensure UI never freezes
    const fallbackTrip: VehicleTrip = {
      vehicleId,
      pickup,
      dropoff,
      plannedPath: [
        [pickup.lat, pickup.lng],
        [dropoff.lat, dropoff.lng],
      ],
      createdAt: now,
    };
    return fallbackTrip;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend; npx vitest run src/services/__tests__/tripRouteService.test.ts`
Expected: PASS (4 tests passed).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/trip.ts frontend/src/services/tripRouteService.ts frontend/src/services/__tests__/tripRouteService.test.ts
git commit -m "feat(trip): add trip types and Longdo Route guide service with caching and fallback"
```

---

### Task 2: Vehicle Trip & Breadcrumb State Hook (`useVehicleTripRoute`)

**Files:**
- Create: `frontend/src/hooks/useVehicleTripRoute.ts`
- Test: `frontend/src/hooks/__tests__/useVehicleTripRoute.test.ts`

**Interfaces:**
- Consumes: `calculateTripRoute`, `clearTripRouteCache`, `TripLocation`, `VehicleTrip`, `MapPinMode`
- Produces:
  ```typescript
  export interface UseVehicleTripRouteResult {
    trips: Record<string, VehicleTrip>;
    actualPaths: Record<string, Array<[number, number]>>;
    pinMode: MapPinMode;
    isCalculating: boolean;
    error: string | null;
    startTrip: (vehicleId: string, pickup: TripLocation, dropoff: TripLocation) => Promise<VehicleTrip | null>;
    clearTrip: (vehicleId: string) => void;
    recordVehicleBreadcrumb: (vehicleId: string, lat: number, lng: number) => void;
    setPinMode: (mode: MapPinMode) => void;
  }
  ```

- [ ] **Step 1: Write the failing test for `useVehicleTripRoute`**

Create `frontend/src/hooks/__tests__/useVehicleTripRoute.test.ts`:
```typescript
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useVehicleTripRoute } from '../useVehicleTripRoute';
import * as tripService from '../../services/tripRouteService';

describe('useVehicleTripRoute', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('initializes with empty trips and idle pin mode', () => {
    const { result } = renderHook(() => useVehicleTripRoute());
    expect(result.current.trips).toEqual({});
    expect(result.current.actualPaths).toEqual({});
    expect(result.current.pinMode).toBe('idle');
    expect(result.current.isCalculating).toBe(false);
  });

  it('starts trip, calls calculateTripRoute once, and stores trip in state', async () => {
    const mockTrip = {
      vehicleId: 'EV-01',
      pickup: { lat: 18.788, lng: 98.985 },
      dropoff: { lat: 18.790, lng: 98.990 },
      plannedPath: [[18.788, 98.985], [18.790, 98.990]] as Array<[number, number]>,
      createdAt: Date.now(),
    };

    const calcSpy = vi.spyOn(tripService, 'calculateTripRoute').mockResolvedValueOnce(mockTrip);

    const { result } = renderHook(() => useVehicleTripRoute());

    await act(async () => {
      await result.current.startTrip('EV-01', mockTrip.pickup, mockTrip.dropoff);
    });

    expect(calcSpy).toHaveBeenCalledTimes(1);
    expect(result.current.trips['EV-01']).toEqual(mockTrip);
    expect(result.current.isCalculating).toBe(false);
  });

  it('appends actual breadcrumbs when vehicle moves more than 5 meters', () => {
    const { result } = renderHook(() => useVehicleTripRoute());

    act(() => {
      // First coordinate
      result.current.recordVehicleBreadcrumb('EV-01', 18.78830, 98.98530);
    });

    expect(result.current.actualPaths['EV-01']).toHaveLength(1);
    expect(result.current.actualPaths['EV-01'][0]).toEqual([18.78830, 98.98530]);

    act(() => {
      // Small jitter (< 1 meter) -> should be filtered out
      result.current.recordVehicleBreadcrumb('EV-01', 18.788301, 98.985301);
    });

    expect(result.current.actualPaths['EV-01']).toHaveLength(1);

    act(() => {
      // Meaningful movement (~15 meters) -> appended
      result.current.recordVehicleBreadcrumb('EV-01', 18.78845, 98.98545);
    });

    expect(result.current.actualPaths['EV-01']).toHaveLength(2);
  });

  it('clears vehicle trip and resets breadcrumb trail when clearTrip is called', async () => {
    const { result } = renderHook(() => useVehicleTripRoute());

    act(() => {
      result.current.recordVehicleBreadcrumb('EV-01', 18.7883, 98.9853);
    });
    expect(result.current.actualPaths['EV-01']).toBeDefined();

    act(() => {
      result.current.clearTrip('EV-01');
    });

    expect(result.current.trips['EV-01']).toBeUndefined();
    expect(result.current.actualPaths['EV-01']).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npx vitest run src/hooks/__tests__/useVehicleTripRoute.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `frontend/src/hooks/useVehicleTripRoute.ts`**

Create `frontend/src/hooks/useVehicleTripRoute.ts`:
```typescript
import { useState, useCallback, useRef } from 'react';
import { TripLocation, VehicleTrip, MapPinMode } from '../types/trip';
import { calculateTripRoute, clearTripRouteCache } from '../services/tripRouteService';
import { haversineDistanceMeters } from '../services/distanceCalculator';

export interface UseVehicleTripRouteResult {
  trips: Record<string, VehicleTrip>;
  actualPaths: Record<string, Array<[number, number]>>;
  pinMode: MapPinMode;
  isCalculating: boolean;
  error: string | null;
  startTrip: (vehicleId: string, pickup: TripLocation, dropoff: TripLocation) => Promise<VehicleTrip | null>;
  clearTrip: (vehicleId: string) => void;
  recordVehicleBreadcrumb: (vehicleId: string, lat: number, lng: number) => void;
  setPinMode: (mode: MapPinMode) => void;
}

const MIN_BREADCRUMB_DISTANCE_METERS = 5.0;

export function useVehicleTripRoute(): UseVehicleTripRouteResult {
  const [trips, setTrips] = useState<Record<string, VehicleTrip>>({});
  const [actualPaths, setActualPaths] = useState<Record<string, Array<[number, number]>>>({});
  const [pinMode, setPinMode] = useState<MapPinMode>('idle');
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastCoordsRef = useRef<Record<string, { lat: number; lng: number }>>({});

  const startTrip = useCallback(
    async (vehicleId: string, pickup: TripLocation, dropoff: TripLocation): Promise<VehicleTrip | null> => {
      if (!vehicleId || !pickup || !dropoff) {
        setError('กรุณาระบุข้อมูลจุดรับและจุดส่งให้ครบถ้วน');
        return null;
      }

      setIsCalculating(true);
      setError(null);

      try {
        const trip = await calculateTripRoute(vehicleId, pickup, dropoff);
        setTrips((prev) => ({
          ...prev,
          [vehicleId]: trip,
        }));
        // Reset breadcrumbs for this vehicle for the new trip
        setActualPaths((prev) => ({
          ...prev,
          [vehicleId]: [],
        }));
        delete lastCoordsRef.current[vehicleId];
        return trip;
      } catch (err: any) {
        const msg = err?.message || 'ไม่สามารถคำนวณเส้นทางได้ กรุณาลองใหม่อีกครั้ง';
        setError(msg);
        return null;
      } finally {
        setIsCalculating(false);
      }
    },
    []
  );

  const clearTrip = useCallback((vehicleId: string) => {
    clearTripRouteCache(vehicleId);
    setTrips((prev) => {
      const next = { ...prev };
      delete next[vehicleId];
      return next;
    });
    setActualPaths((prev) => {
      const next = { ...prev };
      delete next[vehicleId];
      return next;
    });
    delete lastCoordsRef.current[vehicleId];
  }, []);

  const recordVehicleBreadcrumb = useCallback((vehicleId: string, lat: number, lng: number) => {
    if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
      return;
    }

    const prevCoord = lastCoordsRef.current[vehicleId];
    if (prevCoord) {
      const dist = haversineDistanceMeters(prevCoord.lat, prevCoord.lng, lat, lng);
      if (dist < MIN_BREADCRUMB_DISTANCE_METERS) {
        return; // Stationary GPS jitter filter
      }
    }

    lastCoordsRef.current[vehicleId] = { lat, lng };

    setActualPaths((prev) => {
      const currentList = prev[vehicleId] || [];
      return {
        ...prev,
        [vehicleId]: [...currentList, [lat, lng]],
      };
    });
  }, []);

  return {
    trips,
    actualPaths,
    pinMode,
    isCalculating,
    error,
    startTrip,
    clearTrip,
    recordVehicleBreadcrumb,
    setPinMode,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend; npx vitest run src/hooks/__tests__/useVehicleTripRoute.test.ts`
Expected: PASS (4 tests passed).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useVehicleTripRoute.ts frontend/src/hooks/__tests__/useVehicleTripRoute.test.ts
git commit -m "feat(hook): add useVehicleTripRoute hook for trip lifecycle and breadcrumb tracking"
```

---

### Task 3: Trip Route Leaflet Map Overlay Component (`TripRouteOverlay`)

**Files:**
- Create: `frontend/src/components/TripRouteOverlay.tsx`
- Test: `frontend/src/components/__tests__/TripRouteOverlay.test.tsx`

**Interfaces:**
- Consumes: `VehicleTrip`, `MapPinMode`, `react-leaflet` (`Polyline`, `Marker`, `useMapEvents`)
- Produces:
  ```typescript
  export interface TripRouteOverlayProps {
    trip?: VehicleTrip;
    actualPath?: Array<[number, number]>;
    pinMode?: MapPinMode;
    onMapClick?: (lat: number, lng: number) => void;
  }

  export const TripRouteOverlay: React.FC<TripRouteOverlayProps>;
  ```

- [ ] **Step 1: Write the failing test for `TripRouteOverlay`**

Create `frontend/src/components/__tests__/TripRouteOverlay.test.tsx`:
```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MapContainer } from 'react-leaflet';
import { TripRouteOverlay } from '../TripRouteOverlay';
import { VehicleTrip } from '../../types/trip';

describe('TripRouteOverlay', () => {
  const mockTrip: VehicleTrip = {
    vehicleId: 'EV-01',
    pickup: { lat: 18.7883, lng: 98.9853, name: 'Faculty of Pharmacy' },
    dropoff: { lat: 18.7900, lng: 98.9900, name: 'Maharaj Hospital' },
    plannedPath: [
      [18.7883, 98.9853],
      [18.7890, 98.9875],
      [18.7900, 98.9900],
    ],
    createdAt: Date.now(),
  };

  it('renders Planned Route and pin markers when trip is provided', () => {
    render(
      <MapContainer center={[18.7883, 98.9853]} zoom={15}>
        <TripRouteOverlay trip={mockTrip} actualPath={[[18.7883, 98.9853], [18.7885, 98.9860]]} />
      </MapContainer>
    );

    expect(screen.getByTestId('planned-route-polyline')).toBeInTheDocument();
    expect(screen.getByTestId('actual-path-polyline')).toBeInTheDocument();
    expect(screen.getByTestId('pickup-marker')).toBeInTheDocument();
    expect(screen.getByTestId('dropoff-marker')).toBeInTheDocument();
  });

  it('renders nothing when no trip or actual path is provided and pinMode is idle', () => {
    const { container } = render(
      <MapContainer center={[18.7883, 98.9853]} zoom={15}>
        <TripRouteOverlay pinMode="idle" />
      </MapContainer>
    );

    expect(screen.queryByTestId('planned-route-polyline')).toBeNull();
    expect(screen.queryByTestId('pickup-marker')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npx vitest run src/components/__tests__/TripRouteOverlay.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `frontend/src/components/TripRouteOverlay.tsx`**

Create `frontend/src/components/TripRouteOverlay.tsx`:
```typescript
import React from 'react';
import { Polyline, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { VehicleTrip, MapPinMode } from '../types/trip';

export interface TripRouteOverlayProps {
  trip?: VehicleTrip;
  actualPath?: Array<[number, number]>;
  pinMode?: MapPinMode;
  onMapClick?: (lat: number, lng: number) => void;
}

export const createPinIcon = (type: 'pickup' | 'dropoff', label: string): L.DivIcon => {
  const isPickup = type === 'pickup';
  const bgColor = isPickup ? '#4a7c0b' : '#dc2626';
  const pinEmoji = isPickup ? '🟢' : '🔴';

  return L.divIcon({
    className: 'custom-trip-pin',
    html: `
      <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%); pointer-events: auto;">
        <div style="background: ${bgColor}; color: white; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; font-family: monospace; box-shadow: 0 2px 4px rgba(0,0,0,0.25); white-space: nowrap; border: 1.5px solid white;">
          ${label}
        </div>
        <div style="font-size: 16px; margin-top: -2px; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.3));">
          ${pinEmoji}
        </div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

const MapClickHandler: React.FC<{
  pinMode?: MapPinMode;
  onMapClick?: (lat: number, lng: number) => void;
}> = ({ pinMode, onMapClick }) => {
  useMapEvents({
    click(e) {
      if (pinMode && pinMode !== 'idle' && onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
};

export const TripRouteOverlay: React.FC<TripRouteOverlayProps> = ({
  trip,
  actualPath,
  pinMode = 'idle',
  onMapClick,
}) => {
  const hasPlannedPath = trip && trip.plannedPath && trip.plannedPath.length >= 2;
  const hasActualPath = actualPath && actualPath.length >= 2;

  return (
    <>
      <MapClickHandler pinMode={pinMode} onMapClick={onMapClick} />

      {/* Planned Route (แนวเส้นทางตามใบจอง): Semi-transparent Dashed line */}
      {hasPlannedPath && (
        <Polyline
          data-testid="planned-route-polyline"
          positions={trip.plannedPath}
          pathOptions={{
            color: '#9e76b4', // CMU Dok Rak Purple
            weight: 5,
            opacity: 0.75,
            dashArray: '8, 8',
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      )}

      {/* Actual Path (เส้นทางที่รถวิ่งจริง): High-contrast Solid line */}
      {hasActualPath && (
        <Polyline
          data-testid="actual-path-polyline"
          positions={actualPath}
          pathOptions={{
            color: '#4a7c0b', // Pharmacy CMU Olive Green
            weight: 4,
            opacity: 0.95,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      )}

      {/* Pickup Location Marker */}
      {trip?.pickup && (
        <Marker
          data-testid="pickup-marker"
          position={[trip.pickup.lat, trip.pickup.lng]}
          icon={createPinIcon('pickup', trip.pickup.name || 'จุดรับ')}
        />
      )}

      {/* Dropoff Location Marker */}
      {trip?.dropoff && (
        <Marker
          data-testid="dropoff-marker"
          position={[trip.dropoff.lat, trip.dropoff.lng]}
          icon={createPinIcon('dropoff', trip.dropoff.name || 'จุดส่ง')}
        />
      )}
    </>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend; npx vitest run src/components/__tests__/TripRouteOverlay.test.tsx`
Expected: PASS (2 tests passed).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/TripRouteOverlay.tsx frontend/src/components/__tests__/TripRouteOverlay.test.tsx
git commit -m "feat(overlay): add TripRouteOverlay component for planned route and actual path rendering"
```

---

### Task 4: Interactive Floating Test Drawer Panel (`TripTestPanel`)

**Files:**
- Create: `frontend/src/components/TripTestPanel.tsx`
- Test: `frontend/src/components/__tests__/TripTestPanel.test.tsx`

**Interfaces:**
- Consumes: `VehicleTrip`, `TripLocation`, `MapPinMode`
- Produces:
  ```typescript
  export interface TripTestPanelProps {
    vehicleIds: string[];
    selectedVehicleId: string | null;
    onSelectVehicle: (id: string) => void;
    activeTrip?: VehicleTrip;
    pinMode: MapPinMode;
    onSetPinMode: (mode: MapPinMode) => void;
    onStartTrip: (vehicleId: string, pickup: TripLocation, dropoff: TripLocation) => void;
    onClearTrip: (vehicleId: string) => void;
    isCalculating?: boolean;
    error?: string | null;
    className?: string;
  }
  ```

- [ ] **Step 1: Write the failing test for `TripTestPanel`**

Create `frontend/src/components/__tests__/TripTestPanel.test.tsx`:
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TripTestPanel } from '../TripTestPanel';

describe('TripTestPanel', () => {
  const defaultProps = {
    vehicleIds: ['EV-01', 'EV-02'],
    selectedVehicleId: 'EV-01',
    onSelectVehicle: vi.fn(),
    pinMode: 'idle' as const,
    onSetPinMode: vi.fn(),
    onStartTrip: vi.fn(),
    onClearTrip: vi.fn(),
    isCalculating: false,
    error: null,
  };

  it('renders collapsed toggle button by default and expands on click', () => {
    render(<TripTestPanel {...defaultProps} />);

    const toggleBtn = screen.getByRole('button', { name: /ทดสอบเส้นทาง/i });
    expect(toggleBtn).toBeInTheDocument();
    expect(screen.queryByText('กำหนดจุดรับ-ส่ง สำหรับทดสอบ')).toBeNull();

    // Click expand
    fireEvent.click(toggleBtn);
    expect(screen.getByText('กำหนดจุดรับ-ส่ง สำหรับทดสอบ')).toBeInTheDocument();
  });

  it('triggers pin mode callbacks for pickup and dropoff buttons', () => {
    const handleSetPinMode = vi.fn();
    render(<TripTestPanel {...defaultProps} onSetPinMode={handleSetPinMode} />);

    // Expand panel
    fireEvent.click(screen.getByRole('button', { name: /ทดสอบเส้นทาง/i }));

    const pickPickupBtn = screen.getByRole('button', { name: /จิ้มจุดรับบนแผนที่/i });
    fireEvent.click(pickPickupBtn);
    expect(handleSetPinMode).toHaveBeenCalledWith('pick-pickup');

    const pickDropoffBtn = screen.getByRole('button', { name: /จิ้มจุดส่งบนแผนที่/i });
    fireEvent.click(pickDropoffBtn);
    expect(handleSetPinMode).toHaveBeenCalledWith('pick-dropoff');
  });

  it('calls onStartTrip when valid coordinates are entered and Start button is clicked', () => {
    const handleStartTrip = vi.fn();
    render(<TripTestPanel {...defaultProps} onStartTrip={handleStartTrip} />);

    fireEvent.click(screen.getByRole('button', { name: /ทดสอบเส้นทาง/i }));

    const startBtn = screen.getByRole('button', { name: /คำนวณและเริ่มทริป/i });
    fireEvent.click(startBtn);

    expect(handleStartTrip).toHaveBeenCalledWith(
      'EV-01',
      expect.objectContaining({ lat: expect.any(Number), lng: expect.any(Number) }),
      expect.objectContaining({ lat: expect.any(Number), lng: expect.any(Number) })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npx vitest run src/components/__tests__/TripTestPanel.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `frontend/src/components/TripTestPanel.tsx`**

Create `frontend/src/components/TripTestPanel.tsx`:
```typescript
import React, { useState, useEffect } from 'react';
import { Route, MapPin, Flag, Play, Trash2, X, ChevronRight, Loader2 } from 'lucide-react';
import { TripLocation, VehicleTrip, MapPinMode } from '../types/trip';

export interface TripTestPanelProps {
  vehicleIds: string[];
  selectedVehicleId: string | null;
  onSelectVehicle: (id: string) => void;
  activeTrip?: VehicleTrip;
  pinMode: MapPinMode;
  onSetPinMode: (mode: MapPinMode) => void;
  onStartTrip: (vehicleId: string, pickup: TripLocation, dropoff: TripLocation) => void;
  onClearTrip: (vehicleId: string) => void;
  pendingPoint?: { lat: number; lng: number } | null;
  isCalculating?: boolean;
  error?: string | null;
  className?: string;
}

export const TripTestPanel: React.FC<TripTestPanelProps> = ({
  vehicleIds,
  selectedVehicleId,
  onSelectVehicle,
  activeTrip,
  pinMode,
  onSetPinMode,
  onStartTrip,
  onClearTrip,
  pendingPoint,
  isCalculating = false,
  error = null,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Form local state
  const [targetVehicleId, setTargetVehicleId] = useState<string>(selectedVehicleId || vehicleIds[0] || 'EV-01');
  const [pickup, setPickup] = useState<TripLocation>(
    activeTrip?.pickup || { lat: 18.7883, lng: 98.9853, name: 'คณะเภสัชฯ' }
  );
  const [dropoff, setDropoff] = useState<TripLocation>(
    activeTrip?.dropoff || { lat: 18.7900, lng: 98.9900, name: 'รพ.มหาราชฯ' }
  );

  useEffect(() => {
    if (selectedVehicleId) {
      setTargetVehicleId(selectedVehicleId);
    }
  }, [selectedVehicleId]);

  useEffect(() => {
    if (activeTrip) {
      setPickup(activeTrip.pickup);
      setDropoff(activeTrip.dropoff);
    }
  }, [activeTrip]);

  // Handle incoming map click points during pin mode
  useEffect(() => {
    if (pendingPoint) {
      if (pinMode === 'pick-pickup') {
        setPickup({ lat: pendingPoint.lat, lng: pendingPoint.lng, name: 'จุดรับ (ระบุบนแผนที่)' });
        onSetPinMode('idle');
      } else if (pinMode === 'pick-dropoff') {
        setDropoff({ lat: pendingPoint.lat, lng: pendingPoint.lng, name: 'จุดส่ง (ระบุบนแผนที่)' });
        onSetPinMode('idle');
      }
    }
  }, [pendingPoint, pinMode, onSetPinMode]);

  const handleStart = () => {
    onStartTrip(targetVehicleId, pickup, dropoff);
  };

  const handleClear = () => {
    onClearTrip(targetVehicleId);
  };

  return (
    <div className={`pointer-events-auto ${className}`}>
      {/* Collapsed Toggle Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="ทดสอบเส้นทาง (Route Test)"
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/95 dark:bg-slate-900/90 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800 shadow-md backdrop-blur-md text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all min-h-[40px]"
        >
          <Route className="w-4 h-4 text-[#4a7c0b]" />
          <span>ทดสอบเส้นทาง</span>
          {activeTrip && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
        </button>
      )}

      {/* Expanded Floating Test Panel */}
      {isOpen && (
        <div className="w-80 max-w-[calc(100vw-2rem)] p-4 rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-2xl backdrop-blur-md flex flex-col gap-3.5 transition-all text-xs">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <Route className="w-4 h-4 text-[#4a7c0b]" />
              <span>กำหนดจุดรับ-ส่ง สำหรับทดสอบ</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onSetPinMode('idle');
              }}
              aria-label="Close test panel"
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Vehicle Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
              เลือกรถที่ต้องการทดสอบ:
            </label>
            <select
              value={targetVehicleId}
              onChange={(e) => {
                const id = e.target.value;
                setTargetVehicleId(id);
                onSelectVehicle(id);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono font-bold text-xs"
            >
              {vehicleIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </div>

          {/* Pickup Point Input */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> จุดรับ (Pickup)
              </span>
              <button
                type="button"
                onClick={() => onSetPinMode(pinMode === 'pick-pickup' ? 'idle' : 'pick-pickup')}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                  pinMode === 'pick-pickup'
                    ? 'bg-emerald-600 text-white animate-pulse'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                }`}
              >
                {pinMode === 'pick-pickup' ? 'คลิกบนแผนที่...' : 'จิ้มจุดรับบนแผนที่'}
              </button>
            </div>
            <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
              {pickup.lat.toFixed(5)}, {pickup.lng.toFixed(5)}
            </div>
          </div>

          {/* Dropoff Point Input */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1">
                <Flag className="w-3.5 h-3.5" /> จุดส่ง (Dropoff)
              </span>
              <button
                type="button"
                onClick={() => onSetPinMode(pinMode === 'pick-dropoff' ? 'idle' : 'pick-dropoff')}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                  pinMode === 'pick-dropoff'
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                }`}
              >
                {pinMode === 'pick-dropoff' ? 'คลิกบนแผนที่...' : 'จิ้มจุดส่งบนแผนที่'}
              </button>
            </div>
            <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
              {dropoff.lat.toFixed(5)}, {dropoff.lng.toFixed(5)}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2 rounded-lg">
              {error}
            </div>
          )}

          {/* Trip Summary Details if Active */}
          {activeTrip && (
            <div className="text-[10px] text-slate-600 dark:text-slate-400 bg-[#5c990e]/10 p-2 rounded-lg border border-[#5c990e]/20 flex justify-between">
              <span>ระยะทางใบจอง: {((activeTrip.distanceMeters || 0) / 1000).toFixed(2)} km</span>
              <span>จุดพิกัดถนน: {activeTrip.plannedPath.length} จุด</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              disabled={isCalculating}
              onClick={handleStart}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#4a7c0b] hover:bg-[#3d6709] text-white font-bold transition-all shadow-sm disabled:opacity-50 min-h-[40px]"
            >
              {isCalculating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>กำลังคำนวณ...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>คำนวณและเริ่มทริป</span>
                </>
              )}
            </button>

            {activeTrip && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="ล้างเส้นทาง"
                title="ล้างเส้นทาง / จบทริป"
                className="p-2 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-950 dark:text-slate-400 dark:hover:text-rose-300 transition-all min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend; npx vitest run src/components/__tests__/TripTestPanel.test.tsx`
Expected: PASS (3 tests passed).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/TripTestPanel.tsx frontend/src/components/__tests__/TripTestPanel.test.tsx
git commit -m "feat(panel): add TripTestPanel for interactive pickup and dropoff point assignment"
```

---

### Task 5: Map & App Integration and Regression Verification

**Files:**
- Modify: `frontend/src/components/ShuttleMap.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/components/__tests__/ShuttleMap.test.tsx`
- Test: `frontend/src/__tests__/App.test.tsx`

**Interfaces:**
- Consumes: `useVehicleTripRoute`, `TripRouteOverlay`, `TripTestPanel`
- Produces: Integrated live dashboard with on-demand route visualization, zero telemetry query cost.

- [ ] **Step 1: Write integration tests in `ShuttleMap.test.tsx`**

Add tests to `frontend/src/components/__tests__/ShuttleMap.test.tsx`:
```typescript
  it('renders TripRouteOverlay when active vehicle has an assigned trip', () => {
    const mockTrip: VehicleTrip = {
      vehicleId: 'BUS-01',
      pickup: { lat: 18.788, lng: 98.985 },
      dropoff: { lat: 18.790, lng: 98.990 },
      plannedPath: [[18.788, 98.985], [18.790, 98.990]],
      createdAt: Date.now(),
    };

    render(
      <ShuttleMap
        vehicles={{
          'BUS-01': { vehicle_id: 'BUS-01', lat: 18.79, lng: 98.98, speed: 20, timestamp: Date.now() },
        }}
        selectedVehicleId="BUS-01"
        activeTrip={mockTrip}
      />
    );

    expect(screen.getByTestId('planned-route-polyline')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Update `ShuttleMap.tsx` with `TripRouteOverlay` and `TripTestPanel`**

In `frontend/src/components/ShuttleMap.tsx`:
- Add optional props:
  - `activeTrip?: VehicleTrip;`
  - `actualPath?: Array<[number, number]>;`
  - `pinMode?: MapPinMode;`
  - `onSetPinMode?: (mode: MapPinMode) => void;`
  - `onStartTrip?: (vehicleId: string, pickup: TripLocation, dropoff: TripLocation) => void;`
  - `onClearTrip?: (vehicleId: string) => void;`
  - `pendingPoint?: { lat: number; lng: number } | null;`
  - `onMapClick?: (lat: number, lng: number) => void;`
  - `isCalculatingRoute?: boolean;`
  - `routeError?: string | null;`
- Render `<TripRouteOverlay trip={activeTrip} actualPath={actualPath} pinMode={pinMode} onMapClick={onMapClick} />` inside `<MapContainer>`.
- Render `<TripTestPanel>` in top-right floating overlay controls.

- [ ] **Step 3: Update `App.tsx` to integrate `useVehicleTripRoute`**

In `frontend/src/App.tsx`:
- Instantiate `const { trips, actualPaths, pinMode, isCalculating: isCalculatingRoute, error: routeError, startTrip, clearTrip, recordVehicleBreadcrumb, setPinMode } = useVehicleTripRoute();`
- In `useShuttleTelemetry` callback / telemetry watcher: whenever `vehicles` update, call `recordVehicleBreadcrumb(vehicle.vehicle_id, vehicle.lat, vehicle.lng)`.
- Keep track of `pendingPoint` when map is clicked during `pinMode`.
- Pass trip state and handlers to `<ShuttleMap>`.

- [ ] **Step 4: Run complete Vitest suite**

Run: `cd frontend; npm test`
Expected: PASS (all 224+ tests passing).

- [ ] **Step 5: Run production build**

Run: `cd frontend; npm run build`
Expected: PASS (0 errors, Vite bundle output generated).

- [ ] **Step 6: Commit and Push**

```bash
git add frontend/src/components/ShuttleMap.tsx frontend/src/App.tsx frontend/src/components/__tests__/ShuttleMap.test.tsx
git commit -m "feat(map): integrate planned route overlay and testing panel with strict zero-loop compliance"
git push origin master
```
