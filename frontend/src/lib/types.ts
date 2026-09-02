export interface User {
  id: string;
  username: string;
  role: string;
  created_at: string;
}

export interface Vehicle {
  id: string;
  plate_number: string;
  model: string;
  status: string;
  current_route_id: string | null;
  device_api_key?: string;
  last_lat?: number | null;
  last_lng?: number | null;
  last_speed?: number | null;
  last_heading?: number | null;
  last_seen_at?: string | null;
  created_at: string;
}

export interface RouteStop {
  id: string;
  route_id: string;
  name: string;
  stop_order: number;
  lat: number;
  lng: number;
  radius_meters: number;
}

export interface Route {
  id: string;
  name: string;
  description: string;
  color: string;
  stops: RouteStop[];
  coordinates?: [number, number][];
  is_active: boolean;
  created_at: string;
}

export interface Trip {
  id: string;
  vehicle_id: string;
  route_id?: string | null;
  started_at: string;
  ended_at?: string | null;
  total_distance_km: number;
  status: string;
  plate_number?: string;
  route_name?: string;
}

export interface GpsPoint {
  id: string;
  trip_id?: string | null;
  vehicle_id: string;
  lat: number;
  lng: number;
  speed_kmh: number;
  heading: number;
  timestamp: string;
  is_valid?: boolean;
  acc?: number | null;
}

export interface TelemetryPayload {
  vehicle_id: string;
  plate_number?: string;
  lat: number;
  lng: number;
  speed_kmh: number;
  heading: number;
  timestamp: string;
  trip_id?: string | null;
  status?: string;
}

export interface VehicleStatusPayload {
  vehicle_id: string;
  status: 'online' | 'offline' | 'idle' | 'in_transit';
  last_seen_at: string | null;
}

export interface TripEventPayload {
  trip_id: string;
  vehicle_id: string;
  started_at: string;
  ended_at?: string | null;
  total_distance_km: number;
}

export interface DailyReportSummary {
  date: string;
  vehicle_id: string;
  plate_number: string;
  total_trips: number;
  total_distance_km: number;
  active_duration_hours: number;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
