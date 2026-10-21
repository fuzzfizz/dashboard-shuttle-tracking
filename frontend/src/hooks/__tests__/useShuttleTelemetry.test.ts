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

  it('provides backward-compatible telemetry and lastSeen values', () => {
    const { result } = renderHook(() => useShuttleTelemetry());

    expect(result.current.telemetry).toBeNull();
    expect(result.current.lastSeen).toBeNull();

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

    expect(result.current.telemetry?.vehicle_id).toBe('shuttle-01');
    expect(result.current.lastSeen).toBeGreaterThan(0);

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

    // Default fallback vehicle when none selected
    expect(result.current.telemetry?.vehicle_id).toBe('shuttle-01');

    act(() => {
      result.current.setSelectedVehicleId('shuttle-02');
    });

    expect(result.current.telemetry?.vehicle_id).toBe('shuttle-02');
    expect(result.current.lastSeen).toBe(result.current.lastSeenMap['shuttle-02']);
  });
});
