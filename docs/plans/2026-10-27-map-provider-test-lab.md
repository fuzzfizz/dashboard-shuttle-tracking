# Map Provider Test Lab & Light Mode UI Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a dedicated test lab page at `/map-test` to benchmark 5 map providers (OpenStreetMap, OpenFreeMap, MapTiler, Stadia Maps, Longdo Map) using Light map styles, with a website UI theme toggle defaulting to Light Mode.

**Architecture:** Client-side path/hash route switch in `App.tsx` rendering a dedicated `MapProviderTestLab` component; centralized map provider configuration service; synchronized multi-pane Leaflet grid; reactive UI theme state with `light` default.

**Tech Stack:** React 18, Leaflet, React-Leaflet, TypeScript, Vitest, Tailwind CSS, Lucide icons.

## Global Constraints

- All 5 map tile providers must strictly render their **Light** styles.
- The web application UI must provide a **Toggle Mode (☀️ Light / 🌙 Dark)** with **Light Mode as the default**.
- Access to the test lab is strictly via URL `/map-test` or `#map-test`. The operational dashboard at `/` must NOT display a navigation button pointing to `/map-test`.
- API keys used:
  - MapTiler: `Xo9mrhG2PU9gLkZLFQ5i`
  - Stadia Maps: `8c4b809b-28d1-4ff7-98eb-5ea527c6c5e7`
  - Longdo Map: `72ba939d7a7166c36d59b88d0b125307`
- All existing 99 frontend tests must continue to pass with zero regressions.

---

### Task 1: Create Map Providers Service Configuration

**Files:**
- Create: `frontend/src/services/mapProviders.ts`
- Test: `frontend/src/services/__tests__/mapProviders.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface MapProviderConfig {
    id: string;
    name: string;
    category: string;
    tileUrl: string;
    attribution: string;
    maxZoom?: number;
    subdomains?: string[];
    description: string;
    keyRequired: boolean;
  }
  export const MAP_PROVIDERS: Record<string, MapProviderConfig>;
  export function getMapProvider(id: string): MapProviderConfig;
  export function getAllMapProviders(): MapProviderConfig[];
  ```

- [ ] **Step 1: Write failing tests for mapProviders service**

Create `frontend/src/services/__tests__/mapProviders.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getAllMapProviders, getMapProvider, MAP_PROVIDERS } from '../mapProviders';

describe('mapProviders service', () => {
  it('contains all 5 required map providers', () => {
    const providers = getAllMapProviders();
    const ids = providers.map((p) => p.id);
    expect(ids).toContain('osm');
    expect(ids).toContain('openfreemap');
    expect(ids).toContain('maptiler');
    expect(ids).toContain('stadiamaps');
    expect(ids).toContain('longdomap');
  });

  it('correctly configures OpenStreetMap light tiles', () => {
    const osm = getMapProvider('osm');
    expect(osm.name).toBe('OpenStreetMap');
    expect(osm.tileUrl).toContain('tile.openstreetmap.org');
    expect(osm.keyRequired).toBe(false);
  });

  it('correctly configures OpenFreeMap light tiles', () => {
    const ofm = getMapProvider('openfreemap');
    expect(ofm.name).toBe('OpenFreeMap');
    expect(ofm.tileUrl).toContain('openfreemap.org');
    expect(ofm.keyRequired).toBe(false);
  });

  it('correctly configures MapTiler light tiles with provided API key', () => {
    const maptiler = getMapProvider('maptiler');
    expect(maptiler.name).toBe('MapTiler');
    expect(maptiler.tileUrl).toContain('api.maptiler.com');
    expect(maptiler.tileUrl).toContain('Xo9mrhG2PU9gLkZLFQ5i');
    expect(maptiler.keyRequired).toBe(true);
  });

  it('correctly configures Stadia Maps light tiles with provided API key', () => {
    const stadia = getMapProvider('stadiamaps');
    expect(stadia.name).toBe('Stadia Maps');
    expect(stadia.tileUrl).toContain('tiles.stadiamaps.com');
    expect(stadia.tileUrl).toContain('8c4b809b-28d1-4ff7-98eb-5ea527c6c5e7');
    expect(stadia.keyRequired).toBe(true);
  });

  it('correctly configures Longdo Map light tiles with provided API key and EPSG:3857 projection', () => {
    const longdo = getMapProvider('longdomap');
    expect(longdo.name).toBe('Longdo Map');
    expect(longdo.tileUrl).toContain('ms.longdo.com');
    expect(longdo.tileUrl).toContain('72ba939d7a7166c36d59b88d0b125307');
    expect(longdo.tileUrl).toContain('proj=epsg3857');
    expect(longdo.keyRequired).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix frontend src/services/__tests__/mapProviders.test.ts`  
