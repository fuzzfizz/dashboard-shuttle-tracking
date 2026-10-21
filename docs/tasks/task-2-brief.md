# Task 2 Brief: Upgrade useShuttleTelemetry Hook for Multi-Vehicle Fleet State

## Files:
- Modify: `frontend/src/hooks/useShuttleTelemetry.ts`
- Create: `frontend/src/hooks/__tests__/useShuttleTelemetry.test.ts`

## Interfaces:
- Consumes: `TelemetryPayload`, `FleetMap`, `ConnectionStatus` from `frontend/src/types/telemetry.ts`
- Produces: `{ status, vehicles, lastSeenMap, selectedVehicleId, setSelectedVehicleId, telemetry, lastSeen }`

## Global Constraints:
- Preserve all existing environment variable names (`VITE_MQTT_BROKER_URL`, `VITE_MQTT_TOPIC`).
- Default topic subscription: `shuttle/fleet/v1/+/telemetry`.
- Backward compatibility: Retain `telemetry` (selected or first vehicle) and `lastSeen` on returned object so existing components continue to function.
- All tests must pass with clean output.

## Steps:

### Step 1: Write failing unit test for `useShuttleTelemetry`
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

### Step 2: Run test to verify it fails
Run: `cd frontend; npx vitest run src/hooks/__tests__/useShuttleTelemetry.test.ts`
Expected: FAIL (Cannot read properties of undefined reading 'vehicles')

### Step 3: Update `frontend/src/hooks/useShuttleTelemetry.ts`
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

### Step 4: Run test to verify it passes
Run: `cd frontend; npx vitest run src/hooks/__tests__/useShuttleTelemetry.test.ts`
Expected: PASS (2 tests passed)

### Step 5: Run existing App and Smoke tests to verify no regressions
Run: `cd frontend; npx vitest run`
Expected: All suites pass.

### Step 6: Commit
```bash
git add frontend/src/hooks/useShuttleTelemetry.ts frontend/src/hooks/__tests__/useShuttleTelemetry.test.ts
git commit -m "feat: upgrade useShuttleTelemetry for multi-vehicle fleet state"
```
