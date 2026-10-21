import { FleetMap, FleetStats, TelemetryPayload, VehicleStatus } from '../types/telemetry';

export const OFFLINE_THRESHOLD_MS = 15000;

export function computeVehicleStatus(
  telemetry: TelemetryPayload,
  lastSeen: number,
  now: number = Date.now()
): VehicleStatus {
  return {
    telemetry,
    lastSeen,
    isOnline: now - lastSeen < OFFLINE_THRESHOLD_MS,
  };
}

export function calculateFleetStats(
  fleet: FleetMap,
  lastSeenMap: Record<string, number>,
  now: number = Date.now()
): FleetStats {
  const vehicleList = Object.values(fleet);
  if (vehicleList.length === 0) {
    return { totalVehicles: 0, onlineVehicles: 0, averageSpeed: 0 };
  }

  let onlineCount = 0;
  let totalSpeed = 0;

  for (const v of vehicleList) {
    const lastSeen = lastSeenMap[v.vehicle_id] || 0;
    if (now - lastSeen < OFFLINE_THRESHOLD_MS) {
      onlineCount++;
    }
    totalSpeed += v.speed;
  }

  return {
    totalVehicles: vehicleList.length,
    onlineVehicles: onlineCount,
    averageSpeed: Math.round((totalSpeed / vehicleList.length) * 10) / 10,
  };
}
