import { getSupabaseClient } from './supabaseClient';
import { haversineDistance } from './distanceCalculator';
import { getBangkokStartOfDayUtc, getBangkokEndOfDayUtc } from './historicalDateUtils';
import { HistoricalPoint, HistoricalTripSummary } from '../types/historical';

export async function fetchHistoricalTripData(
  vehicleId: string,
  dateStr: string
): Promise<{ points: HistoricalPoint[]; summary: HistoricalTripSummary }> {
  const supabase = getSupabaseClient();

  const emptySummary: HistoricalTripSummary = {
    vehicle_id: vehicleId,
    date: dateStr,
    total_distance_km: 0,
    max_speed_kmh: 0,
    avg_speed_kmh: 0,
    total_points: 0,
    start_time: null,
    end_time: null,
  };

  if (!supabase || !vehicleId || !dateStr) {
    return { points: [], summary: emptySummary };
  }

  const startUtc = getBangkokStartOfDayUtc(dateStr);
  const endUtc = getBangkokEndOfDayUtc(dateStr);

  // 1. Fetch telemetry points
  let logsQuery = supabase
    .from('telemetry_logs')
    .select('id, vehicle_id, lat, lng, speed, heading, recorded_at')
    .eq('vehicle_id', vehicleId)
    .gte('recorded_at', startUtc)
    .lte('recorded_at', endUtc)
    .order('recorded_at', { ascending: true });

  if (typeof (logsQuery as any).limit === 'function') {
    logsQuery = (logsQuery as any).limit(10000);
  }

  const { data: logsData, error: logsError } = await logsQuery;

  if (logsError) {
    throw new Error(logsError.message || 'Failed to fetch telemetry logs');
  }

  const points: HistoricalPoint[] = (logsData || []).map((row: any) => ({
    id: row.id,
    vehicle_id: row.vehicle_id,
    lat: Number(row.lat),
    lng: Number(row.lng),
    speed: Number(row.speed) || 0,
    heading: Number(row.heading) || 0,
    recorded_at: row.recorded_at,
  }));

  if (points.length === 0) {
    return { points: [], summary: emptySummary };
  }

  // 2. Fetch daily metrics (if available)
  const { data: metricsData } = await supabase
    .from('daily_vehicle_metrics')
    .select('total_distance_km, max_speed_kmh, avg_speed_kmh')
    .eq('vehicle_id', vehicleId)
    .eq('date', dateStr)
    .maybeSingle();

  let totalDistanceKm = Number(metricsData?.total_distance_km) || 0;
  let maxSpeedKmh = Number(metricsData?.max_speed_kmh) || 0;
  let avgSpeedKmh = Number(metricsData?.avg_speed_kmh) || 0;

  // Fallback distance calculation if daily_vehicle_metrics has no record or 0
  if (totalDistanceKm === 0 && points.length > 0) {
    let calcDist = 0;
    let maxSpd = points[0].speed;
    let speedSum = points[0].speed;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      calcDist += haversineDistance(prev.lat, prev.lng, curr.lat, curr.lng);
      if (curr.speed > maxSpd) maxSpd = curr.speed;
      speedSum += curr.speed;
    }
    totalDistanceKm = Math.round(calcDist * 100) / 100;
    maxSpeedKmh = maxSpd;
    avgSpeedKmh = Math.round((speedSum / points.length) * 10) / 10;
  }

  const summary: HistoricalTripSummary = {
    vehicle_id: vehicleId,
    date: dateStr,
    total_distance_km: totalDistanceKm,
    max_speed_kmh: maxSpeedKmh,
    avg_speed_kmh: avgSpeedKmh,
    total_points: points.length,
    start_time: points[0].recorded_at,
    end_time: points[points.length - 1].recorded_at,
  };

  return { points, summary };
}
