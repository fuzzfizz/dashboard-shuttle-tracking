export interface HistoricalPoint {
  id?: string;
  vehicle_id: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  recorded_at: string;
}

export interface HistoricalTripSummary {
  vehicle_id: string;
  date: string;
  total_distance_km: number;
  max_speed_kmh: number;
  avg_speed_kmh: number;
  total_points: number;
  start_time: string | null;
  end_time: string | null;
}

export type SpeedMultiplier = 1 | 2 | 5 | 10 | 30;
