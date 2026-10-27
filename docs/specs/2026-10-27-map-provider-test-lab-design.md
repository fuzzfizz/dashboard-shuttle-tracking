# Design Spec: Map Provider Test Lab & Light Mode UI Theme

**Date:** 2026-10-27  
**Status:** Approved  
**Author:** Antigravity Pairing Assistant  

---

## 1. Context & Motivation

To evaluate and benchmark multiple map tile providers for the shuttle tracking dashboard, a dedicated test laboratory page is required at `/map-test`. The user requested:
1. **Multi-Provider Comparison:** Benchmark 5 map providers:
   - OpenStreetMap (OSM)
   - OpenFreeMap (Liberty style)
   - MapTiler (`MAPTILER_KEY=Xo9mrhG2PU9gLkZLFQ5i`)
   - Stadia Maps (`STADIA_KEY=8c4b809b-28d1-4ff7-98eb-5ea527c6c5e7`)
   - Longdo Map Thailand (`longdoAPI=72ba939d7a7166c36d59b88d0b125307`)
2. **Light Map Tiles Only:** All 5 map providers must strictly display their crisp **Light** styles.
3. **Web UI Theme Toggle with Light Default:** The web application UI (surrounding page, header, cards, pills) must support a **Toggle Mode (☀️ Light / 🌙 Dark)** with **Light Mode as the default**.
4. **Discreet Access via URL Only:** The test lab is accessible only via URL path `/map-test` (or `#map-test`), with no public button on the main dashboard (`/`).

---

## 2. Map Providers & Tile Configurations (Strictly Light Mode)

All providers use high-resolution Light tiles:

| Provider | Light Tile Endpoint / Style | Key Used | Attribution |
| :--- | :--- | :--- | :--- |
| **OpenStreetMap** | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` | None (Open) | `&copy; OpenStreetMap contributors` |
| **OpenFreeMap** | `https://tiles.openfreemap.org/styles/liberty` (MapLibre vector) | None (Open) | `&copy; OpenFreeMap &copy; OpenStreetMap` |
| **MapTiler** | `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAPTILER_KEY}` | `Xo9mrhG2PU9gLkZLFQ5i` | `&copy; MapTiler &copy; OpenStreetMap` |
| **Stadia Maps** | `https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key=${STADIA_KEY}` | `8c4b809b-28d1-4ff7-98eb-5ea527c6c5e7` | `&copy; Stadia Maps &copy; OpenMapTiles` |
| **Longdo Map** | `https://ms.longdo.com/mmmap/img.php?zoom={z}&x={x}&y={y}&mode=icons&key=${LONGDO_KEY}&proj=epsg3857&HD=1` | `72ba939d7a7166c36d59b88d0b125307` | `&copy; Longdo Map` |

---

## 3. Web UI & Layout Specifications

### 3.1 Routing & Isolation
- Routing handled client-side in `App.tsx` by inspecting `window.location.pathname.startsWith('/map-test')` or `window.location.hash === '#map-test'`.
- At `/`: The operational dashboard renders unchanged, with no navigation button pointing to `/map-test`.
- At `/map-test`: Dedicated `<MapProviderTestLab />` mounts full-width.

### 3.2 UI Theme Toggle (Light Default)
- Header contains a prominent Theme Toggle: `[ ☀️ Light (Default) | 🌙 Dark ]`.
- **Light Theme (Default):**
  - Page background: `bg-slate-100/80` or `bg-gray-50`
  - Cards & header: `bg-white/95 border-slate-200 text-slate-800 shadow-sm`
  - Pill active states: `bg-emerald-600 text-white shadow-sm`
- **Dark Theme:**
  - Page background: `bg-slate-950`
  - Cards & header: `bg-slate-900/90 border-slate-800 text-slate-100 shadow-xl`
  - Pill active states: `bg-emerald-500 text-slate-950`

### 3.3 View Modes
- **Single View Mode:**
  - High-resolution full screen view of the selected provider.
  - Active provider switcher bar: `[ OpenStreetMap | OpenFreeMap | MapTiler | Stadia Maps | Longdo Map ]`.
  - Specs pill bar: Displays Tile URL, resolution, latency, and attribution.
- **Grid Compare Mode:**
  - Multi-pane comparison layout displaying providers side-by-side.
  - Synchronized camera: Panning or zooming in one map synchronizes center coordinates and zoom level across all map panes.

### 3.4 Top-Down Shuttle Van Preview
- Includes a toggle `[ 🚐 Shuttle Preview: ON (Default) | OFF ]`.
- Renders the custom vector top-down shuttle van with forward headlights and directional heading so users can evaluate contrast and readability over each provider's street colors.

---

## 4. Components & File Architecture

1. **`frontend/src/services/mapProviders.ts`**:
   - Provider configurations, keys, and tile URL constructors.
2. **`frontend/src/components/MapProviderTestLab.tsx`**:
   - Test Lab UI, theme state (Light default), view mode switcher, synchronized map panes, and shuttle preview.
3. **`frontend/src/App.tsx`**:
   - Route condition: if path is `/map-test` or hash `#map-test`, render `<MapProviderTestLab />`.
4. **`frontend/src/components/__tests__/MapProviderTestLab.test.tsx`**:
   - Unit tests covering route detection, UI theme toggling (Light default), provider switching, and grid comparison mode.

---

## 5. Verification Plan

1. **Unit Tests:**
   - Execute `npm test --prefix frontend` verifying all existing 99 tests pass plus new tests for `MapProviderTestLab` and `mapProviders`.
2. **Production Build:**
   - Execute `npm run build --prefix frontend` verifying TypeScript compilation and asset bundling succeed with 0 errors.
3. **Render Deployment Readiness:**
   - Verify SPA route fallback works for `/map-test` under `server.js`.
