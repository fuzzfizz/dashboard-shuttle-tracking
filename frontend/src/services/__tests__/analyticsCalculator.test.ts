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

  it('computes 7-day trend for a specific vehicle filtering out others', () => {
    const refDate = new Date('2026-11-06T12:00:00Z');
    const pastRecords = [
      { vehicle_id: 'shuttle-01', date: '2026-11-05', total_distance_km: 4.91 },
      { vehicle_id: 'shuttle-02', date: '2026-11-05', total_distance_km: 12.0 },
      { vehicle_id: 'shuttle-01', date: '2026-11-04', total_distance_km: 3.2 },
    ];
    const dailyMetrics = {
      'shuttle-01': {
        vehicle_id: 'shuttle-01',
        date: '2026-11-06',
        total_distance_km: 1.5,
        max_speed_kmh: 30,
        avg_speed_kmh: 15,
        active_minutes: 10,
        last_updated_at: '',
      },
    };

    const points = compute7DayTrendData(dailyMetrics, pastRecords, refDate, 'shuttle-01');
    const yesterday = points.find((p) => p.date === '2026-11-05');
    const today = points.find((p) => p.date === '2026-11-06');

    expect(yesterday?.totalDistanceKm).toBe(4.91);
    expect(today?.totalDistanceKm).toBe(1.5);
  });

  it('computes 7-day trend aggregating all vehicles when selectedVehicleId is all or null', () => {
    const refDate = new Date('2026-11-06T12:00:00Z');
    const pastRecords = [
      { vehicle_id: 'shuttle-01', date: '2026-11-05', total_distance_km: 4.91 },
      { vehicle_id: 'shuttle-02', date: '2026-11-05', total_distance_km: 12.0 },
      { vehicle_id: 'shuttle-01', date: '2026-11-04', total_distance_km: 3.2 },
    ];
    const dailyMetrics = {
      'shuttle-01': {
        vehicle_id: 'shuttle-01',
        date: '2026-11-06',
        total_distance_km: 1.5,
        max_speed_kmh: 30,
        avg_speed_kmh: 15,
        active_minutes: 10,
        last_updated_at: '',
      },
      'shuttle-02': {
        vehicle_id: 'shuttle-02',
        date: '2026-11-06',
        total_distance_km: 2.5,
        max_speed_kmh: 30,
        avg_speed_kmh: 15,
        active_minutes: 10,
        last_updated_at: '',
      },
    };

    const pointsAll = compute7DayTrendData(dailyMetrics, pastRecords, refDate, 'all');
    const yesterdayAll = pointsAll.find((p) => p.date === '2026-11-05');
    const todayAll = pointsAll.find((p) => p.date === '2026-11-06');

    expect(yesterdayAll?.totalDistanceKm).toBe(16.91);
    expect(todayAll?.totalDistanceKm).toBe(4.0);

    const pointsNull = compute7DayTrendData(dailyMetrics, pastRecords, refDate, null);
    const yesterdayNull = pointsNull.find((p) => p.date === '2026-11-05');
    expect(yesterdayNull?.totalDistanceKm).toBe(16.91);
  });

  it('computes hourly activity accurately for a selected vehicle', () => {
    const hourlyMap = {
      'shuttle-01': { 7: 1.8, 8: 2.5, 13: 4.9 },
      'shuttle-02': { 7: 3.0, 9: 5.0 },
    };

    const points = computeHourlyActivityData(hourlyMap, 'shuttle-01');
    const hour7 = points.find((p) => p.hour === 7);
    const hour8 = points.find((p) => p.hour === 8);
    const hour9 = points.find((p) => p.hour === 9);

    expect(hour7?.distanceKm).toBe(1.8);
    expect(hour8?.distanceKm).toBe(2.5);
    expect(hour9?.distanceKm).toBe(0);
  });

  it('computes hourly activity aggregating all vehicles when selectedVehicleId is all or null', () => {
    const hourlyMap = {
      'shuttle-01': { 7: 1.8, 8: 2.5, 13: 4.9 },
      'shuttle-02': { 7: 3.0, 9: 5.0 },
    };

    const points = computeHourlyActivityData(hourlyMap, 'all');
    const hour7 = points.find((p) => p.hour === 7);
    const hour8 = points.find((p) => p.hour === 8);
    const hour9 = points.find((p) => p.hour === 9);

    expect(hour7?.distanceKm).toBe(4.8);
    expect(hour8?.distanceKm).toBe(2.5);
    expect(hour9?.distanceKm).toBe(5.0);
  });
});
