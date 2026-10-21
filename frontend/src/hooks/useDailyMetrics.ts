import { useEffect, useRef, useState, useCallback } from 'react';
import { FleetMap } from '../types/telemetry';
import { DailyMetricsMap } from '../types/metrics';
import { getSupabaseClient, isSupabaseConfigured } from '../services/supabaseClient';
import { calculateDistanceIncrement, CoordinatePoint } from '../services/distanceCalculator';

export function useDailyMetrics(vehicles: FleetMap) {
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetricsMap>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // In-memory tracking of previous coordinate per vehicle
  const prevCoordsRef = useRef<Record<string, CoordinatePoint>>({});

  const todayStr = new Date().toISOString().split('T')[0];

  // Fetch metrics from Supabase if configured
  const fetchSupabaseMetrics = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('daily_vehicle_metrics')
        .select('*')
        .eq('date', todayStr);

      if (!error && data) {
        setDailyMetrics((prev) => {
          const next: DailyMetricsMap = { ...prev };
          for (const row of data) {
            const vId = row.vehicle_id;
            const existing = prev[vId];
            const remoteDistance = Number(row.total_distance_km) || 0;
            const remoteMaxSpeed = Number(row.max_speed_kmh) || 0;

            next[vId] = {
              vehicle_id: vId,
              date: row.date,
              total_distance_km: existing
                ? Math.max(existing.total_distance_km, remoteDistance)
                : remoteDistance,
              max_speed_kmh: existing
                ? Math.max(existing.max_speed_kmh, remoteMaxSpeed)
                : remoteMaxSpeed,
              avg_speed_kmh: Number(row.avg_speed_kmh) || (existing?.avg_speed_kmh ?? 0),
              active_minutes: Number(row.active_minutes) || (existing?.active_minutes ?? 0),
              last_updated_at: row.last_updated_at || existing?.last_updated_at || new Date().toISOString(),
            };
          }
          return next;
        });
      }
    } catch (err) {
      console.warn('Supabase daily metrics query error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [todayStr]);

  // Initial fetch and 30-second refetch interval
  useEffect(() => {
    if (isSupabaseConfigured()) {
      fetchSupabaseMetrics();
      const interval = setInterval(fetchSupabaseMetrics, 30000);
      return () => clearInterval(interval);
    }
  }, [fetchSupabaseMetrics]);

  // Real-time incremental distance accumulation from live telemetry stream
  useEffect(() => {
    const updates: Record<string, { distance: number; maxSpeed: number }> = {};

    for (const vehicle of Object.values(vehicles)) {
      const { vehicle_id, lat, lng, speed, timestamp } = vehicle;
      const currPoint: CoordinatePoint = { lat, lng, speed, timestamp };
      const prevPoint = prevCoordsRef.current[vehicle_id];

      if (prevPoint) {
        const increment = calculateDistanceIncrement(prevPoint, currPoint);
        if (increment > 0) {
          updates[vehicle_id] = {
            distance: increment,
            maxSpeed: Math.round(speed * 10) / 10,
          };
        }
      }

      prevCoordsRef.current[vehicle_id] = currPoint;
    }

    if (Object.keys(updates).length > 0) {
      setDailyMetrics((prev) => {
        const next: DailyMetricsMap = { ...prev };
        const nowIso = new Date().toISOString();

        for (const [vehicleId, { distance, maxSpeed }] of Object.entries(updates)) {
          const rawExisting = prev[vehicleId];
          const isSameDay = rawExisting && rawExisting.date === todayStr;

          const existing = isSameDay
            ? rawExisting
            : {
                vehicle_id: vehicleId,
                date: todayStr,
                total_distance_km: 0,
                max_speed_kmh: 0,
                avg_speed_kmh: 0,
                active_minutes: 0,
                last_updated_at: nowIso,
              };

          const updatedDistance = Math.round((existing.total_distance_km + distance) * 100) / 100;
          const updatedMaxSpeed = Math.max(existing.max_speed_kmh, maxSpeed);

          next[vehicleId] = {
            ...existing,
            total_distance_km: updatedDistance,
            max_speed_kmh: updatedMaxSpeed,
            last_updated_at: nowIso,
          };
        }

        return next;
      });
    }
  }, [vehicles, todayStr]);

  const totalFleetDistanceKm = Math.round(
    Object.values(dailyMetrics).reduce((sum, m) => sum + m.total_distance_km, 0) * 100
  ) / 100;

  return {
    dailyMetrics,
    totalFleetDistanceKm,
    isLoading,
    refetch: fetchSupabaseMetrics,
  };
}
