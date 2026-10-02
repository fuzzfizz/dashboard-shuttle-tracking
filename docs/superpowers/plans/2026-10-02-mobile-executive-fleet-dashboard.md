# Mobile-First Executive Fleet Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a sleek, modern, mobile-first Executive Fleet Tracking Dashboard on the main user page (`/`) featuring a prominent real-time map displaying all registered vehicles, interactive vehicle focus with target routes and stops, and an integrated bottom table/card list displaying live telemetry and today's accumulated distance.

**Architecture:** Decouple public read access on backend Fastify vehicle and route routes so public users can retrieve registered vehicles and today's mileage. In the frontend, rebuild the home page (`frontend/src/app/page.tsx`) and Leaflet map component (`frontend/src/components/Map/LiveMap.tsx`) with modern styling, responsive card/table switching, directional vehicle markers, target route highlighting, and a floating Vehicle Focus HUD.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS 3.4, Lucide React, Leaflet 1.9, Fastify, PostgreSQL.

## Global Constraints
- Target Viewports: Mobile-first (375px–430px) with touch targets >= 44px, scaling seamlessly to tablet (768px) and desktop (1024px+).
- Single unified user-facing entry: All fleet information, route targets, and mileage must be available at root (`/`) without login walls.
- Preserve backward compatibility for admin mutation endpoints (POST/PUT/DELETE remain authenticated).
- Maintain 100% test pass rate across backend and frontend test suites.

---

### Task 1: Backend Public Access for Vehicles and Routes

**Files:**
- Modify: `backend/src/routes/vehicles.js:6-43`
- Modify: `backend/src/routes/routes.js:4-40`
- Create: `backend/__tests__/public-endpoints.test.js`

**Interfaces:**
- Consumes: Fastify `db` decorator, `vehicles` table, `routes` table, `route_stops` table.
- Produces: Public `GET /api/v1/vehicles` (returns vehicles with `today_total_km`, `today_total_trips`, `current_trip_km`, `route_name`), public `GET /api/v1/vehicles/:id`, public `GET /api/v1/routes`, and public `GET /api/v1/routes/:id`.

- [ ] **Step 1: Write failing test for public access without authentication**

Create `backend/__tests__/public-endpoints.test.js`:
```javascript
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';

describe('Public Endpoints (No Auth Required for GET)', () => {
  let app;
  const mockDb = {
    query: async (sql, params) => {
      if (sql.includes('FROM vehicles')) {
        return {
          rows: [
            {
              id: 'v-1',
              plate_number: 'AB-1234',
              name: 'Shuttle 1',
              model: 'Toyota Commuter',
              status: 'in_transit',
              route_id: 'r-1',
              route_name: 'Campus Loop',
              last_lat: 13.7367,
              last_lng: 100.5283,
              last_speed: 35.5,
              last_heading: 90,
              today_total_km: 42.8,
              today_total_trips: 5,
              current_trip_km: 3.2,
              is_active: true
            }
          ]
        };
      }
      if (sql.includes('FROM routes')) {
        return {
          rows: [
            {
              id: 'r-1',
              name: 'Campus Loop',
              description: 'Main campus loop',
              is_active: true,
              stop_count: 3
            }
          ]
        };
      }
      return { rows: [] };
    }
  };

  before(async () => {
    app = buildApp({ db: mockDb, logger: false });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test('GET /api/v1/vehicles returns 200 without Authorization header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/vehicles'
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.equal(Array.isArray(body.data), true);
    assert.equal(body.data[0].plate_number, 'AB-1234');
    assert.equal(body.data[0].today_total_km, 42.8);
  });

  test('GET /api/v1/routes returns 200 without Authorization header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/routes'
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.equal(body.data[0].name, 'Campus Loop');
  });

  test('POST /api/v1/vehicles still requires authentication', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/vehicles',
      payload: { plate_number: 'XY-9999' }
    });
    assert.equal(res.statusCode, 401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test backend/__tests__/public-endpoints.test.js`
Expected: FAIL with status code 401 for `GET /api/v1/vehicles`.

- [ ] **Step 3: Update `vehicles.js` and `routes.js` to allow public GET access**