Expected: FAIL with "Cannot find module '../mapProviders'"

- [ ] **Step 3: Implement `frontend/src/services/mapProviders.ts`**

Write the service implementation:

```typescript
export interface MapProviderConfig {
  id: string;
  name: string;
  category: string;
  tileUrl: string;
  attribution: string;
  maxZoom: number;
  subdomains?: string[];
  description: string;
  keyRequired: boolean;
}

export const DEFAULT_MAPTILER_KEY =
  import.meta.env.VITE_MAPTILER_KEY || 'Xo9mrhG2PU9gLkZLFQ5i';
export const DEFAULT_STADIA_KEY =
  import.meta.env.VITE_STADIA_KEY || '8c4b809b-28d1-4ff7-98eb-5ea527c6c5e7';
export const DEFAULT_LONGDO_KEY =
  import.meta.env.VITE_LONGDO_KEY || '72ba939d7a7166c36d59b88d0b125307';

export const MAP_PROVIDERS: Record<string, MapProviderConfig> = {
  osm: {
    id: 'osm',
    name: 'OpenStreetMap',
    category: 'Open Source',
    tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c'],
    description: 'Standard community-driven global road map (Free & Open Source).',
    keyRequired: false,
  },
  openfreemap: {
    id: 'openfreemap',
    name: 'OpenFreeMap',
    category: 'Free Vector/Raster',
    tileUrl: 'https://tiles.openfreemap.org/styles/bright/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    maxZoom: 19,
    description: 'Ultra-fast vector map tiles with clean Bright aesthetic (Free & Open Source).',
    keyRequired: false,
  },
  maptiler: {
    id: 'maptiler',
    name: 'MapTiler',
    category: 'Commercial / High-Res',
    tileUrl: `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${DEFAULT_MAPTILER_KEY}`,
    attribution:
      '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noreferrer">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    maxZoom: 20,
    description: 'High-detail professional cartography with rich POIs and landmarks.',
    keyRequired: true,
  },
  stadiamaps: {
    id: 'stadiamaps',
    name: 'Stadia Maps',
    category: 'Clean Minimalist',
    tileUrl: `https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key=${DEFAULT_STADIA_KEY}`,
    attribution:
      '&copy; <a href="https://stadiamaps.com/" target="_blank" rel="noreferrer">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a>',
    maxZoom: 20,
    description: 'Subtle Alidade Smooth theme, perfect for high-contrast vehicle telemetry overlays.',
    keyRequired: true,
  },
  longdomap: {
    id: 'longdomap',
    name: 'Longdo Map',
    category: 'Thai Localized',
    tileUrl: `https://ms.longdo.com/mmmap/img.php?zoom={z}&x={x}&y={y}&mode=icons&key=${DEFAULT_LONGDO_KEY}&proj=epsg3857&HD=1`,
    attribution:
      '&copy; <a href="https://map.longdo.com/" target="_blank" rel="noreferrer">Longdo Map</a>',
    maxZoom: 20,
    description: 'Premier Thai localized map with comprehensive building names and sois in Thailand.',
    keyRequired: true,
  },
};

export function getAllMapProviders(): MapProviderConfig[] {
  return Object.values(MAP_PROVIDERS);
}

export function getMapProvider(id: string): MapProviderConfig {
  return MAP_PROVIDERS[id] || MAP_PROVIDERS.osm;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --prefix frontend src/services/__tests__/mapProviders.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/mapProviders.ts frontend/src/services/__tests__/mapProviders.test.ts
git commit -m "feat(services): implement mapProviders service configuration with light tile styles"
```

---

### Task 2: Implement Map Provider Test Lab Component

**Files:**
- Create: `frontend/src/components/MapProviderTestLab.tsx`
- Test: `frontend/src/components/__tests__/MapProviderTestLab.test.tsx`

**Interfaces:**
- Consumes: `MAP_PROVIDERS`, `getAllMapProviders`, `AnimatedVehicleMarker`, `createVehicleIcon`
- Produces: `<MapProviderTestLab />` supporting UI Theme Toggle (`light` default), Single View, Grid Compare, and Shuttle Preview.

- [ ] **Step 1: Write failing tests for MapProviderTestLab**

Create `frontend/src/components/__tests__/MapProviderTestLab.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapProviderTestLab } from '../MapProviderTestLab';

