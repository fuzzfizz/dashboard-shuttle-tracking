# Minimal Real-Time Shuttle Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimalist, responsive real-time shuttle tracking map using React (Vite), Tailwind CSS, Leaflet, and MQTT over WebSockets connecting to a public broker (`broker.emqx.io`), accompanied by a telemetry simulation script for instant hardware testing.

**Architecture:** The frontend React application connects directly to a public MQTT broker (`broker.emqx.io:8084`) via secure WebSockets (`wss://`) using the `mqtt` npm package. When incoming JSON telemetry packets arrive on `shuttle/fleet/v1/{vehicle_id}/telemetry`, state is immediately updated to animate a custom directional marker on a CartoDB Positron Leaflet map and update a floating minimalist HUD card.

**Tech Stack:** React 18 / Vite / TypeScript / Tailwind CSS / Leaflet & React-Leaflet / MQTT.js / Lucide-React / Vitest & Testing Library.

## Global Constraints

- Avoid "AI slop": no arbitrary glowing purple gradients; use clean typography, subtle borders, and CartoDB Positron light map tiles.
- The web app must work out-of-the-box in the browser without any local backend server requirement.
- Telemetry format must strictly match:
  `{ "vehicle_id": string, "lat": number, "lng": number, "speed": number, "heading"?: number, "timestamp": number }`
- Code must be fully typed in TypeScript and tested with Vitest.

---

### Task 1: Project Scaffolding & Tooling Setup

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.node.json`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/index.css`
- Create: `frontend/src/test/setup.ts`
- Create: `frontend/src/__tests__/smoke.test.ts`

**Interfaces:**
- Produces: Base React + Vite + Tailwind CSS + Vitest project environment ready for components and tests.

- [ ] **Step 1: Create frontend directory and package.json**

```json
{
  "name": "shuttle-tracking-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "clsx": "^2.1.1",
    "leaflet": "^1.9.4",
    "lucide-react": "^0.453.0",
    "mqtt": "^5.10.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-leaflet": "^4.2.1",
    "tailwind-merge": "^2.5.4"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.2",
    "@testing-library/react": "^16.0.1",
    "@types/leaflet": "^1.9.14",
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "autoprefixer": "^10.4.20",
    "jsdom": "^25.0.1",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.14",
    "typescript": "^5.6.3",
    "vite": "^5.4.9",
    "vitest": "^2.1.3"
  }
}
```

- [ ] **Step 2: Create Vite and TypeScript configurations**

Write `frontend/vite.config.ts`:
```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
```

Write `frontend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

Write `frontend/tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 3: Setup Tailwind CSS & PostCSS**

Write `frontend/tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
```

