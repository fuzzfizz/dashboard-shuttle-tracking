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
  username?: string;
  password?: string;
}
