import { getSupabaseClient } from './supabaseClient';
import { haversineDistance } from './distanceCalculator';
import {
  getBangkokStartOfDayUtc,
  getBangkokEndOfDayUtc,
  getBangkokDate,
  getBangkokHour,
} from './historicalDateUtils';
import { HistoricalPoint, HistoricalTripSummary } from '../types/historical';
import { DailyRecordItem } from './analyticsCalculator';


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

export async function fetchHistoricalVehicles(): Promise<Array<{ id: string; name: string }>> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    // 1. Query unique vehicle_ids from daily_vehicle_metrics
    const { data: metricsData, error: metricsError } = await supabase
      .from('daily_vehicle_metrics')
      .select('vehicle_id');

    const idsSet = new Set<string>();
    if (!metricsError && metricsData) {
      metricsData.forEach((row: any) => {
        if (row.vehicle_id) idsSet.add(row.vehicle_id);
      });
    }

    // 2. Fallback to telemetry_logs if daily_vehicle_metrics has no entries
    if (idsSet.size === 0) {
      const { data: logsData } = await supabase
        .from('telemetry_logs')
        .select('vehicle_id')
        .limit(100);
      if (logsData) {
        logsData.forEach((row: any) => {
          if (row.vehicle_id) idsSet.add(row.vehicle_id);
        });
      }
    }

    return Array.from(idsSet).map((id) => ({
      id,
      name: id,
    }));
  } catch (err) {
    console.warn('Failed to fetch historical vehicles from database:', err);
    return [];
  }
}

export async function fetch7DayVehicleMetrics(
  referenceDate: Date = new Date()
): Promise<DailyRecordItem[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const todayDateStr = getBangkokDate(referenceDate);
    const [year, month, day] = todayDateStr.split('-').map(Number);
    const startDate = new Date(Date.UTC(year, month - 1, day));
    startDate.setUTCDate(startDate.getUTCDate() - 6);
    const startDateStr = startDate.toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('daily_vehicle_metrics')
      .select('vehicle_id, date, total_distance_km')
      .gte('date', startDateStr)
      .lte('date', todayDateStr)
      .order('date', { ascending: true });

    if (error || !data) {
      if (error) {
        console.warn('Failed to fetch 7-day vehicle metrics from Supabase:', error);
      }
      return [];
    }

    return data.map((row: any) => ({
      vehicle_id: String(row.vehicle_id || ''),
      date: String(row.date),
      total_distance_km: Number(row.total_distance_km) || 0,
    }));
  } catch (err) {
    console.warn('Exception during fetch7DayVehicleMetrics:', err);
    return [];
  }
}

export async function fetchTodayHourlyDistanceMap(
  dateStr: string
): Promise<Record<string, Record<number, number>>> {
  const supabase = getSupabaseClient();
  if (!supabase || !dateStr) return {};

  try {
    const startUtc = getBangkokStartOfDayUtc(dateStr);
    const endUtc = getBangkokEndOfDayUtc(dateStr);

    let logsQuery = supabase
      .from('telemetry_logs')
      .select('vehicle_id, lat, lng, recorded_at')
      .gte('recorded_at', startUtc)
      .lte('recorded_at', endUtc)
      .order('recorded_at', { ascending: true });

    if (typeof (logsQuery as any).limit === 'function') {
      logsQuery = (logsQuery as any).limit(25000);
    }

    const { data: logsData, error: logsError } = await logsQuery;

    if (logsError || !logsData || logsData.length === 0) {
      if (logsError) {
        console.warn('Failed to fetch telemetry logs for hourly map:', logsError);
      }
      return {};
    }

    const pointsByVehicle: Record<
      string,
      Array<{ lat: number; lng: number; recorded_at: string }>
    > = {};

    for (const row of logsData) {
      const vid = row.vehicle_id;
      if (!vid) continue;
      if (!pointsByVehicle[vid]) {
        pointsByVehicle[vid] = [];
      }
      pointsByVehicle[vid].push({
        lat: Number(row.lat),
        lng: Number(row.lng),
        recorded_at: row.recorded_at,
      });
    }

    const resultMap: Record<string, Record<number, number>> = {};

    for (const [vid, pts] of Object.entries(pointsByVehicle)) {
      resultMap[vid] = {};
      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1];
        const curr = pts[i];
        const dist = haversineDistance(prev.lat, prev.lng, curr.lat, curr.lng);
        // Stationary jitter threshold filter: movement must exceed 8 meters (0.008 km)
        if (dist >= 0.008) {
          const hour = getBangkokHour(curr.recorded_at);
          resultMap[vid][hour] = (resultMap[vid][hour] || 0) + dist;
        }
      }

      for (const h of Object.keys(resultMap[vid])) {
        const hourNum = Number(h);
        resultMap[vid][hourNum] = Math.round(resultMap[vid][hourNum] * 100) / 100;
      }
    }

    return resultMap;
  } catch (err) {
    console.warn('Exception during fetchTodayHourlyDistanceMap:', err);
    return {};
  }
}

