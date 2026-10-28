import { useState, useEffect, useCallback } from 'react';
import { HistoricalPoint, HistoricalTripSummary } from '../types/historical';
import { fetchHistoricalTripData } from '../services/historicalTelemetryService';

export function useHistoricalTrip(vehicleId: string, dateStr: string) {
  const [points, setPoints] = useState<HistoricalPoint[]>([]);
  const [summary, setSummary] = useState<HistoricalTripSummary>({
    vehicle_id: vehicleId,
    date: dateStr,
    total_distance_km: 0,
    max_speed_kmh: 0,
    avg_speed_kmh: 0,
    total_points: 0,
    start_time: null,
    end_time: null,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!vehicleId || !dateStr) {
      setPoints([]);
      setSummary({
        vehicle_id: vehicleId,
        date: dateStr,
        total_distance_km: 0,
        max_speed_kmh: 0,
        avg_speed_kmh: 0,
        total_points: 0,
        start_time: null,
        end_time: null,
      });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchHistoricalTripData(vehicleId, dateStr);
      setPoints(res.points);
      setSummary(res.summary);
    } catch (err: any) {
      setError(err?.message || 'Failed to load historical data');
      setPoints([]);
      setSummary({
        vehicle_id: vehicleId,
        date: dateStr,
        total_distance_km: 0,
        max_speed_kmh: 0,
        avg_speed_kmh: 0,
        total_points: 0,
        start_time: null,
        end_time: null,
      });
    } finally {
      setIsLoading(false);
    }
  }, [vehicleId, dateStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    points,
    summary,
    isLoading,
    error,
    refetch: loadData,
  };
}
