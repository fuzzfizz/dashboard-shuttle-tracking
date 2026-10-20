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
