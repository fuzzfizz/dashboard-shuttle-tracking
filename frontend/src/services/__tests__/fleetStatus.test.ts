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
