import { describe, it, expect } from 'vitest';
import {
  calculateFleetAnalyticsSummary,
  computeVehicleComparisonData,
  compute7DayTrendData,
  computeHourlyActivityData,
} from '../analyticsCalculator';
import { DailyMetricsMap } from '../../types/metrics';
import { FleetMap } from '../../types/telemetry';

describe('analyticsCalculator', () => {
  const mockDailyMetrics: DailyMetricsMap = {
    'BUS-01': {
      vehicle_id: 'BUS-01',
      date: '2026-11-05',
      total_distance_km: 45.5,
      max_speed_kmh: 42,
      avg_speed_kmh: 22,
      active_minutes: 150,
      last_updated_at: '2026-11-05T10:00:00Z',
    },
    'BUS-02': {
      vehicle_id: 'BUS-02',
      date: '2026-11-05',
      total_distance_km: 30.0,
      max_speed_kmh: 38,
      avg_speed_kmh: 20,
      active_minutes: 90,
      last_updated_at: '2026-11-05T10:00:00Z',
    },
  };

  const mockVehicles: FleetMap = {
    'BUS-01': { vehicle_id: 'BUS-01', lat: 18.79, lng: 98.98, speed: 25, timestamp: Date.now() },
    'BUS-02': { vehicle_id: 'BUS-02', lat: 18.80, lng: 98.99, speed: 18, timestamp: Date.now() },
  };

  it('calculates executive fleet summary KPIs accurately', () => {
    const summary = calculateFleetAnalyticsSummary(mockDailyMetrics, mockVehicles);
    expect(summary.totalDistanceKm).toBe(75.5);
    expect(summary.avgDistanceKm).toBe(37.75);
    expect(summary.topVehicleId).toBe('BUS-01');
    expect(summary.topVehicleDistanceKm).toBe(45.5);
    expect(summary.totalActiveMinutes).toBe(240);
  });

  it('handles empty fleet gracefully with zeros', () => {
    const summary = calculateFleetAnalyticsSummary({}, {});
    expect(summary.totalDistanceKm).toBe(0);
    expect(summary.avgDistanceKm).toBe(0);
    expect(summary.topVehicleId).toBe('-');
    expect(summary.topVehicleDistanceKm).toBe(0);
    expect(summary.totalActiveMinutes).toBe(0);
  });

  it('computes vehicle comparison bars and identifies fleet average', () => {
    const items = computeVehicleComparisonData(mockDailyMetrics, mockVehicles);
    expect(items).toHaveLength(2);
    expect(items[0].vehicleId).toBe('BUS-01');
    expect(items[0].distanceKm).toBe(45.5);
    expect(items[1].vehicleId).toBe('BUS-02');
    expect(items[1].distanceKm).toBe(30.0);
  });

  it('computes 7-day trend series with past daily points', () => {
    const trend = compute7DayTrendData(mockDailyMetrics, [
      { date: '2026-10-30', total_distance_km: 65.0 },
      { date: '2026-10-31', total_distance_km: 70.0 },
    ]);
    expect(trend).toHaveLength(7);
    expect(trend[6].totalDistanceKm).toBe(75.5);
  });

  it('computes hourly activity points across operating hours 06:00 to 20:00', () => {
    const hourly = computeHourlyActivityData(mockVehicles, mockDailyMetrics);
    expect(hourly.length).toBeGreaterThanOrEqual(14);
    expect(hourly[0].hourLabel).toBe('06:00');
    expect(hourly[hourly.length - 1].hourLabel).toBe('20:00');
  });
});
