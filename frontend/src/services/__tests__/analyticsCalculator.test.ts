import { describe, it, expect } from 'vitest';
import {
  calculateFleetAnalyticsSummary,
  computeVehicleComparisonData,
  compute7DayTrendData,
  computeHourlyActivityData,
  computeVehicleComparisonForTimeframe,
  computeTimeframeTrendData,
  DailyRecordItem,
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

  describe('Multi-Timeframe Analytics', () => {
    const mockDaily: DailyMetricsMap = {
      'BUS-01': {
        vehicle_id: 'BUS-01',
        date: '2026-11-18',
        total_distance_km: 40,
        max_speed_kmh: 45,
        avg_speed_kmh: 22,
        active_minutes: 120,
        last_updated_at: '2026-11-18T10:00:00Z',
      },
      'BUS-02': {
        vehicle_id: 'BUS-02',
        date: '2026-11-18',
        total_distance_km: 20,
        max_speed_kmh: 30,
        avg_speed_kmh: 15,
        active_minutes: 60,
        last_updated_at: '2026-11-18T10:00:00Z',
      },
    };

    const mockHistory: DailyRecordItem[] = [
      { vehicle_id: 'BUS-01', date: '2026-11-17', total_distance_km: 50 },
      { vehicle_id: 'BUS-02', date: '2026-11-17', total_distance_km: 30 },
      { vehicle_id: 'BUS-01', date: '2026-10-25', total_distance_km: 60 },
      { vehicle_id: 'BUS-01', date: '2025-12-15', total_distance_km: 100 },
      { vehicle_id: 'BUS-01', date: '2024-01-01', total_distance_km: 200 }, // > 365 days ago
    ];

    it('computes vehicle comparison for today correctly', () => {
      const res = computeVehicleComparisonForTimeframe('today', mockDaily, mockHistory);
      expect(res.items.length).toBe(2);
      expect(res.items[0].vehicleId).toBe('BUS-01');
      expect(res.items[0].distanceKm).toBe(40);
      expect(res.items[1].vehicleId).toBe('BUS-02');
      expect(res.items[1].distanceKm).toBe(20);
      expect(res.avgDistanceKm).toBe(30);
    });

    it('computes vehicle comparison for week summing historical within 7 days and today records', () => {
      const res = computeVehicleComparisonForTimeframe('week', mockDaily, mockHistory);
      expect(res.items.find((i) => i.vehicleId === 'BUS-01')?.distanceKm).toBe(90); // 40 today + 50 yesterday
      expect(res.items.find((i) => i.vehicleId === 'BUS-02')?.distanceKm).toBe(50); // 20 today + 30 yesterday
      expect(res.avgDistanceKm).toBe(70);
    });

    it('computes vehicle comparison for month summing historical within 30 days and today records', () => {
      const res = computeVehicleComparisonForTimeframe('month', mockDaily, mockHistory);
      // BUS-01: 40 today + 50 (Nov 17) + 60 (Oct 25) = 150
      expect(res.items.find((i) => i.vehicleId === 'BUS-01')?.distanceKm).toBe(150);
      // BUS-02: 20 today + 30 (Nov 17) = 50
      expect(res.items.find((i) => i.vehicleId === 'BUS-02')?.distanceKm).toBe(50);
      expect(res.avgDistanceKm).toBe(100);
    });

    it('computes vehicle comparison for year summing historical within 365 days and today records', () => {
      const res = computeVehicleComparisonForTimeframe('year', mockDaily, mockHistory);
      // BUS-01: 40 today + 50 (Nov 17) + 60 (Oct 25) + 100 (Dec 15 2025) = 250 (2024-01-01 is excluded)
      expect(res.items.find((i) => i.vehicleId === 'BUS-01')?.distanceKm).toBe(250);
      // BUS-02: 20 today + 30 (Nov 17) = 50
      expect(res.items.find((i) => i.vehicleId === 'BUS-02')?.distanceKm).toBe(50);
      expect(res.avgDistanceKm).toBe(150);
    });

    it('includes historical-only vehicles in comparison for week/month/year', () => {
      const historyWithExtra: DailyRecordItem[] = [
        ...mockHistory,
        { vehicle_id: 'BUS-03', date: '2026-11-17', total_distance_km: 25 },
      ];
      const res = computeVehicleComparisonForTimeframe('week', mockDaily, historyWithExtra);
      expect(res.items.some((i) => i.vehicleId === 'BUS-03')).toBe(true);
      expect(res.items.find((i) => i.vehicleId === 'BUS-03')?.distanceKm).toBe(25);
    });

    it('generates 1 trend point for today timeframe', () => {
      const points = computeTimeframeTrendData('today', mockDaily, mockHistory, new Date('2026-11-18T12:00:00Z'));
      expect(points).toHaveLength(1);
      expect(points[0].isToday).toBe(true);
      expect(points[0].totalDistanceKm).toBe(60);
      expect(points[0].dayLabel).toBe('วันนี้');
    });

    it('generates 7 trend points for week timeframe', () => {
      const points = computeTimeframeTrendData('week', mockDaily, mockHistory, new Date('2026-11-18T12:00:00Z'));
      expect(points).toHaveLength(7);
      expect(points[points.length - 1].isToday).toBe(true);
      expect(points[points.length - 1].totalDistanceKm).toBe(60);
    });

    it('generates 30 trend points for month timeframe with day labels', () => {
      const points = computeTimeframeTrendData('month', mockDaily, mockHistory, new Date('2026-11-18T12:00:00Z'));
      expect(points).toHaveLength(30);
      expect(points[points.length - 1].isToday).toBe(true);
      expect(points[points.length - 1].totalDistanceKm).toBe(60);
      // Yesterday: Nov 17 should have 50 + 30 = 80
      const yesterday = points[points.length - 2];
      expect(yesterday.totalDistanceKm).toBe(80);
      expect(yesterday.dayLabel).toMatch(/17/);
    });

    it('generates 12 monthly trend points for year timeframe with Thai month labels', () => {
      const points = computeTimeframeTrendData('year', mockDaily, mockHistory, new Date('2026-11-18T12:00:00Z'));
      expect(points).toHaveLength(12);
      expect(points[points.length - 1].isToday).toBe(true);
      expect(points[points.length - 1].dayLabel).toMatch(/พ.ย.|11/);
      // November 2026 should include today (60) + Nov 17 (80) = 140
      expect(points[points.length - 1].totalDistanceKm).toBe(140);
      // October 2026 (points[10]) should have Oct 25 (60)
      expect(points[points.length - 2].dayLabel).toMatch(/ต.ค.|10/);
      expect(points[points.length - 2].totalDistanceKm).toBe(60);
    });

    it('filters timeframe trend data by selectedVehicleId for month and year', () => {
      const refDate = new Date('2026-11-18T12:00:00Z');
      const monthPoints = computeTimeframeTrendData('month', mockDaily, mockHistory, refDate, 'BUS-01');
      expect(monthPoints[monthPoints.length - 1].totalDistanceKm).toBe(40); // only BUS-01 today
      expect(monthPoints[monthPoints.length - 2].totalDistanceKm).toBe(50); // only BUS-01 yesterday

      const yearPoints = computeTimeframeTrendData('year', mockDaily, mockHistory, refDate, 'BUS-02');
      expect(yearPoints[yearPoints.length - 1].totalDistanceKm).toBe(50); // BUS-02: 20 today + 30 on Nov 17
      expect(yearPoints[yearPoints.length - 2].totalDistanceKm).toBe(0); // BUS-02 had no Oct records
    });
  });
});
