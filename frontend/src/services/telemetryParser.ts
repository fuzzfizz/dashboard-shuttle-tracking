import { TelemetryPayload } from '../types/telemetry';

export function parseTelemetryPayload(raw: string, topic?: string): TelemetryPayload | null {
  try {
    const data = JSON.parse(raw);

    // Extract vehicle_id from topic if missing in payload
    let topicVehicleId: string | undefined;
    if (topic) {
      const parts = topic.split('/');
      if (parts[0] === 'shuttle' && parts.length === 2) {
        topicVehicleId = parts[1];
      } else if (parts.length >= 4 && parts[parts.length - 1] === 'telemetry') {
        topicVehicleId = parts[parts.length - 2];
      }
    }

    const vehicleId = (typeof data.vehicle_id === 'string' && data.vehicle_id.trim()) || topicVehicleId;

    if (
      typeof vehicleId === 'string' &&
      vehicleId.length > 0 &&
      typeof data.lat === 'number' && !isNaN(data.lat) &&
      typeof data.lng === 'number' && !isNaN(data.lng) &&
      typeof data.speed === 'number' && !isNaN(data.speed) &&
      typeof data.timestamp === 'number' && !isNaN(data.timestamp)
    ) {
      return {
        vehicle_id: vehicleId,
        lat: data.lat,
        lng: data.lng,
        speed: data.speed,
        heading: typeof data.heading === 'number' && !isNaN(data.heading) ? data.heading : 0,
        timestamp: data.timestamp,
      };
    }
    return null;
  } catch {
    return null;
  }
}
