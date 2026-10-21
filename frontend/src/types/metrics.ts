export interface DailyVehicleMetric {
  vehicle_id: string;
  date: string; // 'YYYY-MM-DD'
  total_distance_km: number;
  max_speed_kmh: number;
  avg_speed_kmh: number;
  active_minutes: number;
  last_updated_at: string;
}

export type DailyMetricsMap = Record<string, DailyVehicleMetric>;