In `backend/src/routes/vehicles.js`, remove `preValidation: [fastify.authenticate]` from `fastify.get('/')` and `fastify.get('/:id')`:
```javascript
  fastify.get('/', async (request, reply) => {
    const { rows } = await db.query(`
      SELECT 
        v.*, 
        r.name as route_name,
        COALESCE(SUM(t_all.total_distance_km) FILTER (WHERE DATE(t_all.started_at) = CURRENT_DATE), 0) as today_total_km,
        COUNT(t_all.id) FILTER (WHERE DATE(t_all.started_at) = CURRENT_DATE) as today_total_trips,
        COALESCE(SUM(t_curr.total_distance_km), 0) as current_trip_km
      FROM vehicles v
      LEFT JOIN routes r ON v.route_id = r.id
      LEFT JOIN trips t_all ON t_all.vehicle_id = v.id
      LEFT JOIN trips t_curr ON t_curr.vehicle_id = v.id AND t_curr.status IN ('in_transit', 'active')
      WHERE v.is_active = true
      GROUP BY v.id, r.name
    `);
    
    const data = rows.map(v => ({
      ...v,
      today_total_km: Number(v.today_total_km || 0),
      today_total_trips: Number(v.today_total_trips || 0),
      current_trip_km: Number(v.current_trip_km || 0)
    }));

    return { success: true, data };
  });

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params;
    const { rows } = await db.query('SELECT * FROM vehicles WHERE id = $1 AND is_active = true', [id]);
    if (rows.length === 0) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Vehicle not found' } });
    }
    return { success: true, data: rows[0] };
  });
```

In `backend/src/routes/routes.js`, remove `preValidation: [fastify.authenticate]` from `fastify.get('/')` and `fastify.get('/:id')`:
```javascript
  fastify.get('/', async (request, reply) => {
    const { rows } = await db.query(`
      SELECT r.*, COUNT(rs.id) as stop_count
      FROM routes r
      LEFT JOIN route_stops rs ON r.id = rs.route_id
      GROUP BY r.id
      ORDER BY r.id ASC
    `);
    
    return { success: true, data: rows };
  });

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params;
    
    const { rows } = await db.query(`
      SELECT * FROM routes WHERE id = $1
    `, [id]);

    if (rows.length === 0) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
    }

    const route = rows[0];
    
    const stopsRes = await db.query(`
      SELECT * FROM route_stops WHERE route_id = $1 ORDER BY stop_order ASC
    `, [id]);

    route.stops = stopsRes.rows;

    return { success: true, data: route };
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test backend/__tests__/public-endpoints.test.js`
Expected: PASS (all 3 tests pass).
Run: `npm test` inside `backend` to ensure all existing 135+ tests continue to pass.

- [ ] **Step 5: Commit changes**

```bash
git add backend/src/routes/vehicles.js backend/src/routes/routes.js backend/__tests__/public-endpoints.test.js
git commit -m "feat(backend): allow public GET access to vehicles and routes"
```

---

### Task 2: Frontend Types & Telemetry Formatters

**Files:**
- Modify: `frontend/src/lib/types.ts:8-22`
- Modify: `frontend/src/lib/utils.ts`
- Modify: `frontend/__tests__/utils.test.js`

**Interfaces:**
- Consumes: `Vehicle`, `Route`, `Trip`.
- Produces:
  - Extended `Vehicle` interface with `today_total_km?: number`, `today_total_trips?: number`, `current_trip_km?: number`, `route_name?: string`.
  - `formatDistance(km?: number | null): string`
  - `filterFleet(vehicles: Vehicle[], query: string, status: string, routeId?: string | null): Vehicle[]`

- [ ] **Step 1: Write failing test for distance formatting and fleet filtering**

