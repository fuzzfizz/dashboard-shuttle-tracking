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