describe('MapProviderTestLab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders test lab header with Light mode as default UI theme', () => {
    const { container } = render(<MapProviderTestLab />);
    expect(screen.getByText(/Map Provider Lab/i)).toBeInTheDocument();
    
    // Light mode is default
    const themeToggle = screen.getByRole('button', { name: /Light/i });
    expect(themeToggle).toBeInTheDocument();
    expect(container.querySelector('.bg-slate-50, .bg-gray-50')).not.toBeNull();
  });

  it('toggles UI theme between Light and Dark mode', () => {
    const { container } = render(<MapProviderTestLab />);
    const darkButton = screen.getByRole('button', { name: /Dark/i });
    fireEvent.click(darkButton);

    // Dark mode container styles active
    expect(container.querySelector('.bg-slate-950')).not.toBeNull();
  });

  it('renders provider selection pills for all 5 providers', () => {
    render(<MapProviderTestLab />);
    expect(screen.getByRole('button', { name: /OpenStreetMap/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /OpenFreeMap/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /MapTiler/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Stadia Maps/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Longdo Map/i })).toBeInTheDocument();
  });

  it('switches between Single View and Grid Compare modes', () => {
    render(<MapProviderTestLab />);
    const gridButton = screen.getByRole('button', { name: /Grid Compare/i });
    fireEvent.click(gridButton);

    expect(screen.getByText(/Compare 5 Providers/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix frontend src/components/__tests__/MapProviderTestLab.test.tsx`  
Expected: FAIL with "Cannot find module '../MapProviderTestLab'"

- [ ] **Step 3: Implement `frontend/src/components/MapProviderTestLab.tsx`**

Implement `<MapProviderTestLab />`:
- State: `uiTheme: 'light' | 'dark'` (default: `'light'`)
- State: `viewMode: 'single' | 'grid'` (default: `'single'`)
- State: `selectedProviderId: string` (default: `'osm'`)
- State: `showShuttle: boolean` (default: `true`)
- Synchronized camera in grid mode using `useMapEvents`
- Render sample animated shuttle van marker using `AnimatedVehicleMarker`
- Sleek toggle controls for UI Theme (`☀️ Light (Default)` vs `🌙 Dark`)
- High contrast styling based on `uiTheme`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --prefix frontend src/components/__tests__/MapProviderTestLab.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/MapProviderTestLab.tsx frontend/src/components/__tests__/MapProviderTestLab.test.tsx
git commit -m "feat(components): implement MapProviderTestLab with light theme default and multi-provider comparison"
```

---

### Task 3: URL Route Integration in `App.tsx`

**Files:**
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/__tests__/App.test.tsx`

**Interfaces:**
- Consumes: `<MapProviderTestLab />`
- Produces: Route condition rendering `<MapProviderTestLab />` if `pathname.startsWith('/map-test')` or `hash === '#map-test'`, otherwise rendering default operational dashboard without `/map-test` button.

- [ ] **Step 1: Write test for URL route detection in `App.test.tsx`**

Add tests to `frontend/src/__tests__/App.test.tsx`:

```typescript
  it('renders MapProviderTestLab when URL is /map-test', () => {
    // Set window location pathname to /map-test
    window.history.pushState({}, '', '/map-test');
    const { getByText } = render(<App />);
    expect(getByText(/Map Provider Lab/i)).toBeInTheDocument();
    window.history.pushState({}, '', '/');
  });

  it('renders default operational dashboard at / without any public map-test button', () => {
    window.history.pushState({}, '', '/');
    const { queryByText, getByText } = render(<App />);
    expect(getByText(/Smart Shuttle Tracking/i)).toBeInTheDocument();
    // No public button pointing to map-test on main dashboard
    expect(queryByText(/Map Provider Lab/i)).toBeNull();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix frontend src/__tests__/App.test.tsx`  
Expected: FAIL on `/map-test` rendering

- [ ] **Step 3: Update `App.tsx` with route detection**

In `frontend/src/App.tsx`:
1. Add state: `const [currentPath, setCurrentPath] = useState(window.location.pathname + window.location.hash);`
2. Listen to `popstate` and `hashchange` events in `useEffect`.
3. If `currentPath.startsWith('/map-test')` or `currentPath === '#map-test'`: return `<MapProviderTestLab />`.
4. Otherwise return regular operational dashboard.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --prefix frontend src/__tests__/App.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/__tests__/App.test.tsx
git commit -m "feat(app): add URL-only route detection for /map-test test lab"
```

---

### Task 4: Full Verification & Build Check

**Files:**
- Entire codebase

- [ ] **Step 1: Run all unit and integration tests**

Run: `npm test --prefix frontend`  
Expected: All test suites PASS (0 failures)

- [ ] **Step 2: Run production build**

Run: `npm run build --prefix frontend`  
Expected: Build succeeds with 0 errors

- [ ] **Step 3: Commit any final test updates or cleanups**

```bash
git add .
git commit -m "chore: verify full test suite and production build for map provider lab"
```
