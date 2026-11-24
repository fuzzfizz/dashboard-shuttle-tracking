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

  it('extracts vehicle_id from topic when payload does not specify vehicle_id', () => {
    const rawWithoutId = JSON.stringify({
      lat: 18.7891,
      lng: 98.9752,
      speed: 30.0,
      heading: 90,
      timestamp: 1729412400000,
    });

    const parsedFromNewTopic = parseTelemetryPayload(rawWithoutId, 'shuttle/shuttle-cmu-01');
    expect(parsedFromNewTopic?.vehicle_id).toBe('shuttle-cmu-01');

    const parsedFromLegacyTopic = parseTelemetryPayload(rawWithoutId, 'shuttle/fleet/v1/shuttle-cmu-02/telemetry');
    expect(parsedFromLegacyTopic?.vehicle_id).toBe('shuttle-cmu-02');
  });

  it('rejects invalid or incomplete payloads', () => {
    expect(parseTelemetryPayload('invalid json')).toBeNull();
    expect(parseTelemetryPayload(JSON.stringify({ lat: 13.75 }))).toBeNull();
    expect(parseTelemetryPayload(JSON.stringify({ vehicle_id: 'v1', lat: 'not-a-number', lng: 100 }))).toBeNull();
  });
});