Write `frontend/postcss.config.js`:
```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

Write `frontend/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root {
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

/* Leaflet map styles */
.leaflet-container {
  height: 100%;
  width: 100%;
  background-color: #f8fafc;
}
```

Write `frontend/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Shuttle Fleet Tracker</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
  </head>
  <body class="bg-slate-900 text-slate-100">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Write `frontend/src/test/setup.ts`:
```ts
import '@testing-library/jest-dom';
```

Write `frontend/src/__tests__/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('Project setup smoke test', () => {
  it('runs tests properly', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Install dependencies and run test verification**

Run: `cd frontend && npm install && npm test`  
Expected: `PASS src/__tests__/smoke.test.ts`

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(setup): initialize vite react typescript tailwind project with vitest"
```

---

### Task 2: Telemetry Data Models & MQTT Client Hook

**Files:**
- Create: `frontend/src/types/telemetry.ts`
- Create: `frontend/src/services/telemetryParser.ts`
- Create: `frontend/src/services/__tests__/telemetryParser.test.ts`
- Create: `frontend/src/hooks/useShuttleTelemetry.ts`

**Interfaces:**
- Produces:
  - `TelemetryPayload`: `{ vehicle_id: string; lat: number; lng: number; speed: number; heading?: number; timestamp: number }`
  - `ConnectionStatus`: `'connecting' | 'connected' | 'disconnected' | 'error'`
  - `parseTelemetryPayload(raw: string): TelemetryPayload | null`
  - `useShuttleTelemetry(options)`: returns `{ telemetry: TelemetryPayload | null; status: ConnectionStatus; lastSeen: number | null }`

- [ ] **Step 1: Write telemetry parser unit tests**

Write `frontend/src/services/__tests__/telemetryParser.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseTelemetryPayload } from '../telemetryParser';

describe('parseTelemetryPayload', () => {
  it('parses valid telemetry JSON', () => {
    const raw = JSON.stringify({
      vehicle_id: 'shuttle-01',
      lat: 13.7563,
      lng: 100.5018,
      speed: 25.4,
      heading: 180,
      timestamp: 1729412400000,
    });
    const parsed = parseTelemetryPayload(raw);
    expect(parsed).toEqual({
      vehicle_id: 'shuttle-01',
      lat: 13.7563,
      lng: 100.5018,
      speed: 25.4,
      heading: 180,
      timestamp: 1729412400000,
    });
  });

  it('rejects invalid or incomplete payloads', () => {
    expect(parseTelemetryPayload('invalid json')).toBeNull();
    expect(parseTelemetryPayload(JSON.stringify({ lat: 13.75 }))).toBeNull();
    expect(parseTelemetryPayload(JSON.stringify({ vehicle_id: 'v1', lat: 'not-a-number', lng: 100 }))).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/services/__tests__/telemetryParser.test.ts`  
Expected: FAIL (cannot find module `telemetryParser`)

- [ ] **Step 3: Implement types and telemetryParser**

Write `frontend/src/types/telemetry.ts`:
```ts
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface TelemetryPayload {
  vehicle_id: string;
  lat: number;
  lng: number;
  speed: number;
  heading?: number;
  timestamp: number;
}

export interface UseShuttleTelemetryOptions {
  brokerUrl?: string;
  topic?: string;
}
```

Write `frontend/src/services/telemetryParser.ts`:
```ts
import { TelemetryPayload } from '../types/telemetry';

export function parseTelemetryPayload(raw: string): TelemetryPayload | null {
  try {
    const data = JSON.parse(raw);
    if (
      typeof data.vehicle_id === 'string' &&
      typeof data.lat === 'number' && !isNaN(data.lat) &&
      typeof data.lng === 'number' && !isNaN(data.lng) &&
      typeof data.speed === 'number' && !isNaN(data.speed) &&
      typeof data.timestamp === 'number' && !isNaN(data.timestamp)
    ) {
      return {
        vehicle_id: data.vehicle_id,
        lat: data.lat,
        lng: data.lng,
        speed: data.speed,
        heading: typeof data.heading === 'number' ? data.heading : 0,
        timestamp: data.timestamp,
      };
    }
    return null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Implement `useShuttleTelemetry` hook**

Write `frontend/src/hooks/useShuttleTelemetry.ts`:
```ts
import { useEffect, useState } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import { ConnectionStatus, TelemetryPayload, UseShuttleTelemetryOptions } from '../types/telemetry';
import { parseTelemetryPayload } from '../services/telemetryParser';

const DEFAULT_BROKER = 'wss://broker.emqx.io:8084/mqtt';
const DEFAULT_TOPIC = 'shuttle/fleet/v1/+/telemetry';

export function useShuttleTelemetry(options: UseShuttleTelemetryOptions = {}) {
  const brokerUrl = options.brokerUrl || DEFAULT_BROKER;
  const topic = options.topic || DEFAULT_TOPIC;

  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [telemetry, setTelemetry] = useState<TelemetryPayload | null>(null);
  const [lastSeen, setLastSeen] = useState<number | null>(null);

  useEffect(() => {
    setStatus('connecting');
    const client: MqttClient = mqtt.connect(brokerUrl, {
      clientId: `shuttle_web_${Math.random().toString(16).slice(2, 10)}`,
      clean: true,
      connectTimeout: 8000,
      reconnectPeriod: 3000,
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
        setTelemetry(parsed);
        setLastSeen(Date.now());
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

  return { status, telemetry, lastSeen };
}
```

- [ ] **Step 5: Run tests and verify PASS**

Run: `cd frontend && npx vitest run src/services/__tests__/telemetryParser.test.ts`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types frontend/src/services frontend/src/hooks
git commit -m "feat(telemetry): add telemetry parser and MQTT client hook"
```

---

### Task 3: Minimalist Telemetry HUD Card Component

**Files:**
- Create: `frontend/src/components/TelemetryHUD.tsx`
- Create: `frontend/src/components/__tests__/TelemetryHUD.test.tsx`

**Interfaces:**
- Consumes: `TelemetryPayload`, `ConnectionStatus`
- Produces: `<TelemetryHUD telemetry={telemetry} status={status} lastSeen={lastSeen} />`

- [ ] **Step 1: Write HUD unit test**

Write `frontend/src/components/__tests__/TelemetryHUD.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TelemetryHUD } from '../TelemetryHUD';

describe('TelemetryHUD', () => {
  it('renders connecting state when no telemetry received yet', () => {
    render(<TelemetryHUD telemetry={null} status="connecting" lastSeen={null} />);
    expect(screen.getByText(/Connecting/i)).toBeInTheDocument();
    expect(screen.getByText(/Waiting for device telemetry/i)).toBeInTheDocument();
  });

  it('renders vehicle speed and ID when telemetry is provided', () => {
    const telemetry = {
      vehicle_id: 'shuttle-01',
      lat: 13.7563,
      lng: 100.5018,
      speed: 32.4,
      heading: 90,
      timestamp: Date.now(),
    };
    render(<TelemetryHUD telemetry={telemetry} status="connected" lastSeen={Date.now()} />);
    expect(screen.getByText('SHUTTLE-01')).toBeInTheDocument();
    expect(screen.getByText('32.4')).toBeInTheDocument();
    expect(screen.getByText(/km\/h/i)).toBeInTheDocument();
    expect(screen.getByText(/13.7563, 100.5018/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/__tests__/TelemetryHUD.test.tsx`  
Expected: FAIL (cannot find module `TelemetryHUD`)

- [ ] **Step 3: Implement `TelemetryHUD` component**

Write `frontend/src/components/TelemetryHUD.tsx`:
```tsx
import React, { useEffect, useState } from 'react';
import { ConnectionStatus, TelemetryPayload } from '../types/telemetry';
import { Radio, Navigation, Gauge, Clock } from 'lucide-react';

interface TelemetryHUDProps {
  telemetry: TelemetryPayload | null;
  status: ConnectionStatus;
  lastSeen: number | null;
}

export const TelemetryHUD: React.FC<TelemetryHUDProps> = ({ telemetry, status, lastSeen }) => {
  const [secondsAgo, setSecondsAgo] = useState<number | null>(null);

  useEffect(() => {
    if (!lastSeen) {
      setSecondsAgo(null);
      return;
    }
    const updateTime = () => {
      setSecondsAgo(Math.floor((Date.now() - lastSeen) / 1000));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [lastSeen]);

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return { dot: 'bg-emerald-500 animate-pulse', text: 'text-emerald-700', label: 'Online' };
      case 'connecting':
        return { dot: 'bg-amber-500 animate-ping', text: 'text-amber-700', label: 'Connecting' };
      case 'disconnected':
      case 'error':
      default:
        return { dot: 'bg-rose-500', text: 'text-rose-700', label: 'Disconnected' };
    }
  };

  const statusConfig = getStatusColor();

  return (
    <div className="absolute top-4 right-4 z-[1000] w-80 bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-xl shadow-lg p-4 text-slate-800 transition-all duration-300">
      {/* Header & Status */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-slate-100 rounded-lg text-slate-600">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Telemetry Feed</h2>
            <p className="text-sm font-bold text-slate-900 tracking-tight">
              {telemetry ? telemetry.vehicle_id.toUpperCase() : 'NO VEHICLE'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/60 rounded-full px-2.5 py-1">
          <span className={`w-2 h-2 rounded-full ${statusConfig.dot}`} />
          <span className={`text-xs font-medium ${statusConfig.text}`}>{statusConfig.label}</span>
        </div>
      </div>

      {telemetry ? (
        <div className="space-y-3">
          {/* Speed Display */}
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-500">
              <Gauge className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-medium">Speed</span>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold font-mono text-slate-900">{telemetry.speed.toFixed(1)}</span>
              <span className="text-xs font-medium text-slate-500 ml-1">km/h</span>
            </div>
          </div>

          {/* Coordinates & Heading */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
              <span className="text-slate-400 block mb-0.5 font-medium">Coordinates</span>
              <span className="font-mono font-medium text-slate-700 block truncate">
                {telemetry.lat.toFixed(4)}, {telemetry.lng.toFixed(4)}
              </span>
            </div>
            <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
              <span className="text-slate-400 block mb-0.5 font-medium">Heading</span>
              <div className="flex items-center gap-1 font-mono font-medium text-slate-700">
                <Navigation
                  className="w-3.5 h-3.5 text-slate-500 transition-transform duration-300"
                  style={{ transform: `rotate(${telemetry.heading || 0}deg)` }}
                />
                <span>{Math.round(telemetry.heading || 0)}°</span>
              </div>
            </div>
          </div>

          {/* Last Seen Footer */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> Last packet
            </span>
            <span className="font-medium text-slate-600">
              {secondsAgo === null || secondsAgo === 0 ? 'Just now' : `${secondsAgo}s ago`}
            </span>
          </div>
        </div>
      ) : (
        <div className="py-6 text-center text-slate-400">
          <p className="text-xs">Waiting for device telemetry...</p>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">Topic: shuttle/fleet/v1/+/telemetry</p>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/__tests__/TelemetryHUD.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/TelemetryHUD.tsx frontend/src/components/__tests__/TelemetryHUD.test.tsx
git commit -m "feat(ui): add minimalist TelemetryHUD card component"
```

---

### Task 4: Interactive Minimalist Leaflet Map Component

**Files:**
- Create: `frontend/src/components/ShuttleMap.tsx`
- Create: `frontend/src/components/__tests__/ShuttleMap.test.tsx`

**Interfaces:**
- Consumes: `TelemetryPayload | null`
- Produces: `<ShuttleMap telemetry={telemetry} defaultCenter={[13.7563, 100.5018]} />`

- [ ] **Step 1: Write map component test**

Write `frontend/src/components/__tests__/ShuttleMap.test.tsx`:
```tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ShuttleMap } from '../ShuttleMap';

describe('ShuttleMap', () => {
  it('renders map container without crashing', () => {
    const { container } = render(<ShuttleMap telemetry={null} />);
    expect(container.querySelector('.leaflet-container')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/__tests__/ShuttleMap.test.tsx`  
Expected: FAIL (cannot find module `ShuttleMap`)

- [ ] **Step 3: Implement `ShuttleMap` with CartoDB Positron tiles and custom SVG marker**

Write `frontend/src/components/ShuttleMap.tsx`:
```tsx
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { TelemetryPayload } from '../types/telemetry';

// CartoDB Positron clean light tile layer
const CARTO_POSITRON_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const CARTO_ATTRIBUTION = '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

interface ShuttleMapProps {
  telemetry: TelemetryPayload | null;
  defaultCenter?: [number, number];
  zoom?: number;
}

// Controller component to smoothly center map when coordinates change
const AutoCenter: React.FC<{ coords: [number, number] | null }> = ({ coords }) => {
  const map = useMap();
  useEffect(() => {
    if (coords) {
      map.panTo(coords, { animate: true, duration: 1.0 });
    }
  }, [coords, map]);
  return null;
};

// Custom SVG vehicle marker with direction arrow and live pulse ring
function createVehicleIcon(heading: number = 0) {
  const html = `
    <div style="position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
      <!-- Subtle outer pulse -->
      <div style="position: absolute; width: 36px; height: 36px; background: rgba(16, 185, 129, 0.25); border-radius: 9999px; animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></div>
      <!-- Center vehicle body with heading -->
      <div style="position: relative; width: 26px; height: 26px; background: #0f172a; border: 2.5px solid #ffffff; border-radius: 9999px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2); display: flex; align-items: center; justify-content: center; transform: rotate(${heading}deg); transition: transform 0.4s ease;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>
        </svg>
      </div>
    </div>
  `;
  return L.divIcon({
    html,
    className: 'custom-vehicle-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

export const ShuttleMap: React.FC<ShuttleMapProps> = ({
  telemetry,
  defaultCenter = [13.7563, 100.5018],
  zoom = 15,
}) => {
  const position: [number, number] = telemetry ? [telemetry.lat, telemetry.lng] : defaultCenter;

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={position}
        zoom={zoom}
        zoomControl={false}
        className="w-full h-full"
      >
        <TileLayer
          attribution={CARTO_ATTRIBUTION}
          url={CARTO_POSITRON_URL}
          maxZoom={19}
        />
        {telemetry && (
          <>
            <Marker position={[telemetry.lat, telemetry.lng]} icon={createVehicleIcon(telemetry.heading)} />
            <AutoCenter coords={[telemetry.lat, telemetry.lng]} />
          </>
        )}
      </MapContainer>
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/__tests__/ShuttleMap.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ShuttleMap.tsx frontend/src/components/__tests__/ShuttleMap.test.tsx
git commit -m "feat(map): add ShuttleMap component with CartoDB Positron and custom marker"
```

---

### Task 5: App Integration & Telemetry Hardware Simulator Tool

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/main.tsx`
- Create: `tools/simulate.js`
- Create: `tools/package.json`
- Create: `tools/README.md`

**Interfaces:**
- Produces: Complete working dashboard with live MQTT hook, Map, and HUD.
- Produces: `node tools/simulate.js` CLI tool that publishes test coordinates to `broker.emqx.io:1883` every 1.5 seconds.

- [ ] **Step 1: Write `App.tsx` integrating hook, HUD, and Map**

Write `frontend/src/App.tsx`:
```tsx
import { useShuttleTelemetry } from './hooks/useShuttleTelemetry';
import { ShuttleMap } from './components/ShuttleMap';
import { TelemetryHUD } from './components/TelemetryHUD';
import { Bus } from 'lucide-react';

export function App() {
  const { status, telemetry, lastSeen } = useShuttleTelemetry();

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-900 select-none">
      {/* Top minimal header brand */}
      <div className="absolute top-4 left-4 z-[1000] flex items-center gap-2.5 bg-white/95 backdrop-blur-sm border border-slate-200/80 px-3.5 py-2 rounded-xl shadow-md">
        <div className="p-1.5 bg-slate-900 text-white rounded-lg">
          <Bus className="w-4 h-4" />
        </div>
        <div>
          <h1 className="text-xs font-bold uppercase tracking-wider text-slate-800">Shuttle Tracker</h1>
          <p className="text-[10px] text-slate-400 font-mono">Live Hardware Gateway</p>
        </div>
      </div>

      {/* Floating HUD Card */}
      <TelemetryHUD telemetry={telemetry} status={status} lastSeen={lastSeen} />

      {/* Interactive Map */}
      <ShuttleMap telemetry={telemetry} defaultCenter={[13.7563, 100.5018]} zoom={15} />
    </div>
  );
}

export default App;
```

Write `frontend/src/main.tsx`:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 2: Create Hardware Simulation Tool**

Write `tools/package.json`:
```json
{
  "name": "shuttle-telemetry-tools",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "simulate": "node simulate.js"
  },
  "dependencies": {
    "mqtt": "^5.10.1"
  }
}
```

Write `tools/simulate.js`:
```js
import mqtt from 'mqtt';

const BROKER = 'mqtt://broker.emqx.io:1883';
const VEHICLE_ID = 'shuttle-01';
const TOPIC = `shuttle/fleet/v1/${VEHICLE_ID}/telemetry`;

console.log(`Connecting to ${BROKER}...`);
const client = mqtt.connect(BROKER, {
  clientId: `sim_hardware_${Math.random().toString(16).slice(2, 8)}`,
});

// Starting coordinates (Bangkok demo route)
let lat = 13.7563;
let lng = 100.5018;
let speed = 25.0;
let heading = 45.0;

client.on('connect', () => {
  console.log(`Connected to broker! Publishing to topic: ${TOPIC}`);
  console.log(`Press Ctrl+C to stop simulation.\n`);

  setInterval(() => {
    // Simulate slight movement
    lat += (Math.random() - 0.45) * 0.0003;
    lng += (Math.random() - 0.45) * 0.0003;
    speed = Math.max(5.0, Math.min(60.0, speed + (Math.random() - 0.5) * 4.0));
    heading = (heading + (Math.random() - 0.5) * 10.0 + 360) % 360;

    const payload = {
      vehicle_id: VEHICLE_ID,
      lat: parseFloat(lat.toFixed(6)),
      lng: parseFloat(lng.toFixed(6)),
      speed: parseFloat(speed.toFixed(1)),
      heading: parseFloat(heading.toFixed(1)),
      timestamp: Date.now(),
    };

    client.publish(TOPIC, JSON.stringify(payload), { qos: 0 }, (err) => {
      if (err) {
        console.error('Publish error:', err);
      } else {
        console.log(`[${new Date().toLocaleTimeString()}] Sent: Lat=${payload.lat}, Lng=${payload.lng}, Speed=${payload.speed} km/h`);
      }
    });
  }, 1500);
});

client.on('error', (err) => {
  console.error('MQTT connection error:', err);
});
```

Write `tools/README.md`:
```markdown
# Telemetry Simulator & Hardware Guide

### Running the Simulator
To test the web map without hardware:
```bash
cd tools
npm install
node simulate.js
```

### Hardware Firmware Configuration (ESP32 / GSM)
- **Protocol:** MQTT (TCP)
- **Host:** `broker.emqx.io`
- **Port:** `1883`
- **Topic:** `shuttle/fleet/v1/shuttle-01/telemetry`
- **Format:** JSON matching:
```json
{
  "vehicle_id": "shuttle-01",
  "lat": 13.7563,
  "lng": 100.5018,
  "speed": 24.5,
  "heading": 90,
  "timestamp": 1729412400000
}
```
```

- [ ] **Step 3: Run full tests and build verification**

Run: `cd frontend && npm test && npm run build`  
Expected: All tests pass, build produces `frontend/dist/` without errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/ tools/
git commit -m "feat: complete dashboard app integration and telemetry simulation tool"
```
