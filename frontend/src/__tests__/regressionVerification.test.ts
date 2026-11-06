import { describe, it, expect } from 'vitest';
import { compute7DayTrendData } from '../services/analyticsCalculator';
import { DailyMetricsMap } from '../types/metrics';

describe('Regression Verification: 2026-11-05 Historical Analytics', () => {
  it('verifies that shuttle-01 historical record for 2026-11-05 produces 4.91 km trend point', () => {
    // Reference date is 2026-11-06 in Bangkok
    const refDate = new Date('2026-11-06T12:00:00+07:00');

    // Actual record retrieved from Supabase daily_vehicle_metrics
    const actualSupabaseRecords = [
      {
        vehicle_id: 'shuttle-01',
        date: '2026-11-05',
        total_distance_km: 4.91,
      },
    ];

    const currentLiveMetrics: DailyMetricsMap = {
      'shuttle-01': {
        vehicle_id: 'shuttle-01',
        date: '2026-11-06',
        total_distance_km: 2.15,
        max_speed_kmh: 45.0,
        avg_speed_kmh: 22.0,
        active_minutes: 25,
        last_updated_at: '2026-11-06T03:00:00.000Z',
      },
    };

    // Calculate trend specifically for shuttle-01
    const trendShuttle01 = compute7DayTrendData(
      currentLiveMetrics,
      actualSupabaseRecords,
      refDate,
      'shuttle-01'
    );

    expect(trendShuttle01).toHaveLength(7);
    const yesterdayPoint = trendShuttle01.find((p) => p.date === '2026-11-05');
    expect(yesterdayPoint).toBeDefined();
    expect(yesterdayPoint?.totalDistanceKm).toBe(4.91);
    expect(yesterdayPoint?.isToday).toBe(false);

    // Calculate trend for fleet ("all")
    const trendFleet = compute7DayTrendData(
      currentLiveMetrics,
      actualSupabaseRecords,
      refDate,
      'all'
    );

    const yesterdayFleetPoint = trendFleet.find((p) => p.date === '2026-11-05');
    expect(yesterdayFleetPoint).toBeDefined();
    expect(yesterdayFleetPoint?.totalDistanceKm).toBe(4.91);
  });
});