Add to `frontend/__tests__/utils.test.js`:
```javascript
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { formatDistance, filterFleet } from '../src/lib/utils.js';

describe('formatDistance', () => {
  test('formats positive distance to 1 decimal place with km unit', () => {
    assert.equal(formatDistance(42.84), '42.8 กม.');
    assert.equal(formatDistance(5), '5.0 กม.');
  });

  test('formats zero or undefined gracefully', () => {
    assert.equal(formatDistance(0), '0.0 กม.');
    assert.equal(formatDistance(null), '0.0 กม.');
    assert.equal(formatDistance(undefined), '0.0 กม.');
  });
});

describe('filterFleet', () => {
  const sampleVehicles = [
    { id: '1', plate_number: 'AB-1001', model: 'Van A', status: 'in_transit', current_route_id: 'r-1', route_name: 'North' },
    { id: '2', plate_number: 'CD-2002', model: 'Bus B', status: 'idle', current_route_id: 'r-2', route_name: 'South' },
    { id: '3', plate_number: 'EF-3003', model: 'Van C', status: 'offline', current_route_id: null, route_name: null },
  ];

  test('filters by status', () => {
    const result = filterFleet(sampleVehicles, '', 'in_transit', 'all');
    assert.equal(result.length, 1);
    assert.equal(result[0].plate_number, 'AB-1001');
  });

  test('filters by search plate query case-insensitive', () => {
    const result = filterFleet(sampleVehicles, 'cd-2', 'all', 'all');
    assert.equal(result.length, 1);
    assert.equal(result[0].plate_number, 'CD-2002');
  });

  test('filters by search route name', () => {
    const result = filterFleet(sampleVehicles, 'North', 'all', 'all');
    assert.equal(result.length, 1);
    assert.equal(result[0].plate_number, 'AB-1001');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test frontend/__tests__/utils.test.js`
Expected: FAIL with `formatDistance is not a function`.

- [ ] **Step 3: Implement `formatDistance` and `filterFleet` in `frontend/src/lib/utils.ts` & update `types.ts`**

In `frontend/src/lib/types.ts`:
```typescript
export interface Vehicle {
  id: string;
  plate_number: string;
  name?: string;
  model: string;
  status: string;
  current_route_id: string | null;
  route_id?: string | null;
  route_name?: string | null;
  today_total_km?: number;
  today_total_trips?: number;
  current_trip_km?: number;
  device_api_key?: string;
  last_lat?: number | null;
  last_lng?: number | null;
  last_speed?: number | null;
  last_heading?: number | null;
  last_seen_at?: string | null;
  created_at: string;
}
```

In `frontend/src/lib/utils.ts`:
```typescript
export function formatDistance(km?: number | null): string {
  if (km === undefined || km === null || isNaN(km)) {
    return '0.0 กม.';
  }
  return `${Number(km).toFixed(1)} กม.`;
}

export function filterFleet(
  vehicles: Vehicle[],
  query: string,
  status: string = 'all',
  routeId: string | null = 'all'
): Vehicle[] {
  const q = (query || '').trim().toLowerCase();

  return vehicles.filter(v => {
    // Status match
    if (status !== 'all' && v.status !== status) {
      return false;
    }

    // Route match
    const vehicleRouteId = v.current_route_id || v.route_id;
    if (routeId && routeId !== 'all') {
      if (routeId === 'unassigned') {
        if (vehicleRouteId) return false;
      } else if (vehicleRouteId !== routeId) {
        return false;
      }
    }

    // Query match
    if (q) {
      const matchPlate = v.plate_number?.toLowerCase().includes(q);
      const matchModel = v.model?.toLowerCase().includes(q);
      const matchName = v.name?.toLowerCase().includes(q);
      const matchRoute = v.route_name?.toLowerCase().includes(q);
      return matchPlate || matchModel || matchName || matchRoute;
    }

    return true;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test frontend/__tests__/utils.test.js`
Expected: PASS (all tests pass).
Run: `npm test` inside `frontend`.

- [ ] **Step 5: Commit changes**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/utils.ts frontend/__tests__/utils.test.js
git commit -m "feat(frontend): add distance formatter and fleet filter utility"
```

---

### Task 3: Modern Leaflet LiveMap Component with Target Route & Focus HUD

**Files:**
- Modify: `frontend/src/components/Map/LiveMap.tsx`

**Interfaces:**
- Consumes:
  - `vehicles: Vehicle[]`
  - `routes: Route[]`
  - `selectedVehicleId: string | null`
  - `onVehicleClick: (id: string) => void`
  - `onResetFocus: () => void`
- Produces:
  - Responsive Leaflet map rendering all active vehicles with directional bearing markers.
  - Target route polyline highlighting with glowing border and stop markers when a vehicle is selected.
  - Floating **Vehicle Focus HUD** component displaying plate, speed, route, today's distance, and quick close button.

- [ ] **Step 1: Implement enhanced `LiveMap.tsx`**

Update `frontend/src/components/Map/LiveMap.tsx`:
```tsx
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Vehicle, Route } from '../../lib/types';
import { formatSpeed, formatDistance } from '../../lib/utils';
import { Bus, Navigation, Gauge, X, MapPin } from 'lucide-react';

