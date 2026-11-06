import { useEffect, useRef, useState, useCallback } from 'react';
import { FleetMap } from '../types/telemetry';
import { DailyMetricsMap } from '../types/metrics';
import { getSupabaseClient, isSupabaseConfigured } from '../services/supabaseClient';
import { calculateDistanceIncrement, CoordinatePoint } from '../services/distanceCalculator';
import { getBangkokDate } from '../services/historicalDateUtils';

export { getBangkokDate };


export function useDailyMetrics(vehicles: FleetMap) {
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetricsMap>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // In-memory tracking of previous coordinate and active seconds per vehicle
  const prevCoordsRef = useRef<Record<string, CoordinatePoint>>({});
  const activeSecondsRef = useRef<Record<string, number>>({});

  const todayStr = getBangkokDate();

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
            const remoteActiveMinutes = Number(row.active_minutes) || 0;

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
              active_minutes: existing
                ? Math.max(existing.active_minutes, remoteActiveMinutes)
                : remoteActiveMinutes,
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

  // Real-time incremental distance and active running time accumulation from live telemetry stream
  useEffect(() => {
    const updates: Record<string, { distance: number; maxSpeed: number; addedMinutes: number }> = {};

    for (const vehicle of Object.values(vehicles)) {
      const { vehicle_id, lat, lng, speed, timestamp } = vehicle;
      const currPoint: CoordinatePoint = { lat, lng, speed, timestamp };
      const prevPoint = prevCoordsRef.current[vehicle_id];

      let distanceIncrement = 0;
      let addedMinutes = 0;

      if (prevPoint) {
        distanceIncrement = calculateDistanceIncrement(prevPoint, currPoint);

        const timeDiffSec = Math.abs((currPoint.timestamp - prevPoint.timestamp) / 1000);
        // Active moving threshold: speed >= 2.0 km/h or valid movement distance > 8m
        const isMoving = currPoint.speed >= 2.0 || distanceIncrement > 0.008;

        if (isMoving && timeDiffSec > 0 && timeDiffSec <= 120) {
          const acc = (activeSecondsRef.current[vehicle_id] || 0) + timeDiffSec;
          if (acc >= 60) {
            addedMinutes = Math.floor(acc / 60);
            activeSecondsRef.current[vehicle_id] = acc % 60;
          } else {
            activeSecondsRef.current[vehicle_id] = acc;
          }
        }
      }

      if (distanceIncrement > 0 || addedMinutes > 0) {
        updates[vehicle_id] = {
          distance: distanceIncrement,
          maxSpeed: Math.round(speed * 10) / 10,
          addedMinutes,
        };
      }

      prevCoordsRef.current[vehicle_id] = currPoint;
    }

    if (Object.keys(updates).length > 0) {
      setDailyMetrics((prev) => {
        const next: DailyMetricsMap = { ...prev };
        const nowIso = new Date().toISOString();

        for (const [vehicleId, { distance, maxSpeed, addedMinutes }] of Object.entries(updates)) {
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
          const updatedActiveMinutes = existing.active_minutes + addedMinutes;

          next[vehicleId] = {
            ...existing,
            total_distance_km: updatedDistance,
            max_speed_kmh: updatedMaxSpeed,
            active_minutes: updatedActiveMinutes,
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
