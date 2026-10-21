export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface TelemetryPayload {
  vehicle_id: string;
  lat: number;
  lng: number;
  speed: number;
  heading?: number;
  timestamp: number;
}

export type FleetMap = Record<string, TelemetryPayload>;

export interface VehicleStatus {
  telemetry: TelemetryPayload;
  lastSeen: number;
  isOnline: boolean;
}

export interface FleetStats {
  totalVehicles: number;
  onlineVehicles: number;
  averageSpeed: number;
}

export interface UseShuttleTelemetryOptions {
  brokerUrl?: string;
  topic?: string;
  username?: string;
  password?: string;
}