interface LiveMapProps {
  vehicles: Vehicle[];
  routes: Route[];
  selectedVehicleId: string | null;
  onVehicleClick: (id: string) => void;
  onResetFocus?: () => void;
}

const LiveMap: React.FC<LiveMapProps> = ({
  vehicles,
  routes,
  selectedVehicleId,
  onVehicleClick,
  onResetFocus
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const routeLayersRef = useRef<L.LayerGroup | null>(null);

  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);
  const assignedRoute = routes.find(
    r => r.id === (selectedVehicle?.current_route_id || selectedVehicle?.route_id)
  );

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      zoomControl: false,
      tapHold: true,
      gestureHandling: false // Allows smooth touch scroll on page
    }).setView([13.7367, 100.5283], 13);

    // Modern clean tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 19
    }).addTo(map);

    // Zoom control at bottom right for easy thumb reach on mobile
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    routeLayersRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Render Routes (all inactive dimmed, or highlight selected route)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = routeLayersRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    routes.forEach(route => {
      const isSelectedRoute = assignedRoute?.id === route.id;
      // If a vehicle is selected, hide or dim other routes
      if (selectedVehicleId && !isSelectedRoute) return;

      const color = route.color || '#3b82f6';

      if (route.coordinates && route.coordinates.length > 0) {
        // Outer glow polyline for selected route
        if (isSelectedRoute) {
          L.polyline(route.coordinates, {
            color: color,
            weight: 8,
            opacity: 0.35,
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(layerGroup);
        }

        // Main polyline
        L.polyline(route.coordinates, {
          color: color,
          weight: isSelectedRoute ? 5 : 3,
          opacity: isSelectedRoute ? 0.95 : 0.6,
          dashArray: isSelectedRoute ? undefined : '6, 8',
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(layerGroup);
      }

      // Render stops
      route.stops?.forEach((stop, idx) => {
        const stopMarker = L.circleMarker([stop.lat, stop.lng], {
          radius: isSelectedRoute ? 7 : 5,
          fillColor: isSelectedRoute ? color : '#ffffff',
          color: color,
          weight: 2,
          fillOpacity: isSelectedRoute ? 1 : 0.8
        }).addTo(layerGroup);

        const stopTooltip = `
          <div class="px-2 py-1 text-xs font-semibold text-slate-800">
            ${idx + 1}. ${stop.name}
          </div>
        `;
        stopMarker.bindTooltip(stopTooltip, { direction: 'top', offset: [0, -6] });
      });
    });
  }, [routes, selectedVehicleId, assignedRoute]);

  // Update Vehicle Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const currentVehicleIds = new Set<string>();

    vehicles.forEach(vehicle => {
      if (!vehicle.last_lat || !vehicle.last_lng) return;
      currentVehicleIds.add(vehicle.id);

      const latLng: [number, number] = [vehicle.last_lat, vehicle.last_lng];
      const heading = vehicle.last_heading || 0;
      const isSelected = vehicle.id === selectedVehicleId;

      let statusBg = 'bg-slate-500';
      let pingColor = 'bg-slate-400';
      if (vehicle.status === 'in_transit') {
        statusBg = 'bg-emerald-500';
        pingColor = 'bg-emerald-400';
      } else if (vehicle.status === 'idle') {
        statusBg = 'bg-amber-500';
        pingColor = 'bg-amber-400';
      }

      const htmlContent = `
        <div class="relative flex items-center justify-center cursor-pointer">
          ${vehicle.status === 'in_transit' ? `
            <span class="absolute w-10 h-10 rounded-full ${pingColor} opacity-75 animate-ping"></span>
          ` : ''}
          <div class="relative w-9 h-9 rounded-2xl ${statusBg} text-white shadow-lg flex items-center justify-center border-2 ${isSelected ? 'border-blue-400 ring-4 ring-blue-500/30 scale-110' : 'border-white'} transition-all duration-300">
            <svg class="w-5 h-5" style="transform: rotate(${heading}deg); transition: transform 0.4s ease;" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L19 21L12 17L5 21L12 2Z" />
            </svg>
          </div>
          <div class="absolute -bottom-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-slate-900/90 backdrop-blur-xs text-white text-[11px] font-bold tracking-tight shadow-md whitespace-nowrap">
            ${vehicle.plate_number}
          </div>
        </div>
      `;

      const icon = L.divIcon({
        html: htmlContent,
        className: 'vehicle-custom-marker',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -20]
      });

      let marker = markersRef.current[vehicle.id];
      if (marker) {
        marker.setLatLng(latLng);
        marker.setIcon(icon);
      } else {
        marker = L.marker(latLng, { icon }).addTo(map);
        marker.on('click', () => {
          onVehicleClick(vehicle.id);
        });
        markersRef.current[vehicle.id] = marker;
      }
    });

    // Cleanup markers for removed vehicles
    Object.keys(markersRef.current).forEach(id => {
      if (!currentVehicleIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });
  }, [vehicles, selectedVehicleId, onVehicleClick]);

  // Smooth Fly-to on Vehicle Select
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedVehicleId) return;

    const marker = markersRef.current[selectedVehicleId];
    if (marker) {
      map.flyTo(marker.getLatLng(), 15, {
        animate: true,
        duration: 0.8
      });
    }
  }, [selectedVehicleId]);

  return (
    <div className="relative w-full h-full overflow-hidden rounded-2xl shadow-sm border border-slate-200">
      <div ref={mapRef} className="w-full h-full z-0" />

      {/* Floating Vehicle Focus HUD Widget */}
      {selectedVehicle && (
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 max-w-[calc(100vw-24px)] sm:max-w-sm bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-200/90 text-slate-800 transition-all animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2.5 mb-2.5">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <Bus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 leading-tight">
                  {selectedVehicle.plate_number}
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  {selectedVehicle.model || 'รถรับส่งทั่วไป'}
                </span>
              </div>
            </div>

            <button
              onClick={() => onResetFocus && onResetFocus()}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="แสดงรถทั้งหมด"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                <Gauge className="w-3.5 h-3.5" />
                <span>ความเร็ว</span>
              </div>
              <span className="text-sm font-bold text-slate-800 font-mono">
                {formatSpeed(selectedVehicle.last_speed)}
              </span>
            </div>

            <div className="bg-blue-50/60 p-2.5 rounded-xl border border-blue-100">
              <div className="flex items-center gap-1.5 text-blue-700 mb-1">
                <Navigation className="w-3.5 h-3.5" />
                <span>ระยะทางวันนี้</span>
              </div>
              <span className="text-sm font-bold text-blue-900 font-mono">
                {formatDistance(selectedVehicle.today_total_km)}
              </span>
            </div>
          </div>

          {assignedRoute ? (
            <div className="mt-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2 text-xs">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: assignedRoute.color || '#3b82f6' }}
              />
              <div className="truncate flex-1">
                <span className="font-semibold text-slate-800">{assignedRoute.name}</span>
                <span className="text-slate-500 ml-1">({assignedRoute.stops?.length || 0} จุดจอด)</span>
              </div>
            </div>
          ) : (
            <div className="mt-2.5 text-[11px] text-slate-400 italic">
              ยังไม่ได้กำหนดเส้นทางเป้าหมาย
            </div>
          )}

          <button
            onClick={() => onResetFocus && onResetFocus()}
            className="w-full mt-3 py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
          >
            <span>ดูรถทุกคันบนแผนที่</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default LiveMap;
```

- [ ] **Step 2: Verify component builds and syntax is error-free**

Run: `npm run build` in `frontend` to verify TypeScript compilation.
Expected: Build succeeds or clean compilation.

- [ ] **Step 3: Commit changes**

```bash
git add frontend/src/components/Map/LiveMap.tsx
git commit -m "feat(frontend): enhance LiveMap with target route and focus HUD"
```

---

### Task 4: Mobile-First Executive Fleet Tracking Page (`/`)

**Files:**
- Modify: `frontend/src/app/page.tsx`

**Interfaces:**
- Consumes: `api.listVehicles`, `api.listRoutes`, `publicWs`, `LiveMap`, `filterFleet`, `formatSpeed`, `formatDistance`.
- Produces: Complete mobile-first Executive Fleet Dashboard with:
  - Top Hero Bar with live sync indicator & aggregate fleet stats (Total, In Transit, Idle, Today's Fleet Km).
  - Main Fleet Live Map at top with target route overlay.
  - Search & Status Filter toolbar.
  - Responsive Mobile Fleet Cards (< 768px) with 44px touch targets.
  - Responsive Desktop Fleet Table (>= 768px) with 7 columns.
  - Smooth auto-scroll to map upon selecting any vehicle.

- [ ] **Step 1: Implement the new Executive Fleet Dashboard in `frontend/src/app/page.tsx`**

Replace `frontend/src/app/page.tsx` with:
```tsx
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '@/lib/api';
import { publicWs } from '@/lib/ws';
import { Vehicle, Route } from '@/lib/types';
import { filterFleet, updateVehicleLocation, formatSpeed, formatDistance } from '@/lib/utils';
import MapWrapper from '@/components/Map/MapWrapper';
import {
  Bus,
  Search,
  Activity,
  Navigation,
  Clock,
  ChevronRight,
  Wifi,
  Sparkles,
  Layers,
  ArrowUpRight
} from 'lucide-react';

export default function MobileExecutiveFleetDashboard() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRouteId, setSelectedRouteId] = useState('all');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  const mapSectionRef = useRef<HTMLDivElement>(null);

  // Fetch initial data
  useEffect(() => {
    let isMounted = true;
    async function loadInitialData() {
      try {
        const [vehiclesRes, routesRes] = await Promise.all([
          api.listVehicles(),
          api.listRoutes()
        ]);
        if (isMounted) {
          setVehicles(vehiclesRes || []);
          setRoutes(routesRes || []);
        }
      } catch (err) {
        console.error('Failed to load fleet data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadInitialData();

    // WebSocket Setup
    publicWs.connect();

    const unsubConnected = publicWs.subscribe('connected', () => setIsConnected(true));
    const unsubDisconnected = publicWs.subscribe('disconnected', () => setIsConnected(false));
    const unsubError = publicWs.subscribe('error', () => setIsConnected(false));

    const unsubLocation = publicWs.subscribe('vehicle:location', (payload) => {
      setVehicles((prev) => updateVehicleLocation(prev, payload));
    });

    const unsubStatus = publicWs.subscribe('vehicle:status', (payload) => {
      setVehicles((prev) => {
        const idx = prev.findIndex((v) => v.id === payload.vehicle_id);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          status: payload.status,
          last_seen_at: payload.last_seen_at || new Date().toISOString()
        };
        return next;
      });
    });

    const unsubTripStarted = publicWs.subscribe('trip:started', (payload) => {
      setVehicles((prev) => {
        const idx = prev.findIndex((v) => v.id === payload.vehicle_id);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], status: 'in_transit' };
        return next;
      });
    });

    const unsubTripCompleted = publicWs.subscribe('trip:completed', (payload) => {
      setVehicles((prev) => {
        const idx = prev.findIndex((v) => v.id === payload.vehicle_id);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], status: 'idle' };
        return next;
      });
    });

    return () => {
      isMounted = false;
      unsubConnected();
      unsubDisconnected();
      unsubError();
      unsubLocation();
      unsubStatus();
      unsubTripStarted();
      unsubTripCompleted();
      publicWs.disconnect();
    };
  }, []);

  // Filtered vehicles
  const filteredVehicles = useMemo(
    () => filterFleet(vehicles, searchQuery, statusFilter, selectedRouteId),
    [vehicles, searchQuery, statusFilter, selectedRouteId]
  );

  // Fleet aggregate metrics
  const metrics = useMemo(() => {
    const total = vehicles.length;
    const inTransit = vehicles.filter((v) => v.status === 'in_transit').length;
    const idle = vehicles.filter((v) => v.status === 'idle').length;
    const totalKm = vehicles.reduce((sum, v) => sum + (Number(v.today_total_km) || 0), 0);

    return { total, inTransit, idle, totalKm: totalKm.toFixed(1) };
  }, [vehicles]);

  const handleSelectVehicle = (id: string) => {
    setSelectedVehicleId(id);
    if (mapSectionRef.current) {
      mapSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const getRouteInfo = (vehicle: Vehicle) => {
    const routeId = vehicle.current_route_id || vehicle.route_id;
    return routes.find((r) => r.id === routeId);
  };

  const formatLastSeen = (timestamp?: string | null) => {
    if (!timestamp) return 'ไม่มีข้อมูล';
    try {
      const d = new Date(timestamp);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-100">
      {/* 1. Header Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3.5 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <Bus className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-xl font-bold tracking-tight text-slate-900">
                  ระบบติดตามรถรับ-ส่ง
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700 rounded-md border border-blue-200/60">
                  Live Fleet
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium hidden sm:block">
                ติดตามพิกัด เส้นทางเป้าหมาย และระยะทางการวิ่งแบบเรียลไทม์
              </p>
            </div>
          </div>

          {/* Connection Status Indicator */}
          <div className="flex items-center gap-2.5">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
              isConnected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span>{isConnected ? 'เชื่อมต่อสด' : 'รอการเชื่อมต่อ'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 sm:py-6 space-y-6">
        {/* 2. Aggregate Fleet Metric Badges */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 shrink-0">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500">รถทั้งหมด</span>
              <div className="text-lg sm:text-xl font-bold text-slate-900 font-mono">
                {metrics.total} <span className="text-xs font-normal text-slate-500">คัน</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-emerald-700">กำลังวิ่ง</span>
              <div className="text-lg sm:text-xl font-bold text-emerald-600 font-mono">
                {metrics.inTransit} <span className="text-xs font-normal text-slate-500">คัน</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-amber-700">จอดรอ</span>
              <div className="text-lg sm:text-xl font-bold text-amber-600 font-mono">
                {metrics.idle} <span className="text-xs font-normal text-slate-500">คัน</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 shrink-0">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-blue-700">ระยะทางรวมวันนี้</span>
              <div className="text-lg sm:text-xl font-bold text-blue-900 font-mono">
                {metrics.totalKm} <span className="text-xs font-normal text-slate-500">กม.</span>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Main Fleet Live Map (Top Layout) */}
        <section ref={mapSectionRef} className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                แผนที่แสดงตำแหน่งรถสด (Fleet Live Map)
              </h2>
            </div>
            {selectedVehicleId && (
              <button
                onClick={() => setSelectedVehicleId(null)}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold px-2.5 py-1 bg-blue-50 rounded-lg transition-colors"
              >
                ดูรถทั้งหมด
              </button>
            )}
          </div>

          <div className="w-full h-[400px] sm:h-[500px] rounded-2xl overflow-hidden shadow-sm border border-slate-200 relative bg-slate-100">
            <MapWrapper
              vehicles={vehicles}
              routes={routes}
              selectedVehicleId={selectedVehicleId}
              onVehicleClick={handleSelectVehicle}
              onResetFocus={() => setSelectedVehicleId(null)}
            />
          </div>
        </section>

        {/* 4. Controls & Filters */}
        <section className="space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1 sm:max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาป้ายทะเบียน สายรถ หรือรุ่นรถ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-900 placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status Pills Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {[
                { key: 'all', label: 'ทั้งหมด' },
                { key: 'in_transit', label: 'กำลังวิ่ง' },
                { key: 'idle', label: 'จอดรอ' },
                { key: 'offline', label: 'ออฟไลน์' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    statusFilter === tab.key
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Mobile Cards View (< 768px) */}
        <section className="block md:hidden space-y-3">
          {filteredVehicles.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500 space-y-2">
              <Bus className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">ไม่พบรถตามเงื่อนไขที่เลือก</p>
              <p className="text-xs">ลองค้นหาด้วยคำใหม่ หรือเลือกตัวกรองสถานะทั้งหมด</p>
            </div>
          ) : (
            filteredVehicles.map((vehicle) => {
              const route = getRouteInfo(vehicle);
              const isSelected = vehicle.id === selectedVehicleId;

              return (
                <div
                  key={vehicle.id}
                  onClick={() => handleSelectVehicle(vehicle.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-500/20 shadow-md'
                      : 'bg-white border-slate-200/90 shadow-xs hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-xl ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                        <Bus className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="font-bold text-base text-slate-900 leading-tight block">
                          {vehicle.plate_number}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          {vehicle.model || 'รถรับส่งทั่วไป'}
                        </span>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      vehicle.status === 'in_transit'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : vehicle.status === 'idle'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        vehicle.status === 'in_transit'
                          ? 'bg-emerald-500'
                          : vehicle.status === 'idle'
                          ? 'bg-amber-500'
                          : 'bg-slate-400'
                      }`} />
                      {vehicle.status === 'in_transit' ? 'กำลังวิ่ง' : vehicle.status === 'idle' ? 'จอดรอ' : 'ออฟไลน์'}
                    </span>
                  </div>

                  {/* Route & Target Destination */}
                  <div className="flex items-center gap-2 text-xs text-slate-700 mb-3 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: route?.color || '#3b82f6' }}
                    />
                    <span className="font-semibold truncate">
                      {route ? route.name : 'ยังไม่กำหนดสาย'}
                    </span>
                  </div>

                  {/* Telemetry Metrics Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs py-2 border-t border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[11px]">ความเร็วปัจจุบัน</span>
                      <span className="font-mono font-bold text-slate-800 text-sm">
                        {formatSpeed(vehicle.last_speed)}
                      </span>
                    </div>

                    <div>
                      <span className="text-blue-600 font-medium block text-[11px]">ระยะทางวิ่งวันนี้</span>
                      <span className="font-mono font-bold text-blue-900 text-sm">
                        {formatDistance(vehicle.today_total_km)}
                      </span>
                    </div>
                  </div>

                  {/* Action Tap Button (>= 44px ergonomics) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectVehicle(vehicle.id);
                    }}
                    className={`w-full mt-3 h-11 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-98'
                    }`}
                  >
                    <span>ดูเส้นทาง & โฟกัสบนแผนที่</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </section>

        {/* 6. Desktop Executive Data Table (>= 768px) */}
        <section className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/90 text-xs font-semibold text-slate-500 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">รถ / ป้ายทะเบียน</th>
                  <th className="px-5 py-3.5">สายรถที่สังกัด</th>
                  <th className="px-5 py-3.5">สถานะ</th>
                  <th className="px-5 py-3.5 font-mono">ความเร็ว</th>
                  <th className="px-5 py-3.5 font-mono text-blue-700">ระยะทางวันนี้</th>
                  <th className="px-5 py-3.5">อัปเดตล่าสุด</th>
                  <th className="px-5 py-3.5 text-right">แอ็กชัน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVehicles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-slate-500 font-medium">
                      ไม่พบข้อมูลรถตามเงื่อนไขที่เลือก
                    </td>
                  </tr>
                ) : (
                  filteredVehicles.map((vehicle) => {
                    const route = getRouteInfo(vehicle);
                    const isSelected = vehicle.id === selectedVehicleId;

                    return (
                      <tr
                        key={vehicle.id}
                        onClick={() => handleSelectVehicle(vehicle.id)}
                        className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                          isSelected ? 'bg-blue-50/60 font-medium' : ''
                        }`}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                              <Bus className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 block">
                                {vehicle.plate_number}
                              </span>
                              <span className="text-xs text-slate-500">
                                {vehicle.model || 'รถรับส่งทั่วไป'}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: route?.color || '#94a3b8' }}
                            />
                            <span className="text-slate-800 font-medium">
                              {route ? route.name : 'ยังไม่กำหนดสาย'}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            vehicle.status === 'in_transit'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : vehicle.status === 'idle'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              vehicle.status === 'in_transit'
                                ? 'bg-emerald-500'
                                : vehicle.status === 'idle'
                                ? 'bg-amber-500'
                                : 'bg-slate-400'
                            }`} />
                            {vehicle.status === 'in_transit' ? 'กำลังวิ่ง' : vehicle.status === 'idle' ? 'จอดรอ' : 'ออฟไลน์'}
                          </span>
                        </td>

                        <td className="px-5 py-4 font-mono font-medium text-slate-800">
                          {formatSpeed(vehicle.last_speed)}
                        </td>

                        <td className="px-5 py-4 font-mono font-bold text-blue-900">
                          {formatDistance(vehicle.today_total_km)}
                        </td>

                        <td className="px-5 py-4 text-xs text-slate-500 font-mono">
                          {formatLastSeen(vehicle.last_seen_at)}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectVehicle(vehicle.id);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
                          >
                            <span>ดูเส้นทาง</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Build project and test compilation**

Run: `npm run build` in `frontend`.
Expected: Successful Next.js production build without errors.

- [ ] **Step 3: Commit changes**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat(frontend): build mobile-first executive fleet tracking dashboard"
```

---

### Task 5: End-to-End Verification & Mobile Audit

**Files:**
- Test: `frontend/__tests__/*`
- Test: `backend/__tests__/*`

- [ ] **Step 1: Run all backend tests**

Run: `npm test` inside `backend`.
Expected: All 138+ tests pass.

- [ ] **Step 2: Run all frontend tests**

Run: `npm test` inside `frontend`.
Expected: All 50+ tests pass.

- [ ] **Step 3: Run Next.js Production Build**

Run: `npm run build` inside `frontend`.
Expected: Exit code 0, static and dynamic pages generated successfully.

- [ ] **Step 4: Final commit and cleanup**

```bash
git add -A
git commit -m "chore: complete mobile-first executive fleet dashboard implementation"
```
